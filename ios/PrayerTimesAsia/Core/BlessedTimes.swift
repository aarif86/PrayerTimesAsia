import Foundation

/// The extra times behind "Show more" on Today: free, worked out on the phone.
enum BlessedTime: String, CaseIterable, Identifiable, Sendable {
    case imsak, dhuha, midnight, lastThird

    var id: String { rawValue }

    /// In English for everyone: Singapore's Malay, Chinese and Indian Muslims
    /// all read these the same way. (The style is kept for a future translation.)
    func name(_ style: NamingStyle) -> String {
        switch self {
        case .imsak: W("today.imsakShort")
        case .dhuha: W("today.dhuhaShort")
        case .midnight: W("phone.blessed.middle")
        case .lastThird: W("phone.blessed.lastThird")
        }
    }

    /// One line on what the time is and how it is worked out.
    var note: String {
        switch self {
        case .imsak: W("today.imsakNote")
        case .dhuha: W("phone.blessed.spear")
        case .midnight: W("phone.blessed.halfway")
        case .lastThird: W("phone.blessed.best")
        }
    }

    var symbol: String {
        switch self {
        case .imsak: "fork.knife"
        case .dhuha: "sun.max"
        case .midnight: "moon.haze"
        case .lastThird: "sparkles"
        }
    }

    /// Times for the night *after* `day` (Maghrib of `day` to Subuh of `nextDay`),
    /// and Dhuha/Imsak of `day`. Imsak only in Ramadan.
    static func compute(day: PrayerDay, nextDay: PrayerDay, coordinates: Coordinates,
                        isRamadan: Bool) -> [(BlessedTime, Date)] {
        var out: [(BlessedTime, Date)] = []
        if isRamadan { out.append((.imsak, day.time(.fajr).addingTimeInterval(-10 * 60))) }
        let noon = Falak.solarNoon(year: day.year, month: day.month, day: day.day, longitude: coordinates.longitude)
        if let dhuha = Falak.time(whenAltitude: 4.5, from: noon, coordinates: coordinates, afternoon: false) {
            out.append((.dhuha, roundUp(max(dhuha, day.time(.sunrise)))))
        }
        let night = nextDay.time(.fajr).timeIntervalSince(day.time(.maghrib))
        out.append((.midnight, roundUp(day.time(.maghrib).addingTimeInterval(night / 2))))
        out.append((.lastThird, roundUp(day.time(.maghrib).addingTimeInterval(night * 2 / 3))))
        return out
    }

    private static func roundUp(_ d: Date) -> Date {
        Date(timeIntervalSince1970: (d.timeIntervalSince1970 / 60).rounded(.up) * 60)
    }
}
