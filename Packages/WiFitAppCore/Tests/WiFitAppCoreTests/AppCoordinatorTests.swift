import Foundation
import Testing
import FitDataKit
@testable import WiFitAppCore

private let userA = UUID(uuidString: "a0000000-0000-4000-8000-000000000001")!
private let userB = UUID(uuidString: "b0000000-0000-4000-8000-000000000002")!
private let fixtureDay = try! LocalDay("2026-09-09")

private func complete(_ id: UUID) -> ProfileRow {
    ProfileRow(id: id, name: "Fixture", age: 30, weightLbs: 170, heightIn: 70,
        activityLevel: "moderate", calGoal: 2222, proteinGoal: 142, carbsGoal: 220,
        fatGoal: 70, theme: "sister-app-future-theme", gender: "male", goalRate: "maintain")
}

private func empty(_ resource: AppResource) -> ResourcePayload {
    switch resource {
    case .foodLog: .foodLog([])
    case .customFoods: .customFoods([])
    case .workoutSessions: .workoutSessions([])
    case .workoutPlans: .workoutPlans([])
    case .supplementStack: .supplementStack([])
    case .supplementLog: .supplementLog([])
    case .waterLog: .waterLog([])
    case .bodyWeightLog: .bodyWeightLog([])
    case .exerciseBests: .exerciseBests([])
    case .exercisePREvents: .exercisePREvents([])
    case .dailySummary: .dailySummary([])
    case .supplementDueFrom: .supplementDueFrom([])
    case .weightMonthly: .weightMonthly([])
    }
}

private actor Gate {
    var entered = false
    var open = false
    var entrants: [CheckedContinuation<Void, Never>] = []
    var blocked: [CheckedContinuation<Void, Never>] = []
    func arrive() async {
        entered = true; entrants.forEach { $0.resume() }; entrants.removeAll()
        if !open { await withCheckedContinuation { blocked.append($0) } }
    }
    func waitForEntry() async {
        if !entered { await withCheckedContinuation { entrants.append($0) } }
    }
    func release() { open = true; blocked.forEach { $0.resume() }; blocked.removeAll() }
}

private actor FakeService: AppService {
    var currentUser: UUID? = userA
    var profiles: [UUID: ProfileRow] = [userA: complete(userA), userB: complete(userB)]
    var resolveFailure: DataError?
    var profileFailure: DataError?
    var resourceFailures: [AppResource: DataError] = [:]
    var resourcePayloads: [AppResource: ResourcePayload] = [:]
    var profileGate: (UUID, Gate)?
    var resourceGate: (AppResource, Gate)?
    var logoutGate: Gate?
    var saveFailure: DataError?
    var applyBeforeFailure = false
    var events: [String] = []
    var loadContexts: [LoadContext] = []
    func setProfile(_ profile: ProfileRow?, for id: UUID = userA) { profiles[id] = profile }
    func setProfileFailure(_ error: DataError?) { profileFailure = error }
    func setResolveFailure(_ error: DataError?) { resolveFailure = error }
    func setResourceFailure(_ error: DataError?, for resource: AppResource) { resourceFailures[resource] = error }
    func setResourcePayload(_ payload: ResourcePayload) { resourcePayloads[payload.resource] = payload }
    func holdProfile(_ id: UUID, gate: Gate) { profileGate = (id, gate) }
    func holdResource(_ resource: AppResource, gate: Gate) { resourceGate = (resource, gate) }
    func holdLogout(_ gate: Gate) { logoutGate = gate }
    func failSave(_ error: DataError?, afterApplying: Bool = false) { saveFailure = error; applyBeforeFailure = afterApplying }
    func resolveSession() async throws(DataError) -> UUID? {
        events.append("resolve")
        if let resolveFailure { throw resolveFailure }
        return currentUser
    }
    func signIn(email: String, password: String) async throws(DataError) -> UUID {
        events.append("signIn")
        let id = email == "b@example.test" ? userB : userA
        currentUser = id
        return id
    }
    func signOut() async throws(DataError) {
        events.append("signOut"); currentUser = nil
        if let logoutGate { await logoutGate.arrive() }
    }
    func loadProfile(userID: UUID) async throws(DataError) -> ProfileRow? {
        events.append("profile")
        let value = profiles[userID], error = profileFailure
        if let (heldUser, gate) = profileGate, heldUser == userID { await gate.arrive() }
        if let error { throw error }
        return value
    }
    func saveProfile(userID: UUID, patch: ProfileCompletionPatch) async throws(DataError) -> ProfileRow {
        events.append("save")
        if let saveFailure, !applyBeforeFailure { throw saveFailure }
        guard let original = profiles[userID] else { throw .unexpectedRowCount(expected: 1, actual: 0) }
        let result: ProfileRow
        do {
            var object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(original)) as! [String: Any]
            let edits = try JSONSerialization.jsonObject(with: JSONEncoder().encode(patch)) as! [String: Any]
            object.merge(edits) { _, new in new }
            result = try JSONDecoder().decode(ProfileRow.self, from: JSONSerialization.data(withJSONObject: object))
        } catch { throw .decoding }
        profiles[userID] = result
        if let saveFailure { throw saveFailure }
        return result
    }
    func createProfile(value: ProfileWrite) async throws(DataError) -> ProfileRow {
        events.append("create")
        guard profiles[value.id] == nil else { throw .unexpectedRowCount(expected: 1, actual: 0) }
        if let saveFailure, !applyBeforeFailure { throw saveFailure }
        let row: ProfileRow
        do { row = try JSONDecoder().decode(ProfileRow.self, from: JSONEncoder().encode(value)) }
        catch { throw .decoding }
        profiles[row.id] = row
        if let saveFailure { throw saveFailure }
        return row
    }
    func load(_ resource: AppResource, context: LoadContext) async throws(DataError) -> ResourcePayload {
        events.append(resource.rawValue); loadContexts.append(context)
        let payload = resourcePayloads[resource] ?? empty(resource), error = resourceFailures[resource]
        if let (heldResource, gate) = resourceGate, heldResource == resource { await gate.arrive() }
        if let error { throw error }
        return payload
    }
}

