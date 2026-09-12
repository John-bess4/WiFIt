import Foundation
import XCTest
@testable import FitDataKit

/// Explicitly opt-in integration smoke against two EXISTING, dedicated QA accounts.
/// No account creation, admin key, TrainerHQ-owned relation, or on-disk token storage.
///
/// Required environment (values must be supplied outside source control):
/// WIFIT_RUN_LIVE_TESTS=1
/// WIFIT_SUPABASE_URL, WIFIT_SUPABASE_PUBLISHABLE_KEY
/// WIFIT_QA_A_EMAIL, WIFIT_QA_A_PASSWORD, WIFIT_QA_A_USER_ID
/// WIFIT_QA_B_EMAIL, WIFIT_QA_B_PASSWORD, WIFIT_QA_B_USER_ID
///
/// This creates uniquely named QA food rows, exercises real user-JWT PostgREST
/// reads/writes and an attempted forged-owner insert, and awaits cleanup even when
/// an assertion/request fails. A failed cleanup fails the test and reports ONLY
/// the unique QA run marker for recovery; passwords, JWTs, and row bodies never log.
/// Without explicit opt-in and all configuration this test is reported SKIPPED,
/// not successful RLS verification. Do not enable it against personal accounts.
@MainActor
final class LiveSupabaseTests: XCTestCase {
    func testRealJWTWriteReadUpdateDeleteAndTwoAccountRLS() async throws {
        let settings = try LiveSmokeSettings.fromEnvironment()
        let transport = URLSessionTransport()
        let authA = Auth(configuration: settings.configuration, store: LiveSmokeMemoryStore(), transport: transport)
        let authB = Auth(configuration: settings.configuration, store: LiveSmokeMemoryStore(), transport: transport)
        let clientA = SupabaseREST(configuration: settings.configuration, auth: authA, transport: transport)
        let clientB = SupabaseREST(configuration: settings.configuration, auth: authB, transport: transport)
        let marker = "FitDataKit QA RLS " + UUID().uuidString
        let nameA = marker + " owner A", nameB = marker + " owner B", forgedName = marker + " denied forgery"
        let names = [nameA, nameB, forgedName]
        var createdA = Set<UUID>(), createdB = Set<UUID>()
        var failure: (any Error)?
        var dataWritesStarted = false

        do {
            let sessionA = try await authA.signIn(email: settings.accountA.email, password: settings.accountA.password)
            let sessionB = try await authB.signIn(email: settings.accountB.email, password: settings.accountB.password)
            // Identity is checked before any data mutation; a working login alone is insufficient.
            guard sessionA.userID == settings.accountA.userID,
                  sessionB.userID == settings.accountB.userID,
                  sessionA.userID != sessionB.userID else { throw LiveSmokeFailure.unexpectedAccount }

            let day = try LocalDay(date: Date())
            var valueA = LiveSmokeOperations.food(userID: sessionA.userID, day: day, name: nameA)
            var valueB = LiveSmokeOperations.food(userID: sessionB.userID, day: day, name: nameB)
            dataWritesStarted = true
            let rowA = try await clientA.save(value: valueA)
            createdA.insert(rowA.id)
            let rowB = try await clientB.save(value: valueB)
            createdB.insert(rowB.id)
            guard rowA.userID == sessionA.userID, rowB.userID == sessionB.userID,
                  rowA.foodName == nameA, rowB.foodName == nameB else { throw LiveSmokeFailure.wrongReturnedRow }

            let rereadA = try await clientA.readAll(FoodLogRow.self, filters: [.equal("id", uuid: rowA.id)])
            let rereadB = try await clientB.readAll(FoodLogRow.self, filters: [.equal("id", uuid: rowB.id)])
            guard rereadA.count == 1, rereadA[0].id == rowA.id, rereadA[0].grams == 1,
                  rereadB.count == 1, rereadB[0].id == rowB.id, rereadB[0].grams == 1 else {
                throw LiveSmokeFailure.insertDidNotPersist
            }

            // No user_id filter: real RLS must constrain B even when the caller asks for everything.
            let unfilteredB = try await clientB.readAll(FoodLogRow.self)
            guard unfilteredB.contains(where: { $0.id == rowB.id }),
                  unfilteredB.allSatisfy({ $0.userID == sessionB.userID }),
                  !unfilteredB.contains(where: { $0.id == rowA.id }) else { throw LiveSmokeFailure.crossAccountRead }
            let targetedForeignRead = try await clientB.readAll(FoodLogRow.self, filters: [.equal("id", uuid: rowA.id)])
            guard targetedForeignRead.isEmpty else { throw LiveSmokeFailure.crossAccountRead }
            let unfilteredA = try await clientA.readAll(FoodLogRow.self)
            guard unfilteredA.contains(where: { $0.id == rowA.id }),
                  unfilteredA.allSatisfy({ $0.userID == sessionA.userID }) else { throw LiveSmokeFailure.crossAccountRead }

            valueA.grams = 2
            valueB.grams = 3
            let changedA = try await clientA.update(id: rowA.id, ownerID: sessionA.userID, changes: valueA)
            let changedB = try await clientB.update(id: rowB.id, ownerID: sessionB.userID, changes: valueB)
            guard changedA.id == rowA.id, changedA.grams == 2,
                  changedB.id == rowB.id, changedB.grams == 3 else { throw LiveSmokeFailure.updateDidNotPersist }
            let updatedA = try await clientA.readAll(FoodLogRow.self, filters: [.equal("id", uuid: rowA.id)])
            let updatedB = try await clientB.readAll(FoodLogRow.self, filters: [.equal("id", uuid: rowB.id)])
            guard updatedA.count == 1, updatedA[0].grams == 2,
                  updatedB.count == 1, updatedB[0].grams == 3 else { throw LiveSmokeFailure.updateDidNotPersist }

            // Deliberately bypass the shared client's ownership preflight. Only a real
            // Postgres RLS denial proves the server rejects B writing user_id=A.
            let credentialsB = try await authB.credentials()
            var request = URLRequest(url: settings.configuration.url.appendingPathComponent("rest/v1/food_log"))
            request.httpMethod = "POST"
            request.setValue(settings.configuration.publishableKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer " + credentialsB.accessToken, forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("return=representation", forHTTPHeaderField: "Prefer")
            request.httpBody = try JSONEncoder().encode(LiveSmokeOperations.food(userID: sessionA.userID, day: day, name: forgedName))
            let forged = try await transport.send(request)
            if (200..<300).contains(forged.status) {
                struct InsertedIdentity: Decodable { let id: UUID }
                if let inserted = try? JSONDecoder().decode([InsertedIdentity].self, from: forged.body) {
                    createdA.formUnion(inserted.map(\.id))
                }
                // A marker query during cleanup also catches a committed row with an
                // unparseable response; every unexpected inserted ID is deleted as A.
            }
            guard forged.status == 403 else { throw LiveSmokeFailure.forgedOwnerWasNotDeniedByRLS }

            let removedA = try await clientA.delete(.foodLog, id: rowA.id, ownerID: sessionA.userID)
            let removedB = try await clientB.delete(.foodLog, id: rowB.id, ownerID: sessionB.userID)
            guard removedA == rowA.id, removedB == rowB.id else { throw LiveSmokeFailure.deleteDidNotPersist }
            let absentA = try await clientA.readAll(FoodLogRow.self, filters: [.equal("id", uuid: rowA.id)])
            let absentB = try await clientB.readAll(FoodLogRow.self, filters: [.equal("id", uuid: rowB.id)])
            guard absentA.isEmpty, absentB.isEmpty else { throw LiveSmokeFailure.deleteDidNotPersist }
        } catch {
            failure = error
        }

        // A detached awaited task allows cleanup to proceed even if the test's task
        // was cancelled after a POST. It operates only on this run's exact names/IDs.
        let cleanupA = LiveSmokeCleanupTarget(client: clientA, ownerID: settings.accountA.userID, ids: createdA)
        let cleanupB = LiveSmokeCleanupTarget(client: clientB, ownerID: settings.accountB.userID, ids: createdB)
        let writesStarted = dataWritesStarted
        let report = await Task.detached {
            // Failed/mismatched authentication never authorizes reading account data.
            let a = writesStarted ? await LiveSmokeOperations.cleanup(target: cleanupA, names: names) : true
            let b = writesStarted ? await LiveSmokeOperations.cleanup(target: cleanupB, names: names) : true
            let signedOutA = await LiveSmokeOperations.signOut(authA)
            let signedOutB = await LiveSmokeOperations.signOut(authB)
            return (a && b, signedOutA && signedOutB)
        }.value
        if !report.0 {
            XCTFail("QA cleanup could not verify all temporary rows were removed. Recovery marker: " + marker)
        }
        if !report.1 { XCTFail("QA session logout failed; in-memory credentials were cleared") }
        if let failure { throw failure }
    }
}

private enum LiveSmokeFailure: Error {
    case invalidConfiguration
    case unexpectedAccount
    case wrongReturnedRow
    case insertDidNotPersist
    case updateDidNotPersist
    case deleteDidNotPersist
    case crossAccountRead
    case forgedOwnerWasNotDeniedByRLS
}

private struct LiveSmokeAccount: Sendable {
    let email: String
    let password: String
    let userID: UUID
}

private struct LiveSmokeSettings: Sendable {
    let configuration: SupabaseConfiguration
    let accountA: LiveSmokeAccount
    let accountB: LiveSmokeAccount

