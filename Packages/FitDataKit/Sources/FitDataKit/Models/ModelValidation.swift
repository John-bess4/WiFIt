import Foundation

// Validation describes known write contracts; it is not a substitute for RLS or
// server constraints. A read preserves nulls and legacy data for explicit repair.
enum ModelValidation {
    static func nonempty(_ value: String, field: String) throws(DataError) {
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw .invalidInput(field + " is required") }
    }
    static func nonnegative(_ value: Decimal?, field: String) throws(DataError) {
        guard let value else { return }
        guard !value.isNaN, value >= 0 else { throw .invalidInput(field + " must be finite and nonnegative") }
    }
    static func positive(_ value: Decimal?, field: String) throws(DataError) {
        guard let value else { return }
        guard !value.isNaN, value > 0 else { throw .invalidInput(field + " must be finite and positive") }
    }
    static func nonnegative(_ value: Int?, field: String) throws(DataError) {
        guard let value else { return }
        guard value >= 0 else { throw .invalidInput(field + " must be nonnegative") }
    }
    static func reminderTime(_ value: String) throws(DataError) {
        guard value.range(of: #"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$"#, options: .regularExpression) != nil else { throw .invalidInput("reminder_time must be HH:mm") }
    }
}

public extension FoodLogRow {
    var nutrients: Nutrients {
        Nutrients(cal: per100Cal, protein: per100Protein, carbs: per100Carbs, fat: per100Fat,
                  fiber: per100Fiber, sugar: per100Sugar, sodium: per100Sodium)
    }
    var portion: FoodPortion { FoodPortion(grams: grams, per100: nutrients) }
}

public extension CustomFoodRow {
    var nutrients: Nutrients {
        Nutrients(cal: per100Cal, protein: per100Protein, carbs: per100Carbs, fat: per100Fat,
                  fiber: per100Fiber, sugar: per100Sugar, sodium: per100Sodium)
    }
}

public extension WorkoutPlanWrite {
    /// Start an edit from its saved row so assignment ownership and trainer JSON
    /// metadata survive. Use row.id as the PATCH filter; this payload omits id.
    init(editing row: WorkoutPlanRow) throws(DataError) {
        self.init(userID: row.userID, name: row.name, tag: row.tag, level: row.level,
                  estMin: row.estMin, scheduledDay: row.scheduledDay,
                  exercises: try row.normalized.validatedExercises(), sortOrder: row.sortOrder,
                  trainerAssignmentID: row.trainerAssignmentID)
        try validate()
    }
}

public extension WorkoutSessionWrite {
    /// Start an edit from its saved row to preserve the optional TrainerHQ origin.
    /// Unknown numbers or counters require explicit repair, never a zero fallback.
    init(editing row: WorkoutSessionRow) throws(DataError) {
        self.init(userID: row.userID, workoutName: row.workoutName, completedDate: row.completedDate,
                  durationSecs: row.durationSecs, setsCompleted: row.setsCompleted, totalSets: row.totalSets,
                  exercises: try row.normalized.validatedExercises(), trainerAssignmentID: row.trainerAssignmentID)
        try validate()
    }
}
