import SwiftUI

/// Each prayer's colour is the sky at that time of day: dawn blue for Subuh,
/// morning gold, the hot noon sun, warm afternoon amber, sunset red, and the
/// indigo of night. Used by the Day Dial, the prayer rows and the widget.
extension Prayer {
    var tint: Color {
        switch self {
        case .fajr: Color(red: 0.50, green: 0.61, blue: 0.88)
        case .sunrise: Color(red: 0.95, green: 0.77, blue: 0.42)
        case .dhuhr: Color(red: 0.95, green: 0.60, blue: 0.20)
        case .asr: Color(red: 0.91, green: 0.50, blue: 0.25)
        case .maghrib: Color(red: 0.87, green: 0.36, blue: 0.33)
        case .isha: Color(red: 0.42, green: 0.37, blue: 0.76)
        }
    }
}

/// The colours of the classic Singapore timetable, a shade calmer.
enum BandsPalette {
    static let header = Color(white: 0.17)
    static let dateBar = Color(white: 0.24)
    static func color(_ prayer: Prayer) -> Color {
        switch prayer {
        case .fajr: Color(red: 0.13, green: 0.43, blue: 0.36)
        case .sunrise: Color(red: 0.56, green: 0.66, blue: 0.32)
        case .dhuhr: Color(red: 0.85, green: 0.67, blue: 0.13)
        case .asr: Color(red: 0.89, green: 0.58, blue: 0.32)
        case .maghrib: Color(red: 0.88, green: 0.43, blue: 0.33)
        case .isha: Color(red: 0.86, green: 0.31, blue: 0.35)
        }
    }
}
