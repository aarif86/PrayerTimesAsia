import XCTest
@testable import PrayerTimesAsia

/// The Hijri Calendar widget's month grid (Umm al-Qura plus the user's own days).
final class WidgetHijriGridTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Singapore")!

    private func date(_ y: Int, _ m: Int, _ d: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        return cal.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    func testRamadanMonthHasDaysEidCellAndNoCountdown() {
        let g = HijriMonthGrid(date: date(2027, 2, 20), timeZone: tz)
        XCTAssertEqual(g.month, 9)
        XCTAssertEqual(g.year, 1448)
        XCTAssertTrue((29...30).contains(g.cells.count))
        XCTAssertNotNil(g.eidAfter)
        XCTAssertNil(g.daysToRamadan)
        XCTAssertEqual(g.cells.filter(\.isToday).count, 1)
        XCTAssertEqual(g.cells.first { $0.day == 17 }?.mark, .nuzul)
        XCTAssertEqual(g.cells.first { $0.day == 25 }?.mark, .lastTen)
        XCTAssertTrue((0...6).contains(g.lead))
    }

    func testBeforeRamadanCountsTheDays() {
        let g = HijriMonthGrid(date: date(2026, 11, 28), timeZone: tz)
        XCTAssertNotEqual(g.month, 9)
        XCTAssertNil(g.eidAfter)
        let days = g.daysToRamadan ?? 0
        XCTAssertTrue((60...90).contains(days), "Ramadan 1448 is about 72 days after 28 Nov 2026, got \(days)")
    }

    func testAdjustmentShiftsTheTodayCell() {
        let plain = HijriMonthGrid(date: date(2027, 2, 20), timeZone: tz)
        let later = HijriMonthGrid(date: date(2027, 2, 20), timeZone: tz, adjustment: 1)
        let a = plain.cells.first(where: \.isToday)?.day ?? 0
        let b = later.cells.first(where: \.isToday)?.day ?? 0
        XCTAssertEqual(b, a + 1)
    }
}