private final class TestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var instant = ISO8601DateFormatter().date(from: "2026-09-09T07:00:00Z")!
    private var zone = TimeZone(secondsFromGMT: 0)!
    func now() -> Date { lock.withLock { instant } }
    func timeZone() -> TimeZone { lock.withLock { zone } }
    func advance(_ seconds: TimeInterval) { lock.withLock { instant += seconds } }
    func move(to timeZone: TimeZone) { lock.withLock { zone = timeZone } }
}

@Suite @MainActor struct AppCoordinatorTests {
    @Test func failedProfileNeverCreatesOrOnboards() async {
        let service = FakeService()
        await service.setProfileFailure(.http(status: 500, code: nil))
        let app = AppCoordinator(service: service)
        await app.start()
        #expect(app.stage == .profileFailure)
        #expect(app.profile == nil)
        #expect(await service.events == ["resolve", "profile"])
        #expect(app.resources.values.allSatisfy { $0.payload == nil })
        #expect(!app.canWrite(dependingOn: []))
    }

    @Test func successfulAbsenceAloneShowsSetup() async {
        let service = FakeService()
        await service.setProfile(nil)
        let app = AppCoordinator(service: service)
        await app.start()
        #expect(app.stage == .profileSetup)
        #expect(app.profileDraft.name.isEmpty)
        #expect(await service.events == ["resolve", "profile"])
    }

    @Test func profilePrecedesEveryParallelResource() async {
        let service = FakeService(), gate = Gate()
        await service.holdProfile(userA, gate: gate)
        let app = AppCoordinator(service: service)
        let task = Task { await app.start() }
        await gate.waitForEntry()
        #expect(await service.events == ["resolve", "profile"])
        #expect(app.stage == .loadingProfile)
        await gate.release(); await task.value
        let events = await service.events
        #expect(events.prefix(2) == ["resolve", "profile"])
        #expect(events.count == 15)
        #expect(app.resources.values.allSatisfy { $0.payload != nil && $0.count == 0 })
        #expect(app.canStartWorkout)
    }

    @Test func partialCompletionPreservesSavedTargetsThemeAndReadsBack() async {
        let service = FakeService()
        var partial = complete(userA); partial.name = nil
        await service.setProfile(partial)
        let app = AppCoordinator(service: service)
        await app.start()
        var draft = app.profileDraft; draft.name = "Entered name"
        await app.completeProfile(draft, userID: userA)
        #expect(app.stage == .ready)
        #expect(app.profile?.name == "Entered name")
        #expect(app.profile?.calGoal == 2222)
        #expect(app.profile?.theme == "sister-app-future-theme")
        let events = await service.events
        #expect(events.prefix(4) == ["resolve", "profile", "save", "profile"])
        #expect(!events.contains("create"))
    }

    @Test func resourceFailureBlocksOnlyDependentsAndRetryRestoresReadiness() async {
        let service = FakeService()
        await service.setResourceFailure(.http(status: 500, code: nil), for: .waterLog)
        await service.setResourceFailure(.decoding, for: .exerciseBests)
        let app = AppCoordinator(service: service)
        await app.start()
        #expect(app.stage == .ready)
        #expect(!app.canWrite(dependingOn: [.waterLog]))
        #expect(!app.canStartWorkout)
        #expect(app.canWrite(dependingOn: [.foodLog]))
        #expect(app.resources[.waterLog]?.payload == nil)
        await service.setResourceFailure(nil, for: .waterLog)
        await app.retry(.waterLog)
        #expect(app.canWrite(dependingOn: [.waterLog]))
        #expect(!app.canStartWorkout)
    }

