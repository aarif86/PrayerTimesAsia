import Foundation

enum Hijri {
    struct HijriDate: Equatable { let day: Int, month: Int, year: Int }

    /// Umm al-Qura date, shifted by the user's ±days adjustment (sighting-based
    /// calendars in Southeast Asia can be a day apart from Makkah).
    static func date(_ date: Date, timeZone: TimeZone, adjustment: Int = 0) -> HijriDate {
        var cal = Calendar(identifier: .islamicUmmAlQura)
        cal.timeZone = timeZone
        let shifted = cal.date(byAdding: .day, value: adjustment, to: date) ?? date
        let c = cal.dateComponents([.day, .month, .year], from: shifted)
        return HijriDate(day: c.day ?? 1, month: c.month ?? 1, year: c.year ?? 1448)
    }

    static func isRamadan(_ date: Date, timeZone: TimeZone, adjustment: Int = 0) -> Bool {
        self.date(date, timeZone: timeZone, adjustment: adjustment).month == 9
    }

    static func format(_ date: Date, timeZone: TimeZone, style: NamingStyle, adjustment: Int = 0) -> String {
        let h = self.date(date, timeZone: timeZone, adjustment: adjustment)
        let name = style.hijriMonths[max(0, min(11, h.month - 1))]
        return "\(h.day) \(name) \(h.year)"
    }
}
