import SwiftUI
import WidgetKit

@main
struct PrayerTimesAsiaWidgets: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        TimetableWidget()
        LockScreenWidget()
        PrayerLiveActivity()
    }
}

// MARK: Timeline

struct PrayerEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct PrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry { PrayerEntry(date: .now, snapshot: .preview) }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(PrayerEntry(date: .now, snapshot: WidgetSnapshot.load() ?? .preview))
    }

    /// An entry every 15 minutes (the sky colour drifts) plus one exactly at each
    /// prayer, for 24 hours. Countdowns tick on their own between entries.
    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let snapshot = WidgetSnapshot.load()
        let now = Date.now
        var dates = Set<Date>([now])
        for i in 1...96 { dates.insert(now.addingTimeInterval(Double(i) * 900)) }
        for item in snapshot?.timeline ?? [] where item.time > now && item.time < now.addingTimeInterval(86_400) {
            dates.insert(item.time)
        }
        let entries = dates.sorted().map { PrayerEntry(date: $0, snapshot: snapshot) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

extension WidgetSnapshot {
    /// Placeholder for the widget gallery: Singapore, calculated live.
    static var preview: WidgetSnapshot {
        let tz = TimeZone(identifier: "Asia/Singapore")!
        var days: [Day] = []
        for offset in 0..<2 {
            let d = PrayerEngine.compute(for: Date.now.addingTimeInterval(Double(offset) * 86_400), in: tz,
                                         at: Coordinates(latitude: 1.3521, longitude: 103.8198), method: .muis, asr: .standard)
            var times: [String: Date] = [:]
            for p in Prayer.allCases { times[p.rawValue] = d.time(p) }
            days.append(Day(year: d.year, month: d.month, day: d.day, times: times))
        }
        return WidgetSnapshot(placeName: "Singapore", flag: "🇸🇬", timeZoneID: tz.identifier, naming: .malay,
                              use24Hour: false, sourceLabel: "MUIS", days: days, updated: .now)
    }
}

// MARK: Home Screen widget

struct NextPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextPrayer", provider: PrayerProvider()) { entry in
            NextPrayerView(entry: entry)
        }
        .configurationDisplayName("Next prayer")
        .description("Countdown to the next prayer, under your Living Sky.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

struct NextPrayerView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PrayerEntry

    var body: some View {
        Group {
            if let s = entry.snapshot, let next = s.next(after: entry.date) {
                let sky = s.day(containing: entry.date).map { SkyColors.at(entry.date, day: $0) } ?? .night
                content(s, next: next)
                    .containerBackground(for: .widget) {
                        ZStack {
                            LinearGradient(colors: [sky.top.color, sky.bottom.color], startPoint: .top, endPoint: .bottom)
                            RadialGradient(colors: [sky.glow.color.opacity(0.35), .clear],
                                           center: UnitPoint(x: 0.5, y: 1.1), startRadius: 4, endRadius: 200)
                        }
                    }
            } else {
                Text("Open Prayer Times Asia to set your location.")
                    .font(.caption)
                    .padding()
                    .containerBackground(for: .widget) { SkyColors.preDawn.top.color }
            }
        }
        .foregroundStyle(.white)
    }

    @ViewBuilder
    private func content(_ s: WidgetSnapshot, next: (prayer: Prayer, time: Date)) -> some View {
        let small = VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: next.prayer.symbol)
                Text(s.placeName).lineLimit(1)
            }
            .font(.caption2.weight(.semibold))
            .opacity(0.85)
            Spacer(minLength: 0)
            Text(s.name(next.prayer, at: next.time))
                .font(.headline)
            Text(s.format(next.time))
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(timerInterval: entry.date...max(entry.date, next.time), countsDown: true)
                .font(.caption.weight(.medium).monospacedDigit())
                .opacity(0.85)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

        if family == .systemMedium {
            HStack(spacing: 0) {
                small.frame(maxWidth: 150)
                let current = s.current(at: entry.date)?.prayer
                if let day = s.day(containing: entry.date) {
                    VStack(spacing: 3) {
                        ForEach(Prayer.allCases) { p in
                            HStack {
                                Text(s.name(p, at: day.time(p))).font(.caption.weight(p == current ? .bold : .medium))
                                Spacer()
                                Text(s.format(day.time(p))).font(.caption.monospacedDigit())
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(p == current ? Color.white.opacity(0.22) : .clear, in: Capsule())
                            .opacity(day.time(p) < entry.date && p != current ? 0.65 : 1)
                        }
                    }
                    .padding(.vertical, 12)
                    .padding(.trailing, 12)
                }
            }
        } else {
            small
        }
    }
}

// MARK: Lock Screen widget

struct LockScreenWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LockScreenNext", provider: PrayerProvider()) { entry in
            LockScreenView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Next prayer")
        .description("The next prayer on your Lock Screen.")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

struct LockScreenView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PrayerEntry

    var body: some View {
        if let s = entry.snapshot, let next = s.next(after: entry.date) {
            let name = s.name(next.prayer, at: next.time)
            let shortTime = s.format(next.time).replacingOccurrences(of: " AM", with: "").replacingOccurrences(of: " PM", with: "")
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: next.prayer.symbol).font(.caption2)
                        Text(shortTime)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .minimumScaleFactor(0.6)
                        Text(timerInterval: entry.date...max(entry.date, next.time), countsDown: true)
                            .font(.system(size: 10, weight: .medium, design: .rounded)).monospacedDigit()
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.6)
                    }
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                }
            case .accessoryInline:
                Label {
                    Text("\(name) \(shortTime) · ") + Text(timerInterval: entry.date...max(entry.date, next.time), countsDown: true)
                } icon: {
                    Image(systemName: next.prayer.symbol)
                }
            default:
                VStack(alignment: .leading, spacing: 1) {
                    Label(name, systemImage: next.prayer.symbol).font(.headline)
                    Text(s.format(next.time)).font(.system(.body, design: .rounded).weight(.semibold))
                    Text(timerInterval: entry.date...max(entry.date, next.time), countsDown: true)
                        .font(.caption.monospacedDigit())
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            Text("Open the app")
        }
    }
}
