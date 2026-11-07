import XCTest
@testable import PrayerTimesAsia

/// Ramadan and Syawal follow the authority's announcement. Same cases as web/tests/season.test.ts.
final class SeasonTests: XCTestCase {
    // Umm al-Qura: 1 Ramadan 1448 = 8 Feb 2027, 1 Syawal 1448 = 9 Mar 2027.
    private func ann(_ event: HijriEvent, _ date: String, _ status: CalendarAnnouncement.Status = .announced) -> CalendarAnnouncement {
        CalendarAnnouncement(event: event, hijriYear: 1448, authority: "MUIS", country: "SG", date: date, status: status, basis: "rukyah")
    }
    private func h(_ y: Int, _ m: Int, _ d: Int, _ list: [CalendarAnnouncement], _ authority: String? = "MUIS") -> Hijri.HijriDate {
        Season.communityHijri(CivilDay(year: y, month: m, day: d), adjustment: 0, announcements: list, authority: authority)
    }

    func testUmmAlQuraWhenNothingAnnounced() {
        XCTAssertEqual(h(2027, 2, 8, []), .init(day: 1, month: 9, year: 1448))
    }

    func testRamadanStartsADayLater() {
        let list = [ann(.ramadan, "2027-02-09")]
        XCTAssertEqual(h(2027, 2, 8, list), .init(day: 30, month: 8, year: 1448))
        XCTAssertEqual(h(2027, 2, 9, list), .init(day: 1, month: 9, year: 1448))
        XCTAssertEqual(h(2027, 3, 1, list), .init(day: 21, month: 9, year: 1448))
        XCTAssertEqual(h(2027, 2, 8, list, "JAKIM"), .init(day: 1, month: 9, year: 1448))
    }

    func testRamadanEndsOnAnnouncedRaya() {
        let list = [ann(.ramadan, "2027-02-09"), ann(.syawal, "2027-03-10")]
        XCTAssertEqual(h(2027, 3, 9, list), .init(day: 29, month: 9, year: 1448))
        XCTAssertEqual(h(2027, 3, 10, list), .init(day: 1, month: 10, year: 1448))
        XCTAssertEqual(h(2027, 3, 11, list), .init(day: 2, month: 10, year: 1448))
    }

    func testAnnouncementBeatsExpected() {
        let list = [ann(.ramadan, "2027-02-08", .expected), ann(.ramadan, "2027-02-09")]
        XCTAssertEqual(h(2027, 2, 9, list).day, 1)
    }

    func testNights() {
        XCTAssertEqual(Season.info(.init(day: 29, month: 8, year: 1448)).sightingTonight, .ramadan)
        XCTAssertEqual(Season.info(.init(day: 29, month: 8, year: 1448)).nightTonight, 1)
        let d20 = Season.info(.init(day: 20, month: 9, year: 1448))
        XCTAssertTrue(d20.lastTen)
        XCTAssertTrue(d20.oddNight)
        XCTAssertFalse(Season.info(.init(day: 21, month: 9, year: 1448)).oddNight)
        XCTAssertEqual(Season.info(.init(day: 29, month: 9, year: 1448)).sightingTonight, .syawal)
        XCTAssertEqual(Season.info(.init(day: 1, month: 10, year: 1448)).phase, .raya)
    }

    func testPreviewLandsOnTheChosenDay() {
        let today = CivilDay(year: 2026, month: 11, day: 7)
        let shift = Season.previewShift(today: today, preview: .ramadan)
        let h = Season.baseHijri(today.adding(shift))
        XCTAssertEqual(h.month, 9)
        XCTAssertEqual(h.day, 12)
        XCTAssertEqual(Season.previewShift(today: today, preview: .off), 0)
    }

    func testFirstOfRamadanOnTheCivilCalendar() {
        XCTAssertEqual(Season.gregorian(hijriYear: 1448, month: 9, day: 1), CivilDay(year: 2027, month: 2, day: 8))
    }
}
