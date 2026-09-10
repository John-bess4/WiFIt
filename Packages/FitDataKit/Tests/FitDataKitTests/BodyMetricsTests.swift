import Foundation
import XCTest
@testable import FitDataKit

final class BodyMetricsTests: XCTestCase {
    private struct Fixture: Decodable {
        struct Row: Decodable {
            struct Input: Decodable {
                let gender: String
                let weightLbs: Double
                let heightIn: Double
                let age: Int
                let activityId: String
                let rateId: String
            }
            let input: Input
            let rawBmr: Double
            let expected: BodyMetrics.Goals
        }
        let cases: [Row]
    }

    func testFixedGoldenMatrixAcrossEveryActivityAndRate() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "body-metrics-golden", withExtension: "json"))
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
        XCTAssertEqual(fixture.cases.count, 196)
        XCTAssertEqual(Set(fixture.cases.map(\.input.activityId)),
                       Set(["bmr", "sedentary", "light", "moderate", "active", "very_active", "extremely"]))
        XCTAssertEqual(Set(fixture.cases.map(\.input.rateId)),
                       Set(["lose_2", "lose_1", "lose_0.5", "maintain", "gain_0.5", "gain_1", "gain_2"]))
        for row in fixture.cases {
            let input = row.input
            let equation = try XCTUnwrap(BodyMetrics.Equation(rawValue: input.gender))
            let activity = try XCTUnwrap(BodyMetrics.Activity(rawValue: input.activityId))
            let rate = try XCTUnwrap(BodyMetrics.GoalRate(rawValue: input.rateId))
            let stats = try BodyMetrics.Stats(equation: equation, weightLbs: input.weightLbs,
                                             heightIn: input.heightIn, age: input.age)
            XCTAssertEqual(try BodyMetrics.bmr(stats), row.rawBmr, accuracy: 0.000000001)
            XCTAssertEqual(try BodyMetrics.tdee(stats, activity: activity), row.expected.tdee)
            XCTAssertEqual(try BodyMetrics.goals(stats, activity: activity, rate: rate), row.expected,
                           input.gender + "/" + String(input.weightLbs) + "/" + input.activityId + "/" + input.rateId)
        }
    }

    func testLegacyFallbacksAreExplicitAndMeasurementsAreNeverInvented() throws {
        XCTAssertEqual(BodyMetrics.Activity.resolved(nil), .moderate)
        XCTAssertEqual(BodyMetrics.Activity.resolved("unknown"), .moderate)
        XCTAssertEqual(BodyMetrics.GoalRate.resolved(nil), .maintain)
        XCTAssertEqual(BodyMetrics.GoalRate.resolved("unknown"), .maintain)
        XCTAssertNil(BodyMetrics.Equation(rawValue: "unknown"))
        XCTAssertThrowsError(try BodyMetrics.Stats(equation: .male, weightLbs: 0, heightIn: 69, age: 25))
        XCTAssertThrowsError(try BodyMetrics.Stats(equation: .female, weightLbs: .nan, heightIn: 65, age: 28))
        XCTAssertThrowsError(try BodyMetrics.Stats(equation: .male, weightLbs: 170, heightIn: 0, age: 25))
        XCTAssertThrowsError(try BodyMetrics.Stats(equation: .male, weightLbs: 170, heightIn: 69, age: 0))
        let explicitDefaults = try BodyMetrics.Stats(equation: .male, weightLbs: 170, heightIn: 69, age: 25)
        let goals = try BodyMetrics.goals(explicitDefaults, activity: .moderate, rate: .maintain)
        XCTAssertEqual(goals.bmr, 1821)
        XCTAssertEqual(goals.tdee, 2822)
    }

    func testFloorsAndOverflowAreHandledWithoutIntegerTraps() throws {
        XCTAssertEqual(try BodyMetrics.calories(tdee: 1500, rate: .loseTwo), 1200)
        XCTAssertEqual(try BodyMetrics.calories(tdee: 2500, rate: .gainHalf), 2750)
        let macros = try BodyMetrics.macros(calories: 1200, weightLbs: 300)
        XCTAssertEqual(macros.protein, 246)
        XCTAssertEqual(macros.fat, 33)
        XCTAssertEqual(macros.carbs, 50)
        XCTAssertThrowsError(try BodyMetrics.calories(tdee: Int.max, rate: .gainTwo))
        let huge = try BodyMetrics.Stats(equation: .male, weightLbs: .greatestFiniteMagnitude, heightIn: 69, age: 25)
        XCTAssertThrowsError(try BodyMetrics.goals(huge, activity: .extremely, rate: .gainTwo))
        XCTAssertThrowsError(try BodyMetrics.macros(calories: 2000, weightLbs: .infinity))
    }
}