    @Test func lateProfileFromAIsIgnoredAfterBSignsIn() async {
        let service = FakeService(), gate = Gate()
        await service.holdProfile(userA, gate: gate)
        let app = AppCoordinator(service: service)
        let first = Task { await app.start() }
        await gate.waitForEntry()
        await app.signIn(email: "b@example.test", password: "not-a-live-credential")
        #expect(app.userID == userB)
        await gate.release(); await first.value
        #expect(app.userID == userB)
        #expect(app.profile?.id == userB)
        #expect(app.resources.values.allSatisfy { $0.context?.userID == userB })
    }

    @Test func signOutClearsImmediatelyBeforeRemoteCompletionAndLateRead() async {
        let service = FakeService(), resourceGate = Gate(), logoutGate = Gate()
        await service.holdResource(.waterLog, gate: resourceGate)
        let app = AppCoordinator(service: service)
        let first = Task { await app.start() }
        await resourceGate.waitForEntry()
        await service.holdLogout(logoutGate)
        let logout = Task { await app.signOut() }
        await logoutGate.waitForEntry()
        #expect(app.stage == .signedOut && app.userID == nil && app.profile == nil)
        #expect(app.resources.values.allSatisfy { $0.payload == nil })
        await resourceGate.release(); await first.value
        #expect(app.resources[.waterLog]?.payload == nil)
        await logoutGate.release(); await logout.value
    }

    @Test func transientSessionFailureIsRecoverableWithoutSignIn() async {
        let service = FakeService()
        await service.setResolveFailure(.network)
        let app = AppCoordinator(service: service)
        await app.start()
        #expect(app.stage == .sessionRecovery && app.userID == nil)
        await service.setResolveFailure(nil)
        await app.retrySession()
        #expect(app.stage == .ready && app.userID == userA)
        #expect(!(await service.events).contains("signIn"))
    }

    @Test func authFailureInASectionClearsEverySection() async {
        let service = FakeService()
        await service.setResourceFailure(.http(status: 403, code: "42501"), for: .exerciseBests)
        let app = AppCoordinator(service: service)
        await app.start()
        #expect(app.stage == .sessionRecovery && app.userID == nil)
        #expect(app.resources.values.allSatisfy { $0.payload == nil })
        #expect(!app.canStartWorkout)
    }

    @Test func unknownSaveMustReconcileAndDoesNotReplay() async {
        let service = FakeService()
        var partial = complete(userA); partial.name = nil
        await service.setProfile(partial)
        await service.failSave(.outcomeUnknown(operation: "update"), afterApplying: true)
        let app = AppCoordinator(service: service)
        await app.start()
        var draft = app.profileDraft; draft.name = "Confirmed after reconnect"
        await app.completeProfile(draft, userID: userA)
        #expect(app.stage == .profileFailure && app.profileNeedsReconciliation)
        #expect(app.pendingProfileDraft?.name == "Confirmed after reconnect")
        await app.completeProfile(draft, userID: userA)
        #expect((await service.events).filter { $0 == "save" }.count == 1)
        await app.retryProfile()
        #expect(app.stage == .ready && !app.profileNeedsReconciliation)
        #expect(app.profile?.name == "Confirmed after reconnect")
        #expect((await service.events).filter { $0 == "save" }.count == 1)
    }

    @Test func failedSaveDraftSurvivesReadAndKeepsConcurrentTheme() async {
        let service = FakeService()
        var partial = complete(userA); partial.name = nil
        await service.setProfile(partial)
        await service.failSave(.http(status: 500, code: nil))
        let app = AppCoordinator(service: service)
        await app.start()
        var draft = app.profileDraft; draft.name = "Still entered"
        await app.completeProfile(draft, userID: userA)
        partial.theme = "fresh-theme-from-other-device"
        await service.setProfile(partial)
        await app.retryProfile()
        #expect(app.stage == .profileSetup)
        #expect(app.profileDraft.name == "Still entered")
        #expect(app.profileDraft.original?.theme == "fresh-theme-from-other-device")
    }

    @Test func dayAndTimezoneChangesInvalidateAndReloadDayScopedValues() async {
        let service = FakeService(), clock = TestClock()
        let app = AppCoordinator(service: service, now: clock.now, timeZone: clock.timeZone)
        await app.start()
        let first = app.localDay
        clock.advance(86_400)
        #expect(!app.canWrite(dependingOn: [.waterLog]))
        await app.refreshForLifecycle()
        #expect(app.localDay != first)
        let second = app.loadContext
        clock.move(to: TimeZone(secondsFromGMT: -12 * 3600)!)
        await app.refreshForLifecycle()
        #expect(app.timeZoneIdentifier == "GMT-1200")
        #expect(app.loadContext != second)
        #expect(app.resources.values.allSatisfy { $0.context == app.loadContext })
        #expect((await service.loadContexts).count == 39)
    }

