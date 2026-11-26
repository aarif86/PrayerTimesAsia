import XCTest
@testable import PrayerTimesAsia

/// Alerts and alarms: one Off, Notify or Alarm per prayer. Same cases as web tests/alertMode.test.ts.
final class AlertModeTests: XCTestCase {
    /// Someone who has not turned alerts on (before the new-install default).
    private func OLD() -> Preferences { var p = Preferences(); p.notificationsEnabled = false; return p }

    func testNewInstallIsNotifyForFivePrayersAndOffForSunrise() {
        let p = Preferences()
        for prayer in Prayer.obligatory { XCTAssertEqual(p.alertMode(prayer), .notify) }
        XCTAssertEqual(p.alertMode(.sunrise), .off)
        XCTAssertTrue(p.allFiveNotify)
    }

    func testAllFiveButtonDropsAnOldLeftoverList() {
        var p = OLD()
        p.notifyPrayers = [.sunrise, .asr]
        p.notifyAllFive()
        XCTAssertEqual(p.alertMode(.sunrise), .off)
        XCTAssertTrue(p.allFiveNotify)
    }

    func testSavedChoicesAreKept() throws {
        let off = try JSONDecoder().decode(Preferences.self, from: Data(#"{"notificationsEnabled":false}"#.utf8))
        XCTAssertFalse(off.notificationsEnabled)
        let missing = try JSONDecoder().decode(Preferences.self, from: Data(#"{}"#.utf8))
        XCTAssertFalse(missing.notificationsEnabled)
        let on = try JSONDecoder().decode(Preferences.self, from: Data(#"{"notificationsEnabled":true}"#.utf8))
        XCTAssertTrue(on.notificationsEnabled)
    }

    func testAllFiveButtonLeavesAlarmAndSunriseAlone() {
        var p = OLD()
        p.setAlertMode(.alarm, .fajr)
        p.notifyAllFive()
        XCTAssertEqual(p.alertMode(.fajr), .alarm)
        XCTAssertEqual(p.wakeUp, .atFajr)
        for prayer in [Prayer.dhuhr, .asr, .maghrib, .isha] { XCTAssertEqual(p.alertMode(prayer), .notify) }
        XCTAssertEqual(p.alertMode(.sunrise), .off)
        XCTAssertFalse(p.allFiveNotify)
        var q = OLD(); q.notifyAllFive()
        XCTAssertTrue(q.allFiveNotify)
    }

    func testStartsOffAndNotifyTurnsOnOnlyThatPrayer() {
        var p = OLD()
        for prayer in Prayer.allCases { XCTAssertEqual(p.alertMode(prayer), .off) }
        p.setAlertMode(.notify, .dhuhr)
        XCTAssertTrue(p.notificationsEnabled)
        XCTAssertEqual(p.notifyPrayers, [.dhuhr])
        XCTAssertEqual(p.alertMode(.asr), .off)
    }

    func testAlarmKeepsNotificationAndOffClearsBoth() {
        var p = OLD()
        p.setAlertMode(.notify, .fajr)
        p.setAlertMode(.alarm, .fajr)
        XCTAssertEqual(p.wakeUp, .atFajr)
        XCTAssertEqual(p.alertMode(.fajr), .alarm)
        XCTAssertTrue(p.notifies(.fajr))
        p.setAlertMode(.notify, .fajr)
        XCTAssertNil(p.wakeUp)
        p.setAlertMode(.off, .fajr)
        XCTAssertFalse(p.notifies(.fajr))
    }

    func testBellCycleAndSunrise() {
        var p = OLD()
        var seen: [AlertMode] = []
        for _ in 0..<4 { let m = p.nextAlertMode(.maghrib); p.setAlertMode(m, .maghrib); seen.append(m) }
        XCTAssertEqual(seen, [.notify, .alarm, .off, .notify])
        var q = OLD()
        q.setAlertMode(q.nextAlertMode(.sunrise), .sunrise)
        XCTAssertEqual(q.alertMode(.sunrise), .notify)
        XCTAssertEqual(q.nextAlertMode(.sunrise), .off)
    }

    func testFriday() {
        var p = OLD()
        XCTAssertEqual(p.fridayMode, .off)
        p.setFridayMode(.alarm)
        XCTAssertEqual(p.jumuahReminderMinutes, 30)
        XCTAssertTrue(p.jumuahLeaveAlarm)
        p.jumuahReminderMinutes = 180
        p.setFridayMode(.notify)
        XCTAssertEqual(p.jumuahReminderMinutes, 180)
        XCTAssertEqual(p.fridayMode, .notify)
        p.setFridayMode(.off)
        XCTAssertEqual(p.jumuahReminderMinutes, 0)
    }

    func testReminderOnlyPeopleSeeNotify() throws {
        let old = try JSONDecoder().decode(Preferences.self, from: Data(#"{"notificationsEnabled":false,"reminderMinutesBefore":10,"notifyPrayers":["asr"]}"#.utf8))
        XCTAssertEqual(old.alertMode(.asr), .notify)
        XCTAssertEqual(old.alertMode(.dhuhr), .off)
        let untouched = try JSONDecoder().decode(Preferences.self, from: Data(#"{"notificationsEnabled":false}"#.utf8))
        XCTAssertFalse(untouched.notificationsEnabled)
    }
}
