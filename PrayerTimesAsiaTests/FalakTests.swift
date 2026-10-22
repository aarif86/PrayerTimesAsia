import XCTest
@testable import PrayerTimesAsia

/// Falak Mode F1. Expected values come from tools/falak_reference.py and the
/// published Qibla Day times (about 12:18 and 12:27 Makkah time).
final class FalakTests: XCTestCase {
    private let singapore = Coordinates(latitude: 1.3521, longitude: 103.8198)
    private let sgt = TimeZone(identifier: "Asia/Singapore")!

    private func utc(_ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int, _ s: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal.date(from: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi, second: s))!
    }

    private func sg(_ h: Int, _ mi: Int, _ s: Int = 0) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = sgt
        return cal.date(from: DateComponents(year: 2026, month: 10, day: 22, hour: h, minute: mi, second: s))!
    }

    func testQiblaDays() {
        let days2026 = Falak.qiblaDays(year: 2026)
        XCTAssertEqual(days2026.count, 2)
        XCTAssertEqual(days2026[0].timeIntervalSince(utc(2026, 5, 28, 9, 17, 59)), 0, accuracy: 30)
        XCTAssertEqual(days2026[1].timeIntervalSince(utc(2026, 7, 15, 9, 26, 42)), 0, accuracy: 30)
        let days2027 = Falak.qiblaDays(year: 2027)
        XCTAssertEqual(days2027[0].timeIntervalSince(utc(2027, 5, 28, 9, 17, 57)), 0, accuracy: 30)
        XCTAssertEqual(days2027[1].timeIntervalSince(utc(2027, 7, 16, 9, 26, 46)), 0, accuracy: 30)
        // At that instant the sun is overhead in Makkah.
        XCTAssertGreaterThan(Falak.sunPosition(at: days2027[0], coordinates: Geo.kaaba).altitude, 89.8)
    }

    func testNextQiblaDayRollsOver() {
        XCTAssertEqual(Falak.nextQiblaDay(after: utc(2026, 10, 22, 0, 0, 0)).timeIntervalSince(utc(2027, 5, 28, 9, 17, 57)), 0, accuracy: 30)
        XCTAssertEqual(Falak.nextQiblaDay(after: utc(2026, 6, 1, 0, 0, 0)).timeIntervalSince(utc(2026, 7, 15, 9, 26, 42)), 0, accuracy: 30)
    }

    func testRashdulQiblatSingapore() {
        let hits = Falak.rashdulQiblat(year: 2026, month: 10, day: 22, timeZone: sgt, coordinates: singapore)
        XCTAssertEqual(hits.count, 1)
        XCTAssertEqual(hits[0].kind, .sunOpposite)
        XCTAssertEqual(hits[0].time.timeIntervalSince(sg(10, 48)), 0, accuracy: 60)
        // The sun really is opposite the qibla then.
        let sun = Falak.sunPosition(at: hits[0].time, coordinates: singapore)
        XCTAssertEqual(abs(Geo.angleDelta(sun.azimuth + 180, Geo.qiblaBearing(from: singapore))), 0, accuracy: 0.1)
    }

    func testShadowDayMatchesEngine() throws {
        let plan = Falak.shadowDay(year: 2026, month: 10, day: 22, coordinates: singapore)
        XCTAssertEqual(plan.noon.timeIntervalSince(sg(12, 49, 13)), 0, accuracy: 5)
        XCTAssertEqual(plan.noonShadow(height: 100), 22.0, accuracy: 0.2)
        XCTAssertEqual(plan.asrShadow(height: 100, school: .standard), 122.0, accuracy: 0.2)
        XCTAssertEqual(plan.asrShadow(height: 100, school: .hanafi), 222.0, accuracy: 0.2)
        XCTAssertEqual(Geo.compassPoint(plan.noonShadowBearing), "N") // sun is south of Singapore in October
        let asr = try XCTUnwrap(plan.asrShafii)
        XCTAssertEqual(asr.timeIntervalSince(sg(16, 6, 53)), 0, accuracy: 10)
        // The shadow-stick Asr is the engine's Asr before ihtiyat: MUIS rounds up after +0.5 min.
        let muis = PrayerEngine.compute(year: 2026, month: 10, day: 22, at: singapore, method: .muis, asr: .standard)
        XCTAssertEqual(muis.time(.asr).timeIntervalSince(asr) / 60, 1, accuracy: 1)
    }

    func testReadingRoundTrip() throws {
        let clock = sg(15, 30)
        let sun = Falak.sunPosition(at: clock, coordinates: singapore)
        let shadow = Falak.shadowLength(height: 100, altitude: sun.altitude)
        let r = try XCTUnwrap(Falak.reading(height: 100, shadow: shadow, at: clock, coordinates: singapore,
                                            timeZone: sgt, school: .standard))
        XCTAssertTrue(r.afternoon)
        XCTAssertEqual(try XCTUnwrap(r.offsetMinutes), 0, accuracy: 0.2)
        XCTAssertEqual(r.asrReached, false)
        XCTAssertLessThan(try XCTUnwrap(r.uncertaintyMinutes), 3)

        // A shadow 10 cm longer reads later; long enough, Asr has begun.
        let later = try XCTUnwrap(Falak.reading(height: 100, shadow: shadow + 10, at: clock, coordinates: singapore,
                                                timeZone: sgt, school: .standard))
        XCTAssertGreaterThan(try XCTUnwrap(later.offsetMinutes), 2)
        let asr = try XCTUnwrap(Falak.reading(height: 100, shadow: 130, at: sg(16, 20), coordinates: singapore,
                                              timeZone: sgt, school: .standard))
        XCTAssertEqual(asr.asrReached, true)
    }

    func testFalakIsTheLastGrade() throws {
        XCTAssertEqual(SourceGrade.falak.rawValue, "F")
        XCTAssertEqual(try JSONDecoder().decode(SourceGrade.self, from: Data("\"F\"".utf8)), .falak)
    }

    func testBlessedTimes() {
        let today = PrayerEngine.compute(year: 2026, month: 10, day: 22, at: singapore, method: .muis, asr: .standard)
        let tomorrow = PrayerEngine.compute(year: 2026, month: 10, day: 23, at: singapore, method: .muis, asr: .standard)
        let times = BlessedTime.compute(day: today, nextDay: tomorrow, coordinates: singapore, isRamadan: false)
        XCTAssertEqual(times.map { $0.0 }, [.dhuha, .midnight, .lastThird])
        let afterSunrise = times[0].1.timeIntervalSince(today.time(.sunrise)) / 60
        XCTAssertTrue((15...30).contains(afterSunrise), "Dhuha \(afterSunrise) min after sunrise")
        let night = tomorrow.time(.fajr).timeIntervalSince(today.time(.maghrib))
        XCTAssertEqual(times[1].1.timeIntervalSince(today.time(.maghrib)), night / 2, accuracy: 60)
        XCTAssertEqual(times[2].1.timeIntervalSince(today.time(.maghrib)), night * 2 / 3, accuracy: 60)
        let ramadan = BlessedTime.compute(day: today, nextDay: tomorrow, coordinates: singapore, isRamadan: true)
        XCTAssertEqual(ramadan.first?.1, today.time(.fajr).addingTimeInterval(-600))
    }
}
