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

    func testPhoneLanguageComesFirstInItsOwnScript() {
        XCTAssertEqual(NamingStyle.personal(homeCountry: nil, locale: Locale(identifier: "ar_SA")), .arabicScript)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "PK", locale: Locale(identifier: "ur_PK")), .urdu)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "BD", locale: Locale(identifier: "bn_BD")), .bengali)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "FR", locale: Locale(identifier: "fr_FR")), .french)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "SG", locale: Locale(identifier: "tr_TR")), .turkish)
        XCTAssertEqual(NamingStyle.personal(homeCountry: "PK", locale: Locale(identifier: "en_PK")), .southAsian)
    }

    func testEveryLanguageHasEveryName() {
        for style in NamingStyle.allCases {
            for p in Prayer.allCases { XCTAssertNotNil(style.names[p], "\(style) \(p)") }
            XCTAssertEqual(style.hijriMonths.count, 12)
        }
        XCTAssertEqual(Prayer.dhuhr.name(.arabicScript), "الظهر")
        XCTAssertEqual(Prayer.dhuhr.name(.urdu, isFriday: true), "جمعہ")
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
