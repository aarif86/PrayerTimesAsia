import SwiftUI

// The five qibla dials, ported from the web app (web/src/ui/Qibla.tsx): BezelCompass for
// Centre Dial, SunCurve for Sun Path, BandsCompass for Colour Bands, SimpleCompass for
// Big and Simple and GoldCompass for Calm Gold. Each is drawn in the web's own units
// (its SVG viewBox) and scaled to the size it is given, so the shapes match one to one.

/// The aligned green (web --green): deeper on light so it reads.
enum QiblaColors {
    static let green = Color.dyn(0x24A846, 0x30D158)
    /// Colour Bands' six band colours, the same as the Prayer screen.
    static let bands: [Color] = ([0x3A6F63, 0x8A9A52, 0xAB8D3A, 0xCD7D38, 0xD3705C, 0xC9565D] as [UInt32]).map { Color(hex: $0) }
}

/// What every dial needs: the phone's heading (unwrapped, so crossing north never spins
/// the long way round), where the Ka'bah sits from the top of the dial, and alignment.
struct QiblaDialState {
    /// Phone heading, unwrapped.
    var heading: Double
    /// Qibla minus heading.
    var rel: Double
    var aligned: Bool
}

/// The web's dial width: the mockup size on a phone, smaller on narrow screens.
func qiblaDialSize(screen: CGFloat, max: CGFloat, margin: CGFloat) -> CGFloat {
    let w = Swift.min(screen, 480)
    return Swift.max(220, Swift.min(max, w - margin))
}

private let dialSpring = Animation.interpolatingSpring(stiffness: 60, damping: 14)

// MARK: - Shared parts

/// The Ka'bah: a dark cube with the gold band.
struct KaabaMark: View {
    let s: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: s * 0.14).fill(Color(hex: 0x111111))
            Rectangle().fill(Color(hex: 0xE2B65A)).frame(width: s, height: s * 0.12).offset(y: -s * 0.16)
        }
        .frame(width: s, height: s)
    }
}

/// A straight line from the centre of the frame, between two distances above it.
private struct RadialLine: View {
    let from: CGFloat
    let to: CGFloat
    let width: CGFloat
    let color: Color
    var round = true

    var body: some View {
        let len = Swift.max(0, to - from)
        Group {
            if round {
                Capsule().fill(color).frame(width: width, height: len + width)
            } else {
                Rectangle().fill(color).frame(width: width, height: len)
            }
        }
        .offset(y: -(from + to) / 2)
    }
}

/// Ticks round the edge, longer at N, E, S and W.
private struct TickRing: Shape {
    let count: Int
    let length: CGFloat
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: rect.midX, y: rect.midY)
        for k in 0..<count {
            let len = k % (count / 4) == 0 ? length * 1.7 : length
            let a = Double(k) * 2 * .pi / Double(count)
            let sx = CGFloat(sin(a)), cy = CGFloat(cos(a))
            p.move(to: CGPoint(x: c.x + sx * radius, y: c.y - cy * radius))
            p.addLine(to: CGPoint(x: c.x + sx * (radius - len), y: c.y - cy * (radius - len)))
        }
        return p
    }
}

/// A letter on the turning ring that stays upright.
private struct RingLetter: View {
    let text: String
    let degrees: Double
    let radius: CGFloat
    let heading: Double
    let size: CGFloat
    let weight: Font.Weight
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: size, weight: weight))
            .foregroundStyle(color)
            .rotationEffect(.degrees(-degrees + heading))
            .offset(y: -radius)
            .rotationEffect(.degrees(degrees))
    }
}

/// The frame every round dial sits in: the little bar at the top (the way the phone
/// points), and when aligned a green glow and the tick with "Aligned" in the middle.
private struct DialBox<Content: View>: View {
    let size: CGFloat
    let aligned: Bool
    @ViewBuilder var content: Content
    @Environment(\.look) private var look

