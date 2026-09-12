import Foundation
import Testing
@testable import FitDataKit

private let testUser = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!
private let testNow = Date(timeIntervalSince1970: 1_800_000_000)
private func configuration() throws -> SupabaseConfiguration {
    try SupabaseConfiguration(url: URL(string: "https://example.supabase.co")!, publishableKey: "public-test-key")
}
private func session(expired: Bool = false) -> AuthSession {
    AuthSession(userID: testUser, accessToken: "old-access", refreshToken: "old-refresh",
                expiresAt: testNow.addingTimeInterval(expired ? -1 : 3600))
}
private func freshResponse() -> HTTPResponse {
    HTTPResponse(status: 200, body: Data("{\"access_token\":\"new-access\",\"refresh_token\":\"new-refresh\",\"expires_in\":3600}".utf8))
}
private final class MemoryStore: SessionStore, @unchecked Sendable {
    private let lock = NSLock()
    private var value: AuthSession?
    private var saves = 0
    private var failSave = false
    private var failRemove = false
    func failWrites(_ value: Bool) { lock.lock(); defer { lock.unlock() }; failSave = value }
    func failDeletion(_ value: Bool) { lock.lock(); defer { lock.unlock() }; failRemove = value }
    init(_ value: AuthSession? = nil) { self.value = value }
    func load() throws(DataError) -> AuthSession? { lock.lock(); defer { lock.unlock() }; return value }
    func save(_ session: AuthSession) throws(DataError) { lock.lock(); defer { lock.unlock() }; if failSave { throw .storage(operation: "save", status: -1) }; value = session; saves += 1 }
    func remove() throws(DataError) { lock.lock(); defer { lock.unlock() }; if failRemove { throw .storage(operation: "delete", status: -1) }; value = nil }
    var saveCount: Int { lock.lock(); defer { lock.unlock() }; return saves }
}
private actor MockTransport: HTTPTransport {
    var requests: [URLRequest] = []
    let handler: @Sendable (URLRequest, Int) async throws(DataError) -> HTTPResponse
    init(_ handler: @escaping @Sendable (URLRequest, Int) async throws(DataError) -> HTTPResponse) { self.handler = handler }
    func send(_ request: URLRequest) async throws(DataError) -> HTTPResponse {
        let index = requests.count
        requests.append(request)
        return try await handler(request, index)
    }
}
private actor Signal {
    var fired = false
    var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if fired { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func fire() { fired = true; waiters.forEach { $0.resume() }; waiters = [] }
}
private struct TokenProvider: AccessTokenProvider {
    let credentialsValue = RequestCredentials(userID: testUser, accessToken: "access", generation: UUID())
    func credentials() async throws(DataError) -> RequestCredentials { credentialsValue }
    func refresh(after rejected: RequestCredentials) async throws(DataError) -> RequestCredentials { throw .authenticationRequired }
    func isCurrent(_ credentials: RequestCredentials) async -> Bool { credentials.generation == credentialsValue.generation }
}
private struct TestRow: Codable, Sendable, Equatable { let id: UUID }
private struct TestWrite: DatabaseWrite {
    let user_id: UUID = testUser
    let food_name = "Oats & apple"
    func validate() throws(DataError) {}
}

private struct TestProfileWrite: DatabaseWrite {
    let id: UUID = testUser
    func validate() throws(DataError) {}
}

private struct TestDailyWrite: DatabaseWrite {
    let user_id: UUID = testUser
    let log_date = "2026-09-09"
    func validate() throws(DataError) {}
}
private struct TestSupplementWrite: DatabaseWrite {
    let user_id: UUID = testUser
    let supplement_id: UUID
    let log_date = "2026-09-09"
    func validate() throws(DataError) {}
}
private struct UncheckedKeyWrite: DatabaseWrite {
    let fields: [String: String]
    func validate() throws(DataError) {}
    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(fields)
    }
}
private func mutationReply(id: UUID, owner: UUID? = testUser, day: String? = nil,
    supplement: UUID? = nil, status: Int = 201) -> HTTPResponse {
    struct Reply: Encodable { let id: UUID; let user_id: UUID?; let log_date: String?; let supplement_id: UUID? }
    let row = Reply(id: id, user_id: owner, log_date: day, supplement_id: supplement)
    return HTTPResponse(status: status, body: try! JSONEncoder().encode([row]))
}

