import SwiftUI
import UserNotifications

/// Settings, laid out the way Apple lays out its own: a short main page of rows
/// that each show the current choice, and every detail one tap deeper.
/// Same groups on Android and the web app.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var showReview = false
    @State private var showNote = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.look) private var look
    /// A main tab (no Done button) rather than a sheet.
    var isTab = false
    /// Every half hour of the day, in minutes past midnight.
    static let halfHours = Array(stride(from: 0, to: 1440, by: 30))

    /// "2 notify, 1 alarm", or "Nothing is on".
    private var alertsCount: String {
        let modes = Prayer.allCases.map { model.prefs.alertMode($0) }
        let notify = modes.filter { $0 == .notify }.count
        let alarm = modes.filter { $0 == .alarm }.count
        if notify + alarm == 0 { return model.prefs.anyAlarm ? W("common.on") : W("settings.nothingOn") }
        var parts: [String] = []
        if notify > 0 { parts.append(W("settings.nNotify", ["n": notify])) }
        if alarm > 0 { parts.append(alarm == 1 ? W("phone.settings.oneAlarm") : W("settings.nAlarms", ["n": alarm])) }
        return parts.joined(separator: ", ")
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
            Form {
                // The app's own card: the icon on the navy compass-ring colour. Opens About and credits.
                Section {
                    LookAppCard()
                        .overlay { NavigationLink { AboutPage() } label: { EmptyView() }.opacity(0) }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section {
                    NavigationLink { LocationPage() } label: {
                        SettingsRow(W("settings.location"), icon: "location.fill", slot: 0, color: .blue, value: model.activePlace?.name ?? W("settings.notSet"))
                    }
                    NavigationLink { PrayerTimesPage() } label: {
                        SettingsRow(W("today.title"), icon: "clock.fill", slot: 1, color: .teal, value: model.method.shortName)
                    }
                    Button { model.openAlerts() } label: {
                        HStack {
                            SettingsRow(W("settings.alertsAlarms"), icon: "alarm.fill", slot: 2, color: .red, value: alertsCount)
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                    }
                    .foregroundStyle(.primary)
                    NavigationLink { OwnAzanView() } label: {
                        SettingsRow(W("phone.azan.own"), icon: "music.note", color: .teal, value: OwnAzan.isSet ? W("common.on") : W("common.off"))
                    }
                }
                .lookRows(look)

                Section {
                    NavigationLink { LookPage() } label: {
                        SettingsRow(W("settings.lookFeel"), icon: "paintpalette.fill", slot: 3, color: .purple, value: model.prefs.todayStyle.label)
                    }
                    NavigationLink { LanguagePage() } label: {
                        SettingsRow(W("settings.language"), icon: "globe", slot: 4, color: .blue, value: AppLanguageChoice.label(model.appLang))
                    }
                    NavigationLink { LockScreenPage() } label: {
                        SettingsRow(W("phone.settings.homeLock"), icon: "iphone", slot: 5, color: .indigo,
                                    value: model.prefs.liveActivityEnabled ? W("phone.settings.countdown") : W("phone.settings.countdownOff"))
                    }
                }
                .lookRows(look)

                Section {
                    NavigationLink { RamadanSettingsPage() } label: {
                        SettingsRow(W("alerts.dayRamadan"), icon: "moon.stars.fill", slot: 0, color: Brand.duskIndigo,
                                    value: model.prefs.seasonPreview == .off ? W("settings.ramadanStarts") : W("settings.pretendOn"))
                    }
                    NavigationLink { TrackerPage() } label: {
                        SettingsRow(W("settings.trackerOn"), icon: "checkmark.circle.fill", slot: 1, color: .green, value: model.prefs.trackerEnabled ? W("common.on") : W("common.off"))
                    }
                    NavigationLink { HadithPage() } label: {
                        SettingsRow(W("hadith.title"), icon: "book.fill", slot: 2, color: .brown,
                                    value: model.prefs.showHadith || model.prefs.hadithInAlerts ? W("common.on") : W("common.off"))
                    }
                }
                .lookRows(look)

                Section {
                    NavigationLink { MovePhonePage() } label: {
                        SettingsRow(W("settings.movePhone"), icon: "arrow.left.arrow.right", slot: 3, color: .cyan)
                    }
                    NavigationLink { PrivacyPage() } label: {
                        SettingsRow(W("settings.privacy"), icon: "hand.raised.fill", slot: 4, color: .blue)
                    }
                    NavigationLink { HelpPage() } label: {
                        SettingsRow(W("settings.help"), icon: "questionmark.circle.fill", slot: 5, color: .orange)
                    }
                }
                .lookRows(look)

                Section {
                    ShareLink(item: SettingsLinks.appPage,
                              message: Text(W("settings.shareText"))) {
                        SettingsRow(W("settings.share"), icon: "square.and.arrow.up", slot: 0, color: .green)
                    }
                    .foregroundStyle(.primary)
                    Button { showReview = true } label: {
                        SettingsRow(W("settings.rateApp"), icon: "star.fill", slot: 1, color: .yellow)
                    }
                    .foregroundStyle(.primary)
                    Button { showNote = true } label: {
                        SettingsRow(W("settings.sendUsNote"), icon: "envelope.fill", slot: 2, color: .blue)
                    }
                    .foregroundStyle(.primary)
                    NavigationLink { PicksPage() } label: {
                        SettingsRow(picksName, icon: "gift.fill", slot: 3, color: .pink, value: model.prefs.showOffers ? W("common.on") : W("common.off"))
                    }
                    NavigationLink { AboutPage() } label: {
                        SettingsRow(W("settings.aboutCredits"), icon: "info.circle.fill", slot: 4, color: .gray)
                    }
                    .id("makers")
                } footer: {
                    Text(W("settings.versionN", ["v": Bundle.main.appVersion]))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 8)
                }
                .lookRows(look)
            }
            .onAppear {
                // `-settings-end` (CI screenshots): open at the bottom group.
                if ProcessInfo.processInfo.arguments.contains("-settings-end") {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { proxy.scrollTo("makers", anchor: .top) }
                }
            }
            }
            .settingsPage(W("tab.settings"), inline: false)
            .sheet(isPresented: $showReview) { ReviewView() }
            .sheet(isPresented: $showNote) { NoteView() }
            .toolbar {
                if !isTab { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
            }
        }
    }
}