    var body: some View {
        ZStack {
            content
                .frame(width: size, height: size)
                .shadow(color: aligned ? QiblaColors.green.opacity(0.6) : .clear, radius: 10)
            Capsule()
                .fill(aligned ? QiblaColors.green : look.palette.tx)
                .frame(width: 4, height: 16)
                .offset(y: -size / 2 - 4)
            if aligned {
                QiblaRipple(color: QiblaColors.green).frame(width: size, height: size)
                AlignedBadge(size: size).transition(.scale(scale: 0.6).combined(with: .opacity))
            }
        }
        .frame(width: size, height: size)
        .padding(.top, 12)
        .animation(.spring(response: 0.5, dampingFraction: 0.7), value: aligned)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(aligned ? "Facing the qibla" : "Qibla compass")
        .accessibilityAddTraits(.isImage)
    }
}

/// The glass circle in the middle when aligned: a green tick and "Aligned".
private struct AlignedBadge: View {
    let size: CGFloat
    @Environment(\.look) private var look

    var body: some View {
        let d = size * 0.34
        VStack(spacing: 2) {
            Image(systemName: "checkmark")
                .font(.system(size: size * 0.1, weight: .heavy))
                .foregroundStyle(QiblaColors.green)
            Text("Aligned")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(look.palette.tx)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(width: d, height: d)
        .background(Circle().fill(.ultraThinMaterial))
        .overlay(Circle().stroke(QiblaColors.green.opacity(0.55), lineWidth: 4))
    }
}

/// A soft green ring that keeps spreading out from the dial while aligned.
private struct QiblaRipple: View {
    let color: Color
    @State private var on = false

    var body: some View {
        Circle()
            .stroke(color.opacity(0.6), lineWidth: 2)
            .scaleEffect(on ? 1.18 : 1)
            .opacity(on ? 0 : 1)
            .onAppear {
                withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { on = true }
            }
            .allowsHitTesting(false)
    }
}

// MARK: - Centre Dial

/// Centre Dial: the navy kawung bezel with the Ka'bah and a glowing arrow.
struct BezelCompass: View {
    let state: QiblaDialState
    let size: CGFloat

    private var k: CGFloat { size / 340 }
    private var bezel: Color { Color.dyn(0x2D3573, 0x262B5E) }
    private var face: Color { Color.dyn(0xE9F0F8, 0x1B1F4A) }
    private var glow: Color { Color.dyn(0xFFD6A8, 0xF7BD8F) }
    private var arrow: Color { state.aligned ? QiblaColors.green : Color.dyn(0xE8924A, 0xF7BD8F) }

    var body: some View {
        DialBox(size: size, aligned: state.aligned) {
            ZStack {
                ring
                Circle()
                    .fill(RadialGradient(colors: [glow.opacity(0.6), glow.opacity(0)], center: .center,
                                         startRadius: 0, endRadius: 170 * 0.34 * k))
                    .frame(width: 2 * 170 * 0.34 * k, height: 2 * 170 * 0.34 * k)
                pointer
                Circle().fill(arrow).frame(width: 18 * k, height: 18 * k)
            }
        }
    }

    /// The ring turns with the phone.
    private var ring: some View {
        let outer = (170 - 3) * k, inner = (170 - 62) * k
        let letters = ["N", "E", "S", "W"]
        return ZStack {
            Circle().fill(bezel).frame(width: 2 * outer, height: 2 * outer)
            KawungPattern(tile: 22 * k).opacity(0.17).clipShape(Circle()).frame(width: 2 * outer, height: 2 * outer)
            Circle().stroke(Color.white, lineWidth: 5 * k).frame(width: 2 * outer, height: 2 * outer)
            TickRing(count: 36, length: 7 * k, radius: (170 - 4) * k)
                .stroke(Color.white.opacity(0.7), lineWidth: 2 * k)
            Circle().fill(face).frame(width: 2 * inner, height: 2 * inner)
            Circle().stroke(Color.white.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4 * k, 4 * k]))
                .frame(width: 2 * inner, height: 2 * inner)
            ForEach(0..<4, id: \.self) { i in
                RingLetter(text: letters[i], degrees: Double(i) * 90, radius: (170 - 40) * k, heading: state.heading,
                           size: 20 * k, weight: .bold, color: i == 0 ? Color(hex: 0xFF8F7A) : .white)
            }
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(-state.heading))
        .animation(dialSpring, value: state.heading)
    }

    /// The arrow out to the Ka'bah, at the true qibla.
    private var pointer: some View {
        ZStack {
            RadialLine(from: -4 * k, to: (170 - 46) * k, width: 5 * k, color: arrow)
            KaabaMark(s: 36 * k)
                .rotationEffect(.degrees(-state.rel))
                .offset(y: -(170 - 46) * k)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(state.rel))
        .animation(dialSpring, value: state.rel)
    }
}

