import XCTest
import FitDataKit
@testable import WiFitAppCore

final class ProfileCompletionTests: XCTestCase {
    private let userID = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!

    private func completeProfile() -> ProfileRow {
        ProfileRow(id: userID, name: "Alex", age: 30, weightLbs: 200, heightIn: 70,
            activityLevel: "bmr", goal: "old-goal-is-preserved", calGoal: 2100,
            proteinGoal: 125, carbsGoal: 230, fatGoal: 61, theme: "aurora_dark",
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z",
            gender: "male", bmr: 1900, tdee: 2500, goalRate: "lose_2")
    }

    private func filledNewDraft() -> ProfileCompletionDraft {
        var draft = ProfileCompletionDraft(original: nil)
        draft.name = " Alex "
        draft.age = "30"
        draft.weightLbs = "200"
        draft.heightIn = "70"
        draft.gender = "male"
        draft.activityLevel = "bmr"
        draft.goalRate = "lose_2"
        return draft
    }

    private func object<T: Encodable>(_ value: T) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any])
    }

    func testMissingProfileStartsWithNoInventedMeasurementsOrSelections() {
        let draft = ProfileCompletionDraft(original: nil)
        XCTAssertEqual([draft.name, draft.age, draft.weightLbs, draft.heightIn, draft.gender,
                        draft.activityLevel, draft.goalRate, draft.calGoal, draft.proteinGoal,
                        draft.carbsGoal, draft.fatGoal], Array(repeating: "", count: 11))
        XCTAssertFalse(draft.recalculateEstimates)
        XCTAssertThrowsError(try draft.buildCreate(userID: userID))
    }

    func testExistingPartialValuesArePresentedExactlyAndOnlyNameIsPatched() throws {
        var row = completeProfile()
        row.name = nil
        row.weightLbs = Decimal(string: "200.125")
        let draftBefore = ProfileCompletionDraft(original: row)
        XCTAssertEqual(draftBefore.name, "")
        XCTAssertEqual(draftBefore.weightLbs, "200.125")
        XCTAssertEqual(draftBefore.calGoal, "2100")
        var draft = draftBefore
        draft.name = " Taylor "
        let json = try object(draft.buildPatch(userID: userID))
        XCTAssertEqual(Set(json.keys), ["name"])
        XCTAssertEqual(json["name"] as? String, "Taylor")
        XCTAssertFalse(json.values.contains { $0 is NSNull })
        for field in ["id", "theme", "goal", "created_at", "updated_at", "cal_goal", "bmr", "tdee"] {
            XCTAssertNil(json[field], field)
        }
    }

    func testUnchangedCompleteProfileProducesEmptyPatch() throws {
        XCTAssertTrue(try object(ProfileCompletionDraft(original: completeProfile()).buildPatch(userID: userID)).isEmpty)
    }

    func testOpeningFormDoesNotNormalizeUneditedSavedName() throws {
        var row = completeProfile()
        row.name = " Alex "
        XCTAssertTrue(try object(ProfileCompletionDraft(original: row).buildPatch(userID: userID)).isEmpty)
    }

    func testNewProfileHasKnownFormulaResultsAndPastelTheme() throws {
        let write = try filledNewDraft().buildCreate(userID: userID)
        // Frozen JS reference case, not expectations recomputed by BodyMetrics.
        XCTAssertEqual(write.id, userID)
        XCTAssertEqual(write.name, "Alex")
        XCTAssertEqual(write.bmr, 1987)
        XCTAssertEqual(write.tdee, 1987)
        XCTAssertEqual(write.calGoal, 1200)
        XCTAssertEqual(write.proteinGoal, 164)
        XCTAssertEqual(write.carbsGoal, 62)
        XCTAssertEqual(write.fatGoal, 33)
        XCTAssertEqual(write.theme, "pastel_light")
        let json = try object(write)
        XCTAssertNil(json["goal"])
        XCTAssertNil(json["created_at"])
    }

    func testNewDraftCannotPatchAndExistingDraftCannotCreateOrChangeOwner() {
        XCTAssertThrowsError(try filledNewDraft().buildPatch(userID: userID))
        let existing = ProfileCompletionDraft(original: completeProfile())
        XCTAssertThrowsError(try existing.buildCreate(userID: userID))
        XCTAssertThrowsError(try existing.buildPatch(userID: UUID()))
    }

    func testInvalidMeasurementsAndIntegerFieldsFailBeforeAnyWrite() {
        for bad in ["", "0", "-1", "nan", "NaN", "inf", "1e309", "12 lb", "1,200", "1.2.3", ".", "１２"] {
            var draft = filledNewDraft()
            draft.weightLbs = bad
            XCTAssertThrowsError(try draft.buildCreate(userID: userID), bad)
            draft = filledNewDraft()
            draft.heightIn = bad
            XCTAssertThrowsError(try draft.buildCreate(userID: userID), bad)
        }
        for bad in ["", "0", "-2", "30.5", "2147483648", "NaN", "３０"] {
            var draft = filledNewDraft()
            draft.age = bad
            XCTAssertThrowsError(try draft.buildCreate(userID: userID), bad)
        }
    }

    func testDecimalMeasurementIsNotTruncatedAndWhitespaceIsTrimmed() throws {
        var draft = filledNewDraft()
        draft.weightLbs = " 180.125 "
        draft.heightIn = " 65.5 "
        let value = try draft.buildCreate(userID: userID)
        XCTAssertEqual(value.weightLbs, Decimal(string: "180.125"))
        XCTAssertEqual(value.heightIn, Decimal(string: "65.5"))
    }

    func testUnknownExistingSelectionsSurviveCompletionWithoutFallbacks() throws {
        var row = completeProfile()
        row.name = nil
        row.gender = "new-equation-v2"
        row.activityLevel = "trained_v2"
        row.goalRate = "trainer_defined"
        row.bmr = nil
        row.tdee = nil
        var draft = ProfileCompletionDraft(original: row)
        draft.name = "Alex"
        XCTAssertEqual(try object(draft.buildPatch(userID: userID)).keys.sorted(), ["name"])
        row.name = "Alex"
        XCTAssertTrue(ProfileCompletionDraft.isComplete(row))
        draft.recalculateEstimates = true
        XCTAssertThrowsError(try draft.buildPatch(userID: userID))
    }

    func testNewOrEditedUnknownIDsNeverUseLegacySilentFallback() {
        let fields: [WritableKeyPath<ProfileCompletionDraft, String>] = [\.gender, \.activityLevel, \.goalRate]
        for field in fields {
            var fresh = filledNewDraft()
            fresh[keyPath: field] = "unknown"
            XCTAssertThrowsError(try fresh.buildCreate(userID: userID))
            var existing = ProfileCompletionDraft(original: completeProfile())
            existing[keyPath: field] = "unknown"
            XCTAssertThrowsError(try existing.buildPatch(userID: userID))
        }
    }

    func testUnknownStoredSelectionsCannotInventMissingTargets() {
        var row = completeProfile()
        row.gender = "new-equation-v2"
        row.calGoal = nil
        let draft = ProfileCompletionDraft(original: row)
        XCTAssertThrowsError(try draft.buildPatch(userID: userID))
    }

    func testRecalculationUpdatesEstimatesButPreservesEverySavedTarget() throws {
        var draft = ProfileCompletionDraft(original: completeProfile())
        draft.recalculateEstimates = true
        let json = try object(draft.buildPatch(userID: userID))
        XCTAssertEqual(Set(json.keys), ["bmr", "tdee"])
        XCTAssertEqual(json["bmr"] as? Int, 1987)
        XCTAssertEqual(json["tdee"] as? Int, 1987)
    }

    func testMeasurementEditDoesNotImplicitlyReplaceExistingEstimatesOrTargets() throws {
        var draft = ProfileCompletionDraft(original: completeProfile())
        draft.weightLbs = "185.5"
        let json = try object(draft.buildPatch(userID: userID))
        XCTAssertEqual(Set(json.keys), ["weight_lbs"])
    }

    func testMissingMacrosUsePreservedCalorieTargetInsteadOfFormulaCalorieTarget() throws {
        var row = completeProfile()
        row.proteinGoal = nil
        row.carbsGoal = nil
        row.fatGoal = nil
        let json = try object(ProfileCompletionDraft(original: row).buildPatch(userID: userID))
        XCTAssertEqual(Set(json.keys), ["protein_goal", "carbs_goal", "fat_goal"])
        XCTAssertEqual(json["protein_goal"] as? Int, 164)
        XCTAssertEqual(json["fat_goal"] as? Int, 58)
        XCTAssertEqual(json["carbs_goal"] as? Int, 231)
        XCTAssertNil(json["cal_goal"])
    }

    func testOnlyMissingEstimateIsFilledAndSavedEstimateIsPreserved() throws {
        var row = completeProfile()
        row.bmr = nil
        let json = try object(ProfileCompletionDraft(original: row).buildPatch(userID: userID))
        XCTAssertEqual(Set(json.keys), ["bmr"])
        XCTAssertEqual(json["bmr"] as? Int, 1987)
    }

    func testExplicitGoalEditIsNarrowAndExistingGoalCannotBeCleared() throws {
        var draft = ProfileCompletionDraft(original: completeProfile())
        draft.calGoal = "2300"
        draft.proteinGoal = "0"
        let json = try object(draft.buildPatch(userID: userID))
        XCTAssertEqual(Set(json.keys), ["cal_goal", "protein_goal"])
        XCTAssertEqual(json["cal_goal"] as? Int, 2300)
        XCTAssertEqual(json["protein_goal"] as? Int, 0)
        draft.calGoal = ""
        XCTAssertThrowsError(try draft.buildPatch(userID: userID))
    }

    func testInvalidTargetsRequireDeliberateCorrection() throws {
        var row = completeProfile()
        row.calGoal = 0
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        var draft = ProfileCompletionDraft(original: row)
        XCTAssertThrowsError(try draft.buildPatch(userID: userID))
        draft.calGoal = "2100"
        XCTAssertEqual(try object(draft.buildPatch(userID: userID)).keys.sorted(), ["cal_goal"])
        for bad in ["-1", "1.5", "2147483648", "nan"] {
            draft.proteinGoal = bad
            XCTAssertThrowsError(try draft.buildPatch(userID: userID), bad)
        }
    }

    func testCompletionGateChecksActualSavedRequiredFields() {
        XCTAssertTrue(ProfileCompletionDraft.isComplete(completeProfile()))
        var row = completeProfile()
        row.name = " \n "
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.age = 0
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.weightLbs = .nan
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.heightIn = 0
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.gender = nil
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.activityLevel = ""
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.goalRate = nil
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.fatGoal = nil
        XCTAssertFalse(ProfileCompletionDraft.isComplete(row))
        row = completeProfile(); row.bmr = nil; row.tdee = nil; row.theme = nil
        XCTAssertTrue(ProfileCompletionDraft.isComplete(row))
    }

    func testRebaseRetainsOnlyUserEditsAndPreservesConcurrentServerChanges() {
        let original = completeProfile()
        var draft = ProfileCompletionDraft(original: original)
        draft.name = "Taylor"
        draft.weightLbs = "185.5"
        draft.recalculateEstimates = true
        var latest = original
        latest.name = "Server name"
        latest.age = 31
        latest.calGoal = 2450
        latest.theme = "cyber_dark"
        let rebased = draft.rebased(on: latest)
        XCTAssertEqual(rebased.original, latest)
        XCTAssertEqual(rebased.name, "Taylor")
        XCTAssertEqual(rebased.weightLbs, "185.5")
        XCTAssertEqual(rebased.age, "31")
        XCTAssertEqual(rebased.calGoal, "2450")
        XCTAssertTrue(rebased.recalculateEstimates)
    }

    func testMissingProfileDraftRebasesWithoutErasingConcurrentlyCreatedTargets() {
        let draft = filledNewDraft()
        let latest = completeProfile()
        let rebased = draft.rebased(on: latest)
        XCTAssertEqual(rebased.calGoal, "2100")
        XCTAssertEqual(rebased.proteinGoal, "125")
        XCTAssertEqual(rebased.name, " Alex ")
        XCTAssertEqual(rebased.original, latest)
    }

    func testRebaseCannotCarryEditsIntoDifferentExistingAccount() {
        var draft = ProfileCompletionDraft(original: completeProfile())
        draft.name = "Private edited name"
        draft.recalculateEstimates = true
        var another = completeProfile()
        another.id = UUID()
        another.name = "Other account"
        let rebased = draft.rebased(on: another)
        XCTAssertEqual(rebased, ProfileCompletionDraft(original: another))
    }
}
