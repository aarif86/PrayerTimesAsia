import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false
    @State private var showRamadan = false
    @State private var showGuide = false
    @State private var showReview = false
    @State private var showNote = false
    @Environment(\.dismiss) private var dismiss
    /// A main tab (no Done button) rather than a sheet.
    var isTab = false
    /// Every half hour of the day, in minutes past midnight.
    static let halfHours = Array(stride(from: 0, to: 1440, by: 30))


    private var wakeUpSummary: String {
        guard model.prefs.anyAlarm else { return "" }
        return model.nextWakeUp(after: .now).map { "Next \(model.formatted($0.date))" } ?? ""
    }

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
        @Bindable var model = model
        NavigationStack {
            ScrollViewReader { proxy in
            Form {
                // The app's own card: the icon on the navy compass-ring colour. Opens Sources & credits.
                Section {
                    AppCard()
                        .overlay { NavigationLink { CreditsView() } label: { EmptyView() }.opacity(0) }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                Section("Location") {
                    Button { showPlaces = true } label: {
                        LabeledContent("Place", value: model.activePlace?.name ?? "Not set")
                    }
                    LabeledContent("Country rules", value: model.profile.code.isEmpty ? model.profile.name : "\(model.profile.flag) \(model.profile.name)")
                }

                Section {
                    Button { model.openAlerts() } label: {
                        LabeledContent {
                            Text(wakeUpSummary)
                        } label: {
                            Label {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Alerts and alarms")
                                    Text(alertsCount).font(.footnote).foregroundStyle(.secondary)
                                }
                            } icon: {
                                Image(systemName: "alarm.fill")
                            }
                            .foregroundStyle(.primary)
                        }
                    }
                } header: {
                    Text("Alerts and alarms")
                } footer: {
                    Text("Each prayer Off, Notify or Alarm, \(Prayer.dhuhr.name(model.naming, isFriday: true)), sahur, Ramadan and how it all sounds, in one place. Also on the Prayer screen. Tap the alarm clock at the top, or hold a bell.")
                }

                Section {
                    Button { showRamadan = true } label: {
                        Label("Ramadan page", systemImage: "moon.stars")
                    }
                    Picker("Try Ramadan (for testers)", selection: $model.prefs.seasonPreview) {
                        ForEach(SeasonPreview.allCases) { p in Text(p.label).tag(p) }
                    }
                } header: {
                    Text("Ramadan and Syawal")
                } footer: {
                    Text(model.prefs.seasonPreview == .off
                         ? "Ramadan mode turns on by itself on the day your local religious authority announces. Testers can pretend it's Ramadan or Raya with the switch above."
                         : "Pretend mode is on. The app shows a pretend date, not today's. Turn it off before you rely on the times.")
                }


                Section {
                    Toggle("Musafir features", isOn: $model.prefs.musafirEnabled)
                    if model.prefs.musafirEnabled {
                        Button { model.showJourney = true } label: {
                            Label("Journey", image: "Tab-journey")
                        }
                    }
                } header: {
                    Text("Travel")
                } footer: {
                    Text("Jamak and qasar guidance, combined prayer windows and a log of where you've prayed. We'll ask when you land in another country.")
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
                    LabeledContent("Timetable", value: timetableStatus)
                    if let feed = model.officialSource?.calendarFeed {
                        Link(destination: feed) {
                            Label("Subscribe in Calendar", systemImage: "calendar.badge.plus")
                        }
                    }
                    if let all = CalendarFile.make(model: model, prayers: Prayer.obligatory) {
                        ShareLink(item: all) {
                            Label("Add the next 30 days to a calendar", systemImage: "calendar")
                        }
                    }
                    if let work = CalendarFile.make(model: model, prayers: [.dhuhr, .asr]) {
                        ShareLink(item: work) {
                            Label("Only \(Prayer.dhuhr.name(model.naming)) and \(Prayer.asr.name(model.naming)), for a work calendar",
                                  systemImage: "briefcase")
                        }
                    }
                } header: {
                    Text("Calculation")
                } footer: {
                    Text("\(model.sourceSummary) Automatic follows the country you're in, so landing in a new country switches it for you. \(model.method.note)")
                }

                Section {
                    Picker("Prayer names", selection: $model.prefs.namingOverride) {
                        Text("Automatic · \(model.personalNaming.language)").tag(NamingStyle?.none)
                        ForEach(NamingStyle.allCases) { Text($0.label).tag(NamingStyle?.some($0)) }
                    }
                    Toggle("Show local names when travelling", isOn: $model.prefs.showLocalNames)
                } header: {
                    Text("Prayer names")
                } footer: {
                    Text("Automatic shows English names like Fajr and Isha, or your \(Device.noun)'s language if we have it. Pick Malay for Subuh and Isyak. Your names stay the same wherever you go. When you travel somewhere that uses other words, the local name shows small underneath, like Subuh in Kuala Lumpur, so the masjid's signs make sense. Spellings follow each authority's own timetable.")
                }

                Section {
                    Toggle(isOn: Binding(get: { model.prefs.showHadith },
                                         set: { on in model.prefs.showHadith = on; if on { model.prefs.hiddenHadith = [] } })) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Show hadith in the app")
                            Text("A short hadith or ayah on some screens").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Toggle(isOn: $model.prefs.hadithInAlerts) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Add a hadith to wake-up alerts")
                            Text("One short line under the Subuh and tahajjud alerts").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Hadith")
                } footer: {
                    Text("Tap ✕ on any hadith to hide just that one. Turn both off for a clean app with times only.")
                }

                Section {
                    Toggle("Prayer tracker", isOn: $model.prefs.trackerEnabled)
                } header: {
                    Text("Tracker")
                } footer: {
                    Text("Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only on this \(Device.noun)." + (model.prefs.trackerEnabled ? " The nudge before time runs out is in Alerts and alarms." : ""))
                }

                Section {
                    Toggle("Live countdown", isOn: $model.prefs.liveActivityEnabled)
                    NavigationLink("See the big timetable widget") { WidgetPreviewView() }
                } header: {
                    Text("Lock Screen")
                } footer: {
                    Text("Shows a countdown to the next prayer on the Lock Screen and in the Dynamic Island. Add widgets from your Home Screen: touch and hold, then tap Edit.")
                }

                Section("Display") {
                    Picker("Appearance", selection: $model.prefs.appearance) {
                        ForEach(Appearance.allCases) { Text($0.label).tag($0) }
                    }
                    Picker("Prayer screen", selection: $model.prefs.todayStyle) {
                        ForEach(TodayStyle.allCases) { Text($0.label).tag($0) }
                    }
                    Toggle("Bigger text", isOn: $model.prefs.largeText)
                    Toggle(isOn: $model.prefs.showOpening) {
                        Text("Opening screen")
                        Text("The moving dial you see as the app opens. Turn it off to go straight to your prayer times. It always shows the first time.")
                    }
                    Toggle("24-hour time", isOn: $model.prefs.use24Hour)
                    Stepper(value: $model.prefs.hijriAdjustment, in: -2...2) {
                        LabeledContent("Hijri date adjustment",
                                       value: model.prefs.hijriAdjustment == 0 ? "None" : String(format: "%+d day", model.prefs.hijriAdjustment))
                    }
                }



                Section {
                    NavigationLink { MoveOutView() } label: {
                        Label("Move my settings", systemImage: "arrow.left.arrow.right")
                    }
                    NavigationLink { MoveInView() } label: {
                        Label("Bring in settings", systemImage: "square.and.arrow.down")
                    }
                } header: {
                    Text("Moving to another phone")
                } footer: {
                    Text("Your places, choices and tracker history travel inside a QR code or link - no account, nothing uploaded. Works between iPhone, Android and the web. Restoring a new iPhone from an iCloud backup brings them too.")
                }

                Section {
                    Button { showGuide = true } label: {
                        Label("Show the quick guide", systemImage: "lightbulb")
                    }
                } header: {
                    Text("Help")
                } footer: {
                    Text("A short tour that taps the real buttons, so you know where everything is.")
                }

                Section("Accuracy") {
                    Text("Every day shows its source grade: A official, B masjid-confirmed, C community-verified, D calculated. F (falak) marks a reading from your own shadow stick, which only checks the times. In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year (only the year, zone code or regency name is sent) and keeps it for offline use. Everywhere else, and before that download, times are calculated on your \(Device.noun) with the country's own method. That calculation is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia and Indonesia it is within about 2 minutes.")
                        .font(.footnote)
                }

                Section {
                    Label("No outside ads, no accounts, no tracking across other apps.", systemImage: "hand.raised.fill")
                    Label("Your exact location never leaves your \(Device.noun).", systemImage: "location.slash.fill")
                    Label("Nearby masjid search goes through Apple Maps and OpenStreetMap (only the area is sent).", systemImage: "map.fill")
                    Toggle("Share anonymous usage counts", isOn: $model.prefs.shareUsage)
                } header: {
                    Text("Privacy")
                } footer: {
                    Text("Usage counts tell us how many people use the app and in which city and country, so we know where to add official timetables. A random number stands in for you: no name, no exact location, no IP address kept.")
                }
                .font(.footnote)

                Section {
                    ForEach(CommunityCard.ours(for: model.offerCountry)) { card in
                        MakersCard(card: card, placement: "settings")
                            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                    }
                    Toggle("Show \(picksName)", isOn: $model.prefs.showOffers)
                } header: {
                    Text(picksName).id("makers")
                } footer: {
                    Text("Barakah Picks is not a normal ad. It is one small space we check by hand for halal Muslim businesses and causes, safe for the whole family. No gambling, alcohol, riba or anything immodest, and never Google, Facebook or Instagram ads. Most picks are our own services, and paid ones are marked Sponsored. We keep only simple counts of how often each card is seen and tapped, never who you are. [Our rules for Barakah Picks](https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/community-cards.md)")
                }

                Section {
                    Button { showReview = true } label: { Label("Rate and review", systemImage: "star") }
                    Button { showNote = true } label: { Label("Send a note to the makers", systemImage: "envelope") }
                    NavigationLink("Sources & credits") { CreditsView() }
                    Link("Help verify times where you are", destination: URL(string: "https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md")!)
                    Link("Design a new look", destination: URL(string: "https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md")!)
                    LabeledContent("Version", value: Bundle.main.appVersion)
                } footer: {
                    Text("Prayer Times Asia. Built in Asia, made for Muslims everywhere.")
                }
            }
            .onAppear {
                // `-settings-end` (CI screenshots): open at "From the makers".
                if ProcessInfo.processInfo.arguments.contains("-settings-end") {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { proxy.scrollTo("makers", anchor: .top) }
                }
            }
            }
            .scrollContentBackground(.hidden)
            .background(SkyNow())
            .navigationTitle("Settings")
            .sheet(isPresented: $showPlaces) { PlacesView() }
            .sheet(isPresented: $showRamadan) { RamadanView() }
            .fullScreenCover(isPresented: $showGuide) { GuideView() }
            .sheet(isPresented: $showReview) { ReviewView() }
            .sheet(isPresented: $showNote) { NoteView() }
            .toolbar {
                if !isTab { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            }
        }
    }
}

extension SettingsView {
    private var timetableStatus: String {
        guard let source = model.officialSource else { return "Calculated on device" }
        let year = Calendar(identifier: .gregorian).component(.year, from: .now)
        return model.official.hasTable(source, year: year) ? "Official · downloaded" : "Official · will download when online"
    }
}

extension Bundle {
    var appVersion: String {
        let v = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}
