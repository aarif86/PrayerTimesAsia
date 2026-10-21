import SwiftUI

/// The sun's path from Syuruk to Maghrib with today's prayers marked on it.
/// By night the same arc carries the moon from Maghrib to the next Subuh.
struct SunArc: View {
    let now: Date
    let day: PrayerDay
    let nextFajr: Date?
    let glow: Color

    private var isDay: Bool { now >= day.time(.sunrise) && now < day.time(.maghrib) }

    private var progress: Double {
        let (start, end): (Date, Date) = isDay
            ? (day.time(.sunrise), day.time(.maghrib))
            : (now < day.time(.sunrise)
                ? (day.time(.maghrib).addingTimeInterval(-86_400), day.time(.fajr))
                : (day.time(.maghrib), nextFajr ?? day.time(.maghrib).addingTimeInterval(36_000)))
        let span = end.timeIntervalSince(start)
        guard span > 0 else { return 0 }
        return min(1, max(0, now.timeIntervalSince(start) / span))
    }

    private var markers: [Double] {
        guard isDay else { return [] }
        let start = day.time(.sunrise), span = day.time(.maghrib).timeIntervalSince(start)
        return [Prayer.dhuhr, .asr].map { day.time($0).timeIntervalSince(start) / span }
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let point = { (f: Double) -> CGPoint in
                // Half-ellipse from bottom-left to bottom-right.
                let angle = Double.pi * (1 - f)
                return CGPoint(x: w / 2 + cos(angle) * (w / 2 - 12), y: h - sin(angle) * (h - 14))
            }
            ZStack {
                Path { p in
                    p.move(to: point(0))
                    for i in 1...60 { p.addLine(to: point(Double(i) / 60)) }
                }
                .stroke(.white.opacity(0.28), style: StrokeStyle(lineWidth: 1.5, dash: [3, 5]))

                Path { p in
                    p.move(to: point(0))
                    let steps = max(1, Int(progress * 60))
                    for i in 0...steps { p.addLine(to: point(progress * Double(i) / Double(steps))) }
                }
                .stroke(LinearGradient(colors: [.white.opacity(0.15), glow.opacity(0.9)],
                                       startPoint: .leading, endPoint: .trailing),
                        style: StrokeStyle(lineWidth: 2.5, lineCap: .round))

                ForEach(Array(markers.enumerated()), id: \.offset) { _, f in
                    Circle().fill(.white.opacity(0.7)).frame(width: 5, height: 5).position(point(f))
                }

                Rectangle().fill(.white.opacity(0.18)).frame(height: 1).position(x: w / 2, y: h)

                let sun = point(progress)
                ZStack {
                    Circle().fill(glow.opacity(0.35)).frame(width: 34, height: 34).blur(radius: 8)
                    if isDay {
                        Circle().fill(glow).frame(width: 14, height: 14)
                    } else {
                        Image(systemName: "moon.fill").font(.system(size: 13)).foregroundStyle(glow)
                    }
                }
                .position(sun)
            }
        }
        .accessibilityHidden(true)
    }
}
