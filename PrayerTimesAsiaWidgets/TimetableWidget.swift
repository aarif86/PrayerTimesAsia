import AppIntents
import SwiftUI
import WidgetKit

/// The whole day at a glance, in any of the Prayer screen's styles.
struct TimetableWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "Timetable", intent: TimetableStyleIntent.self, provider: TimetableProvider()) { entry in
            TimetableView(entry: entry)
        }
        .configurationDisplayName("Today's timetable")
        .description("All of today's prayer times. Touch and hold, then Edit Widget, to pick a style.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

/// "Same as app" follows the style chosen on the Prayer screen.
enum WidgetStyleChoice: String, AppEnum {
    case app, list, dial, sunPath, bands

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Style"
    static let caseDisplayRepresentations: [WidgetStyleChoice: DisplayRepresentation] = [
        .app: "Same as app",
        .list: "Side Dial (list)",
        .dial: "Day Dial",
        .sunPath: "Sun Path",
        .bands: "Colour Bands",
    ]

    func resolved(_ snapshot: WidgetSnapshot?) -> TodayStyle {
        switch self {
        case .app: snapshot?.style ?? .centre
        case .list: .list
        case .dial: .dial
        case .sunPath: .sunPath
        case .bands: .bands
        }
    }
}

struct TimetableStyleIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Timetable style"
    static let description = IntentDescription("Choose how the timetable looks.")

    @Parameter(title: "Style", default: .app)
    var style: WidgetStyleChoice
}

struct TimetableEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    let style: TodayStyle
}

/// The same timeline as the other widgets (every 15 minutes and at each prayer).
struct TimetableProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> TimetableEntry {
        TimetableEntry(date: .now, snapshot: .preview, style: .list)
    }

    func snapshot(for configuration: TimetableStyleIntent, in context: Context) async -> TimetableEntry {
        let snapshot = WidgetSnapshot.load() ?? .preview
        return TimetableEntry(date: .now, snapshot: snapshot, style: configuration.style.resolved(snapshot))
    }

    func timeline(for configuration: TimetableStyleIntent, in context: Context) async -> Timeline<TimetableEntry> {
        let snapshot = WidgetSnapshot.load()
        let style = configuration.style.resolved(snapshot)
        let now = Date.now
        var dates = Set<Date>([now])
        for i in 1...96 { dates.insert(now.addingTimeInterval(Double(i) * 900)) }
        for item in snapshot?.timeline ?? [] where item.time > now && item.time < now.addingTimeInterval(86_400) {
            dates.insert(item.time)
        }
        return Timeline(entries: dates.sorted().map { TimetableEntry(date: $0, snapshot: snapshot, style: style) },
                        policy: .atEnd)
    }
}

struct TimetableView: View {
    let entry: TimetableEntry

    var body: some View {
        TimetableCard(snapshot: entry.snapshot, date: entry.date, style: entry.style)
            .containerBackground(for: .widget) {
                TimetableCard.background(entry.snapshot, at: entry.date, style: entry.style)
            }
    }
}
