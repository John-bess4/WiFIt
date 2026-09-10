import Foundation
import Testing
import FitDataKit
import WiFitAppCore

private let adapterUser = UUID(uuidString: "a0000000-0000-4000-8000-000000000003")!
private struct FixedSessionStore: SessionStore {
    func load() throws(DataError) -> AuthSession? {
        AuthSession(userID: adapterUser, accessToken: "fixture-access", refreshToken: "fixture-refresh", expiresAt: .distantFuture)
    }
    func save(_ session: AuthSession) throws(DataError) {}
    func remove() throws(DataError) {}
}
private actor RecordingTransport: HTTPTransport {
    var requests: [URLRequest] = []
    let status: Int
    init(status: Int = 200) { self.status = status }
    func send(_ request: URLRequest) async throws(DataError) -> HTTPResponse {
        requests.append(request)
        return HTTPResponse(status: status, headers: ["content-range": "*/0"], body: Data("[]".utf8))
    }
}
private func service(_ transport: RecordingTransport) throws -> LiveAppService {
    LiveAppService(configuration: try SupabaseConfiguration(url: URL(string: "https://example.supabase.co")!, publishableKey: "fixture-public"),
                   store: FixedSessionStore(), transport: transport)
}

struct LiveAppServiceTests {
    @Test func everyLiveReadUsesTheSessionOwnerAndExplicitLocalDayWhereRequired() async throws {
        let transport = RecordingTransport(), appService = try service(transport)
        let day = try LocalDay("2026-09-09")
        let context = LoadContext(userID: adapterUser, day: day, timeZoneIdentifier: "Pacific/Kiritimati")
        #expect(try await appService.loadProfile(userID: adapterUser) == nil)
        for resource in AppResource.allCases {
            #expect(try await appService.load(resource, context: context).resource == resource)
        }
        let requests = await transport.requests
        #expect(requests.count == 14)
        for request in requests {
            #expect(request.httpMethod == "GET")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-access")
            #expect(request.value(forHTTPHeaderField: "apikey") == "fixture-public")
            let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!
            let ownerColumn = request.url!.lastPathComponent == "profiles" ? "id" : "user_id"
            #expect(query.contains(URLQueryItem(name: ownerColumn, value: "eq." + adapterUser.uuidString.lowercased())))
            if let column = ["food_log": "logged_date", "water_log": "log_date", "supplement_log": "log_date"][request.url!.lastPathComponent] {
                #expect(query.contains(URLQueryItem(name: column, value: "gte.2026-09-09")))
                #expect(query.contains(URLQueryItem(name: column, value: "lte.2026-09-09")))
            }
        }
        #expect(!requests.contains { ["ai_coach_usage", "workouts"].contains($0.url!.lastPathComponent) })
    }

    @Test func liveAdapterDoesNotTurnServerFailureOrWrongRequestedOwnerIntoAbsence() async throws {
        let transport = RecordingTransport(status: 500), appService = try service(transport)
        await #expect(throws: DataError.http(status: 500, code: nil)) {
            try await appService.loadProfile(userID: adapterUser)
        }
        let foreignUser = UUID()
        await #expect(throws: DataError.sessionChanged) {
            try await appService.loadProfile(userID: foreignUser)
        }
        let context = LoadContext(userID: foreignUser, day: try LocalDay("2026-09-09"), timeZoneIdentifier: "UTC")
        await #expect(throws: DataError.sessionChanged) {
            try await appService.load(.waterLog, context: context)
        }
        #expect(await transport.requests.count == 1)
    }
}
