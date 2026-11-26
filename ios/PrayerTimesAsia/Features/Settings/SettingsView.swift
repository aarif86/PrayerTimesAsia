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
        if notify + alarm == 0 { return model.prefs.anyAlarm ? "On" : "Nothing is on" }
        var parts: [String] = []
        if notify > 0 { parts.append("\(notify) notify") }
        if alarm > 0 { parts.append(alarm == 1 ? "1 alarm" : "\(alarm) alarms") }
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
                        SettingsRow("Location", icon: "location.fill", slot: 0, color: .blue, value: model.activePlace?.name ?? "Not set")
                    }
                    NavigationLink { PrayerTimesPage() } label: {
                        SettingsRow("Prayer times", icon: "clock.fill", slot: 1, color: .teal, value: model.method.shortName)
                    }
                    Button { model.openAlerts() } label: {
                        HStack {
                            SettingsRow("Alerts and alarms", icon: "alarm.fill", slot: 2, color: .red, value: alertsCount)
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                    }
                    .foregroundStyle(.primary)
                }
                .lookRows(look)

                Section {
                    NavigationLink { LookPage() } label: {
                        SettingsRow("Look and feel", icon: "paintpalette.fill", slot: 3, color: .purple, value: model.prefs.todayStyle.label)
                    }
                    NavigationLink { LanguagePage() } label: {
                        SettingsRow("Language", icon: "globe", slot: 4, color: .blue, value: "English")
                    }
                    NavigationLink { LockScreenPage() } label: {
                        SettingsRow("Home and Lock Screen", icon: "iphone", slot: 5, color: .indigo,
                                    value: model.prefs.liveActivityEnabled ? "Countdown on" : "Countdown off")
                    }
                }
                .lookRows(look)

                Section {
                    NavigationLink { RamadanSettingsPage() } label: {
                        SettingsRow("Ramadan", icon: "moon.stars.fill", slot: 0, color: Brand.duskIndigo,
                                    value: model.prefs.seasonPreview == .off ? "Starts by itself" : "Pretend on")
                    }
                    NavigationLink { TrackerPage() } label: {
                        SettingsRow("Prayer tracker", icon: "checkmark.circle.fill", slot: 1, color: .green, value: model.prefs.trackerEnabled ? "On" : "Off")
                    }
                    NavigationLink { HadithPage() } label: {
                        SettingsRow("Hadith", icon: "book.fill", slot: 2, color: .brown,
                                    value: model.prefs.showHadith || model.prefs.hadithInAlerts ? "On" : "Off")
                    }
                }
                .lookRows(look)

                Section {
                    NavigationLink { MovePhonePage() } label: {
                        SettingsRow("Move to a new phone", icon: "arrow.left.arrow.right", slot: 3, color: .cyan)
                    }
                    NavigationLink { PrivacyPage() } label: {
                        SettingsRow("Privacy", icon: "hand.raised.fill", slot: 4, color: .blue)
                    }
                    NavigationLink { HelpPage() } label: {
                        SettingsRow("Help", icon: "questionmark.circle.fill", slot: 5, color: .orange)
                    }
                }
                .lookRows(look)

                Section {
                    ShareLink(item: SettingsLinks.appPage,
                              message: Text("Prayer Times Asia, free prayer times for iPhone and Android.")) {
                        SettingsRow("Share with family and friends", icon: "square.and.arrow.up", slot: 0, color: .green)
                    }
                    .foregroundStyle(.primary)
                    Button { showReview = true } label: {
                        SettingsRow("Rate the app", icon: "star.fill", slot: 1, color: .yellow)
                    }
                    .foregroundStyle(.primary)
                    Button { showNote = true } label: {
                        SettingsRow("Send us a note", icon: "envelope.fill", slot: 2, color: .blue)
                    }
                    .foregroundStyle(.primary)
                    NavigationLink { PicksPage() } label: {
                        SettingsRow(picksName, icon: "gift.fill", slot: 3, color: .pink, value: model.prefs.showOffers ? "On" : "Off")
                    }
                    NavigationLink { AboutPage() } label: {
                        SettingsRow("About and credits", icon: "info.circle.fill", slot: 4, color: .gray)
                    }
                    .id("makers")
                } footer: {
                    Text("Version \(Bundle.main.appVersion)")
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
            .settingsPage("Settings", inline: false)
            .sheet(isPresented: $showReview) { ReviewView() }
            .sheet(isPresented: $showNote) { NoteView() }
            .toolbar {
                if !isTab { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
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
                Text("Prayer Times Asia")
                    .font(look == .simple ? Theme.display(26, .bold) : .title3.weight(.bold))
                    .foregroundStyle(nameColor)
                if look != .simple {
                    Text("Built fisabilillah in Singapore").font(.subheadline).foregroundStyle(lineColor)
                }
                Text("Version \(Bundle.main.appVersion)")
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
        .accessibilityHint("Sources and credits")
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
                    LabeledContent("Place", value: model.activePlace?.name ?? "Not set")
                }
                .foregroundStyle(.primary)
            } footer: {
                Text("Your times follow the place you pick here.")
            }
            Section {
                Toggle(isOn: $model.prefs.musafirEnabled) {
                    Text("Musafir mode")
                    Text("Jamak and qasar help when you are away from home")
                }
                if model.prefs.musafirEnabled {
                    Button { model.showJourney = true } label: {
                        Label("My journeys", image: "Tab-journey")
                    }
                }
            } header: {
                Text("Travel")
            } footer: {
                Text("We will ask when you land in another country.")
            }
        }
        .settingsPage("Location")
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
                LabeledContent("Country rules", value: model.profile.code.isEmpty ? model.profile.name : "\(model.profile.flag) \(model.profile.name)")
                LabeledContent("Times from", value: model.method.shortName)
                LabeledContent("Timetable", value: timetableStatus)
                if model.officialSource != nil {
                    Button(downloading ? "Downloading" : "Download the timetable again") {
                        downloading = true
                        model.refreshOfficialTimetable()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { downloading = false }
                    }
                    .disabled(downloading)
                }
                NavigationLink("How accurate are the times?") { AccuracyPage() }
            } footer: {
                Text("\(model.sourceShort) Always follow your local religious authority.")
            }

            Section {
                Picker("Method", selection: $model.prefs.methodOverrideID) {
                    Text("Automatic · \(model.profile.method.shortName)").tag(String?.none)
                    ForEach(CalculationMethod.all) { m in
                        Text(m.name).tag(String?.some(m.id))
                    }
                }
                Picker("Asr", selection: $model.prefs.asrOverride) {
                    Text("Automatic · \(model.profile.asr == .hanafi ? "Hanafi" : "Shafi'i")").tag(AsrSchool?.none)
                    ForEach(AsrSchool.allCases) { Text($0.label).tag(AsrSchool?.some($0)) }
                }
                if model.method.id == "jakim", let place = model.activePlace {
                    Picker("JAKIM zone", selection: $model.prefs.jakimZoneOverride) {
                        Text("Automatic · \(OfficialTimetables.nearestJakimZone(to: place.coordinates))").tag(String?.none)
                        ForEach(JakimZones.zones) { zone in
                            Text("\(zone.id) · \(zone.areas)").tag(String?.some(zone.id))
                        }
                    }
                }
            } header: {
                Text("Calculation")
            } footer: {
                Text("Automatic follows the country you are in. Change these only if your masjid follows another way.")
            }

            Section {
                Stepper(value: $model.prefs.hijriAdjustment, in: -2...2) {
                    LabeledContent("Hijri date",
                                   value: model.prefs.hijriAdjustment == 0 ? "Same day" : String(format: "%+d day", model.prefs.hijriAdjustment))
                }
            } header: {
                Text("Dates")
            } footer: {
                Text("Move the Hijri date by a day if your local moon sighting is different.")
            }

            Section {
                if let feed = model.officialSource?.calendarFeed {
                    Link(destination: feed) {
                        Label("Subscribe in Calendar", systemImage: "calendar.badge.plus")
                    }
                }
                if let all = CalendarFile.make(model: model, prayers: Prayer.obligatory) {
                    ShareLink(item: all) {
                        Label("Add the next 30 days", systemImage: "calendar")
                    }
                }
                if let work = CalendarFile.make(model: model, prayers: [.dhuhr, .asr]) {
                    ShareLink(item: work) {
                        Label("\(Prayer.dhuhr.name(model.naming)) and \(Prayer.asr.name(model.naming)) only, for work",
                              systemImage: "briefcase")
                    }
                }
            } header: {
                Text("Add to calendar")
            }
        }
        .settingsPage("Prayer times")
    }

    private var timetableStatus: String {
        guard let source = model.officialSource else { return "Worked out on your phone" }
        let year = Calendar(identifier: .gregorian).component(.year, from: .now)
        return model.official.hasTable(source, year: year) ? "Saved for offline" : "Downloads when online"
    }
}