// MARK: - Colour Bands

/// One sixth of the band ring, from `start` to `end` degrees clockwise from the top.
private struct RingSegment: Shape {
    let start: Double
    let end: Double
    let outer: CGFloat
    let inner: CGFloat

    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        func pt(_ r: CGFloat, _ deg: Double) -> CGPoint {
            let a = deg * .pi / 180
            return CGPoint(x: c.x + CGFloat(sin(a)) * r, y: c.y - CGFloat(cos(a)) * r)
        }
        var p = Path()
        let steps = 30
        for i in 0...steps {
            let d = start + (end - start) * Double(i) / Double(steps)
            if i == 0 { p.move(to: pt(outer, d)) } else { p.addLine(to: pt(outer, d)) }
        }
        for i in stride(from: steps, through: 0, by: -1) {
            p.addLine(to: pt(inner, start + (end - start) * Double(i) / Double(steps)))
        }
        p.closeSubpath()
        return p
    }
}

/// Colour Bands: a flat compass cut from the six band colours.
struct BandsCompass: View {
    let state: QiblaDialState
    let size: CGFloat
    @Environment(\.look) private var look

    private var k: CGFloat { size / 330 }

    var body: some View {
        let p = look.palette
        let r = (165 - 4) * k, w = 34 * k
        DialBox(size: size, aligned: state.aligned) {
            ZStack {
                ring(p: p, r: r, w: w)
                ZStack {
                    RadialLine(from: 0, to: r - w / 2, width: 6 * k, color: p.ac, round: false)
                    KaabaMark(s: 34 * k)
                        .rotationEffect(.degrees(-state.rel))
                        .offset(y: -(r - w / 2))
                }
                .frame(width: size, height: size)
                .rotationEffect(.degrees(state.rel))
                .animation(dialSpring, value: state.rel)
                Circle().fill(p.ac).frame(width: 18 * k, height: 18 * k)
            }
        }
    }

    private func ring(p: LookPalette, r: CGFloat, w: CGFloat) -> some View {
        let letters = ["N", "E", "S", "W"]
        return ZStack {
            ForEach(0..<6, id: \.self) { i in
                RingSegment(start: Double(i) * 60, end: Double(i + 1) * 60, outer: r, inner: r - w)
                    .fill(QiblaColors.bands[i])
            }
            Circle().fill(p.card).frame(width: 2 * (r - w), height: 2 * (r - w))
            ForEach(0..<4, id: \.self) { i in
                RingLetter(text: letters[i], degrees: Double(i) * 90, radius: r - w - 26 * k, heading: state.heading,
                           size: 22 * k, weight: .heavy, color: i == 0 ? Color(hex: 0xD3705C) : p.tx)
            }
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(-state.heading))
        .animation(dialSpring, value: state.heading)
    }
}

// MARK: - Big and Simple

