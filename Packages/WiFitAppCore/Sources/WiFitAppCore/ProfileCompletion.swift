import Foundation
import FitDataKit

/// An app-side completion form. Nil stored fields remain blank; no measurements,
/// identity selections or targets are supplied merely by opening the form.
public struct ProfileCompletionDraft: Equatable, Sendable {
    public let original: ProfileRow?
    public var name: String
    public var age: String
    public var weightLbs: String
    public var heightIn: String
    public var gender: String
    public var activityLevel: String
    public var goalRate: String
    public var calGoal: String
    public var proteinGoal: String
    public var carbsGoal: String
    public var fatGoal: String

    /// Recalculate BMR/TDEE deliberately. Saved calorie and macro targets remain
    /// unchanged unless their editable fields change; missing targets are derived.
    public var recalculateEstimates = false

    public init(original: ProfileRow?) {
        self.original = original
        name = original?.name ?? ""
        age = original?.age.map(String.init) ?? ""
        weightLbs = original?.weightLbs.map(Self.decimalText) ?? ""
        heightIn = original?.heightIn.map(Self.decimalText) ?? ""
        gender = original?.gender ?? ""
        activityLevel = original?.activityLevel ?? ""
        goalRate = original?.goalRate ?? ""
        calGoal = original?.calGoal.map(String.init) ?? ""
        proteinGoal = original?.proteinGoal.map(String.init) ?? ""
        carbsGoal = original?.carbsGoal.map(String.init) ?? ""
        fatGoal = original?.fatGoal.map(String.init) ?? ""
    }

    /// React admitted every existing row. The native gate requires identity,
    /// positive measurements and usable targets. Persisted unknown selection IDs
    /// are retained for forward compatibility, provided targets already exist.
    /// Optional BMR/TDEE estimates, theme and the vestigial `goal` are not gates.
    public static func isComplete(_ profile: ProfileRow) -> Bool {
        guard nonblank(profile.name), let age = profile.age, age > 0, age <= Int(Int32.max),
              positive(profile.weightLbs), positive(profile.heightIn),
              nonblank(profile.gender), nonblank(profile.activityLevel), nonblank(profile.goalRate),
              validTarget(profile.calGoal, minimum: 1), validTarget(profile.proteinGoal),
              validTarget(profile.carbsGoal), validTarget(profile.fatGoal) else { return false }
        return true
    }

    /// Retain actual edits after a reconciliation read without restoring stale,
    /// unedited fields over concurrent changes from the sister app or another device.
    public func rebased(on profile: ProfileRow?) -> Self {
        if let oldID = original?.id, let newID = profile?.id, oldID != newID {
            return Self(original: profile)
        }
        let baseline = Self(original: original)
        var result = Self(original: profile)
        let fields: [WritableKeyPath<Self, String>] = [
            \.name, \.age, \.weightLbs, \.heightIn, \.gender, \.activityLevel,
            \.goalRate, \.calGoal, \.proteinGoal, \.carbsGoal, \.fatGoal
        ]
        for field in fields where self[keyPath: field] != baseline[keyPath: field] {
            result[keyPath: field] = self[keyPath: field]
        }
        result.recalculateEstimates = recalculateEstimates
        return result
    }

    public func buildPatch(userID: UUID) throws(DataError) -> ProfileCompletionPatch {
        guard let original, original.id == userID else {
            throw .invalidInput("A matching, successfully loaded profile is required before updating it.")
        }
        let value = try resolved()
        let patch = ProfileCompletionPatch(
            name: value.name == original.name ? nil : value.name,
            age: value.age == original.age ? nil : value.age,
            weightLbs: value.weightLbs == original.weightLbs ? nil : value.weightLbs,
            heightIn: value.heightIn == original.heightIn ? nil : value.heightIn,
            gender: value.gender == original.gender ? nil : value.gender,
            activityLevel: value.activityLevel == original.activityLevel ? nil : value.activityLevel,
            goalRate: value.goalRate == original.goalRate ? nil : value.goalRate,
            calGoal: value.calGoal == original.calGoal ? nil : value.calGoal,
            proteinGoal: value.proteinGoal == original.proteinGoal ? nil : value.proteinGoal,
            carbsGoal: value.carbsGoal == original.carbsGoal ? nil : value.carbsGoal,
            fatGoal: value.fatGoal == original.fatGoal ? nil : value.fatGoal,
            bmr: value.bmr == original.bmr ? nil : value.bmr,
            tdee: value.tdee == original.tdee ? nil : value.tdee
        )
        try patch.validate()
        return patch
    }

