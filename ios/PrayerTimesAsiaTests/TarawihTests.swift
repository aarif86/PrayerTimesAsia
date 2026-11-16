import XCTest
@testable import PrayerTimesAsia

/// The Tarawih counter. Same cases as web/tests/tarawih.test.ts.
final class TarawihTests: XCTestCase {
    func testCountsTwoRakaatATapAndStopsAtTheTotal() {
        var n = 0
        for _ in 0..<3 { n = Tarawih.tap(n, total: 8) }
        XCTAssertEqual(n, 6)
        XCTAssertEqual(Tarawih.tap(n, total: 8), 8)
        XCTAssertEqual(Tarawih.tap(8, total: 8), 8)
        XCTAssertEqual(Tarawih.tap(18, total: 20), 20)
        XCTAssertEqual(Tarawih.tap(20, total: 20), 20)
    }

    func testUndoNeverGoesBelowNothing() {
        XCTAssertEqual(Tarawih.undo(6), 4)
        XCTAssertEqual(Tarawih.undo(0), 0)
    }

    func testOneDotPerSalam() {
        XCTAssertEqual(Tarawih.sets(8), 4)
        XCTAssertEqual(Tarawih.sets(20), 10)
    }

    func testKeepsEightOrTwentyOnly() throws {
        func decode(_ json: String) throws -> Preferences { try JSONDecoder().decode(Preferences.self, from: Data(json.utf8)) }
        XCTAssertNil(try decode("{}").tarawihRakaat)
        XCTAssertEqual(try decode(#"{"tarawihRakaat": 8}"#).tarawihRakaat, 8)
        XCTAssertEqual(try decode(#"{"tarawihRakaat": 20}"#).tarawihRakaat, 20)
        XCTAssertNil(try decode(#"{"tarawihRakaat": 11}"#).tarawihRakaat)
        XCTAssertNil(try decode(#"{"tarawihRakaat": "8"}"#).tarawihRakaat)
    }

    func testTheChoiceTravelsWithMoveMySettings() {
        var here = Preferences()
        here.tarawihRakaat = 20
        let moved = MovedSettings(here)
        XCTAssertEqual(moved.tarawihRakaat, 20)
        XCTAssertEqual(MovedSettings(code: moved.code)?.applied(to: Preferences()).tarawihRakaat, 20)
        XCTAssertNil(MovedSettings(Preferences()).tarawihRakaat)
    }
}