/// The big arrow, in the web's 300 by 300 units.
private struct BigArrow: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 300
        let pts: [(CGFloat, CGFloat)] = [(150, 52), (198, 128), (168, 128), (168, 236), (132, 236), (132, 128), (102, 128)]
        var p = Path()
        for (i, q) in pts.enumerated() {
            let point = CGPoint(x: rect.minX + q.0 * s, y: rect.minY + q.1 * s)
            if i == 0 { p.move(to: point) } else { p.addLine(to: point) }
        }
        p.closeSubpath()
        return p
    }
}

/// Big and Simple: one big arrow that points at the Ka'bah.
struct SimpleCompass: View {
    let state: QiblaDialState
    let size: CGFloat
    @Environment(\.look) private var look

    private var k: CGFloat { size / 300 }
    private var north: Color { Color.dyn(0xE0634F, 0xFF8F7A) }

    var body: some View {
        let p = look.palette
        DialBox(size: size, aligned: state.aligned) {
            ZStack {
                Circle().fill(p.card).frame(width: 280 * k, height: 280 * k)
                Circle().stroke(p.tx3.opacity(0.5), lineWidth: 3 * k).frame(width: 280 * k, height: 280 * k)
                RingLetter(text: "N", degrees: 0, radius: 112 * k, heading: state.heading, size: 26 * k, weight: .bold, color: north)
                    .frame(width: size, height: size)
                    .rotationEffect(.degrees(-state.heading))
                    .animation(dialSpring, value: state.heading)
                ZStack {
                    BigArrow().fill(p.ac)
                    KaabaMark(s: 50 * k)
                        .rotationEffect(.degrees(-state.rel))
                        .offset(y: -124 * k)
                }
                .frame(width: size, height: size)
                .rotationEffect(.degrees(state.rel))
                .animation(dialSpring, value: state.rel)
                Circle().fill(Color.white).frame(width: 24 * k, height: 24 * k)
                Circle().stroke(p.ac, lineWidth: 5 * k).frame(width: 24 * k, height: 24 * k)
            }
        }
    }
}

// MARK: - Calm Gold

/// Calm Gold: a thin gold ring, fine ticks and a gold Ka'bah mark.
struct GoldCompass: View {
    let state: QiblaDialState
    let size: CGFloat
    @Environment(\.look) private var look

    private var k: CGFloat { size / 330 }

    var body: some View {
        let p = look.palette
        DialBox(size: size, aligned: state.aligned) {
            ZStack {
                Circle().fill(p.ac.opacity(0.07)).frame(width: 2 * 165 * 0.94 * k, height: 2 * 165 * 0.94 * k)
                Circle().stroke(p.ac, lineWidth: 3 * k).frame(width: 2 * 132 * k, height: 2 * 132 * k)
                ZStack {
                    TickRing(count: 72, length: 4 * k, radius: (165 - 4) * k).stroke(p.tx3, lineWidth: 2 * k)
                    RingLetter(text: "N", degrees: 0, radius: (132 - 26) * k, heading: state.heading, size: 22 * k,
                               weight: .bold, color: p.tx2)
                }
                .frame(width: size, height: size)
                .rotationEffect(.degrees(-state.heading))
                .animation(dialSpring, value: state.heading)
                pointer(p: p)
            }
        }
    }

    private func pointer(p: LookPalette) -> some View {
        ZStack {
            RadialLine(from: -30 * k, to: 60 * k, width: 4 * k, color: p.ac)
            ZStack {
                RoundedRectangle(cornerRadius: 8 * k).fill(p.ac).frame(width: 32 * k, height: 32 * k)
                Capsule().fill(Color(hex: 0x151100)).frame(width: 19 * k, height: 3 * k)
            }
            .rotationEffect(.degrees(-state.rel))
            .offset(y: -(165 - 30) * k)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(state.rel))
        .animation(dialSpring, value: state.rel)
    }
}

// MARK: - Sun Path

