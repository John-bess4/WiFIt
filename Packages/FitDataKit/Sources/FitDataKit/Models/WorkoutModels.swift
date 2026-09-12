import Foundation

/// Lossless JSONB representation. Decimal decoding never takes a Double detour.
public enum JSONValue: Codable, Sendable, Equatable {
    case object([String: JSONValue])
    case array([JSONValue])
    case string(String)
    case number(Decimal)
    case bool(Bool)
    case null

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Decimal.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else { self = .object(try container.decode([String: JSONValue].self)) }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var object: [String: JSONValue]? { if case .object(let value) = self { value } else { nil } }
    var array: [JSONValue]? { if case .array(let value) = self { value } else { nil } }
    var string: String? { if case .string(let value) = self { value } else { nil } }
    var decimal: Decimal? {
        let value: Decimal?
        switch self {
        case .number(let number): value = number
        case .string(let string):
            // Decimal(string:) alone accepts prefixes (e.g. "27lbs"). Full-match first.
            let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
            guard trimmed.range(of: #"^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$"#, options: .regularExpression) != nil else { return nil }
            value = Decimal(string: trimmed, locale: Locale(identifier: "en_US_POSIX"))
        default: value = nil
        }
        guard let value, !value.isNaN, value >= 0 else { return nil }
        return value
    }
}

public enum SupplementCategory: String, Codable, Sendable, CaseIterable {
    case protein, vitamin, mineral, performance, health, sleep
    case fatBurner = "fat_burner"
    case probiotic
}

/// Structured saved values, authoritative to the database PR views.
public struct WorkoutSetData: Codable, Sendable, Equatable {
    public var reps: Decimal
    public var weight: Decimal

    public init(reps: Decimal, weight: Decimal) { self.reps = reps; self.weight = weight }
    public var label: String { decimalLabel(reps) + "×" + decimalLabel(weight) + "lbs" }

    public func validate() throws(DataError) {
        try ModelValidation.nonnegative(reps, field: "reps")
        try ModelValidation.nonnegative(weight, field: "weight")
    }
}

/// A saved exercise encodes both labels and structured data from the same values.
/// Callers cannot supply stale labels or persisted PR flags.
public struct SessionExerciseWrite: Codable, Sendable, Equatable {
    public var name: String
    public var setsData: [WorkoutSetData]
    public var sets: [String] { setsData.map(\.label) }

    public init(name: String, setsData: [WorkoutSetData]) { self.name = name; self.setsData = setsData }
    enum CodingKeys: String, CodingKey { case name, sets, setsData }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        setsData = try container.decode([WorkoutSetData].self, forKey: .setsData)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(sets, forKey: .sets)
        try container.encode(setsData, forKey: .setsData)
    }

    public func validate() throws(DataError) {
        try ModelValidation.nonempty(name, field: "exercise.name")
        for set in setsData { try set.validate() }
    }
}

private struct JSONKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init(_ value: String) { stringValue = value }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

public struct WorkoutPlanSet: Codable, Sendable, Equatable {
    public var reps: Decimal
    public var weight: Decimal
    public var done: Bool
    /// Unknown assignment metadata is retained on edits, not discarded by Codable.
    public var additionalFields: [String: JSONValue]

    public init(reps: Decimal, weight: Decimal, done: Bool = false, additionalFields: [String: JSONValue] = [:]) {
        self.reps = reps; self.weight = weight; self.done = done; self.additionalFields = additionalFields
    }
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: JSONKey.self)
        reps = try container.decode(Decimal.self, forKey: JSONKey("reps"))
        weight = try container.decode(Decimal.self, forKey: JSONKey("weight"))
        done = try container.decodeIfPresent(Bool.self, forKey: JSONKey("done")) ?? false
        additionalFields = [:]
        for key in container.allKeys where !["reps", "weight", "done"].contains(key.stringValue) {
            additionalFields[key.stringValue] = try container.decode(JSONValue.self, forKey: key)
        }
    }
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: JSONKey.self)
        for (key, value) in additionalFields where !["reps", "weight", "done"].contains(key) {
            try container.encode(value, forKey: JSONKey(key))
        }
        try container.encode(reps, forKey: JSONKey("reps"))
        try container.encode(weight, forKey: JSONKey("weight"))
        try container.encode(done, forKey: JSONKey("done"))
    }
    public func validate() throws(DataError) {
        try ModelValidation.nonnegative(reps, field: "plan.reps")
        try ModelValidation.nonnegative(weight, field: "plan.weight")
        guard !done else { throw .invalidInput("A saved plan cannot contain completed sets") }
        guard Set(additionalFields.keys).isDisjoint(with: ["reps", "weight", "done"]) else { throw .invalidInput("Plan metadata cannot override set values") }
    }
}

