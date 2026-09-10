import Foundation

// Inserts omit id so the server returns the authoritative UUID. A caller must adopt
// that returned identity and must not blindly retry an ambiguous network failure.
// Composite-key upserts also omit id, preserving the existing row's surrogate UUID.
// These are complete writable values. Do not construct a partial settings update
// with nil fields: use a narrow PATCH DTO so unrelated saved data stays intact.

public struct ProfileWrite: DatabaseWrite, Codable, Sendable, Equatable {
    public var id: UUID
    public var name: String?
    public var age: Int?
    public var weightLbs: Decimal?
    public var heightIn: Decimal?
    public var activityLevel: String?
    public var calGoal: Int?
    public var proteinGoal: Int?
    public var carbsGoal: Int?
    public var fatGoal: Int?
    public var theme: String?
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
        calGoal: Int? = nil,
        proteinGoal: Int? = nil,
        carbsGoal: Int? = nil,
        fatGoal: Int? = nil,
        theme: String? = nil,
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
        self.calGoal = calGoal
        self.proteinGoal = proteinGoal
        self.carbsGoal = carbsGoal
        self.fatGoal = fatGoal
        self.theme = theme
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
        case calGoal = "cal_goal"
        case proteinGoal = "protein_goal"
        case carbsGoal = "carbs_goal"
        case fatGoal = "fat_goal"
        case theme
        case gender
        case bmr
        case tdee
        case goalRate = "goal_rate"
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(age, forKey: .age)
        try container.encode(weightLbs, forKey: .weightLbs)
        try container.encode(heightIn, forKey: .heightIn)
        try container.encode(activityLevel, forKey: .activityLevel)
        try container.encode(calGoal, forKey: .calGoal)
        try container.encode(proteinGoal, forKey: .proteinGoal)
        try container.encode(carbsGoal, forKey: .carbsGoal)
        try container.encode(fatGoal, forKey: .fatGoal)
        try container.encode(theme, forKey: .theme)
        try container.encode(gender, forKey: .gender)
        try container.encode(bmr, forKey: .bmr)
        try container.encode(tdee, forKey: .tdee)
        try container.encode(goalRate, forKey: .goalRate)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonnegative(age, field: "age")
        try ModelValidation.positive(weightLbs, field: "weight_lbs")
        try ModelValidation.positive(heightIn, field: "height_in")
        try ModelValidation.nonnegative(calGoal, field: "cal_goal")
        try ModelValidation.nonnegative(proteinGoal, field: "protein_goal")
        try ModelValidation.nonnegative(carbsGoal, field: "carbs_goal")
        try ModelValidation.nonnegative(fatGoal, field: "fat_goal")
        try ModelValidation.nonnegative(bmr, field: "bmr")
        try ModelValidation.nonnegative(tdee, field: "tdee")
    }
}

public struct FoodLogWrite: DatabaseWrite, Codable, Sendable, Equatable {
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

    public init(
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
        color: String? = nil
    ) {
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
    }

    enum CodingKeys: String, CodingKey {
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
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(loggedDate, forKey: .loggedDate)
        try container.encode(mealSlot, forKey: .mealSlot)
        try container.encode(foodName, forKey: .foodName)
        try container.encode(brand, forKey: .brand)
        try container.encode(grams, forKey: .grams)
        try container.encode(per100Cal, forKey: .per100Cal)
        try container.encode(per100Protein, forKey: .per100Protein)
        try container.encode(per100Carbs, forKey: .per100Carbs)
        try container.encode(per100Fat, forKey: .per100Fat)
        try container.encode(per100Fiber, forKey: .per100Fiber)
        try container.encode(per100Sugar, forKey: .per100Sugar)
        try container.encode(per100Sodium, forKey: .per100Sodium)
        try container.encode(color, forKey: .color)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonempty(mealSlot, field: "meal_slot")
        try ModelValidation.nonempty(foodName, field: "food_name")
        try ModelValidation.positive(grams, field: "grams")
        try ModelValidation.nonnegative(per100Cal, field: "per100_cal")
        try ModelValidation.nonnegative(per100Protein, field: "per100_protein")
        try ModelValidation.nonnegative(per100Carbs, field: "per100_carbs")
        try ModelValidation.nonnegative(per100Fat, field: "per100_fat")
        try ModelValidation.nonnegative(per100Fiber, field: "per100_fiber")
        try ModelValidation.nonnegative(per100Sugar, field: "per100_sugar")
        try ModelValidation.nonnegative(per100Sodium, field: "per100_sodium")
        guard ["breakfast", "lunch", "dinner", "snacks"].contains(mealSlot) else { throw .invalidInput("Unknown meal_slot") }
    }
}

public struct CustomFoodWrite: DatabaseWrite, Codable, Sendable, Equatable {
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
    public var servingQty: Decimal?
    public var servingUnit: String?