// MARK: - Building blocks

/// One main-page row: a tonal icon tile (the icon in the look's accent on a soft wash of it,
/// or a band colour in Colour Bands), the name, and the current choice on the right.
struct SettingsRow: View {
    @Environment(\.look) private var look
    let title: String
    let icon: String
    let slot: Int
    let color: Color
    var value: String = ""

    /// Colour Bands' six band colours, as on the web (icon tiles cycle through them).
    private static let bandTiles: [Color] = [
        Color(hex: 0x3A6F63), Color(hex: 0x8A9A52), Color(hex: 0xAB8D3A),
        Color(hex: 0xCD7D38), Color(hex: 0xD3705C), Color(hex: 0xC9565D)
    ]

    init(_ title: String, icon: String, slot: Int = 0, color: Color, value: String = "") {
        self.title = title; self.icon = icon; self.slot = slot; self.color = color; self.value = value
    }

    private var tileSize: CGFloat { look == .simple ? 36 : 32 }

    private var tile: some View {
        let p = look.palette
        let bands = look == .bands
        let fg: Color = bands ? .white : p.actx
        let bg: Color = bands ? Self.bandTiles[slot % 6] : p.tint
        return Image(systemName: icon)
            .font(.system(size: look == .simple ? 18 : 16, weight: .semibold))
            .foregroundStyle(fg)
            .frame(width: tileSize, height: tileSize)
            .background(bg, in: RoundedRectangle(cornerRadius: bands ? 0 : 8, style: .continuous))
            .accessibilityHidden(true)
    }

    var body: some View {
        let p = look.palette
        HStack(spacing: 14) {
            tile
            Text(title)
                .font(look == .simple ? .title3 : .body)
                .foregroundStyle(p.tx)
            Spacer(minLength: 8)
            if !value.isEmpty {
                Text(value)
                    .font(look == .simple ? .body : .subheadline)
                    .foregroundStyle(p.tx2).lineLimit(1)
            }
        }
        .frame(minHeight: look == .simple ? 48 : 0)
        .accessibilityElement(children: .combine)
    }
}

