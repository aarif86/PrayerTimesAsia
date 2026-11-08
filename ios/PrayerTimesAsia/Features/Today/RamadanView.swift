import SwiftUI

private let gold = Color(red: 0.95, green: 0.79, blue: 0.41)
private let pink = Color(red: 0.88, green: 0.42, blue: 0.54)
private let oddNights = [21, 23, 25, 27, 29]

private func dateText(_ d: CivilDay, _ format: String = "EEEE d MMMM") -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_GB")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = format
    return f.string(from: d.noon(in: TimeZone(identifier: "UTC")!))
}

/// "tomorrow, Sunday 8 Feb" or the date.
private func whenWords(from: CivilDay, _ d: CivilDay) -> String {
    switch from.days(to: d) {
    case 0: "today"
    case 1: "tomorrow, \(dateText(d, "EEEE d MMM"))"
    case 2: "the day after tomorrow, \(dateText(d, "EEEE d MMM"))"
    default: dateText(d)
    }
}

// MARK: The card on the Prayer screen

/// Ramadan, Raya and Syawal at the top of the Prayer screen. Nothing outside the season.
struct SeasonCard: View {
    @Environment(AppModel.self) private var model
    let now: Date
    @State private var showPage = false

    var body: some View {
        let season = model.season(at: now)
        Group {
            switch season.phase {
            case .none: EmptyView()
            case .syaaban: simple(icon: "moon.stars.fill", season: season) { syaabanText(season) }
            case .ramadan: ramadanCard(season)
            case .raya, .syawal: simple(icon: season.phase == .raya ? "gift.fill" : "moon.stars.fill", season: season) { syawalText(season) }
            }
        }
        .sheet(isPresented: $showPage) { RamadanView() }
    }

