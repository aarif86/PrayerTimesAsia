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

    func name(_ prayer: Prayer, at date: Date) -> String {
        prayer.name(naming, isFriday: isFriday(date))
    }
}
