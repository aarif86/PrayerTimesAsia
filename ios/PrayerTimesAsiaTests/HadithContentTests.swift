import XCTest
@testable import PrayerTimesAsia

/// The hadith around the app: complete, plain to read, and on unless turned off.
final class HadithContentTests: XCTestCase {
    func testEveryHadithIsComplete() {
        XCTAssertEqual(Hadith.all.count, Hadith.ID.allCases.count)
        for h in Hadith.all {
            XCTAssertFalse(h.arabic.isEmpty)
            for lang in [RamadanContent.Lang.en, .ms, .id] {
                XCTAssertFalse(h.meaning(lang).contains(":"), "\(h.id) has a colon")
                XCTAssertFalse(h.source(lang).isEmpty)
            }
        }
    }

    func testAlertLineNamesTheBookOnly() {
        XCTAssertEqual(Hadith.of(.azan).alertLine(.en), "“When you hear the azan, say what the muazzin says.” al Bukhari")
    }

    func testOnByDefaultAndOldSettingsKeepIt() throws {
        let old = try JSONDecoder().decode(Preferences.self, from: Data("{}".utf8))
        XCTAssertTrue(old.showHadith)
        XCTAssertTrue(old.hadithInAlerts)
        XCTAssertEqual(old.hiddenHadith, [])
    }
}