extension View {
    /// Settings rows in the look's colours: a card behind them (none in Colour Bands, which sits on
    /// its flat page) and the look's line between rows.
    func lookRows(_ look: TodayStyle) -> some View {
        let p = look.palette
        return self
            .listRowBackground(look == .bands ? Color.clear : p.card)
            .listRowSeparatorTint(p.sep)
    }
}

/// The card at the top of Settings. The logo never changes; the card follows the look: navy with
/// kawung and stitching (Centre Dial), the sun's curve (Sun Path), a band of green with the six
/// stripes (Colour Bands), a plain card with an accent edge (Big and Simple, Calm Gold).
private struct LookAppCard: View {
    @Environment(\.look) private var look
    @Environment(\.colorScheme) private var scheme

    private var p: LookPalette { look.palette }
    /// Light Sun Path is a pale sky, so its words go dark.
    private var darkWords: Bool { look == .sunPath && scheme == .light }
    private var card: Bool { look == .simple || look == .gold }

    private var nameColor: Color { card ? p.tx : (darkWords ? Color(hex: 0x151A45) : .white) }
    private var lineColor: Color {
        if card { return p.tx2 }
        if darkWords { return Color(hex: 0x4A5080) }
        return look == .bands ? Color.white.opacity(0.85) : Brand.moonText.opacity(0.85)
    }

