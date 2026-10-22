import SwiftUI

/// prayertime.sg gave each prayer its own colour band so you could find the
/// time at a glance. The same idea, in a calmer palette.
extension Prayer {
    var tint: Color {
        switch self {
        case .fajr: Color(red: 0.24, green: 0.62, blue: 0.58)
        case .sunrise: Color(red: 0.56, green: 0.68, blue: 0.42)
        case .dhuhr: Color(red: 0.86, green: 0.68, blue: 0.28)
        case .asr: Color(red: 0.88, green: 0.57, blue: 0.34)
        case .maghrib: Color(red: 0.85, green: 0.45, blue: 0.40)
        case .isha: Color(red: 0.78, green: 0.40, blue: 0.54)
        }
    }
}
