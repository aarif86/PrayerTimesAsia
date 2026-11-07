import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false
    @State private var showRamadan = false
    @Environment(\.dismiss) private var dismiss
    /// A main tab (no Done button) rather than a sheet.
    var isTab = false
    /// Every half hour of the day, in minutes past midnight.
    static let halfHours = Array(stride(from: 0, to: 1440, by: 30))

    /// A Ramadan alert switch that asks for notification permission when turned on.
    private func ramadanAlert(_ title: String, _ detail: String, _ key: WritableKeyPath<Preferences, Bool>) -> some View {
        Toggle(isOn: Binding(
            get: { model.prefs[keyPath: key] },
            set: { on in
                Task {
                    if on { model.prefs[keyPath: key] = await NotificationScheduler.requestPermission() }
                    else { model.prefs[keyPath: key] = false }
                }
            })) {
            VStack(alignment: .leading) { Text(title); Text(detail).font(.caption).foregroundStyle(.secondary) }
        }
    }

    private var wakeUpSummary: String {
        guard model.prefs.wakeUp != nil || model.prefs.sahurAlarm != nil else { return "Off" }
        return model.nextWakeUp(after: .now).map { "Next \(model.formatted($0.date))" } ?? "On"
    }

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ScrollViewReader { proxy in
            Form {
                Section("Location") {
                    Button { showPlaces = true } label: {
                        LabeledContent("Place", value: model.activePlace?.name ?? "Not set")
                    }
                    LabeledContent("Country rules", value: model.profile.code.isEmpty ? model.profile.name : "\(model.profile.flag) \(model.profile.name)")
                }

                Section {
                    Button { showRamadan = true } label: {
                        Label("Ramadan page", systemImage: "moon.stars")
                    }
                    Picker("Try Ramadan (for testers)", selection: $model.prefs.seasonPreview) {
                        ForEach(SeasonPreview.allCases) { p in Text(p.label).tag(p) }
                    }
                    ramadanAlert("Imsak alert", "10 minutes before Imsak, to finish sahur", \.imsakAlert)
                    ramadanAlert("Berbuka alert", "At Maghrib, with the doa", \.berbukaAlert)
                    ramadanAlert("Qiyam in the last ten nights", "At the last third of the night", \.qiyamAlert)
                } header: {
                    Text("Ramadan and Syawal")
                } footer: {
                    Text(model.prefs.seasonPreview == .off
                         ? "Ramadan mode turns on by itself on the day your local religious authority announces. Testers can pretend it's Ramadan or Raya with the switch above."
                         : "Pretend mode is on. The app shows a pretend date, not today's. Turn it off before you rely on the times.")
                }

                Section {
                    Button { model.showWakeUp = true } label: {
                        LabeledContent {
                            Text(wakeUpSummary)
                        } label: {
                            Label("Wake up for \(Prayer.fajr.name(model.naming))", systemImage: "alarm.fill")
                                .foregroundStyle(.primary)
                        }
                    }
                } header: {
                    Text("Wake-up")
                } footer: {
                    Text("Also on the Prayer screen. Tap the alarm clock at the top.")
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
                    Text("Your names stay the same wherever you are: Automatic uses your home country's words, or your phone's language. When you travel somewhere that uses different words, the local name appears small underneath - \"Fajr\" with \"Subuh here\" in Kuala Lumpur - so the masjid's signs make sense. Spellings follow each authority's own timetable.")
                }

                Section {
                    Toggle("Prayer tracker", isOn: $model.prefs.trackerEnabled)
                    if model.prefs.trackerEnabled {
                        Toggle("Nudge before time runs out", isOn: $model.prefs.windowNudge)
                    }
                } header: {
                    Text("Tracker")
                } footer: {
                    Text("Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only on this phone." + (model.prefs.trackerEnabled ? " Nudge before time runs out sends one gentle alert about 30 minutes before a prayer's time ends, only if you haven't ticked it. Not for \(Prayer.isha.name(model.naming)), which stays open until \(Prayer.fajr.name(model.naming)). Never while paused." : ""))
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
                    Toggle("24-hour time", isOn: $model.prefs.use24Hour)
                    Stepper(value: $model.prefs.hijriAdjustment, in: -2...2) {
                        LabeledContent("Hijri date adjustment",
                                       value: model.prefs.hijriAdjustment == 0 ? "None" : String(format: "%+d day", model.prefs.hijriAdjustment))
                    }
                }

                Section {
                    Toggle("Prayer time alerts", isOn: Binding(
                        get: { model.prefs.notificationsEnabled },
                        set: { on in
                            Task {
                                if on { model.prefs.notificationsEnabled = await NotificationScheduler.requestPermission() }
                                else { model.prefs.notificationsEnabled = false }
                            }
                        }))
                    if model.prefs.notificationsEnabled && Azan.isAvailable {
                        Toggle("Play the azan", isOn: $model.prefs.azanSound)
                    }
                    Toggle("Reminder before prayer", isOn: Binding(
                        get: { model.prefs.reminderMinutesBefore > 0 },
                        set: { on in
                            Task {
                                if on {
                                    if await NotificationScheduler.requestPermission() {
                                        model.prefs.reminderMinutesBefore = Preferences.defaultReminderMinutes
                                    }
                                } else { model.prefs.reminderMinutesBefore = 0 }
                            }
                        }))
                    if model.prefs.reminderMinutesBefore > 0 {
                        Picker("Remind me", selection: $model.prefs.reminderMinutesBefore) {
                            ForEach(Preferences.reminderChoices, id: \.self) { Text("\($0) min before").tag($0) }
                        }
                    }
                    if model.prefs.notificationsEnabled || model.prefs.reminderMinutesBefore > 0 {
                        ForEach(Prayer.allCases) { prayer in
                            Toggle(prayer == .sunrise
                                   ? "\(prayer.name(model.naming)) (\(Prayer.fajr.name(model.naming)) ends)"
                                   : prayer.name(model.naming), isOn: Binding(
                                get: { model.prefs.notifyPrayers.contains(prayer) },
                                set: { on in
                                    if on { model.prefs.notifyPrayers.insert(prayer) }
                                    else { model.prefs.notifyPrayers.remove(prayer) }
                                }))
                        }
                    }
                } header: {
                    Text("Alerts")
                } footer: {
                    Text("Prayer time alerts ring at the exact time of each prayer you choose. Reminder before prayer gives you a heads-up a few minutes earlier (15 by default), so a meeting or work doesn't run past it - turn on either or both." + (Azan.isAvailable ? " With Play the azan on, prayer time alerts open with the azan (a Subuh azan at Subuh)." : "") + " Worked out on your phone and topped up every time you open the app - nothing comes from a server.")
                }

                Section {
                    Toggle("Buzz only, no sound", isOn: $model.prefs.buzzOnly)
                    Toggle("Quiet hours", isOn: $model.prefs.quietHours)
                    if model.prefs.quietHours {
                        Picker("From", selection: $model.prefs.quietFrom) {
                            ForEach(Self.halfHours, id: \.self) { Text(model.clock($0)).tag($0) }
                        }
                        Picker("Until", selection: $model.prefs.quietTo) {
                            ForEach(Self.halfHours, id: \.self) { Text(model.clock($0)).tag($0) }
                        }
                    }
                } header: {
                    Text("Quiet alerts")
                } footer: {
                    Text("For shift workers sleeping in the day, a baby asleep in the room, or simply a calm night. Alerts still come, but they only buzz. \(Prayer.fajr.name(model.naming)) keeps its sound so it can wake you.")
                }

                Section {
                    Picker("Remind me to leave", selection: Binding(
                        get: { model.prefs.jumuahReminderMinutes },
                        set: { minutes in
                            Task {
                                if minutes > 0, !(await NotificationScheduler.requestPermission()) { return }
                                model.prefs.jumuahReminderMinutes = minutes
                            }
                        })) {
                        ForEach(Preferences.jumuahReminderChoices, id: \.self) { Text($0 == 0 ? "Off" : "\($0) min before").tag($0) }
                    }
                } header: {
                    Text(Prayer.dhuhr.name(model.naming, isFriday: true))
                } footer: {
                    let friday = Prayer.dhuhr.name(model.naming, isFriday: true)
                    Text("A reminder on Fridays to get ready and leave in time. It uses your masjid's own \(friday) time when you have set one in the Masjid tab, otherwise the start of \(Prayer.dhuhr.name(model.naming)). \(friday) is not required of women, travellers or the sick, who pray \(Prayer.dhuhr.name(model.naming)) instead.")
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

                Section("Accuracy") {
                    Text("Every day shows its source grade: A official, B masjid-confirmed, C community-verified, D calculated. F (falak) marks a reading from your own shadow stick, which only checks the times. In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year (only the year, zone code or regency name is sent) and keeps it for offline use. Everywhere else, and before that download, times are calculated on your phone with the country's own method. That calculation is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia and Indonesia it is within about 2 minutes.")
                        .font(.footnote)
                }

                Section {
                    Label("No third-party ads, no accounts, no tracking across other apps.", systemImage: "hand.raised.fill")
                    Label("Your exact location never leaves your phone.", systemImage: "location.slash.fill")
                    Label("Nearby masjid search goes through Apple Maps and OpenStreetMap (only the area is sent).", systemImage: "map.fill")
                    Toggle("Share anonymous usage counts", isOn: $model.prefs.shareUsage)
                } header: {
                    Text("Privacy")
                } footer: {
                    Text("Usage counts tell us how many people use the app and in which city and country, so we know where to add official timetables. A random number stands in for you: no name, no exact location, no IP address kept.")
                }
                .font(.footnote)

                Section {
                    ForEach(MakersOffer.allCases) { offer in
                        MakersCard(offer: offer, placement: "settings")
                            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                    }
                    Toggle("Show offers on Prayer and Masjid", isOn: $model.prefs.showOffers)
                } header: {
                    Text("From the makers").id("makers")
                } footer: {
                    Text("Prayer Times Asia is free and built fisabilillah in Singapore by Ustaz Aarif Raziff and Nasar Digital (Nasar Pte Ltd). The only offers you will see are our own - no ad networks, nothing tracked.")
                }

                Section {
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