    var body: some View {
        HStack(spacing: look == .simple ? 16 : 14) {
            Image("AppIconImage")
                .resizable()
                .frame(width: look == .simple ? 76 : 64, height: look == .simple ? 76 : 64)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .shadow(color: .black.opacity(0.3), radius: 7, y: 4)
            VStack(alignment: .leading, spacing: 2) {
                Text(W("phone.onboard.title"))
                    .font(look == .simple ? Theme.display(26, .bold) : .title3.weight(.bold))
                    .foregroundStyle(nameColor)
                if look != .simple {
                    Text(W("settings.builtIn")).font(.subheadline).foregroundStyle(lineColor)
                }
                Text(W("settings.versionN", ["v": Bundle.main.appVersion]))
                    .font(look == .simple ? .subheadline : .footnote).foregroundStyle(lineColor)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(lineColor)
        }
        .padding(look == .bands ? EdgeInsets(top: 22, leading: 20, bottom: 16, trailing: 20) : EdgeInsets(top: 18, leading: 18, bottom: 18, trailing: 18))
        .background { cardBackground }
        .overlay { cardEdge }
        .clipShape(RoundedRectangle(cornerRadius: look == .bands ? 0 : Theme.corner, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityHint(W("settings.sources"))
    }

    @ViewBuilder
    private var cardBackground: some View {
        switch look {
        case .bands:
            ZStack(alignment: .top) {
                Color(hex: 0x3A6F63)
                HStack(spacing: 0) {
                    Color(hex: 0x3A6F63); Color(hex: 0x8A9A52); Color(hex: 0xAB8D3A)
                    Color(hex: 0xCD7D38); Color(hex: 0xD3705C); Color(hex: 0xC9565D)
                }
                .frame(height: 8)
            }
        case .sunPath:
            ZStack {
                LinearGradient(colors: [.dyn(0xBFD9F2, 0x3A3480), .dyn(0xF6E9D5, 0x1D1F55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                Canvas { ctx, size in
                    var path = Path()
                    path.move(to: CGPoint(x: -10, y: size.height - 6))
                    path.addQuadCurve(to: CGPoint(x: size.width + 10, y: size.height - 6),
                                      control: CGPoint(x: size.width / 2, y: -size.height * 0.5))
                    ctx.stroke(path, with: .color(p.ac.opacity(0.55)), lineWidth: 3)
                    ctx.fill(Path(ellipseIn: CGRect(x: size.width * 0.73 - 6, y: 12, width: 12, height: 12)), with: .color(p.ac))
                }
            }
        case .simple, .gold:
            ZStack { Rectangle().fill(.ultraThinMaterial); p.card }
        default:
            ZStack {
                Brand.compassRing
                KawungPattern().opacity(0.16)
            }
        }
    }

    @ViewBuilder
    private var cardEdge: some View {
        switch look {
        case .simple:
            RoundedRectangle(cornerRadius: Theme.corner, style: .continuous).strokeBorder(p.ac, lineWidth: 2)
        case .gold:
            RoundedRectangle(cornerRadius: Theme.corner, style: .continuous).strokeBorder(p.ac, lineWidth: 1)
        case .centre, .list, .dial:
            RoundedRectangle(cornerRadius: 17, style: .continuous)
                .strokeBorder(Brand.stitchThread.opacity(0.45), style: StrokeStyle(lineWidth: 1.4, dash: [4, 3.2]))
                .padding(6)
        default:
            EmptyView()
        }
    }
}

enum SettingsLinks {
    /// One link that works for iPhone and Android (the site sends each phone to its store).
    static let appPage = URL(string: "https://prayertimes.asia")!
    static let faq = URL(string: "https://prayertimes.asia/#faq")!
    static let privacy = URL(string: "https://prayertimes.asia/privacy.html")!
    static let terms = URL(string: "https://prayertimes.asia/terms.html")!
    static let join = URL(string: "https://prayertimes.asia/join")!
    static let instagram = URL(string: "https://www.instagram.com/prayertimesasia")!
    static let facebook = URL(string: "https://www.facebook.com/prayertimesasia")!
    static let verify = URL(string: "https://prayertimes.asia/verify.html")!
    static let newLook = URL(string: "https://prayertimes.asia/new-look.html")!
    static let picksRules = URL(string: "https://prayertimes.asia/barakah-picks.html")!

    /// TestFlight and debug builds only. The store app never shows tester switches.
    static var isTesterBuild: Bool {
        #if DEBUG
        return true
        #else
        return Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        #endif
    }
}

private struct SettingsPageStyle: ViewModifier {
    let title: String
    let inline: Bool
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background(SkyNow())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(inline ? .inline : .large)
    }
}

extension View {
    /// The sky behind every Settings page, and its title.
    func settingsPage(_ title: String, inline: Bool = true) -> some View {
        modifier(SettingsPageStyle(title: title, inline: inline))
    }
}

// MARK: - Location

private struct LocationPage: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Button { showPlaces = true } label: {
                    LabeledContent(W("settings.place"), value: model.activePlace?.name ?? W("settings.notSet"))
                }
                .foregroundStyle(.primary)
            } footer: {
                Text(W("settings.placeFoot"))
            }
            Section {
                Toggle(isOn: $model.prefs.musafirEnabled) {
                    Text(W("settings.musafirMode"))
                    Text(W("settings.musafirModeSub"))
                }
                if model.prefs.musafirEnabled {
                    Button { model.showJourney = true } label: {
                        Label(W("settings.myJourneys"), image: "Tab-journey")
                    }
                }
            } header: {
                Text(W("settings.travel"))
            } footer: {
                Text(W("settings.travelAsk"))
            }
        }
        .settingsPage(W("settings.location"))
        .sheet(isPresented: $showPlaces) { PlacesView() }
    }
}

// MARK: - Prayer times

private struct PrayerTimesPage: View {
    @Environment(AppModel.self) private var model
    @State private var downloading = false

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                LabeledContent(W("settings.countryRules"), value: model.profile.code.isEmpty ? model.profile.name : "\(model.profile.flag) \(model.profile.name)")
                LabeledContent(W("settings.timesFrom"), value: model.method.shortName)
                LabeledContent(W("settings.timetable"), value: timetableStatus)
                if model.officialSource != nil {
                    Button(downloading ? W("phone.settings.downloading") : W("settings.downloadAgain")) {
                        downloading = true
                        model.refreshOfficialTimetable()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { downloading = false }
                    }
                    .disabled(downloading)
                }
                NavigationLink(W("settings.howAccurate")) { AccuracyPage() }
            } footer: {
                Text(W("phone.settings.followAuthority", ["source": model.sourceShort]))
            }

