import Foundation

/// The sanad idea applied to the calendar (brief v03 §7.1): when Ramadan,
/// Eid and the new year begin, per authority, with the source of each date.
/// Before an authority announces, only the astronomical estimate is shown,
/// clearly labelled as a projection.
enum HijriEvent: String, Codable, CaseIterable, Identifiable, Sendable {
    case ramadan = "1_ramadan"
    case syawal = "1_syawal"
    case adha = "10_zulhijjah"
    case muharram = "1_muharram"

    var id: String { rawValue }
    var hijriMonth: Int { switch self { case .ramadan: 9; case .syawal: 10; case .adha: 12; case .muharram: 1 } }
    var hijriDay: Int { self == .adha ? 10 : 1 }

    func title(_ style: NamingStyle) -> String {
        switch (self, style) {
        case (.ramadan, _): "1 Ramadan"
        case (.syawal, .malay): "Hari Raya Aidilfitri"
        case (.syawal, .indonesian): "Idul Fitri"
        case (.syawal, _): "Eid al-Fitr"
        case (.adha, .malay): "Hari Raya Aidiladha"
        case (.adha, .indonesian): "Idul Adha"
        case (.adha, _): "Eid al-Adha"
        case (.muharram, .malay), (.muharram, .indonesian): "Awal Muharram"
        case (.muharram, _): "Islamic New Year"
        }
    }
}

/// One authority's date for one event, from data/calendar.json.
struct CalendarAnnouncement: Codable, Hashable, Sendable {
    enum Status: String, Codable, Sendable { case expected, announced }

    var event: HijriEvent
    var hijriYear: Int
    var authority: String
    var country: String
    /// "yyyy-MM-dd" (Gregorian, local).
    var date: String
    var status: Status
    /// rukyah | hisab | umm_al_qura | following_other_authority
    var basis: String
    var sourceURL: String?
    var announcedAt: String?

    enum CodingKeys: String, CodingKey {
        case event, authority, country, date, status, basis
        case hijriYear = "hijri_year", sourceURL = "source_url", announcedAt = "announced_at"
    }

    var basisLabel: String {
        switch basis {
        case "rukyah": "moon sighting"
        case "hisab": "calculation"
        case "umm_al_qura": "Umm al-Qura calendar"
        case "following_other_authority": "follows another authority"
        default: basis
        }
    }

    var gregorian: DateComponents? {
        let p = date.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return DateComponents(year: p[0], month: p[1], day: p[2])
    }
}

struct CalendarDataset: Codable, Sendable {
    var version: Int
    var licence: String
    var announcements: [CalendarAnnouncement]
}

enum CalendarSanad {
    struct Authority: Identifiable, Hashable, Sendable {
        let id: String
        let name: String
        let country: String
    }

    /// Who decides the dates, by country. Extend as stewards join.
    static let authorities: [Authority] = [
        Authority(id: "MUIS", name: "MUIS (Singapore)", country: "SG"),
        Authority(id: "JAKIM", name: "Penyimpan Mohor Besar Raja-Raja (Malaysia)", country: "MY"),
        Authority(id: "KEMENAG", name: "Kemenag (Indonesia)", country: "ID"),
        Authority(id: "MUHAMMADIYAH", name: "Muhammadiyah (Indonesia)", country: "ID"),
        Authority(id: "KHEU", name: "Ministry of Religious Affairs (Brunei)", country: "BN"),
        Authority(id: "CHULARAJMONTRI", name: "Chularajmontri (Thailand)", country: "TH"),
        Authority(id: "KMF", name: "Korea Muslim Federation", country: "KR"),
        Authority(id: "UMMALQURA", name: "Saudi Arabia (Umm al-Qura / Supreme Court)", country: "SA"),
        Authority(id: "DIYANET", name: "Diyanet (Türkiye)", country: "TR"),
    ]

    static func defaultAuthority(country: String) -> String? {
        authorities.first { $0.country == country }?.id
    }

    static func authorityName(_ id: String) -> String {
        authorities.first { $0.id == id }?.name ?? id
    }

    /// The Umm al-Qura calendar's Gregorian date for an event: the astronomical
    /// estimate shown before any announcement.
    static func expected(_ event: HijriEvent, hijriYear: Int) -> DateComponents? {
        var hijri = Calendar(identifier: .islamicUmmAlQura)
        hijri.timeZone = TimeZone(identifier: "UTC")!
        guard let date = hijri.date(from: DateComponents(year: hijriYear, month: event.hijriMonth, day: event.hijriDay)) else { return nil }
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = TimeZone(identifier: "UTC")!
        return greg.dateComponents([.year, .month, .day], from: date)
    }

    struct Upcoming: Identifiable, Hashable, Sendable {
        let event: HijriEvent
        let hijriYear: Int
        var id: String { "\(event.rawValue)-\(hijriYear)" }
    }

    /// The next `count` events on or after `date`.
    static func upcoming(after date: Date, timeZone: TimeZone, count: Int = 4) -> [Upcoming] {
        let today = Hijri.date(date, timeZone: timeZone)
        var out: [(HijriEvent, Int)] = []
        for year in today.year...(today.year + 1) {
            for event in [HijriEvent.muharram, .ramadan, .syawal, .adha] {
                let ahead = (year, event.hijriMonth, event.hijriDay) >= (today.year, today.month, today.day)
                if ahead { out.append((event, year)) }
            }
        }
        return out.prefix(count).map { Upcoming(event: $0.0, hijriYear: $0.1) }
    }
}
