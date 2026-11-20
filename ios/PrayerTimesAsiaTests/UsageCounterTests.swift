import XCTest
@testable import PrayerTimesAsia

/// Anonymous usage counts: what is sent, and when nothing is.
final class UsageCounterTests: XCTestCase {
    func testSendsNothingWithoutAnAppIDOrWhenSwitchedOff() throws {
        XCTAssertNil(UsageCounter.Config(telemetryDeckAppID: "", enabled: true).appID)
        XCTAssertNil(UsageCounter.Config(telemetryDeckAppID: "AAAA", enabled: false).appID)
        XCTAssertEqual(UsageCounter.Config(telemetryDeckAppID: " AAAA ", enabled: true).appID, "AAAA")
        let shared = try JSONDecoder().decode(UsageCounter.Config.self, from: Data(#"{"about":"x","telemetryDeckAppID":"","enabled":true}"#.utf8))
        XCTAssertNil(shared.appID)
    }

    func testSharesOnlyCityAndCountry() {
        let p = UsageCounter.payload(version: "1.0.0", system: "18.0", language: "en-SG", city: "Pasir Ris", countryCode: "sg")
        XCTAssertEqual(p["App.platform"], "ios")
        XCTAssertEqual(p["App.language"], "en")
        XCTAssertEqual(p["Place.country"], "SG")
        XCTAssertEqual(p["Place.city"], "Pasir Ris")
        XCTAssertFalse(p.keys.contains { $0.lowercased().contains("coordinate") || $0.lowercased().contains("latitude") })
        XCTAssertNil(UsageCounter.payload(version: "1", system: "18", language: "en", city: "Current location", countryCode: nil)["Place.city"])
    }

    func testCountsAnOpenAtMostOnceAnHour() {
        let t = Date(timeIntervalSince1970: 1_000_000)
        XCTAssertTrue(UsageCounter.shouldCountOpen(last: nil, now: t))
        XCTAssertFalse(UsageCounter.shouldCountOpen(last: t, now: t.addingTimeInterval(3_599)))
        XCTAssertTrue(UsageCounter.shouldCountOpen(last: t, now: t.addingTimeInterval(3_600)))
    }

    func testOnByDefaultAndRemembersOff() throws {
        XCTAssertTrue(Preferences().shareUsage)
        XCTAssertTrue(try JSONDecoder().decode(Preferences.self, from: Data("{}".utf8)).shareUsage)
        XCTAssertFalse(try JSONDecoder().decode(Preferences.self, from: Data(#"{"shareUsage":false}"#.utf8)).shareUsage)
    }

    func testADayOfUseIsSentOnceTheNextDay() {
        var t = UsageCounter.DayTally(day: "2026-11-17")
        XCTAssertNil(UsageCounter.roll(t, today: "2026-11-17").finished)
        XCTAssertNil(UsageCounter.roll(t, today: "2026-11-18").finished, "an empty day sends nothing")
        t.opens = 3
        t = UsageCounter.adding(10 * 3_600, to: t)
        XCTAssertEqual(t.seconds, UsageCounter.maxStretch, "a phone left open counts two hours at most")
        t = UsageCounter.adding(screen: "qibla", to: UsageCounter.adding(screen: "prayer", to: UsageCounter.adding(screen: "prayer", to: t)))
        let rolled = UsageCounter.roll(t, today: "2026-11-18")
        XCTAssertEqual(rolled.finished, t)
        XCTAssertEqual(rolled.tally, UsageCounter.DayTally(day: "2026-11-18"))
        let p = UsageCounter.dayPayload(["App.platform": "ios"], t)
        XCTAssertEqual(p["Day.minutes"], "120")
        XCTAssertEqual(p["Day.minutesBand"], "over 60")
        XCTAssertEqual(p["Day.opens"], "3")
        XCTAssertEqual(p["Day.screens"], "prayer,qibla")
        XCTAssertEqual(p["Used.qibla"], "true")
        XCTAssertEqual(p["Used.masjid"], "false")
        XCTAssertEqual(UsageCounter.minutesBand(4.9), "1 to 5")
    }
}
