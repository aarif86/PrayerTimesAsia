import SwiftUI

/// Shown over the app for a moment as it opens: the icon's dial on Night Navy, moving for
/// about a second in one of six ways (never the same twice in a row), then it fades.
/// The clock hands always land on the real time. Reduce Motion keeps the dial still.
/// Settings > Opening screen turns it off, but it always shows the first time.
/// The same six movements play on Android (OpeningScreen.kt) and the web app (index.html).
struct OpeningView: View {
    @Binding var isShowing: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()
    @State private var move = OpeningMove.next()
    @State private var clock = OpeningClock(Date())

    /// Whether to show it this time: always on a fresh install, then as Settings says.
    static func shouldShow(_ prefs: Preferences) -> Bool {
        prefs.showOpening || !UserDefaults.standard.bool(forKey: OpeningMove.seenKey)
    }

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let ms = reduceMotion ? 10_000 : timeline.date.timeIntervalSince(start) * 1000
            let pose = OpeningPose(move: move, ms: ms, clock: clock)
            GeometryReader { geo in
                ZStack {
                    Brand.nightNavy
                    KawungPattern(tile: 36).opacity(0.05)
                    RadialGradient(colors: [Color(red: 0.97, green: 0.74, blue: 0.56).opacity(0.35), .clear],
                                   center: UnitPoint(x: 0.5, y: 1.05), startRadius: 0, endRadius: 420)
                        .opacity(pose.glowOpacity)
                        .offset(y: pose.glowY * geo.size.height)
                    dial(pose)
                    Text("Prayer Times Asia")
                        .font(.system(size: 26, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .offset(y: 132 + 8 * (1 - pose.nameIn))
                        .opacity(pose.nameIn)
                    VStack {
                        Spacer()
                        Text("Built fisabilillah in Singapore")
                            .font(.subheadline)
                            .foregroundStyle(Brand.moonText.opacity(0.78))
                            .padding(.bottom, 40)
                            .offset(y: 8 * (1 - pose.lineIn))
                    }
                    .opacity(pose.lineIn)
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .allowsHitTesting(false)
        .task {
            UserDefaults.standard.set(true, forKey: OpeningMove.seenKey)
            start = Date()
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 900 : OpeningPose.lengthMs))
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.35)) { isShowing = false }
        }
    }

    private func dial(_ p: OpeningPose) -> some View {
        func layer(_ name: String) -> some View { Image(name).resizable().frame(width: 180, height: 180) }
        return ZStack {
            ZStack {
                layer("OpeningRing")
                layer("OpeningBatik").rotationEffect(.degrees(p.batikRot)).opacity(p.batikOpacity)
                layer("OpeningStitchOuter").rotationEffect(.degrees(p.stitchOuterRot))
                layer("OpeningStitchInner").rotationEffect(.degrees(p.stitchInnerRot))
                layer("OpeningMarks")
            }
            .rotationEffect(.degrees(p.ringRot)).scaleEffect(p.ringScale).opacity(p.ringOpacity)
            layer("OpeningFace").scaleEffect(p.centreScale).opacity(p.centreOpacity)
            layer("OpeningKaabah").scaleEffect(p.kaabahScale).opacity(p.kaabahOpacity)
            ZStack {
                layer("OpeningHour").rotationEffect(.degrees(p.hourRot))
                layer("OpeningMinute").rotationEffect(.degrees(p.minuteRot))
                layer("OpeningHub")
            }
            .scaleEffect(p.centreScale).opacity(p.centreOpacity)
        }
        .frame(width: 180, height: 180)
        .scaleEffect(p.dialScale)
        .offset(y: p.dialY * 180)
        .opacity(p.dialOpacity)
    }
}

enum OpeningMove: Int, CaseIterable {
    case compass, clock, batik, stitch, sunrise, kaabah

    static let seenKey = "openingSeen"
    private static let lastKey = "openingLast"

    /// A random movement, never the one shown last time.
    static func next() -> OpeningMove {
        let last = UserDefaults.standard.object(forKey: lastKey) as? Int
        let pick = allCases.filter { $0.rawValue != last }.randomElement() ?? .compass
        UserDefaults.standard.set(pick.rawValue, forKey: lastKey)
        return pick
    }
}

/// Where the clock hands point for a time, in degrees from 12.
struct OpeningClock {
    let hour: Double
    let minute: Double

    init(_ date: Date) {
        let c = Calendar.current.dateComponents([.hour, .minute, .second], from: date)
        let m = Double(c.minute ?? 0) + Double(c.second ?? 0) / 60
        minute = m * 6
        hour = (Double((c.hour ?? 0) % 12) + m / 60) * 30
    }
}

/// How every layer of the opening screen sits `ms` milliseconds in. Pure, so it is easy to test.
struct OpeningPose {
    static let lengthMs = 1350

    var dialScale = 1.0, dialOpacity = 1.0, dialY = 0.0
    var ringRot = 0.0, ringScale = 1.0, ringOpacity = 1.0
    var batikRot = 0.0, batikOpacity = 1.0
    var stitchOuterRot = 0.0, stitchInnerRot = 0.0
    var kaabahScale = 1.0, kaabahOpacity = 1.0
    var centreScale = 1.0, centreOpacity = 1.0
    var hourRot: Double, minuteRot: Double
    var glowOpacity = 1.0, glowY = 0.0
    var nameIn = 1.0, lineIn = 1.0