struct TransportAuthTests {
    @Test func noSessionIsNotAnAnonymousRead() async throws {
        let transport = MockTransport { (_, _) throws(DataError) in Issue.record("A signed-out client must not issue data requests"); throw .network }
        let auth = Auth(configuration: try configuration(), store: MemoryStore(), transport: transport, now: { testNow })
        #expect(try await auth.resolveSession() == .loggedOut)
        let client = SupabaseREST(configuration: try configuration(), auth: auth, transport: transport)
        await #expect(throws: DataError.authenticationRequired) { try await client.readAll(.foodLog, as: TestRow.self) }
        #expect(await transport.requests.isEmpty)
    }

    @Test func emptySuccessHTTPFailureAndMalformedJSONStayDistinct() async throws {
        let responses = [HTTPResponse(status: 200, headers: ["content-range": "*/0"], body: Data("[]".utf8)),
                         HTTPResponse(status: 500), HTTPResponse(status: 200, body: Data("{}".utf8))]
        let transport = MockTransport { _, index in responses[index] }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        #expect(try await client.readAll(.foodLog, as: TestRow.self).isEmpty)
        await #expect(throws: DataError.http(status: 500, code: nil)) { try await client.readAll(.foodLog, as: TestRow.self) }
        await #expect(throws: DataError.decoding) { try await client.readAll(.foodLog, as: TestRow.self) }
    }

    @Test func concurrentExpiryRefreshesExactlyOnceAndPersistsRotatedToken() async throws {
        let started = Signal(), release = Signal()
        let transport = MockTransport { _, _ in await started.fire(); await release.wait(); return freshResponse() }
        let store = MemoryStore(session(expired: true))
        let auth = Auth(configuration: try configuration(), store: store, transport: transport, now: { testNow })
        let callers = Task {
            await withTaskGroup(of: String?.self) { group in
                for _ in 0..<20 { group.addTask { try? await auth.credentials().accessToken } }
                var results: [String?] = []
                for await value in group { results.append(value) }
                return results
            }
        }
        await started.wait()
        await release.fire()
        let results = await callers.value
        #expect(results.count == 20 && results.allSatisfy { $0 == "new-access" })
        #expect(await transport.requests.count == 1)
        #expect(store.saveCount == 1)
        #expect(try store.load()?.refreshToken == "new-refresh")
        #expect(try store.load()?.userID == testUser)
        #expect(try store.load()?.expiresAt == testNow.addingTimeInterval(3600))
    }

    @Test func delayed401UsesAlreadyRotatedTokenWithoutASecondRefresh() async throws {
        let transport = MockTransport { _, _ in freshResponse() }
        let auth = Auth(configuration: try configuration(), store: MemoryStore(session()), transport: transport, now: { testNow })
        let old = try await auth.credentials()
        #expect(try await auth.refresh(after: old).accessToken == "new-access")
        #expect(try await auth.refresh(after: old).accessToken == "new-access")
        #expect(await transport.requests.count == 1)
    }

    @Test func logoutPreventsAnInFlightRefreshFromResurrectingAccount() async throws {
        let started = Signal(), release = Signal()
        let transport = MockTransport { _, _ in await started.fire(); await release.wait(); return freshResponse() }
        let store = MemoryStore(session(expired: true))
        let auth = Auth(configuration: try configuration(), store: store, transport: transport, now: { testNow })
        let pending = Task { try await auth.resolveSession() }
        await started.wait()
        try await auth.clearLocalSession()
        await release.fire()
        await #expect(throws: DataError.sessionChanged) { try await pending.value }
        #expect(try store.load() == nil)
        #expect(try await auth.resolveSession() == .loggedOut)
    }

