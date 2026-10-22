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

    /// Light appearance: the same sky, washed bright so dark text reads on it.
    var daylight: SkyColors {
        let white = RGB(0xFFFFFF)
        return SkyColors(top: top.mix(white, 0.62), bottom: bottom.mix(white, 0.8), glow: glow)
    }

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

extension SkyColors {
    /// 0 in daylight → 1 in full night, from how dark the top of the sky is.
    var darkness: Double {
        let luminance = 0.2126 * top.r + 0.7152 * top.g + 0.0722 * top.b
        return min(1, max(0, (0.22 - luminance) / 0.16))
    }
}

/// A fixed field of stars that fades in as the sky darkens. Deliberately still:
/// the countdown is the only thing that moves on the Today screen.
struct StarField: View {
    var body: some View {
        Canvas { context, size in
            var seed: UInt64 = 0x9E3779B97F4A7C15
            func next() -> Double {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                return Double(seed >> 33) / Double(1 << 31)
            }
            for _ in 0..<90 {
                let x = next() * size.width
                let y = pow(next(), 1.6) * size.height * 0.7   // denser near the top
                let r = 0.4 + next() * 1.1
                let alpha = 0.25 + next() * 0.6
                context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r * 2, height: r * 2)),
                             with: .color(.white.opacity(alpha)))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

struct LivingSkyBackground: View {
    let colors: SkyColors
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let colors = scheme == .light ? self.colors.daylight : self.colors
        ZStack {
            LinearGradient(colors: [colors.top.color, colors.bottom.color], startPoint: .top, endPoint: .bottom)
            if scheme == .dark {
                StarField().opacity(colors.darkness)
            } else {
                BrightSkyLayer(isDay: self.colors.darkness < 0.5, glow: colors.glow.color)
            }
            // Soft horizon glow - the one atmospheric touch; no particles, no noise.
            RadialGradient(colors: [colors.glow.color.opacity(0.35), .clear],
                           center: UnitPoint(x: 0.5, y: 1.05), startRadius: 10, endRadius: 420)
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 1.2), value: colors)
    }
}

/// Light appearance only: a softly breathing sun (or moon after dark) and a few
/// clouds drifting very slowly. Still when Reduce Motion is on.
struct BrightSkyLayer: View {
    let isDay: Bool
    let glow: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                let w = geo.size.width
                ZStack {
                    orb(t: t).position(x: w * 0.84, y: 96)
                    cloud(width: 220, t: t, speed: 7, y: 170, phase: 0, in: w)
                    cloud(width: 150, t: t, speed: 4.5, y: 300, phase: 0.45, in: w)
                    cloud(width: 260, t: t, speed: 5.5, y: 520, phase: 0.8, in: w)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func orb(t: Double) -> some View {
        let breathe = 1 + 0.05 * sin(t / 2.6)
        let core = isDay ? Color(red: 1, green: 0.86, blue: 0.55) : Color(red: 0.86, green: 0.88, blue: 1)
        return ZStack {
            Circle()
                .fill(RadialGradient(colors: [core.opacity(isDay ? 0.55 : 0.4), glow.opacity(0.18), .clear],
                                     center: .center, startRadius: 10, endRadius: 190))
                .frame(width: 380, height: 380)
                .scaleEffect(breathe)
            if isDay {
                // Faint rays, turning about one degree a second.
                Circle()
                    .fill(AngularGradient(colors: Array(repeating: [core.opacity(0.16), .clear], count: 8).flatMap { $0 },
                                          center: .center))
                    .frame(width: 300, height: 300)
                    .rotationEffect(.degrees(t.truncatingRemainder(dividingBy: 360)))
                    .mask(RadialGradient(colors: [.white, .clear], center: .center, startRadius: 30, endRadius: 150))
            }
            Circle()
                .fill(RadialGradient(colors: [.white, core], center: .center, startRadius: 2, endRadius: 34))
                .frame(width: 64, height: 64)
                .shadow(color: core.opacity(0.8), radius: 24)
        }
    }

    private func cloud(width: CGFloat, t: Double, speed: Double, y: CGFloat, phase: Double, in w: CGFloat) -> some View {
        let span = Double(w + width * 2)
        let x = (t * speed + phase * span).truncatingRemainder(dividingBy: span) - Double(width)
        return ZStack {
            Ellipse().frame(width: width, height: width * 0.32)
            Ellipse().frame(width: width * 0.55, height: width * 0.36).offset(x: -width * 0.12, y: -width * 0.12)
            Ellipse().frame(width: width * 0.45, height: width * 0.3).offset(x: width * 0.18, y: -width * 0.08)
        }
        .foregroundStyle(.white.opacity(isDay ? 0.55 : 0.25))
        .blur(radius: 14)
        .position(x: x, y: y)
    }
}
