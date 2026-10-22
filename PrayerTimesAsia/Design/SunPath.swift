import SwiftUI

/// The day as one smooth arc, local midnight to midnight, edge to edge: highest
/// at solar noon, crossing the horizon line at sunrise and sunset, with every
/// prayer marked at its time. Stylised on purpose - the real altitude curve is
/// nearly straight-sided in the tropics and reads as a mountain, not a day.
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

    private func fraction(_ date: Date) -> Double {
        min(1, max(0, date.timeIntervalSince(start) / 86_400))
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let noon = fraction(day.time(.dhuhr))
            // Half the day length, as a fraction of 24 h, from sunrise and Maghrib.
            let halfDay = (fraction(day.time(.maghrib)) - fraction(day.time(.sunrise))) / 2
            let horizonValue = cos(2 * .pi * halfDay)
            let top: CGFloat = 10, bottom = h - 6
            let y = { (value: Double) -> CGFloat in
                bottom - CGFloat((value + 1) / 2) * (bottom - top)
            }
            let horizon = y(horizonValue)
            let point = { (f: Double) -> CGPoint in
                CGPoint(x: CGFloat(f) * w, y: y(cos(2 * .pi * (f - noon))))
            }
            let curve = Path { p in
                p.move(to: point(0))
                for i in 1...240 { p.addLine(to: point(Double(i) / 240)) }
            }
            let isDay = now >= day.time(.sunrise) && now < day.time(.maghrib)

            ZStack {
                Rectangle().fill(Color.primary.opacity(0.14)).frame(height: 1).position(x: w / 2, y: horizon)
                // Night part of the arc: quiet.
                curve.stroke(Color.primary.opacity(0.22), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                // Day part: warm, clipped to above the horizon.
                curve.stroke(glow, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .mask(alignment: .top) { Rectangle().frame(height: max(0, horizon)) }

                ForEach(Prayer.allCases) { prayer in
                    let time = day.time(prayer)
                    let passed = time <= now
                    Circle()
                        .fill(passed ? Color.primary.opacity(0.9) : Color.clear)
                        .overlay(Circle().strokeBorder(Color.primary.opacity(0.85), lineWidth: 1.5))
                        .frame(width: 9, height: 9)
                        .position(point(fraction(time)))
                }

                ZStack {
                    Circle().fill(glow.opacity(0.45)).frame(width: 34, height: 34).blur(radius: 9)
                    if isDay {
                        Circle().fill(glow).frame(width: 14, height: 14)
                    } else {
                        Image(systemName: "moon.fill").font(.system(size: 13)).foregroundStyle(glow)
                    }
                }
                .position(point(fraction(now)))
            }
        }
        .accessibilityHidden(true)
    }
}
