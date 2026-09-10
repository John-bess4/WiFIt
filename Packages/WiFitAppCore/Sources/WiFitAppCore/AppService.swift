import Foundation
import FitDataKit

public protocol AppService: Sendable {
    func resolveSession() async throws(DataError) -> UUID?
    func signIn(email: String, password: String) async throws(DataError) -> UUID
    func signOut() async throws(DataError)
    func loadProfile(userID: UUID) async throws(DataError) -> ProfileRow?
    func saveProfile(userID: UUID, patch: ProfileCompletionPatch) async throws(DataError) -> ProfileRow
    func createProfile(value: ProfileWrite) async throws(DataError) -> ProfileRow
    func load(_ resource: AppResource, context: LoadContext) async throws(DataError) -> ResourcePayload
}

/// One session engine and one transport contract. Both use the same app-specific Keychain identity.
public struct LiveAppService: AppService {
    private let auth: Auth
    private let database: SupabaseREST
    public init(configuration: SupabaseConfiguration, keychainService: String,
                transport: any HTTPTransport = URLSessionTransport()) {
        self.init(configuration: configuration, store: KeychainSessionStore(service: keychainService), transport: transport)
    }
    public init(configuration: SupabaseConfiguration, store: any SessionStore,
                transport: any HTTPTransport = URLSessionTransport()) {
        let auth = Auth(configuration: configuration, store: store, transport: transport)
        self.auth = auth
        self.database = SupabaseREST(configuration: configuration, auth: auth, transport: transport)
    }
    public func resolveSession() async throws(DataError) -> UUID? {
        switch try await auth.resolveSession() {
        case .loggedOut: nil
        case .valid(let session), .refreshed(let session): session.userID
        }
    }
    public func signIn(email: String, password: String) async throws(DataError) -> UUID {
        try await auth.signIn(email: email, password: password).userID
    }
    public func signOut() async throws(DataError) { try await auth.signOut() }
    public func loadProfile(userID: UUID) async throws(DataError) -> ProfileRow? {
        guard try await auth.credentials().userID == userID else { throw .sessionChanged }
        let rows = try await database.readAll(ProfileRow.self, filters: [.equal("id", uuid: userID)])
        guard rows.count <= 1, rows.allSatisfy({ $0.id == userID }) else { throw .invalidResponse }
        return rows.first
    }
    public func saveProfile(userID: UUID, patch: ProfileCompletionPatch) async throws(DataError) -> ProfileRow {
        try await database.update(.profiles, id: userID, ownerID: userID, changes: patch, returning: ProfileRow.self)
    }
    public func createProfile(value: ProfileWrite) async throws(DataError) -> ProfileRow {
        // Only the coordinator's confirmed-missing path calls this complete-value operation.
        try await database.createProfileIfMissing(value)
    }
    public func load(_ resource: AppResource, context: LoadContext) async throws(DataError) -> ResourcePayload {
        guard try await auth.credentials().userID == context.userID else { throw .sessionChanged }
        let owner = try DatabaseFilter.equal("user_id", uuid: context.userID)
        func day(_ column: String) throws(DataError) -> [DatabaseFilter] {
            try [owner, .day(column, from: context.day), .day(column, through: context.day)]
        }
        switch resource {
        case .foodLog: return .foodLog(try await database.readAll(FoodLogRow.self, filters: day("logged_date")))
        case .customFoods: return .customFoods(try await database.readAll(CustomFoodRow.self, filters: [owner]))
        case .workoutSessions: return .workoutSessions(try await database.readAll(WorkoutSessionRow.self, filters: [owner]))
        case .workoutPlans: return .workoutPlans(try await database.readAll(WorkoutPlanRow.self, filters: [owner]))
        case .supplementStack: return .supplementStack(try await database.readAll(SupplementStackRow.self, filters: [owner]))
        case .supplementLog: return .supplementLog(try await database.readAll(SupplementLogRow.self, filters: day("log_date")))
        case .waterLog: return .waterLog(try await database.readAll(WaterLogRow.self, filters: day("log_date")))
        case .bodyWeightLog: return .bodyWeightLog(try await database.readAll(BodyWeightLogRow.self, filters: [owner]))
        case .exerciseBests: return .exerciseBests(try await database.readAll(ExerciseBestRow.self, filters: [owner]))
        case .exercisePREvents: return .exercisePREvents(try await database.readAll(ExercisePREventRow.self, filters: [owner]))
        case .dailySummary: return .dailySummary(try await database.readAll(DailySummaryRow.self, filters: [owner]))
        case .supplementDueFrom: return .supplementDueFrom(try await database.readAll(SupplementDueFromRow.self, filters: [owner]))
        case .weightMonthly: return .weightMonthly(try await database.readAll(WeightMonthlyRow.self, filters: [owner]))
        }
    }
}
