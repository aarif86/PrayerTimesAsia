import XCTest
@testable import PrayerTimesAsia

/// The month calendar follows MUIS's published Islamic calendar (data/calendar.json,
/// shipped inside the app). Same cases as web/tests/publishedHijri.test.ts.
final class IslamicCalendarTests: XCTestCase {
    private let data = BundledCalendar.dataset

    private func hijri(_ y: Int, _ m: Int, _ d: Int, authority: String? = "MUIS") -> Hijri.HijriDate {
        Season.communityHijri(CivilDay(year: y, month: m, day: d), adjustment: 0, announcements: data.announcements,
                              authority: authority, monthStarts: data.monthStarts)
    }

    func testBundledCopyHasMuisMonthStarts() {
        XCTAssertGreaterThanOrEqual(data.monthStarts?.count ?? 0, 24)
        XCTAssertFalse(data.announcements.isEmpty)
    }

    func testFollowsMuisCalendar() {
        XCTAssertEqual(hijri(2027, 3, 10), .init(day: 1, month: 10, year: 1448))   // Hari Raya Aidilfitri
        XCTAssertEqual(hijri(2027, 5, 17), .init(day: 10, month: 12, year: 1448))  // Hari Raya Aidiladha
        XCTAssertEqual(hijri(2027, 1, 6), .init(day: 27, month: 7, year: 1448))    // Israk Mikraj
        XCTAssertEqual(hijri(2027, 8, 15), .init(day: 12, month: 3, year: 1449))   // Maulidur Rasul
    }

    func testOtherAuthoritiesKeepTheEstimate() {
        let g = CivilDay(year: 2027, month: 5, day: 17)
        XCTAssertNil(Season.publishedHijri(g, starts: data.monthStarts, authority: "JAKIM"))
        XCTAssertNil(Season.publishedHijri(g, starts: data.monthStarts, authority: nil))
    }

    func testPastTheLastListedMonthFallsBack() {
        XCTAssertNil(Season.publishedHijri(CivilDay(year: 2028, month: 6, day: 1), starts: data.monthStarts, authority: "MUIS"))
    }

    func testKeyDays() {
        XCTAssertEqual(IslamicDays.of(.init(day: 10, month: 12, year: 1448)).map(\.kind), [.aidiladha])
        XCTAssertEqual(IslamicDays.of(.init(day: 13, month: 12, year: 1448)).map(\.kind), [.tasyrik])
        XCTAssertEqual(IslamicDays.of(.init(day: 14, month: 5, year: 1448)).map(\.kind), [.whiteDay])
        XCTAssertTrue(IslamicDays.of(.init(day: 14, month: 9, year: 1448)).isEmpty)
        XCTAssertEqual(IslamicDays.name(.aidilfitri, .malay), "Hari Raya Aidilfitri")
        XCTAssertEqual(IslamicDays.monthShort(6, .international), "Jumada II")
    }
}
