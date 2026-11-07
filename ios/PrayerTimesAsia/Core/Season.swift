import Foundation

/// Ramadan and Syawal, the way the user's community counts them.
///
/// The Umm al-Qura calendar (plus the user's ± day adjustment) is only the
/// estimate. When the user's authority (MUIS, Malaysia's Penyimpan Mohor Besar
/// Raja-Raja, Kemenag, ...) has published or announced the first day of Ramadan
/// or Syawal in data/calendar.json, that date wins, so Imsak, Berbuka and Raya
/// appear on the days people actually fast and celebrate.
///
/// Same rules as web/src/core/season.ts and android core Season.kt.
struct CivilDay: Hashable, Comparable, Sendable {
    var year: Int, month: Int, day: Int

    private static let utc: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    var dayNumber: Int {
        let d = Self.utc.date(from: DateComponents(year: year, month: month, day: day))!
        return Int((d.timeIntervalSince1970 / 86_400).rounded())
    }

    init(year: Int, month: Int, day: Int) { self.year = year; self.month = month; self.day = day }

    init(dayNumber n: Int) {
        let c = Self.utc.dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: Double(n) * 86_400))
        self.init(year: c.year!, month: c.month!, day: c.day!)
    }

    /// The local calendar day containing `date`.
    init(_ date: Date, timeZone: TimeZone) {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.year, .month, .day], from: date)
        self.init(year: c.year!, month: c.month!, day: c.day!)
    }

    init?(_ text: String) {
        let p = text.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        self.init(year: p[0], month: p[1], day: p[2])
    }

    func adding(_ days: Int) -> CivilDay { CivilDay(dayNumber: dayNumber + days) }
    func days(to other: CivilDay) -> Int { other.dayNumber - dayNumber }
    var key: String { String(format: "%04d-%02d-%02d", year, month, day) }
    /// Noon on this day in `timeZone`.
    func noon(in timeZone: TimeZone) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }

    static func < (a: CivilDay, b: CivilDay) -> Bool { a.dayNumber < b.dayNumber }
}

/// For testers: pretend today is one of these days, to try every part of Ramadan and Syawal.
enum SeasonPreview: String, Codable, CaseIterable, Identifiable, Sendable {
    case off, sighting, ramadan, lastTen, raya, syawal
    var id: String { rawValue }
    var label: String {
        switch self {
        case .off: "Off (real dates)"
        case .sighting: "Moon sighting night (29 Syaaban)"
        case .ramadan: "Ramadan (day 12)"
        case .lastTen: "Last ten nights (day 26)"
        case .raya: "Hari Raya morning (1 Syawal)"
        case .syawal: "Syawal (day 8)"
        }
    }
    var target: (month: Int, day: Int)? {
        switch self {
        case .off: nil
        case .sighting: (8, 29)
        case .ramadan: (9, 12)
        case .lastTen: (9, 26)
        case .raya: (10, 1)
        case .syawal: (10, 8)
        }
    }
}

enum Season {
    enum Phase: Sendable { case none, syaaban, ramadan, raya, syawal }

    struct Info: Sendable {
        var hijri: Hijri.HijriDate
        var phase: Phase
        var ramadanDay: Int?
        var syawalDay: Int?
        /// The Ramadan night that begins at Maghrib this evening (night 1 is the evening before the first fast).
        var nightTonight: Int?
        var lastTen: Bool
        var oddNight: Bool
        var nuzulQuran: Bool
        var sightingTonight: HijriEvent?
        /// What the authority has said about the next first day, when it has.
        var nextStart: (event: HijriEvent, day: CivilDay, announced: Bool)?
    }

    /// The Umm al-Qura date of a civil day, shifted by the user's adjustment.
    static func baseHijri(_ g: CivilDay, adjustment: Int = 0) -> Hijri.HijriDate {
        Hijri.date(g.noon(in: TimeZone(identifier: "UTC")!), timeZone: TimeZone(identifier: "UTC")!, adjustment: adjustment)
    }

