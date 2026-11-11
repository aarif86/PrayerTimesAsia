import SwiftUI

private let gold = Color(red: 0.95, green: 0.79, blue: 0.41)
private let pink = Color(red: 0.88, green: 0.42, blue: 0.54)
private let oddNights = [21, 23, 25, 27, 29]

private func dateText(_ d: CivilDay, _ format: String = "EEEE d MMMM", _ lang: RamadanContent.Lang = .en) -> String {
    let f = DateFormatter()
    f.locale = RamadanWords.locale(lang)
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = format
    return f.string(from: d.noon(in: TimeZone(identifier: "UTC")!))
}

/// "tomorrow, Sunday 8 Feb" or the date.
private func whenWords(from: CivilDay, _ d: CivilDay, _ lang: RamadanContent.Lang) -> String {
    let t = RamadanWords.In(lang)
    switch from.days(to: d) {
    case 0: return t(.today)
    case 1: return t(.tomorrow, ["d": dateText(d, "EEEE d MMM", lang)])
    case 2: return t(.dayAfterTomorrow, ["d": dateText(d, "EEEE d MMM", lang)])
    default: return dateText(d, "EEEE d MMMM", lang)
    }
}

// MARK: The card on the Prayer screen

/// Ramadan, Raya and Syawal at the top of the Prayer screen. Nothing outside the season.
struct SeasonCard: View {
    @Environment(AppModel.self) private var model
    let now: Date
    @State private var showPage = false

