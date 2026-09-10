import Foundation
import OSLog

/// Only WiFit-owned relations. TrainerHQ's consented cross-user access uses its separate gateway.
public enum DatabaseTable: String, Sendable, CaseIterable {
    case profiles, foodLog = "food_log", customFoods = "custom_foods"
    case workoutSessions = "workout_sessions", workoutPlans = "workout_plans"
    case supplementStack = "supplement_stack", supplementLog = "supplement_log"
    case waterLog = "water_log", bodyWeightLog = "body_weight_log", aiCoachUsage = "ai_coach_usage"
    case exerciseBests = "exercise_bests", exercisePREvents = "exercise_pr_events"
    case dailySummary = "daily_summary", supplementDueFrom = "supplement_due_from", weightMonthly = "weight_monthly"

    public var conflictTarget: String? {
        switch self {
        case .profiles: "id"
        case .waterLog, .bodyWeightLog: "user_id,log_date"
        case .supplementLog: "supplement_id,log_date"
        default: nil
        }
    }
    var writable: Bool {
        switch self {
        case .profiles, .foodLog, .customFoods, .workoutSessions, .workoutPlans,
             .supplementStack, .supplementLog, .waterLog, .bodyWeightLog: true
        default: false
        }
    }
    var ownerColumn: String { self == .profiles ? "id" : "user_id" }
    var stableOrder: String {
        switch self {
        case .exerciseBests: "user_id.asc,name.asc"
        case .exercisePREvents: "user_id.asc,completed_date.asc,session_id.asc,name.asc"
        case .dailySummary: "user_id.asc,day.asc"
        case .supplementDueFrom: "user_id.asc,supplement_id.asc"
        case .weightMonthly: "user_id.asc,month.asc"
        default: "id.asc"
        }
    }
}

public struct DatabaseFilter: Sendable {
    let column: String
    let expression: String
    private init(column: String, expression: String) throws(DataError) {
        guard !column.isEmpty, column.utf8.allSatisfy({ (97...122).contains($0) || $0 == 95 || (48...57).contains($0) }) else {
            throw .invalidInput("Invalid filter column")
        }
        self.column = column; self.expression = expression
    }
    public static func equal(_ column: String, uuid: UUID) throws(DataError) -> Self {
        try Self(column: column, expression: "eq." + uuid.uuidString.lowercased())
    }
    public static func equal(_ column: String, text: String) throws(DataError) -> Self {
        let escaped = text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
        return try Self(column: column, expression: "eq.\"" + escaped + "\"")
    }
    public static func day(_ column: String, from: LocalDay) throws(DataError) -> Self {
        try Self(column: column, expression: "gte." + from.rawValue)
    }
    public static func day(_ column: String, through: LocalDay) throws(DataError) -> Self {
        try Self(column: column, expression: "lte." + through.rawValue)
    }
}

public struct ReadPage<Row: Sendable>: Sendable {
    public let rows: [Row]
    public let total: Int
    let identities: [String]
}

/// Thin typed PostgREST client. Every write requests returned rows; unknown outcomes never replay automatically.
public struct SupabaseREST: Sendable {
    private struct Identity: Decodable { let id: UUID }
    /// Only UUID/date keys: validating acknowledgements must not round numeric row values.
    private struct MutationKeys: Decodable {
        let id: UUID?
        let userID: UUID?
        let logDate: LocalDay?
        let supplementID: UUID?
        enum CodingKeys: String, CodingKey {
            case id
            case userID = "user_id"
            case logDate = "log_date"
            case supplementID = "supplement_id"
        }
    }
    private let configuration: SupabaseConfiguration
    private let auth: any AccessTokenProvider
    private let transport: any HTTPTransport
    private let logger = Logger(subsystem: "FitDataKit", category: "database")
    public init(configuration: SupabaseConfiguration, auth: any AccessTokenProvider,
                transport: any HTTPTransport = URLSessionTransport()) {
        self.configuration = configuration; self.auth = auth; self.transport = transport
    }

