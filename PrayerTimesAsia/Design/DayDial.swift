import SwiftUI

/// The day as a 24-hour dial - the app's signature, echoing the watch icon, and
/// the hero of the Prayer screen. Noon at the top, midnight at the bottom; the
/// ring runs through the colours of the sky, each prayer's time sits just inside
/// the ring at its hour like a watch's indices, a glowing dot marks now, and the
/// centre says where we are in the day.
/// A time shown on the Day Dial.
struct DialMark: Identifiable {
    let id: String
    let date: Date
    /// Blessed times are smaller and quieter than the five prayers.
    var minor = false
    /// An extra line under the time (jamaah, a second source).
    var extraLine = false
    var tint: Color = .primary
}

struct DayDial<MarkLabel: View, Centre: View>: View {
    let now: Date
    let day: PrayerDay
    /// Tomorrow's Subuh, so Isyak's segment runs through the night.
    let nextFajr: Date
    let timeZone: TimeZone
    /// Highlighted segment and the now-dot; nil when showing another day.
    let currentPrayer: Prayer?
    let marks: [DialMark]
    @ViewBuilder let label: (DialMark, CGFloat) -> MarkLabel
    @ViewBuilder let centre: (CGFloat) -> Centre

    private var midnight: Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.startOfDay(for: day.time(.dhuhr))
    }

    /// Degrees clockwise from the top, with noon at the top and midnight at the bottom.
    private func angle(_ date: Date) -> Double {
        let hours = date.timeIntervalSince(midnight) / 3600
        return hours / 24 * 360 + 180
    }

    /// A label's footprint, as a fraction of the dial.
    static func labelSize(_ mark: DialMark, _ size: CGFloat) -> CGSize {
        if mark.minor { return CGSize(width: size * 0.25, height: size * 0.085) }
        return CGSize(width: size * 0.25, height: size * (mark.extraLine ? 0.15 : 0.115))
    }

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let ring = size * 0.05
            let r = size / 2 - ring * 0.65 - 1
            let inner = r - ring * 0.65 - size * 0.025
            let spots = layout(size: size, inner: inner)
            ZStack {
                Circle().fill(Color.primary.opacity(0.04)).padding(ring * 1.3)
                Canvas { ctx, sz in
                    let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
                    func arc(_ a0: Double, _ a1: Double) -> Path {
                        var p = Path()
                        p.addArc(center: c, radius: r, startAngle: .degrees(a0 - 90), endAngle: .degrees(a1 - 90), clockwise: false)
                        return p
                    }
                    func point(_ a: Double, _ radius: CGFloat) -> CGPoint {
                        let rad = a * .pi / 180
                        return CGPoint(x: c.x + sin(rad) * radius, y: c.y - cos(rad) * radius)
                    }
                    ctx.stroke(arc(0, 360), with: .color(Color.primary.opacity(0.08)), style: StrokeStyle(lineWidth: ring))
                    // The sky through the day, as one gradient round the ring:
                    // night, dawn, morning, the hot noon, afternoon, sunset, night.
                    func f(_ d: Date) -> Double { min(1, max(0, d.timeIntervalSince(midnight) / 86_400)) }
                    let night = Color(red: 0.13, green: 0.15, blue: 0.36)
                    let stops: [Gradient.Stop] = [
                        .init(color: night, location: 0),
                        .init(color: Prayer.isha.tint, location: max(0, f(day.time(.fajr)) - 0.06)),
                        .init(color: Prayer.fajr.tint, location: f(day.time(.fajr))),
                        .init(color: Color(red: 0.96, green: 0.70, blue: 0.58), location: f(day.time(.sunrise))),
                        .init(color: Prayer.sunrise.tint, location: (f(day.time(.sunrise)) + f(day.time(.dhuhr))) / 2),
                        .init(color: Prayer.dhuhr.tint, location: f(day.time(.dhuhr))),
                        .init(color: Prayer.asr.tint, location: f(day.time(.asr))),
                        .init(color: Prayer.maghrib.tint, location: f(day.time(.maghrib))),
                        .init(color: Prayer.isha.tint, location: f(day.time(.isha))),
                        .init(color: night, location: 1),
                    ]
                    let sky = GraphicsContext.Shading.conicGradient(Gradient(stops: stops), center: c, angle: .degrees(90))
                    let order = Prayer.allCases
                    for (i, prayer) in order.enumerated() {
                        // Isyak ends at tomorrow's Subuh: past 540° the conic gradient wraps by itself.
                        let start = angle(day.time(prayer))
                        let end = i + 1 < order.count ? angle(day.time(order[i + 1])) : angle(nextFajr)
                        ctx.stroke(arc(start + 0.8, end - 0.8), with: sky,
                                   style: StrokeStyle(lineWidth: prayer == currentPrayer ? ring * 1.3 : ring))
                    }
                    // An index inside the ring at each mark's true time (its label may be nudged aside).
                    for mark in marks {
                        let a = angle(mark.date)
                        var t = Path()
                        t.move(to: point(a, r - ring * 0.65 - 2))
                        t.addLine(to: point(a, r - ring * 0.65 - (mark.minor ? 5 : 8)))
                        ctx.stroke(t, with: .color(mark.minor ? Color.primary.opacity(0.35) : mark.tint),
                                   style: StrokeStyle(lineWidth: mark.minor ? 1.5 : 2.5, lineCap: .round))
                    }
                    // Now
                    if currentPrayer != nil {
                        let dot = point(angle(now), r)
                        func disc(_ k: CGFloat) -> Path {
                            Path(ellipseIn: CGRect(x: dot.x - ring * k, y: dot.y - ring * k, width: ring * 2 * k, height: ring * 2 * k))
                        }
                        ctx.fill(disc(1.05), with: .color(Theme.sunArc.opacity(0.35)))
                        ctx.fill(disc(0.62), with: .color(.white))
                        ctx.stroke(disc(0.62), with: .color(Theme.accent), lineWidth: 3)
                    }
                }
                ForEach(marks) { mark in
                    if let spot = spots[mark.id] {
                        let box = Self.labelSize(mark, size)
                        label(mark, size)
                            .frame(width: box.width, height: box.height)
                            .position(spot)
                    }
                }
                centre(size)
                    .frame(width: size * 0.4)
            }
            .frame(width: size, height: size)
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
        .aspectRatio(1, contentMode: .fit)
    }

    /// Where each label goes: just inside the ring at its time, its outer edge
    /// touching the inner circle, then nudged apart along the circle when two
    /// would overlap (Maghrib and Isyak are only ~20° apart).
    private func layout(size: CGFloat, inner: CGFloat) -> [String: CGPoint] {
        let sorted = marks.sorted { fmod(angle($0.date), 360) < fmod(angle($1.date), 360) }
        guard !sorted.isEmpty else { return [:] }
        var angles = sorted.map { fmod(angle($0.date), 360) }
        func spot(_ i: Int) -> CGPoint {
            let box = Self.labelSize(sorted[i], size)
            let rad = angles[i] * .pi / 180
            let inset = abs(sin(rad)) * box.width / 2 + abs(cos(rad)) * box.height / 2
            return CGPoint(x: size / 2 + sin(rad) * (inner - inset), y: size / 2 - cos(rad) * (inner - inset))
        }
        let n = sorted.count
        for _ in 0..<120 where n > 1 {
            var moved = false
            for i in 0..<n {
                let j = (i + 1) % n
                let p = spot(i), q = spot(j)
                let a = Self.labelSize(sorted[i], size), b = Self.labelSize(sorted[j], size)
                if abs(p.x - q.x) < (a.width + b.width) / 2 + 2, abs(p.y - q.y) < (a.height + b.height) / 2 + 2 {
                    angles[i] -= 0.5
                    angles[j] += 0.5
                    moved = true
                }
            }
            if !moved { break }
        }
        return Dictionary(uniqueKeysWithValues: sorted.indices.map { (sorted[$0].id, spot($0)) })
    }
}
