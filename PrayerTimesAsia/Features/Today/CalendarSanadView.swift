import SwiftUI

/// Ramadan, Eid and the new year with a source for every date (brief v03 §7.1).
struct CalendarSanadView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            List {
                Section {
                    Picker("My community follows", selection: $model.prefs.communityAuthority) {
                        Text("Automatic · \(model.communityAuthority.map(CalendarSanad.authorityName) ?? "none")").tag(String?.none)
                        ForEach(CalendarSanad.authorities) { a in
                            Text(a.name).tag(String?.some(a.id))
                        }
                    }
                } footer: {
                    Text("Countries can start Ramadan and celebrate Eid on different days, because of local moon sighting and different methods. Pick whose announcement your masjid follows.")
                }

                ForEach(CalendarSanad.upcoming(after: .now, timeZone: model.timeZone)) { item in
                    Section {
                        if let expected = CalendarSanad.expected(item.event, hijriYear: item.hijriYear) {
                            row(title: "Expected", date: expected, detail: "Astronomical estimate (Umm al-Qura calendar). Local dates may differ by a day.",
                                status: nil, highlight: false, link: nil)
                        }
                        let entries = model.hijriCalendar.announcements(for: item.event, hijriYear: item.hijriYear)
                            .sorted { ($0.authority == model.communityAuthority ? 0 : 1, $0.authority) < ($1.authority == model.communityAuthority ? 0 : 1, $1.authority) }
                        ForEach(entries, id: \.self) { a in
                            if let date = a.gregorian {
                                row(title: CalendarSanad.authorityName(a.authority), date: date,
                                    detail: a.basisLabel, status: a.status,
                                    highlight: a.authority == model.communityAuthority,
                                    link: a.sourceURL.flatMap { URL(string: $0) })
                            }
                        }
                        if !entries.contains(where: { $0.authority == model.communityAuthority && $0.status == .announced }),
                           let mine = model.communityAuthority {
                            Text("\(CalendarSanad.authorityName(mine)) hasn't announced yet. It usually does the evening before; this page updates within a few hours.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    } header: {
                        Text("\(item.event.title(model.naming)) \(String(item.hijriYear)) AH")
                    }
                }

                Section {
                    Link("Send an announcement", destination: URL(string: "https://github.com/aarif86/PrayerTimesAsia/blob/main/data/README.md#calendar")!)
                } footer: {
                    Text("Every date shows who set it and how: moon sighting, calculation, or following another authority. Dates are shared openly under CC-BY 4.0.")
                }
            }
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task { await model.hijriCalendar.refreshIfStale() }
        }
    }

    private func row(title: String, date: DateComponents, detail: String,
                     status: CalendarAnnouncement.Status?, highlight: Bool, link: URL?) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(title).font(.subheadline.weight(highlight ? .bold : .semibold))
                    if highlight { Image(systemName: "person.2.fill").font(.caption).foregroundStyle(.secondary) }
                }
                Text(detail).font(.caption).foregroundStyle(.secondary)
                if let link { Link("Source", destination: link).font(.caption) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(format(date)).font(.subheadline.weight(.semibold)).monospacedDigit()
                Text(status == .announced ? "Announced" : (status == .expected ? "Expected" : "Estimate"))
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(status == .announced ? SourceGrade.official.tint : .secondary)
            }
        }
    }

    private func format(_ c: DateComponents) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        guard let d = cal.date(from: c) else { return "-" }
        var style = Date.FormatStyle(date: .abbreviated, time: .omitted).weekday(.abbreviated)
        style.timeZone = cal.timeZone
        return d.formatted(style)
    }
}