    private var lang: RamadanContent.Lang { RamadanContent.lang(model.naming) }
    private var t: RamadanWords.In { RamadanWords.In(lang) }

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
            Text(t(.preview)).font(.caption2.weight(.heavy)).padding(.horizontal, 7).padding(.vertical, 2)
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
            Text(t(.sightingTonightTitle)).font(.headline)
            Text(authority.map { t(.sightingAnnounces, ["a": $0]) } ?? t(.sightingMaybe))
                .font(.footnote).opacity(0.8)
        } else if let next = s.nextStart, next.announced {
            Text(t(.ramadanBegins, ["w": whenWords(from: today, next.day, lang)])).font(.headline)
            Text(t(.announcedBy, ["a": authority ?? t(.yourAuthorityLower)])).font(.footnote).opacity(0.8)
        } else if let first = model.monthDays(hijriYear: s.hijri.year, month: 9).first {
            let days = today.days(to: first)
            Text(days <= 0 ? t(.beginsToday) : days == 1 ? t(.beginsTomorrow) : t(.beginsInDays, ["n": days])).font(.headline)
            Text(days <= 1 ? t(.firstTarawihTonight) : t(.getReady)).font(.footnote).opacity(0.8)
        } else {
            Text(t(.ramadanNear)).font(.headline)
        }
    }

    @ViewBuilder private func syawalText(_ s: Season.Info) -> some View {
        let sum = model.fastSummary(hijriYear: s.hijri.year)
        if s.phase == .raya {
            Text(t(.selamatHariRaya)).font(.headline)
            let eid = model.eidPrayer.map { t(.rayaPrayerAt, ["p": model.prefs.myMasjid?.name ?? t(.yourMasjid), "t": $0]) } ?? t(.takbirUntilPrayer)
            Text(eid + " " + (model.prefs.zakatPaid.contains(s.hijri.year) ? t(.maafZahirBatin) : t(.payZakatBefore)))
                .font(.footnote).opacity(0.8)
        } else {
            Text(t(.syawalCardTitle, ["d": s.syawalDay ?? 0, "n": min(6, sum.syawal)])).font(.headline)
            Text((sum.owed > 0 ? t(.fastsToReplace, ["n": sum.owed]) + " " : "") + t(.tapToMarkSyawal))
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
                        Text(t(.ramadan).uppercased()).font(.caption2.weight(.heavy)).foregroundStyle(gold)
                        Text("\(s.ramadanDay ?? 0)").font(Theme.display(28, .bold)).monospacedDigit()
                    }
                    .frame(minWidth: 58).padding(.vertical, 4)
                    .background(gold.opacity(0.18), in: RoundedRectangle(cornerRadius: 14))
                    VStack(alignment: .leading, spacing: 1) {
                        if let moment {
                            Text((moment.kind == .imsak ? t(.imsakIn) : t(.berbukaIn)).uppercased()).font(.caption2.weight(.heavy))
                            Text(TodayView.short(moment.time.timeIntervalSince(now))).font(Theme.display(30, .bold)).monospacedDigit()
                                .foregroundStyle(gold).contentTransition(.numericText(countsDown: true))
                            Text("\(moment.kind == .imsak ? t(.finishSahurBy) : t(.maghribAt)) \(model.formatted(moment.time))").font(.footnote).foregroundStyle(.secondary)
                        } else {
                            Text(t(.tonight).uppercased()).font(.caption2.weight(.heavy))
                            Text(s.sightingTonight != nil ? t(.sightingForRaya) : t(.tarawihAfterIsyak)).font(.headline)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint(t(.opensRamadanPage))

            if s.sightingTonight != nil {
                let authority = model.communityAuthority.map(CalendarSanad.authorityName) ?? t(.yourAuthority)
                if let next = s.nextStart, next.announced {
                    note("moon.stars", t(.rayaAnnounced, ["w": whenWords(from: model.civil(now), next.day, lang), "a": authority]))
                } else {
                    note("moon.stars", t(.rayaSighting, ["a": authority]))
                }
            } else if s.hijri.day == 30 {
                note("sparkles", t(.lastFast))
            }
            if s.lastTen, let night = s.nightTonight {
                note("sparkles", s.oddNight ? t(.oddNight, ["n": night]) : t(.lastTenNight, ["n": night]))
            }
            if s.nuzulQuran { note("book", t(.nuzulQuran)) }

            HStack(spacing: 6) {
                chip(mark == .fasted ? t(.fastingToday) : mark.map(t.mark) ?? t(.fastingToday),
                     icon: mark == .fasted ? "checkmark" : "fork.knife", on: mark == .fasted) {
                    model.setFast(key, mark == .fasted ? nil : .fasted)
                }
                chip(t(.tarawih), icon: model.prefs.tarawihLog.contains(key) ? "checkmark" : "moon", on: model.prefs.tarawihLog.contains(key)) {
                    if model.prefs.tarawihLog.contains(key) { model.prefs.tarawihLog.remove(key) } else { model.prefs.tarawihLog.insert(key) }
                }
                if model.prefs.khatamPlan, let juz = s.ramadanDay {
                    chip(t(.juz, ["n": juz]), icon: model.prefs.quranLog.contains(key) ? "checkmark" : "book", on: model.prefs.quranLog.contains(key)) {
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

    private var lang: RamadanContent.Lang { RamadanContent.lang(model.naming) }
    private var t: RamadanWords.In { RamadanWords.In(lang) }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            let now = context.date
            let season = model.season(at: now)
            let syawal = season.phase == .raya || season.phase == .syawal
            NavigationStack {
                List {
                    if model.isSeasonPreview {
                        Section { Text(t(.previewBanner)).font(.footnote) }
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
                        Text(t(.footer, ["a": model.communityAuthority.map(CalendarSanad.authorityName) ?? t(.yourAuthorityLower)]))
                    }
                }
                .navigationTitle(syawal ? t(.syawal) : t(.ramadan))
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
                    timeBox(t(.imsak).uppercased(), model.imsak(shown), t(.stopEating))
                    timeBox(t(.subuh).uppercased(), shown.time(.fajr), t(.fastBegins))
                    timeBox(t(.berbuka).uppercased(), shown.time(.maghrib), t(.maghrib), highlight: true)
                }
                if inRamadan, let m = model.fastingMoment(now) {
                    Text(t(.countIn, ["w": m.kind == .imsak ? t(.imsak) : t(.berbuka), "l": TodayView.short(m.time.timeIntervalSince(now))]))
                        .font(.headline).monospacedDigit().foregroundStyle(gold).frame(maxWidth: .infinity)
                }
                if inRamadan { fastToday(now) }
            } header: {
                Text(inRamadan ? t(.ramadanDay, ["n": s.ramadanDay ?? 0]) : first.map { t(.firstOfRamadan, ["d": dateText($0, "EEEE d MMMM", lang)]) } ?? t(.ramadan))
            }
            if inRamadan {
                Section {
                    HadithView(id: .iftar, tag: model.fastingMoment(now)?.kind == .berbuka ? t(.beforeBerbuka) : nil).hadithRow()
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
            SeasonChip(title: t(.imFastingToday), icon: mark == .fasted ? "checkmark" : "fork.knife", on: mark == .fasted) {
                model.setFast(key, mark == .fasted ? nil : .fasted)
            }
            SeasonChip(title: mark?.isMissed == true ? t(.missedBecause, ["r": t.mark(mark!)]) : t(.notFastingToday), icon: "chevron.down", on: mark?.isMissed == true, tint: pink) {
                showMissed.toggle()
            }
        }
        if showMissed {
            HStack(spacing: 6) {
                ForEach(FastMark.missed, id: \.self) { m in
                    SeasonChip(title: t.mark(m), icon: m == .travel ? "car" : m == .sick ? "cross.case" : m == .period ? "drop" : "ellipsis", on: mark == m, tint: pink) {
                        model.setFast(key, mark == m ? nil : m); showMissed = false
                    }
                }
            }
        }
        if mark == .period { Text(t(.pauseTrackerToo)).font(.footnote).foregroundStyle(.secondary) }
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
                                if let m, m != .fasted { Text(t.letter(m)).font(.caption2.weight(.heavy)).padding(3).accessibilityHidden(true) }
                            }
                            .background(m == .fasted ? Color.green : m?.isMissed == true ? pink.opacity(0.3) : Color.primary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(m == .fasted ? .white : .primary)
                            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(d == today ? Theme.accent : oddNights.contains(i + 1) ? gold.opacity(0.7) : .clear, lineWidth: 1.5))
                            .opacity(d > today ? 0.4 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(d > today)
                        .accessibilityLabel(t(.ramadanDayAria, ["n": i + 1, "d": dateText(d, "d MMM", lang), "s": m.map(t.mark) ?? t(.notMarked)]))
                    }
                }
                .padding(.vertical, 4)
                Text(LocalizedStringKey("**\(sum.fasted)** \(t(.fastedCount))" + (sum.missed > 0 ? " · **\(sum.missed)** \(t(.missedCount))" : "") + (sum.owed > 0 ? " · \(t(.toReplace, ["n": sum.owed]))" : "")))
            } header: {
                Text(t(.yourFastsThisMonth))
            } footer: {
                Text(t(.monthHelp))
            }
        }
    }

    @ViewBuilder private func lastTenSection(_ now: Date, year: Int) -> some View {
        let days = model.monthDays(hijriYear: year, month: 9)
        if days.count >= 20 {
            let today = model.civil(now)
            Section {
                Text(t(.lailatulQadr))
                HStack(spacing: 6) {
                    ForEach(oddNights, id: \.self) { n in
                        if n - 2 < days.count {
                            let eve = days[n - 2]
                            VStack(spacing: 2) {
                                Text("\(n)").font(.title3.weight(.bold)).monospacedDigit()
                                Text(eve == today ? t(.tonight) : dateText(eve, "d MMM", lang)).font(.caption2)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(eve == today ? gold.opacity(0.35) : Color.purple.opacity(0.18), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                Toggle(isOn: Binding(get: { model.prefs.qiyamAlert }, set: { model.prefs.qiyamAlert = $0 })) {
                    VStack(alignment: .leading) { Text(t(.qiyamReminder)); Text(t(.qiyamReminderSub)).font(.caption).foregroundStyle(.secondary) }
                }
            } header: {
                Text(t(.lastTenTitle))
            } footer: {
                Text(t(.eachNightBegins))
            }
        }
    }

    private func doaSection(_ ids: [Doa.ID]) -> some View {
        let lang = RamadanContent.lang(model.naming)
        return Section(t(.doaAndNiat)) {
            ForEach(ids, id: \.self) { id in
                let d = RamadanContent.doa(id)
                DisclosureGroup(isExpanded: Binding(get: { openDoa == id }, set: { openDoa = $0 ? id : nil })) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(d.arabic).font(.title2).fixedSize(horizontal: false, vertical: true)
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
                    Label { VStack(alignment: .leading) { Text(b.name); Text(t(.zakatOfficial)).font(.caption).foregroundStyle(.secondary) } } icon: { Image(systemName: "banknote") }
                }
            }
            if bodies.isEmpty { Text(t(.zakatThroughMasjid)).font(.footnote) }
            Toggle(t(.zakatPaid, ["y": String(year)]), isOn: Binding(
                get: { model.prefs.zakatPaid.contains(year) },
                set: { if $0 { model.prefs.zakatPaid.insert(year) } else { model.prefs.zakatPaid.remove(year) } }))
        } header: {
            Text(t(.zakatFitrah))
        } footer: {
            Text(t(.zakatNoMoney))
        }
    }

    private var travelSection: some View {
        Section(t(.travelTitle)) {
            Text(t(.travelNote, ["km": Int(model.musafirRules.thresholdKm)]))
                .font(.footnote)
        }
    }

    @ViewBuilder private func shareSection(_ now: Date) -> some View {
        Section(t(.shareAndPrint)) {
            if let image = weekImage(now) {
                ShareLink(item: image, preview: SharePreview(t(.shareWeekText, ["p": model.activePlace?.name ?? ""]), image: image)) {
                    Label { VStack(alignment: .leading) { Text(t(.shareWeek)); Text(t(.shareWeekSub, ["p": model.activePlace?.name ?? t(.yourPlace)])).font(.caption).foregroundStyle(.secondary) } } icon: { Image(systemName: "square.and.arrow.up") }
                }
            }
            Link(destination: URL(string: "https://prayertimes.asia/app/print/#sheet=ramadan")!) { Label(t(.printTimetable), systemImage: "printer") }
            Link(destination: URL(string: "https://prayertimes.asia/app/print/#sheet=fasting")!) { Label(t(.printKidsChart), systemImage: "printer") }
        }
    }

    private func settingsSection(_ s: Season.Info) -> some View {
        @Bindable var model = model
        return Section {
            Toggle(isOn: $model.prefs.imsakAlert) { VStack(alignment: .leading) { Text(t(.imsakAlert)); Text(t(.imsakAlertSub)).font(.caption).foregroundStyle(.secondary) } }
            Toggle(isOn: $model.prefs.berbukaAlert) { VStack(alignment: .leading) { Text(t(.berbukaAlert)); Text(t(.berbukaAlertSub)).font(.caption).foregroundStyle(.secondary) } }
            Toggle(isOn: $model.prefs.khatamPlan) { VStack(alignment: .leading) { Text(t(.juzADay)); Text(t(.juzADaySub)).font(.caption).foregroundStyle(.secondary) } }
            if model.prefs.khatamPlan {
                Link(destination: RamadanContent.juzLink(s.ramadanDay ?? 1)) { Label(t(.readTodaysJuz), systemImage: "book") }
            }
        } header: {
            Text(t(.alertsTitle))
        } footer: {
            Text(t(.alertsNeedNotifications))
        }
    }

    // MARK: Raya and Syawal

    private func rayaToday(_ now: Date, _ s: Season.Info) -> some View {
        Section {
            Text(s.phase == .raya ? t(.selamatHariRaya) : t(.syawal)).font(.title2.weight(.bold))
            if s.phase == .raya {
                if let eid = model.eidPrayer {
                    Text(LocalizedStringKey(t(.rayaPrayerAtPlace, ["p": model.prefs.myMasjid?.name ?? t(.yourMasjid)]) + " **\(eid)**"))
                } else if let day = model.day(containing: now) {
                    Text(t(.masjidSetsRayaTimeAfterSyuruk, ["s": model.formatted(day.time(.sunrise))]))
                }
                Text(t(.rayaSunnah)).font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text(s.phase == .raya ? t(.firstSyawal) : t(.syawalDay, ["n": s.syawalDay ?? 0]))
        }
    }

    private static let syawalCycle: [FastMark?] = [nil, .syawal, .qadha]

    @ViewBuilder private func syawalFasts(_ now: Date, _ s: Season.Info) -> some View {
        let days = model.monthDays(hijriYear: s.hijri.year, month: 10)
        let today = model.civil(now)
        let sum = model.fastSummary(hijriYear: s.hijri.year)
        Section {
            HStack(spacing: 18) {
                Text(LocalizedStringKey("**\(min(6, sum.syawal))** \(t(.ofSixSyawal))"))
                Text(LocalizedStringKey("**\(sum.owed)** \(t(.ramadanFastsToReplace, ["n": sum.owed]))"))
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
                            if m == .qadha { Text(t.letter(.qadha)).font(.caption2.weight(.heavy)).padding(3).accessibilityHidden(true) }
                        }
                        .background(m == .syawal ? Color.green : m == .qadha ? Theme.accent.opacity(0.45) : Color.primary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(m == .syawal ? .white : .primary)
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(d == today ? Theme.accent : .clear, lineWidth: 1.5))
                        .opacity(i == 0 || d > today ? 0.4 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(i == 0 || d > today)
                    .accessibilityLabel(t(.syawalDayAria, ["n": i + 1, "s": i == 0 ? t(.rayaNoFasting) : m.map(t.mark) ?? t(.notMarked)]))
                }
            }
            .padding(.vertical, 4)
            if sum.owed > 0 && s.phase != .raya {
                let key = today.key
                Button { model.setFast(key, model.prefs.fastLog[key] == .qadha ? nil : .qadha) } label: {
                    Label(model.prefs.fastLog[key] == .qadha ? t(.replacedToday) : t(.iReplacedToday), systemImage: "checkmark")
                }
            }
        } header: {
            Text(t(.syawalFastsTitle))
        } footer: {
            Text(t(.syawalHelp, ["d": dateText(today.adding(1), "EEEE d MMM", lang)]) + " " + t(.replaceRule))
        }
    }

    private var rayaShare: some View {
        Section(t(.sendRayaCard)) {
            TextField(t(.yourNameOrFamily), text: $rayaFrom)
            let image = Image(uiImage: renderCard(RayaCardView(from: rayaFrom)))
            ShareLink(item: image, preview: SharePreview("Selamat Hari Raya", image: image)) {
                Label(t(.shareTheCard), systemImage: "square.and.arrow.up")
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
