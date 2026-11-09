import XCTest
@testable import PrayerTimesAsia

/// Your names follow you; the local word only shows when it differs.
final class NamingTests: XCTestCase {
    func testPersonalNamesAreEnglishUnlessThePhoneSpeaksAnother() {
        // Home country no longer decides; an English phone in Singapore sees Fajr.
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "en_SG")), .international)
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "en_PK")), .international)
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "en_AU")), .international)
        XCTAssertEqual(NamingStyle.international.language, "English")
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "ms_MY")), .malay)
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "id_ID")), .indonesian)
    }

    func testPhoneLanguageComesFirstInItsOwnScript() {
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "ar_SA")), .arabicScript)
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "ur_PK")), .urdu)
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "bn_BD")), .bengali)
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "fr_FR")), .french)
        XCTAssertEqual(NamingStyle.personal(locale: Locale(identifier: "tr_TR")), .turkish)
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
