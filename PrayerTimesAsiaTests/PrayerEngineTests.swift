import XCTest
@testable import PrayerTimesAsia

/// Reference days copied from official timetables. Expected values are what the
/// engine must produce: equal to the official time, or at most one minute on the
/// safe side (prayers later, sunrise earlier). tools/reference_engine.py runs the
/// same cases in Python.
final class PrayerEngineTests: XCTestCase {
    private struct Case {
        let method: CalculationMethod
        let date: (Int, Int, Int)
        let coordinates: Coordinates
        let official: [String] // fajr, sunrise, dhuhr, asr, maghrib, isha (local, 24h)
    }

    private let singapore = Coordinates(latitude: 1.3521, longitude: 103.8198)
    private let kualaLumpur = Coordinates(latitude: 3.1390, longitude: 101.6869)
    private let sgt = TimeZone(identifier: "Asia/Singapore")!

    private var cases: [Case] {
        [
            // MUIS 2026 timetable (data.gov.sg) and the prayertime.sg app for 21 Oct.
            Case(method: .muis, date: (2026, 1, 1), coordinates: singapore,
                 official: ["05:44", "07:08", "13:10", "16:34", "19:11", "20:25"]),
            Case(method: .muis, date: (2026, 8, 1), coordinates: singapore,
                 official: ["05:46", "07:06", "13:13", "16:34", "19:17", "20:29"]),
            Case(method: .muis, date: (2026, 10, 21), coordinates: singapore,
                 official: ["05:29", "06:47", "12:51", "16:07", "18:52", "20:02"]),
            // JAKIM e-Solat, zone WLY01 (Kuala Lumpur).
            Case(method: .jakim, date: (2026, 1, 1), coordinates: kualaLumpur,
                 official: ["06:06", "07:18", "13:19", "16:42", "19:17", "20:31"]),
        ]
    }

    func testMatchesOfficialTimetablesWithinOneSafeMinute() {
        for c in cases {
            let day = PrayerEngine.compute(year: c.date.0, month: c.date.1, day: c.date.2,
                                           at: c.coordinates, method: c.method, asr: .standard)
            for (prayer, official) in zip(Prayer.allCases, c.official) {
                let got = minutesOfDay(day.time(prayer))
                let parts = official.split(separator: ":").map { Int($0)! }
                let diff = got - (parts[0] * 60 + parts[1])
                let label = "\(c.method.shortName) \(c.date) \(prayer)"
                if prayer == .sunrise {
                    XCTAssert((-1...0).contains(diff), "\(label): \(diff) min off")
                } else {
                    XCTAssert((0...1).contains(diff), "\(label): \(diff) min off")
                }
            }
        }
    }

    func testTimesAreChronological() {
        let tokyo = Coordinates(latitude: 35.6762, longitude: 139.6503)
        for method in CalculationMethod.all {
            let day = PrayerEngine.compute(year: 2026, month: 6, day: 21, at: tokyo, method: method, asr: .hanafi)
            let times = day.ordered.map(\.time)
            XCTAssertEqual(times, times.sorted(), "\(method.id) out of order")
        }
    }

    func testHanafiAsrIsLater() {
        let standard = PrayerEngine.compute(year: 2026, month: 3, day: 1, at: singapore, method: .muis, asr: .standard)
        let hanafi = PrayerEngine.compute(year: 2026, month: 3, day: 1, at: singapore, method: .muis, asr: .hanafi)
        XCTAssertGreaterThan(hanafi.time(.asr), standard.time(.asr).addingTimeInterval(30 * 60))
    }

    func testUmmAlQuraRamadanIshaInterval() {
        let makkah = Coordinates(latitude: 21.4225, longitude: 39.8262)
        let normal = PrayerEngine.compute(year: 2026, month: 5, day: 1, at: makkah, method: .ummAlQura, asr: .standard)
        let ramadan = PrayerEngine.compute(year: 2026, month: 5, day: 1, at: makkah, method: .ummAlQura,
                                           asr: .standard, isRamadan: true)
        XCTAssertEqual(normal.time(.isha).timeIntervalSince(normal.time(.maghrib)), 90 * 60, accuracy: 60)
        XCTAssertEqual(ramadan.time(.isha).timeIntervalSince(ramadan.time(.maghrib)), 120 * 60, accuracy: 60)
    }

    func testQiblaFromPasirRis() {
        // prayertime.sg shows 293° for Pasir Ris.
        let bearing = Geo.qiblaBearing(from: Coordinates(latitude: 1.3721, longitude: 103.9474))
        XCTAssertEqual(bearing, 293, accuracy: 0.5)
        let km = Geo.distanceKm(Coordinates(latitude: 1.3721, longitude: 103.9474), Geo.kaaba)
        XCTAssertEqual(km, 7282, accuracy: 15)
    }

    func testEveryAsianProfileHasAKnownMethod() {
        for profile in AsiaRegions.profiles {
            XCTAssertNotNil(CalculationMethod.with(id: profile.methodID), profile.code)
        }
        XCTAssertEqual(AsiaRegions.profile(for: "vn")?.method.id, "sea")
        XCTAssertEqual(AsiaRegions.profile(for: "MY")?.method.id, "jakim")
        XCTAssertEqual(AsiaRegions.countryCode(forTimeZone: "Asia/Ho_Chi_Minh"), "VN")
        XCTAssertEqual(AsiaRegions.profile(for: "SG")?.flag, "🇸🇬")
    }

    func testMusafirStatus() {
        let rules = Musafir.Rules(school: .standard, thresholdKm: 81)
        let hanoi = Coordinates(latitude: 21.0278, longitude: 105.8342)
        XCTAssertEqual(Musafir.status(home: singapore, current: singapore, daysHere: 0, rules: rules), .home)
        XCTAssertTrue(Musafir.status(home: singapore, current: hanoi, daysHere: 1, rules: rules)!.isTraveller)
        if case .settled = Musafir.status(home: singapore, current: hanoi, daysHere: 5, rules: rules)! {} else {
            XCTFail("a 5-day stay should end the concession under Shafi'i rules")
        }
        XCTAssertNil(Musafir.status(home: nil, current: hanoi, daysHere: 0, rules: rules))
    }

    func testHijriMonthNames() {
        // prayertime.sg: 21 Oct 2026 = 10 Jamadilawal 1448.
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = sgt
        let date = cal.date(from: DateComponents(year: 2026, month: 10, day: 21, hour: 12))!
        XCTAssertEqual(Hijri.format(date, timeZone: sgt, style: .malay), "10 Jamadilawal 1448")
    }

    private func minutesOfDay(_ date: Date) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = sgt
        let c = cal.dateComponents([.hour, .minute], from: date)
        return c.hour! * 60 + c.minute!
    }
}