    @Test func transientRefreshFailureDoesNotDeleteSession() async throws {
        let store = MemoryStore(session(expired: true))
        let transport = MockTransport { _, _ in HTTPResponse(status: 503) }
        let auth = Auth(configuration: try configuration(), store: store, transport: transport, now: { testNow })
        await #expect(throws: DataError.http(status: 503, code: nil)) { try await auth.resolveSession() }
        #expect(try store.load() == session(expired: true))
    }

    @Test func rejectedRefreshClearsCredentials() async throws {
        let store = MemoryStore(session(expired: true))
        let transport = MockTransport { _, _ in HTTPResponse(status: 400) }
        let auth = Auth(configuration: try configuration(), store: store, transport: transport, now: { testNow })
        await #expect(throws: DataError.authenticationRequired) { try await auth.resolveSession() }
        #expect(try store.load() == nil)
    }

    @Test func postgrest401RetriesOnceBut403NeverRefreshes() async throws {
        let transport = MockTransport { request, _ in
            if request.url!.path.contains("auth/v1/token") { return freshResponse() }
            return HTTPResponse(status: request.url!.path.hasSuffix("profiles") ? 403 : 401)
        }
        let auth = Auth(configuration: try configuration(), store: MemoryStore(session()), transport: transport, now: { testNow })
        let client = SupabaseREST(configuration: try configuration(), auth: auth, transport: transport)
        await #expect(throws: DataError.http(status: 403, code: nil)) { try await client.readAll(.profiles, as: TestRow.self) }
        #expect(await transport.requests.count == 1)
        await #expect(throws: DataError.http(status: 401, code: nil)) { try await client.readAll(.foodLog, as: TestRow.self) }
        let requests = await transport.requests
        #expect(requests.count == 4)
        #expect(requests[1].value(forHTTPHeaderField: "Authorization") == "Bearer old-access")
        #expect(requests[3].value(forHTTPHeaderField: "Authorization") == "Bearer new-access")
    }

    @Test func unknownWriteOutcomeIsNotRetried() async throws {
        let transport = MockTransport { (_, _) throws(DataError) in throw .network }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        await #expect(throws: DataError.outcomeUnknown(operation: "POST")) {
            try await client.insert(.foodLog, value: TestWrite(), returning: TestRow.self)
        }
        #expect(await transport.requests.count == 1)
    }

    @Test func emptyMutationRepresentationCannotLookSaved() async throws {
        let transport = MockTransport { _, _ in HTTPResponse(status: 200, body: Data("[]".utf8)) }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        await #expect(throws: DataError.unexpectedRowCount(expected: 1, actual: 0)) {
            try await client.update(.foodLog, id: testUser, ownerID: testUser, changes: TestWrite(), returning: TestRow.self)
        }
        await #expect(throws: DataError.unexpectedRowCount(expected: 1, actual: 0)) {
            try await client.delete(.foodLog, id: testUser, ownerID: testUser)
        }
    }

    @Test func perTableConflictTargetsAndUUIDWriteback() async throws {
        let returnedID = UUID(), supplementID = UUID()
        let transport = MockTransport { request, _ in
            if request.url!.path.hasSuffix("profiles") { return mutationReply(id: testUser, owner: nil) }
            return mutationReply(id: returnedID, day: "2026-09-09", supplement: supplementID)
        }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        let profile: TestRow = try await client.upsert(.profiles, value: TestProfileWrite(), returning: TestRow.self)
        #expect(profile.id == testUser)
        for table in [DatabaseTable.waterLog, .bodyWeightLog] {
            let row: TestRow = try await client.upsert(table, value: TestDailyWrite(), returning: TestRow.self)
            #expect(row.id == returnedID)
        }
        let supplement: TestRow = try await client.upsert(.supplementLog, value: TestSupplementWrite(supplement_id: supplementID), returning: TestRow.self)
        #expect(supplement.id == returnedID)
        let queries = await transport.requests.map { URLComponents(url: $0.url!, resolvingAgainstBaseURL: false)!.queryItems! }
        #expect(queries.map { $0.first(where: { $0.name == "on_conflict" })?.value } ==
                ["id", "user_id,log_date", "user_id,log_date", "supplement_id,log_date"])
        await #expect(throws: DataError.invalidInput("Table has no upsert contract")) {
            try await client.upsert(.foodLog, value: TestWrite(), returning: TestRow.self)
        }
    }

    @Test func quotedFilterCannotInjectAnotherQueryParameter() async throws {
        let transport = MockTransport { _, _ in HTTPResponse(status: 200, headers: ["content-range": "*/0"], body: Data("[]".utf8)) }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        _ = try await client.readAll(.foodLog, as: TestRow.self, filters: [.equal("food_name", text: "Oats &user_id=eq.other,\"fruit\"")])
        let request = await transport.requests[0]
        let items = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!
        #expect(items.filter { $0.name == "food_name" }.count == 1)
        #expect(items.allSatisfy { $0.name != "user_id" })
    }

    @Test func pageCeilingCannotSilentlyTruncateHistory() async throws {
        let first = UUID(), second = UUID()
        let transport = MockTransport { _, index in
            let id = index == 0 ? first : second
            return HTTPResponse(status: 200, headers: ["content-range": String(index) + "-" + String(index) + "/2"],
                                body: Data(("[{\"id\":\"" + id.uuidString + "\"}]").utf8))
        }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        #expect(try await client.readAll(.foodLog, as: TestRow.self).map(\.id) == [first, second])
        #expect(await transport.requests.count == 2)
    }

    @Test func signOutIsLocalToThisAppEvenWhenServerFails() async throws {
        let transport = MockTransport { _, _ in HTTPResponse(status: 503) }
        let store = MemoryStore(session())
        let auth = Auth(configuration: try configuration(), store: store, transport: transport, now: { testNow })
        await #expect(throws: DataError.http(status: 503, code: nil)) { try await auth.signOut() }
        #expect(try store.load() == nil)
        #expect(await transport.requests[0].url!.query == "scope=local")
    }
}

