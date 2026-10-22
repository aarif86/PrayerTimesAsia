import SwiftUI

/// The large widget's face: a mini version of the Prayer screen's list - same
/// thin colour bars, rings, large times and tinted-glass "now" row - under the
/// same Living Sky. Shared so the app can show it too (Settings preview, CI).
struct TimetableCard: View {
    let snapshot: WidgetSnapshot?
    let date: Date

    var body: some View {
        if let s = snapshot, let day = s.day(containing: date) {
            let current = s.current(at: date)?.prayer
            VStack(spacing: 8) {
                header(s, day: day)
                VStack(spacing: 2) {
                    ForEach(Prayer.allCases) { prayer in
                        row(s, prayer: prayer, time: day.time(prayer), isCurrent: prayer == current)
                    }
                }
                .padding(5)
                .background(Color.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
            }
            .padding(12)
            .foregroundStyle(.white)
        } else {
            Text("Open Prayer Times Asia to set your location.")
                .font(.headline)
                .foregroundStyle(.white)
                .padding()
        }
    }

    /// The sky behind the card, for the widget container and the preview.
    static func sky(_ snapshot: WidgetSnapshot?, at date: Date) -> some View {
        let colors = snapshot?.day(containing: date).map { SkyColors.at(date, day: $0) } ?? .night
        return ZStack {
            LinearGradient(colors: [colors.top.color, colors.bottom.color], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [colors.glow.color.opacity(0.3), .clear],
                           center: UnitPoint(x: 0.5, y: 1.1), startRadius: 4, endRadius: 260)
        }
    }

    private func header(_ s: WidgetSnapshot, day: PrayerDay) -> some View {
        let f = DateFormatter()
        f.timeZone = s.timeZone
        f.dateFormat = "EEEE d MMMM"
        return VStack(spacing: 4) {
            HStack(spacing: 6) {
                Text("TODAY").font(.system(size: 10, weight: .heavy)).tracking(0.4)
                Rectangle().fill(Color.white.opacity(0.35)).frame(width: 1, height: 9)
                Text("\(s.placeName) \(s.flag)").font(.system(size: 11, weight: .semibold)).lineLimit(1)
            }
            .padding(.horizontal, 10).padding(.vertical, 4)
            .overlay(Capsule().strokeBorder(Color(red: 0.97, green: 0.74, blue: 0.56).opacity(0.75), lineWidth: 1))
            HStack(spacing: 6) {
                Text(f.string(from: day.time(.dhuhr))).font(.system(size: 14, weight: .semibold))
                Text("·").opacity(0.5)
                Text(Hijri.format(date, timeZone: s.timeZone, style: s.naming, adjustment: s.hijriAdjustment ?? 0))
                    .font(.system(size: 12)).opacity(0.7)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
    }

    private func row(_ s: WidgetSnapshot, prayer: Prayer, time: Date, isCurrent: Bool) -> some View {
        let parts = timeParts(s, time)
        let passed = time <= date && !isCurrent
        return HStack(spacing: 10) {
            Circle().strokeBorder(prayer.tint, lineWidth: 1.8).frame(width: 16, height: 16)
            VStack(alignment: .leading, spacing: 0) {
                Text(s.name(prayer, at: time)).font(.system(size: 16, weight: .semibold))
                if isCurrent {
                    Text("NOW").font(.system(size: 9, weight: .heavy)).foregroundStyle(prayer.tint)
                }
            }
            Spacer(minLength: 4)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(parts.time).font(.system(size: 22, weight: .semibold, design: .rounded)).monospacedDigit()
                if let suffix = parts.suffix {
                    Text(suffix).font(.system(size: 11, weight: .bold, design: .rounded)).opacity(0.7)
                }
            }
            .fixedSize()
        }
        .padding(.leading, 12).padding(.trailing, 10)
        .frame(maxHeight: .infinity)
        .background {
            if isCurrent {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(prayer.tint.opacity(0.2))
                    .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .strokeBorder(prayer.tint.opacity(0.5), lineWidth: 1))
            }
        }
        .overlay(alignment: .leading) {
            Capsule().fill(prayer.tint.opacity(isCurrent ? 1 : 0.6)).frame(width: 3).padding(.vertical, 10).offset(x: 2)
        }
        .opacity(passed ? 0.6 : 1)
    }

    private func timeParts(_ s: WidgetSnapshot, _ date: Date) -> (time: String, suffix: String?) {
        let f = DateFormatter()
        f.timeZone = s.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = s.use24Hour ? "HH:mm" : "h:mm"
        let time = f.string(from: date)
        guard !s.use24Hour else { return (time, nil) }
        f.dateFormat = "a"
        return (time, f.string(from: date))
    }
}
