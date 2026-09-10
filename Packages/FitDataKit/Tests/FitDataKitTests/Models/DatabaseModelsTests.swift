import Foundation
import XCTest
@testable import FitDataKit

final class DatabaseModelsTests: XCTestCase {
    private let userID = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!
    private let rowID = UUID(uuidString: "22222222-2222-4222-8222-222222222222")!
    private let assignmentID = UUID(uuidString: "33333333-3333-4333-8333-333333333333")!

    private var identity: String { "\"id\":\"" + rowID.uuidString + "\",\"user_id\":\"" + userID.uuidString + "\"" }
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T { try JSONDecoder().decode(type, from: Data(json.utf8)) }
    private func encoded<T: Encodable>(_ value: T) throws -> [String: Any] { try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any]) }

    func testAllActiveTableShapesDecodeWithoutInventingNullableDefaults() throws {
        let profile = try decode(ProfileRow.self, "{\"id\":\"" + userID.uuidString + "\",\"goal_rate\":\"lose_1\"}")
        XCTAssertEqual(profile.goalRate, "lose_1")
        XCTAssertNil(profile.calGoal)
        let food = try decode(FoodLogRow.self, "{" + identity + ",\"logged_date\":\"2026-09-09\",\"food_name\":\"Rice\",\"meal_slot\":\"lunch\",\"grams\":125.5}")
        XCTAssertEqual(food.grams, Decimal(string: "125.5"))
        XCTAssertNil(food.per100Sugar)
        let custom = try decode(CustomFoodRow.self, "{" + identity + ",\"name\":\"Custom\",\"serving_qty\":4,\"serving_unit\":\"oz\",\"serving_g\":113.4}")
        XCTAssertEqual(custom.servingG, Decimal(string: "113.4"))
        XCTAssertEqual(custom.servingUnit, "oz")
        let session = try decode(WorkoutSessionRow.self, "{" + identity + ",\"workout_name\":\"Push\",\"completed_date\":\"2026-09-09\",\"exercises\":null}")
        XCTAssertNil(session.exercises)
        XCTAssertNil(session.durationSecs)
        let plan = try decode(WorkoutPlanRow.self, "{" + identity + ",\"name\":\"Push\",\"exercises\":[]}")
        XCTAssertEqual(plan.exercises, .array([]))
        let stack = try decode(SupplementStackRow.self, "{" + identity + ",\"name\":\"Protein\"}")
        XCTAssertNil(stack.category)
        XCTAssertNil(stack.reminderEnabled)
        let log = try decode(SupplementLogRow.self, "{" + identity + ",\"supplement_id\":\"" + rowID.uuidString + "\",\"log_date\":\"2026-09-09\"}")
        XCTAssertNil(log.taken)
        let water = try decode(WaterLogRow.self, "{" + identity + ",\"log_date\":\"2026-09-09\",\"oz\":48}")
        XCTAssertEqual(water.oz, 48)
        XCTAssertNil(water.cups)
        let weight = try decode(BodyWeightLogRow.self, "{" + identity + ",\"log_date\":\"2026-09-09\",\"weight_lbs\":170.25}")
        XCTAssertEqual(weight.weightLbs, Decimal(string: "170.25"))
        let usage = try decode(AICoachUsageRow.self, "{" + identity + ",\"created_at\":\"2026-09-10T00:01:02.123456+00:00\"}")
        XCTAssertEqual(usage.createdAt, "2026-09-10T00:01:02.123456+00:00")
    }

    func testFiveViewsUseActualSQLTypesAndNullability() throws {
        let best = try decode(ExerciseBestRow.self, "{\"user_id\":\"" + userID.uuidString + "\",\"name\":\"Bench\",\"best_lbs\":27.5}")
        XCTAssertEqual(best.bestLbs, Decimal(string: "27.5"))
        let event = try decode(ExercisePREventRow.self, "{\"session_id\":\"" + rowID.uuidString + "\",\"completed_date\":\"2026-09-09\",\"lbs\":30,\"prev_best\":27.5}")
        XCTAssertEqual(event.sessionID, rowID)
        let day = try decode(DailySummaryRow.self, "{\"day\":\"2026-09-09\",\"kcal\":790,\"protein_g\":96,\"workout_names\":\"Push, Pull\",\"weight_lbs\":null}")
        XCTAssertEqual(day.kcal, 790)
        XCTAssertEqual(day.workoutNames, "Push, Pull")
        XCTAssertNil(day.weightLbs)
        let due = try decode(SupplementDueFromRow.self, "{\"supplement_id\":\"" + rowID.uuidString + "\",\"due_from\":\"2026-08-31\"}")
        XCTAssertEqual(due.dueFrom?.rawValue, "2026-08-31")
        let month = try decode(WeightMonthlyRow.self, "{\"month\":\"2026-09\",\"first_lbs\":170.5,\"last_lbs\":168.75,\"entries\":3}")
        XCTAssertEqual(month.lastLbs, Decimal(string: "168.75"))
        XCTAssertEqual(month.entries, 3)
        XCTAssertNil(try decode(DailySummaryRow.self, "{}").kcal)
        XCTAssertThrowsError(try decode(DailySummaryRow.self, "{\"kcal\":3.5}"))
        XCTAssertThrowsError(try decode(DailySummaryRow.self, "{\"workout_names\":[]}"))
    }

    func testInvalidDatabaseIdentityDateAndNumericDoNotDecodeAsAnEmptyRead() throws {
        XCTAssertThrowsError(try decode(ProfileRow.self, "{\"id\":\"local-1\"}"))
        XCTAssertThrowsError(try decode(FoodLogRow.self, "{" + identity + ",\"logged_date\":\"2026-02-30\",\"food_name\":\"Rice\",\"meal_slot\":\"lunch\",\"grams\":100}"))
        XCTAssertThrowsError(try decode(BodyWeightLogRow.self, "{" + identity + ",\"log_date\":\"2026-09-09\",\"weight_lbs\":\"garbage\"}"))
        XCTAssertThrowsError(try decode(WaterLogRow.self, "{" + identity + ",\"log_date\":\"2026-09-09\",\"oz\":null}"))
    }

    func testJSONAndNutritionNeverLoseDecimalPrecisionOrUnknownSugar() throws {
        let food = try decode(FoodLogRow.self, "{" + identity + ",\"logged_date\":\"2026-09-09\",\"food_name\":\"Example\",\"meal_slot\":\"lunch\",\"grams\":500,\"per100_cal\":32.3,\"per100_sugar\":null}")
        XCTAssertEqual(food.per100Cal, Decimal(string: "32.3"))
        XCTAssertNil(food.portion.per100.sugar)
        let json = try decode(JSONValue.self, "{\"weight\":1234567890.1234567890123456789,\"flag\":true}")
        XCTAssertEqual(json.object?["weight"], .number(Decimal(string: "1234567890.1234567890123456789")!))
        XCTAssertEqual(json.object?["flag"], .bool(true))
        XCTAssertEqual(try decode(JSONValue.self, String(decoding: JSONEncoder().encode(json), as: UTF8.self)), json)
    }

    func testOriginUUIDSurvivesSessionAndPlanReadsAndWrites() throws {
        let suffix = ",\"trainer_assignment_id\":\"" + assignmentID.uuidString + "\"}"
        let session = try decode(WorkoutSessionRow.self, "{" + identity + ",\"workout_name\":\"Trainer day\",\"completed_date\":\"2026-09-09\"" + suffix)
        XCTAssertEqual(session.trainerAssignmentID, assignmentID)
        let plan = try decode(WorkoutPlanRow.self, "{" + identity + ",\"name\":\"Trainer day\",\"exercises\":[]" + suffix)
        XCTAssertEqual(plan.trainerAssignmentID, assignmentID)
        let write = WorkoutSessionWrite(userID: userID, workoutName: session.workoutName, completedDate: session.completedDate, setsCompleted: 1, totalSets: 1, exercises: [.init(name: "Bench", setsData: [.init(reps: 8, weight: Decimal(string: "27.5")!)])], trainerAssignmentID: session.trainerAssignmentID)
        try write.validate()
        let object = try encoded(write)
        XCTAssertEqual(object["trainer_assignment_id"] as? String, assignmentID.uuidString)
        XCTAssertNil(object["trainerAssignmentID"])
        XCTAssertNil(object["id"])
        XCTAssertNil(object["prs"])
        let exercise = try XCTUnwrap((object["exercises"] as? [[String: Any]])?.first)
        XCTAssertEqual(exercise["sets"] as? [String], ["8×27.5lbs"])
        XCTAssertNotNil(exercise["setsData"])
        XCTAssertNil(exercise["sets_data"])
        XCTAssertThrowsError(try decode(WorkoutSessionRow.self, "{" + identity + ",\"workout_name\":\"Push\",\"completed_date\":\"2026-09-09\",\"trainer_assignment_id\":\"template-1\"}"))
    }

    func testEditingConstructorsRetainTrainerOriginAndMetadata() throws {
        let plan = try decode(WorkoutPlanRow.self, "{" + identity + #","name":"Trainer day","exercises":[{"name":"Bench","assignment_note":"tempo","sets":[{"reps":8,"weight":27.5,"rest_seconds":90}]}],"trainer_assignment_id":""# + assignmentID.uuidString + "\"}")
        let write = try WorkoutPlanWrite(editing: plan)
        XCTAssertEqual(write.trainerAssignmentID, assignmentID)
        XCTAssertEqual(write.exercises[0].additionalFields["assignment_note"], .string("tempo"))
        XCTAssertEqual(write.exercises[0].sets[0].additionalFields["rest_seconds"], .number(90))
        let session = try decode(WorkoutSessionRow.self, "{" + identity + #","workout_name":"Trainer day","completed_date":"2026-09-09","sets_completed":1,"total_sets":2,"exercises":[{"name":"Bench","setsData":[{"reps":8,"weight":27.5}]}],"trainer_assignment_id":""# + assignmentID.uuidString + "\"}")
        let editedSession = try WorkoutSessionWrite(editing: session)
        XCTAssertEqual(editedSession.trainerAssignmentID, assignmentID)
        XCTAssertEqual(editedSession.totalSets, 2)
        XCTAssertEqual(editedSession.exercises[0].sets, ["8×27.5lbs"])
    }

    func testWritesEncodeNullAndOmitServerAndDeadFields() throws {
        let day = try LocalDay("2026-09-09")
        let food = FoodLogWrite(userID: userID, loggedDate: day, mealSlot: "lunch", foodName: "Rice", grams: 100)
        try food.validate()
        let json = try encoded(food)
        XCTAssertTrue(json["per100_sugar"] is NSNull)
        XCTAssertNil(json["id"])
        XCTAssertNil(json["created_at"])
        let water = try encoded(WaterLogWrite(userID: userID, logDate: day, oz: 48))
        XCTAssertNil(water["id"])
        XCTAssertNil(water["cups"])
        let profile = try encoded(ProfileWrite(id: userID))
        XCTAssertNil(profile["goal"])
        XCTAssertNil(profile["created_at"])
        XCTAssertNil(profile["updated_at"])
        XCTAssertTrue(profile["goal_rate"] is NSNull)
        let plan = try encoded(WorkoutPlanWrite(userID: userID, name: "Push", exercises: []))
        XCTAssertTrue(plan["trainer_assignment_id"] is NSNull)
    }

    func testWriteValidationRejectsValuesDatabaseMayOtherwiseAccept() throws {
        let day = try LocalDay("2026-09-09")
        XCTAssertThrowsError(try FoodLogWrite(userID: userID, loggedDate: day, mealSlot: "lunch", foodName: "Rice", grams: 0).validate())
        XCTAssertThrowsError(try FoodLogWrite(userID: userID, loggedDate: day, mealSlot: "lunch", foodName: "Rice", grams: .nan).validate())
        XCTAssertThrowsError(try FoodLogWrite(userID: userID, loggedDate: day, mealSlot: "lunch", foodName: "Rice", grams: 100, per100Sugar: -1).validate())
        XCTAssertThrowsError(try FoodLogWrite(userID: userID, loggedDate: day, mealSlot: "meal", foodName: "Rice", grams: 100).validate())
        XCTAssertThrowsError(try WorkoutSessionWrite(userID: userID, workoutName: "Push", completedDate: day, setsCompleted: 2, totalSets: 2, exercises: [.init(name: "Bench", setsData: [.init(reps: 8, weight: 100)])]).validate())
        XCTAssertThrowsError(try WaterLogWrite(userID: userID, logDate: day, oz: -1).validate())
        XCTAssertThrowsError(try SupplementStackWrite(userID: userID, name: "Vitamin", reminderTime: "24:00", reminderEnabled: true).validate())
        XCTAssertThrowsError(try SupplementStackWrite(userID: userID, name: "Vitamin", reminderEnabled: true).validate())
        try SupplementStackWrite(userID: userID, name: "Vitamin", reminderTime: "06:30", reminderEnabled: true, category: .vitamin).validate()
    }
}
