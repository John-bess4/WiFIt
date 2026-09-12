import Foundation
import XCTest
@testable import FitDataKit

final class WorkoutModelsTests: XCTestCase {
    private func json(_ value: String) throws -> JSONValue { try JSONDecoder().decode(JSONValue.self, from: Data(value.utf8)) }

    func testStructuredValuesAlwaysWinOverStaleSameLengthLabels() throws {
        let raw = try json(#"[{"name":"Bench","sets":["8×27lbs"],"setsData":[{"reps":8.5,"weight":27.5}]}]"#)
        let result = SessionNormalizer.normalize(raw)
        XCTAssertEqual(result.exercises[0].sets[0].reps, Decimal(string: "8.5"))
        XCTAssertEqual(result.exercises[0].sets[0].weight, Decimal(string: "27.5"))
        XCTAssertEqual(result.exercises[0].sets[0].label, "8.5×27.5lbs")
        XCTAssertTrue(result.issues.contains { $0.reason == .rebuiltLabels })
        XCTAssertEqual(try result.validatedExercises()[0].sets, ["8.5×27.5lbs"])
    }

    func testMissingLabelsRebuiltAndValidLegacyLabelsParsedExactly() throws {
        let data = try json(#"[{"name":"A","setsData":[{"reps":8,"weight":27.5}]},{"name":"B","sets":["8×27.5lbs"," 4.5×30.25lbs "]}]"#)
        let result = SessionNormalizer.normalize(data)
        XCTAssertEqual(result.exercises[0].sets[0].label, "8×27.5lbs")
        XCTAssertEqual(result.exercises[1].sets[1].label, "4.5×30.25lbs")
        XCTAssertEqual(try result.validatedExercises()[1].setsData[1].weight, Decimal(string: "30.25"))
        XCTAssertTrue(result.issues.contains { $0.reason == .legacyLabel })
    }

    func testMalformedSetNumbersRemainUnknownAndCannotBeResavedAsZero() throws {
        let data = try json(#"[{"name":"Bench","sets":["8×100lbs","9×150lbs","8×200lbs"],"setsData":[{"reps":"8bad","weight":"27.5lbs"},{"reps":true,"weight":null},{"reps":-2,"weight":"Infinity"}]}]"#)
        let result = SessionNormalizer.normalize(data)
        XCTAssertEqual(result.exercises[0].sets.count, 3)
        for set in result.exercises[0].sets { XCTAssertNil(set.reps); XCTAssertNil(set.weight) }
        XCTAssertEqual(result.exercises[0].sets[0].label, "—")
        XCTAssertEqual(result.exercises[0].sets[0].originalLabel, "8×100lbs")
        XCTAssertEqual(result.issues.filter { $0.reason == .invalidSet }.count, 3)
        XCTAssertThrowsError(try result.validatedExercises())
    }

    func testLegacyGarbageNeverBecomesSavedZeros() throws {
        let data = try json(#"[{"name":"Bench","sets":["hello","8x135lbs","8×135lbs junk",null,{}]}]"#)
        let result = SessionNormalizer.normalize(data)
        XCTAssertEqual(result.exercises[0].sets.count, 5)
        XCTAssertTrue(result.exercises[0].sets.allSatisfy { $0.reps == nil && $0.weight == nil })
        XCTAssertThrowsError(try result.validatedExercises())
    }

    func testMissingAndMalformedArraysDoNotCrashOrSilentlyPassWriteValidation() throws {
        for value in [nil, JSONValue.null, .object([:]), .string("bad")] {
            let result = SessionNormalizer.normalize(value)
            XCTAssertTrue(result.exercises.isEmpty)
            XCTAssertFalse(result.issues.isEmpty)
            XCTAssertThrowsError(try result.validatedExercises())
        }
        let result = SessionNormalizer.normalize(try json(#"[null,42,[],{"name":"No arrays"},{"name":"Bad data","setsData":{},"sets":["8×100lbs"]},{"setsData":[]}]"#))
        XCTAssertEqual(result.exercises.count, 3)
        XCTAssertTrue(result.exercises[0].sets.isEmpty)
        XCTAssertTrue(result.exercises[1].sets.isEmpty)
        XCTAssertNil(result.exercises[2].name)
        XCTAssertTrue(result.issues.contains { $0.reason == .invalidExercise })
        XCTAssertThrowsError(try result.validatedExercises())
    }

    func testValidNumericStringsAreStrictlyParsedWithoutBinaryRounding() throws {
        let result = SessionNormalizer.normalize(try json(#"[{"name":"Bench","setsData":[{"reps":"8.5","weight":"27.50"},{"reps":"1e1","weight":"3.23e1"}]}]"#))
        XCTAssertEqual(result.exercises[0].sets.map(\.label), ["8.5×27.5lbs", "10×32.3lbs"])
        XCTAssertNoThrow(try result.validatedExercises())
    }

    func testValidExerciseNamesAreNotRenamedAndDuplicateNamesStaySeparate() throws {
        let result = SessionNormalizer.normalize(try json(#"[{"name":" Bench ","setsData":[]},{"name":" Bench ","setsData":[]}]"#))
        XCTAssertEqual(result.exercises.map(\.name), [" Bench ", " Bench "])
        XCTAssertNotEqual(result.exercises[0].id, result.exercises[1].id)
        XCTAssertEqual(try result.validatedExercises().count, 2)
    }

    func testEmptySuccessfulExercisesRemainARealEmptyResult() throws {
        let result = SessionNormalizer.normalize(.array([]))
        XCTAssertTrue(result.exercises.isEmpty)
        XCTAssertTrue(result.issues.isEmpty)
        XCTAssertEqual(try result.validatedExercises(), [])
    }

    func testPlanDuplicateAndMissingIDsAreDistinctDeterministicAndCollisionSafe() throws {
        let raw = try json(#"[{"id":"same","name":"A","sets":[]},{"id":"same","name":"B","sets":[]},{"name":"C","sets":[]},{"id":"plan-exercise-2","name":"D","sets":[]},{"id":7,"name":"E","sets":[]}]"#)
        let first = PlanNormalizer.normalize(raw)
        let second = PlanNormalizer.normalize(raw)
        XCTAssertEqual(first, second)
        XCTAssertEqual(first.exercises.map(\.id), ["same", "plan-exercise-1", "plan-exercise-2-local", "plan-exercise-2", "7"])
        XCTAssertEqual(Set(first.exercises.map(\.id)).count, 5)
        XCTAssertEqual(first.issues.filter { $0.reason == .duplicateID }.count, 1)
        XCTAssertEqual(first.exercises[2].source, raw.array![2])
        let writes = try first.validatedExercises()
        XCTAssertEqual(writes[0].id, .string("same"))
        XCTAssertEqual(writes[1].id, .string("same"))
        XCTAssertNil(writes[2].id)
        XCTAssertEqual(writes[4].id, .number(7))
    }

    func testPlanReadPreservesTrainerMetadataAndFractionalTargets() throws {
        let raw = try json(#"[{"name":"Bench","trainer_metadata":{"origin":"assignment"},"sets":[{"reps":8.5,"weight":27.5,"rest_seconds":90}]}]"#)
        let normalized = PlanNormalizer.normalize(raw)
        XCTAssertEqual(normalized.exercises[0].sets[0].weight, Decimal(string: "27.5"))
        XCTAssertEqual(normalized.exercises[0].source, raw.array![0])
        XCTAssertTrue(normalized.issues.isEmpty)
        let write = try XCTUnwrap(normalized.validatedExercises().first)
        XCTAssertEqual(write.additionalFields["trainer_metadata"], .object(["origin": .string("assignment")]))
        XCTAssertEqual(write.sets[0].additionalFields["rest_seconds"], .number(90))
        let encoded = try JSONEncoder().encode(write)
        let decoded = try JSONDecoder().decode(WorkoutPlanExercise.self, from: encoded)
        XCTAssertEqual(decoded, write)
        XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: encoded).object?["trainer_metadata"], .object(["origin": .string("assignment")]))
    }

    func testPlanMalformedValuesAreFlagged() throws {
        let normalized = PlanNormalizer.normalize(try json(#"[null,{"name":" ","sets":[{"reps":"8foo","weight":false}]},{"name":"Missing"}]"#))
        XCTAssertEqual(normalized.exercises.count, 2)
        XCTAssertNil(normalized.exercises[0].name)
        XCTAssertNil(normalized.exercises[0].sets[0].reps)
        XCTAssertNil(normalized.exercises[0].sets[0].weight)
        XCTAssertTrue(normalized.issues.contains { $0.reason == .invalidSet })
        XCTAssertTrue(normalized.issues.contains { $0.reason == .missingArray })
        XCTAssertThrowsError(try normalized.validatedExercises())
    }

    func testTypedPlanAndSessionWritesValidateWithoutPersistingPRFlags() throws {
        XCTAssertThrowsError(try WorkoutPlanSet(reps: 8, weight: 100, done: true).validate())
        XCTAssertThrowsError(try SessionExerciseWrite(name: " ", setsData: []).validate())
        XCTAssertThrowsError(try WorkoutSetData(reps: 8, weight: .nan).validate())
        try WorkoutPlanExercise(name: "Bench", sets: [.init(reps: Decimal(string: "8.5")!, weight: Decimal(string: "27.5")!)]).validate()
    }
}

final class LivePRModelsTests: XCTestCase {
    private func exercise(_ name: String, _ weights: [(Decimal, Bool)]) -> LiveWorkoutExercise {
        .init(name: name, sets: weights.map { .init(done: $0.1, actualReps: 8, actualWeight: $0.0) })
    }

    func testOnlyStrictImprovementOverExistingPositiveBaselineCounts() throws {
        let exercises = [exercise("First", [(100, true)]), exercise("Tie", [(100, true)]), exercise("Zero", [(0, true)]), exercise("Improved", [(Decimal(string: "27.5")!, true)])]
        let records = try LivePRs.compute(exercises: exercises, bests: ["Tie": 100, "Zero": 0, "Improved": 25])
        XCTAssertEqual(records.map(\.name), ["Improved"])
        XCTAssertEqual(records[0].weightLbs, Decimal(string: "27.5"))
        XCTAssertEqual(records[0].previousBestLbs, 25)
    }

    func testFinalEditsAndUntickingRemovePreviouslyPossiblePR() throws {
        var live = exercise("Bench", [(105, true), (200, false)])
        XCTAssertEqual(try LivePRs.compute(exercises: [live], bests: ["Bench": 100]).count, 1)
        live.sets[0].actualWeight = 95
        XCTAssertTrue(try LivePRs.compute(exercises: [live], bests: ["Bench": 100]).isEmpty)
        live.sets[0].actualWeight = 105
        live.sets[0].done = false
        XCTAssertTrue(try LivePRs.compute(exercises: [live], bests: ["Bench": 100]).isEmpty)
    }

    func testDuplicateExerciseNamesProduceOneHighestPRInFirstSeenOrder() throws {
        let live = [exercise("Bench", [(105, true)]), exercise("Squat", [(205, true)]), exercise("Bench", [(110, true)])]
        let records = try LivePRs.compute(exercises: live, bests: ["Bench": 100, "Squat": 200])
        XCTAssertEqual(records.map(\.name), ["Bench", "Squat"])
        XCTAssertEqual(records[0].weightLbs, 110)
    }

    func testMissingOrInvalidCompletedNumbersBlockEvaluationButUntickedDraftMayBeEmpty() throws {
        var draft = LiveWorkoutExercise(name: "Bench", sets: [.init(done: false, actualReps: nil, actualWeight: nil)])
        XCTAssertTrue(try LivePRs.compute(exercises: [draft], bests: ["Bench": 100]).isEmpty)
        draft.sets[0].done = true
        XCTAssertThrowsError(try LivePRs.compute(exercises: [draft], bests: ["Bench": 100]))
        draft.sets[0].actualReps = 8
        draft.sets[0].actualWeight = .nan
        XCTAssertThrowsError(try LivePRs.compute(exercises: [draft], bests: ["Bench": 100]))
        XCTAssertThrowsError(try LivePRs.compute(exercises: [], bests: ["Bench": -1]))
    }

    func testBaselineRowsRejectNullsDuplicatesAndDifferentAccount() throws {
        let owner = UUID()
        let baseline = ExerciseBestRow(userID: owner, name: "Bench", bestLbs: 100)
        let live = [exercise("Bench", [(105, true)])]
        XCTAssertEqual(try LivePRs.compute(exercises: live, bests: [baseline], userID: owner).count, 1)
        XCTAssertThrowsError(try LivePRs.compute(exercises: live, bests: [baseline, baseline], userID: owner))
        XCTAssertThrowsError(try LivePRs.compute(exercises: live, bests: [baseline], userID: UUID()))
        XCTAssertThrowsError(try LivePRs.compute(exercises: live, bests: [ExerciseBestRow(userID: owner, name: "Bench")], userID: owner))
    }
}
