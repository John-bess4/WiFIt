import Foundation

/// Shared port of the established Revised Harris–Benedict goal calculation.
/// These are estimates used consistently by both apps, not HealthKit readings.
public enum BodyMetrics {
    public enum CalculationError: Error, Equatable, Sendable {
        case invalidMeasurements
        case resultOutsideSupportedRange
    }

    /// Explicit selection of the formula; a missing/unknown profile gender does
    /// not silently choose the female equation. The app must resolve that input.
    public enum Equation: String, Codable, CaseIterable, Sendable {
        case male, female
    }

    public struct Stats: Equatable, Sendable {
        public let equation: Equation
        public let weightLbs: Double
        public let heightIn: Double
        public let age: Int

        /// Empty-field defaults (170lb, 69in, 25) remain explicit UI choices.
        public init(equation: Equation, weightLbs: Double, heightIn: Double, age: Int) throws {
            guard weightLbs.isFinite, weightLbs > 0, heightIn.isFinite, heightIn > 0, age > 0 else {
                throw CalculationError.invalidMeasurements
            }
            self.equation = equation
            self.weightLbs = weightLbs
            self.heightIn = heightIn
            self.age = age
        }
    }

    public enum Activity: String, CaseIterable, Codable, Sendable {
        case bmr, sedentary, light, moderate, active
        case veryActive = "very_active"
        case extremely

        public var multiplier: Double {
            switch self {
            case .bmr: 1
            case .sedentary: 1.2
            case .light: 1.375
            case .moderate: 1.55
            case .active: 1.725
            case .veryActive: 1.9
            case .extremely: 2
            }
        }

        /// Matches the legacy unknown-activity fallback explicitly.
        public static func resolved(_ storedID: String?) -> Self {
            storedID.flatMap(Self.init(rawValue:)) ?? .moderate
        }
    }

    public enum GoalRate: String, CaseIterable, Codable, Sendable {
        case loseTwo = "lose_2"
        case loseOne = "lose_1"
        case loseHalf = "lose_0.5"
        case maintain
        case gainHalf = "gain_0.5"
        case gainOne = "gain_1"
        case gainTwo = "gain_2"

        public var calorieDelta: Int {
            switch self {
            case .loseTwo: -1000
            case .loseOne: -500
            case .loseHalf: -250
            case .maintain: 0
            case .gainHalf: 250
            case .gainOne: 500
            case .gainTwo: 1000
            }
        }

        /// Matches the legacy unknown-rate fallback explicitly.
        public static func resolved(_ storedID: String?) -> Self {
            storedID.flatMap(Self.init(rawValue:)) ?? .maintain
        }
    }

    public struct Macros: Codable, Equatable, Sendable {
        public let protein: Int
        public let carbs: Int
        public let fat: Int
    }

    public struct Goals: Codable, Equatable, Sendable {
        public let bmr: Int
        public let tdee: Int
        public let cal: Int
        public let protein: Int
        public let carbs: Int
        public let fat: Int
    }

    public static func bmr(_ stats: Stats) throws -> Double {
        let kg = stats.weightLbs * 0.453592
        let cm = stats.heightIn * 2.54
        let value: Double
        switch stats.equation {
        case .male:
            value = (13.397 * kg) + (4.799 * cm) - (5.677 * Double(stats.age)) + 88.362
        case .female:
            value = (9.247 * kg) + (3.098 * cm) - (4.330 * Double(stats.age)) + 447.593
        }
        guard value.isFinite else { throw CalculationError.resultOutsideSupportedRange }
        return value
    }

    public static func tdee(_ stats: Stats, activity: Activity) throws -> Int {
        try roundedInteger(bmr(stats) * activity.multiplier)
    }

    public static func calories(tdee: Int, rate: GoalRate) throws -> Int {
        let (adjusted, overflow) = tdee.addingReportingOverflow(rate.calorieDelta)
        guard !overflow else { throw CalculationError.resultOutsideSupportedRange }
        return max(adjusted, 1200)
    }

    public static func macros(calories: Int, weightLbs: Double) throws -> Macros {
        guard calories > 0, weightLbs.isFinite, weightLbs > 0 else {
            throw CalculationError.invalidMeasurements
        }
        let protein = try roundedInteger(weightLbs * 0.82)
        let fat = try roundedInteger((Double(calories) * 0.25) / 9)
        let carbs = max(try roundedInteger((Double(calories) - Double(protein) * 4 - Double(fat) * 9) / 4), 50)
        return Macros(protein: protein, carbs: carbs, fat: fat)
    }

    public static func goals(_ stats: Stats, activity: Activity, rate: GoalRate) throws -> Goals {
        let rawBMR = try bmr(stats)
        // Round the full product, not an already-rounded BMR.
        let expenditure = try roundedInteger(rawBMR * activity.multiplier)
        let target = try calories(tdee: expenditure, rate: rate)
        let split = try macros(calories: target, weightLbs: stats.weightLbs)
        return Goals(bmr: try roundedInteger(rawBMR), tdee: expenditure, cal: target,
                     protein: split.protein, carbs: split.carbs, fat: split.fat)
    }

    private static func roundedInteger(_ value: Double) throws -> Int {
        // JavaScript Math.round ties toward +infinity. This intentionally differs
        // from the Postgres nutrition rule for negative ties.
        let lower = floor(value)
        let rounded = value - lower < 0.5 ? lower : lower + 1
        guard rounded.isFinite, rounded >= Double(Int.min), rounded < Double(Int.max) else {
            throw CalculationError.resultOutsideSupportedRange
        }
        return Int(rounded)
    }
}
