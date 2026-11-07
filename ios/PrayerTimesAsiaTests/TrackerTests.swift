import XCTest
@testable import PrayerTimesAsia

final class TrackerTests: XCTestCase {
    func testPauseDaysCrossAMonthEnd() {
        XCTAssertEqual(AppModel.days(from: "2026-10-30", to: "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"])
        XCTAssertEqual(AppModel.days(from: "2026-11-05", to: "2026-11-05"), ["2026-11-05"])
        XCTAssertEqual(AppModel.days(from: "2026-11-06", to: "2026-11-05"), [])
    }

    func testPauseSurvivesOldPreferencesAndMoves() throws {
        let old = try JSONDecoder().decode(Preferences.self, from: Data(#"{"trackerEnabled":true}"#.utf8))
        XCTAssertNil(old.trackerPausedSince)
        var p = Preferences()
        p.trackerEnabled = true
        p.trackerPausedSince = "2026-11-03"
        let moved = MovedSettings(p)
        XCTAssertEqual(moved.trackerPausedSince, "2026-11-03")
        XCTAssertEqual(moved.applied(to: Preferences()).trackerPausedSince, "2026-11-03")
    }
}