public struct WorkoutPlanExercise: Codable, Sendable, Equatable {
    /// JSON exercise identifiers may be legacy strings or numbers; they are not row UUIDs.
    public var id: JSONValue?
    public var name: String
    public var sets: [WorkoutPlanSet]
    public var additionalFields: [String: JSONValue]

    public init(id: JSONValue? = nil, name: String, sets: [WorkoutPlanSet], additionalFields: [String: JSONValue] = [:]) {
        self.id = id; self.name = name; self.sets = sets; self.additionalFields = additionalFields
    }
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: JSONKey.self)
        id = try container.decodeIfPresent(JSONValue.self, forKey: JSONKey("id"))
        name = try container.decode(String.self, forKey: JSONKey("name"))
        sets = try container.decode([WorkoutPlanSet].self, forKey: JSONKey("sets"))
        additionalFields = [:]
        for key in container.allKeys where !["id", "name", "sets"].contains(key.stringValue) {
            additionalFields[key.stringValue] = try container.decode(JSONValue.self, forKey: key)
        }
    }
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: JSONKey.self)
        for (key, value) in additionalFields where !["id", "name", "sets"].contains(key) {
            try container.encode(value, forKey: JSONKey(key))
        }
        try container.encodeIfPresent(id, forKey: JSONKey("id"))
        try container.encode(name, forKey: JSONKey("name"))
        try container.encode(sets, forKey: JSONKey("sets"))
    }
    public func validate() throws(DataError) {
        try ModelValidation.nonempty(name, field: "plan.exercise.name")
        switch id {
        case nil, .null, .string: break
        case .number(let number) where !number.isNaN: break
        default: throw .invalidInput("Plan exercise id must be a string or number")
        }
        guard Set(additionalFields.keys).isDisjoint(with: ["id", "name", "sets"]) else { throw .invalidInput("Plan metadata cannot override exercise values") }
        for set in sets { try set.validate() }
    }
}

public struct NormalizationIssue: Sendable, Equatable {
    public enum Reason: String, Sendable { case missingArray, invalidArray, invalidExercise, missingName, invalidSet, legacyLabel, rebuiltLabels, duplicateID }
    public let path: String
    public let reason: Reason
}

/// A missing numeric value stays nil. Its display placeholder must never become a saved zero.
public struct NormalizedSessionSet: Sendable, Equatable {
    public let reps: Decimal?
    public let weight: Decimal?
    public let originalLabel: String?
    public var label: String {
        guard let reps, let weight else { return "—" }
        return WorkoutSetData(reps: reps, weight: weight).label
    }
}

public struct NormalizedSessionExercise: Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String?
    public let sets: [NormalizedSessionSet]
}

public struct NormalizedSession: Sendable, Equatable {
    public let exercises: [NormalizedSessionExercise]
    public let issues: [NormalizationIssue]

    /// Reject a damaged set rather than silently writing a fabricated number.
    public func validatedExercises() throws(DataError) -> [SessionExerciseWrite] {
        // Dropped non-object entries or a malformed array need explicit user repair too.
        guard !issues.contains(where: { [.invalidArray, .invalidExercise, .missingArray].contains($0.reason) }) else {
            throw .invalidInput("Session structure needs repair before saving")
        }
        var result: [SessionExerciseWrite] = []
        for exercise in exercises {
            guard let savedName = exercise.name else { throw .invalidInput("Session exercise has no name") }
            var sets: [WorkoutSetData] = []
            for set in exercise.sets {
                guard let reps = set.reps, let weight = set.weight else { throw .invalidInput("Session set has unknown reps or weight") }
                sets.append(WorkoutSetData(reps: reps, weight: weight))
            }
            result.append(SessionExerciseWrite(name: savedName, setsData: sets))
        }
        return result
    }
}

