import XCTest
@testable import PrayerTimesAsia

/// Masjid links from a masjid screen's QR code, read exactly like the web and
/// Android apps do (testdata/masjid-links.json is shared by all three).
final class MasjidLinkTests: XCTestCase {
    private struct Cases: Decodable {
        struct Valid: Decodable { let link: String; let expected: MasjidLink }
        let valid: [Valid]
        let invalid: [String]
    }

    private func cases() throws -> Cases {
        try JSONDecoder().decode(Cases.self, from: Data(contentsOf: ExpectedTimes.directory.appendingPathComponent("masjid-links.json")))
    }

    func testReadsTheSharedLinks() throws {
        let c = try cases()
        XCTAssertFalse(c.valid.isEmpty)
        for v in c.valid {
            XCTAssertEqual(MasjidLink.parse(v.link), v.expected, v.link)
        }
    }

    func testRefusesBrokenLinks() throws {
        for link in try cases().invalid {
            XCTAssertNil(MasjidLink.parse(link), link)
        }
    }

    func testYourMasjidGivesJamaahTimes() throws {
        let link = try XCTUnwrap(MasjidLink.parse("prayertimesasia://masjid?n=Masjid+Ujian&ll=1.3721,103.9474&tz=Asia/Singapore&i=15,13:15,,5,&j=13:00"))
        let tz = TimeZone(identifier: "Asia/Singapore")!
        let day = PrayerEngine.compute(for: Date(timeIntervalSince1970: 1_793_000_000), in: tz,
                                       at: link.coordinates, method: CalculationMethod.with(id: "muis")!, asr: .standard)
        let jamaah = link.profile.jamaahTimes(for: day, timeZone: tz, isFriday: false)
        XCTAssertEqual(jamaah[.fajr], day.time(.fajr).addingTimeInterval(15 * 60))
        XCTAssertEqual(jamaah[.maghrib], day.time(.maghrib).addingTimeInterval(5 * 60))
        XCTAssertNil(jamaah[.asr])
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        XCTAssertEqual(cal.dateComponents([.hour, .minute], from: jamaah[.dhuhr]!), DateComponents(hour: 13, minute: 15))
    }
}
