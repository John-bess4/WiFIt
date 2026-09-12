import Foundation

// Exact public WiFit columns verified against information_schema on 2026-09-10.
// Unknown JSONB is retained for read-boundary normalization, never silently erased.
// Timestamps preserve their wire string; local-day columns use strict LocalDay.
// View values retain SQL metadata nullability: callers must not turn missing values into zero.
// Legacy workout_sessions.prs and water_log.cups are never written. ai_coach_usage is read-only.

public struct ProfileRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var name: String?
    public var age: Int?
    public var weightLbs: Decimal?
    public var heightIn: Decimal?
    public var activityLevel: String?
    public var goal: String?
    public var calGoal: Int?
    public var proteinGoal: Int?
    public var carbsGoal: Int?
    public var fatGoal: Int?
    public var theme: String?
    public var createdAt: String?
    public var updatedAt: String?
    public var gender: String?
    public var bmr: Decimal?
    public var tdee: Decimal?
    public var goalRate: String?

    public init(
        id: UUID,
        name: String? = nil,
        age: Int? = nil,
        weightLbs: Decimal? = nil,
        heightIn: Decimal? = nil,
        activityLevel: String? = nil,
        goal: String? = nil,
        calGoal: Int? = nil,
        proteinGoal: Int? = nil,
        carbsGoal: Int? = nil,
        fatGoal: Int? = nil,
        theme: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        gender: String? = nil,
        bmr: Decimal? = nil,
        tdee: Decimal? = nil,
        goalRate: String? = nil
    ) {
        self.id = id
        self.name = name
        self.age = age
        self.weightLbs = weightLbs
        self.heightIn = heightIn
        self.activityLevel = activityLevel
        self.goal = goal
        self.calGoal = calGoal
        self.proteinGoal = proteinGoal
        self.carbsGoal = carbsGoal
        self.fatGoal = fatGoal
        self.theme = theme
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.gender = gender
        self.bmr = bmr
        self.tdee = tdee
        self.goalRate = goalRate
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case age
        case weightLbs = "weight_lbs"
        case heightIn = "height_in"
        case activityLevel = "activity_level"
        case goal
        case calGoal = "cal_goal"
        case proteinGoal = "protein_goal"
        case carbsGoal = "carbs_goal"
        case fatGoal = "fat_goal"
        case theme
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case gender
        case bmr
        case tdee
        case goalRate = "goal_rate"
    }
}

public struct FoodLogRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var loggedDate: LocalDay
    public var mealSlot: String
    public var foodName: String
    public var brand: String?
    public var grams: Decimal
    public var per100Cal: Decimal?
    public var per100Protein: Decimal?
    public var per100Carbs: Decimal?
    public var per100Fat: Decimal?
    public var per100Fiber: Decimal?
    public var per100Sugar: Decimal?
    public var per100Sodium: Decimal?
    public var color: String?
    public var createdAt: String?

    public init(
        id: UUID,
        userID: UUID,
        loggedDate: LocalDay,
        mealSlot: String,
        foodName: String,
        brand: String? = nil,
        grams: Decimal,
        per100Cal: Decimal? = nil,
        per100Protein: Decimal? = nil,
        per100Carbs: Decimal? = nil,
        per100Fat: Decimal? = nil,
        per100Fiber: Decimal? = nil,
        per100Sugar: Decimal? = nil,
        per100Sodium: Decimal? = nil,
        color: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.userID = userID
        self.loggedDate = loggedDate
        self.mealSlot = mealSlot
        self.foodName = foodName
        self.brand = brand
        self.grams = grams
        self.per100Cal = per100Cal
        self.per100Protein = per100Protein
        self.per100Carbs = per100Carbs
        self.per100Fat = per100Fat
        self.per100Fiber = per100Fiber
        self.per100Sugar = per100Sugar
        self.per100Sodium = per100Sodium
        self.color = color
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case loggedDate = "logged_date"
        case mealSlot = "meal_slot"
        case foodName = "food_name"
        case brand
        case grams
        case per100Cal = "per100_cal"
        case per100Protein = "per100_protein"
        case per100Carbs = "per100_carbs"
        case per100Fat = "per100_fat"
        case per100Fiber = "per100_fiber"
        case per100Sugar = "per100_sugar"
        case per100Sodium = "per100_sodium"
        case color
        case createdAt = "created_at"
    }
}

