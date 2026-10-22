import XCTest
@testable import PrayerTimesAsia

/// Calendar sanad (brief v03 §7.1) and show-both-when-sources-disagree (§2).
final class CalendarSanadTests: XCTestCase {
    private let sgt = TimeZone(identifier: "Asia/Singapore")!

    func testUmmAlQuraEstimates1448() {
        // Umm al-Qura table values (cross-checked with the hijridate package).
        XCTAssertEqual(CalendarSanad.expected(.ramadan, hijriYear: 1448), DateComponents(year: 2027, month: 2, day: 8))
        XCTAssertEqual(CalendarSanad.expected(.syawal, hijriYear: 1448), DateComponents(year: 2027, month: 3, day: 9))
        XCTAssertEqual(CalendarSanad.expected(.adha, hijriYear: 1448), DateComponents(year: 2027, month: 5, day: 16))
        XCTAssertEqual(CalendarSanad.expected(.muharram, hijriYear: 1449), DateComponents(year: 2027, month: 6, day: 6))
    }

    func testUpcomingOrder() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = sgt
        let oct22 = cal.date(from: DateComponents(year: 2026, month: 10, day: 22, hour: 12))!
        let next = CalendarSanad.upcoming(after: oct22, timeZone: sgt)
        XCTAssertEqual(next.map(\.event), [.ramadan, .syawal, .adha, .muharram])
        XCTAssertEqual(next.map(\.hijriYear), [1448, 1448, 1448, 1449])
    }

    func testDecodesAnnouncement() throws {
        let json = """
        {"version":1,"licence":"CC-BY-4.0","announcements":[
          {"event":"1_ramadan","hijri_year":1448,"authority":"MUIS","country":"SG","date":"2027-02-08",
           "status":"announced","basis":"hisab","source_url":"https://example.org","announced_at":"2027-02-07T20:00:00+08:00"}]}
        """
        let data = try JSONDecoder().decode(CalendarDataset.self, from: Data(json.utf8))
        let a = try XCTUnwrap(data.announcements.first)
        XCTAssertEqual(a.event, .ramadan)
        XCTAssertEqual(a.status, .announced)
        XCTAssertEqual(a.gregorian, DateComponents(year: 2027, month: 2, day: 8))
        XCTAssertEqual(a.basisLabel, "calculation")
        XCTAssertEqual(CalendarSanad.defaultAuthority(country: "SG"), "MUIS")
    }

    func testDisagreementsOverTwoMinutesOnly() {
        let sg = Coordinates(latitude: 1.3521, longitude: 103.8198)
        let muis = PrayerEngine.compute(year: 2026, month: 10, day: 22, at: sg, method: .muis, asr: .standard)
        var times = muis.times
        times[.fajr] = muis.time(.fajr).addingTimeInterval(3 * 60)   // 3 min: shown
        times[.isha] = muis.time(.isha).addingTimeInterval(2 * 60)   // 2 min: not shown
        let other = PrayerDay(year: muis.year, month: muis.month, day: muis.day, times: times)
        let diff = AppModel.disagreements(muis, other)
        XCTAssertEqual(Set(diff.keys), [.fajr])
    }
}
