import SwiftUI

/// Ramadan, Eid and the new year with a source for every date (brief v03 §7.1).
struct CalendarSanadView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    /// Shows a day picked in the month calendar on the Prayer screen (days from today).
    var onShowDay: ((Int) -> Void)?

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            List {
                Section {
                    HijriMonthCard(onShowDay: onShowDay.map { show in { days in show(days); dismiss() } })
                }

                Section {
                    Picker(W("calendar.follows"), selection: $model.prefs.communityAuthority) {
                        Text(W("common.automaticWith", ["name": model.communityAuthority.map(CalendarSanad.authorityName) ?? "none"])).tag(String?.none)
                        ForEach(CalendarSanad.authorities) { a in
                            Text(a.name).tag(String?.some(a.id))
                        }
                    }
                } footer: {
                    Text(W("calendar.explain"))
                }

                ForEach(CalendarSanad.upcoming(after: .now, timeZone: model.timeZone)) { item in
                    Section {
                        if let expected = CalendarSanad.expected(item.event, hijriYear: item.hijriYear) {
                            row(title: W("calendar.expected"), date: expected, detail: W("calendar.estimateExplain"),
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
                            Text(W("calendar.notYet", ["name": CalendarSanad.authorityName(mine)]))
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    } header: {
                        Text(W("phone.calendar.yearAh", ["name": item.event.title(lang: model.appLang), "year": String(item.hijriYear)]).uppercased())
                    }
                }

                Section {
                    Link(W("phone.calendar.send"), destination: URL(string: "https://prayertimes.asia/announcement.html")!)
                } footer: {
                    Text(W("phone.calendar.everyDate"))
                }
            }
            .navigationTitle(W("calendar.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
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
                if let link { Link(W("source.title"), destination: link).font(.caption) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(format(date)).font(.subheadline.weight(.semibold)).monospacedDigit()
                Text(status == .announced ? W("calendar.announced") : (status == .expected ? W("calendar.expected") : W("calendar.estimate")))
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