public struct CustomFoodRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var name: String
    public var brand: String?
    public var servingG: Decimal?
    public var per100Cal: Decimal?
    public var per100Protein: Decimal?
    public var per100Carbs: Decimal?
    public var per100Fat: Decimal?
    public var per100Fiber: Decimal?
    public var per100Sugar: Decimal?
    public var per100Sodium: Decimal?
    public var createdAt: String?
    public var servingQty: Decimal?
    public var servingUnit: String?

    public init(
        id: UUID,
        userID: UUID,
        name: String,
        brand: String? = nil,
        servingG: Decimal? = nil,
        per100Cal: Decimal? = nil,
        per100Protein: Decimal? = nil,
        per100Carbs: Decimal? = nil,
        per100Fat: Decimal? = nil,
        per100Fiber: Decimal? = nil,
        per100Sugar: Decimal? = nil,
        per100Sodium: Decimal? = nil,
        createdAt: String? = nil,
        servingQty: Decimal? = nil,
        servingUnit: String? = nil
    ) {
        self.id = id
        self.userID = userID
        self.name = name
        self.brand = brand
        self.servingG = servingG
        self.per100Cal = per100Cal
        self.per100Protein = per100Protein
        self.per100Carbs = per100Carbs
        self.per100Fat = per100Fat
        self.per100Fiber = per100Fiber
        self.per100Sugar = per100Sugar
        self.per100Sodium = per100Sodium
        self.createdAt = createdAt
        self.servingQty = servingQty
        self.servingUnit = servingUnit
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name
        case brand
        case servingG = "serving_g"
        case per100Cal = "per100_cal"
        case per100Protein = "per100_protein"
        case per100Carbs = "per100_carbs"
        case per100Fat = "per100_fat"
        case per100Fiber = "per100_fiber"
        case per100Sugar = "per100_sugar"
        case per100Sodium = "per100_sodium"
        case createdAt = "created_at"
        case servingQty = "serving_qty"
        case servingUnit = "serving_unit"
    }
}

public struct WorkoutSessionRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var workoutName: String
    public var completedDate: LocalDay
    public var durationSecs: Int?
    public var setsCompleted: Int?
    public var totalSets: Int?
    public var exercises: JSONValue?
    public var createdAt: String?
    public var trainerAssignmentID: UUID?

    public init(
        id: UUID,
        userID: UUID,
        workoutName: String,
        completedDate: LocalDay,
        durationSecs: Int? = nil,
        setsCompleted: Int? = nil,
        totalSets: Int? = nil,
        exercises: JSONValue? = nil,
        createdAt: String? = nil,
        trainerAssignmentID: UUID? = nil
    ) {
        self.id = id
        self.userID = userID
        self.workoutName = workoutName
        self.completedDate = completedDate
        self.durationSecs = durationSecs
        self.setsCompleted = setsCompleted
        self.totalSets = totalSets
        self.exercises = exercises
        self.createdAt = createdAt
        self.trainerAssignmentID = trainerAssignmentID
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case workoutName = "workout_name"
        case completedDate = "completed_date"
        case durationSecs = "duration_secs"
        case setsCompleted = "sets_completed"
        case totalSets = "total_sets"
        case exercises
        case createdAt = "created_at"
        case trainerAssignmentID = "trainer_assignment_id"
    }
}

