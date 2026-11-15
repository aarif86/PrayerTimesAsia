import XCTest
@testable import PrayerTimesAsia

/// Same cases as the web and Android clock change tests: stepping a day must
/// land on the next calendar date, even across a clock change.
final class DayStepTests: XCTestCase {
    private let london = TimeZone(identifier: "Europe/London")!
    private let singapore = TimeZone(identifier: "Asia/Singapore")!

    private func at(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ min: Int, _ tz: TimeZone) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        return cal.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
    }

    private func ymdh(_ date: Date, _ tz: TimeZone) -> [Int] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        let c = cal.dateComponents([.year, .month, .day, .hour], from: date)
        return [c.year!, c.month!, c.day!, c.hour!]
    }

    func testSpringForwardNightStepsOneDateNotTwo() {
        // 23:30 on Saturday 27 March 2027; the clocks go forward that night.
        let late = at(2027, 3, 27, 23, 30, london)
        // The old way, adding 24 hours, jumps to Monday.
        XCTAssertEqual(ymdh(late.addingTimeInterval(86_400), london)[2], 29)
        XCTAssertEqual(ymdh(DayStep.noon(late, plus: 1, in: london), london), [2027, 3, 28, 12])
        XCTAssertEqual(ymdh(DayStep.noon(late, plus: 2, in: london), london), [2027, 3, 29, 12])
    }

    func testFallBackMorningMovesToTheNextDate() {
        // 00:30 on Sunday 25 October 2026; the clocks go back at 02:00 that day.
        let early = at(2026, 10, 25, 0, 30, london)
        // The old way stays on Sunday.
        XCTAssertEqual(ymdh(early.addingTimeInterval(86_400), london)[2], 25)
        XCTAssertEqual(ymdh(DayStep.noon(early, plus: 1, in: london), london), [2026, 10, 26, 12])
    }

    func testYesterdayAfterSpringForward() {
        // 00:30 on Monday 29 March 2027, the day after the clocks went forward.
        let monday = at(2027, 3, 29, 0, 30, london)
        XCTAssertEqual(ymdh(DayStep.noon(monday, plus: -1, in: london), london), [2027, 3, 28, 12])
        XCTAssertEqual(ymdh(DayStep.noon(monday, plus: -2, in: london), london), [2027, 3, 27, 12])
    }

    func testEveryDayOfAYearIsVisitedOnce() {
        for tz in [london, singapore, TimeZone(identifier: "America/New_York")!, TimeZone(identifier: "Australia/Sydney")!] {
            let start = at(2026, 1, 1, 23, 45, tz)
            var seen = Set<String>()
            for i in 0..<365 {
                let c = ymdh(DayStep.noon(start, plus: i, in: tz), tz)
                XCTAssertEqual(c[3], 12, "\(tz.identifier) day \(i)")
                seen.insert("\(c[0])-\(c[1])-\(c[2])")
            }
            XCTAssertEqual(seen.count, 365, tz.identifier)
        }
    }

    func testEngineDayAfterSpringForwardNight() {
        // Tomorrow's times worked out late on the spring forward night are Sunday's.
        let late = at(2027, 3, 27, 23, 30, london)
        let london51 = Coordinates(latitude: 51.5074, longitude: -0.1278)
        let tomorrow = PrayerEngine.compute(for: DayStep.noon(late, plus: 1, in: london), in: london,
                                            at: london51, method: .mwl, asr: .standard)
        XCTAssertEqual([tomorrow.year, tomorrow.month, tomorrow.day], [2027, 3, 28])
    }

    func testMusafirShortDistanceNeverReadsAsTheLimit() {
        // 80.6 km must not read "81 km ... less than 81 km".
        let rules = Musafir.Rules(school: .standard, thresholdKm: 81)
        let text = Musafir.distanceCheck(for: .nearby(distanceKm: 80.6), rules: rules)!.text
        XCTAssertTrue(text.hasPrefix("You are 80 km from home."), text)
        XCTAssertTrue(text.contains("less than 81 km"))
        let far = Musafir.distanceCheck(for: .traveller(distanceKm: 81.4), rules: rules)!.text
        XCTAssertTrue(far.hasPrefix("You are 81 km from home."), far)
    }
}
