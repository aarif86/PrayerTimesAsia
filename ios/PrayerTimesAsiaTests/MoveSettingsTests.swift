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
}