    private var background: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(LinearGradient(colors: [Color(red: 0.23, green: 0.16, blue: 0.48).opacity(0.55), gold.opacity(0.18)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(gold.opacity(0.3)))
    }

    @ViewBuilder private var previewTag: some View {
        if model.isSeasonPreview {
            Text("PREVIEW").font(.caption2.weight(.heavy)).padding(.horizontal, 7).padding(.vertical, 2)
                .background(gold, in: Capsule()).foregroundStyle(.black).offset(x: -12, y: -8)
        }
    }

    private func simple<T: View>(icon: String, season: Season.Info, @ViewBuilder text: () -> T) -> some View {
        Button { showPage = true } label: {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.title2).foregroundStyle(gold)
                VStack(alignment: .leading, spacing: 2) { text() }
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
            }
            .padding(14)
            .background(background)
            .overlay(alignment: .topTrailing) { previewTag }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private func syaabanText(_ s: Season.Info) -> some View {
        let today = model.civil(now)
        let authority = model.communityAuthority.map(CalendarSanad.authorityName)
        if s.sightingTonight != nil {
            Text("Moon sighting tonight").font(.headline)
            Text(authority.map { "\($0) announces the start of Ramadan this evening. This screen updates by itself." } ?? "Ramadan may begin tomorrow, after tonight's moon sighting.")
                .font(.footnote).opacity(0.8)
        } else if let next = s.nextStart, next.announced {
            Text("Ramadan begins \(whenWords(from: today, next.day))").font(.headline)
            Text("Announced by \(authority ?? "your authority"). First Tarawih the night before.").font(.footnote).opacity(0.8)
        } else if let first = model.monthDays(hijriYear: s.hijri.year, month: 9).first {
            let days = today.days(to: first)
            Text(days <= 0 ? "Ramadan begins today" : days == 1 ? "Ramadan begins tomorrow" : "Ramadan in about \(days) days").font(.headline)
            Text(days <= 1 ? "First Tarawih tonight. Set your sahur alarm." : "Get ready with your alerts, a timetable to print and the doa.").font(.footnote).opacity(0.8)
        } else {
            Text("Ramadan is near").font(.headline)
        }
    }

    @ViewBuilder private func syawalText(_ s: Season.Info) -> some View {
        let sum = model.fastSummary(hijriYear: s.hijri.year)
        if s.phase == .raya {
            Text("Selamat Hari Raya Aidilfitri").font(.headline)
            let eid = model.eidPrayer.map { "Raya prayer at \(model.prefs.myMasjid?.name ?? "your masjid") \($0). " } ?? "Takbir until the Raya prayer. "
            Text(eid + (model.prefs.zakatPaid.contains(s.hijri.year) ? "Maaf zahir dan batin." : "Pay zakat fitrah before the prayer if you haven't."))
                .font(.footnote).opacity(0.8)
        } else {
            Text("Syawal \(s.syawalDay ?? 0) · Puasa enam \(min(6, sum.syawal)) of 6").font(.headline)
            Text((sum.owed > 0 ? "\(sum.owed) Ramadan fast\(sum.owed == 1 ? "" : "s") to replace. " : "") + "Tap to mark a Syawal or replaced fast.")
                .font(.footnote).opacity(0.8)
        }
    }

    private func ramadanCard(_ s: Season.Info) -> some View {
        let key = model.civil(now).key
        let mark = model.prefs.fastLog[key]
        let moment = model.fastingMoment(now)
        return VStack(alignment: .leading, spacing: 10) {
            Button { showPage = true } label: {
                HStack(spacing: 14) {
                    VStack(spacing: 0) {
                        Text("RAMADAN").font(.caption2.weight(.heavy)).foregroundStyle(gold)
                        Text("\(s.ramadanDay ?? 0)").font(Theme.display(28, .bold)).monospacedDigit()
                    }
                    .frame(minWidth: 58).padding(.vertical, 4)
                    .background(gold.opacity(0.18), in: RoundedRectangle(cornerRadius: 14))
                    VStack(alignment: .leading, spacing: 1) {
                        if let moment {
                            Text(moment.kind == .imsak ? "IMSAK IN" : "BERBUKA IN").font(.caption2.weight(.heavy))
                            Text(TodayView.short(moment.time.timeIntervalSince(now))).font(Theme.display(30, .bold)).monospacedDigit()
                                .foregroundStyle(gold).contentTransition(.numericText(countsDown: true))
                            Text("\(moment.kind == .imsak ? "Finish sahur by" : "Maghrib at") \(model.formatted(moment.time))").font(.footnote).foregroundStyle(.secondary)
                        } else {
                            Text("TONIGHT").font(.caption2.weight(.heavy))
                            Text(s.sightingTonight != nil ? "Moon sighting for Raya" : "Tarawih after Isyak").font(.headline)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens your Ramadan page")

            if s.sightingTonight != nil {
                let authority = model.communityAuthority.map(CalendarSanad.authorityName) ?? "Your authority"
                if let next = s.nextStart, next.announced {
                    note("moon.stars", "Hari Raya is \(whenWords(from: model.civil(now), next.day)), announced by \(authority).")
                } else {
                    note("moon.stars", "Moon sighting tonight. \(authority) announces whether tomorrow is Raya.")
                }
            } else if s.hijri.day == 30 {
                note("sparkles", "The last fast. Hari Raya is tomorrow.")
            }
            if s.lastTen, let night = s.nightTonight {
                note("sparkles", "Night \(night) tonight" + (s.oddNight ? ", one of the odd nights. Seek Lailatul Qadr." : ", in the last ten nights."))
            }
            if s.nuzulQuran { note("book", "17 Ramadan, Nuzul Quran.") }

            HStack(spacing: 6) {
                chip(mark == .fasted ? "Fasting today" : mark.map(\.label) ?? "Fasting today",
                     icon: mark == .fasted ? "checkmark" : "fork.knife", on: mark == .fasted) {
                    model.setFast(key, mark == .fasted ? nil : .fasted)
                }
                chip("Tarawih", icon: model.prefs.tarawihLog.contains(key) ? "checkmark" : "moon", on: model.prefs.tarawihLog.contains(key)) {
                    if model.prefs.tarawihLog.contains(key) { model.prefs.tarawihLog.remove(key) } else { model.prefs.tarawihLog.insert(key) }
                }
                if model.prefs.khatamPlan, let juz = s.ramadanDay {
                    chip("Juz \(juz)", icon: model.prefs.quranLog.contains(key) ? "checkmark" : "book", on: model.prefs.quranLog.contains(key)) {
                        if model.prefs.quranLog.contains(key) { model.prefs.quranLog.remove(key) } else { model.prefs.quranLog.insert(key) }
                    }
                }
            }
        }
        .padding(14)
        .background(background)
        .overlay(alignment: .topTrailing) { previewTag }
    }

    private func note(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon).font(.footnote).opacity(0.9)
    }
}

/// A rounded toggle button used on the card and the Ramadan page.
struct SeasonChip: View {
    let title: String
    let icon: String
    let on: Bool
    var tint: Color = .green
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon).font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(on ? tint.opacity(0.85) : Color.primary.opacity(0.09), in: Capsule())
                .foregroundStyle(on ? .white : .primary)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

private extension SeasonCard {
    func chip(_ title: String, icon: String, on: Bool, action: @escaping () -> Void) -> some View {
        SeasonChip(title: title, icon: icon, on: on, action: action)
    }
}

// MARK: The Ramadan page

struct RamadanView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var openDoa: Doa.ID?
    @State private var showMissed = false
    @State private var rayaFrom = ""

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            let now = context.date
            let season = model.season(at: now)
            let syawal = season.phase == .raya || season.phase == .syawal
            NavigationStack {
                List {
                    if model.isSeasonPreview {
                        Section { Text("Ramadan preview is on, so dates here are pretend. Turn it off in Settings, Ramadan and Syawal.").font(.footnote) }
                            .listRowBackground(gold.opacity(0.22))
                    }
                    if syawal {
                        rayaToday(now, season)
                        syawalFasts(now, season)
                        doaSection([.takbir, .niatSyawal, .niatQadha])
                        zakatSection(season.hijri.year)
                        rayaShare
                    } else {
                        ramadanToday(now, season)
                        monthSection(now, year: season.hijri.year)
                        lastTenSection(now, year: season.hijri.year)
                        doaSection([.niatPuasa, .berbuka, .berbukaHadith, .qadr])
                        zakatSection(season.hijri.year)
                        travelSection
                        shareSection(now)
                        settingsSection(season)
                    }
                    Section {} footer: {
                        Text("Imsak is 10 minutes before Subuh, as MUIS, JAKIM and Kemenag publish it. The first day of Ramadan and Raya follows \(model.communityAuthority.map(CalendarSanad.authorityName) ?? "your authority") (change it by tapping the date on the Prayer screen). Follow your local religious authority. Your fasting record stays on this phone.")
                    }
                }
                .navigationTitle(syawal ? "Syawal" : "Ramadan")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            }
        }
    }

    // MARK: Ramadan

    @ViewBuilder private func ramadanToday(_ now: Date, _ s: Season.Info) -> some View {
        let inRamadan = s.phase == .ramadan
        let first = inRamadan ? nil : model.monthDays(hijriYear: s.hijri.year, month: 9).first
        if let shown = first.flatMap({ model.day(of: $0) }) ?? model.day(containing: now) {
            Section {
                HStack(spacing: 8) {
                    timeBox("IMSAK", model.imsak(shown), "Stop eating")
                    timeBox("SUBUH", shown.time(.fajr), "Fast begins")
                    timeBox("BERBUKA", shown.time(.maghrib), "Maghrib", highlight: true)
                }
                if inRamadan, let m = model.fastingMoment(now) {
                    Text("\(m.kind == .imsak ? "Imsak" : "Berbuka") in \(TodayView.short(m.time.timeIntervalSince(now)))")
                        .font(.headline).monospacedDigit().foregroundStyle(gold).frame(maxWidth: .infinity)
                }
                if inRamadan { fastToday(now) }
            } header: {
                Text(inRamadan ? "Ramadan day \(s.ramadanDay ?? 0)" : first.map { "1 Ramadan · \(dateText($0))" } ?? "Ramadan")
            }
            if inRamadan {
                Section {
                    HadithView(id: .iftar, tag: model.fastingMoment(now)?.kind == .berbuka ? "Before berbuka" : nil).hadithRow()
                }
            }
        }
    }

    private func timeBox(_ title: String, _ time: Date, _ sub: String, highlight: Bool = false) -> some View {
        VStack(spacing: 2) {
            Text(title).font(.caption2.weight(.heavy)).foregroundStyle(highlight ? gold : .secondary)
            TimeText(parts: model.timeParts(time), size: 24, weight: .bold)
            Text(sub).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background((highlight ? gold.opacity(0.2) : Color.primary.opacity(0.06)), in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder private func fastToday(_ now: Date) -> some View {
        let key = model.civil(now).key
        let mark = model.prefs.fastLog[key]
        HStack(spacing: 6) {
            SeasonChip(title: "I'm fasting today", icon: mark == .fasted ? "checkmark" : "fork.knife", on: mark == .fasted) {
                model.setFast(key, mark == .fasted ? nil : .fasted)
            }
            SeasonChip(title: mark?.isMissed == true ? "Missed · \(mark!.label)" : "Not fasting today", icon: "chevron.down", on: mark?.isMissed == true, tint: pink) {
                showMissed.toggle()
            }
        }
        if showMissed {
            HStack(spacing: 6) {
                ForEach(FastMark.missed, id: \.self) { m in
                    SeasonChip(title: m.label, icon: m == .travel ? "car" : m == .sick ? "cross.case" : m == .period ? "drop" : "ellipsis", on: mark == m, tint: pink) {
                        model.setFast(key, mark == m ? nil : m); showMissed = false
                    }
                }
            }
        }
        if mark == .period { Text("You can also pause the prayer tracker for these days.").font(.footnote).foregroundStyle(.secondary) }
    }

    private static let cycle: [FastMark?] = [nil, .fasted, .period, .sick, .travel, .other]

    @ViewBuilder private func monthSection(_ now: Date, year: Int) -> some View {
        let days = model.monthDays(hijriYear: year, month: 9)
        let today = model.civil(now)
        if let first = days.first, first <= today {
            let sum = model.fastSummary(hijriYear: year)
            Section {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 6), spacing: 6) {
                    ForEach(Array(days.enumerated()), id: \.offset) { i, d in
                        let m = model.prefs.fastLog[d.key]
                        Button {
                            let at = Self.cycle.firstIndex(where: { $0 == m }) ?? 0
                            model.setFast(d.key, Self.cycle[(at + 1) % Self.cycle.count])
                        } label: {
                            ZStack(alignment: .bottomTrailing) {
                                Text("\(i + 1)").font(.callout.weight(.semibold)).monospacedDigit()
                                    .frame(maxWidth: .infinity, minHeight: 40)
                                if let m, m != .fasted { Text(m.letter).font(.caption2.weight(.heavy)).padding(3) }
                            }
                            .background(m == .fasted ? Color.green : m?.isMissed == true ? pink.opacity(0.3) : Color.primary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(m == .fasted ? .white : .primary)
                            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(d == today ? Theme.accent : oddNights.contains(i + 1) ? gold.opacity(0.7) : .clear, lineWidth: 1.5))
                            .opacity(d > today ? 0.4 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(d > today)
                        .accessibilityLabel("\(i + 1) Ramadan: \(m?.label ?? "not marked")")
                    }
                }
                .padding(.vertical, 4)
                Text(LocalizedStringKey("**\(sum.fasted)** fasted" + (sum.missed > 0 ? " · **\(sum.missed)** missed" : "") + (sum.owed > 0 ? " · \(sum.owed) to replace" : "")))
            } header: {
                Text("Your fasts this month")
            } footer: {
                Text("Tap a day to change it. P period, S sick, T travelling, O other reason. Missed days are counted for you to replace after Ramadan.")
            }
        }
    }

    @ViewBuilder private func lastTenSection(_ now: Date, year: Int) -> some View {
        let days = model.monthDays(hijriYear: year, month: 9)
        if days.count >= 20 {
            let today = model.civil(now)
            Section {
                Text("Lailatul Qadr is better than a thousand months. Seek it in the odd nights of the last ten.")
                HStack(spacing: 6) {
                    ForEach(oddNights, id: \.self) { n in
                        if n - 2 < days.count {
                            let eve = days[n - 2]
                            VStack(spacing: 2) {
                                Text("\(n)").font(.title3.weight(.bold)).monospacedDigit()
                                Text(eve == today ? "Tonight" : dateText(eve, "d MMM")).font(.caption2)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(eve == today ? gold.opacity(0.35) : Color.purple.opacity(0.18), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                Toggle(isOn: Binding(get: { model.prefs.qiyamAlert }, set: { model.prefs.qiyamAlert = $0 })) {
                    VStack(alignment: .leading) { Text("Remind me for qiyam"); Text("At the last third of each of the last ten nights").font(.caption).foregroundStyle(.secondary) }
                }
            } header: {
                Text("The last ten nights")
            } footer: {
                Text("Each night begins at Maghrib the evening before. The last third of the night is the best time for qiyam.")
            }
        }
    }

    private func doaSection(_ ids: [Doa.ID]) -> some View {
        let lang = RamadanContent.lang(model.naming)
        return Section("Doa and niat") {
            ForEach(ids, id: \.self) { id in
                let d = RamadanContent.doa(id)
                DisclosureGroup(isExpanded: Binding(get: { openDoa == id }, set: { openDoa = $0 ? id : nil })) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(d.arabic).font(.title2).environment(\.layoutDirection, .rightToLeft)
                            .frame(maxWidth: .infinity, alignment: .trailing).multilineTextAlignment(.trailing)
                        Text(d.rumi).italic()
                        Text(d.meaning(lang))
                        Text(d.note(lang)).font(.footnote).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 6)
                    .textSelection(.enabled)
                } label: {
                    Label(d.title(lang), systemImage: "hands.sparkles")
                }
            }
        }
    }

    @ViewBuilder private func zakatSection(_ year: Int) -> some View {
        let lang = RamadanContent.lang(model.naming)
        let code = model.prefs.home?.countryCode ?? model.profile.code
        let bodies = RamadanContent.zakat[code] ?? []
        Section {
            Text(RamadanContent.zakatNote(lang)).font(.footnote)
            ForEach(bodies, id: \.self) { b in
                Link(destination: b.url) {
                    Label { VStack(alignment: .leading) { Text(b.name); Text("Official site, amount and how to pay").font(.caption).foregroundStyle(.secondary) } } icon: { Image(systemName: "banknote") }
                }
            }
            if bodies.isEmpty { Text("Pay through your masjid or your local zakat body.").font(.footnote) }
            Toggle("I've paid zakat fitrah for \(String(year))", isOn: Binding(
                get: { model.prefs.zakatPaid.contains(year) },
                set: { if $0 { model.prefs.zakatPaid.insert(year) } else { model.prefs.zakatPaid.remove(year) } }))
        } header: {
            Text("Zakat fitrah")
        } footer: {
            Text("Prayer Times Asia takes no money. These links go straight to the official bodies.")
        }
    }

    private var travelSection: some View {
        Section("Travelling in Ramadan") {
            Text("A traveller on a journey of about \(Int(model.musafirRules.thresholdKm)) km or more may choose not to fast, and replace the day after Ramadan. If fasting is easy, fasting is better. Leave your home area before Subuh for the day to count as travel. Ask your local religious authority when unsure.")
                .font(.footnote)
        }
    }

    @ViewBuilder private func shareSection(_ now: Date) -> some View {
        Section("Share and print") {
            if let image = weekImage(now) {
                ShareLink(item: image, preview: SharePreview("Imsak and Berbuka times", image: image)) {
                    Label { VStack(alignment: .leading) { Text("Share this week's times"); Text("A picture of Imsak and Berbuka for \(model.activePlace?.name ?? "your place"), for family chats").font(.caption).foregroundStyle(.secondary) } } icon: { Image(systemName: "square.and.arrow.up") }
                }
            }
            Link(destination: URL(string: "https://prayertimes.asia/app/print/#sheet=ramadan")!) { Label("Print the Ramadan timetable", systemImage: "printer") }
            Link(destination: URL(string: "https://prayertimes.asia/app/print/#sheet=fasting")!) { Label("Print a kids' fasting chart", systemImage: "printer") }
        }
    }

    private func settingsSection(_ s: Season.Info) -> some View {
        @Bindable var model = model
        return Section {
            Toggle(isOn: $model.prefs.imsakAlert) { VStack(alignment: .leading) { Text("Imsak alert"); Text("10 minutes before Imsak, to finish sahur").font(.caption).foregroundStyle(.secondary) } }
            Toggle(isOn: $model.prefs.berbukaAlert) { VStack(alignment: .leading) { Text("Berbuka alert"); Text("At Maghrib, with the doa").font(.caption).foregroundStyle(.secondary) } }
            Toggle(isOn: $model.prefs.khatamPlan) { VStack(alignment: .leading) { Text("A juz a day"); Text("Finish the Quran this month. Tick each juz on this page").font(.caption).foregroundStyle(.secondary) } }
            if model.prefs.khatamPlan {
                Link(destination: RamadanContent.juzLink(s.ramadanDay ?? 1)) { Label("Read today's juz", systemImage: "book") }
            }
        } header: {
            Text("Ramadan alerts and reading")
        } footer: {
            Text("Alerts need notifications allowed for Prayer Times Asia.")
        }
    }

    // MARK: Raya and Syawal

    private func rayaToday(_ now: Date, _ s: Season.Info) -> some View {
        Section {
            Text(s.phase == .raya ? "Selamat Hari Raya Aidilfitri" : "Syawal").font(.title2.weight(.bold))
            if s.phase == .raya {
                if let eid = model.eidPrayer {
                    Text("Raya prayer at \(model.prefs.myMasjid?.name ?? "your masjid"), **\(eid)**")
                } else if let day = model.day(containing: now) {
                    Text("Your masjid sets the Raya prayer time, usually between 7.30 and 8.30 in the morning, after Syuruk at \(model.formatted(day.time(.sunrise))).")
                }
                Text("Eat something before going out, take a different road home, and keep the takbir until the prayer begins.").font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text(s.phase == .raya ? "1 Syawal" : "Syawal \(s.syawalDay ?? 0)")
        }
    }

    private static let syawalCycle: [FastMark?] = [nil, .syawal, .qadha]

    @ViewBuilder private func syawalFasts(_ now: Date, _ s: Season.Info) -> some View {
        let days = model.monthDays(hijriYear: s.hijri.year, month: 10)
        let today = model.civil(now)
        let sum = model.fastSummary(hijriYear: s.hijri.year)
        Section {
            HStack(spacing: 18) {
                Text("**\(min(6, sum.syawal))** of 6 Syawal fasts")
                Text("**\(sum.owed)** to replace")
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 6), spacing: 6) {
                ForEach(Array(days.enumerated()), id: \.offset) { i, d in
                    let m = model.prefs.fastLog[d.key]
                    Button {
                        let at = Self.syawalCycle.firstIndex(where: { $0 == m }) ?? 0
                        model.setFast(d.key, Self.syawalCycle[(at + 1) % Self.syawalCycle.count])
                    } label: {
                        ZStack(alignment: .bottomTrailing) {
                            Text("\(i + 1)").font(.callout.weight(.semibold)).monospacedDigit().frame(maxWidth: .infinity, minHeight: 40)
                            if m == .qadha { Text("G").font(.caption2.weight(.heavy)).padding(3) }
                        }
                        .background(m == .syawal ? Color.green : m == .qadha ? Theme.accent.opacity(0.45) : Color.primary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(m == .syawal ? .white : .primary)
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(d == today ? Theme.accent : .clear, lineWidth: 1.5))
                        .opacity(i == 0 || d > today ? 0.4 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(i == 0 || d > today)
                    .accessibilityLabel("\(i + 1) Syawal: \(i == 0 ? "Hari Raya, no fasting" : m?.label ?? "not marked")")
                }
            }
            .padding(.vertical, 4)
            if sum.owed > 0 && s.phase != .raya {
                let key = today.key
                Button { model.setFast(key, model.prefs.fastLog[key] == .qadha ? nil : .qadha) } label: {
                    Label(model.prefs.fastLog[key] == .qadha ? "Replaced a fast today" : "I replaced a fast today", systemImage: "checkmark")
                }
            }
        } header: {
            Text("Puasa enam and ganti")
        } footer: {
            Text("Tap a day once for a Syawal fast, twice for a replaced (ganti) fast. No fasting on 1 Syawal. Missed Ramadan fasts can be replaced any day before next Ramadan, except the days of Raya and Tasyrik.")
        }
    }

    private var rayaShare: some View {
        Section("Send a Raya card") {
            TextField("From (your name or family)", text: $rayaFrom)
            let image = Image(uiImage: renderCard(RayaCardView(from: rayaFrom)))
            ShareLink(item: image, preview: SharePreview("Selamat Hari Raya", image: image)) {
                Label("Share the card", systemImage: "square.and.arrow.up")
            }
        }
    }

    // MARK: Pictures

    private func weekImage(_ now: Date) -> Image? {
        let today = model.civil(now)
        var rows: [WeekCardView.Row] = []
        // Before Ramadan, the first week.
        let start = model.monthDays(hijriYear: model.season(at: now).hijri.year, month: 9).first.map { max($0, today) } ?? today
        for i in 0..<7 {
            let g = start.adding(i)
            let h = model.hijri(of: g)
            guard h.month == 9, let day = model.day(of: g) else { continue }
            rows.append(.init(label: dateText(g, "EEE d MMM"), hijri: h.day, imsak: model.formatted(model.imsak(day)), berbuka: model.formatted(day.time(.maghrib))))
        }
        guard !rows.isEmpty else { return nil }
        return Image(uiImage: renderCard(WeekCardView(place: model.activePlace?.name ?? "", rows: rows)))
    }

    @MainActor private func renderCard<V: View>(_ view: V) -> UIImage {
        let r = ImageRenderer(content: view.frame(width: 540))
        r.scale = 2
        return r.uiImage ?? UIImage()
    }
}

/// This week's Imsak and Berbuka, for family chats.
private struct WeekCardView: View {
    struct Row: Hashable { let label: String; let hijri: Int; let imsak: String; let berbuka: String }
    let place: String
    let rows: [Row]
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Ramadan Kareem").font(.system(size: 22, weight: .bold)).foregroundStyle(gold)
                    Text(place).font(.system(size: 34, weight: .bold))
                    Text("Imsak and Berbuka this week").font(.system(size: 17)).opacity(0.75)
                }
                Spacer()
                Image(systemName: "moon.stars.fill").font(.system(size: 48)).foregroundStyle(gold)
            }
            ForEach(rows, id: \.self) { r in
                HStack {
                    VStack(alignment: .leading) {
                        Text(r.label).font(.system(size: 19, weight: .semibold))
                        Text("\(r.hijri) Ramadan").font(.system(size: 13)).opacity(0.6)
                    }
                    Spacer()
                    Text(r.imsak).font(.system(size: 21, weight: .semibold)).monospacedDigit().frame(width: 110, alignment: .trailing)
                    Text(r.berbuka).font(.system(size: 21, weight: .semibold)).monospacedDigit().foregroundStyle(gold).frame(width: 110, alignment: .trailing)
                }
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            }
            HStack { Spacer(); Text("IMSAK").frame(width: 110, alignment: .trailing); Text("BERBUKA").frame(width: 110, alignment: .trailing) }
                .font(.system(size: 12, weight: .bold)).opacity(0.6).padding(.horizontal, 14)
            Text("Follow your local religious authority for the start of Ramadan and Raya.").font(.system(size: 13)).opacity(0.6)
            Text("Prayer Times Asia · prayertimes.asia").font(.system(size: 14, weight: .medium)).opacity(0.75).frame(maxWidth: .infinity)
        }
        .padding(28)
        .foregroundStyle(.white)
        .background(LinearGradient(colors: [Color(red: 0.06, green: 0.1, blue: 0.29), Color(red: 0.23, green: 0.12, blue: 0.36)], startPoint: .top, endPoint: .bottom))
    }
}

/// A simple Hari Raya card with the sender's own words.
private struct RayaCardView: View {
    let from: String
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "moon.stars.fill").font(.system(size: 80)).foregroundStyle(gold).padding(.top, 40)
            Text("Selamat Hari Raya\nAidilfitri").font(.system(size: 40, weight: .bold)).multilineTextAlignment(.center).foregroundStyle(gold)
            Text("Maaf zahir dan batin").font(.system(size: 22, weight: .medium))
            Text("Taqabbalallahu minna wa minkum").font(.system(size: 17)).opacity(0.8)
            if !from.trimmingCharacters(in: .whitespaces).isEmpty {
                Text("From \(String(from.prefix(40)))").font(.system(size: 22, weight: .semibold)).padding(.top, 20)
            }
            Spacer(minLength: 30)
            Text("Prayer Times Asia · prayertimes.asia").font(.system(size: 14, weight: .medium)).opacity(0.7).padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, minHeight: 680)
        .foregroundStyle(.white)
        .background(LinearGradient(colors: [Color(red: 0.06, green: 0.24, blue: 0.18), Color(red: 0.12, green: 0.42, blue: 0.31)], startPoint: .top, endPoint: .bottom))
    }
}
