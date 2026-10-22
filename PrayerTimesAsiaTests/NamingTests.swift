import XCTest
@testable import PrayerTimesAsia

/// Your names follow you; the local word only shows when it differs.
final class NamingTests: XCTestCase {
    func testPersonalNamesComeFromHomeThenPhone() {
        let english = Locale(identifier: "en_AU")
        XCTAssertEqual(NamingStyle.personal(homeCountry: "SG", locale: english), .malay)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "ID", locale: english), .indonesian)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "TR", locale: english), .turkish)
        XCTAssertEqual(NamingStyle.personal(homeCountry: nil, locale: english), .international)
        XCTAssertEqual(NamingStyle.personal(homeCountry: nil, locale: Locale(identifier: "ms_MY")), .malay)
        XCTAssertEqual(NamingStyle.personal(homeCountry: nil, locale: Locale(identifier: "en_PK")), .southAsian)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "AU", locale: Locale(identifier: "id_ID")), .indonesian)
    }

    func testAuthoritySpellings() {
        XCTAssertEqual(Prayer.dhuhr.name(.malay), "Zohor")          // MUIS / JAKIM
        XCTAssertEqual(Prayer.dhuhr.name(.indonesian), "Dzuhur")    // Kemenag
        XCTAssertEqual(Prayer.fajr.name(.international), "Fajr")
        XCTAssertEqual(Prayer.dhuhr.name(.turkish, isFriday: true), "Cuma")
    }

    func testOldSavedChoiceStillDecodes() throws {
        // Earlier builds saved the international style as "arabic".
        XCTAssertEqual(try JSONDecoder().decode(NamingStyle.self, from: Data("\"arabic\"".utf8)), .international)
    }
}