    public init(
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
        servingQty: Decimal? = nil,
        servingUnit: String? = nil
    ) {
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
        self.servingQty = servingQty
        self.servingUnit = servingUnit
    }

    enum CodingKeys: String, CodingKey {
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
        case servingQty = "serving_qty"
        case servingUnit = "serving_unit"
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(name, forKey: .name)
        try container.encode(brand, forKey: .brand)
        try container.encode(servingG, forKey: .servingG)
        try container.encode(per100Cal, forKey: .per100Cal)
        try container.encode(per100Protein, forKey: .per100Protein)
        try container.encode(per100Carbs, forKey: .per100Carbs)
        try container.encode(per100Fat, forKey: .per100Fat)
        try container.encode(per100Fiber, forKey: .per100Fiber)
        try container.encode(per100Sugar, forKey: .per100Sugar)
        try container.encode(per100Sodium, forKey: .per100Sodium)
        try container.encode(servingQty, forKey: .servingQty)
        try container.encode(servingUnit, forKey: .servingUnit)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonempty(name, field: "name")
        try ModelValidation.positive(servingG, field: "serving_g")
        try ModelValidation.nonnegative(per100Cal, field: "per100_cal")
        try ModelValidation.nonnegative(per100Protein, field: "per100_protein")
        try ModelValidation.nonnegative(per100Carbs, field: "per100_carbs")
        try ModelValidation.nonnegative(per100Fat, field: "per100_fat")
        try ModelValidation.nonnegative(per100Fiber, field: "per100_fiber")
        try ModelValidation.nonnegative(per100Sugar, field: "per100_sugar")
        try ModelValidation.nonnegative(per100Sodium, field: "per100_sodium")
        try ModelValidation.positive(servingQty, field: "serving_qty")
    }
}

public struct WorkoutSessionWrite: DatabaseWrite, Codable, Sendable, Equatable {
    public var userID: UUID
    public var workoutName: String
    public var completedDate: LocalDay
    public var durationSecs: Int?
    public var setsCompleted: Int?
    public var totalSets: Int?
    public var exercises: [SessionExerciseWrite]
    public var trainerAssignmentID: UUID?

    public init(
        userID: UUID,
        workoutName: String,
        completedDate: LocalDay,
        durationSecs: Int? = nil,
        setsCompleted: Int? = nil,
        totalSets: Int? = nil,
        exercises: [SessionExerciseWrite],
        trainerAssignmentID: UUID? = nil
    ) {
        self.userID = userID
        self.workoutName = workoutName
        self.completedDate = completedDate
        self.durationSecs = durationSecs
        self.setsCompleted = setsCompleted
        self.totalSets = totalSets
        self.exercises = exercises
        self.trainerAssignmentID = trainerAssignmentID
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case workoutName = "workout_name"
        case completedDate = "completed_date"
        case durationSecs = "duration_secs"
        case setsCompleted = "sets_completed"
        case totalSets = "total_sets"
        case exercises
        case trainerAssignmentID = "trainer_assignment_id"
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(workoutName, forKey: .workoutName)
        try container.encode(completedDate, forKey: .completedDate)
        try container.encode(durationSecs, forKey: .durationSecs)
        try container.encode(setsCompleted, forKey: .setsCompleted)
        try container.encode(totalSets, forKey: .totalSets)
        try container.encode(exercises, forKey: .exercises)
        try container.encode(trainerAssignmentID, forKey: .trainerAssignmentID)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonempty(workoutName, field: "workout_name")
        try ModelValidation.nonnegative(durationSecs, field: "duration_secs")
        try ModelValidation.nonnegative(setsCompleted, field: "sets_completed")
        try ModelValidation.nonnegative(totalSets, field: "total_sets")
        for exercise in exercises { try exercise.validate() }
        let completedCount = exercises.reduce(0) { $0 + $1.setsData.count }
        guard setsCompleted == completedCount, let totalSets, totalSets >= completedCount else { throw .invalidInput("Session set counts must match saved completed sets") }
    }
}

public struct WorkoutPlanWrite: DatabaseWrite, Codable, Sendable, Equatable {
    public var userID: UUID
    public var name: String
    public var tag: String?
    public var level: String?
    public var estMin: Int?
    public var scheduledDay: String?
    public var exercises: [WorkoutPlanExercise]
    public var sortOrder: Int?
    public var trainerAssignmentID: UUID?

