import AppIntents
import SwiftUI
import WidgetKit

/// The whole day at a glance, in any of the five looks.
struct TimetableWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "Timetable", intent: TimetableStyleIntent.self, provider: TimetableProvider()) { entry in
            TimetableView(entry: entry)
        }
        .configurationDisplayName("Today's timetable")
        .description("All of today's prayer times. Touch and hold, then Edit Widget, to pick a look.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

/// "Same as app" follows the look chosen on the Prayer screen. Widgets set to the retired
/// Side Dial or Day Dial no longer decode and fall back to "Same as app".
enum WidgetStyleChoice: String, AppEnum {
    case app, centre, sunPath, bands, simple, gold

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Look"
    static let caseDisplayRepresentations: [WidgetStyleChoice: DisplayRepresentation] = [
        .app: "Same as app",
        .centre: "Centre Dial",
        .sunPath: "Sun Path",
        .bands: "Colour Bands",
        .simple: "Big and Simple",
        .gold: "Calm Gold",
    ]

    func resolved(_ snapshot: WidgetSnapshot?) -> TodayStyle {
        switch self {
        case .app: (snapshot?.style ?? .centre).look
        case .centre: .centre
        case .sunPath: .sunPath
        case .bands: .bands
        case .simple: .simple
        case .gold: .gold
        }
    }
}

struct TimetableStyleIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Timetable look"
    static let description = IntentDescription("Choose how the timetable looks.")

    @Parameter(title: "Look", default: .app)
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
        TimetableEntry(date: .now, snapshot: .preview, style: .centre)
    }

    func snapshot(for configuration: TimetableStyleIntent, in context: Context) async -> TimetableEntry {
        let snapshot = WidgetSnapshot.load() ?? .preview
        return TimetableEntry(date: .now, snapshot: snapshot, style: configuration.style.resolved(snapshot))
    }

    func timeline(for configuration: TimetableStyleIntent, in context: Context) async -> Timeline<TimetableEntry> {
        let snapshot = WidgetSnapshot.load()
        let style = configuration.style.resolved(snapshot)
        return Timeline(entries: WidgetSnapshot.entryDates(snapshot).map { TimetableEntry(date: $0, snapshot: snapshot, style: style) },
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