public enum SessionNormalizer {
    public static func normalize(_ raw: JSONValue?) -> NormalizedSession {
        var issues: [NormalizationIssue] = []
        guard let values = raw?.array else {
            return NormalizedSession(exercises: [], issues: [.init(path: "exercises", reason: raw == nil || raw == .null ? .missingArray : .invalidArray)])
        }
        var exercises: [NormalizedSessionExercise] = []
        for (index, value) in values.enumerated() {
            let path = "exercises[" + String(index) + "]"
            guard let object = value.object else { issues.append(.init(path: path, reason: .invalidExercise)); continue }
            let name = nonemptyName(object["name"])
            if name == nil { issues.append(.init(path: path + ".name", reason: .missingName)) }
            let labels = object["sets"]?.array
            var sets: [NormalizedSessionSet] = []
            if let structured = object["setsData"], structured != .null {
                if let data = structured.array {
                    for (setIndex, rawSet) in data.enumerated() {
                        let values = rawSet.object
                        let reps = values?["reps"]?.decimal
                        let weight = values?["weight"]?.decimal
                        let originalLabel = labels.flatMap { $0.indices.contains(setIndex) ? $0[setIndex].string : nil }
                        if reps == nil || weight == nil { issues.append(.init(path: path + ".setsData[" + String(setIndex) + "]", reason: .invalidSet)) }
                        let set = NormalizedSessionSet(reps: reps, weight: weight, originalLabel: originalLabel)
                        sets.append(set)
                        if originalLabel != set.label { issues.append(.init(path: path + ".sets[" + String(setIndex) + "]", reason: .rebuiltLabels)) }
                    }
                    if labels?.count != data.count { issues.append(.init(path: path + ".sets", reason: .rebuiltLabels)) }
                } else { issues.append(.init(path: path + ".setsData", reason: .invalidArray)) }
            } else if let labels {
                for (setIndex, rawLabel) in labels.enumerated() {
                    let original = rawLabel.string
                    let parsed = original.flatMap(parseLabel)
                    sets.append(.init(reps: parsed?.reps, weight: parsed?.weight, originalLabel: original))
                    issues.append(.init(path: path + ".sets[" + String(setIndex) + "]", reason: parsed == nil ? .invalidSet : .legacyLabel))
                }
            } else {
                issues.append(.init(path: path + ".sets", reason: object["sets"] == nil || object["sets"] == .null ? .missingArray : .invalidArray))
            }
            exercises.append(.init(id: "session-exercise-" + String(index), name: name, sets: sets))
        }
        return NormalizedSession(exercises: exercises, issues: issues)
    }

    public static func parseLabel(_ label: String) -> WorkoutSetData? {
        let value = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.range(of: #"^[0-9]+(?:\.[0-9]+)?×[0-9]+(?:\.[0-9]+)?lbs$"#, options: .regularExpression) != nil else { return nil }
        let parts = String(value.dropLast(3)).split(separator: "×")
        guard parts.count == 2, let reps = JSONValue.string(String(parts[0])).decimal, let weight = JSONValue.string(String(parts[1])).decimal else { return nil }
        return WorkoutSetData(reps: reps, weight: weight)
    }
}

public struct NormalizedPlanExercise: Sendable, Equatable, Identifiable {
    /// Stable display identity only. It never replaces a saved database UUID.
    public let id: String
    public let name: String?
    public let sets: [NormalizedSessionSet]
    /// Preserve the complete source, including TrainerHQ-specific JSON fields.
    public let source: JSONValue
}

public struct NormalizedPlan: Sendable, Equatable {
    public let exercises: [NormalizedPlanExercise]
    public let issues: [NormalizationIssue]

