import Foundation

/// The sentences Siri and Shortcuts say for the next prayer and for each time.
/// Built only from the widget snapshot in the App Group, so it works with no
/// location and no network, and says the same times the widgets show.
/// Wording is in English, Malay and Indonesian (follows the App words choice).
enum PrayerSpeech {
    static func lang(_ s: WidgetSnapshot) -> RamadanContent.Lang {
        s.appLang.flatMap { AppLanguageChoice(rawValue: $0)?.lang } ?? AppWords.deviceLang()
    }

    /// "5 minutes", "1 hour 5 minutes", never seconds.
    static func span(_ seconds: TimeInterval, _ lang: RamadanContent.Lang) -> String {
        let total = max(1, Int((seconds / 60).rounded(.up)))
        let h = total / 60, m = total % 60
        func unit(_ n: Int, _ one: String, _ many: String) -> String { "\(n) \(n == 1 ? one : many)" }
        let hour: String, minute: String
        switch lang {
        case .en: hour = unit(h, "hour", "hours"); minute = unit(m, "minute", "minutes")
        case .ms: hour = "\(h) jam"; minute = "\(m) minit"
        case .id: hour = "\(h) jam"; minute = "\(m) menit"
        }
        if h == 0 { return minute }
        return m == 0 ? hour : "\(hour) \(minute)"
    }

    /// The next of the five prayers (Syuruk is not a prayer, so it is skipped).
    static func next(_ s: WidgetSnapshot, now: Date) -> (prayer: Prayer, time: Date)? {
        s.timeline.first { $0.prayer.isObligatory && $0.time > now }
    }

    static let openApp: [RamadanContent.Lang: String] = [
        .en: "Open Prayer Times Asia once to choose your place, then ask again.",
        .ms: "Buka Prayer Times Asia sekali untuk memilih tempat anda, kemudian tanya semula.",
        .id: "Buka Prayer Times Asia sekali untuk memilih tempat Anda, lalu tanya lagi."
    ]

    static func missing(_ lang: RamadanContent.Lang) -> String { openApp[lang] ?? openApp[.en]! }

    /// "Zohor is in 53 minutes, at 1:02 PM."
    static func nextLine(_ s: WidgetSnapshot?, now: Date = .now) -> String {
        guard let s else { return missing(AppWords.deviceLang()) }
        let l = lang(s)
        guard let n = next(s, now: now) else { return missing(l) }
        let name = s.name(n.prayer, at: n.time), span = span(n.time.timeIntervalSince(now), l), at = s.format(n.time)
        switch l {
        case .en: return "\(name) is in \(span), at \(at)."
        case .ms: return "\(name) dalam \(span), pada pukul \(at)."
        case .id: return "\(name) dalam \(span), pukul \(at)."
        }
    }

    /// The time of one prayer today, said as past, now or still to come.
    static func timeLine(_ prayer: Prayer, _ s: WidgetSnapshot?, now: Date = .now) -> String {
        guard let s else { return missing(AppWords.deviceLang()) }
        let l = lang(s)
        guard let day = s.day(containing: now) else { return missing(l) }
        let t = day.time(prayer), name = s.name(prayer, at: t), at = s.format(t)
        let past = t <= now
        switch l {
        case .en: return "\(name) \(past ? "was" : "is") at \(at) today."
        case .ms: return "\(name) \(past ? "tadi" : "hari ini") pada pukul \(at)."
        case .id: return "\(name) \(past ? "tadi" : "hari ini") pukul \(at)."
        }
    }

    /// All five times for today, one after another.
    static func todayLine(_ s: WidgetSnapshot?, now: Date = .now) -> String {
        guard let s else { return missing(AppWords.deviceLang()) }
        let l = lang(s)
        guard let day = s.day(containing: now) else { return missing(l) }
        let parts = Prayer.obligatory.map { "\(s.name($0, at: day.time($0))) \(s.format(day.time($0)))" }
        let head: String
        switch l {
        case .en: head = "Today in \(s.placeName)"
        case .ms: head = "Hari ini di \(s.placeName)"
        case .id: head = "Hari ini di \(s.placeName)"
        }
        return head + ". " + parts.joined(separator: ", ") + "."
    }
}
