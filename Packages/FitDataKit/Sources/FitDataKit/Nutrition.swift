import Foundation

/// Unknown label values stay nil. A known zero is a different claim.
/// Decode Decimal directly from JSON; never pass database numbers through Double.
public struct Nutrients: Codable, Equatable, Sendable {
    public var cal: Decimal?
    public var protein: Decimal?
    public var carbs: Decimal?
    public var fat: Decimal?
    public var fiber: Decimal?
    public var sugar: Decimal?
    public var sodium: Decimal?

    public init(cal: Decimal? = nil, protein: Decimal? = nil, carbs: Decimal? = nil,
                fat: Decimal? = nil, fiber: Decimal? = nil, sugar: Decimal? = nil,
                sodium: Decimal? = nil) {
        self.cal = cal
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.fiber = fiber
        self.sugar = sugar
        self.sodium = sodium
    }

    public enum Kind: String, CaseIterable, Codable, Hashable, Sendable {
        case cal, protein, carbs, fat, fiber, sugar, sodium
    }

    public subscript(kind: Kind) -> Decimal? {
        get {
            switch kind {
            case .cal: cal
            case .protein: protein
            case .carbs: carbs
            case .fat: fat
            case .fiber: fiber
            case .sugar: sugar
            case .sodium: sodium
            }
        }
        set {
            switch kind {
            case .cal: cal = newValue
            case .protein: protein = newValue
            case .carbs: carbs = newValue
            case .fat: fat = newValue
            case .fiber: fiber = newValue
            case .sugar: sugar = newValue
            case .sodium: sodium = newValue
            }
        }
    }
}

public struct FoodPortion: Equatable, Sendable {
    public let grams: Decimal
    public let per100: Nutrients

    public init(grams: Decimal, per100: Nutrients) {
        self.grams = grams
        self.per100 = per100
    }
}

public struct NutritionTotals: Equatable, Sendable {
    /// Includes known values only; every field is non-nil, even for an empty log.
    public let knownSum: Nutrients
    /// Allows UI to label a sum as incomplete rather than claiming unknown is zero.
    public let unknownNutrients: Set<Nutrients.Kind>
}

public enum Nutrition {
    public enum CalculationError: Error, Equatable, Sendable {
        case nonFiniteNumber
        case invalidGramWeight
        case invalidScale
        case arithmeticOverflow
    }

    /// Postgres numeric round: ties go away from zero, including negative ties.
    public static func rounded(_ value: Decimal, scale: Int = 0) throws -> Decimal {
        guard !value.isNaN else { throw CalculationError.nonFiniteNumber }
        guard (0...18).contains(scale) else { throw CalculationError.invalidScale }
        var source = value
        var result = Decimal()
        NSDecimalRound(&result, &source, scale, .plain)
        guard !result.isNaN else { throw CalculationError.arithmeticOverflow }
        return result
    }

    /// Pure arithmetic permits zero and negative values for comparisons/fixtures.
    /// Food write validation separately requires a positive serving weight.
    public static func scaled(per100: Decimal, grams: Decimal, scale: Int = 0) throws -> Decimal {
        let product = try multiply(per100, grams)
        return try rounded(divide(product, by: 100), scale: scale)
    }

    /// kcal/protein/carbs/fat match daily_summary's whole-unit per-row rounding.
    /// Fiber/sugar are absent from that view and keep the established 0.1g display
    /// precision; sodium keeps integer mg. These extra totals are not view data.
    public static func calculate(_ portion: FoodPortion) throws -> Nutrients {
        guard !portion.grams.isNaN, portion.grams >= 0 else {
            throw CalculationError.invalidGramWeight
        }
        var result = Nutrients()
        for kind in Nutrients.Kind.allCases {
            if let value = portion.per100[kind] {
                let scale = kind == .fiber || kind == .sugar ? 1 : 0
                result[kind] = try scaled(per100: value, grams: portion.grams, scale: scale)
            }
        }
        return result
    }

    /// For an unsaved meal preview or extra nutrients; saved daily summary values
    /// still come from the database view. Round each row before adding it.
    public static func totals(_ portions: [FoodPortion]) throws -> NutritionTotals {
        var sum = Nutrients(cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0)
        var unknown: Set<Nutrients.Kind> = []
        for portion in portions {
            let calculated = try calculate(portion)
            for kind in Nutrients.Kind.allCases {
                if let value = calculated[kind] {
                    sum[kind] = try add(sum[kind] ?? 0, value)
                } else {
                    unknown.insert(kind)
                }
            }
        }
        return NutritionTotals(knownSum: sum, unknownNutrients: unknown)
    }

    /// Converts absolute label/recipe values to the established integer per100
    /// values. Unknown stays unknown; invalid grams never fall back to 100g.
    public static func per100(from absolute: Nutrients, grams: Decimal) throws -> Nutrients {
        guard !grams.isNaN, grams > 0 else { throw CalculationError.invalidGramWeight }
        var result = Nutrients()
        for kind in Nutrients.Kind.allCases {
            if let value = absolute[kind] {
                result[kind] = try rounded(divide(multiply(value, 100), by: grams))
            }
        }
        return result
    }

    public enum ServingUnit: String, Codable, Sendable {
        case grams = "g"
        case ounces = "oz"
    }

    /// Cups, pieces, tablespoons and ml need a user-confirmed gram weight; there
    /// is no automatic food-independent density conversion for those units.
    public static func servingGrams(quantity: Decimal, unit: ServingUnit) throws -> Decimal {
        guard !quantity.isNaN, quantity > 0 else { throw CalculationError.invalidGramWeight }
        let factor = unit == .grams ? Decimal(1) : Decimal(string: "28.3495")!
        return try rounded(multiply(quantity, factor), scale: 1)
    }

    private static func multiply(_ lhs: Decimal, _ rhs: Decimal) throws -> Decimal {
        var left = lhs, right = rhs, result = Decimal()
        try check(NSDecimalMultiply(&result, &left, &right, .plain), result: result)
        return result
    }

    private static func divide(_ lhs: Decimal, by rhs: Decimal) throws -> Decimal {
        var left = lhs, right = rhs, result = Decimal()
        try check(NSDecimalDivide(&result, &left, &right, .plain), result: result)
        return result
    }

    private static func add(_ lhs: Decimal, _ rhs: Decimal) throws -> Decimal {
        var left = lhs, right = rhs, result = Decimal()
        try check(NSDecimalAdd(&result, &left, &right, .plain), result: result)
        return result
    }

    private static func check(_ error: Decimal.CalculationError, result: Decimal) throws {
        guard !result.isNaN else { throw CalculationError.nonFiniteNumber }
        // Recurring fractions (e.g. 100/3) exhaust Decimal's finite precision;
        // rounding to whole nutrients afterward is expected. Overflow is not.
        guard error == .noError || error == .lossOfPrecision else {
            throw CalculationError.arithmeticOverflow
        }
    }
}
