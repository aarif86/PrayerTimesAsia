import XCTest
@testable import PrayerTimesAsia

/// The shared word list is written into the iPhone app in all three languages.
final class AppWordsTests: XCTestCase {
    private let langs: [RamadanContent.Lang] = [.en, .ms, .id]

    func testEveryLineInEveryLanguage() {
        XCTAssertFalse(AppWords.enLines.isEmpty)
        for lang in langs {
            XCTAssertEqual(Set(AppWords.lines(lang).keys), Set(AppWords.enLines.keys), "\(lang) keys match English")
        }
    }

    func testSameHolesAsEnglish() {
        let hole = try! NSRegularExpression(pattern: "\\{[a-z]+\\}")
        func holes(_ s: String) -> Set<String> {
            Set(hole.matches(in: s, range: NSRange(s.startIndex..., in: s)).map { String(s[Range($0.range, in: s)!]) })
        }
        for lang in langs {
            for (key, english) in AppWords.enLines {
                XCTAssertEqual(holes(AppWords.lines(lang)[key] ?? ""), holes(english), "\(lang) \(key)")
            }
        }
    }

    func testNoColonsOrDashesInTheLines() {
        for lang in langs {
            for (key, line) in AppWords.lines(lang) {
                XCTAssertFalse(line.contains(":") || line.contains("\u{2014}") || line.contains("\u{2013}"), "\(lang) \(key)")
            }
        }
    }

    func testReadsALineInEachLanguage() {
        XCTAssertEqual(AppWords.text("common.off", .en), AppWords.enLines["common.off"])
        XCTAssertEqual(AppWords.text("common.off", .ms), AppWords.msLines["common.off"])
        XCTAssertEqual(AppWords.text("common.off", .id), AppWords.idLines["common.off"])
        XCTAssertEqual(AppWords.text("not.a.key", .ms), "")
    }

    func testDeviceLanguage() {
        XCTAssertEqual(AppWords.deviceLang(["ms-MY", "en-GB"]), .ms)
        XCTAssertEqual(AppWords.deviceLang(["id-ID"]), .id)
        XCTAssertEqual(AppWords.deviceLang(["in-ID"]), .id)
        XCTAssertEqual(AppWords.deviceLang(["fr-FR", "ms-MY"]), .ms)
        XCTAssertEqual(AppWords.deviceLang(["ar-SA"]), .en)
        XCTAssertEqual(AppWords.deviceLang([]), .en)
    }
}