    /// The coordinator must separately prove a successful missing-row read.
    /// Submit via createProfileIfMissing, whose conflict policy preserves a
    /// concurrently created profile. Never use a merge-upsert for this write.
    /// An existing-row draft cannot produce a complete write.
    public func buildCreate(userID: UUID) throws(DataError) -> ProfileWrite {
        guard original == nil else {
            throw .invalidInput("An existing profile must be updated with a partial patch.")
        }
        let value = try resolved()
        let write = ProfileWrite(
            id: userID, name: value.name, age: value.age, weightLbs: value.weightLbs,
            heightIn: value.heightIn, activityLevel: value.activityLevel,
            calGoal: value.calGoal, proteinGoal: value.proteinGoal,
            carbsGoal: value.carbsGoal, fatGoal: value.fatGoal, theme: "pastel_light",
            gender: value.gender, bmr: value.bmr, tdee: value.tdee, goalRate: value.goalRate
        )
        try write.validate()
        return write
    }

    private struct Resolved {
        var name: String
        var age: Int
        var weightLbs: Decimal
        var heightIn: Decimal
        var gender: String
        var activityLevel: String
        var goalRate: String
        var calGoal: Int
        var proteinGoal: Int
        var carbsGoal: Int
        var fatGoal: Int
        var bmr: Decimal?
        var tdee: Decimal?
    }

    private func resolved() throws(DataError) -> Resolved {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw .invalidInput("Enter your name.") }
        let cleanName = name == original?.name ? name : trimmedName
        let parsedAge = try Self.integer(age, field: "age", minimum: 1)
        let weight = try Self.measurement(weightLbs, field: "weight in pounds")
        let height = try Self.measurement(heightIn, field: "height in inches")
        let equationID = try Self.selection(gender, original: original?.gender,
            known: BodyMetrics.Equation.allCases.map(\.rawValue), field: "calculation equation")
        let activityID = try Self.selection(activityLevel, original: original?.activityLevel,
            known: BodyMetrics.Activity.allCases.map(\.rawValue), field: "activity level")
        let rateID = try Self.selection(goalRate, original: original?.goalRate,
            known: BodyMetrics.GoalRate.allCases.map(\.rawValue), field: "goal rate")

        let calories = try Self.target(calGoal, original: original?.calGoal, field: "calorie target", minimum: 1)
        let protein = try Self.target(proteinGoal, original: original?.proteinGoal, field: "protein target")
        let carbs = try Self.target(carbsGoal, original: original?.carbsGoal, field: "carbohydrate target")
        let fat = try Self.target(fatGoal, original: original?.fatGoal, field: "fat target")
        let needsTargets = calories == nil || protein == nil || carbs == nil || fat == nil
        var computed: BodyMetrics.Goals?
        var macros: BodyMetrics.Macros?
        let needsEstimates = original?.bmr == nil || original?.tdee == nil || recalculateEstimates
        if needsTargets || needsEstimates {
            if let equation = BodyMetrics.Equation(rawValue: equationID),
               let activity = BodyMetrics.Activity(rawValue: activityID),
               let rate = BodyMetrics.GoalRate(rawValue: rateID) {
                do {
                    let stats = try BodyMetrics.Stats(equation: equation,
                        weightLbs: NSDecimalNumber(decimal: weight).doubleValue,
                        heightIn: NSDecimalNumber(decimal: height).doubleValue, age: parsedAge)
                    computed = try BodyMetrics.goals(stats, activity: activity, rate: rate)
                    if let calories {
                        // A saved/custom calorie target remains the basis for missing macros.
                        macros = try BodyMetrics.macros(calories: calories, weightLbs: stats.weightLbs)
                    }
                } catch { throw .invalidInput("These measurements cannot produce supported estimates.") }
            } else if needsTargets || recalculateEstimates {
                throw .invalidInput("Choose a supported equation, activity level and goal rate to calculate estimates.")
            }
        }
        guard let finalCal = calories ?? computed?.cal,
              let finalProtein = protein ?? macros?.protein ?? computed?.protein,
              let finalCarbs = carbs ?? macros?.carbs ?? computed?.carbs,
              let finalFat = fat ?? macros?.fat ?? computed?.fat else {
            throw .invalidInput("Enter targets or choose supported calculation settings.")
        }
        let finalBMR = recalculateEstimates ? computed.map { Decimal($0.bmr) } : original?.bmr ?? computed.map { Decimal($0.bmr) }
        let finalTDEE = recalculateEstimates ? computed.map { Decimal($0.tdee) } : original?.tdee ?? computed.map { Decimal($0.tdee) }
        guard Self.validTarget(finalCal, minimum: 1), Self.validTarget(finalProtein),
              Self.validTarget(finalCarbs), Self.validTarget(finalFat),
              finalBMR.map({ !$0.isNaN && $0 >= 0 }) ?? true,
              finalTDEE.map({ !$0.isNaN && $0 >= 0 }) ?? true else {
            throw .invalidInput("These measurements or targets are outside the supported range.")
        }
        return Resolved(name: cleanName, age: parsedAge, weightLbs: weight, heightIn: height,
            gender: equationID, activityLevel: activityID, goalRate: rateID,
            calGoal: finalCal, proteinGoal: finalProtein, carbsGoal: finalCarbs, fatGoal: finalFat,
            bmr: finalBMR, tdee: finalTDEE)
    }

    private static func selection(_ raw: String, original: String?, known: [String], field: String) throws(DataError) -> String {
        guard !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw .invalidInput("Choose a " + field + ".")
        }
        // Do not rewrite a newer sister-app value merely because this build
        // does not recognize it. Selecting a replacement must be deliberate.
        if raw == original { return raw }
        guard known.contains(raw) else { throw .invalidInput("Choose a supported " + field + ".") }
        return raw
    }

    private static func integer(_ raw: String, field: String, minimum: Int) throws(DataError) -> Int {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text.allSatisfy({ $0.isASCII && $0.isNumber }),
              let value = Int(text), value >= minimum, value <= Int(Int32.max) else {
            throw .invalidInput("Enter a valid whole number for " + field + ".")
        }
        return value
    }

    private static func target(_ raw: String, original: Int?, field: String, minimum: Int = 0) throws(DataError) -> Int? {
        if raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            guard original == nil else { throw .invalidInput("Enter a replacement " + field + "; a saved target cannot be cleared here.") }
            return nil
        }
        return try integer(raw, field: field, minimum: minimum)
    }

    private static func measurement(_ raw: String, field: String) throws(DataError) -> Decimal {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.range(of: "^(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)$", options: .regularExpression) != nil,
              let value = Decimal(string: text, locale: Locale(identifier: "en_US_POSIX")),
              positive(value) else { throw .invalidInput("Enter a positive number for " + field + ".") }
        return value
    }

    private static func nonblank(_ value: String?) -> Bool {
        value.map { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } ?? false
    }

    private static func positive(_ value: Decimal?) -> Bool {
        guard let value, !value.isNaN, value > 0 else { return false }
        return NSDecimalNumber(decimal: value).doubleValue.isFinite
    }

    private static func validTarget(_ value: Int?, minimum: Int = 0) -> Bool {
        value.map { $0 >= minimum && $0 <= Int(Int32.max) } ?? false
    }

    private static func decimalText(_ value: Decimal) -> String {
        NSDecimalNumber(decimal: value).stringValue
    }
}