            Section {
                Picker(W("settings.method"), selection: $model.prefs.methodOverrideID) {
                    Text(W("common.automaticWith", ["name": model.profile.method.shortName])).tag(String?.none)
                    ForEach(CalculationMethod.all) { m in
                        Text(m.name).tag(String?.some(m.id))
                    }
                }
                Picker(W("settings.asr"), selection: $model.prefs.asrOverride) {
                    Text(W("common.automaticWith", ["name": model.profile.asr == .hanafi ? W("settings.hanafi") : W("settings.shafii")])).tag(AsrSchool?.none)
                    ForEach(AsrSchool.allCases) { Text($0.label).tag(AsrSchool?.some($0)) }
                }
                if model.method.id == "jakim", let place = model.activePlace {
                    Picker(W("settings.jakimZone"), selection: $model.prefs.jakimZoneOverride) {
                        Text(W("common.automaticWith", ["name": OfficialTimetables.nearestJakimZone(to: place.coordinates)])).tag(String?.none)
                        ForEach(JakimZones.zones) { zone in
                            Text("\(zone.id) · \(zone.areas)").tag(String?.some(zone.id))
                        }
                    }
                }
            } header: {
                Text(W("settings.calculation"))
            } footer: {
                Text(W("settings.calcFootShort"))
            }

            Section {
                Stepper(value: $model.prefs.hijriAdjustment, in: -2...2) {
                    LabeledContent(W("settings.hijriDate"),
                                   value: model.prefs.hijriAdjustment == 0 ? W("settings.sameDay") : String(format: "%+d day", model.prefs.hijriAdjustment))
                }
            } header: {
                Text(W("settings.dates"))
            } footer: {
                Text(W("settings.hijriFoot"))
            }

            Section {
                if let feed = model.officialSource?.calendarFeed {
                    Link(destination: feed) {
                        Label(W("settings.subscribe"), systemImage: "calendar.badge.plus")
                    }
                }
                if let all = CalendarFile.make(model: model, prayers: Prayer.obligatory) {
                    ShareLink(item: all) {
                        Label(W("phone.settings.add30"), systemImage: "calendar")
                    }
                }
                if let work = CalendarFile.make(model: model, prayers: [.dhuhr, .asr]) {
                    ShareLink(item: work) {
                        Label(W("phone.settings.workOnly", ["a": Prayer.dhuhr.name(model.naming), "b": Prayer.asr.name(model.naming)]),
                              systemImage: "briefcase")
                    }
                }
            } header: {
                Text(W("settings.addToCalendar"))
            }
        }
        .settingsPage(W("today.title"))
    }

    private var timetableStatus: String {
        guard let source = model.officialSource else { return W("phone.settings.workedOut") }
        let year = Calendar(identifier: .gregorian).component(.year, from: .now)
        return model.official.hasTable(source, year: year) ? W("phone.settings.savedOffline") : W("phone.settings.downloadsOnline")
    }
}

private struct AccuracyPage: View {
    var body: some View {
        Form {
            Section {
                Text(W("phone.settings.officialDownload"))
                Text(W("phone.settings.elsewhere"))
                Text(W("phone.settings.checkedAgainst"))
            }
            Section {
                LabeledContent("A", value: W("source.gradeA"))
                LabeledContent("B", value: W("phone.settings.confirmedMasjid"))
                LabeledContent("C", value: W("phone.settings.checkedCommunity"))
                LabeledContent("D", value: W("phone.settings.workedOut"))
                LabeledContent("F", value: W("phone.settings.ownShadow"))
            } header: {
                Text(W("phone.settings.letterBeside"))
            } footer: {
                Text(W("phone.settings.falakOnlyChecks"))
            }
        }
        .font(.callout)
        .settingsPage(W("settings.howAccurate"))
    }
}

// MARK: - Look and feel

private struct LookPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Picker(W("settings.prayerScreen"), selection: $model.prefs.todayStyle) {
                    ForEach(TodayStyle.looks) { Text($0.label).tag($0) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text(W("settings.prayerScreen"))
            }
            Section {
                Picker(W("settings.appearance"), selection: $model.prefs.appearance) {
                    Text(W("common.automatic")).tag(Appearance.system)
                    Text(W("appearance.light")).tag(Appearance.light)
                    Text(W("appearance.dark")).tag(Appearance.dark)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            } header: {
                Text(W("settings.appearance"))
            } footer: {
                Text(W("settings.appearanceFoot"))
            }
            Section {
                Toggle(W("settings.biggerText"), isOn: $model.prefs.largeText)
                Toggle(W("settings.hour24"), isOn: $model.prefs.use24Hour)
                Toggle(isOn: $model.prefs.showOpening) {
                    Text(W("settings.openingDial"))
                    Text(W("settings.openingDialSub"))
                }
            } header: {
                Text(W("settings.textTime"))
            } footer: {
                Text(W("settings.lookTip"))
            }
        }
        .settingsPage(W("settings.lookFeel"))
    }
}

