import Foundation

/// The short line under each on-time prayer alert, approved by Ustaz Aarif
/// Raziff. Lines live in data/alert-lines.json (English, Malay, Indonesian).
/// Each prayer has its own lines plus 20 shared ones, handed out by date so
/// the same words rarely come back and never twice on one day. Same rule as
/// web/src/core/alertLines.ts and android core AlertLines.kt.
enum AlertLines {
    private static let order: [Prayer] = [.fajr, .dhuhr, .asr, .maghrib, .isha]

    /// Days since 1970-01-01 for a calendar date (no time zone involved).
    static func dayNumber(year: Int, month: Int, day: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let date = cal.date(from: DateComponents(year: year, month: month, day: day))!
        return Int((date.timeIntervalSince1970 / 86_400).rounded(.down))
    }

    private static func mod(_ a: Int, _ n: Int) -> Int { ((a % n) + n) % n }
    private static func floorDiv(_ a: Int, _ n: Int) -> Int { Int((Double(a) / Double(n)).rounded(.down)) }

    /// The alert line for this prayer on this date, with the prayer's name filled in.
    static func line(_ lang: RamadanContent.Lang, prayer: Prayer, friday: Bool, year: Int, month: Int, day: Int, name: String) -> String {
        let d = dayNumber(year: year, month: month, day: day)
        let k = order.firstIndex(of: prayer) ?? 0
        let set = data[lang] ?? data[.en]!
        let pool: [String], i: Int
        if prayer == .dhuhr && friday {
            pool = set["jumuah"]!; i = mod(floorDiv(d, 7), pool.count)
        } else if mod(d + k, 4) == 0 {
            pool = set["any"]!; i = mod(floorDiv(d * 5 + k, 4), pool.count)
        } else {
            pool = set[prayer.rawValue] ?? set["any"]!; i = mod(d, pool.count)
        }
        return pool[i].replacingOccurrences(of: "{p}", with: name)
    }
}
