import Foundation

/// The small cards under Show more on the Prayer screen and in Settings. No ad
/// networks, nothing tracked: each card is a plain link. The list lives in
/// data/community-cards.json (written into CommunityCardsData.swift by
/// tools/build_community_cards.py), every card approved by hand against
/// docs/community-cards.md. Same rules as communityCards.ts and CommunityCards.kt.
struct CommunityCard: Identifiable, Hashable, Sendable {
    enum Kind: String, Sendable { case ours, sponsor }
    enum Icon: String, Sendable { case kaaba, globe, shop, heart }

    let id: String
    /// ours = the makers' own services; sponsor = a paid community card, shown with a Sponsored tag.
    let kind: Kind
    /// Two letter country codes, or "*" for everywhere.
    let countries: [String]
    let title: String
    let subtitle: String
    let site: String
    let link: String
    let icon: Icon
    /// First and last day shown (YYYY-MM-DD, the phone's own date).
    let from: String?
    let until: String?

    var isSponsor: Bool { kind == .sponsor }

    /// The website, tagged with where in the app it was tapped so visits show
    /// in the site's own analytics. The app itself records nothing.
    func url(from placement: String) -> URL {
        let sep = link.contains("?") ? "&" : (link.hasSuffix("/") ? "?" : "/?")
        return URL(string: "\(link)\(sep)utm_source=prayertimesasia&utm_medium=app&utm_campaign=\(placement)")!
    }

    /// Every card for this country on this day: its own cards plus the ones for everywhere, in list order.
    static func cards(for country: String, on date: Date, in all: [CommunityCard] = CommunityCard.all, calendar: Calendar = .current) -> [CommunityCard] {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        let today = String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
        return all.filter { card in
            (card.countries.contains("*") || card.countries.contains(country))
                && (card.from.map { $0 <= today } ?? true)
                && (card.until.map { today <= $0 } ?? true)
        }
    }

    /// Today's one card on the Prayer screen. It moves to the next one each day.
    static func ofTheDay(for country: String, on date: Date, in all: [CommunityCard] = CommunityCard.all, calendar: Calendar = .current) -> CommunityCard? {
        let pool = cards(for: country, on: date, in: all, calendar: calendar)
        guard !pool.isEmpty else { return nil }
        return pool[dayNumber(date, calendar: calendar) % pool.count]
    }

    /// The makers' own cards, listed in Settings.
    static func ours(for country: String, on date: Date = Date()) -> [CommunityCard] {
        cards(for: country, on: date).filter { $0.kind == .ours }
    }

    /// Days since 1 January 1970 by the phone's own calendar, so the card changes at local midnight.
    static func dayNumber(_ date: Date, calendar: Calendar = .current) -> Int {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let midnight = utc.date(from: DateComponents(year: c.year, month: c.month, day: c.day))!
        return Int(floor(midnight.timeIntervalSince1970 / 86_400))
    }
}