public struct WorkoutPlanRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var name: String
    public var tag: String?
    public var level: String?
    public var estMin: Int?
    public var scheduledDay: String?
    public var exercises: JSONValue
    public var sortOrder: Int?
    public var createdAt: String?
    public var trainerAssignmentID: UUID?

    public init(
        id: UUID,
        userID: UUID,
        name: String,
        tag: String? = nil,
        level: String? = nil,
        estMin: Int? = nil,
        scheduledDay: String? = nil,
        exercises: JSONValue,
        sortOrder: Int? = nil,
        createdAt: String? = nil,
        trainerAssignmentID: UUID? = nil
    ) {
        self.id = id
        self.userID = userID
        self.name = name
        self.tag = tag
        self.level = level
        self.estMin = estMin
        self.scheduledDay = scheduledDay
        self.exercises = exercises
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.trainerAssignmentID = trainerAssignmentID
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name
        case tag
        case level
        case estMin = "est_min"
        case scheduledDay = "scheduled_day"
        case exercises
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case trainerAssignmentID = "trainer_assignment_id"
    }
}

public struct SupplementStackRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var name: String
    public var sub: String?
    public var dotColor: String?
    public var reminderTime: String?
    public var reminderEnabled: Bool?
    public var sortOrder: Int?
    public var createdAt: String?
    public var category: String?
    public var note: String?

    public init(
        id: UUID,
        userID: UUID,
        name: String,
        sub: String? = nil,
        dotColor: String? = nil,
        reminderTime: String? = nil,
        reminderEnabled: Bool? = nil,
        sortOrder: Int? = nil,
        createdAt: String? = nil,
        category: String? = nil,
        note: String? = nil
    ) {
        self.id = id
        self.userID = userID
        self.name = name
        self.sub = sub
        self.dotColor = dotColor
        self.reminderTime = reminderTime
        self.reminderEnabled = reminderEnabled
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.category = category
        self.note = note
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name
        case sub
        case dotColor = "dot_color"
        case reminderTime = "reminder_time"
        case reminderEnabled = "reminder_enabled"
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case category
        case note
    }
}

public struct SupplementLogRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var supplementID: UUID
    public var logDate: LocalDay
    public var taken: Bool?
    public var createdAt: String?

    public init(
        id: UUID,
        userID: UUID,
        supplementID: UUID,
        logDate: LocalDay,
        taken: Bool? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.userID = userID
        self.supplementID = supplementID
        self.logDate = logDate
        self.taken = taken
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case supplementID = "supplement_id"
        case logDate = "log_date"
        case taken
        case createdAt = "created_at"
    }
}

public struct WaterLogRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var logDate: LocalDay
    public var cups: Int?
    public var createdAt: String?
    public var oz: Int

    public init(
        id: UUID,
        userID: UUID,
        logDate: LocalDay,
        cups: Int? = nil,
        createdAt: String? = nil,
        oz: Int
    ) {
        self.id = id
        self.userID = userID
        self.logDate = logDate
        self.cups = cups
        self.createdAt = createdAt
        self.oz = oz
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case logDate = "log_date"
        case cups
        case createdAt = "created_at"
        case oz
    }
}

public struct BodyWeightLogRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var weightLbs: Decimal
    public var logDate: LocalDay
    public var note: String?
    public var createdAt: String?

    public init(
        id: UUID,
        userID: UUID,
        weightLbs: Decimal,
        logDate: LocalDay,
        note: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.userID = userID
        self.weightLbs = weightLbs
        self.logDate = logDate
        self.note = note
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case weightLbs = "weight_lbs"
        case logDate = "log_date"
        case note
        case createdAt = "created_at"
    }
}

public struct AICoachUsageRow: Codable, Sendable, Equatable {
    public var id: UUID
    public var userID: UUID
    public var createdAt: String

    public init(
        id: UUID,
        userID: UUID,
        createdAt: String
    ) {
        self.id = id
        self.userID = userID
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case createdAt = "created_at"
    }
}

public struct ExerciseBestRow: Codable, Sendable, Equatable {
    public var userID: UUID?
    public var name: String?
    public var bestLbs: Decimal?