private struct AccuracyPage: View {
    var body: some View {
        Form {
            Section {
                Text("In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year and keeps it for offline use. Only the year, zone code or area name is sent.")
                Text("Everywhere else, and before that download, times are worked out on your phone with the country's own method.")
                Text("That working is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables. For Singapore it is never earlier than the official time, and at most 2 minutes later. For Malaysia and Indonesia it is within about 2 minutes.")
            }
            Section {
                LabeledContent("A", value: "Official")
                LabeledContent("B", value: "Confirmed by a masjid")
                LabeledContent("C", value: "Checked by the community")
                LabeledContent("D", value: "Worked out on your phone")
                LabeledContent("F", value: "Your own shadow reading")
            } header: {
                Text("The letter beside each day")
            } footer: {
                Text("A falak reading from your own shadow stick only checks the times.")
            }
        }
        .font(.callout)
        .settingsPage("How accurate are the times?")
    }
}

// MARK: - Look and feel

private struct LookPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Picker("Prayer screen", selection: $model.prefs.todayStyle) {
                    ForEach(TodayStyle.looks) { Text($0.label).tag($0) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("Prayer screen")
            }
            Section {
                Picker("Appearance", selection: $model.prefs.appearance) {
                    Text("Automatic").tag(Appearance.system)
                    Text("Light").tag(Appearance.light)
                    Text("Dark").tag(Appearance.dark)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            } header: {
                Text("Appearance")
            } footer: {
                Text("Automatic follows the sky where you are.")
            }
            Section {
                Toggle("Bigger text", isOn: $model.prefs.largeText)
                Toggle("24 hour time", isOn: $model.prefs.use24Hour)
                Toggle(isOn: $model.prefs.showOpening) {
                    Text("Moving dial when the app opens")
                    Text("Turn off to open straight to your times")
                }
            } header: {
                Text("Text and time")
            } footer: {
                Text("Tip. The two round buttons at the top of the Prayer screen change the look too.")
            }
        }
        .settingsPage("Look and feel")
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
                LabeledContent("App words", value: "English")
                if Bundle.main.localizations.filter({ $0 != "Base" }).count > 1 {
                    Button("Change in iPhone Settings") { openSettings() }
                }
            } footer: {
                Text("The app's words are in English for now. Malay and Indonesian are on the way.")
            }
            Section {
                Picker("Prayer names", selection: $model.prefs.namingOverride) {
                    Text("Automatic · \(model.personalNaming.language)").tag(NamingStyle?.none)
                    ForEach(NamingStyle.allCases) { Text($0.label).tag(NamingStyle?.some($0)) }
                }
                Toggle("Local names when travelling", isOn: $model.prefs.showLocalNames)
            } header: {
                Text("Prayer names")
            } footer: {
                Text("Pick Malay for Subuh and Isyak. When you travel, the local name shows small underneath, so the masjid's signs make sense.")
            }
        }
        .settingsPage("Language")
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
                    Text("Live countdown")
                    Text("Next prayer on the Lock Screen and Dynamic Island")
                }
                NavigationLink("See the widgets") { WidgetPreviewView() }
            } footer: {
                Text("To add a widget, touch and hold your Home Screen, then tap Edit.")
            }
        }
        .settingsPage("Home and Lock Screen")
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
                    Label("Open the Ramadan page", systemImage: "moon.stars")
                }
            } footer: {
                Text("Ramadan mode starts by itself when your local religious authority announces it. Sahur and iftar alerts are in Alerts and alarms.")
            }
            // Tester builds only, or if it is somehow still on, so it can be turned off.
            if SettingsLinks.isTesterBuild || model.prefs.seasonPreview != .off {
                Section {
                    Picker("Pretend it is", selection: $model.prefs.seasonPreview) {
                        ForEach(SeasonPreview.allCases) { p in Text(p.label).tag(p) }
                    }
                } header: {
                    Text("For testers")
                } footer: {
                    Text(model.prefs.seasonPreview == .off
                         ? "Shows a pretend Ramadan or Eid date so you can try it early."
                         : "Pretend mode is on. The app shows a pretend date, not today's. Turn it off before you rely on the times.")
                }
            }
        }
        .settingsPage("Ramadan")
        .sheet(isPresented: $showRamadan) { RamadanView() }
    }
}

