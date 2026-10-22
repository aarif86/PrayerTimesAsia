import SwiftUI

/// The sun's real altitude through the local day - midnight to midnight, at
/// this exact place and date - with every prayer marked where the sun actually
/// is at that time. Above the line is day; below it, night.
struct SunPath: View {
    let now: Date
    let day: PrayerDay
    let coordinates: Coordinates
    let timeZone: TimeZone
    let glow: Color

    private var start: Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.startOfDay(for: day.time(.dhuhr))
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let span = 86_400.0
            let samples = (0...144).map { i -> (Double, Double) in
                let t = start.addingTimeInterval(span * Double(i) / 144)
                return (Double(i) / 144, Astro.sunAltitude(at: t, coordinates: coordinates))
            }
            let maxAlt = max(30, samples.map { abs($0.1) }.max() ?? 90)
            let horizon = h * 0.55
            let point = { (fraction: Double, altitude: Double) -> CGPoint in
                CGPoint(x: 8 + (w - 16) * fraction,
                        y: horizon - altitude / maxAlt * (altitude >= 0 ? horizon - 10 : h - horizon - 6))
            }
            let at = { (date: Date) -> CGPoint in
                point(min(1, max(0, date.timeIntervalSince(start) / span)), Astro.sunAltitude(at: date, coordinates: coordinates))
            }
            let progress = min(1, max(0, now.timeIntervalSince(start) / span))
            let curve = Path { p in
                p.move(to: point(samples[0].0, samples[0].1))
                for s in samples.dropFirst() { p.addLine(to: point(s.0, s.1)) }
            }
            // Travelled part, by time (not by path length).
            let travelled = Path { p in
                p.move(to: point(samples[0].0, samples[0].1))
                for s in samples.dropFirst() where s.0 < progress { p.addLine(to: point(s.0, s.1)) }
                p.addLine(to: at(now))
            }

            ZStack {
                Rectangle().fill(Color.primary.opacity(0.22)).frame(height: 1).position(x: w / 2, y: horizon)
                curve.stroke(Color.primary.opacity(0.22), style: StrokeStyle(lineWidth: 1.5, dash: [3, 5]))
                travelled
                    .stroke(LinearGradient(colors: [Color.primary.opacity(0.2), glow.opacity(0.95)],
                                           startPoint: .leading, endPoint: .trailing),
                            style: StrokeStyle(lineWidth: 2.5, lineCap: .round))

                ForEach(Prayer.allCases) { prayer in
                    let time = day.time(prayer)
                    let passed = time <= now
                    Circle()
                        .strokeBorder(Color.primary.opacity(passed ? 0 : 0.7), lineWidth: 1.5)
                        .background(Circle().fill(Color.primary.opacity(passed ? 0.85 : 0)))
                        .frame(width: 8, height: 8)
                        .position(at(time))
                }

                let here = at(now)
                let isDay = Astro.sunAltitude(at: now, coordinates: coordinates) > -0.833
                ZStack {
                    Circle().fill(glow.opacity(0.4)).frame(width: 34, height: 34).blur(radius: 9)
                    if isDay {
                        Circle().fill(glow).frame(width: 14, height: 14)
                    } else {
                        Image(systemName: "moon.fill").font(.system(size: 13)).foregroundStyle(glow)
                    }
                }
                .position(here)
            }
        }
        .accessibilityHidden(true)
    }
}
