import SwiftUI

/// The signature of the app: the background is the sky outside, right now.
/// prayertime.sg gave each prayer a colour band; here those colours flow into
/// each other through the day, keyed to the real prayer times at your location.
struct RGB: Equatable {
    var r: Double, g: Double, b: Double

    init(_ hex: UInt32) {
        r = Double((hex >> 16) & 0xFF) / 255
        g = Double((hex >> 8) & 0xFF) / 255
        b = Double(hex & 0xFF) / 255
    }

    init(r: Double, g: Double, b: Double) { self.r = r; self.g = g; self.b = b }

    func mix(_ other: RGB, _ t: Double) -> RGB {
        RGB(r: r + (other.r - r) * t, g: g + (other.g - g) * t, b: b + (other.b - b) * t)
    }

    var color: Color { Color(red: r, green: g, blue: b) }
}

struct SkyColors: Equatable {
    var top: RGB
    var bottom: RGB
    /// Accent used for the "now" highlight and the sun.
    var glow: RGB

    static func mix(_ a: SkyColors, _ b: SkyColors, _ t: Double) -> SkyColors {
        SkyColors(top: a.top.mix(b.top, t), bottom: a.bottom.mix(b.bottom, t), glow: a.glow.mix(b.glow, t))
    }

    static let night = SkyColors(top: RGB(0x060A1C), bottom: RGB(0x1A1E48), glow: RGB(0x9AA6FF))
    static let preDawn = SkyColors(top: RGB(0x0C1A3A), bottom: RGB(0x3D4E80), glow: RGB(0x8FB4FF))
    static let dawn = SkyColors(top: RGB(0x2F5E99), bottom: RGB(0xF0A07E), glow: RGB(0xFFC59A))
    static let morning = SkyColors(top: RGB(0x2D7FC4), bottom: RGB(0x9CD2EE), glow: RGB(0xFFE7A6))
    static let noon = SkyColors(top: RGB(0x166FC2), bottom: RGB(0x6FBDE8), glow: RGB(0xFFF1B8))
    static let afternoon = SkyColors(top: RGB(0x3D78B8), bottom: RGB(0xE9C27A), glow: RGB(0xFFD27A))
    static let goldenHour = SkyColors(top: RGB(0x5E4A93), bottom: RGB(0xF2955A), glow: RGB(0xFFB36B))
    static let dusk = SkyColors(top: RGB(0x2E2260), bottom: RGB(0xD9573F), glow: RGB(0xFF8A65))
    static let evening = SkyColors(top: RGB(0x10153A), bottom: RGB(0x302C6E), glow: RGB(0xB4A6FF))

    /// Keyframes pinned to the day's real times, interpolated in between.
    static func at(_ now: Date, day: PrayerDay) -> SkyColors {
        let t = { (p: Prayer) in day.time(p).timeIntervalSince1970 }
        let x = now.timeIntervalSince1970
        let frames: [(Double, SkyColors)] = [
            (t(.fajr) - 3 * 3600, .night),
            (t(.fajr), .preDawn),
            (t(.sunrise), .dawn),
            (t(.sunrise) + 5400, .morning),
            (t(.dhuhr), .noon),
            (t(.asr), .afternoon),
            (t(.maghrib) - 2400, .goldenHour),
            (t(.maghrib), .dusk),
            (t(.isha), .evening),
            (t(.isha) + 3 * 3600, .night),
        ]
        guard let first = frames.first, let last = frames.last else { return .night }
        if x <= first.0 || x >= last.0 { return .night }
        for i in 0..<(frames.count - 1) where x >= frames[i].0 && x < frames[i + 1].0 {
            let span = frames[i + 1].0 - frames[i].0
            let f = span > 0 ? (x - frames[i].0) / span : 0
            // Ease so transitions linger at each keyframe, like real light.
            let eased = f * f * (3 - 2 * f)
            return mix(frames[i].1, frames[i + 1].1, eased)
        }
        return .night
    }
}

struct LivingSkyBackground: View {
    let colors: SkyColors

    var body: some View {
        ZStack {
            LinearGradient(colors: [colors.top.color, colors.bottom.color], startPoint: .top, endPoint: .bottom)
            // Soft horizon glow - the one atmospheric touch; no particles, no noise.
            RadialGradient(colors: [colors.glow.color.opacity(0.35), .clear],
                           center: UnitPoint(x: 0.5, y: 1.05), startRadius: 10, endRadius: 420)
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 1.2), value: colors)
    }
}
