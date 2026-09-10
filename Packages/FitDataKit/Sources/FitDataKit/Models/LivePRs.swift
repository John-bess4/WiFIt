import Foundation

public struct LiveWorkoutSet: Sendable, Equatable {
    public var done: Bool
    public var actualReps: Decimal?
    public var actualWeight: Decimal?

    public init(done: Bool, actualReps: Decimal?, actualWeight: Decimal?) {
        self.done = done; self.actualReps = actualReps; self.actualWeight = actualWeight
    }
}

public struct LiveWorkoutExercise: Sendable, Equatable {
    public var name: String
    public var sets: [LiveWorkoutSet]
    public init(name: String, sets: [LiveWorkoutSet]) { self.name = name; self.sets = sets }
}

public struct LivePersonalRecord: Sendable, Equatable {
    public let name: String
    public let weightLbs: Decimal
    public let previousBestLbs: Decimal
}

public enum LivePRs {
    /// This is only for the current unsaved session. Persisted history always comes
    /// from exercise_pr_events; the supplied baseline must come from exercise_bests.
    /// Recompute from the final set state after every edit/toggle; never append events.
    public static func compute(exercises: [LiveWorkoutExercise], bests: [String: Decimal]) throws(DataError) -> [LivePersonalRecord] {
        for (name, best) in bests {
            try ModelValidation.nonempty(name, field: "baseline.name")
            try ModelValidation.nonnegative(best, field: "baseline.best_lbs")
        }
        var order: [String] = []
        var completedBests: [String: Decimal] = [:]
        for exercise in exercises {
            try ModelValidation.nonempty(exercise.name, field: "exercise.name")
            if completedBests[exercise.name] == nil { order.append(exercise.name); completedBests[exercise.name] = 0 }
            for set in exercise.sets where set.done {
                guard let reps = set.actualReps, let weight = set.actualWeight else { throw .invalidInput("A completed set needs reps and weight before evaluating PRs") }
                try ModelValidation.nonnegative(reps, field: "actualReps")
                try ModelValidation.nonnegative(weight, field: "actualWeight")
                completedBests[exercise.name] = max(completedBests[exercise.name] ?? 0, weight)
            }
        }
        return order.compactMap { name in
            guard let weight = completedBests[name], let best = bests[name], best > 0, weight > 0, weight > best else { return nil }
            return LivePersonalRecord(name: name, weightLbs: weight, previousBestLbs: best)
        }
    }

    /// Row conversion fails closed for a malformed baseline or mixed ownership.
    /// An empty *successful* baseline is legal; a failed fetch must never call this.
    public static func compute(exercises: [LiveWorkoutExercise], bests: [ExerciseBestRow], userID: UUID) throws(DataError) -> [LivePersonalRecord] {
        var baseline: [String: Decimal] = [:]
        for row in bests {
            guard row.userID == userID, let name = row.name, let best = row.bestLbs else { throw .invalidInput("Malformed or mismatched exercise_bests row") }
            guard baseline[name] == nil else { throw .invalidInput("Duplicate exercise_bests row") }
            baseline[name] = best
        }
        return try compute(exercises: exercises, bests: baseline)
    }
}
