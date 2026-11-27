import SwiftUI
import WidgetKit

@main
struct PrayerTimesAsiaWidgets: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        TimetableWidget()
        LockScreenWidget()
        #if !targetEnvironment(macCatalyst)
        PrayerLiveActivity()
        #endif
        #if canImport(AlarmKit) && !targetEnvironment(macCatalyst)
        if #available(iOS 26.0, *) {
            WakeUpAlarmActivity()
        }
        #endif
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
    /// prayer, for 12 hours, then WidgetKit asks again. Countdowns tick on their
    /// own between entries. Kept short so the widget stays well inside its
    /// small memory allowance.
    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let snapshot = WidgetSnapshot.load()
        let entries = WidgetSnapshot.entryDates(snapshot).map { PrayerEntry(date: $0, snapshot: snapshot) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

extension WidgetSnapshot {
    /// Now, every 15 minutes for 12 hours, and each prayer in between.
    static func entryDates(_ snapshot: WidgetSnapshot?, from now: Date = .now) -> [Date] {
        var dates = Set<Date>([now])
        for i in 1...48 { dates.insert(now.addingTimeInterval(Double(i) * 900)) }
        for item in snapshot?.timeline ?? [] where item.time > now && item.time < now.addingTimeInterval(43_200) {
            dates.insert(item.time)
        }
        // In Ramadan, Imsak too, so the countdown turns to Berbuka right on time.
        for fast in snapshot?.fasts ?? [] where fast.imsak > now && fast.imsak < now.addingTimeInterval(43_200) {
            dates.insert(fast.imsak)
        }
        return dates.sorted()
    }

    /// Placeholder for the widget gallery: Singapore, calculated live.
    static var preview: WidgetSnapshot {
        let tz = TimeZone(identifier: "Asia/Singapore")!
        var days: [Day] = []
        for offset in 0..<2 {
            let d = PrayerEngine.compute(for: DayStep.noon(.now, plus: offset, in: tz), in: tz,
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
        // Large too, so "Large" shows when someone touches and holds this widget to
        // resize it (it opens the full timetable, in the Prayer screen's look).
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct NextPrayerView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PrayerEntry

    var body: some View {
        if family == .systemLarge {
            // The big size is the whole day, the same card as "Today's timetable" in the app's own look.
            let style = WidgetStyleChoice.app.resolved(entry.snapshot)
            AnyView(TimetableCard(snapshot: entry.snapshot, date: entry.date, style: style))
                .containerBackground(for: .widget) {
                    TimetableCard.background(entry.snapshot, at: entry.date, style: style)
                }
        } else {
            smallOrMedium
        }
    }

    private var smallOrMedium: some View {
        Group {
            if let s = entry.snapshot, let next = s.next(after: entry.date) {
                let style = WidgetStyleChoice.app.resolved(s)
                let head = Self.headline(s, next: next, date: entry.date)
                AnyView(content(s, head: head, style: style))
                    .containerBackground(for: .widget) {
                        if style.look == .bands && family == .systemSmall {
                            BandsPalette.color(head.prayer)
                        } else {
                            TimetableCard.background(s, at: entry.date, style: style)
                        }
                    }
            } else {
                Text("Open Prayer Times Asia to set your location.")
                    .font(.caption)
                    .foregroundStyle(.white)
                    .padding()
                    .containerBackground(for: .widget) { SkyColors.preDawn.top.color }
            }
        }
    }

    /// Ramadan: count down to Berbuka by day and Imsak at night; the next prayer
    /// stays as a small line when it is a different moment. Outside Ramadan, the next prayer.
    private static func headline(_ s: WidgetSnapshot, next: (prayer: Prayer, time: Date), date: Date) -> WidgetHeadline {
        let fast = s.fastMoment(at: date)
        return WidgetHeadline(title: fast?.label ?? s.name(next.prayer, at: next.time),
                              target: fast?.time ?? next.time,
                              prayer: next.prayer,
                              nextLine: nextLine(s, next: next, fastTime: fast?.time),
                              isFast: fast != nil)
    }

    /// "Asar 4:32 PM" under the Ramadan countdown; nil outside Ramadan or when the next prayer is Berbuka itself.
    private static func nextLine(_ s: WidgetSnapshot, next: (prayer: Prayer, time: Date), fastTime: Date?) -> String? {
        guard let fastTime, abs(fastTime.timeIntervalSince(next.time)) >= 60 else { return nil }
        return "\(s.name(next.prayer, at: next.time)) \(s.format(next.time))"
    }

    @ViewBuilder
    private func content(_ s: WidgetSnapshot, head: WidgetHeadline, style: TodayStyle) -> some View {
        let day = s.day(containing: entry.date)
        let pal = WidgetPal.of(style)
        let face = WidgetHeadlineFace(snapshot: s, day: day, date: entry.date, style: style, head: head,
                                      medium: family == .systemMedium)
            .overlay(alignment: .bottom) {
                if let line = head.nextLine {
                    Text(line).font(.caption2.weight(.medium)).lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(style.look == .bands ? Color.white.opacity(0.85) : pal.fg2)
                        .padding(.bottom, 6)
                }
            }
            // One VoiceOver stop: place, prayer, time, time left.
            .accessibilityElement(children: .combine)

        if family == .systemMedium, let day {
            HStack(spacing: 0) {
                face
                    .frame(width: 150)
                    .background {
                        if style.look == .bands { BandsPalette.color(head.prayer).ignoresSafeArea() }
                    }
                AnyView(WidgetList(snapshot: s, day: day, date: entry.date, style: style, size: 12, compact: true))
                    .padding(style.look == .bands ? EdgeInsets() : EdgeInsets(top: 10, leading: 4, bottom: 10, trailing: 10))
            }
            .foregroundStyle(pal.fg)
        } else {
            face
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
        if let s = entry.snapshot, let prayer = s.next(after: entry.date) {
            // Ramadan: Berbuka by day, Imsak at night. Otherwise the next prayer.
            let fast = s.fastMoment(at: entry.date)
            let next = (time: fast?.time ?? prayer.time, symbol: fast?.symbol ?? prayer.prayer.symbol)
            let name = fast?.label ?? s.name(prayer.prayer, at: prayer.time)
            let shortTime = s.format(next.time).replacingOccurrences(of: " AM", with: "").replacingOccurrences(of: " PM", with: "")
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: next.symbol).font(.caption2).accessibilityHidden(true)
                        Text(shortTime)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .minimumScaleFactor(0.6)
                            // The circle drops AM and PM to fit; VoiceOver says the name and the full time.
                            .accessibilityLabel("\(name), \(s.format(next.time))")
                        Text(timerInterval: entry.date...max(entry.date, next.time), countsDown: true)
                            .font(.system(size: 10, weight: .medium, design: .rounded)).monospacedDigit()
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.6)
                    }
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                    .accessibilityElement(children: .combine)
                }
            case .accessoryInline:
                Label {
                    Text("\(name) \(shortTime) · ") + Text(timerInterval: entry.date...max(entry.date, next.time), countsDown: true)
                } icon: {
                    Image(systemName: next.symbol)
                }
            default:
                VStack(alignment: .leading, spacing: 1) {
                    Label(name, systemImage: next.symbol).font(.headline)
                    Text(s.format(next.time)).font(.system(.body, design: .rounded).weight(.semibold))
                    Text(timerInterval: entry.date...max(entry.date, next.time), countsDown: true)
                        .font(.caption.monospacedDigit())
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
            }
        } else {
            Text("Open the app")
        }
    }
}