private struct TrackerPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                Toggle("Prayer tracker", isOn: $model.prefs.trackerEnabled)
            } footer: {
                Text("Tick off each prayer on the Prayer screen once it has passed, and keep a streak. Tap the streak to mark a day as excused, like haid or illness, so it carries on. Kept only on this phone."
                     + (model.prefs.trackerEnabled ? " The nudge before time runs out is in Alerts and alarms." : ""))
            }
        }
        .settingsPage("Prayer tracker")
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
                    Text("Show hadith in the app")
                    Text("A short hadith or ayah on some screens")
                }
                Toggle(isOn: $model.prefs.hadithInAlerts) {
                    Text("Add a hadith to wake up alerts")
                    Text("One short line under Fajr and tahajjud alerts")
                }
            } footer: {
                Text("Tap ✕ on any hadith to hide just that one.")
            }
        }
        .settingsPage("Hadith")
    }
}

// MARK: - Move, privacy, help

private struct MovePhonePage: View {
    var body: some View {
        Form {
            Section {
                NavigationLink { MoveOutView() } label: {
                    Label("Send my settings", systemImage: "arrow.left.arrow.right")
                }
                NavigationLink { MoveInView() } label: {
                    Label("Bring in settings", systemImage: "square.and.arrow.down")
                }
            } footer: {
                Text("A QR code or link carries your places, choices and tracker. No account and nothing uploaded. Works with iPhone, Android and the web. Restoring a new iPhone from an iCloud backup brings them too.")
            }
        }
        .settingsPage("Move to a new phone")
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
                Label("No outside ads and no accounts", systemImage: "hand.raised.fill")
                Label("Your exact location stays on your phone", systemImage: "location.slash.fill")
                Label("Masjid search sends only your area", systemImage: "map.fill")
            } header: {
                Text("Our promise")
            }
            Section {
                Toggle("Share anonymous counts", isOn: $model.prefs.shareUsage)
            } footer: {
                Text("Tells us which cities use the app, so we know where to add official timetables. A random number stands in for you. Never your name, exact location or IP address.")
            }
            Section {
                LabeledContent("Location", value: locationStatus)
                LabeledContent("Notifications", value: notificationStatus)
                Button("Open iPhone Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
            } header: {
                Text("Phone permissions")
            } footer: {
                Text("If times or alerts look wrong, check these first.")
            }
            Section {
                Link("Privacy policy", destination: SettingsLinks.privacy)
            }
        }
        .settingsPage("Privacy")
        .task {
            notifications = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        }
    }

    private var locationStatus: String {
        if model.location.isAuthorized { return "Allowed" }
        if model.location.isDenied { return "Off" }
        return model.prefs.useGPS ? "Not asked yet" : "Using a place you picked"
    }

    private var notificationStatus: String {
        switch notifications {
        case .authorized, .provisional, .ephemeral: return "Allowed"
        case .denied: return "Off"
        default: return "Not asked yet"
        }
    }
}

