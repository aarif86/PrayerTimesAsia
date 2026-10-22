import SwiftUI
import WidgetKit

/// The whole day at a glance: a mini version of the Prayer screen's list.
struct TimetableWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Timetable", provider: PrayerProvider()) { entry in
            TimetableView(entry: entry)
        }
        .configurationDisplayName("Today's timetable")
        .description("All of today's prayer times, like the Prayer screen.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

struct TimetableView: View {
    let entry: PrayerEntry

    var body: some View {
        TimetableCard(snapshot: entry.snapshot, date: entry.date)
            .containerBackground(for: .widget) { TimetableCard.sky(entry.snapshot, at: entry.date) }
    }
}