    /// The authority's own date for an event: an announcement beats its published expectation.
    static func authorityDate(_ list: [CalendarAnnouncement], authority: String?, event: HijriEvent, hijriYear: Int) -> (day: CivilDay, announced: Bool)? {
        guard let authority else { return nil }
        let mine = list.filter { $0.authority == authority && $0.event == event && $0.hijriYear == hijriYear }
        guard let pick = mine.first(where: { $0.status == .announced }) ?? mine.first, let day = CivilDay(pick.date) else { return nil }
        return (day, pick.status == .announced)
    }

    /// The Hijri date of a civil day for this community: around Ramadan and Syawal
    /// it follows the authority's first days; elsewhere it is the adjusted estimate.
    static func communityHijri(_ g: CivilDay, adjustment: Int, announcements list: [CalendarAnnouncement], authority: String?) -> Hijri.HijriDate {
        let base = baseHijri(g, adjustment: adjustment)
        guard (8...10).contains(base.month) else { return base }
        let y = base.year, n = g.dayNumber
        let r = authorityDate(list, authority: authority, event: .ramadan, hijriYear: y)
        let s = authorityDate(list, authority: authority, event: .syawal, hijriYear: y)
        if let s {
            let sn = s.day.dayNumber
            if n >= sn && n < sn + 29 { return .init(day: n - sn + 1, month: 10, year: y) }
        }
        if let r {
            let rn = r.day.dayNumber
            let end = s?.day.dayNumber ?? rn + 30
            if n >= rn && n < end { return .init(day: min(30, n - rn + 1), month: 9, year: y) }
            if n < rn && base.month >= 9 { return .init(day: 30 - (rn - n) + 1, month: 8, year: y) }
        } else if let s {
            // Raya announced without a start date: count back from it.
            let sn = s.day.dayNumber
            if n < sn && base.month == 10 { return .init(day: 30 - (sn - n) + 1, month: 9, year: y) }
        }
        return base
    }

    /// The Gregorian day of an Umm al-Qura date.
    static func gregorian(hijriYear: Int, month: Int, day: Int) -> CivilDay? {
        guard let c = CalendarSanad.expected(.ramadan, hijriYear: hijriYear) else { return nil }
        // Start from 1 Ramadan's date and walk to the month and day asked for.
        var g = CivilDay(year: c.year!, month: c.month!, day: c.day!)
        let target = (month - 9) * 30 + (day - 1)
        g = g.adding(Int(Double(target) * 29.53 / 30))
        for delta in [0, 1, -1, 2, -2, 3, -3, 4, -4] {
            let d = g.adding(delta)
            let h = baseHijri(d)
            if h.year == hijriYear && h.month == month && h.day == day { return d }
        }
        return nil
    }

    /// How many days to move "today" so it lands on the tester's chosen day.
    static func previewShift(today: CivilDay, preview: SeasonPreview) -> Int {
        guard let t = preview.target else { return 0 }
        let h = baseHijri(today)
        for year in [h.year, h.year + 1, h.year - 1] {
            if let g = gregorian(hijriYear: year, month: t.month, day: t.day) { return today.days(to: g) }
        }
        return 0
    }

    static func info(_ hijri: Hijri.HijriDate, nextStart: (event: HijriEvent, day: CivilDay, announced: Bool)? = nil) -> Info {
        let m = hijri.month, d = hijri.day
        var phase: Phase = .none
        if m == 8 && d >= 15 { phase = .syaaban }
        if m == 9 { phase = .ramadan }
        if m == 10 { phase = d == 1 ? .raya : .syawal }
        var night: Int?
        if m == 9 && d < 30 { night = d + 1 }
        if m == 8 && d >= 29 { night = 1 }
        let lastTen = (night ?? 0) >= 21
        return Info(hijri: hijri, phase: phase, ramadanDay: m == 9 ? d : nil, syawalDay: m == 10 ? d : nil,
                    nightTonight: night, lastTen: lastTen, oddNight: lastTen && (night ?? 0) % 2 == 1,
                    nuzulQuran: m == 9 && d == 17,
                    sightingTonight: d == 29 && m == 8 ? .ramadan : d == 29 && m == 9 ? .syawal : nil,
                    nextStart: nextStart)
    }
}
