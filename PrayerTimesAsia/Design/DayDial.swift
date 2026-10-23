import SwiftUI

/// The day as a 24-hour dial - the app's signature, echoing the watch icon.
/// Noon at the top, midnight at the bottom; each prayer's period is a coloured
/// segment (prayertime.sg's colours, calmer), a glowing dot marks now, and the
/// centre says where we are in the day.
struct DayDial: View {
    let now: Date
    let day: PrayerDay
    /// Tomorrow's Subuh, so Isyak's segment runs through the night.
    let nextFajr: Date
    let timeZone: TimeZone
    let currentName: String
    let currentPrayer: Prayer
    let countdown: String
    let nextName: String

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

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let ring: CGFloat = size * 0.085
            ZStack {
                Canvas { ctx, sz in
                    let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
                    let r = min(sz.width, sz.height) / 2 - ring / 2 - 2
                    func arc(_ a0: Double, _ a1: Double) -> Path {
                        var p = Path()
                        p.addArc(center: c, radius: r, startAngle: .degrees(a0 - 90), endAngle: .degrees(a1 - 90), clockwise: false)
                        return p
                    }
                    // Track
                    ctx.stroke(arc(0, 360), with: .color(Color.primary.opacity(0.1)), style: StrokeStyle(lineWidth: ring))
                    // Prayer periods
                    let order = Prayer.allCases
                    for (i, prayer) in order.enumerated() {
                        let start = angle(day.time(prayer))
                        var end = i + 1 < order.count ? angle(day.time(order[i + 1])) : angle(nextFajr)
                        if end < start { end += 360 }
                        let colour = prayer == .sunrise ? Color.primary.opacity(0.18) : prayer.tint
                        let gap = 1.2
                        ctx.stroke(arc(start + gap, end - gap),
                                   with: .color(prayer == currentPrayer ? colour : colour.opacity(0.55)),
                                   style: StrokeStyle(lineWidth: prayer == currentPrayer ? ring * 1.25 : ring, lineCap: .butt))
                    }
                    // Quarter ticks: midnight, 6, noon, 18
                    for q in 0..<4 {
                        let a = (Double(q) * 90 - 90) * .pi / 180
                        let r1 = r - ring / 2 - 6, r2 = r - ring / 2 - 13
                        var t = Path()
                        t.move(to: CGPoint(x: c.x + cos(a) * r1, y: c.y + sin(a) * r1))
                        t.addLine(to: CGPoint(x: c.x + cos(a) * r2, y: c.y + sin(a) * r2))
                        ctx.stroke(t, with: .color(Color.primary.opacity(0.35)), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    }
                    // Now
                    let a = (angle(now) - 90) * .pi / 180
                    let dot = CGPoint(x: c.x + cos(a) * r, y: c.y + sin(a) * r)
                    ctx.fill(Path(ellipseIn: CGRect(x: dot.x - ring, y: dot.y - ring, width: ring * 2, height: ring * 2)),
                             with: .color(Theme.sunArc.opacity(0.35)))
                    ctx.fill(Path(ellipseIn: CGRect(x: dot.x - ring * 0.62, y: dot.y - ring * 0.62, width: ring * 1.24, height: ring * 1.24)),
                             with: .color(.white))
                    ctx.stroke(Path(ellipseIn: CGRect(x: dot.x - ring * 0.62, y: dot.y - ring * 0.62, width: ring * 1.24, height: ring * 1.24)),
                               with: .color(currentPrayer.tint), lineWidth: 3)
                }
                // Sun at noon, moon at midnight, as quiet markers inside the ring
                Image(systemName: "sun.max.fill").font(.system(size: size * 0.07))
                    .foregroundStyle(Theme.sunArc).offset(y: -size * 0.3)
                Image(systemName: "moon.fill").font(.system(size: size * 0.06))
                    .foregroundStyle(Color.primary.opacity(0.35)).offset(y: size * 0.3)
                VStack(spacing: 1) {
                    Text(currentName)
                        .font(Theme.display(size * 0.14, .bold))
                        .lineLimit(1).minimumScaleFactor(0.6)
                    Text(countdown)
                        .font(Theme.display(size * 0.1, .semibold)).monospacedDigit()
                        .foregroundStyle(currentPrayer.tint)
                        .contentTransition(.numericText(countsDown: true))
                    Text("until \(nextName)")
                        .font(.system(size: size * 0.065, weight: .medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .padding(.horizontal, size * 0.18)
            }
            .frame(width: size, height: size)
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Now \(currentName). \(countdown) until \(nextName).")
    }
}
