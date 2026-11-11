import XCTest
@testable import PrayerTimesAsia

/// "Move my settings": the iPhone reads the same codes as Android and the web
/// (testdata/move-settings.json) and its own codes come back unchanged.
final class MoveSettingsTests: XCTestCase {
    private struct Fixture: Decodable {
        struct Case: Decodable { let name: String; let code: String; let settings: MovedSettings }
        let cases: [Case]
    }

    private func fixture() throws -> Fixture {
        let url = ExpectedTimes.directory.appendingPathComponent("move-settings.json")
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    func testReadsTheSharedCodes() throws {
        for c in try fixture().cases {
            XCTAssertEqual(MovedSettings(code: c.code), c.settings, c.name)
        }
    }

    func testFindsTheCodeInALink() throws {
        let c = try fixture().cases[1]
        XCTAssertEqual(MovedSettings(code: "Here: https://aarif86.github.io/PrayerTimesAsia/app/#move=\(c.code) "), c.settings)
        XCTAssertNil(MovedSettings(code: "PTA1.not-a-code"))
        XCTAssertNil(MovedSettings(code: "hello"))
    }

    func testRoundTrip() throws {
        let moved = try fixture().cases[1].settings
        let prefs = moved.applied(to: Preferences())
        XCTAssertTrue(prefs.hasOnboarded)
        XCTAssertEqual(prefs.home?.name, "Singapore")
        XCTAssertEqual(prefs.savedPlaces[1].district, "Kota Bandung")
        XCTAssertEqual(prefs.todayStyle, .bands)
        XCTAssertEqual(prefs.wakeUp, .sunriseMinus30)
        XCTAssertEqual(prefs.notifyPrayers, [.fajr, .maghrib, .isha])
        let back = MovedSettings(prefs)
        XCTAssertEqual(back, moved)
        XCTAssertEqual(MovedSettings(code: back.code), moved)
    }

    func testPrayerAlarmsMove() {
        var here = Preferences()
        here.asrAlarm = .plus10
        here.alarmSound = .bells
        let moved = MovedSettings(here)
        XCTAssertEqual(moved.asrAlarm, .plus10)
        XCTAssertEqual(moved.alarmSound, .bells)
        let back = MovedSettings(code: moved.code)?.applied(to: Preferences())
        XCTAssertEqual(back?.asrAlarm, .plus10)
        XCTAssertEqual(back?.alarmSound, .bells)
        XCTAssertNil(MovedSettings(Preferences()).alarmSound)
    }

    func testFreshInstallIsEmpty() throws {
        XCTAssertEqual(MovedSettings(Preferences()), try fixture().cases[0].settings)
    }

    func testTrackerHistoryIsAdded() {
        var here = Preferences()
        here.prayedLog = ["2026-10-25": [.isha], "2026-10-01": [.fajr]]
        here.use24Hour = true
        var moved = MovedSettings()
        moved.prayedLog = ["2026-10-25": [.fajr]]
        let prefs = moved.applied(to: here)
        XCTAssertEqual(prefs.prayedLog, ["2026-10-25": [.fajr, .isha], "2026-10-01": [.fajr]])
        XCTAssertFalse(prefs.use24Hour)
    }

    func testLongHistoryStillFitsAQRCode() {
        var moved = MovedSettings()
        moved.trackerEnabled = true
        var log: [String: [Prayer]] = [:]
        let start = Date(timeIntervalSince1970: 1_609_459_200) // 2021-01-01
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        for i in 0..<2000 { log[f.string(from: start.addingTimeInterval(Double(i) * 86_400))] = [.fajr, .isha] }
        moved.prayedLog = log
        let qr = moved.qrLink(maxCharacters: 700)
        XCTAssertLessThanOrEqual(qr.link.count, 700)
        XCTAssertGreaterThan(qr.keptDays ?? 0, 0)
        XCTAssertNotNil(MovedSettings(code: qr.link)?.prayedLog?["2026-06-23"])
    }

    func testRamadanRecordRoundTrip() throws {
        let moved = try XCTUnwrap(try fixture().cases.first { $0.name.hasPrefix("Ramadan record") }).settings
        let prefs = moved.applied(to: Preferences())
        XCTAssertEqual(prefs.fastLog["2026-02-25"], .period)
        XCTAssertEqual(prefs.fastLog["2026-04-10"], .qadha)
        XCTAssertEqual(prefs.tarawihLog, ["2026-02-17", "2026-02-18", "2026-03-16"])
        XCTAssertEqual(prefs.quranLog, ["2026-02-18", "2026-02-19"])
        let back = MovedSettings(prefs)
        XCTAssertEqual(back, moved)
        XCTAssertEqual(MovedSettings(code: back.code), moved)
        XCTAssertTrue(back.summary.contains("Your Ramadan record of fasts, Tarawih and juz"))
    }

    func testRamadanRecordIsAdded() {
        var here = Preferences()
        here.fastLog = ["2026-02-18": .sick, "2025-03-01": .fasted]
        here.tarawihLog = ["2025-03-01"]
        var moved = MovedSettings()
        moved.fastLog = ["2026-02-18": .fasted, "bad": .fasted]
        moved.tarawihLog = ["2026-02-18", "x"]
        let prefs = moved.applied(to: here)
        XCTAssertEqual(prefs.fastLog, ["2026-02-18": .fasted, "2025-03-01": .fasted])
        XCTAssertEqual(prefs.tarawihLog, ["2025-03-01", "2026-02-18"])
    }

    func testUnknownFastMarkIsSkipped() throws {
        let json = #"{"v":1,"fastLog":{"2026-02-18":"fasted","2026-02-19":"someday"},"tarawihLog":["2026-02-18",3]}"#
        let moved = try JSONDecoder().decode(MovedSettings.self, from: Data(json.utf8))
        XCTAssertEqual(moved.fastLog, ["2026-02-18": .fasted])
        XCTAssertEqual(moved.tarawihLog, ["2026-02-18"])
    }

    func testOlderCodeKeepsThisPhonesRamadanRecord() throws {
        var here = Preferences()
        here.fastLog = ["2026-02-18": .fasted]
        here.tarawihLog = ["2026-02-18"]
        here.quranLog = ["2026-02-19"]
        let old = try XCTUnwrap(MovedSettings(code: try fixture().cases[1].code))
        let prefs = old.applied(to: here)
        XCTAssertEqual(prefs.home?.name, "Singapore")
        XCTAssertEqual(prefs.fastLog, ["2026-02-18": .fasted])
        XCTAssertEqual(prefs.tarawihLog, ["2026-02-18"])
        XCTAssertEqual(prefs.quranLog, ["2026-02-19"])
    }

    func testQRKeepsOnlyThisYearsRamadanRecord() throws {
        var moved = MovedSettings()
        var fasts: [String: FastMark] = [:]
        var days: [String] = []
        for y in 2020...2026 {
            for d in 1...30 {
                let key = String(format: "%04d-03-%02d", y, d)
                fasts[key] = .fasted
                days.append(key)
            }
        }
        moved.fastLog = fasts
        moved.tarawihLog = days
        moved.quranLog = days
        let full = moved.link
        let qr = moved.qrLink(maxCharacters: full.count - 200)
        XCTAssertTrue(qr.ramadanTrimmed)
        XCTAssertNil(qr.keptDays)
        let back = try XCTUnwrap(MovedSettings(code: qr.link))
        XCTAssertTrue((back.fastLog ?? [:]).keys.allSatisfy { $0.hasPrefix("2026-") })
        XCTAssertEqual(back.tarawihLog?.count, 30)
        // Room to spare: nothing is left out. (Dictionary order can change the
        // packed length by a few characters from one encoding to the next.)
        XCTAssertFalse(moved.qrLink(maxCharacters: full.count + 200).ramadanTrimmed)
        XCTAssertEqual(MoveOutView.trimNote(keptDays: nil, ramadanTrimmed: true),
                       "The QR code carries only this year's Ramadan record. To bring all of it, share the link instead.")
    }
}