    /// Keeps the original saved IDs and unknown trainer metadata. Generated display
    /// IDs stay local, and damaged values require repair rather than numeric defaults.
    public func validatedExercises() throws(DataError) -> [WorkoutPlanExercise] {
        guard !issues.contains(where: { $0.reason != .duplicateID }) else { throw .invalidInput("Plan needs repair before saving") }
        var result: [WorkoutPlanExercise] = []
        for exercise in exercises {
            guard let name = exercise.name, let source = exercise.source.object, let sourceSets = source["sets"]?.array else {
                throw .invalidInput("Plan exercise needs repair before saving")
            }
            var sets: [WorkoutPlanSet] = []
            for (index, set) in exercise.sets.enumerated() {
                guard let reps = set.reps, let weight = set.weight, let original = sourceSets[index].object else {
                    throw .invalidInput("Plan set has unknown reps or weight")
                }
                let done: Bool
                switch original["done"] {
                case nil, .null: done = false
                case .bool(let value): done = value
                default: throw .invalidInput("Plan set done flag needs repair")
                }
                sets.append(.init(reps: reps, weight: weight, done: done,
                                  additionalFields: original.filter { !["reps", "weight", "done"].contains($0.key) }))
            }
            let value = WorkoutPlanExercise(id: source["id"], name: name, sets: sets,
                                             additionalFields: source.filter { !["id", "name", "sets"].contains($0.key) })
            try value.validate()
            result.append(value)
        }
        return result
    }
}

public enum PlanNormalizer {
    public static func normalize(_ raw: JSONValue) -> NormalizedPlan {
        guard let values = raw.array else { return .init(exercises: [], issues: [.init(path: "exercises", reason: .invalidArray)]) }
        func sourceID(_ value: JSONValue?) -> String? {
            switch value {
            case .string(let string) where !string.isEmpty: return string
            case .number(let number) where !number.isNaN: return decimalLabel(number)
            default: return nil
            }
        }
        let reserved = Set(values.compactMap { sourceID($0.object?["id"]) })
        var seen = Set<String>()
        var issues: [NormalizationIssue] = []
        var exercises: [NormalizedPlanExercise] = []
        for (index, value) in values.enumerated() {
            let path = "exercises[" + String(index) + "]"
            guard let object = value.object else { issues.append(.init(path: path, reason: .invalidExercise)); continue }
            var id = sourceID(object["id"])
            if id == nil || seen.contains(id!) {
                if id != nil { issues.append(.init(path: path + ".id", reason: .duplicateID)) }
                var generated = "plan-exercise-" + String(index)
                while reserved.contains(generated) || seen.contains(generated) { generated += "-local" }
                id = generated
            }
            seen.insert(id!)
            let name = nonemptyName(object["name"])
            if name == nil { issues.append(.init(path: path + ".name", reason: .missingName)) }
            var sets: [NormalizedSessionSet] = []
            if let rawSets = object["sets"]?.array {
                for (setIndex, value) in rawSets.enumerated() {
                    let reps = value.object?["reps"]?.decimal
                    let weight = value.object?["weight"]?.decimal
                    if reps == nil || weight == nil { issues.append(.init(path: path + ".sets[" + String(setIndex) + "]", reason: .invalidSet)) }
                    sets.append(.init(reps: reps, weight: weight, originalLabel: nil))
                }
            } else { issues.append(.init(path: path + ".sets", reason: object["sets"] == nil ? .missingArray : .invalidArray)) }
            exercises.append(.init(id: id!, name: name, sets: sets, source: value))
        }
        return .init(exercises: exercises, issues: issues)
    }
}

private func nonemptyName(_ value: JSONValue?) -> String? {
    guard let name = value?.string, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
    // Preserve spelling/whitespace of valid stored names: the views group by exact name.
    return name
}

private func decimalLabel(_ value: Decimal) -> String { NSDecimalNumber(decimal: value).stringValue }

public extension WorkoutSessionRow {
    var normalized: NormalizedSession { SessionNormalizer.normalize(exercises) }
}

public extension WorkoutPlanRow {
    var normalized: NormalizedPlan { PlanNormalizer.normalize(exercises) }
}
