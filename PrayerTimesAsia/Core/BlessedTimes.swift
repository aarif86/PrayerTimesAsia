import Foundation

/// The extra times behind "Show more" on Today: free, worked out on the phone.
enum BlessedTime: String, CaseIterable, Identifiable, Sendable {
    case imsak, dhuha, midnight, lastThird

    var id: String { rawValue }

    func name(_ style: NamingStyle) -> String {
        switch (self, style) {
        case (.imsak, _): "Imsak"
        case (.dhuha, .malay), (.dhuha, .indonesian): "Dhuha"
        case (.dhuha, _): "Duha"
        case (.midnight, .malay): "Tengah malam"
        case (.midnight, .indonesian): "Tengah malam"
        case (.midnight, _): "Middle of the night"
        case (.lastThird, .malay): "Sepertiga malam terakhir"
        case (.lastThird, .indonesian): "Sepertiga malam terakhir"
        case (.lastThird, _): "Last third of the night"
        }
    }

    /// One line on what the time is and how it is worked out.
    var note: String {
        switch self {
        case .imsak: "10 minutes before Subuh - stop eating for the fast"
        case .dhuha: "Sun a spear's length up (about 4½°)"
        case .midnight: "Halfway from Maghrib to Subuh"
        case .lastThird: "Best time for tahajjud and dua"
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
