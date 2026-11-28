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

    /// Choosing Malay or Indonesian prayer names (Subuh, Zohor) must not turn the
    /// Ramadan page, alert lines or hadith cards into Malay. Only the App words
    /// choice, or a phone set to Malay or Indonesian, may do that.
    func testPrayerNamesNeverChangeTheAppLanguage() {
        // The app language is decided by the choice and the phone alone.
        XCTAssertEqual(AppWords.appLanguage(choice: nil, preferred: ["en-GB"]), .en)
        // The names themselves still follow the setting.
        XCTAssertEqual(Prayer.fajr.name(.malay, isFriday: false), "Subuh")
        XCTAssertEqual(Prayer.fajr.name(.international, isFriday: false), "Fajr")
        // The Ramadan page is built from the app language, so it reads English.
        let t = RamadanWords.In(AppWords.appLanguage(choice: nil, preferred: ["en-GB"]))
        XCTAssertEqual(t(.tonight), "Tonight")
        XCTAssertEqual(t(.doaAndNiat), "Duas and intention")
    }

    func testAppWordsChoiceBeatsThePhoneLanguage() {
        XCTAssertEqual(AppWords.appLanguage(choice: .ms, preferred: ["en-US"]), .ms)
        XCTAssertEqual(AppWords.appLanguage(choice: .id, preferred: ["ms-MY"]), .id)
        XCTAssertEqual(AppWords.appLanguage(choice: .en, preferred: ["id-ID"]), .en)
    }

    func testAutomaticFollowsThePhoneLanguage() {
        XCTAssertEqual(AppWords.appLanguage(choice: nil, preferred: ["ms-SG"]), .ms)
        XCTAssertEqual(AppWords.appLanguage(choice: nil, preferred: ["id-ID"]), .id)
        XCTAssertEqual(AppWords.appLanguage(choice: nil, preferred: ["ar-SA"]), .en)
    }

    func testTheChoiceIsSavedAndOldSettingsStillLoad() throws {
        var p = Preferences()
        XCTAssertNil(p.appLanguageOverride)
        p.appLanguageOverride = .id
        let back = try JSONDecoder().decode(Preferences.self, from: JSONEncoder().encode(p))
        XCTAssertEqual(back.appLanguageOverride, .id)
        // Settings saved before the choice existed have no such field.
        let old = try JSONDecoder().decode(Preferences.self, from: Data("{}".utf8))
        XCTAssertNil(old.appLanguageOverride)
    }

    /// The Hijri calendar writes its day names in the app language, not the prayer names.
    func testCalendarFollowsTheAppLanguage() {
        let lang = AppWords.appLanguage(choice: nil, preferred: ["en-GB"])
        XCTAssertEqual(IslamicDays.name(.aidilfitri, lang: lang), "Eid al-Fitr")
        XCTAssertEqual(IslamicDays.words(lang: lang).today, "Today")
        XCTAssertEqual(HijriEvent.syawal.title(lang: lang), "Eid al-Fitr")
        XCTAssertEqual(IslamicDays.name(.aidilfitri, lang: .ms), "Hari Raya Aidilfitri")
    }

    /// W() is what every screen reads: choosing Malay or Indonesian changes its answer.
    func testScreensReadTheChosenLanguage() {
        let before = AppLanguage.shared.lang
        defer { AppLanguage.shared.lang = before }
        AppLanguage.shared.lang = .ms
        XCTAssertEqual(W("tab.settings"), AppWords.msLines["tab.settings"])
        XCTAssertNotEqual(W("tab.settings"), AppWords.enLines["tab.settings"])
        AppLanguage.shared.lang = .id
        XCTAssertEqual(W("tab.settings"), AppWords.idLines["tab.settings"])
        AppLanguage.shared.lang = .en
        XCTAssertEqual(W("tab.settings"), "Settings")
    }

    /// Every line the screens ask for exists, and in Malay and Indonesian it is not
    /// just the English line again. (Names, numbers and a few shared words may match.)
    func testEveryLineTheScreensUseIsTranslated() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("PrayerTimesAsia")
        guard let files = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else {
            throw XCTSkip("Source folder not found")
        }
        let call = try NSRegularExpression(pattern: "\\bW\\(\"([A-Za-z0-9._]+)\"")
        var keys = Set<String>()
        for case let url as URL in files where url.pathExtension == "swift" && !url.lastPathComponent.hasSuffix("Data.swift") {
            let text = try String(contentsOf: url, encoding: .utf8)
            for m in call.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
                keys.insert(String(text[Range(m.range(at: 1), in: text)!]))
            }
        }
        XCTAssertGreaterThan(keys.count, 300, "found the keys the screens use")
        // Lines that read the same in every language on purpose.
        let sameOK: Set<String> = ["common.ok", "tab.masjid", "tab.falak", "settings.hanafi", "phone.ramadan.taqabbal"]
        for key in keys.sorted() {
            XCTAssertNotNil(AppWords.enLines[key], "\(key) is not in the word list")
            for lang in [RamadanContent.Lang.ms, .id] {
                let line = AppWords.lines(lang)[key] ?? ""
                XCTAssertFalse(line.isEmpty, "\(lang) \(key) is missing")
                if !sameOK.contains(key), AppWords.enLines[key]!.count > 24 {
                    XCTAssertNotEqual(line, AppWords.enLines[key], "\(lang) \(key) is still English")
                }
            }
        }
    }
}
