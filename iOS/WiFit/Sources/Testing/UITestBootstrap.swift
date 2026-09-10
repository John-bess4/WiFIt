#if DEBUG
import Foundation
import FitDataKit
import WiFitAppCore

/// Only an explicit UI-test launch can select this service. Its transport has
/// no URLSession or network fallback, including for unexpected requests.
@MainActor
enum UITestBootstrap {
    static func serviceIfRequested() -> LiveAppService? {
        guard ProcessInfo.processInfo.arguments.contains("--uitesting") else { return nil }
        let environment = ProcessInfo.processInfo.environment
        let configuration = try! SupabaseConfiguration(
            url: URL(string: "https://wifit-ui-tests.invalid")!,
            publishableKey: "sb_publishable_wifit_ui_tests_only")
        let transport = UITestTransport(scenario: environment["WIFIT_UI_SCENARIO"] ?? "invalid")

        // An incomplete test launch must fail closed rather than falling back to
        // the live service or touching its Keychain namespace.
        guard let rawSession = environment["WIFIT_UI_SESSION"],
              let sessionID = UUID(uuidString: rawSession),
              UITestScenario(rawValue: environment["WIFIT_UI_SCENARIO"] ?? "") != nil else {
            return failedService(configuration: configuration, transport: transport,
                                 error: .invalidInput("UI test launch requires a scenario and session UUID."))
        }
        let store = KeychainSessionStore(service: "com.wifit.gen2.ui-tests." + sessionID.uuidString.lowercased())
        do {
            if environment["WIFIT_UI_RESET"] == "1" {
                try store.remove()
                if environment["WIFIT_UI_SCENARIO"] != UITestScenario.signedOut.rawValue {
                    try store.save(UITestIdentity.a.session)
                }
            }
        } catch {
            return failedService(configuration: configuration, transport: transport, error: error)
        }
        return LiveAppService(configuration: configuration, store: store, transport: transport)
    }

    private static func failedService(configuration: SupabaseConfiguration, transport: UITestTransport,
                                      error: DataError) -> LiveAppService {
        LiveAppService(configuration: configuration, store: UITestFailureStore(error: error), transport: transport)
    }
}

private enum UITestScenario: String, Sendable {
    case signedOut, profileFailure, partialProfile, resourceFailure, ready
}

private enum UITestIdentity: String, Sendable, CaseIterable {
    case a, b
    var userID: UUID {
        switch self {
        case .a: UUID(uuidString: "11111111-1111-4111-8111-111111111111")!
        case .b: UUID(uuidString: "22222222-2222-4222-8222-222222222222")!
        }
    }
    var accessToken: String { "synthetic-ui-access-" + rawValue }
    var refreshToken: String { "synthetic-ui-refresh-" + rawValue }
    var email: String { "qa-" + rawValue + "@example.invalid" }
    var displayName: String { "UI Test " + rawValue.uppercased() }
    var session: AuthSession {
        AuthSession(userID: userID, accessToken: accessToken, refreshToken: refreshToken,
                    expiresAt: Date().addingTimeInterval(3_600))
    }
    func profile(partial: Bool) -> ProfileRow {
        ProfileRow(id: userID, name: displayName, age: partial ? nil : 32,
                   weightLbs: 165, heightIn: partial ? nil : 68,
                   activityLevel: "moderate", goal: "maintain", calGoal: 2_200,
                   proteinGoal: 140, carbsGoal: 180, fatGoal: 78, theme: "pastel_light",
                   createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z",
                   gender: "male", bmr: 1_660, tdee: 2_573, goalRate: "maintain")
    }
}

private struct UITestFailureStore: SessionStore {
    let error: DataError
    func load() throws(DataError) -> AuthSession? { throw error }
    func save(_ session: AuthSession) throws(DataError) { throw error }
    func remove() throws(DataError) { throw error }
}