    public init(
        userID: UUID,
        name: String,
        tag: String? = nil,
        level: String? = nil,
        estMin: Int? = nil,
        scheduledDay: String? = nil,
        exercises: [WorkoutPlanExercise],
        sortOrder: Int? = nil,
        trainerAssignmentID: UUID? = nil
    ) {
        self.userID = userID
        self.name = name
        self.tag = tag
        self.level = level
        self.estMin = estMin
        self.scheduledDay = scheduledDay
        self.exercises = exercises
        self.sortOrder = sortOrder
        self.trainerAssignmentID = trainerAssignmentID
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case name
        case tag
        case level
        case estMin = "est_min"
        case scheduledDay = "scheduled_day"
        case exercises
        case sortOrder = "sort_order"
        case trainerAssignmentID = "trainer_assignment_id"
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(name, forKey: .name)
        try container.encode(tag, forKey: .tag)
        try container.encode(level, forKey: .level)
        try container.encode(estMin, forKey: .estMin)
        try container.encode(scheduledDay, forKey: .scheduledDay)
        try container.encode(exercises, forKey: .exercises)
        try container.encode(sortOrder, forKey: .sortOrder)
        try container.encode(trainerAssignmentID, forKey: .trainerAssignmentID)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonempty(name, field: "name")
        try ModelValidation.nonnegative(estMin, field: "est_min")
        try ModelValidation.nonnegative(sortOrder, field: "sort_order")
        for exercise in exercises { try exercise.validate() }
    }
}

public struct SupplementStackWrite: DatabaseWrite, Codable, Sendable, Equatable {
    public var userID: UUID
    public var name: String
    public var sub: String?
    public var dotColor: String?
    public var reminderTime: String?
    public var reminderEnabled: Bool?
    public var sortOrder: Int?
    public var category: SupplementCategory?
    public var note: String?

    public init(
        userID: UUID,
        name: String,
        sub: String? = nil,
        dotColor: String? = nil,
        reminderTime: String? = nil,
        reminderEnabled: Bool? = nil,
        sortOrder: Int? = nil,
        category: SupplementCategory? = nil,
        note: String? = nil
    ) {
        self.userID = userID
        self.name = name
        self.sub = sub
        self.dotColor = dotColor
        self.reminderTime = reminderTime
        self.reminderEnabled = reminderEnabled
        self.sortOrder = sortOrder
        self.category = category
        self.note = note
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case name
        case sub
        case dotColor = "dot_color"
        case reminderTime = "reminder_time"
        case reminderEnabled = "reminder_enabled"
        case sortOrder = "sort_order"
        case category
        case note
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(name, forKey: .name)
        try container.encode(sub, forKey: .sub)
        try container.encode(dotColor, forKey: .dotColor)
        try container.encode(reminderTime, forKey: .reminderTime)
        try container.encode(reminderEnabled, forKey: .reminderEnabled)
        try container.encode(sortOrder, forKey: .sortOrder)
        try container.encode(category, forKey: .category)
        try container.encode(note, forKey: .note)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonempty(name, field: "name")
        try ModelValidation.nonnegative(sortOrder, field: "sort_order")
        if let reminderTime { try ModelValidation.reminderTime(reminderTime) }
        if reminderEnabled == true && reminderTime == nil { throw .invalidInput("Enabled reminder requires reminder_time") }
    }
}

public struct SupplementLogWrite: DatabaseWrite, Codable, Sendable, Equatable {
    public var userID: UUID
    public var supplementID: UUID
    public var logDate: LocalDay
    public var taken: Bool?

    public init(
        userID: UUID,
        supplementID: UUID,
        logDate: LocalDay,
        taken: Bool? = nil
    ) {
        self.userID = userID
        self.supplementID = supplementID
        self.logDate = logDate
        self.taken = taken
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case supplementID = "supplement_id"
        case logDate = "log_date"
        case taken
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(supplementID, forKey: .supplementID)
        try container.encode(logDate, forKey: .logDate)
        try container.encode(taken, forKey: .taken)
    }

    public func validate() throws(DataError) {
    }
}

public struct WaterLogWrite: DatabaseWrite, Codable, Sendable, Equatable {
    public var userID: UUID
    public var logDate: LocalDay
    public var oz: Int

    public init(
        userID: UUID,
        logDate: LocalDay,
        oz: Int
    ) {
        self.userID = userID
        self.logDate = logDate
        self.oz = oz
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case logDate = "log_date"
        case oz
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(logDate, forKey: .logDate)
        try container.encode(oz, forKey: .oz)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonnegative(oz, field: "oz")
    }
}

public struct BodyWeightLogWrite: DatabaseWrite, Codable, Sendable, Equatable {
    public var userID: UUID
    public var weightLbs: Decimal
    public var logDate: LocalDay
    public var note: String?

    public init(
        userID: UUID,
        weightLbs: Decimal,
        logDate: LocalDay,
        note: String? = nil
    ) {
        self.userID = userID
        self.weightLbs = weightLbs
        self.logDate = logDate
        self.note = note
    }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case weightLbs = "weight_lbs"
        case logDate = "log_date"
        case note
    }

    /// Full writable value: nil is encoded as JSON null. Use a narrow PATCH for partial edits.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(userID, forKey: .userID)
        try container.encode(weightLbs, forKey: .weightLbs)
        try container.encode(logDate, forKey: .logDate)
        try container.encode(note, forKey: .note)
    }

    public func validate() throws(DataError) {
        try ModelValidation.positive(weightLbs, field: "weight_lbs")
    }
}