extension TransportAuthTests {
    @Test func failedRefreshPersistenceBlocksAllCallersUntilDurable() async throws {
        let store = MemoryStore(session(expired: true))
        store.failWrites(true)
        let transport = MockTransport { _, _ in freshResponse() }
        let auth = Auth(configuration: try configuration(), store: store, transport: transport, now: { testNow })
        let errors = await withTaskGroup(of: Bool.self) { group in
            for _ in 0..<12 {
                group.addTask {
                    do throws(DataError) { _ = try await auth.credentials(); return false }
                    catch { return error == .storage(operation: "save", status: -1) }
                }
            }
            var results: [Bool] = []
            for await value in group { results.append(value) }
            return results
        }
        #expect(errors.count == 12 && errors.allSatisfy { $0 })
        #expect(try store.load()?.refreshToken == "old-refresh")
        #expect(await transport.requests.count == 1)
        store.failWrites(false)
        #expect(try await auth.credentials().accessToken == "new-access")
        #expect(try store.load()?.refreshToken == "new-refresh")
        #expect(await transport.requests.count == 1)
    }

    @Test func failedKeychainDeletionIsRetriedAndDoesNotPreventRemoteRevocation() async throws {
        let store = MemoryStore(session())
        store.failDeletion(true)
        let transport = MockTransport { _, _ in HTTPResponse(status: 204) }
        let auth = Auth(configuration: try configuration(), store: store, transport: transport, now: { testNow })
        await #expect(throws: DataError.storage(operation: "delete", status: -1)) { try await auth.signOut() }
        #expect(await transport.requests.count == 1)
        await #expect(throws: DataError.storage(operation: "delete", status: -1)) { try await auth.resolveSession() }
        #expect(try store.load() != nil)
        store.failDeletion(false)
        #expect(try await auth.resolveSession() == .loggedOut)
        #expect(try store.load() == nil)
    }

