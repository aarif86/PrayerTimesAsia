import XCTest
@testable import PrayerTimesAsia

/// The expected times shared with the Android and web tests
/// (testdata/expected-times.json). Official days: the offline calculation must
/// never be earlier than the official time (prayers 0-2 minutes later, sunrise
/// 0-1 minute earlier). Exact days: what the apps show, to the minute.
/// tools/reference_engine.py runs the same official days in Python, and
/// tools/validate_official.py checks every day of the year in CI.
final class PrayerEngineTests: XCTestCase {
    private let singapore = Coordinates(latitude: 1.3521, longitude: 103.8198)
    private let sgt = TimeZone(identifier: "Asia/Singapore")!

    private func compute(_ d: ExpectedTimes.Day) -> PrayerDay {
        PrayerEngine.compute(year: d.date.year, month: d.date.month, day: d.date.day,
                             at: d.coordinates, method: d.method, asr: .standard)
    }

    func testCalculationIsNeverEarlierThanOfficialTimetables() throws {
        let days = try ExpectedTimes.official()
        XCTAssertFalse(days.isEmpty, "no official days in testdata")
        for c in days {
            let day = compute(c)
            for (prayer, official) in zip(Prayer.allCases, c.times) {
                let got = minutesOfDay(day.time(prayer), in: c.timeZone)
                let parts = official.split(separator: ":").map { Int($0)! }
                let diff = got - (parts[0] * 60 + parts[1])
                let label = "\(c.method.shortName) \(c.date) \(prayer)"
                if prayer == .sunrise {
                    XCTAssert((-1...0).contains(diff), "\(label): \(diff) min off")
                } else {
                    XCTAssert((0...2).contains(diff), "\(label): \(diff) min off")
                }
            }
        }
    }

    func testMatchesTheOtherAppsToTheMinute() throws {
        let days = try ExpectedTimes.exact()
        XCTAssertFalse(days.isEmpty, "no exact days in testdata")
        for c in days {
            let day = compute(c)
            let got = Prayer.allCases.map { p -> String in
                let m = minutesOfDay(day.time(p), in: c.timeZone)
                return String(format: "%02d:%02d", m / 60, m % 60)
            }
            XCTAssertEqual(Array(got.prefix(c.times.count)), c.times, "\(c.method.id) \(c.date) (\(c.source))")
        }
    }

    /// Every day of 2026 against tools/reference_engine.py, as the Android and web tests do.
    func testWholeYearMatchesTheReferenceEngine() throws {
        for place in try ExpectedTimes.wholeYear() {
            var exact = 0, total = 0
            for (date, minutes) in place.days {
                let ymd = date.split(separator: "-").map { Int($0)! }
                let day = PrayerEngine.compute(year: ymd[0], month: ymd[1], day: ymd[2],
                                               at: place.coordinates, method: place.method, asr: .standard)
                let midnight = Astro.utcMidnight(year: ymd[0], month: ymd[1], day: ymd[2])
                for (prayer, expected) in zip(Prayer.allCases, minutes) {
                    let local = Int((day.time(prayer).timeIntervalSince(midnight) / 60).rounded()) + place.tzHours * 60
                    let diff = local - expected
                    XCTAssertLessThanOrEqual(abs(diff), 1, "\(place.name) \(date) \(prayer)")
                    if diff == 0 { exact += 1 }
                    total += 1
                }
            }
            // Only float noise at an exact minute boundary may differ.
            XCTAssertGreaterThan(Double(exact) / Double(total), 0.995, "\(place.name): only \(exact) of \(total) exact")
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

    func testSunAltitudeAtKeyMoments() {
        let day = PrayerEngine.compute(year: 2026, month: 10, day: 21, at: singapore, method: .muis, asr: .standard)
        // Sunrise is when the sun's upper limb clears the horizon (about -0.83°).
        XCTAssertEqual(Astro.sunAltitude(at: day.time(.sunrise).addingTimeInterval(-60), coordinates: singapore), -0.83, accuracy: 0.6)
        XCTAssertGreaterThan(Astro.sunAltitude(at: day.time(.dhuhr), coordinates: singapore), 70)
        // Subuh begins with the sun 20° below the horizon (MUIS).
        XCTAssertEqual(Astro.sunAltitude(at: day.time(.fajr), coordinates: singapore), -20, accuracy: 0.5)
    }

    func testWakeUpTimings() {
        let day = PrayerEngine.compute(year: 2026, month: 10, day: 21, at: singapore, method: .muis, asr: .standard)
        XCTAssertEqual(WakeUpTiming.atFajr.date(in: day), day.time(.fajr))
        XCTAssertEqual(WakeUpTiming.sunriseMinus30.date(in: day), day.time(.sunrise).addingTimeInterval(-1800))
        XCTAssertEqual(WakeUpTiming.sunriseMinus15.label(.malay), "15 min before Syuruk")
    }

    func testOldPreferencesStillDecode() throws {
        // A blob saved before the tracker/wake-up fields existed must keep its values.
        let old = #"{"hasOnboarded":true,"use24Hour":true,"musafirThresholdKm":89}"#
        let prefs = try JSONDecoder().decode(Preferences.self, from: Data(old.utf8))
        XCTAssertTrue(prefs.hasOnboarded)
        XCTAssertTrue(prefs.use24Hour)
        XCTAssertEqual(prefs.musafirThresholdKm, 89)
        XCTAssertFalse(prefs.trackerEnabled)
        XCTAssertNil(prefs.wakeUp)
    }

    private func minutesOfDay(_ date: Date, in timeZone: TimeZone) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.hour, .minute], from: date)
        return c.hour! * 60 + c.minute!
    }
}
