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
                } header: {
                    Text("Calculation")
                } footer: {
                    Text("Automatic follows the country you're in, so landing in a new country switches it for you. \(model.method.note)")
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
                    Text("Times are calculated on your phone from the sun's position, using each country's method. For Singapore (MUIS) and Malaysia (JAKIM) they were checked against the official timetables: within one minute, always on the safe side.")
                        .font(.footnote)
                }

                Section("Privacy") {
                    Label("No ads, no accounts, no tracking.", systemImage: "hand.raised.fill")
                    Label("Your location never leaves your phone.", systemImage: "location.slash.fill")
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

extension Bundle {
    var appVersion: String {
        let v = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}