    /// Bounded reads expose the total count so a page can never pose as complete history.
    public func readPage<Row: Decodable & Sendable>(_ table: DatabaseTable, as: Row.Type = Row.self,
        filters: [DatabaseFilter] = [], offset: Int = 0, limit: Int = 500,
        order: String? = nil) async throws(DataError) -> ReadPage<Row> {
        guard offset >= 0, (1...1000).contains(limit) else { throw .invalidInput("Invalid page bounds") }
        let order = order ?? table.stableOrder
        guard !order.isEmpty, order.utf8.allSatisfy({ (97...122).contains($0) || (48...57).contains($0) || [95, 46, 44].contains($0) }) else {
            throw .invalidInput("Invalid sort expression")
        }
        let query = filters.map { URLQueryItem(name: $0.column, value: $0.expression) } + [
            URLQueryItem(name: "select", value: "*"), URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset)), URLQueryItem(name: "order", value: order)]
        let response = try await request(table, method: "GET", query: query, prefer: "count=exact")
        let rows: [Row] = try decode(response.body)
        guard let range = response.headers.first(where: { $0.key.lowercased() == "content-range" })?.value,
              range.split(separator: "/").count == 2,
              let countText = range.split(separator: "/").last, let total = Int(countText), total >= 0,
              rows.count <= limit, rows.count <= max(0, total - offset) else { throw .invalidResponse }
        let bounds = String(range.split(separator: "/")[0])
        if rows.isEmpty {
            guard bounds == "*", offset >= total else { throw .invalidResponse }
        } else {
            let parts = bounds.split(separator: "-")
            guard parts.count == 2, let start = Int(parts[0]), let end = Int(parts[1]),
                  start == offset, end >= start, end < total,
                  end - start + 1 == rows.count else { throw .invalidResponse }
        }
        let keys = try rowIdentities(response.body, table: table)
        guard Set(keys).count == keys.count else { throw .invalidResponse }
        return ReadPage(rows: rows, total: total, identities: keys)
    }

    public func readAll<Row: Decodable & Sendable>(_ table: DatabaseTable, as: Row.Type = Row.self,
        filters: [DatabaseFilter] = []) async throws(DataError) -> [Row] {
        let credentials = try await auth.credentials()
        var rows: [Row] = []
        var total: Int?
        var seen = Set<String>()
        repeat {
            guard await auth.isCurrent(credentials) else { throw .sessionChanged }
            let page: ReadPage<Row> = try await readPage(table, filters: filters, offset: rows.count)
            guard await auth.isCurrent(credentials) else { throw .sessionChanged }
            if let total, page.total != total { throw .invalidResponse }
            total = page.total
            for identity in page.identities {
                guard seen.insert(identity).inserted else { throw .invalidResponse }
            }
            if page.rows.isEmpty && rows.count < page.total { throw .invalidResponse }
            rows.append(contentsOf: page.rows)
        } while rows.count < (total ?? 0)
        return rows
    }

    public func insert<Write: DatabaseWrite, Row: Decodable & Sendable>(_ table: DatabaseTable,
        value: Write, returning: Row.Type) async throws(DataError) -> Row {
        guard table.writable, table.conflictTarget == nil else { throw .invalidInput("Use the table's upsert contract") }
        try value.validate()
        let body = try encode(value)
        let keys = try submittedKeys(body, table: table, upsert: false)
        guard let owner = keys.userID else { throw .invalidInput("Insert requires user_id") }
        let response = try await request(table, method: "POST", body: body,
            prefer: "return=representation", expectedOwner: owner)
        return try writtenRow(response, table: table, operation: "insert", expectedOwner: owner)
    }

    public func upsert<Write: DatabaseWrite, Row: Decodable & Sendable>(_ table: DatabaseTable,
        value: Write, returning: Row.Type) async throws(DataError) -> Row {
        guard table.writable, let target = table.conflictTarget else { throw .invalidInput("Table has no upsert contract") }
        try value.validate()
        let body = try encode(value)
        let keys = try submittedKeys(body, table: table, upsert: true)
        guard let owner = table == .profiles ? keys.id : keys.userID else { throw .invalidInput("Upsert requires its owner key") }
        let response = try await request(table, method: "POST", query: [URLQueryItem(name: "on_conflict", value: target)],
            body: body, prefer: "resolution=merge-duplicates,return=representation", expectedOwner: owner)
        return try writtenRow(response, table: table, operation: "upsert", expectedOwner: owner, expectedConflict: keys)
    }

    /// Onboarding must not overwrite a profile concurrently created by another app/device.
    /// A conflicting existing row is left untouched; zero returned rows requires a fresh read.
    public func createProfileIfMissing(_ value: ProfileWrite) async throws(DataError) -> ProfileRow {
        try value.validate()
        let body = try encode(value)
        let keys = try submittedKeys(body, table: .profiles, upsert: true)
        let response = try await request(.profiles, method: "POST",
            query: [URLQueryItem(name: "on_conflict", value: "id")], body: body,
            prefer: "resolution=ignore-duplicates,return=representation", expectedOwner: value.id)
        return try writtenRow(response, table: .profiles, operation: "profile create",
                              expectedOwner: value.id, expectedConflict: keys)
    }

    /// UUID is required before a mutation is representable. Identity/owner filters are built here, never UI strings.
    public func update<Patch: DatabaseWrite, Row: Decodable & Sendable>(_ table: DatabaseTable,
        id: UUID, ownerID: UUID, changes: Patch, returning: Row.Type) async throws(DataError) -> Row {
        try changes.validate()
        let query = try mutationQuery(table, id: id, ownerID: ownerID)
        let response = try await request(table, method: "PATCH", query: query, body: encode(changes),
            prefer: "return=representation", expectedOwner: ownerID)
        return try writtenRow(response, table: table, operation: "update", expectedOwner: ownerID, expectedID: id)
    }

    public func delete(_ table: DatabaseTable, id: UUID, ownerID: UUID) async throws(DataError) -> UUID {
        let response = try await request(table, method: "DELETE", query: mutationQuery(table, id: id, ownerID: ownerID),
            prefer: "return=representation", expectedOwner: ownerID)
        let row: Identity = try writtenRow(response, table: table, operation: "delete", expectedOwner: ownerID, expectedID: id)
        return row.id
    }

    private func mutationQuery(_ table: DatabaseTable, id: UUID, ownerID: UUID) throws(DataError) -> [URLQueryItem] {
        guard table.writable else { throw .invalidInput("Relation is read-only") }
        if table == .profiles, id != ownerID { throw .invalidInput("Profile identity must match owner") }
        var query = [URLQueryItem(name: "id", value: "eq." + id.uuidString.lowercased())]
        if table != .profiles { query.append(URLQueryItem(name: "user_id", value: "eq." + ownerID.uuidString.lowercased())) }
        return query
    }

    private func request(_ table: DatabaseTable, method: String, query: [URLQueryItem] = [], body: Data? = nil,
        prefer: String, expectedOwner: UUID? = nil) async throws(DataError) -> HTTPResponse {
        let credentials = try await auth.credentials()
        if let expectedOwner, expectedOwner != credentials.userID { throw .sessionChanged }
        if let body { try validateOwner(body, table: table, method: method, userID: credentials.userID) }
        var components = URLComponents(url: configuration.url.appendingPathComponent("rest/v1/" + table.rawValue), resolvingAgainstBaseURL: false)!
        components.queryItems = query
        var request = URLRequest(url: components.url!)
        request.httpMethod = method; request.httpBody = body
        request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer " + credentials.accessToken, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(prefer, forHTTPHeaderField: "Prefer")
        do throws(DataError) {
            var response = try await send(request, isWrite: method != "GET")
            guard await auth.isCurrent(credentials) else {
                throw method == "GET" ? DataError.sessionChanged : .outcomeUnknown(operation: method)
            }
            if response.status == 401 {
                let fresh = try await auth.refresh(after: credentials)
                guard fresh.generation == credentials.generation, fresh.userID == credentials.userID else { throw DataError.sessionChanged }
                request.setValue("Bearer " + fresh.accessToken, forHTTPHeaderField: "Authorization")
                response = try await send(request, isWrite: method != "GET")
                guard await auth.isCurrent(credentials) else {
                    throw method == "GET" ? DataError.sessionChanged : .outcomeUnknown(operation: method)
                }
            }
            if method != "GET", response.status >= 500 { throw DataError.outcomeUnknown(operation: method) }
            guard (200..<300).contains(response.status) else { throw statusError(response) }
            return response
        } catch {
            let status: Int
            if case .http(let code, _) = error { status = code } else { status = 0 }
            logger.error("[sb.\(method, privacy: .public)] \(table.rawValue, privacy: .public) \(status)")
            throw error
        }
    }

    private func send(_ request: URLRequest, isWrite: Bool) async throws(DataError) -> HTTPResponse {
        // Cancellation BEFORE issuing a write is definite; cancellation AFTER issuing it is uncertain.
        guard !Task.isCancelled else { throw .cancelled }
        do { return try await transport.send(request) }
        catch {
            if isWrite { throw .outcomeUnknown(operation: request.httpMethod ?? "write") }
            throw error
        }
    }
    private func encode<T: Encodable>(_ value: T) throws(DataError) -> Data {
        do { return try JSONEncoder().encode(value) } catch { throw .encoding }
    }
    private func decode<T: Decodable>(_ data: Data) throws(DataError) -> T {
        do { return try JSONDecoder().decode(T.self, from: data) } catch { throw .decoding }
    }
    private func submittedKeys(_ body: Data, table: DatabaseTable, upsert: Bool) throws(DataError) -> MutationKeys {
        let keys: MutationKeys
        do { keys = try JSONDecoder().decode(MutationKeys.self, from: body) }
        catch { throw .invalidInput("Mutation identity or conflict key has an invalid type") }
        guard upsert else { return keys }
        switch table {
        case .profiles:
            guard keys.id != nil else { throw .invalidInput("profiles upsert requires id") }
        case .waterLog, .bodyWeightLog:
            guard keys.userID != nil, keys.logDate != nil else {
                throw .invalidInput("Daily upsert requires user_id and log_date")
            }
        case .supplementLog:
            guard keys.userID != nil, keys.supplementID != nil, keys.logDate != nil else {
                throw .invalidInput("Supplement upsert requires user_id, supplement_id and log_date")
            }
        default: throw .invalidInput("Table has no upsert contract")
        }
        return keys
    }

    private func writtenRow<T: Decodable>(_ response: HTTPResponse, table: DatabaseTable, operation: String,
        expectedOwner: UUID, expectedID: UUID? = nil, expectedConflict: MutationKeys? = nil) throws(DataError) -> T {
        let rows: [T]
        do { rows = try decode(response.body) } catch { throw .outcomeUnknown(operation: operation) }
        guard rows.count == 1 else { throw .unexpectedRowCount(expected: 1, actual: rows.count) }
        let keys: [MutationKeys]
        do { keys = try decode(response.body) } catch { throw .outcomeUnknown(operation: operation) }
        guard let returned = keys.first, let returnedID = returned.id,
              (table == .profiles ? returned.id : returned.userID) == expectedOwner else {
            throw .outcomeUnknown(operation: operation)
        }
        if let expectedID, returnedID != expectedID { throw .outcomeUnknown(operation: operation) }
        if let expectedConflict {
            let matches: Bool
            switch table {
            case .profiles: matches = returned.id == expectedConflict.id
            case .waterLog, .bodyWeightLog:
                matches = returned.userID == expectedConflict.userID && returned.logDate == expectedConflict.logDate
            case .supplementLog:
                matches = returned.supplementID == expectedConflict.supplementID && returned.logDate == expectedConflict.logDate
            default: matches = false
            }
            guard matches else { throw .outcomeUnknown(operation: operation) }
        }
        return rows[0]
    }

    private func validateOwner(_ body: Data, table: DatabaseTable, method: String, userID: UUID) throws(DataError) {
        struct Owner: Decodable { let id: UUID?; let user_id: UUID? }
        let value: Owner = try decode(body)
        let owner = table == .profiles ? value.id : value.user_id
        if method == "POST" {
            guard owner == userID else { throw .sessionChanged }
            if table != .profiles, value.id != nil { throw .invalidInput("Server assigns inserted row IDs") }
        } else if let owner, owner != userID { throw .sessionChanged }
        if method == "PATCH", table != .profiles, value.id != nil {
            throw .invalidInput("A row's identity cannot be changed")
        }
    }

    private func rowIdentities(_ body: Data, table: DatabaseTable) throws(DataError) -> [String] {
        do {
            guard let objects = try JSONSerialization.jsonObject(with: body) as? [[String: Any]] else { throw DataError.decoding }
            let columns = table.stableOrder.split(separator: ",").map { String($0.split(separator: ".")[0]) }
            return try objects.map { row in
                let fields = try columns.map { column in
                    guard let value = row[column] as? String else { throw DataError.decoding }
                    return value
                }
                return String(decoding: try JSONEncoder().encode(fields), as: UTF8.self)
            }
        } catch let error as DataError { throw error }
        catch { throw .decoding }
    }
}
