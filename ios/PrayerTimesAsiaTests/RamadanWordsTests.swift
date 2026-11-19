import XCTest
@testable import PrayerTimesAsia

/// The Ramadan page and card have every line in English, Malay and Indonesian.
final class RamadanWordsTests: XCTestCase {
    private let langs: [RamadanContent.Lang] = [.en, .ms, .id]

    func testEveryLineInEveryLanguage() {
        for lang in langs {
            for key in RamadanWordKey.allCases {
                XCTAssertNotNil(RamadanWords.data[lang]?[key.rawValue], "\(lang) \(key)")
                let line = RamadanWords.text(key, lang)
                XCTAssertFalse(line.contains(":"), "\(lang) \(key) has a colon")
            }
            for m in FastMark.allCases { XCTAssertFalse(RamadanWords.mark(m, lang).isEmpty, "\(lang) \(m)") }
        }
    }

    func testFillsInTheHoles() {
        XCTAssertEqual(RamadanWords.text(.beginsInDays, .en, ["n": 12]), "Ramadan in about 12 days")
        XCTAssertEqual(RamadanWords.text(.beginsInDays, .ms, ["n": 12]), "Lebih kurang 12 hari lagi menjelang Ramadan")
        XCTAssertEqual(RamadanWords.text(.fastsToReplace, .en, ["n": 1]), "1 Ramadan fast to replace.")
        XCTAssertEqual(RamadanWords.text(.fastsToReplace, .en, ["n": 3]), "3 Ramadan fasts to replace.")
        XCTAssertEqual(RamadanWords.mark(.travel, .id), "Bepergian")
        XCTAssertEqual(RamadanWords.letter(.period, .ms), "H")
        XCTAssertEqual(RamadanWords.In(.id)(.oddNight, ["n": 27]), "Malam ini malam 27, salah satu malam ganjil. Carilah Lailatul Qadar.")
    }
}