// MARK: - Language

private struct LanguagePage: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Picker(W("phone.settings.appWords"), selection: $model.prefs.appLanguageOverride) {
                    Text(W("common.automaticWith", ["name": AppLanguageChoice.label(AppWords.deviceLang())])).tag(AppLanguageChoice?.none)
                    ForEach(AppLanguageChoice.allCases) { Text($0.label).tag(AppLanguageChoice?.some($0)) }
                }
                if Bundle.main.localizations.filter({ $0 != "Base" }).count > 1 {
                    Button(W("phone.settings.changeInSettings")) { openSettings() }
                }
            } footer: {
                Text(W("settings.languageFoot"))
            }
            Section {
                Picker(W("settings.names"), selection: $model.prefs.namingOverride) {
                    Text(W("common.automaticWith", ["name": model.personalNaming.language])).tag(NamingStyle?.none)
                    ForEach(NamingStyle.allCases) { Text($0.label).tag(NamingStyle?.some($0)) }
                }
                Toggle(W("phone.settings.localNames"), isOn: $model.prefs.showLocalNames)
            } header: {
                Text(W("settings.names"))
            } footer: {
                Text(W("phone.settings.namesFoot"))
            }
        }
        .settingsPage(W("settings.language"))
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
    }
}

// MARK: - Home and Lock Screen

private struct LockScreenPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Toggle(isOn: $model.prefs.liveActivityEnabled) {
                    Text(W("widget.liveCountdown"))
                    Text(W("phone.settings.lockDynamic"))
                }
                NavigationLink(W("settings.seeWidgets")) { WidgetPreviewView() }
            } footer: {
                Text(W("phone.settings.addWidget"))
            }
        }
        .settingsPage(W("phone.settings.homeLock"))
    }
}

// MARK: - Ramadan, tracker, hadith

private struct RamadanSettingsPage: View {
    @Environment(AppModel.self) private var model
    @State private var showRamadan = false

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Button { showRamadan = true } label: {
                    Label(W("phone.settings.openRamadan"), systemImage: "moon.stars")
                }
            } footer: {
                Text(W("settings.ramadanFootShort"))
            }
            // Tester builds only, or if it is somehow still on, so it can be turned off.
            if SettingsLinks.isTesterBuild || model.prefs.seasonPreview != .off {
                Section {
                    Picker(W("phone.settings.pretend"), selection: $model.prefs.seasonPreview) {
                        ForEach(SeasonPreview.allCases) { p in Text(p.label).tag(p) }
                    }
                } header: {
                    Text(W("settings.forTesters"))
                } footer: {
                    Text(model.prefs.seasonPreview == .off
                         ? W("settings.pretendFoot")
                         : W("settings.pretendOnFoot"))
                }
            }
        }
        .settingsPage(W("alerts.dayRamadan"))
        .sheet(isPresented: $showRamadan) { RamadanView() }
    }
}

private struct TrackerPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Toggle(W("settings.trackerOn"), isOn: $model.prefs.trackerEnabled)
            } footer: {
                Text(W("settings.trackerFootPhone")
                     + (model.prefs.trackerEnabled ? W("settings.trackerNudgeNote") : ""))
            }
        }
        .settingsPage(W("settings.trackerOn"))
    }
}

private struct HadithPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Toggle(isOn: Binding(get: { model.prefs.showHadith },
                                     set: { on in model.prefs.showHadith = on; if on { model.prefs.hiddenHadith = [] } })) {
                    Text(W("settings.showHadith"))
                    Text(W("settings.showHadithSub"))
                }
                Toggle(isOn: $model.prefs.hadithInAlerts) {
                    Text(W("settings.wakeHadith"))
                    Text(W("phone.settings.oneShort"))
                }
            } footer: {
                Text(W("phone.settings.hideHadith"))
            }
        }
        .settingsPage(W("hadith.title"))
    }
}

// MARK: - Move, privacy, help

