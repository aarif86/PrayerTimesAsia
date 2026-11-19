import XCTest
@testable import PrayerTimesAsia

/// Women's days link the fast record and the prayer tracker. Same cases as web/tests/womensDays.test.ts.
final class WomensDaysTests: XCTestCase {
    // Ramadan is 10 to 20 March in these tests.
    private let ramadan: (String) -> Bool = { $0 >= "2027-03-10" && $0 <= "2027-03-20" }
    private let fresh = WomensDays(fastLog: [:], excusedDays: [], trackerPausedSince: nil)

    func testMarkingTodayPeriodPausesAndUndoingClearsBoth() {
        var s = fresh
        s.setFast("2027-03-12", .period, today: "2027-03-12", isRamadan: ramadan)
        XCTAssertEqual(s.trackerPausedSince, "2027-03-12")
        XCTAssertEqual(s.fastLog["2027-03-12"], .period)
        s.setFast("2027-03-12", nil, today: "2027-03-12", isRamadan: ramadan)
        XCTAssertEqual(s, fresh)
    }

    func testMarkingAnEarlierDayExcusesOnlyThatDay() {
        var s = fresh
        s.setFast("2027-03-11", .period, today: "2027-03-14", isRamadan: ramadan)
        XCTAssertNil(s.trackerPausedSince)
        XCTAssertEqual(s.excusedDays, ["2027-03-11"])
        s.setFast("2027-03-11", .sick, today: "2027-03-14", isRamadan: ramadan)
        XCTAssertEqual(s.excusedDays, [])
        XCTAssertEqual(s.fastLog["2027-03-11"], .sick)
    }

    func testAPauseReadsAsPeriodAcrossMidnight() {
        var s = fresh
        s.pause(today: "2027-03-12")
        XCTAssertEqual(s.mark("2027-03-12", today: "2027-03-12", isRamadan: ramadan), .period)
        XCTAssertEqual(s.mark("2027-03-13", today: "2027-03-13", isRamadan: ramadan), .period)
        XCTAssertNil(s.mark("2027-03-14", today: "2027-03-13", isRamadan: ramadan))
        XCTAssertNil(s.mark("2027-03-11", today: "2027-03-13", isRamadan: ramadan))
        s.fastLog["2027-03-12"] = .fasted
        XCTAssertEqual(s.mark("2027-03-12", today: "2027-03-13", isRamadan: ramadan), .fasted)
    }

    func testOutsideRamadanAPauseLeavesTheFastsAlone() {
        var s = fresh
        s.pause(today: "2027-03-25")
        XCTAssertNil(s.mark("2027-03-25", today: "2027-03-26", isRamadan: ramadan))
        s.endPause(today: "2027-03-26", isRamadan: ramadan)
        XCTAssertEqual(s.fastLog, [:])
        XCTAssertEqual(s.excusedDays, ["2027-03-25", "2027-03-26"])
    }

    func testEndingAPauseKeepsItsRamadanDaysAsPeriod() {
        var s = fresh
        s.pause(today: "2027-03-19")
        s.fastLog["2027-03-20"] = .fasted
        s.endPause(today: "2027-03-22", isRamadan: ramadan)
        XCTAssertNil(s.trackerPausedSince)
        XCTAssertEqual(s.fastLog, ["2027-03-19": .period, "2027-03-20": .fasted])
        XCTAssertEqual(s.excusedDays, ["2027-03-19", "2027-03-20", "2027-03-21", "2027-03-22"])
    }

    func testFastingDuringAPauseEndsItTheDayBefore() {
        var s = fresh
        s.pause(today: "2027-03-12")
        s.setFast("2027-03-16", .fasted, today: "2027-03-16", isRamadan: ramadan)
        XCTAssertNil(s.trackerPausedSince)
        XCTAssertEqual(s.excusedDays, ["2027-03-12", "2027-03-13", "2027-03-14", "2027-03-15"])
        XCTAssertEqual(s.fastLog["2027-03-12"], .period)
        XCTAssertEqual(s.fastLog["2027-03-15"], .period)
        XCTAssertEqual(s.fastLog["2027-03-16"], .fasted)
    }

    func testChangingADayInsideAPauseKeepsThePauseAfterIt() {
        var s = fresh
        s.pause(today: "2027-03-12")
        s.setFast("2027-03-13", .fasted, today: "2027-03-15", isRamadan: ramadan)
        XCTAssertEqual(s.excusedDays, ["2027-03-12"])
        XCTAssertEqual(s.trackerPausedSince, "2027-03-14")
        XCTAssertEqual(s.mark("2027-03-15", today: "2027-03-15", isRamadan: ramadan), .period)
    }

    func testUndoingTheFirstDayOfAPauseCancelsIt() {
        var s = fresh
        s.pause(today: "2027-03-12")
        s.setFast("2027-03-12", nil, today: "2027-03-12", isRamadan: ramadan)
        XCTAssertEqual(s, fresh)
    }

    func testPeriodInsideAPauseDoesNotStartAnother() {
        var s = fresh
        s.pause(today: "2027-03-12")
        s.setFast("2027-03-13", .period, today: "2027-03-13", isRamadan: ramadan)
        XCTAssertEqual(s.trackerPausedSince, "2027-03-12")
        XCTAssertEqual(s.excusedDays, [])
    }

    func testJustTodayMarksTheFastAndAgainUndoesBoth() {
        var s = fresh
        s.toggleExcused("2027-03-14", isRamadan: ramadan)
        XCTAssertEqual(s.excusedDays, ["2027-03-14"])
        XCTAssertEqual(s.fastLog["2027-03-14"], .period)
        s.toggleExcused("2027-03-14", isRamadan: ramadan)
        XCTAssertEqual(s, fresh)
        s.fastLog["2027-03-15"] = .sick
        s.toggleExcused("2027-03-15", isRamadan: ramadan)
        XCTAssertEqual(s.fastLog["2027-03-15"], .sick)
    }

    func testAPauseAcrossTheEndOfAMonth() {
        var s = fresh
        s.pause(today: "2027-02-27")
        s.endPause(today: "2027-03-02", isRamadan: { $0 >= "2027-02-25" && $0 <= "2027-03-05" })
        XCTAssertEqual(s.fastLog.keys.sorted(), ["2027-02-27", "2027-02-28", "2027-03-01", "2027-03-02"])
    }
}
