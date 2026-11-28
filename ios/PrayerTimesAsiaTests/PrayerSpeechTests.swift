import XCTest
@testable import PrayerTimesAsia

/// What Siri says for the next prayer: right prayer, right wording, never Syuruk.
final class PrayerSpeechTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Singapore")!

    private func at(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        var c = DateComponents()
        c.year = 2027; c.month = 3; c.day = day; c.hour = hour; c.minute = minute
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        return cal.date(from: c)!
    }

    private func snapshot(lang: String? = "en") -> WidgetSnapshot {
        func day(_ d: Int) -> WidgetSnapshot.Day {
            .init(year: 2027, month: 3, day: d, times: [
                "fajr": at(d, 5, 40), "sunrise": at(d, 7, 0), "dhuhr": at(d, 13, 10),
                "asr": at(d, 16, 20), "maghrib": at(d, 19, 10), "isha": at(d, 20, 20)])
        }
        return WidgetSnapshot(placeName: "Singapore", flag: "", timeZoneID: tz.identifier, naming: .malay,
                              use24Hour: false, sourceLabel: "MUIS", days: [day(10), day(11)], updated: .now, appLang: lang)
    }

    func testNextSkipsSyuruk() {
        let next = PrayerSpeech.next(snapshot(), now: at(10, 6))
        XCTAssertEqual(next?.prayer, .dhuhr)
    }

    func testAfterIshaIsTomorrowsSubuh() {
        XCTAssertEqual(PrayerSpeech.next(snapshot(), now: at(10, 22))?.prayer, .fajr)
        XCTAssertEqual(PrayerSpeech.next(snapshot(), now: at(10, 22))?.time, at(11, 5, 40))
    }

    func testEnglishLine() {
        XCTAssertEqual(PrayerSpeech.nextLine(snapshot(), now: at(10, 12, 17)), "Zohor is in 53 minutes, at 1:10 PM.")
    }

    func testMalayAndIndonesianLines() {
        XCTAssertEqual(PrayerSpeech.nextLine(snapshot(lang: "ms"), now: at(10, 12, 5)), "Zohor dalam 1 jam 5 minit, pada pukul 1:10 PM.")
        XCTAssertEqual(PrayerSpeech.nextLine(snapshot(lang: "id"), now: at(10, 12, 5)), "Zohor dalam 1 jam 5 menit, pukul 1:10 PM.")
    }

    func testSpanNeverSaysZero() {
        XCTAssertEqual(PrayerSpeech.span(10, .en), "1 minute")
        XCTAssertEqual(PrayerSpeech.span(3600, .en), "1 hour")
    }

    func testPastAndFutureTime() {
        XCTAssertEqual(PrayerSpeech.timeLine(.fajr, snapshot(), now: at(10, 9)), "Subuh was at 5:40 AM today.")
        XCTAssertEqual(PrayerSpeech.timeLine(.asr, snapshot(), now: at(10, 9)), "Asar is at 4:20 PM today.")
    }

    func testNoSnapshotAsksToOpenTheApp() {
        XCTAssertTrue(PrayerSpeech.nextLine(nil).contains("Prayer Times Asia"))
    }

    func testTodayListsFive() {
        let line = PrayerSpeech.todayLine(snapshot(), now: at(10, 9))
        XCTAssertTrue(line.hasPrefix("Today in Singapore."))
        XCTAssertFalse(line.contains("Syuruk"))
    }
}
