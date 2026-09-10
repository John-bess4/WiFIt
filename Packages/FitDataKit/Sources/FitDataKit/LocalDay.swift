import Foundation

/// A Gregorian database date, independent of locale, user calendar and UTC day.
/// All *_date fields use this scalar; timestamps stay Date until deliberately
/// converted with the user's timezone at the instant an action is performed.
public struct LocalDay: Codable, Hashable, Comparable, Sendable, CustomStringConvertible {
    public enum ValidationError: Error, Equatable, Sendable {
        case invalidDate(String)
        case timestampOutsideSupportedRange
    }

    public let year: Int
    public let month: Int
    public let day: Int

    public var rawValue: String {
        String(format: "%04d-%02d-%02d", locale: Locale(identifier: "en_US_POSIX"), year, month, day)
    }

    public var description: String { rawValue }

    public init(_ rawValue: String) throws {
        let bytes = Array(rawValue.utf8)
        guard bytes.count == 10, bytes[4] == 45, bytes[7] == 45,
              bytes.enumerated().allSatisfy({ index, byte in
                  index == 4 || index == 7 || (48...57).contains(byte)
              }),
              let year = Int(rawValue.prefix(4)),
              let month = Int(rawValue.dropFirst(5).prefix(2)),
              let day = Int(rawValue.suffix(2)) else {
            throw ValidationError.invalidDate(rawValue)
        }
        try self.init(year: year, month: month, day: day)
    }

    public init(year: Int, month: Int, day: Int) throws {
        let leap = year.isMultiple(of: 4) && (!year.isMultiple(of: 100) || year.isMultiple(of: 400))
        let monthLengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        guard (1...9999).contains(year), (1...12).contains(month),
              (1...monthLengths[month - 1]).contains(day) else {
            throw ValidationError.invalidDate(String(year) + "-" + String(month) + "-" + String(day))
        }
        self.year = year
        self.month = month
        self.day = day
    }

    public init(date: Date, timeZone: TimeZone = .current) throws {
        guard date.timeIntervalSinceReferenceDate.isFinite else {
            throw ValidationError.timestampOutsideSupportedRange
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.era, .year, .month, .day], from: date)
        guard components.era == 1, let year = components.year, let month = components.month,
              let day = components.day, (1...9999).contains(year) else {
            throw ValidationError.timestampOutsideSupportedRange
        }
        try self.init(year: year, month: month, day: day)
    }

    public static func < (lhs: LocalDay, rhs: LocalDay) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        do { try self.init(value) }
        catch {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Expected a valid Gregorian YYYY-MM-DD date.")
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}
