import SwiftUI

/// The prayer tracker: the streak, a pause for haid, nifas or illness, and a
/// month at a glance. Everything here stays on this phone.
struct TrackerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    /// Months back from this one (0 = this month).
    @State private var monthsBack = 0

    private static let pink = Color(red: 0.88, green: 0.42, blue: 0.54)

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 8) {
                        Image(systemName: model.trackerPaused ? "pause.fill" : "flame.fill").foregroundStyle(.orange)
                        Text("\(model.streak)").font(.largeTitle.bold()).monospacedDigit()
                        Text("day streak").foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                    if model.trackerPaused {
                        Button { model.endTrackerPause() } label: { Label("End pause", systemImage: "play.fill") }
                    } else {
                        Button { model.pauseTracker() } label: { Label("Pause tracker", systemImage: "pause.fill") }
                        Button { model.toggleExcused(.now) } label: {
                            Label(model.isExcused(.now) ? "Excused today (tap to undo)" : "Excuse just today", systemImage: "drop.fill")
                        }
                        .tint(Self.pink)
                    }
                } footer: {
                    if let since = model.prefs.trackerPausedSince {
                        Text("Paused since \(Self.label(since)). These days count as excused, so your streak waits for you.")
                    } else {
                        Text("For haid, nifas or illness: pause the tracker and every day until you end it counts as excused.")
                    }
                }

                Section {
                    month
                } footer: {
                    Text("Tap a prayer on the Prayer screen once its time has come to tick it off. Your tracker is kept only on this phone - never uploaded, and it moves to a new phone only through Move my settings.")
                }
            }
            .navigationTitle("Prayer tracker")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }

    // MARK: Month

    private var shown: (year: Int, month: Int) {
        let today = model.dayKey(.now).split(separator: "-").compactMap { Int($0) }
        let total = today[0] * 12 + (today[1] - 1) - monthsBack
        return (total / 12, total % 12 + 1)
    }

    private var month: some View {
        let (y, m) = shown
        let today = model.dayKey(.now)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let first = cal.date(from: DateComponents(year: y, month: m, day: 1))!
        let count = cal.range(of: .day, in: .month, for: first)!.count
        let lead = (cal.component(.weekday, from: first) + 5) % 7 // Monday first
        let keys: [String?] = Array(repeating: nil, count: lead) + (1...count).map { String(format: "%04d-%02d-%02d", y, m, $0) }
        let past = keys.compactMap { $0 }.filter { $0 <= today }
        let days = past.map { model.trackerDay($0) }
        let excused = days.filter { $0.excused }.count
        let prayed = days.filter { !$0.excused }.reduce(0) { $0 + $1.prayed }
        let counted = (past.count - excused) * Prayer.obligatory.count
        return VStack(spacing: 12) {
            HStack {
                Button { monthsBack += 1 } label: { Image(systemName: "chevron.left") }
                    .accessibilityLabel("Previous month")
                Spacer()
                Text(first.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "en_GB")))).font(.headline)
                Spacer()
                Button { monthsBack -= 1 } label: { Image(systemName: "chevron.right") }
                    .disabled(monthsBack == 0)
                    .accessibilityLabel("Next month")
            }
            .buttonStyle(.borderless)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
                ForEach(Array(["M", "T", "W", "T", "F", "S", "S"].enumerated()), id: \.offset) { _, d in
                    Text(d).font(.caption).foregroundStyle(.secondary)
                }
                ForEach(Array(keys.enumerated()), id: \.offset) { _, key in
                    if let key { dayCell(key, today: today) } else { Color.clear.frame(height: 38) }
                }
            }
            HStack(spacing: 14) {
                Label("All five", systemImage: "circle.fill").foregroundStyle(.green)
                Label("Some", systemImage: "circle.lefthalf.filled").foregroundStyle(.green)
                Label("Excused", systemImage: "drop.fill").foregroundStyle(Self.pink)
            }
            .font(.caption)
            Group {
                if counted > 0 {
                    Text("\(prayed) of \(counted) prayers ticked") + Text(excused > 0 ? " · \(excused) excused day\(excused == 1 ? "" : "s")" : "").foregroundColor(.secondary)
                } else {
                    Text("Nothing to count yet")
                }
            }
            .font(.subheadline)
        }
        .padding(.vertical, 6)
    }

    private func dayCell(_ key: String, today: String) -> some View {
        let d = model.trackerDay(key)
        let n = Int(key.suffix(2)) ?? 0
        let future = key > today
        let full = d.prayed >= Prayer.obligatory.count
        return ZStack {
            if future {
                Text("\(n)").foregroundStyle(.tertiary)
            } else if full {
                Circle().fill(.green)
                Text("\(n)").fontWeight(.semibold).foregroundStyle(.white)
            } else if d.excused {
                Circle().fill(Self.pink.opacity(0.28))
                Image(systemName: "drop.fill").font(.caption).foregroundStyle(Self.pink)
            } else {
                Circle().stroke(Color.primary.opacity(0.14), lineWidth: 3)
                Circle().trim(from: 0, to: CGFloat(d.prayed) / CGFloat(Prayer.obligatory.count))
                    .stroke(.green, style: StrokeStyle(lineWidth: 3, lineCap: .round)).rotationEffect(.degrees(-90))
                Text("\(n)")
            }
            if key == today { Circle().stroke(.orange, lineWidth: 2).padding(-3) }
        }
        .font(.footnote.monospacedDigit())
        .frame(width: 38, height: 38)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(n): \(future ? "not yet" : d.excused ? "excused" : "\(d.prayed) of 5 prayers")")
    }

    private static func label(_ key: String) -> String {
        let p = key.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return key }
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return "\(p[2]) \(months[p[1] - 1])"
    }
}
