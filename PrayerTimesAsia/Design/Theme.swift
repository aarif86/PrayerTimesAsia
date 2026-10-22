import SwiftUI

enum Theme {
    static let corner: CGFloat = 22
    static let gutter: CGFloat = 20
    /// Qibla gold: bright on dark skies, deeper on light ones so it stays readable.
    static let gold = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 1, green: 0.84, blue: 0.5, alpha: 1)
        : UIColor(red: 0.72, green: 0.5, blue: 0.04, alpha: 1) })

    static func display(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

/// Frosted card used on top of the sky.
struct GlassCard<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1))
    }
}

struct Chip: View {
    let text: String
    var systemImage: String?

    var body: some View {
        HStack(spacing: 6) {
            if let systemImage { Image(systemName: systemImage) }
            Text(text)
        }
        .font(.footnote.weight(.semibold))
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color.primary.opacity(0.14), in: Capsule())
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.18), lineWidth: 1))
    }
}

enum Countdown {
    /// "1:05:09" / "12:30" style countdown text.
    static func text(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds.rounded(.up)))
        let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, sec) }
        return String(format: "%d:%02d", m, sec)
    }
}

/// A time with its AM/PM set smaller on the same baseline. Never wraps.
struct TimeText: View {
    let parts: (time: String, suffix: String?)
    var size: CGFloat = 28
    var weight: Font.Weight = .semibold

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(parts.time).font(Theme.display(size, weight)).monospacedDigit()
            if let suffix = parts.suffix {
                Text(suffix).font(Theme.display(size * 0.5, .bold)).opacity(0.7)
            }
        }
        .lineLimit(1)
        .fixedSize()
        .accessibilityElement(children: .combine)
    }
}

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

extension BlessedTime {
    var tint: Color { Color(red: 0.55, green: 0.5, blue: 0.95) }
}
