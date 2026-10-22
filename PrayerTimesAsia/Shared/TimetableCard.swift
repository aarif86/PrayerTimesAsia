import SwiftUI

/// The large widget's face, shared so the app can show the same thing
/// (Settings preview and CI screenshots).
struct TimetableCard: View {
    let snapshot: WidgetSnapshot?
    let date: Date

    var body: some View {
        if let s = snapshot, let day = s.day(containing: date) {
            let current = s.current(at: date)?.prayer
            VStack(spacing: 0) {
                header(s)
                ForEach(Prayer.allCases) { prayer in
                    band(s, prayer: prayer, time: day.time(prayer), isCurrent: prayer == current)
                }
            }
        } else {
            Text("Open Prayer Times Asia to set your location.")
                .font(.headline)
                .foregroundStyle(.white)
                .padding()
        }
    }

    private func header(_ s: WidgetSnapshot) -> some View {
        VStack(spacing: 1) {
            Text(Hijri.format(date, timeZone: s.timeZone, style: s.naming, adjustment: s.hijriAdjustment ?? 0))
                .font(.system(size: 19, weight: .semibold, design: .rounded))
            Text("\(s.placeName) \(s.flag)  ·  \(s.sourceLabel)")
                .font(.caption2.weight(.medium))
                .opacity(0.65)
                .lineLimit(1)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 9)
    }

    private func band(_ s: WidgetSnapshot, prayer: Prayer, time: Date, isCurrent: Bool) -> some View {
        let parts = timeParts(s, time)
        return HStack(alignment: .firstTextBaseline) {
            Text(s.name(prayer, at: time))
                .font(.system(size: 22, weight: .bold, design: .rounded))
            if isCurrent {
                Text("NOW")
                    .font(.system(size: 10, weight: .heavy))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(.white.opacity(0.25), in: Capsule())
            }
            Spacer()
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(parts.time).font(.system(size: 24, weight: .semibold, design: .rounded)).monospacedDigit()
                if let suffix = parts.suffix {
                    Text(suffix).font(.system(size: 13, weight: .bold, design: .rounded)).opacity(0.85)
                }
            }
            .fixedSize()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(prayer.tint.opacity(isCurrent ? 1 : 0.88))
        .overlay(alignment: .leading) {
            if isCurrent { Rectangle().fill(.white).frame(width: 4) }
        }
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