private actor UITestTransport: HTTPTransport {
    private let scenario: UITestScenario?
    private var profiles: [UUID: ProfileRow]

    init(scenario: String) {
        self.scenario = UITestScenario(rawValue: scenario)
        self.profiles = Dictionary(uniqueKeysWithValues: UITestIdentity.allCases.map {
            ($0.userID, $0.profile(partial: scenario == UITestScenario.partialProfile.rawValue))
        })
    }

    func send(_ request: URLRequest) async throws(DataError) -> HTTPResponse {
        guard let scenario, let url = request.url,
              url.scheme == "https", url.host == "wifit-ui-tests.invalid",
              request.value(forHTTPHeaderField: "apikey") == "sb_publishable_wifit_ui_tests_only",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw .invalidInput("UI fixture rejected an unexpected request.")
        }
        let query = components.queryItems ?? []
        if url.path == "/auth/v1/token", request.httpMethod == "POST" {
            let credentials: [String: String] = try decode(request.httpBody ?? Data())
            let identity: UITestIdentity?
            switch query.first(where: { $0.name == "grant_type" })?.value {
            case "password":
                identity = UITestIdentity.allCases.first { $0.email == credentials["email"]?.lowercased() }
            case "refresh_token":
                identity = UITestIdentity.allCases.first { $0.refreshToken == credentials["refresh_token"] }
            default:
                identity = nil
            }
            guard let identity else { return errorResponse(400, code: "invalid_credentials") }
            return try response(AuthResponse(identity: identity))
        }
        guard let identity = UITestIdentity.allCases.first(where: {
            request.value(forHTTPHeaderField: "Authorization") == "Bearer " + $0.accessToken
        }) else { return errorResponse(401, code: "invalid_token") }
        if url.path == "/auth/v1/logout", request.httpMethod == "POST",
           query.first(where: { $0.name == "scope" })?.value == "local" {
            return HTTPResponse(status: 204)
        }

        guard url.path.hasPrefix("/rest/v1/"),
              let table = DatabaseTable(rawValue: url.lastPathComponent) else {
            throw .invalidInput("UI fixture rejected an unexpected route.")
        }
        let ownerColumn = table == .profiles ? "id" : "user_id"
        guard query.contains(where: {
            $0.name == ownerColumn && $0.value?.lowercased() == "eq." + identity.userID.uuidString.lowercased()
        }) else { return errorResponse(403, code: "owner_filter_required") }

        if table == .profiles {
            if scenario == .profileFailure { return errorResponse(500, code: "synthetic_profile_failure") }
            guard var profile = profiles[identity.userID] else { return try response([ProfileRow](), range: "*/0") }
            if request.httpMethod == "PATCH" {
                let patch: ProfilePatch = try decode(request.httpBody ?? Data())
                patch.apply(to: &profile)
                profiles[identity.userID] = profile
                return try response([profile])
            }
            guard request.httpMethod == "GET" else {
                // These scenarios all have an existing profile. A POST is a bug.
                return errorResponse(409, code: "profile_already_exists")
            }
            return try response([profile], range: "0-0/1")
        }
        guard request.httpMethod == "GET" else { return errorResponse(405, code: "synthetic_read_only_resource") }
        if scenario == .resourceFailure, table == .foodLog {
            return errorResponse(500, code: "synthetic_food_failure")
        }
        return HTTPResponse(status: 200, headers: ["content-type": "application/json", "content-range": "*/0"], body: Data("[]".utf8))
    }

    private struct AuthResponse: Encodable {
        let access_token: String
        let refresh_token: String
        let expires_in = 3_600
        let token_type = "bearer"
        let user: User
        struct User: Encodable { let id: UUID }
        init(identity: UITestIdentity) {
            access_token = identity.accessToken
            refresh_token = identity.refreshToken
            user = User(id: identity.userID)
        }
    }

    private struct ProfilePatch: Decodable {
        var name: String?
        var age: Int?
        var weight_lbs: Decimal?
        var height_in: Decimal?
        var gender: String?
        var activity_level: String?
        var goal_rate: String?
        var cal_goal: Int?
        var protein_goal: Int?
        var carbs_goal: Int?
        var fat_goal: Int?
        var bmr: Decimal?
        var tdee: Decimal?
        func apply(to profile: inout ProfileRow) {
            if let name { profile.name = name }
            if let age { profile.age = age }
            if let weight_lbs { profile.weightLbs = weight_lbs }
            if let height_in { profile.heightIn = height_in }
            if let gender { profile.gender = gender }
            if let activity_level { profile.activityLevel = activity_level }
            if let goal_rate { profile.goalRate = goal_rate }
            if let cal_goal { profile.calGoal = cal_goal }
            if let protein_goal { profile.proteinGoal = protein_goal }
            if let carbs_goal { profile.carbsGoal = carbs_goal }
            if let fat_goal { profile.fatGoal = fat_goal }
            if let bmr { profile.bmr = bmr }
            if let tdee { profile.tdee = tdee }
        }
    }

    private func response<T: Encodable>(_ value: T, range: String? = nil) throws(DataError) -> HTTPResponse {
        var headers = ["content-type": "application/json"]
        if let range { headers["content-range"] = range }
        do { return HTTPResponse(status: 200, headers: headers, body: try JSONEncoder().encode(value)) }
        catch { throw .encoding }
    }
    private func decode<T: Decodable>(_ data: Data) throws(DataError) -> T {
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw .decoding }
    }
    private func errorResponse(_ status: Int, code: String) -> HTTPResponse {
        HTTPResponse(status: status, headers: ["content-type": "application/json"],
                     body: Data(("{\"code\":\"" + code + "\"}").utf8))
    }
}
#endif
