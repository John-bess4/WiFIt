import Foundation
import Observation
import FitDataKit

public enum AppStage: String, Equatable, Sendable {
    case launching, signedOut, sessionRecovery, loadingProfile, profileFailure, profileSetup, ready
}

/// Navigation and write readiness depend on verified reads, never inferred empty values.
@MainActor @Observable public final class AppCoordinator {
    public private(set) var stage: AppStage = .launching
    public private(set) var userID: UUID?
    public private(set) var profile: ProfileRow?
    public private(set) var failure: DataError?
    public private(set) var isBusy = false
    public private(set) var resources = Dictionary(uniqueKeysWithValues: AppResource.allCases.map { ($0, ResourceState()) })
    public private(set) var localDay: LocalDay?
    public private(set) var timeZoneIdentifier: String?
    public private(set) var pendingProfileDraft: ProfileCompletionDraft?
    public private(set) var profileNeedsReconciliation = false
    public var profileDraft: ProfileCompletionDraft { pendingProfileDraft ?? ProfileCompletionDraft(original: profile) }
    public var loadContext: LoadContext? {
        guard let userID, let localDay, let timeZoneIdentifier else { return nil }
        return LoadContext(userID: userID, day: localDay, timeZoneIdentifier: timeZoneIdentifier)
    }
    @ObservationIgnored private let service: any AppService
    @ObservationIgnored private let now: @Sendable () -> Date
    @ObservationIgnored private let timeZone: @Sendable () -> TimeZone
    @ObservationIgnored private var epoch = UUID()
    @ObservationIgnored private var resourceRequests: [AppResource: UUID] = [:]
    @ObservationIgnored private var confirmedMissingProfile = false

    public init(service: any AppService, now: @escaping @Sendable () -> Date = Date.init,
                timeZone: @escaping @Sendable () -> TimeZone = { .current }) {
        self.service = service; self.now = now; self.timeZone = timeZone
    }

    public func start() async { await resolve() }
    public func retrySession() async { await resolve() }

    /// Retain in-progress form edits before a lifecycle read temporarily replaces the setup view.
    public func rememberProfileDraft(_ draft: ProfileCompletionDraft, userID expectedUserID: UUID) {
        guard userID == expectedUserID, stage == .profileSetup, !isBusy, draft.original == profile,
              profile != nil || confirmedMissingProfile else { return }
        pendingProfileDraft = draft
    }

    private func resolve() async {
        let attempt = beginOperation()
        stage = userID == nil ? .launching : .loadingProfile
        defer { if epoch == attempt { isBusy = false } }
        do throws(DataError) {
            guard let id = try await service.resolveSession() else {
                guard epoch == attempt else { return }
                clearAccount(); stage = .signedOut
                return
            }
            guard epoch == attempt else { return }
            adopt(id)
            try updateDay()
            await loadProfile(attempt: attempt)
        } catch {
            guard epoch == attempt else { return }
            // Even a temporary refresh failure hides user content while retaining credentials in Auth.
            enterSessionRecovery(error)
        }
    }

    public func signIn(email: String, password: String) async {
        let attempt = beginOperation()
        clearAccount(); stage = .signedOut
        defer { if epoch == attempt { isBusy = false } }
        do throws(DataError) {
            let id = try await service.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            guard epoch == attempt else { return }
            adopt(id)
            try updateDay()
            await loadProfile(attempt: attempt)
        } catch {
            guard epoch == attempt else { return }
            clearAccount(); stage = .signedOut; failure = error
        }
    }

    public func signOut() async {
        let attempt = beginOperation()
        // Synchronous clearing happens before Keychain/server work suspends.
        clearAccount(); stage = .signedOut
        defer { if epoch == attempt { isBusy = false } }
        do throws(DataError) { try await service.signOut() }
        catch {
            guard epoch == attempt else { return }
            failure = error
            // A Keychain deletion failure must be retried before restoring a stored session.
            if case .storage = error { stage = .sessionRecovery }
        }
    }

    public func retryProfile() async {
        guard userID != nil else { await resolve(); return }
        let attempt = beginOperation()
        defer { if epoch == attempt { isBusy = false } }
        do throws(DataError) { try updateDay() }
        catch { failure = error; stage = .profileFailure; return }
        await loadProfile(attempt: attempt)
    }

    public func completeProfile(_ draft: ProfileCompletionDraft, userID expectedUserID: UUID) async {
        guard userID == expectedUserID, stage == .profileSetup, !isBusy,
              !profileNeedsReconciliation, let id = userID else { return }
        guard draft.original == profile, profile != nil || confirmedMissingProfile else {
            failure = .invalidInput("Profile changed. Reload it before saving.")
            return
        }
        // Build/validate before a mutation is attempted. A local validation error is safe to edit.
        let mutation: ProfileMutation
        do throws(DataError) {
            if profile != nil { mutation = .patch(try draft.buildPatch(userID: id)) }
            else { mutation = .create(try draft.buildCreate(userID: id)) }
        } catch { failure = error; return }
        let attempt = beginOperation()
        pendingProfileDraft = draft
        defer { if epoch == attempt { isBusy = false } }
        do throws(DataError) {
            let saved: ProfileRow
            switch mutation {
            case .patch(let patch): saved = try await service.saveProfile(userID: id, patch: patch)
            case .create(let value): saved = try await service.createProfile(value: value)
            }
            guard epoch == attempt, userID == id else { return }
            guard saved.id == id else { throw .outcomeUnknown(operation: "profile save") }
            // A returned representation alone never opens the feature gate.
            profileNeedsReconciliation = true
            await loadProfile(attempt: attempt, requireExisting: true)
        } catch {
            guard epoch == attempt, userID == id else { return }
            profileNeedsReconciliation = true
            failure = error
            if isAuthFailure(error) { enterSessionRecovery(error) }
            else { stage = .profileFailure }
        }
    }