    init(move: OpeningMove, ms t: Double, clock: OpeningClock) {
        hourRot = clock.hour
        minuteRot = clock.minute
        let h = clock.hour, m = clock.minute
        var wordsDelay = 250.0
        switch move {
        case .compass: // the ring swings like a real compass and settles on North
            ringRot = Self.keys(Self.easeInOut(Self.seg(t, 0, 1000)), [(0, -75), (0.38, 28), (0.62, -11), (0.82, 4), (1, 0)])
            dialOpacity = Self.keys(Self.ease(Self.seg(t, 0, 1000)), [(0, 0), (0.2, 1), (1, 1)])
            wordsDelay = 250
        case .clock: // the hands spin from twelve round to the real time
            let p = Self.ease(Self.seg(t, 0, 1000))
            hourRot = Self.mix(0, h + 360, p)
            minuteRot = Self.mix(0, m + 1080, p)
            let q = Self.ease(Self.seg(t, 0, 400))
            dialOpacity = q; dialScale = Self.mix(0.94, 1, q)
            wordsDelay = 250
        case .batik: // the kawung ring turns and glows in
            let p = Self.ease(Self.seg(t, 0, 1000))
            batikRot = Self.mix(-90, 0, p); batikOpacity = p
            let q = Self.ease(Self.seg(t, 0, 600))
            dialScale = Self.mix(0.9, 1, q); dialOpacity = q
            wordsDelay = 250
        case .stitch: // the two stitch rings run opposite ways as the dial pops in
            let p = Self.ease(Self.seg(t, 0, 1000))
            stitchOuterRot = Self.mix(-120, 0, p); stitchInnerRot = Self.mix(120, 0, p)
            let q = Self.easeOut(Self.seg(t, 0, 700))
            dialScale = Self.keys(q, [(0, 0.7), (0.55, 1.06), (1, 1)])
            dialOpacity = Self.keys(q, [(0, 0), (0.55, 1), (1, 1)])
            wordsDelay = 300
        case .sunrise: // dawn glows and the dial rises into place
            let p = Self.ease(Self.seg(t, 0, 1000))
            glowOpacity = p; glowY = Self.mix(0.3, 0, p)
            dialY = Self.keys(p, [(0, 0.5), (0.7, -6 / 180), (1, 0)])
            dialScale = Self.keys(p, [(0, 0.85), (0.7, 1), (1, 1)])
            dialOpacity = Self.keys(p, [(0, 0), (0.7, 1), (1, 1)])
            hourRot = Self.mix(h - 60, h, p); minuteRot = Self.mix(m - 120, m, p)
            wordsDelay = 400
        case .kaabah: // the Kaabah first, then the face and the compass open out around it
            let k = Self.ease(Self.seg(t, 0, 450))
            kaabahScale = Self.keys(k, [(0, 0.3), (0.6, 1.15), (1, 1)])
            kaabahOpacity = Self.keys(k, [(0, 0), (0.6, 1), (1, 1)])
            let c = Self.ease(Self.seg(t, 250, 450))
            centreScale = Self.mix(0.4, 1, c); centreOpacity = c
            let r = Self.ease(Self.seg(t, 500, 500))
            ringScale = Self.mix(0.6, 1, r); ringRot = Self.mix(-40, 0, r); ringOpacity = r
            wordsDelay = 500
        }
        nameIn = Self.ease(Self.seg(t, wordsDelay, 500))
        lineIn = Self.ease(Self.seg(t, wordsDelay + 100, 500))
    }

    /// 0 before `delay`, 1 after `delay + length`, straight in between.
    static func seg(_ t: Double, _ delay: Double, _ length: Double) -> Double { min(1, max(0, (t - delay) / length)) }
    static func mix(_ a: Double, _ b: Double, _ p: Double) -> Double { a + (b - a) * p }
    /// Straight lines between (offset, value) keys, like a CSS keyframe list.
    static func keys(_ p: Double, _ k: [(Double, Double)]) -> Double {
        for i in 1..<k.count where p <= k[i].0 {
            return mix(k[i - 1].1, k[i].1, (p - k[i - 1].0) / (k[i].0 - k[i - 1].0))
        }
        return k[k.count - 1].1
    }
    /// cubic-bezier(.2, .8, .2, 1): quick start, soft landing.
    static func ease(_ x: Double) -> Double { bezier(x, 0.2, 0.8, 0.2, 1) }
    static func easeInOut(_ x: Double) -> Double { bezier(x, 0.42, 0, 0.58, 1) }
    static func easeOut(_ x: Double) -> Double { bezier(x, 0, 0, 0.58, 1) }

    static func bezier(_ x: Double, _ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> Double {
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        func at(_ s: Double, _ a: Double, _ b: Double) -> Double { 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s }
        var lo = 0.0, hi = 1.0, s = x
        for _ in 0..<30 {
            s = (lo + hi) / 2
            if at(s, x1, x2) < x { lo = s } else { hi = s }
        }
        return at(s, y1, y2)
    }
}
