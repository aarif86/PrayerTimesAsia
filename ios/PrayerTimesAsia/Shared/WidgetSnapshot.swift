import Foundation

/// What the app hands the widgets: the next week of times (already merged with
/// official MUIS/JAKIM tables) plus how to show them. Lives in the App Group so
/// the widget extension never needs location or network itself.
struct WidgetSnapshot: Codable, Sendable {
    struct Day: Codable, Sendable {
        var year: Int, month: Int, day: Int
        /// Prayer rawValue → time.
        var times: [String: Date]

        var prayerDay: PrayerDay? {
            var t: [Prayer: Date] = [:]
            for p in Prayer.allCases {
                guard let d = times[p.rawValue] else { return nil }
                t[p] = d
            }
            return PrayerDay(year: year, month: month, day: day, times: t)
        }
    }

    var placeName: String
    var flag: String
    var timeZoneID: String
    var naming: NamingStyle
    var use24Hour: Bool
    var sourceLabel: String
    var days: [Day]
    var updated: Date
    /// The user's Hijri ±days, so the big widget's date matches the app.
    var hijriAdjustment: Int? = nil
    /// The Prayer screen style chosen in the app; the big widget follows it
    /// unless the widget is set to a style of its own.
    var style: TodayStyle? = nil
    /// Ramadan fasts in the next week (empty outside Ramadan), so the small
    /// widgets and the Lock Screen count down to Berbuka by day and Imsak at night,
    /// the same as the Ramadan card. The app works out which days are Ramadan.
    var fasts: [Fast]? = nil
    /// "Imsak" and "Berbuka" in the prayer names' language.
    var fastWords: FastWords? = nil

    struct Fast: Codable, Sendable { var imsak: Date; var berbuka: Date }
    struct FastWords: Codable, Sendable { var imsak: String; var berbuka: String }
    enum FastKind: Sendable { case imsak, berbuka }

    static let appGroup = "group.com.prayertimesasia.app"
    private static let key = "widget.snapshot.v1"

    static func load() -> WidgetSnapshot? {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: Self.appGroup)?.set(data, forKey: Self.key)
    }

    var timeZone: TimeZone { TimeZone(identifier: timeZoneID) ?? .current }

    /// Every time in the snapshot, in order.
    var timeline: [(prayer: Prayer, time: Date)] {
        days.compactMap(\.prayerDay).flatMap { $0.ordered }
    }

    func next(after now: Date) -> (prayer: Prayer, time: Date)? {
        timeline.first { $0.time > now }
    }

    func current(at now: Date) -> (prayer: Prayer, time: Date)? {
        timeline.last { $0.time <= now }
    }

    func day(containing now: Date) -> PrayerDay? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.year, .month, .day], from: now)
        return days.first { $0.year == c.year && $0.month == c.month && $0.day == c.day }?.prayerDay
    }

    func format(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeZone = timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = use24Hour ? "HH:mm" : "h:mm a"
        return f.string(from: date)
    }

    func isFriday(_ date: Date) -> Bool {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.component(.weekday, from: date) == 6
    }

    /// In Ramadan: Berbuka from Imsak until Maghrib, then the next fast's Imsak
    /// (tonight or before dawn). Nil outside Ramadan, so the widgets look as before.
    func fastMoment(at now: Date) -> (kind: FastKind, time: Date, label: String, symbol: String)? {
        guard let words = fastWords, let fast = fasts?.first(where: { $0.berbuka > now }) else { return nil }
        if now >= fast.imsak { return (.berbuka, fast.berbuka, words.berbuka, Prayer.maghrib.symbol) }
        // Imsak only when it is today's or tomorrow's, like the Ramadan card.
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: fast.imsak)).day ?? 99
        guard days <= 1 else { return nil }
        return (.imsak, fast.imsak, words.imsak, Prayer.fajr.symbol)
    }

    func name(_ prayer: Prayer, at date: Date) -> String {
        prayer.name(naming, isFriday: isFriday(date))
    }
}
