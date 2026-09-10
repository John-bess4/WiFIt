import Foundation
import FitDataKit

/// Active app resources only. Usage accounting and legacy workouts are not app loads.
public enum AppResource: String, CaseIterable, Hashable, Sendable, Identifiable {
    case foodLog, customFoods, workoutSessions, workoutPlans, supplementStack, supplementLog
    case waterLog, bodyWeightLog, exerciseBests, exercisePREvents, dailySummary, supplementDueFrom, weightMonthly
    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .foodLog: "Today's meals"
        case .customFoods: "My foods"
        case .workoutSessions: "Workout history"
        case .workoutPlans: "Workout plans"
        case .supplementStack: "Supplement stack"
        case .supplementLog: "Today's supplements"
        case .waterLog: "Today's water"
        case .bodyWeightLog: "Weight history"
        case .exerciseBests: "Exercise bests"
        case .exercisePREvents: "Personal records"
        case .dailySummary: "Daily summaries"
        case .supplementDueFrom: "Supplement schedule"
        case .weightMonthly: "Monthly progress"
        }
    }
    public var isDayScoped: Bool { [.foodLog, .supplementLog, .waterLog].contains(self) }
}

/// Every case retains the actual typed rows. A count is never a stand-in for loaded data.
public enum ResourcePayload: Sendable, Equatable {
    case foodLog([FoodLogRow]), customFoods([CustomFoodRow]), workoutSessions([WorkoutSessionRow])
    case workoutPlans([WorkoutPlanRow]), supplementStack([SupplementStackRow]), supplementLog([SupplementLogRow])
    case waterLog([WaterLogRow]), bodyWeightLog([BodyWeightLogRow]), exerciseBests([ExerciseBestRow])
    case exercisePREvents([ExercisePREventRow]), dailySummary([DailySummaryRow])
    case supplementDueFrom([SupplementDueFromRow]), weightMonthly([WeightMonthlyRow])
    public var resource: AppResource {
        switch self {
        case .foodLog: .foodLog
        case .customFoods: .customFoods
        case .workoutSessions: .workoutSessions
        case .workoutPlans: .workoutPlans
        case .supplementStack: .supplementStack
        case .supplementLog: .supplementLog
        case .waterLog: .waterLog
        case .bodyWeightLog: .bodyWeightLog
        case .exerciseBests: .exerciseBests
        case .exercisePREvents: .exercisePREvents
        case .dailySummary: .dailySummary
        case .supplementDueFrom: .supplementDueFrom
        case .weightMonthly: .weightMonthly
        }
    }
    public var count: Int {
        switch self {
        case .foodLog(let rows): rows.count
        case .customFoods(let rows): rows.count
        case .workoutSessions(let rows): rows.count
        case .workoutPlans(let rows): rows.count
        case .supplementStack(let rows): rows.count
        case .supplementLog(let rows): rows.count
        case .waterLog(let rows): rows.count
        case .bodyWeightLog(let rows): rows.count
        case .exerciseBests(let rows): rows.count
        case .exercisePREvents(let rows): rows.count
        case .dailySummary(let rows): rows.count
        case .supplementDueFrom(let rows): rows.count
        case .weightMonthly(let rows): rows.count
        }
    }
    func belongs(to userID: UUID) -> Bool {
        switch self {
        case .foodLog(let rows): rows.allSatisfy { $0.userID == userID }
        case .customFoods(let rows): rows.allSatisfy { $0.userID == userID }
        case .workoutSessions(let rows): rows.allSatisfy { $0.userID == userID }
        case .workoutPlans(let rows): rows.allSatisfy { $0.userID == userID }
        case .supplementStack(let rows): rows.allSatisfy { $0.userID == userID }
        case .supplementLog(let rows): rows.allSatisfy { $0.userID == userID }
        case .waterLog(let rows): rows.allSatisfy { $0.userID == userID }
        case .bodyWeightLog(let rows): rows.allSatisfy { $0.userID == userID }
        case .exerciseBests(let rows): rows.allSatisfy { $0.userID == userID }
        case .exercisePREvents(let rows): rows.allSatisfy { $0.userID == userID }
        case .dailySummary(let rows): rows.allSatisfy { $0.userID == userID }
        case .supplementDueFrom(let rows): rows.allSatisfy { $0.userID == userID }
        case .weightMonthly(let rows): rows.allSatisfy { $0.userID == userID }
        }
    }
    func matchesDay(_ day: LocalDay) -> Bool {
        switch self {
        case .foodLog(let rows): rows.allSatisfy { $0.loggedDate == day }
        case .supplementLog(let rows): rows.allSatisfy { $0.logDate == day }
        case .waterLog(let rows): rows.count <= 1 && rows.allSatisfy { $0.logDate == day }
        default: true
        }
    }
}

public struct LoadContext: Sendable, Equatable {
    public let userID: UUID
    public let day: LocalDay
    public let timeZoneIdentifier: String
    public init(userID: UUID, day: LocalDay, timeZoneIdentifier: String) {
        self.userID = userID; self.day = day; self.timeZoneIdentifier = timeZoneIdentifier
    }
}

public struct ResourceState: Sendable, Equatable {
    public internal(set) var payload: ResourcePayload?
    public internal(set) var isLoading = false
    public internal(set) var failure: DataError?
    public internal(set) var verifiedAt: Date?
    public internal(set) var context: LoadContext?
    public var count: Int? { payload?.count }
    public init() {}
    public func isReady(in context: LoadContext) -> Bool {
        payload != nil && !isLoading && failure == nil && self.context == context
    }
}