    @Test func lifecycleRevalidationRetainsEnteredDraftAndFreshServerValues() async {
        let service = FakeService()
        var partial = complete(userA); partial.name = nil
        await service.setProfile(partial)
        let app = AppCoordinator(service: service)
        await app.start()
        var draft = app.profileDraft; draft.name = "Unsaved entered name"
        app.rememberProfileDraft(draft, userID: userA)
        partial.theme = "changed-by-sister-app"
        await service.setProfile(partial)
        await app.refreshForLifecycle()
        #expect(app.stage == .profileSetup)
        #expect(app.profileDraft.name == "Unsaved entered name")
        #expect(app.profileDraft.original?.theme == "changed-by-sister-app")
        #expect(!(await service.events).contains("save"))
    }

    @Test func refreshedReadFailureRetainsVerifiedValueButBlocksReplacementWrites() async {
        let service = FakeService(), clock = TestClock()
        await service.setResourcePayload(.waterLog([WaterLogRow(id: UUID(), userID: userA, logDate: fixtureDay, oz: 24)]))
        let app = AppCoordinator(service: service, now: clock.now, timeZone: clock.timeZone)
        await app.start()
        let previous = app.resources[.waterLog]?.payload
        await service.setResourceFailure(.network, for: .waterLog)
        await app.retry(.waterLog)
        #expect(app.resources[.waterLog]?.payload == previous)
        #expect(app.resources[.waterLog]?.failure == .network)
        #expect(!app.canWrite(dependingOn: [.waterLog]))
    }

    @Test func responseWithAnotherOwnerFailsClosed() async {
        let service = FakeService()
        await service.setResourcePayload(.waterLog([WaterLogRow(id: UUID(), userID: userB, logDate: fixtureDay, oz: 88)]))
        let app = AppCoordinator(service: service)
        await app.start()
        #expect(app.resources[.waterLog]?.payload == nil)
        #expect(app.resources[.waterLog]?.failure == .invalidResponse)
    }

    @Test func missingProfileDraftCannotCrossAccountSwitch() async {
        let service = FakeService()
        await service.setProfile(nil, for: userA); await service.setProfile(nil, for: userB)
        let app = AppCoordinator(service: service)
        await app.start()
        var draft = app.profileDraft; draft.name = "Private entered name for A"
        await app.signIn(email: "b@example.test", password: "not-a-live-credential")
        app.rememberProfileDraft(draft, userID: userA)
        await app.completeProfile(draft, userID: userA)
        #expect(app.profileDraft.name.isEmpty)
        #expect(app.userID == userB && app.stage == .profileSetup)
        #expect(!(await service.events).contains("create"))
    }

    @Test func concurrentProfileCreationRequiresReadBeforeAnyFurtherWrite() async {
        let service = FakeService()
        await service.setProfile(nil)
        let app = AppCoordinator(service: service)
        await app.start()
        var draft = app.profileDraft
        draft.name = "Proposed name"; draft.age = "30"; draft.weightLbs = "170"; draft.heightIn = "70"
        draft.gender = "male"; draft.activityLevel = "moderate"; draft.goalRate = "maintain"
        await service.setProfile(complete(userA))
        await app.completeProfile(draft, userID: userA)
        #expect(app.stage == .profileFailure && app.profileNeedsReconciliation)
        await app.retryProfile()
        #expect(app.stage == .ready)
        #expect(app.profile?.name == "Fixture")
        #expect(app.profile?.calGoal == 2222 && app.profile?.theme == "sister-app-future-theme")
        #expect((await service.events).filter { $0 == "create" }.count == 1)
    }

    @Test func wrongDayAndDuplicateWaterRowsNeverEnableReplacement() async {
        let service = FakeService(), clock = TestClock()
        await service.setResourcePayload(.waterLog([WaterLogRow(id: UUID(), userID: userA, logDate: try! LocalDay("2026-09-08"), oz: 48)]))
        let app = AppCoordinator(service: service, now: clock.now, timeZone: clock.timeZone)
        await app.start()
        #expect(app.resources[.waterLog]?.failure == .invalidResponse)
        await service.setResourcePayload(.waterLog([
            WaterLogRow(id: UUID(), userID: userA, logDate: fixtureDay, oz: 24),
            WaterLogRow(id: UUID(), userID: userA, logDate: fixtureDay, oz: 48)]))
        await app.retry(.waterLog)
        #expect(app.resources[.waterLog]?.payload == nil)
        #expect(!app.canWrite(dependingOn: [.waterLog]))
    }
}
