import Foundation
import XCTest
@testable import FitDataKit

final class LocalDayTests: XCTestCase {
    private func instant(_ text: String) -> Date {
        ISO8601DateFormatter().date(from: text)!
    }

    func testEveningSignupUsesLocalDayInsteadOfUTCPrefix() throws {
        let losAngeles = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let timestamp = instant("2026-09-10T00:30:00Z")
        XCTAssertEqual(try LocalDay(date: timestamp, timeZone: losAngeles).rawValue, "2026-09-09")
        XCTAssertEqual(try LocalDay(date: timestamp, timeZone: TimeZone(secondsFromGMT: 0)!).rawValue, "2026-09-10")
    }

    func testMidnightAndDateLineOffsets() throws {
        let losAngeles = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        XCTAssertEqual(try LocalDay(date: instant("2026-09-10T06:59:59Z"), timeZone: losAngeles).rawValue, "2026-09-09")
        XCTAssertEqual(try LocalDay(date: instant("2026-09-10T07:00:00Z"), timeZone: losAngeles).rawValue, "2026-09-10")
        let east = try XCTUnwrap(TimeZone(identifier: "Pacific/Kiritimati"))
        XCTAssertEqual(try LocalDay(date: instant("2026-12-31T10:00:00Z"), timeZone: east).rawValue, "2027-01-01")
    }

    func testSpringGapAndRepeatedAutumnHourStayOnTheSameLocalDay() throws {
        let losAngeles = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        for timestamp in ["2026-03-08T09:59:59Z", "2026-03-08T10:00:00Z"] {
            XCTAssertEqual(try LocalDay(date: instant(timestamp), timeZone: losAngeles).rawValue, "2026-03-08")
        }
        for timestamp in ["2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z"] {
            XCTAssertEqual(try LocalDay(date: instant(timestamp), timeZone: losAngeles).rawValue, "2026-11-01")
        }
        // Midnight offsets differ before and after DST; no fixed -08:00 offset.
        XCTAssertEqual(try LocalDay(date: instant("2026-11-02T07:59:59Z"), timeZone: losAngeles).rawValue, "2026-11-01")
        XCTAssertEqual(try LocalDay(date: instant("2026-11-02T08:00:00Z"), timeZone: losAngeles).rawValue, "2026-11-02")
    }

    func testStrictGregorianValidationIncludingCenturyLeapRules() throws {
        for valid in ["0001-01-01", "2000-02-29", "2024-02-29", "9999-12-31"] {
            XCTAssertEqual(try LocalDay(valid).rawValue, valid)
        }
        for invalid in ["", "2026-9-09", "2026-09-9", "2026-09-09Z", "2026-09-09 ",
                        "2026-09-09T00:00:00Z", "2026/09/09", "２０２６-０９-０９", "0000-01-01",
                        "1900-02-29", "2100-02-29", "2026-02-29", "2026-04-31", "2026-00-01",
                        "2026-13-01", "2026-01-00", "10000-01-01"] {
            XCTAssertThrowsError(try LocalDay(invalid), invalid)
        }
        XCTAssertThrowsError(try LocalDay(date: Date(timeIntervalSinceReferenceDate: .nan)))
    }

    func testWireFormatAndChronologicalComparison() throws {
        let day = try LocalDay("2026-09-09")
        let data = try JSONEncoder().encode(day)
        XCTAssertEqual(String(data: data, encoding: .utf8), "\"2026-09-09\"")
        XCTAssertEqual(try JSONDecoder().decode(LocalDay.self, from: data), day)
        XCTAssertThrowsError(try JSONDecoder().decode(LocalDay.self, from: Data("\"2026-02-30\"".utf8)))
        XCTAssertThrowsError(try JSONDecoder().decode(LocalDay.self, from: Data("20260909".utf8)))
        let sorted = try [LocalDay("2027-01-01"), LocalDay("2026-10-01"), LocalDay("2026-09-09")].sorted()
        XCTAssertEqual(sorted.map(\.rawValue), ["2026-09-09", "2026-10-01", "2027-01-01"])
        XCTAssertEqual(Set([day, try LocalDay(year: 2026, month: 9, day: 9)]).count, 1)
    }

    func testGregorianYearIsIndependentOfAlternateUserCalendar() throws {
        // A device using the Buddhist calendar must still write PostgreSQL's
        // Gregorian year, not 2569. LocalDay constructs its own Gregorian calendar.
        let bangkok = try XCTUnwrap(TimeZone(identifier: "Asia/Bangkok"))
        let timestamp = instant("2026-09-09T12:00:00Z")
        var buddhist = Calendar(identifier: .buddhist)
        buddhist.timeZone = bangkok
        XCTAssertEqual(buddhist.component(.year, from: timestamp), 2569)
        XCTAssertEqual(try LocalDay(date: timestamp, timeZone: bangkok).year, 2026)
    }
}