    @Test func wrongOffsetAndDuplicatePageAreNotCompleteHistory() async throws {
        let id = UUID()
        for wrongRange in [true, false] {
            let transport = MockTransport { _, index in
                let bound = wrongRange ? 0 : index
                return HTTPResponse(status: 200, headers: ["content-range": String(bound) + "-" + String(bound) + "/2"],
                                    body: Data(("[{\"id\":\"" + id.uuidString + "\"}]").utf8))
            }
            let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
            await #expect(throws: DataError.invalidResponse) { try await client.readAll(.foodLog, as: TestRow.self) }
        }
    }

    @Test func signoutAfterSendingWriteRetainsUncertainOutcome() async throws {
        let started = Signal(), release = Signal()
        let transport = MockTransport { _, _ in
            await started.fire(); await release.wait()
            return mutationReply(id: testUser)
        }
        let auth = Auth(configuration: try configuration(), store: MemoryStore(session()), transport: transport, now: { testNow })
        let client = SupabaseREST(configuration: try configuration(), auth: auth, transport: transport)
        let pending = Task { try await client.insert(.foodLog, value: TestWrite(), returning: TestRow.self) }
        await started.wait()
        try await auth.clearLocalSession()
        await release.fire()
        await #expect(throws: DataError.outcomeUnknown(operation: "POST")) { try await pending.value }
    }

    @Test func mismatchedReturnedIdentityCannotAcknowledgeUpdate() async throws {
        let transport = MockTransport { _, _ in
            mutationReply(id: UUID(), status: 200)
        }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        await #expect(throws: DataError.outcomeUnknown(operation: "update")) {
            try await client.update(.foodLog, id: testUser, ownerID: testUser, changes: TestWrite(), returning: TestRow.self)
        }
    }

    @Test func wrongAccountWriteIsBlockedBeforeSending() async throws {
        struct ForeignWrite: DatabaseWrite {
            let user_id = UUID()
            func validate() throws(DataError) {}
        }
        let transport = MockTransport { _, _ in HTTPResponse(status: 201) }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        await #expect(throws: DataError.sessionChanged) {
            try await client.insert(.foodLog, value: ForeignWrite(), returning: TestRow.self)
        }
        #expect(await transport.requests.isEmpty)
    }
}

extension TransportAuthTests {
    @Test func successfulInsertUpdateAndDeleteVerifyOwnerAndIdentity() async throws {
        let returnedID = UUID()
        let transport = MockTransport { _, _ in mutationReply(id: returnedID) }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        let inserted: TestRow = try await client.insert(.foodLog, value: TestWrite(), returning: TestRow.self)
        #expect(inserted.id == returnedID)
        let updated: TestRow = try await client.update(.foodLog, id: returnedID, ownerID: testUser, changes: TestWrite(), returning: TestRow.self)
        #expect(updated.id == returnedID)
        #expect(try await client.delete(.foodLog, id: returnedID, ownerID: testUser) == returnedID)
        #expect(await transport.requests.count == 3)
    }

