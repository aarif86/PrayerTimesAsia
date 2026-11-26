import XCTest
@testable import PrayerTimesAsia

/// Early reminders when away from home. Same cases as web tests/away.test.ts.
final class AwayReminderTests: XCTestCase {
    private func place(_ name: String, _ lat: Double, _ lon: Double) -> Place {
        Place(name: name, region: nil, countryCode: nil, countryName: nil, timeZoneID: "Asia/Singapore",
              coordinates: Coordinates(latitude: lat, longitude: lon), district: nil)
    }

    func testAwayOnlyPastFiveKmFromAConfirmedHome() {
        let home = place("Pasir Ris", 1.3721, 103.9474)
        XCTAssertFalse(AwayReminder.isAway(home: home, homeConfirmed: true, here: place("Tampines", 1.3496, 103.9568)))
        XCTAssertTrue(AwayReminder.isAway(home: home, homeConfirmed: true, here: place("KL", 3.139, 101.6869)))
        XCTAssertFalse(AwayReminder.isAway(home: home, homeConfirmed: false, here: place("KL", 3.139, 101.6869)))
        XCTAssertFalse(AwayReminder.isAway(home: nil, homeConfirmed: true, here: home))
    }

    func testCleanKeepsOnlyFivePrayersWithRealChoices() {
        var want = AwayReminder.defaultMinutes
        want["asr"] = 45
        XCTAssertEqual(AwayReminder.clean(["asr": 45, "fajr": 7, "sunrise": 15]), want)
        XCTAssertEqual(AwayReminder.clean(nil), AwayReminder.defaultMinutes)
    }

    func testOneEarlyReminderPerPrayer() {
        let d = AwayReminder.defaultMinutes
        XCTAssertEqual(AwayReminder.minutes(.asr, away: true, awayOn: true, awayMinutes: d, atHome: 15, hasAlarm: false), 60)
        XCTAssertEqual(AwayReminder.minutes(.asr, away: true, awayOn: false, awayMinutes: d, atHome: 15, hasAlarm: false), 15)
        XCTAssertEqual(AwayReminder.minutes(.asr, away: false, awayOn: true, awayMinutes: d, atHome: 0, hasAlarm: false), 0)
        XCTAssertEqual(AwayReminder.minutes(.fajr, away: true, awayOn: true, awayMinutes: ["fajr": 30], atHome: 0, hasAlarm: true), 0)
        XCTAssertEqual(AwayReminder.minutes(.fajr, away: true, awayOn: true, awayMinutes: ["fajr": 30], atHome: 0, hasAlarm: false), 30)
    }

    func testOnByDefaultAtOneHourWithFajrOff() {
        let p = Preferences()
        XCTAssertTrue(p.awayReminder)
        XCTAssertEqual(p.awayMinutes, AwayReminder.defaultMinutes)
    }
}
