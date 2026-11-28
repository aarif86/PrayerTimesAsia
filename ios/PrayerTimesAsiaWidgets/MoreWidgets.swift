import SwiftUI
import WidgetKit

// The newer Home Screen widgets. All follow the look chosen on the Prayer screen, in Light and
// Dark, and share the Next prayer timeline (every 15 minutes and at each prayer).

/// The prayer you are in, then the one after it.
struct NowNextWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NowNext", provider: PrayerProvider()) { entry in
            NowNextView(entry: entry)
        }
        .configurationDisplayName("Now and Next")
        .description("The prayer you are in, and the one after it.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct NowNextView: View {
    let entry: PrayerEntry

    var body: some View {
        let style = WidgetStyleChoice.app.resolved(entry.snapshot)
        Group {
            if let s = entry.snapshot {
                AnyView(WidgetNowNextFace(snapshot: s, date: entry.date, style: style))
            } else {
                Text(W("widget.setLocation")).font(.caption).padding()
            }
        }
        .containerBackground(for: .widget) {
            WidgetMore.background(entry.snapshot, date: entry.date, style: style, prayer: nil)
        }
    }
}

/// The prayer you are in with its time range.
struct CurrentPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "CurrentPrayer", provider: PrayerProvider()) { entry in
            CurrentPrayerView(entry: entry)
        }
        .configurationDisplayName("Current prayer")
        .description("The prayer time you are in now, from start to end.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct CurrentPrayerView: View {
    let entry: PrayerEntry

    var body: some View {
        let style = WidgetStyleChoice.app.resolved(entry.snapshot)
        Group {
            if let s = entry.snapshot {
                AnyView(WidgetCurrentFace(snapshot: s, date: entry.date, style: style))
            } else {
                Text(W("widget.setLocation")).font(.caption).padding()
            }
        }
        .containerBackground(for: .widget) {
            WidgetMore.background(entry.snapshot, date: entry.date, style: style,
                                  prayer: entry.snapshot.flatMap { WidgetCurrentFace.prayer($0, entry.date) })
        }
    }
}

/// Today's five prayers on one line.
struct DayBarWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DayBar", provider: PrayerProvider()) { entry in
            DayBarView(entry: entry)
        }
        .configurationDisplayName("Day bar")
        .description("Today's five prayers on one line, with where you are now.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct DayBarView: View {
    let entry: PrayerEntry

    var body: some View {
        let style = WidgetStyleChoice.app.resolved(entry.snapshot)
        Group {
            if let s = entry.snapshot, let day = s.day(containing: entry.date) {
                AnyView(WidgetDayBarFace(snapshot: s, day: day, date: entry.date, style: style))
            } else {
                Text(W("widget.setLocation")).font(.caption).padding()
            }
        }
        .containerBackground(for: .widget) {
            WidgetMore.background(entry.snapshot, date: entry.date, style: style, prayer: nil)
        }
    }
}

/// The Hijri month with Ramadan and Eid marked.
struct HijriCalendarWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HijriCalendar", provider: PrayerProvider()) { entry in
            HijriCalendarView(entry: entry)
        }
        .configurationDisplayName("Hijri calendar")
        .description("The Hijri month with Ramadan and Eid marked. Dates are expected, so follow your local religious authority.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

struct HijriCalendarView: View {
    let entry: PrayerEntry

    var body: some View {
        let style = WidgetStyleChoice.app.resolved(entry.snapshot)
        Group {
            if let s = entry.snapshot {
                AnyView(WidgetHijriFace(snapshot: s, date: entry.date, style: style))
            } else {
                Text(W("widget.setLocation")).font(.caption).padding()
            }
        }
        .containerBackground(for: .widget) {
            WidgetMore.background(entry.snapshot, date: entry.date, style: style, prayer: nil)
        }
    }
}
