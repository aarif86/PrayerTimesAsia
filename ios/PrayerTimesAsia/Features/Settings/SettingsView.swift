import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false
    @Environment(\.dismiss) private var dismiss
    /// A main tab (no Done button) rather than a sheet.
    var isTab = false

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ScrollViewReader { proxy in
            Form {
                Section("Location") {
                    Button { showPlaces = true } label: {
                        LabeledContent("Place", value: model.activePlace?.name ?? "Not set")
                    }
                    LabeledContent("Country rules", value: model.profile.code.isEmpty ? "Outside Asia" : "\(model.profile.flag) \(model.profile.name)")
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
                } header: {
                    Text("Calculation")
                } footer: {
                    Text("Automatic follows the country you're in, so landing in a new country switches it for you. \(model.method.note)")
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
                    Picker("\(Prayer.fajr.name(model.naming)) wake-up", selection: Binding(
                        get: { model.prefs.wakeUp },
                        set: { timing in
                            Task {
                                if timing != nil { _ = await NotificationScheduler.requestPermission() }
                                model.prefs.wakeUp = timing
                            }
                        })) {
                        Text("Off").tag(WakeUpTiming?.none)
                        ForEach(WakeUpTiming.allCases) { Text($0.label(model.naming)).tag(WakeUpTiming?.some($0)) }
                    }
                } header: {
                    Text("Wake-up")
                } footer: {
                    Text("A real alarm that rings even in Silent mode (iOS 26 and later; earlier versions get a notification). Moves with \(Prayer.fajr.name(model.naming)) every day and wherever you travel.")
                }

                Section {
                    Toggle("Prayer tracker", isOn: $model.prefs.trackerEnabled)
                } header: {
                    Text("Tracker")
                } footer: {
                    Text("Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only on this phone.")
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
                    if model.prefs.notificationsEnabled {
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
                        Picker("Early reminder", selection: $model.prefs.reminderMinutesBefore) {
                            Text("Off").tag(0)
                            Text("5 min before").tag(5)
                            Text("10 min before").tag(10)
                            Text("15 min before").tag(15)
                        }
                    }
                } header: {
                    Text("Alerts")
                } footer: {
                    Text("An alert at the exact time of each prayer you choose, plus an early reminder if you like. Worked out on your phone and topped up every time you open the app - nothing comes from a server.")
                }

                Section("Accuracy") {
                    Text("Every day shows its source grade: A official, B masjid-confirmed, C community-verified, D calculated. F (falak) marks a reading from your own shadow stick, which only checks the times. In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year (only the year, zone code or regency name is sent) and keeps it for offline use. Everywhere else, and before that download, times are calculated on your phone with the country's own method. That calculation is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia and Indonesia it is within about 2 minutes.")
                        .font(.footnote)
                }

                Section {
                    Label("No third-party ads, no accounts, no tracking across other apps.", systemImage: "hand.raised.fill")
                    Label("Your exact location never leaves your phone.", systemImage: "location.slash.fill")
                    Label("Nearby masjid search goes through Apple Maps.", systemImage: "map.fill")
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
                    Text("Prayer Times Asia is free and built fisabilillah by Nasar Pte Ltd. The only offers you will see are our own - no ad networks, nothing tracked.")
                }

                Section {
                    NavigationLink("Sources & credits") { CreditsView() }
                    Link("Help verify times where you are", destination: URL(string: "https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md")!)
                    LabeledContent("Version", value: Bundle.main.appVersion)
                } footer: {
                    Text("Prayer Times Asia - made for Muslims living and travelling across Asia.")
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
