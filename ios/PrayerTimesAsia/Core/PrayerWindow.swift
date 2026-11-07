import Foundation

/// How long each prayer stays open, so the Prayer screen can say "Zohor is
/// open until 3:58 PM, 1h 40m left". Shafi'i reckoning, the same as the web
/// (web/src/core/window.ts) and Android (PrayerWindow.kt):
///  - Subuh until sunrise, Zohor until Asar, Asar until Maghrib, Maghrib until Isyak
///  - Isyak until Subuh (the owner's choice: no midnight line, so Isyak has no
///    "time running out" nudge, which would fall in the night)
/// Between sunrise and Zohor no obligatory prayer is open.
struct PrayerWindow: Equatable, Sendable {
    let prayer: Prayer
    let start: Date
    let end: Date

    /// The windows that start on `day`, in order. Isyak runs into `nextDay`.
    static func windows(of day: PrayerDay, next nextDay: PrayerDay) -> [PrayerWindow] {
        let maghrib = day.time(.maghrib)
        return [
            PrayerWindow(prayer: .fajr, start: day.time(.fajr), end: day.time(.sunrise)),
            PrayerWindow(prayer: .dhuhr, start: day.time(.dhuhr), end: day.time(.asr)),
            PrayerWindow(prayer: .asr, start: day.time(.asr), end: maghrib),
            PrayerWindow(prayer: .maghrib, start: maghrib, end: day.time(.isha)),
            PrayerWindow(prayer: .isha, start: day.time(.isha), end: nextDay.time(.fajr)),
        ]
    }

    /// The prayer open at `now`, or nil between sunrise and Zohor.
    static func open(at now: Date, yesterday: PrayerDay, today: PrayerDay, tomorrow: PrayerDay) -> PrayerWindow? {
        (windows(of: yesterday, next: today) + windows(of: today, next: tomorrow))
            .first { $0.start <= now && now < $0.end }
    }

    /// When the "time is running out" nudge fires: 30 minutes before the end, or
    /// a third of a shorter window. Isyak gets none (see above).
    var nudgeAt: Date {
        let third = floor(end.timeIntervalSince(start) / 3 / 60) * 60
        return end.addingTimeInterval(-min(30 * 60, third))
    }

    /// Whether a minute of the day (0 to 1439) falls in quiet hours that may wrap past midnight.
    static func inQuietHours(_ minute: Int, from: Int, to: Int) -> Bool {
        if from == to { return false }
        return from < to ? (minute >= from && minute < to) : (minute >= from || minute < to)
    }
}
