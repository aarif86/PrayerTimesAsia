import Foundation

/// Steps whole calendar days in a place's time zone.
///
/// Adding 86 400 seconds is not "one day later" on a clock change day: late on
/// the night before spring forward it lands two dates ahead, and early on the
/// day the clocks go back it stays on the same date. Going via local noon on the
/// target date is always safe, since no clock change happens at noon.
enum DayStep {
    /// Local noon `days` calendar days after the date that `date` falls on in `timeZone`.
    static func noon(_ date: Date, plus days: Int, in timeZone: TimeZone) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        var c = cal.dateComponents([.year, .month, .day], from: date)
        c.hour = 12
        guard let noon = cal.date(from: c),
              let target = cal.date(byAdding: .day, value: days, to: noon) else {
            return date.addingTimeInterval(Double(days) * 86_400)
        }
        return target
    }
}
