import XCTest
@testable import PrayerTimesAsia

/// The community cards by country, one a day. Same cases as web/tests/communityCards.test.ts.
final class CommunityCardsTests: XCTestCase {
    private var cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Asia/Singapore")!
        return c
    }()

    private func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 12, _ min: Int = 0) -> Date {
        cal.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
    }

    private func card(_ id: String, _ countries: [String], kind: CommunityCard.Kind = .ours, from: String? = nil, until: String? = nil) -> CommunityCard {
        CommunityCard(id: id, kind: kind, countries: countries, title: id, subtitle: id, site: "\(id).com",
                      link: "https://\(id).com", icon: .globe, from: from, until: until)
    }

    func testBadalAndNasarDigitalEverywhereOneADay() {
        for country in ["SG", "MY", "ID", "VN", "GB"] {
            XCTAssertEqual(CommunityCard.cards(for: country, on: date(2026, 11, 17), calendar: cal).map(\.id), ["badal", "digital"])
        }
        let a = CommunityCard.ofTheDay(for: "SG", on: date(2026, 11, 17, 23, 59), calendar: cal)!.id
        let b = CommunityCard.ofTheDay(for: "SG", on: date(2026, 11, 18, 0, 1), calendar: cal)!.id
        XCTAssertNotEqual(a, b)
        XCTAssertEqual(CommunityCard.ofTheDay(for: "SG", on: date(2026, 11, 19), calendar: cal)!.id, a)
    }

    func testEachCountryGetsItsOwnCardsPlusEverywhere() {
        let all = [card("everywhere", ["*"]), card("sgshop", ["SG"]), card("myshop", ["MY", "BN"])]
        let d = date(2026, 11, 17)
        XCTAssertEqual(CommunityCard.cards(for: "SG", on: d, in: all, calendar: cal).map(\.id), ["everywhere", "sgshop"])
        XCTAssertEqual(CommunityCard.cards(for: "BN", on: d, in: all, calendar: cal).map(\.id), ["everywhere", "myshop"])
        XCTAssertEqual(CommunityCard.cards(for: "FR", on: d, in: all, calendar: cal).map(\.id), ["everywhere"])
    }

    func testPaidCardOnlyBetweenItsDates() {
        let all = [card("paid", ["SG"], kind: .sponsor, from: "2026-12-01", until: "2026-12-31")]
        XCTAssertTrue(CommunityCard.cards(for: "SG", on: date(2026, 11, 30, 23), in: all, calendar: cal).isEmpty)
        XCTAssertEqual(CommunityCard.cards(for: "SG", on: date(2026, 12, 1, 0, 5), in: all, calendar: cal).count, 1)
        XCTAssertEqual(CommunityCard.cards(for: "SG", on: date(2026, 12, 31, 23), in: all, calendar: cal).count, 1)
        XCTAssertNil(CommunityCard.ofTheDay(for: "SG", on: date(2027, 1, 2), in: all, calendar: cal))
    }

    func testLinkTags() {
        XCTAssertEqual(CommunityCard.all[0].url(from: "prayer").absoluteString,
                       "https://badal.sg/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=prayer")
    }
}