/// The day's curve, in the web's units (x from 0 to 390, y from 70 to 220).
private enum SunCurveMath {
    static let kaabaX = 195.0
    static func y(_ x: Double) -> Double { 164 - 40 * cos(Double.pi * (x - 208) / 196) }
    /// Where the sun sits: steep near the Ka'bah, still moving all the way out to half a
    /// turn, so the sun never looks stuck.
    static func sunX(_ rel: Double) -> Double {
        let off = Swift.min(180, abs(rel)) / 180
        let sign: Double = rel > 0 ? 1 : (rel < 0 ? -1 : 0)
        return kaabaX - sign * 181 * (1 - (1 - off) * (1 - off))
    }
}

/// A part of the curve from `a` to `b` (web x units), scaled to the frame.
private struct CurvePath: Shape {
    var a: Double
    var b: Double

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(a, b) }
        set { a = newValue.first; b = newValue.second }
    }

    func path(in rect: CGRect) -> Path {
        let k = rect.width / 390
        let lo = Swift.min(a, b), hi = Swift.max(a, b)
        var p = Path()
        var x = lo
        p.move(to: CGPoint(x: CGFloat(x) * k, y: CGFloat(SunCurveMath.y(x) - 70) * k))
        while x < hi {
            x = Swift.min(hi, x + 4)
            p.addLine(to: CGPoint(x: CGFloat(x) * k, y: CGFloat(SunCurveMath.y(x) - 70) * k))
        }
        return p
    }
}

/// Moves the sun along the curve (not in a straight line) while it animates.
private struct AlongCurve: ViewModifier, Animatable {
    var x: Double
    let k: CGFloat

    var animatableData: Double {
        get { x }
        set { x = newValue }
    }

    func body(content: Content) -> some View {
        content.position(x: CGFloat(x) * k, y: CGFloat(SunCurveMath.y(x) - 70) * k)
    }
}

/// Sun Path: the sun moves along the day's curve; turn until it reaches the Ka'bah.
struct QiblaSunCurve: View {
    let rel: Double
    let aligned: Bool
    let hasHeading: Bool
    let width: CGFloat
    @Environment(\.look) private var look

    var body: some View {
        let p = look.palette
        let k = width / 390
        let kx = SunCurveMath.kaabaX, ky = SunCurveMath.y(kx)
        let sx = SunCurveMath.sunX(rel)
        ZStack(alignment: .topLeading) {
            Rectangle().fill(p.tx3.opacity(0.5)).frame(width: width, height: 1).offset(y: (164 - 70) * k)
            CurvePath(a: -10, b: 400).stroke(p.tx3.opacity(0.7), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            if !aligned {
                CurvePath(a: sx, b: kx)
                    .stroke(p.ac, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                    .animation(.easeOut(duration: 0.35), value: sx)
            }
            Circle().stroke(p.tx, lineWidth: 2.5)
                .frame(width: 14 * k, height: 14 * k)
                .position(x: CGFloat(kx) * k, y: CGFloat(ky - 70) * k)
            KaabaMark(s: 34 * k).position(x: CGFloat(kx) * k, y: CGFloat(ky - 100) * k)
            sun(p: p, k: k)
                .modifier(AlongCurve(x: sx, k: k))
                .animation(.easeOut(duration: 0.35), value: sx)
        }
        .frame(width: width, height: 150 * k, alignment: .topLeading)
        .padding(.top, 18)
        .padding(.bottom, 6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(aligned ? "Facing the qibla" : "Qibla compass")
        .accessibilityAddTraits(.isImage)
    }

    private func sun(p: LookPalette, k: CGFloat) -> some View {
        let gold = Color(hex: 0xFFD98A)
        return ZStack {
            Circle()
                .fill(RadialGradient(colors: [gold.opacity(0.8), gold.opacity(0)], center: .center, startRadius: 0, endRadius: 30 * k))
                .frame(width: 60 * k, height: 60 * k)
            Circle().fill(Color.white).frame(width: 18 * k, height: 18 * k)
            Text(hasHeading ? "You face here" : "North")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(p.tx2)
                .fixedSize()
                .offset(y: 30 * k)
        }
        .frame(width: 60 * k, height: 60 * k)
    }
}