    static func fromEnvironment() throws -> Self {
        let environment = ProcessInfo.processInfo.environment
        guard environment["WIFIT_RUN_LIVE_TESTS"] == "1" else {
            throw XCTSkip("Real JWT/RLS smoke is disabled; requires WIFIT_RUN_LIVE_TESTS=1 and two dedicated QA accounts")
        }
        let required = ["WIFIT_SUPABASE_URL", "WIFIT_SUPABASE_PUBLISHABLE_KEY",
                        "WIFIT_QA_A_EMAIL", "WIFIT_QA_A_PASSWORD", "WIFIT_QA_A_USER_ID",
                        "WIFIT_QA_B_EMAIL", "WIFIT_QA_B_PASSWORD", "WIFIT_QA_B_USER_ID"]
        let missing = required.filter { environment[$0]?.isEmpty != false }
        guard missing.isEmpty else { throw XCTSkip("Live smoke lacks explicit configuration keys: " + missing.joined(separator: ", ")) }
        guard let url = URL(string: environment["WIFIT_SUPABASE_URL"]!),
              let idA = UUID(uuidString: environment["WIFIT_QA_A_USER_ID"]!),
              let idB = UUID(uuidString: environment["WIFIT_QA_B_USER_ID"]!), idA != idB,
              environment["WIFIT_QA_A_EMAIL"]!.caseInsensitiveCompare(environment["WIFIT_QA_B_EMAIL"]!) != .orderedSame else {
            throw LiveSmokeFailure.invalidConfiguration
        }
        return Self(configuration: try SupabaseConfiguration(url: url, publishableKey: environment["WIFIT_SUPABASE_PUBLISHABLE_KEY"]!),
                    accountA: LiveSmokeAccount(email: environment["WIFIT_QA_A_EMAIL"]!, password: environment["WIFIT_QA_A_PASSWORD"]!, userID: idA),
                    accountB: LiveSmokeAccount(email: environment["WIFIT_QA_B_EMAIL"]!, password: environment["WIFIT_QA_B_PASSWORD"]!, userID: idB))
    }
}

private final class LiveSmokeMemoryStore: SessionStore, @unchecked Sendable {
    private let lock = NSLock()
    private var session: AuthSession?
    func load() throws(DataError) -> AuthSession? { lock.lock(); defer { lock.unlock() }; return session }
    func save(_ value: AuthSession) throws(DataError) { lock.lock(); defer { lock.unlock() }; session = value }
    func remove() throws(DataError) { lock.lock(); defer { lock.unlock() }; session = nil }
}

private struct LiveSmokeCleanupTarget: Sendable {
    let client: SupabaseREST
    let ownerID: UUID
    let ids: Set<UUID>
}

private enum LiveSmokeOperations {
    static func food(userID: UUID, day: LocalDay, name: String) -> FoodLogWrite {
        FoodLogWrite(userID: userID, loggedDate: day, mealSlot: "snacks", foodName: name,
                     brand: "FitDataKit automated QA — temporary", grams: 1,
                     per100Cal: 0, per100Protein: 0, per100Carbs: 0, per100Fat: 0,
                     per100Fiber: 0, per100Sugar: 0, per100Sodium: 0)
    }

