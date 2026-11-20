import XCTest
@testable import PrayerTimesAsia

/// Alerts and alarms: one Off, Notify or Alarm per prayer. Same cases as web tests/alertMode.test.ts.
final class AlertModeTests: XCTestCase {
    func testStartsOffAndNotifyTurnsOnOnlyThatPrayer() {
        var p = Preferences()
        for prayer in Prayer.allCases { XCTAssertEqual(p.alertMode(prayer), .off) }
        p.setAlertMode(.notify, .dhuhr)
        XCTAssertTrue(p.notificationsEnabled)
        XCTAssertEqual(p.notifyPrayers, [.dhuhr])
        XCTAssertEqual(p.alertMode(.asr), .off)
    }

    func testAlarmKeepsNotificationAndOffClearsBoth() {
        var p = Preferences()
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
        var p = Preferences()
        var seen: [AlertMode] = []
        for _ in 0..<4 { let m = p.nextAlertMode(.maghrib); p.setAlertMode(m, .maghrib); seen.append(m) }
        XCTAssertEqual(seen, [.notify, .alarm, .off, .notify])
        var q = Preferences()
        q.setAlertMode(q.nextAlertMode(.sunrise), .sunrise)
        XCTAssertEqual(q.alertMode(.sunrise), .notify)
        XCTAssertEqual(q.nextAlertMode(.sunrise), .off)
    }

    func testFriday() {
        var p = Preferences()
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
