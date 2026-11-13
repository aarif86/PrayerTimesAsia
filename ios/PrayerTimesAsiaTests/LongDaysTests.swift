import XCTest
@testable import PrayerTimesAsia

/// The long summer days note. Same cases as web/tests/longDays.test.ts.
final class LongDaysTests: XCTestCase {
    private let mwl = CalculationMethod.mwl

    func testLondonAndOsloAroundMidsummer() {
        XCTAssertTrue(LongDays.twilightLastsAllNight(year: 2027, month: 6, day: 21, latitude: 51.51, method: mwl))
        XCTAssertTrue(LongDays.twilightLastsAllNight(year: 2027, month: 7, day: 10, latitude: 59.91, method: mwl))
    }

    func testNotInWinterTheTropicsOrSouthernEurope() {
        XCTAssertFalse(LongDays.twilightLastsAllNight(year: 2027, month: 12, day: 21, latitude: 51.51, method: mwl))
        XCTAssertFalse(LongDays.twilightLastsAllNight(year: 2027, month: 6, day: 21, latitude: 1.35, method: mwl))
        XCTAssertFalse(LongDays.twilightLastsAllNight(year: 2027, month: 6, day: 21, latitude: 41.01, method: mwl))
        XCTAssertFalse(LongDays.twilightLastsAllNight(year: 2027, month: 6, day: 21, latitude: -33.87, method: mwl))
    }

    func testLondonStopsOnceNightsAreDarkAgain() {
        XCTAssertFalse(LongDays.twilightLastsAllNight(year: 2027, month: 9, day: 15, latitude: 51.51, method: mwl))
        XCTAssertFalse(LongDays.twilightLastsAllNight(year: 2027, month: 3, day: 15, latitude: 51.51, method: mwl))
    }

    func testFarSouthInDecember() {
        XCTAssertTrue(LongDays.twilightLastsAllNight(year: 2027, month: 12, day: 21, latitude: -54.8, method: mwl))
        XCTAssertFalse(LongDays.twilightLastsAllNight(year: 2027, month: 6, day: 21, latitude: -54.8, method: mwl))
    }

    func testOneKeyPerPlaceAndSummer() {
        XCTAssertEqual(LongDays.key(year: 2027, month: 6, latitude: 51.51, longitude: -0.13, countryCode: "GB"), "GB:52:0:2027")
        XCTAssertEqual(LongDays.key(year: 2027, month: 8, latitude: 51.4, longitude: -0.2, countryCode: "GB"), "GB:51:0:2027")
        XCTAssertEqual(LongDays.key(year: 2027, month: 12, latitude: -54.8, longitude: -68.3, countryCode: "AR"),
                       LongDays.key(year: 2028, month: 1, latitude: -54.8, longitude: -68.3, countryCode: "AR"))
    }

    func testWordsHaveNoColonsOrDashes() {
        for lang in [RamadanContent.Lang.en, .ms, .id] {
            let w = LongDays.words(lang)
            let text = [w.title, w.body("Fajr", "Isha"), w.close].joined(separator: " ")
            XCTAssertNil(text.range(of: "[:\u{2013}\u{2014}]| - ", options: .regularExpression), text)
            XCTAssertTrue(text.contains("Fajr"))
        }
    }
}