private struct HelpPage: View {
    @State private var showGuide = false

    var body: some View {
        Form {
            Section {
                Button { showGuide = true } label: {
                    Label("Show the quick guide", systemImage: "lightbulb")
                }
                Link(destination: SettingsLinks.faq) {
                    Label("Questions and answers", systemImage: "questionmark.bubble")
                }
                Link(destination: SettingsLinks.verify) {
                    Label("Help check times where you live", systemImage: "checkmark.seal")
                }
            } footer: {
                Text("The quick guide is a short tour that taps the real buttons for you.")
            }
        }
        .settingsPage("Help")
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
                Toggle("Show \(picksName)", isOn: $model.prefs.showOffers)
                Link("Our rules for \(picksName)", destination: SettingsLinks.picksRules)
            } footer: {
                Text("Halal Muslim businesses and causes we check by hand, safe for the whole family. Most are our own services, and paid ones are marked Sponsored. We only count how often a card is seen and tapped, never who you are.")
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
                NavigationLink("Sources and credits") { CreditsView() }
                Link("Design a new look", destination: SettingsLinks.newLook)
            } footer: {
                Text("Built in Asia, made for Muslims everywhere.")
            }
            Section {
                Link("Join the Timekeepers", destination: SettingsLinks.join)
                Link("Follow us on Instagram", destination: SettingsLinks.instagram)
                Link("Follow us on Facebook", destination: SettingsLinks.facebook)
            } header: {
                Text("Community")
            }
            Section {
                Link("Privacy policy", destination: SettingsLinks.privacy)
                Link("Terms of use", destination: SettingsLinks.terms)
                LabeledContent("Version", value: Bundle.main.appVersion)
            } footer: {
                Text("Free for everyone. No paid version.")
            }
        }
        .settingsPage("About and credits")
    }
}

extension Bundle {
    var appVersion: String {
        let v = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}
