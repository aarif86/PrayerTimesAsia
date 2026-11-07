import XCTest
@testable import PrayerTimesAsia

/// Same cases as web/tests/window.test.ts.
final class PrayerWindowTests: XCTestCase {
    private let H: TimeInterval = 3600, M: TimeInterval = 60

    private func day(_ base: TimeInterval) -> PrayerDay {
        func at(_ s: TimeInterval) -> Date { Date(timeIntervalSince1970: base + s) }
        return PrayerDay(year: 2026, month: 11, day: 7, times: [
            .fajr: at(5 * H + 40 * M), .sunrise: at(7 * H), .dhuhr: at(13 * H),
            .asr: at(16 * H + 20 * M), .maghrib: at(19 * H), .isha: at(20 * H + 15 * M),
        ])
    }

    func testOpenWindows() {
        let D: TimeInterval = 86_400
        let y = day(0), t = day(D), n = day(2 * D)
        func open(_ s: TimeInterval) -> PrayerWindow? {
            PrayerWindow.open(at: Date(timeIntervalSince1970: s), yesterday: y, today: t, tomorrow: n)
        }
        XCTAssertEqual(open(D + 6 * H)?.prayer, .fajr)
        XCTAssertEqual(open(D + 14 * H)?.end, t.time(.asr))
        XCTAssertNil(open(D + 9 * H))
        let late = open(D + 23 * H)!
        XCTAssertEqual(late.prayer, .isha)
        XCTAssertEqual(late.end, n.time(.fajr))
        XCTAssertEqual(open(D + 2 * H)?.start, y.time(.isha))

        let w = PrayerWindow.windows(of: t, next: n)
        XCTAssertEqual(w[1].nudgeAt, t.time(.asr).addingTimeInterval(-30 * M))
        XCTAssertEqual(w[0].nudgeAt, t.time(.sunrise).addingTimeInterval(-26 * M))
        XCTAssertEqual(w[3].nudgeAt, t.time(.isha).addingTimeInterval(-25 * M))
    }

    func testQuietHours() {
        XCTAssertTrue(PrayerWindow.inQuietHours(23 * 60 + 30, from: 23 * 60, to: 6 * 60))
        XCTAssertTrue(PrayerWindow.inQuietHours(3 * 60, from: 23 * 60, to: 6 * 60))
        XCTAssertFalse(PrayerWindow.inQuietHours(6 * 60, from: 23 * 60, to: 6 * 60))
        XCTAssertTrue(PrayerWindow.inQuietHours(10 * 60, from: 8 * 60, to: 15 * 60))
        XCTAssertFalse(PrayerWindow.inQuietHours(10 * 60, from: 8 * 60, to: 8 * 60))
    }

    func testLifestyleSettingsMove() {
        var p = Preferences()
        p.quietHours = true; p.quietFrom = 480; p.quietTo = 900; p.buzzOnly = true
        p.largeText = true; p.jumuahReminderMinutes = 45; p.windowNudge = false
        let back = MovedSettings(p).applied(to: Preferences())
        XCTAssertEqual(back.quietFrom, 480)
        XCTAssertEqual(back.quietTo, 900)
        XCTAssertTrue(back.buzzOnly)
        XCTAssertTrue(back.largeText)
        XCTAssertEqual(back.jumuahReminderMinutes, 45)
        XCTAssertFalse(back.windowNudge)
        XCTAssertNil(MovedSettings(Preferences()).quietHours)
    }
}
