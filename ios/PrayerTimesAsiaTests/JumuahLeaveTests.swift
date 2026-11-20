import XCTest
@testable import PrayerTimesAsia

/// Same cases as web/tests/alerts.test.ts and prefs.test.ts (Leave for Jumaat).
final class JumuahLeaveTests: XCTestCase {
    func testChoicesAndOldValues() {
        XCTAssertEqual(JumuahLeave.choices, [0, 15, 30, 45, 60, 90, 120, 150, 180])
        XCTAssertEqual(JumuahLeave.snap(20), 30)
        XCTAssertEqual(JumuahLeave.snap(90), 90)
        XCTAssertEqual(JumuahLeave.snap(180), 180)
        XCTAssertEqual(JumuahLeave.span(150, .en), "2 hours 30 min")
        XCTAssertEqual(JumuahLeave.span(90, .ms), "1 jam 30 minit")
        XCTAssertEqual(JumuahLeave.snap(120), 120)
        XCTAssertEqual(JumuahLeave.snap(17), 0)
        XCTAssertEqual(JumuahLeave.label(120), "2 hours before")
        XCTAssertEqual(JumuahLeave.label(60), "1 hour before")
        XCTAssertEqual(JumuahLeave.label(15), "15 min before")
        XCTAssertEqual(JumuahLeave.label(0), "Off")
    }

    func testWords() {
        let en = JumuahLeave.words(.en, minutes: 120, name: "Jumu'ah", second: true, at: "2:00 PM", where: nil)
        XCTAssertEqual(en.title, "Time to leave for the second Jumu'ah")
        XCTAssertEqual(en.body, "The second Jumu'ah starts from 2:00 PM, 2 hours from now.")
        let ms = JumuahLeave.words(.ms, minutes: 15, name: "Jumaat", second: false, at: "1:05 PM", where: nil)
        XCTAssertEqual(ms.title, "Masa untuk bertolak ke solat Jumaat")
        XCTAssertEqual(ms.body, "Solat Jumaat bermula pada 1:05 PM, 15 minit lagi.")
        let id = JumuahLeave.words(.id, minutes: 60, name: "Jumat", second: false, at: "11:50", where: "Masjid Istiqlal")
        XCTAssertEqual(id.body, "Salat Jumat di Masjid Istiqlal dimulai pukul 11:50, 1 jam lagi.")
    }

    func testSessionMovesAndDecodes() throws {
        var p = Preferences()
        p.jumuahReminderMinutes = 120; p.jumuahSession = .second; p.jumuahLeaveAlarm = true
        let back = MovedSettings(p).applied(to: Preferences())
        XCTAssertEqual(back.jumuahReminderMinutes, 120)
        XCTAssertEqual(back.jumuahSession, .second)
        XCTAssertTrue(back.jumuahLeaveAlarm)
        XCTAssertTrue(back.anyAlarm)
        let old = try JSONDecoder().decode(Preferences.self, from: Data(#"{"jumuahReminderMinutes":20,"jumuahSession":"third"}"#.utf8))
        XCTAssertEqual(old.jumuahReminderMinutes, 30)
        XCTAssertEqual(old.jumuahSession, .first)
    }
}