    private enum ProfileMutation { case patch(ProfileCompletionPatch), create(ProfileWrite) }

    private func loadProfile(attempt: UUID, requireExisting: Bool = false) async {
        guard let id = userID, epoch == attempt else { return }
        stage = .loadingProfile
        failure = nil
        do throws(DataError) {
            let loaded = try await service.loadProfile(userID: id)
            guard epoch == attempt, userID == id else { return }
            guard loaded == nil || loaded?.id == id else { throw .invalidResponse }
            if requireExisting && loaded == nil { throw .invalidResponse }
            profile = loaded
            confirmedMissingProfile = loaded == nil
            profileNeedsReconciliation = false
            pendingProfileDraft = pendingProfileDraft?.rebased(on: loaded)
            if let loaded, ProfileCompletionDraft.isComplete(loaded) {
                pendingProfileDraft = nil
                stage = .ready
                isBusy = false
                await loadAll(attempt: attempt)
            } else {
                // Only this successful read path may show setup. No seeding occurs here.
                stage = .profileSetup
            }
        } catch {
            guard epoch == attempt, userID == id else { return }
            failure = error
            confirmedMissingProfile = false
            if isAuthFailure(error) { enterSessionRecovery(error) }
            else { stage = .profileFailure }
        }
    }

    public func retry(_ resource: AppResource) async {
        guard stage == .ready, let context = loadContext else { return }
        await load(resource, context: context, attempt: epoch)
    }

    /// Call on active scene, significant-time/timezone changes and a midnight timer.
    /// Session and profile are revalidated before dependent loads on every foreground.
    public func refreshForLifecycle() async {
        guard stage != .signedOut, !isBusy else { return }
        await resolve()
    }

    public func canWrite(dependingOn dependencies: Set<AppResource>) -> Bool {
        guard stage == .ready, !isBusy, let context = loadContext else { return false }
        let zone = timeZone()
        guard zone.identifier == context.timeZoneIdentifier,
              (try? LocalDay(date: now(), timeZone: zone)) == context.day else { return false }
        return dependencies.allSatisfy { resources[$0]?.isReady(in: context) == true }
    }
    public var canStartWorkout: Bool { canWrite(dependingOn: [.workoutPlans, .workoutSessions, .exerciseBests]) }

    private func loadAll(attempt: UUID) async {
        guard let context = loadContext, epoch == attempt, stage == .ready else { return }
        // Invalidate write readiness together before any child request can complete.
        for resource in AppResource.allCases {
            var state = resources[resource] ?? ResourceState()
            state.isLoading = true; state.failure = nil
            resources[resource] = state
        }
        await withTaskGroup(of: Void.self) { group in
            for resource in AppResource.allCases {
                group.addTask { await self.load(resource, context: context, attempt: attempt) }
            }
        }
    }

    private func load(_ resource: AppResource, context: LoadContext, attempt: UUID) async {
        guard epoch == attempt, loadContext == context, stage == .ready else { return }
        let request = UUID()
        resourceRequests[resource] = request
        var state = resources[resource] ?? ResourceState()
        state.isLoading = true; state.failure = nil
        resources[resource] = state
        do throws(DataError) {
            let payload = try await service.load(resource, context: context)
            guard epoch == attempt, resourceRequests[resource] == request, loadContext == context, stage == .ready else { return }
            guard payload.resource == resource, payload.belongs(to: context.userID), payload.matchesDay(context.day) else { throw .invalidResponse }
            state.payload = payload; state.context = context; state.verifiedAt = now()
            state.isLoading = false; state.failure = nil
            resources[resource] = state
        } catch {
            guard epoch == attempt, resourceRequests[resource] == request, loadContext == context, stage == .ready else { return }
            state.isLoading = false; state.failure = error
            resources[resource] = state
            if isAuthFailure(error) { enterSessionRecovery(error) }
        }
    }

    private func beginOperation() -> UUID {
        epoch = UUID(); resourceRequests.removeAll()
        isBusy = true; failure = nil
        return epoch
    }
    private func adopt(_ id: UUID) {
        if userID != id { clearAccount(); userID = id }
    }
    private func clearAccount() {
        userID = nil; profile = nil; pendingProfileDraft = nil
        profileNeedsReconciliation = false; confirmedMissingProfile = false
        resources = Dictionary(uniqueKeysWithValues: AppResource.allCases.map { ($0, ResourceState()) })
        resourceRequests.removeAll(); localDay = nil; timeZoneIdentifier = nil
    }
    private func updateDay() throws(DataError) {
        let zone = timeZone()
        let next: LocalDay
        do { next = try LocalDay(date: now(), timeZone: zone) }
        catch { throw .invalidInput("The device date is outside the supported range.") }
        if next != localDay || zone.identifier != timeZoneIdentifier {
            for resource in AppResource.allCases where resource.isDayScoped { resources[resource] = ResourceState() }
        }
        localDay = next; timeZoneIdentifier = zone.identifier
    }
    private func enterSessionRecovery(_ error: DataError) {
        // Invalidate every outstanding response and remove all account-visible state.
        epoch = UUID(); clearAccount(); isBusy = false
        failure = error; stage = .sessionRecovery
    }
    private func isAuthFailure(_ error: DataError) -> Bool {
        switch error {
        case .authenticationRequired, .sessionChanged: true
        case .http(let status, _): status == 401 || status == 403
        default: false
        }
    }
}