private struct MovePhonePage: View {
    var body: some View {
        Form {
            Section {
                NavigationLink { MoveOutView() } label: {
                    Label(W("phone.settings.sendMine"), systemImage: "arrow.left.arrow.right")
                }
                NavigationLink { MoveInView() } label: {
                    Label(W("move.bringIn"), systemImage: "square.and.arrow.down")
                }
            } footer: {
                Text(W("phone.settings.moveBody"))
            }
        }
        .settingsPage(W("settings.movePhone"))
    }
}

private struct PrivacyPage: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var notifications: UNAuthorizationStatus = .notDetermined

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Label(W("phone.settings.noAds"), systemImage: "hand.raised.fill")
                Label(W("settings.privacyPhone"), systemImage: "location.slash.fill")
                Label(W("settings.privacyMasjid"), systemImage: "map.fill")
            } header: {
                Text(W("settings.promise"))
            }
            Section {
                Toggle(W("phone.settings.shareCounts"), isOn: $model.prefs.shareUsage)
            } footer: {
                Text(W("phone.settings.countsFoot"))
            }
            Section {
                LabeledContent(W("settings.location"), value: locationStatus)
                LabeledContent(W("settings.notificationsWord"), value: notificationStatus)
                Button(W("phone.settings.openIphone")) {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
            } header: {
                Text(W("settings.phonePermissions"))
            } footer: {
                Text(W("settings.phonePermissionsFoot"))
            }
            Section {
                Link(W("settings.privacyPolicy"), destination: SettingsLinks.privacy)
            }
        }
        .settingsPage(W("settings.privacy"))
        .task {
            notifications = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        }
    }

    private var locationStatus: String {
        if model.location.isAuthorized { return W("settings.allowed") }
        if model.location.isDenied { return W("common.off") }
        return model.prefs.useGPS ? W("settings.notAsked") : W("settings.pickedPlace")
    }

    private var notificationStatus: String {
        switch notifications {
        case .authorized, .provisional, .ephemeral: return W("settings.allowed")
        case .denied: return W("common.off")
        default: return W("settings.notAsked")
        }
    }
}

private struct HelpPage: View {
    @State private var showGuide = false

    var body: some View {
        Form {
            Section {
                Button { showGuide = true } label: {
                    Label(W("settings.showGuide"), systemImage: "lightbulb")
                }
                Link(destination: SettingsLinks.faq) {
                    Label(W("settings.faq"), systemImage: "questionmark.bubble")
                }
                Link(destination: SettingsLinks.verify) {
                    Label(W("phone.settings.helpCheck"), systemImage: "checkmark.seal")
                }
            } footer: {
                Text(W("phone.settings.quickGuide"))
            }
        }
        .settingsPage(W("settings.help"))
        .fullScreenCover(isPresented: $showGuide) { GuideView() }
    }
}

// MARK: - Barakah Picks and About

private struct PicksPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                ForEach(CommunityCard.ours(for: model.offerCountry)) { card in
                    MakersCard(card: card, placement: "settings")
                        .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                }
            }
            Section {
                Toggle(W("phone.settings.show", ["name": picksName]), isOn: $model.prefs.showOffers)
                Link(W("phone.settings.ourRules", ["name": picksName]), destination: SettingsLinks.picksRules)
            } footer: {
                Text(W("phone.settings.picksBody"))
            }
        }
        .settingsPage(picksName)
    }
}

struct AboutPage: View {
    var body: some View {
        Form {
            Section {
                AppCard(showsChevron: false)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            Section {
                NavigationLink(W("settings.sources")) { CreditsView() }
                Link(W("settings.designLook"), destination: SettingsLinks.newLook)
            } footer: {
                Text(W("phone.settings.builtAsia"))
            }
            Section {
                Link(W("settings.joinTimekeepers"), destination: SettingsLinks.join)
                Link(W("settings.instagram"), destination: SettingsLinks.instagram)
                Link(W("settings.facebook"), destination: SettingsLinks.facebook)
            } header: {
                Text(W("settings.community"))
            }
            Section {
                Link(W("settings.privacyPolicy"), destination: SettingsLinks.privacy)
                Link(W("settings.terms"), destination: SettingsLinks.terms)
                LabeledContent(W("settings.version"), value: Bundle.main.appVersion)
            } footer: {
                Text(W("settings.freeLine"))
            }
        }
        .settingsPage(W("settings.aboutCredits"))
    }
}

extension Bundle {
    var appVersion: String {
        let v = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}