    static func cleanup(target: LiveSmokeCleanupTarget, names: [String]) async -> Bool {
        // Includes marker discovery so a write whose HTTP reply was lost is still
        // cleaned. Never issue a broad delete; each mutation has UUID+owner filters.
        var ids = target.ids
        for _ in 0..<3 {
            var discoverySucceeded = true
            for name in names {
                do {
                    let rows = try await target.client.readAll(FoodLogRow.self, filters: [.equal("food_name", text: name)])
                    guard rows.allSatisfy({ $0.userID == target.ownerID }) else { discoverySucceeded = false; continue }
                    ids.formUnion(rows.map(\.id))
                } catch { discoverySucceeded = false }
            }
            for id in ids {
                do {
                    let rows = try await target.client.readAll(FoodLogRow.self, filters: [.equal("id", uuid: id)])
                    guard !rows.isEmpty else { continue }
                    guard rows.count == 1, rows[0].userID == target.ownerID, names.contains(rows[0].foodName) else {
                        discoverySucceeded = false; continue
                    }
                    _ = try await target.client.delete(.foodLog, id: id, ownerID: target.ownerID)
                } catch { discoverySucceeded = false }
            }
            var confirmedEmpty = discoverySucceeded
            for name in names {
                do {
                    let remaining = try await target.client.readAll(FoodLogRow.self, filters: [.equal("food_name", text: name)])
                    if !remaining.isEmpty { confirmedEmpty = false }
                } catch { confirmedEmpty = false }
            }
            if confirmedEmpty { return true }
        }
        return false
    }

    static func signOut(_ auth: Auth) async -> Bool {
        do { try await auth.signOut(); return true }
        catch {
            // Store is memory-only; explicitly clear it even if remote revocation failed.
            try? await auth.clearLocalSession()
            return false
        }
    }
}
