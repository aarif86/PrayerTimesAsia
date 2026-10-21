import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section("Location") {
                    Button { showPlaces = true } label: {
                        LabeledContent("Place", value: model.activePlace?.name ?? "Not set")
                    }
                    LabeledContent("Country rules", value: model.profile.code.isEmpty ? "Outside Asia" : "\(model.profile.flag) \(model.profile.name)")
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
                    Picker("Prayer names", selection: $model.prefs.namingOverride) {
                        Text("Automatic").tag(NamingStyle?.none)
                        ForEach(NamingStyle.allCases) { Text($0.label).tag(NamingStyle?.some($0)) }
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
                } header: {
                    Text("Calculation")
                } footer: {
                    Text("Automatic follows the country you're in, so landing in a new country switches it for you. \(model.method.note)")
                }

                Section {
                    Picker("Subuh wake-up", selection: Binding(
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
                    Text("A real alarm that rings even in Silent mode (iOS 26 and later; earlier versions get a notification). Moves with Subuh every day and wherever you travel.")
                }

                Section {
                    Toggle("Prayer tracker", isOn: $model.prefs.trackerEnabled)
                } header: {
                    Text("Tracker")
                } footer: {
                    Text("Tick prayers off on the Today screen and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only on this phone.")
                }

                Section {
                    Toggle("Live countdown", isOn: $model.prefs.liveActivityEnabled)
                } header: {
                    Text("Lock Screen")
                } footer: {
                    Text("Shows a countdown to the next prayer on the Lock Screen and in the Dynamic Island. Add widgets from your Home Screen: touch and hold, then tap Edit.")
                }

                Section("Display") {
                    Toggle("24-hour time", isOn: $model.prefs.use24Hour)
                    Stepper(value: $model.prefs.hijriAdjustment, in: -2...2) {
                        LabeledContent("Hijri date adjustment",
                                       value: model.prefs.hijriAdjustment == 0 ? "None" : String(format: "%+d day", model.prefs.hijriAdjustment))
                    }
                }

                Section {
                    Toggle("Prayer reminders", isOn: Binding(
                        get: { model.prefs.notificationsEnabled },
                        set: { on in
                            Task {
                                if on { model.prefs.notificationsEnabled = await NotificationScheduler.requestPermission() }
                                else { model.prefs.notificationsEnabled = false }
                            }
                        }))
                    if model.prefs.notificationsEnabled {
                        ForEach(Prayer.obligatory) { prayer in
                            Toggle(prayer.name(model.naming), isOn: Binding(
                                get: { model.prefs.notifyPrayers.contains(prayer) },
                                set: { on in
                                    if on { model.prefs.notifyPrayers.insert(prayer) }
                                    else { model.prefs.notifyPrayers.remove(prayer) }
                                }))
                        }
                        Picker("Remind me", selection: $model.prefs.reminderMinutesBefore) {
                            Text("At prayer time").tag(0)
                            Text("5 min before").tag(5)
                            Text("10 min before").tag(10)
                            Text("15 min before").tag(15)
                        }
                    }
                } header: {
                    Text("Reminders")
                } footer: {
                    Text("Reminders are scheduled on your phone for the next 12 days and refresh each time you open the app.")
                }

                Section("Accuracy") {
                    Text("In Singapore and Malaysia the app downloads the official MUIS or JAKIM timetable for the year (only the year or zone code is sent) and keeps it for offline use. Everywhere else, and before that download, times are calculated on your phone with the country's own method. That calculation was checked against every day of the 2026 MUIS and JAKIM timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia it is within about 2 minutes.")
                        .font(.footnote)
                }

                Section("Privacy") {
                    Label("No ads, no accounts, no tracking.", systemImage: "hand.raised.fill")
                    Label("Your location never leaves your phone.", systemImage: "location.slash.fill")
                    Label("Nearby masjid search goes through Apple Maps.", systemImage: "map.fill")
                }
                .font(.footnote)

                Section {
                    LabeledContent("Version", value: Bundle.main.appVersion)
                } footer: {
                    Text("Prayer Times Asia - made for Muslims living and travelling across Asia.")
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showPlaces) { PlacesView() }
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
