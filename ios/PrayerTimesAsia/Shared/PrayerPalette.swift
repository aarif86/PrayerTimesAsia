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

extension Color {
    /// For words drawn in a colour: as is on dark skies; on light skies, the same
    /// hue made deep enough to read (about 5 to 1 on the light sky). The pale
    /// prayer and peach colours are fine for arcs and dots but too faint as text.
    static func readableText(red r: Double, green g: Double, blue b: Double) -> Color {
        func lin(_ v: Double) -> Double { v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        func gam(_ v: Double) -> Double { let v = min(1, max(0, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * pow(v, 1 / 2.4) - 0.055 }
        let l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
        let k = l > 0.13 ? 0.13 / l : 1
        let light = UIColor(red: gam(lin(r) * k), green: gam(lin(g) * k), blue: gam(lin(b) * k), alpha: 1)
        let dark = UIColor(red: r, green: g, blue: b, alpha: 1)
        return Color(UIColor { $0.userInterfaceStyle == .dark ? dark : light })
    }
}

extension Prayer {
    /// The prayer's colour for words ("NOW", the current prayer's name, "in 5m").
    var textTint: Color {
        switch self {
        case .fajr: .readableText(red: 0.50, green: 0.61, blue: 0.88)
        case .sunrise: .readableText(red: 0.95, green: 0.77, blue: 0.42)
        case .dhuhr: .readableText(red: 0.95, green: 0.60, blue: 0.20)
        case .asr: .readableText(red: 0.91, green: 0.50, blue: 0.25)
        case .maghrib: .readableText(red: 0.87, green: 0.36, blue: 0.33)
        case .isha: .readableText(red: 0.42, green: 0.37, blue: 0.76)
        }
    }
}
