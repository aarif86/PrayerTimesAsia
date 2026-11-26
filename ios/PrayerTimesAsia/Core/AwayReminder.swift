import Foundation

/// Early reminders when away from home. Same rules as web core/away.ts and
/// android core AwayReminder.kt.
///
/// "Away" means the place the app shows is more than `awayKm` from the home the
/// user confirmed. Home and the check stay on the device.
enum AwayReminder {
    static let awayKm = 5.0
    /// How early the away reminder can be, in minutes. 0 is off.
    static let choices = [15, 30, 45, 60]
    static let prayers: [Prayer] = Prayer.obligatory

    /// Fajr starts Off: most people are asleep. The rest start at 1 hour.
    static let defaultMinutes: [String: Int] = ["fajr": 0, "dhuhr": 60, "asr": 60, "maghrib": 60, "isha": 60]

    static func isAway(home: Place?, homeConfirmed: Bool, here: Place?) -> Bool {
        guard let home, homeConfirmed, let here else { return false }
        return Geo.distanceKm(home.coordinates, here.coordinates) > awayKm
    }

    /// Keep only the five prayers, each with Off or one of the choices.
    static func clean(_ raw: [String: Int]?) -> [String: Int] {
        var out = defaultMinutes
        for (k, v) in raw ?? [:] where out[k] != nil && (v == 0 || choices.contains(v)) { out[k] = v }
        return out
    }

    /// The one early reminder a prayer gets, in minutes, or 0 for none. Away uses the
    /// away choice (when that switch is on), at home uses the old single early reminder.
    static func minutes(_ prayer: Prayer, away: Bool, awayOn: Bool, awayMinutes: [String: Int], atHome: Int, hasAlarm: Bool) -> Int {
        if away && awayOn && prayer != .sunrise {
            // A Fajr alarm already wakes the person: no early reminder on top of it.
            if prayer == .fajr && hasAlarm { return 0 }
            return awayMinutes[prayer.rawValue] ?? 0
        }
        return atHome
    }
}