    @Test func wrongOrMissingReturnedOwnerCannotAcknowledgeAnyMutation() async throws {
        let returnedID = UUID()
        for owner in [UUID?.some(UUID()), nil] {
            let transport = MockTransport { _, _ in mutationReply(id: returnedID, owner: owner, day: "2026-09-09") }
            let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
            await #expect(throws: DataError.outcomeUnknown(operation: "insert")) {
                try await client.insert(.foodLog, value: TestWrite(), returning: TestRow.self)
            }
            await #expect(throws: DataError.outcomeUnknown(operation: "upsert")) {
                try await client.upsert(.waterLog, value: TestDailyWrite(), returning: TestRow.self)
            }
            await #expect(throws: DataError.outcomeUnknown(operation: "update")) {
                try await client.update(.foodLog, id: returnedID, ownerID: testUser, changes: TestWrite(), returning: TestRow.self)
            }
            await #expect(throws: DataError.outcomeUnknown(operation: "delete")) {
                try await client.delete(.foodLog, id: returnedID, ownerID: testUser)
            }
            #expect(await transport.requests.count == 4)
        }
    }

    @Test func profileUpsertCannotAcknowledgeAnotherProfileUUID() async throws {
        let transport = MockTransport { _, _ in mutationReply(id: UUID(), owner: nil) }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        await #expect(throws: DataError.outcomeUnknown(operation: "upsert")) {
            try await client.upsert(.profiles, value: TestProfileWrite(), returning: TestRow.self)
        }
        #expect(await transport.requests.count == 1)
    }

    @Test func upsertsCannotAcknowledgeAnotherDayOrSupplement() async throws {
        let supplementID = UUID()
        for returnedDay in [String?.some("2026-09-10"), nil] {
            let transport = MockTransport { _, _ in mutationReply(id: UUID(), day: returnedDay, supplement: supplementID) }
            let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
            for table in [DatabaseTable.waterLog, .bodyWeightLog] {
                await #expect(throws: DataError.outcomeUnknown(operation: "upsert")) {
                    try await client.upsert(table, value: TestDailyWrite(), returning: TestRow.self)
                }
            }
            await #expect(throws: DataError.outcomeUnknown(operation: "upsert")) {
                try await client.upsert(.supplementLog, value: TestSupplementWrite(supplement_id: supplementID), returning: TestRow.self)
            }
            #expect(await transport.requests.count == 3)
        }
        for returnedSupplement in [UUID?.some(UUID()), nil] {
            let transport = MockTransport { _, _ in mutationReply(id: UUID(), day: "2026-09-09", supplement: returnedSupplement) }
            let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
            await #expect(throws: DataError.outcomeUnknown(operation: "upsert")) {
                try await client.upsert(.supplementLog, value: TestSupplementWrite(supplement_id: supplementID), returning: TestRow.self)
            }
            #expect(await transport.requests.count == 1)
        }
    }

    @Test func missingAndMalformedConflictKeysAreRejectedBeforeSending() async throws {
        let cases: [(DatabaseTable, [String: String], DataError)] = [
            (.profiles, [:], .invalidInput("profiles upsert requires id")),
            (.waterLog, ["user_id": testUser.uuidString], .invalidInput("Daily upsert requires user_id and log_date")),
            (.bodyWeightLog, ["log_date": "2026-09-09"], .invalidInput("Daily upsert requires user_id and log_date")),
            (.supplementLog, ["user_id": testUser.uuidString, "log_date": "2026-09-09"], .invalidInput("Supplement upsert requires user_id, supplement_id and log_date")),
            (.profiles, ["id": "local-profile"], .invalidInput("Mutation identity or conflict key has an invalid type")),
            (.waterLog, ["user_id": testUser.uuidString, "log_date": "2026-02-30"], .invalidInput("Mutation identity or conflict key has an invalid type")),
            (.supplementLog, ["user_id": testUser.uuidString, "log_date": "2026-09-09", "supplement_id": "local-supplement"], .invalidInput("Mutation identity or conflict key has an invalid type"))
        ]
        let transport = MockTransport { (_, _) throws(DataError) in
            Issue.record("Invalid conflict keys must not issue a request")
            throw .network
        }
        let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
        for (table, fields, expected) in cases {
            await #expect(throws: expected) {
                try await client.upsert(table, value: UncheckedKeyWrite(fields: fields), returning: TestRow.self)
            }
        }
        #expect(await transport.requests.isEmpty)
    }

    @Test func extremeContentRangeIsAnErrorInsteadOfIntegerOverflow() async throws {
        for range in ["0-9223372036854775807/1", "0-9223372036854775806/9223372036854775807"] {
            let transport = MockTransport { _, _ in
                HTTPResponse(status: 200, headers: ["content-range": range],
                             body: Data(("[{\"id\":\"" + UUID().uuidString + "\"}]").utf8))
            }
            let client = SupabaseREST(configuration: try configuration(), auth: TokenProvider(), transport: transport)
            await #expect(throws: DataError.invalidResponse) {
                try await client.readPage(.foodLog, as: TestRow.self)
            }
            #expect(await transport.requests.count == 1)
        }
    }
}
