import Foundation

/// A wire row carries its relation so the default call site cannot accidentally
/// decode one sister app's table with another table's model.
public protocol DatabaseRecord: Decodable, Sendable {
    static var table: DatabaseTable { get }
}

/// A complete writable value is coupled to its returned row and table.
/// This intentionally excludes views, usage records, and legacy workouts.
public protocol DatabaseValue: DatabaseWrite {
    associatedtype Row: DatabaseRecord
}

extension ProfileRow: DatabaseRecord { public static var table: DatabaseTable { .profiles } }
extension FoodLogRow: DatabaseRecord { public static var table: DatabaseTable { .foodLog } }
extension CustomFoodRow: DatabaseRecord { public static var table: DatabaseTable { .customFoods } }
extension WorkoutSessionRow: DatabaseRecord { public static var table: DatabaseTable { .workoutSessions } }
extension WorkoutPlanRow: DatabaseRecord { public static var table: DatabaseTable { .workoutPlans } }
extension SupplementStackRow: DatabaseRecord { public static var table: DatabaseTable { .supplementStack } }
extension SupplementLogRow: DatabaseRecord { public static var table: DatabaseTable { .supplementLog } }
extension WaterLogRow: DatabaseRecord { public static var table: DatabaseTable { .waterLog } }
extension BodyWeightLogRow: DatabaseRecord { public static var table: DatabaseTable { .bodyWeightLog } }
extension AICoachUsageRow: DatabaseRecord { public static var table: DatabaseTable { .aiCoachUsage } }
extension ExerciseBestRow: DatabaseRecord { public static var table: DatabaseTable { .exerciseBests } }
extension ExercisePREventRow: DatabaseRecord { public static var table: DatabaseTable { .exercisePREvents } }
extension DailySummaryRow: DatabaseRecord { public static var table: DatabaseTable { .dailySummary } }
extension SupplementDueFromRow: DatabaseRecord { public static var table: DatabaseTable { .supplementDueFrom } }
extension WeightMonthlyRow: DatabaseRecord { public static var table: DatabaseTable { .weightMonthly } }

extension ProfileWrite: DatabaseValue { public typealias Row = ProfileRow }
extension FoodLogWrite: DatabaseValue { public typealias Row = FoodLogRow }
extension CustomFoodWrite: DatabaseValue { public typealias Row = CustomFoodRow }
extension WorkoutSessionWrite: DatabaseValue { public typealias Row = WorkoutSessionRow }
extension WorkoutPlanWrite: DatabaseValue { public typealias Row = WorkoutPlanRow }
extension SupplementStackWrite: DatabaseValue { public typealias Row = SupplementStackRow }
extension SupplementLogWrite: DatabaseValue { public typealias Row = SupplementLogRow }
extension WaterLogWrite: DatabaseValue { public typealias Row = WaterLogRow }
extension BodyWeightLogWrite: DatabaseValue { public typealias Row = BodyWeightLogRow }

public extension SupabaseREST {
    func readAll<Row: DatabaseRecord>(_ row: Row.Type, filters: [DatabaseFilter] = []) async throws(DataError) -> [Row] {
        try await readAll(Row.table, as: row, filters: filters)
    }

    func readPage<Row: DatabaseRecord>(_ row: Row.Type, filters: [DatabaseFilter] = [],
        offset: Int = 0, limit: Int = 500, order: String? = nil) async throws(DataError) -> ReadPage<Row> {
        try await readPage(Row.table, as: row, filters: filters, offset: offset, limit: limit, order: order)
    }

    /// Chooses the table's insert/upsert contract once for both apps. This is a
    /// complete-value operation; use a narrow generic PATCH for individual settings.
    func save<Value: DatabaseValue>(value: Value) async throws(DataError) -> Value.Row {
        if Value.Row.table.conflictTarget != nil {
            return try await upsert(Value.Row.table, value: value, returning: Value.Row.self)
        }
        return try await insert(Value.Row.table, value: value, returning: Value.Row.self)
    }

    /// Updating a complete writable value preserves the row/table coupling.
    /// Use the returned row's server UUID for future changes.
    func update<Value: DatabaseValue>(id: UUID, ownerID: UUID, changes: Value) async throws(DataError) -> Value.Row {
        try await update(Value.Row.table, id: id, ownerID: ownerID, changes: changes, returning: Value.Row.self)
    }
}