/// Only the draft can construct this patch. Omitted properties are absent from
/// JSON, never null, so unrelated saved fields cannot be erased by completion.
/// Identity is supplied by the authenticated request filter, not this body.
public struct ProfileCompletionPatch: DatabaseWrite, Equatable, Sendable {
    public let name: String?
    public let age: Int?
    public let weightLbs: Decimal?
    public let heightIn: Decimal?
    public let gender: String?
    public let activityLevel: String?
    public let goalRate: String?
    public let calGoal: Int?
    public let proteinGoal: Int?
    public let carbsGoal: Int?
    public let fatGoal: Int?
    public let bmr: Decimal?
    public let tdee: Decimal?

    enum CodingKeys: String, CodingKey {
        case name, age, gender, bmr, tdee
        case weightLbs = "weight_lbs", heightIn = "height_in", activityLevel = "activity_level"
        case goalRate = "goal_rate", calGoal = "cal_goal", proteinGoal = "protein_goal"
        case carbsGoal = "carbs_goal", fatGoal = "fat_goal"
    }

    public func encode(to encoder: any Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encodeIfPresent(name, forKey: .name)
        try values.encodeIfPresent(age, forKey: .age)
        try values.encodeIfPresent(weightLbs, forKey: .weightLbs)
        try values.encodeIfPresent(heightIn, forKey: .heightIn)
        try values.encodeIfPresent(gender, forKey: .gender)
        try values.encodeIfPresent(activityLevel, forKey: .activityLevel)
        try values.encodeIfPresent(goalRate, forKey: .goalRate)
        try values.encodeIfPresent(calGoal, forKey: .calGoal)
        try values.encodeIfPresent(proteinGoal, forKey: .proteinGoal)
        try values.encodeIfPresent(carbsGoal, forKey: .carbsGoal)
        try values.encodeIfPresent(fatGoal, forKey: .fatGoal)
        try values.encodeIfPresent(bmr, forKey: .bmr)
        try values.encodeIfPresent(tdee, forKey: .tdee)
    }

    public func validate() throws(DataError) {
        // Reuse the shared wire validation without encoding a full-row payload.
        try ProfileWrite(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)),
            name: name, age: age, weightLbs: weightLbs, heightIn: heightIn,
            activityLevel: activityLevel, calGoal: calGoal, proteinGoal: proteinGoal,
            carbsGoal: carbsGoal, fatGoal: fatGoal, gender: gender,
            bmr: bmr, tdee: tdee, goalRate: goalRate).validate()
    }
}