    public init(
        userID: UUID? = nil,
        name: String? = nil,
        bestLbs: Decimal? = nil
    ) {
        self.userID = userID
        self.name = name
        self.bestLbs = bestLbs
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case name
        case bestLbs = "best_lbs"
    }
}

public struct ExercisePREventRow: Codable, Sendable, Equatable {
    public var userID: UUID?
    public var sessionID: UUID?
    public var completedDate: LocalDay?
    public var name: String?
    public var lbs: Decimal?
    public var prevBest: Decimal?

    public init(
        userID: UUID? = nil,
        sessionID: UUID? = nil,
        completedDate: LocalDay? = nil,
        name: String? = nil,
        lbs: Decimal? = nil,
        prevBest: Decimal? = nil
    ) {
        self.userID = userID
        self.sessionID = sessionID
        self.completedDate = completedDate
        self.name = name
        self.lbs = lbs
        self.prevBest = prevBest
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case sessionID = "session_id"
        case completedDate = "completed_date"
        case name
        case lbs
        case prevBest = "prev_best"
    }
}

public struct DailySummaryRow: Codable, Sendable, Equatable {
    public var userID: UUID?
    public var day: LocalDay?
    public var kcal: Int?
    public var proteinG: Int?
    public var carbsG: Int?
    public var fatG: Int?
    public var foodRows: Int?
    public var workoutCount: Int?
    public var workoutNames: String?
    public var suppsTaken: Int?
    public var suppsDue: Int?
    public var weightLbs: Decimal?

    public init(
        userID: UUID? = nil,
        day: LocalDay? = nil,
        kcal: Int? = nil,
        proteinG: Int? = nil,
        carbsG: Int? = nil,
        fatG: Int? = nil,
        foodRows: Int? = nil,
        workoutCount: Int? = nil,
        workoutNames: String? = nil,
        suppsTaken: Int? = nil,
        suppsDue: Int? = nil,
        weightLbs: Decimal? = nil
    ) {
        self.userID = userID
        self.day = day
        self.kcal = kcal
        self.proteinG = proteinG
        self.carbsG = carbsG
        self.fatG = fatG
        self.foodRows = foodRows
        self.workoutCount = workoutCount
        self.workoutNames = workoutNames
        self.suppsTaken = suppsTaken
        self.suppsDue = suppsDue
        self.weightLbs = weightLbs
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case day
        case kcal
        case proteinG = "protein_g"
        case carbsG = "carbs_g"
        case fatG = "fat_g"
        case foodRows = "food_rows"
        case workoutCount = "workout_count"
        case workoutNames = "workout_names"
        case suppsTaken = "supps_taken"
        case suppsDue = "supps_due"
        case weightLbs = "weight_lbs"
    }
}

public struct SupplementDueFromRow: Codable, Sendable, Equatable {
    public var userID: UUID?
    public var supplementID: UUID?
    public var name: String?
    public var dueFrom: LocalDay?

    public init(
        userID: UUID? = nil,
        supplementID: UUID? = nil,
        name: String? = nil,
        dueFrom: LocalDay? = nil
    ) {
        self.userID = userID
        self.supplementID = supplementID
        self.name = name
        self.dueFrom = dueFrom
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case supplementID = "supplement_id"
        case name
        case dueFrom = "due_from"
    }
}

public struct WeightMonthlyRow: Codable, Sendable, Equatable {
    public var userID: UUID?
    public var month: String?
    public var firstLbs: Decimal?
    public var lastLbs: Decimal?
    public var entries: Int?

    public init(
        userID: UUID? = nil,
        month: String? = nil,
        firstLbs: Decimal? = nil,
        lastLbs: Decimal? = nil,
        entries: Int? = nil
    ) {
        self.userID = userID
        self.month = month
        self.firstLbs = firstLbs
        self.lastLbs = lastLbs
        self.entries = entries
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case month
        case firstLbs = "first_lbs"
        case lastLbs = "last_lbs"
        case entries
    }
}

