import SwiftUI
import WidgetKit

/// The whole day as colour bands - prayertime.sg's idea, in the app's calmer
/// palette. Large, so the times can be read from across the room.
struct TimetableWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Timetable", provider: PrayerProvider()) { entry in
            TimetableView(entry: entry)
        }
        .configurationDisplayName("Today's timetable")
        .description("All of today's prayer times, one colour each.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

struct TimetableView: View {
    let entry: PrayerEntry

    var body: some View {
        TimetableCard(snapshot: entry.snapshot, date: entry.date)
            .containerBackground(for: .widget) { Color(white: 0.13) }
    }
}
