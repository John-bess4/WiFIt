import Foundation
import XCTest
@testable import FitDataKit

final class NutritionTests: XCTestCase {
    private struct Fixture: Decodable {
        struct Row: Decodable {
            let per100: Decimal
            let grams: Decimal
            let expected: Decimal
            let note: String
        }
        let cases: [Row]
    }

    private func decimal(_ value: String) -> Decimal {
        Decimal(string: value, locale: Locale(identifier: "en_US_POSIX"))!
    }

    func testAllPostgresFixturesAndDoubleDiscriminator() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "rounding-fixture", withExtension: "json"))
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
        XCTAssertEqual(fixture.cases.count, 29)
        var doubleMismatches = 0
        for row in fixture.cases {
            XCTAssertEqual(try Nutrition.scaled(per100: row.per100, grams: row.grams), row.expected, row.note)
            let double = NSDecimalNumber(decimal: row.per100).doubleValue
                * NSDecimalNumber(decimal: row.grams).doubleValue / 100
            if Decimal(double.rounded()) != row.expected { doubleMismatches += 1 }
        }
        XCTAssertGreaterThanOrEqual(doubleMismatches, 10, "Fixture must detect an accidental Double implementation.")
    }

    func testNegativeTiesAreAwayFromZeroAndNotJavaScriptRounding() throws {
        XCTAssertEqual(try Nutrition.scaled(per100: decimal("-2.5"), grams: 100), -3)
        XCTAssertEqual(try Nutrition.scaled(per100: decimal("-32.3"), grams: 500), -162)
        XCTAssertEqual(try Nutrition.rounded(decimal("-1.25"), scale: 1), decimal("-1.3"))
        XCTAssertEqual(try Nutrition.rounded(decimal("2.5")), 3) // distinguishes bankers rounding
    }

    func testNumericJSONMaintainsDecimalPrecisionThroughRoundTrip() throws {
        // The final digits are beyond Double's precision. A Decimal(Double)
        // workaround fails this even if it happens to pass the 32.3 example.
        let data = Data("{\"cal\":12345678901234567890.123456789012345678,\"protein\":32.3,\"sugar\":null}".utf8)
        let decoded = try JSONDecoder().decode(Nutrients.self, from: data)
        XCTAssertEqual(decoded.cal, decimal("12345678901234567890.123456789012345678"))
        XCTAssertEqual(decoded.protein, decimal("32.3"))
        XCTAssertNil(decoded.sugar)
        let encoded = try JSONEncoder().encode(decoded)
        XCTAssertEqual(try JSONDecoder().decode(Nutrients.self, from: encoded), decoded)
    }

    func testEachRowRoundsBeforeSummingAndMatchesViewForEveryMacro() throws {
        let item = FoodPortion(grams: 100, per100: Nutrients(
            cal: decimal("0.5"), protein: decimal("0.5"), carbs: decimal("0.5"), fat: decimal("0.5"),
            fiber: decimal("0.05"), sugar: decimal("0.05"), sodium: decimal("0.5")))
        let result = try Nutrition.totals([item, item, item])
        XCTAssertEqual(result.knownSum, Nutrients(cal: 3, protein: 3, carbs: 3, fat: 3,
                                                fiber: decimal("0.3"), sugar: decimal("0.3"), sodium: 3))
        XCTAssertTrue(result.unknownNutrients.isEmpty)
        // Sum-then-round would produce 2 instead of 3; tenths for protein would
        // produce 1.5. Both are inconsistent with the stored daily_summary view.
    }

    func testUnknownStaysUnknownForItemButTotalsExposeKnownSumAndCoverage() throws {
        let missing = FoodPortion(grams: 100, per100: Nutrients(cal: 100, sugar: nil))
        let known = FoodPortion(grams: 100, per100: Nutrients(cal: 50, sugar: decimal("2.4")))
        XCTAssertNil(try Nutrition.calculate(missing).sugar)
        let totals = try Nutrition.totals([missing, known])
        XCTAssertEqual(totals.knownSum.cal, 150)
        XCTAssertEqual(totals.knownSum.sugar, decimal("2.4"))
        XCTAssertTrue(totals.unknownNutrients.contains(.sugar))
        XCTAssertFalse(totals.unknownNutrients.contains(.cal))
        XCTAssertNil(try Nutrition.per100(from: missing.per100, grams: 100).sugar)
        let empty = try Nutrition.totals([])
        XCTAssertEqual(empty.knownSum.sugar, 0)
        XCTAssertTrue(empty.unknownNutrients.isEmpty)
    }

    func testPer100ScalingAndInvalidInputs() throws {
        let converted = try Nutrition.per100(from: Nutrients(cal: 200, protein: 12, sugar: nil), grams: 75)
        XCTAssertEqual(converted.cal, 267)
        XCTAssertEqual(converted.protein, 16)
        XCTAssertNil(converted.sugar)
        XCTAssertEqual(try Nutrition.per100(from: Nutrients(cal: 1), grams: 3).cal, 33)
        for grams in [Decimal.zero, -1, Decimal.nan] {
            XCTAssertThrowsError(try Nutrition.per100(from: Nutrients(cal: 100), grams: grams))
        }
        XCTAssertThrowsError(try Nutrition.calculate(FoodPortion(grams: -1, per100: Nutrients(cal: 20))))
        XCTAssertThrowsError(try Nutrition.scaled(per100: .nan, grams: 100))
        XCTAssertThrowsError(try Nutrition.rounded(1, scale: -1))
    }

    func testServingConversionOnlyUsesFoodIndependentUnits() throws {
        XCTAssertEqual(try Nutrition.servingGrams(quantity: 4, unit: .ounces), decimal("113.4"))
        XCTAssertEqual(try Nutrition.servingGrams(quantity: decimal("17.25"), unit: .grams), decimal("17.3"))
        XCTAssertNil(Nutrition.ServingUnit(rawValue: "cup"))
        XCTAssertNil(Nutrition.ServingUnit(rawValue: "ml"))
        XCTAssertThrowsError(try Nutrition.servingGrams(quantity: 0, unit: .ounces))
    }
}
