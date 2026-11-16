import XCTest
@testable import PrayerTimesAsia

/// In Ramadan the small widgets count down to Berbuka by day and Imsak at night;
/// outside Ramadan they show the next prayer as before.
final class WidgetFastTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Singapore")!

    private func at(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        var c = DateComponents()
        c.year = 2027; c.month = 2; c.day = day; c.hour = hour; c.minute = minute
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        return cal.date(from: c)!
    }

    private func snapshot(fasts: [WidgetSnapshot.Fast]) -> WidgetSnapshot {
        WidgetSnapshot(placeName: "Singapore", flag: "", timeZoneID: tz.identifier, naming: .malay, use24Hour: false,
                       sourceLabel: "MUIS", days: [], updated: .now, fasts: fasts,
                       fastWords: .init(imsak: "Imsak", berbuka: "Berbuka"))
    }

    /// Two fasts, 10 and 11 February, Imsak 5:40 am and Berbuka 7:20 pm.
    private var twoFasts: [WidgetSnapshot.Fast] {
        [.init(imsak: at(10, 5, 40), berbuka: at(10, 19, 20)), .init(imsak: at(11, 5, 40), berbuka: at(11, 19, 20))]
    }

    func testBerbukaThroughTheDay() {
        let m = snapshot(fasts: twoFasts).fastMoment(at: at(10, 13))
        XCTAssertEqual(m?.kind, .berbuka)
        XCTAssertEqual(m?.time, at(10, 19, 20))
        XCTAssertEqual(m?.label, "Berbuka")
    }

    func testImsakBeforeDawnAndAfterBerbuka() {
        let s = snapshot(fasts: twoFasts)
        XCTAssertEqual(s.fastMoment(at: at(10, 3))?.kind, .imsak)
        XCTAssertEqual(s.fastMoment(at: at(10, 3))?.time, at(10, 5, 40))
        // After Berbuka on the 10th, tomorrow's Imsak.
        XCTAssertEqual(s.fastMoment(at: at(10, 20))?.kind, .imsak)
        XCTAssertEqual(s.fastMoment(at: at(10, 20))?.time, at(11, 5, 40))
    }

    func testTheEveBeforeTheFirstFast() {
        let s = snapshot(fasts: twoFasts)
        // The day before Ramadan: Imsak of the first fast.
        XCTAssertEqual(s.fastMoment(at: at(9, 21))?.time, at(10, 5, 40))
        // Two days before: nothing yet.
        XCTAssertNil(s.fastMoment(at: at(8, 21)))
    }

    func testNothingAfterTheLastFastOrOutsideRamadan() {
        XCTAssertNil(snapshot(fasts: twoFasts).fastMoment(at: at(11, 20)))
        XCTAssertNil(snapshot(fasts: []).fastMoment(at: at(10, 13)))
        var old = snapshot(fasts: twoFasts)
        old.fasts = nil
        old.fastWords = nil
        XCTAssertNil(old.fastMoment(at: at(10, 13)))
    }

    func testOldSnapshotsStillLoad() throws {
        // A snapshot saved before this change has no fasts and must still decode.
        var s = snapshot(fasts: [])
        s.fasts = nil
        s.fastWords = nil
        let data = try JSONEncoder().encode(s)
        let back = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
        XCTAssertNil(back.fasts)
    }
}
