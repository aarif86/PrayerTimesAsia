import AudioToolbox
import AVFoundation
import SwiftUI
import UserNotifications
#if canImport(AlarmKit)
import AlarmKit
#endif

/// The pages inside Alerts and alarms.
enum AlertsPage: Hashable {
    case prayer(Prayer)
    case friday
    case check
}

/// Alerts and alarms: one screen for every sound the app makes. Each prayer is
/// Off, Notify or Alarm, then the extras, then how it all sounds. Opened from
/// Settings, the alarm clock on the Prayer screen, and by holding a bell.
/// Same as web ui/WakeUp.tsx and Android WakeUp.kt.
/// "Allahumma barik li ummati fi bukuriha" (Abu Dawud, Tirmidhi).
struct WakeUpView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var path: [AlertsPage] = []

    var body: some View {
        NavigationStack(path: $path) {
            AlertsMainList(path: $path)
                .navigationTitle("Alerts and alarms")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
                .navigationDestination(for: AlertsPage.self) { page in
                    AlertsPageView(page: page)
                }
        }
        .onAppear {
            if let start = model.alertsStart { path = [start]; model.alertsStart = nil }
        }
        .onDisappear { AlarmPreview.stop() }
    }
}

/// One page, kept apart so the main list stays a small view.
private struct AlertsPageView: View {
    let page: AlertsPage
    var body: some View {
        switch page {
        case .prayer(let prayer): AnyView(PrayerAlertPage(prayer: prayer))
        case .friday: AnyView(FridayAlertPage())
        case .check: AnyView(CheckPhonePage())
        }
    }
}

/// Ask once for notifications (and alarms on iOS 26) the first time anything is on.
@MainActor
func askForAlerts() async {
    _ = await NotificationScheduler.requestPermission()
}

/// Off, Notify, Alarm in a row.
struct AlertModePicker: View {
    let name: String
    let modes: [AlertMode]
    let value: AlertMode
    let pick: (AlertMode) -> Void

    var body: some View {
        Picker(name, selection: Binding(get: { value }, set: { pick($0) })) {
            ForEach(modes) { Text($0.word).tag($0) }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .fixedSize()
        .accessibilityLabel(name)
    }
}

/// Changes one prayer, asking for permission or stopping a ringing alarm as needed.
@MainActor
func applyAlertMode(_ mode: AlertMode, _ prayer: Prayer, model: AppModel) {
    withAnimation { model.prefs.setAlertMode(mode, prayer) }
    Task {
        if mode == .off { await WakeUpAlarm.stopRinging() } else { await askForAlerts() }
    }
}

@MainActor
func applyFridayMode(_ mode: AlertMode, model: AppModel) {
    withAnimation { model.prefs.setFridayMode(mode) }
    Task {
        if mode == .off { await WakeUpAlarm.stopRinging() } else { await askForAlerts() }
    }
}

/// When a prayer's alert next comes: the alarm's own time, or the prayer's start for Notify.
@MainActor
func alertNextDate(_ prayer: Prayer, model: AppModel) -> Date? {
    let p = model.prefs
    switch p.alertMode(prayer) {
    case .off: return nil
    case .notify: return model.nextDate { $0.time(prayer) }
    case .alarm:
        if prayer == .fajr { return p.wakeUp.flatMap { w in model.nextDate { w.date(in: $0) } } }
        guard let timing = p.alarm(for: prayer) else { return nil }
        return model.nextDate { timing.date(start: $0.time(prayer), end: PrayerAlarmTiming.end(of: prayer, in: $0)) }
    }
}

/// The bar under a prayer that is on: "Alarm 6:20 AM" in bold, then what it is.
@MainActor
func alertChipWords(_ prayer: Prayer, model: AppModel) -> (lead: String, rest: String) {
    let p = model.prefs
    let at = alertNextDate(prayer, model: model).map { " " + model.formatted($0) } ?? ""
    switch p.alertMode(prayer) {
    case .off: return ("Off", "")
    case .notify:
        if prayer == .sunrise { return ("Notification\(at)", "when \(Prayer.fajr.name(model.naming)) ends") }
        var parts: [String] = []
        if Azan.isAvailable && p.azanSound { parts.append("with the azan") }
        if p.reminderMinutesBefore > 0 { parts.append("early reminder \(p.reminderMinutesBefore) min before") }
        return ("Notification\(at)", parts.isEmpty ? "when it begins" : parts.joined(separator: ", "))
    case .alarm:
        let label = prayer == .fajr ? (p.wakeUp?.label(model.naming) ?? "") : (p.alarm(for: prayer)?.label ?? "")
        var rest = label.prefix(1).lowercased() + label.dropFirst()
        if p.notifies(prayer) && !p.alarmAtStart(prayer) { rest += ", notification at the time" }
        return ("Alarm\(at)", rest)
    }
}

// MARK: - The main list

private struct AlertsMainList: View {
    @Environment(AppModel.self) private var model
    @Binding var path: [AlertsPage]
    /// A prayer just switched to Alarm here: a short line says when it rings, with Change time.
    @State private var justSet: Prayer?

    var body: some View {
        Form {
            CheckCardSection(path: $path)
            EachPrayerSection(path: $path, justSet: $justSet)
            NextAlarmSection()
            ExtrasSection()
            SoundSection()
            AlarmSoundSection()
            WakeHadithSection()
        }
        .safeAreaInset(edge: .bottom) {
            if let prayer = justSet, let at = alertNextDate(prayer, model: model) {
                HStack(spacing: 10) {
                    Image(systemName: "alarm.fill").foregroundStyle(Theme.sunArc)
                    Text("\(prayer.name(model.naming)) alarm set for \(model.formatted(at))")
                        .font(.subheadline.weight(.semibold))
                    Spacer(minLength: 4)
                    Button("Change time") { justSet = nil; path.append(.prayer(prayer)) }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Theme.sunArc)
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 16).padding(.bottom, 8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: prayer) {
                    try? await Task.sleep(for: .seconds(6))
                    withAnimation { justSet = nil }
                }
            }
        }
    }
}

private struct CheckCardSection: View {
    @Binding var path: [AlertsPage]
    var body: some View {
        Section {
            Button { path.append(.check) } label: {
                VStack(alignment: .leading, spacing: 6) {
                    Label("On silent or in a Focus, only alarms ring", systemImage: "bell.badge")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text("Notifications stay quiet then. Set a prayer to Alarm if you need to hear it.")
                        .font(.footnote).foregroundStyle(.secondary)
                    Text("Check my phone")
                        .font(.footnote.weight(.bold))
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().fill(Theme.sunArc))
                        .foregroundStyle(.black)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}

private struct EachPrayerSection: View {
    @Environment(AppModel.self) private var model
    @Binding var path: [AlertsPage]
    @Binding var justSet: Prayer?

    var body: some View {
        let friday = Prayer.dhuhr.name(model.naming, isFriday: true)
        Section {
            Button {
                model.prefs.notifyAllFive()
                Task { await askForAlerts() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: model.prefs.allFiveNotify ? "checkmark.circle.fill" : "bell.badge.fill")
                        .foregroundStyle(Theme.sunArc)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(model.prefs.allFiveNotify ? "All 5 prayers on" : "Notify me for all 5 prayers")
                            .font(.headline).foregroundStyle(.primary)
                        Text("Anything already on Alarm stays on Alarm.").font(.footnote).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(model.prefs.allFiveNotify)
            ForEach(Prayer.allCases) { prayer in
                let mode = model.prefs.alertMode(prayer)
                let chip = alertChipWords(prayer, model: model)
                row(name: prayer.name(model.naming), mode: mode, lead: chip.lead, rest: chip.rest,
                    modes: AlertMode.modes(for: prayer),
                    open: { path.append(.prayer(prayer)) },
                    pick: { new in
                        let was = model.prefs.alertMode(prayer)
                        applyAlertMode(new, prayer, model: model)
                        withAnimation { justSet = (new == .alarm && was != .alarm) ? prayer : nil }
                    })
            }
            let fridayMode = model.prefs.fridayMode
            row(name: "\(friday), leave for the masjid", mode: fridayMode,
                lead: fridayMode == .off ? "Off" : (fridayMode == .alarm ? "Alarm" : "Notification"),
                rest: "\(JumuahLeave.label(model.prefs.jumuahReminderMinutes).lowercased()) it starts",
                modes: AlertMode.allCases,
                open: { path.append(.friday) },
                pick: { applyFridayMode($0, model: model) })
            HeadsUpPicker()
        } header: {
            Text("Each prayer")
        } footer: {
            Text("Pick Off, Notify or Alarm. Tap Change to choose the exact time. Notify is a notification, quiet when your phone is on silent or in a Focus. Alarm rings until you stop it, even on silent.")
        }
    }

    private func row(name: String, mode: AlertMode, lead: String, rest: String, modes: [AlertMode],
                     open: @escaping () -> Void, pick: @escaping (AlertMode) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).foregroundStyle(.primary)
                    if mode == .off { Text("Off").font(.footnote).foregroundStyle(.secondary) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                AlertModePicker(name: name, modes: modes, value: mode, pick: pick)
            }
            if mode != .off {
                Button(action: open) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Image(systemName: mode.symbol)
                            .foregroundStyle(mode == .alarm ? Theme.sunArc : Color.primary)
                            .font(.footnote)
                        (Text(lead).fontWeight(.semibold) + Text(rest.isEmpty ? "" : ", \(rest)"))
                            .font(.footnote)
                            .foregroundStyle(.primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("Change")
                            .font(.footnote.weight(.bold))
                            .foregroundStyle(Theme.sunArc)
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Theme.sunArc)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.15)))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(name), \(lead), \(rest)")
                .accessibilityHint("Change the time")
            }
        }
        .padding(.vertical, 2)
    }
}

/// "Heads up before": one time for every prayer set to Notify.
private struct HeadsUpPicker: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        Picker(selection: Binding(
            get: { model.prefs.reminderMinutesBefore },
            set: { minutes in
                model.prefs.reminderMinutesBefore = minutes
                if minutes > 0 { Task { await askForAlerts() } }
            })) {
            Text("Off").tag(0)
            ForEach(Preferences.reminderChoices, id: \.self) { Text("\($0) min before").tag($0) }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text("Early reminder")
                Text("An extra notification this many minutes before each prayer set to Notify").font(.footnote).foregroundStyle(.secondary)
            }
        }
        .pickerStyle(.menu)
    }
}

private struct NextAlarmSection: View {
    @Environment(AppModel.self) private var model
    /// A prayer alarm is ringing or snoozed right now (checked every few seconds).
    @State private var ringing = false

    var body: some View {
        Section {
            if ringing {
                Button {
                    Task {
                        await WakeUpAlarm.stopRinging()
                        ringing = WakeUpAlarm.isRingingOrSnoozed
                    }
                } label: {
                    Label("Stop the snoozed alarm", systemImage: "stop.circle.fill")
                        .font(.body.weight(.semibold))
                }
            }
            if let next = model.nextWakeUp(after: .now) {
                LabeledContent("Next alarm", value: nextText(next))
            } else {
                Text("No alarms are on").foregroundStyle(.secondary)
            }
            if model.prefs.anyAlarm {
                Button(role: .destructive) { turnOffAll() } label: {
                    Label("Turn off all alarms", systemImage: "alarm.waves.left.and.right")
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        } footer: {
            Text(alarmNote)
        }
        .task {
            while !Task.isCancelled {
                ringing = WakeUpAlarm.isRingingOrSnoozed
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    private var alarmNote: String {
        if #available(iOS 26.0, *) {
            return "An alarm rings even in Silent mode and Focus, like the Clock app. Tap Stop to end it. Snooze 5 min rings it once more in 5 minutes."
        }
        return "On this iPhone an alarm comes as a notification. From iOS 26 it rings like a real alarm, even in Silent mode."
    }

    private func nextText(_ w: AppModel.WakeUp) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = model.timeZone
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEEE"
        let when = cal.isDateInToday(w.date) ? "Today" : cal.isDateInTomorrow(w.date) ? "Tomorrow" : f.string(from: w.date)
        let what = w.isSahur ? " for sahur" : w.prayer.map { " for \($0.name(model.naming, isFriday: model.isFriday(w.date)))" } ?? ""
        return "\(when) \(model.formatted(w.date))\(what)"
    }

    /// Every alarm Off, and anything ringing or snoozed stops now.
    private func turnOffAll() {
        withAnimation {
            model.prefs.wakeUp = nil
            model.prefs.sahurAlarm = nil
            for prayer in PrayerAlarmTiming.prayers { model.prefs.setAlarm(nil, for: prayer) }
            model.prefs.jumuahLeaveAlarm = false
        }
        Task {
            await WakeUpAlarm.stopRinging()
            ringing = WakeUpAlarm.isRingingOrSnoozed
        }
    }
}

private struct ExtrasSection: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Section {
            Toggle(isOn: Binding(
                get: { model.prefs.sahurAlarm != nil },
                set: { setSahur($0 ? SahurTiming.allCases.first : nil) })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sahur alarm")
                    Text("An alarm before \(Prayer.fajr.name(model.naming)) so you can eat before you fast. You choose the time and the days. Rings even on silent.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            if model.prefs.sahurAlarm != nil {
                ForEach(SahurTiming.allCases) { timing in
                    AlarmChoiceRow(title: timing.label(model.naming), detail: model.nextTime(timing.date), selected: model.prefs.sahurAlarm == timing) {
                        setSahur(timing)
                    }
                }
            }
        } header: {
            Text("Fasting")
        }
        if model.prefs.sahurAlarm != nil {
            Section {
                ForEach(SahurDay.allCases) { day in
                    Toggle(day.label, isOn: Binding(
                        get: { model.prefs.sahurDays.contains(day) },
                        set: { on in
                            if on { model.prefs.sahurDays.insert(day) } else { model.prefs.sahurDays.remove(day) }
                            if model.prefs.sahurDays.isEmpty { model.prefs.sahurDays = [.everyDay] }
                        }))
                    .disabled(day != .everyDay && model.prefs.sahurDays.contains(.everyDay))
                }
            } header: {
                Text("Sahur alarm rings on")
            } footer: {
                Text("Ramadan and the white days follow the Hijri date in the app. Please follow your local religious authority for the start of Ramadan.")
            }
        }
        let maghrib = Prayer.maghrib.name(model.naming)
        Section {
            ramadanSwitch("Imsak reminder", "A notification 10 minutes before Imsak, so you finish eating in time.\(about { model.imsak($0).addingTimeInterval(-600) })", \.imsakAlert)
            ramadanSwitch("Iftar reminder", "A notification at \(maghrib) when it is time to break your fast.\(about { $0.time(.maghrib) })", \.berbukaAlert)
            ramadanSwitch("Qiyam reminder, last ten nights",
                          "On the last ten nights of Ramadan, a notification when the last third of the night begins, the best time for qiyam.\(model.nextLastThird().map { " About \(model.formatted($0)) here." } ?? "")",
                          \.qiyamAlert)
        } header: {
            Text("Ramadan only")
        } footer: {
            Text("These are notifications, so they stay quiet on silent. Ramadan follows the date in the app. Please follow your local religious authority.")
        }
        if model.prefs.trackerEnabled {
            Section {
                Toggle(isOn: Binding(get: { model.prefs.windowNudge }, set: { model.prefs.windowNudge = $0 })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Nudge before time runs out")
                        Text("A notification about 30 minutes before a prayer's time ends, only if you have not ticked it in your tracker").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    /// " About 5:23 AM here." when the app knows the time.
    private func about(_ date: (PrayerDay) -> Date) -> String {
        model.nextTime(date).map { " About \($0) here." } ?? ""
    }

    private func ramadanSwitch(_ title: String, _ detail: String, _ key: WritableKeyPath<Preferences, Bool>) -> some View {
        Toggle(isOn: Binding(
            get: { model.prefs[keyPath: key] },
            set: { on in
                model.prefs[keyPath: key] = on
                if on { Task { await askForAlerts() } }
            })) {
            VStack(alignment: .leading, spacing: 2) { Text(title); Text(detail).font(.footnote).foregroundStyle(.secondary) }
        }
    }

    private func setSahur(_ timing: SahurTiming?) {
        Task {
            if timing != nil { await askForAlerts() } else { await WakeUpAlarm.stopRinging() }
            withAnimation { model.prefs.sahurAlarm = timing }
        }
    }
}

private struct SoundSection: View {
    @Environment(AppModel.self) private var model
    /// Every half hour of the day, in minutes past midnight.
    private static let halfHours = Array(stride(from: 0, to: 1440, by: 30))

    var body: some View {
        Section {
            if Azan.isAvailable {
                Toggle(isOn: Binding(get: { model.prefs.azanSound }, set: { model.prefs.azanSound = $0 })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Play the azan")
                        Text("Prayer notifications play the azan instead of a short tone").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            Toggle(isOn: Binding(get: { model.prefs.buzzOnly }, set: { model.prefs.buzzOnly = $0 })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Buzz only")
                    Text("Notifications vibrate without sound, all day. Alarms still ring.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: Binding(get: { model.prefs.quietHours }, set: { model.prefs.quietHours = $0 })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Quiet hours")
                    Text("Between the times you pick, notifications only vibrate. \(Prayer.fajr.name(model.naming)) and alarms keep their sound.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            if model.prefs.quietHours {
                Picker("From", selection: Binding(get: { model.prefs.quietFrom }, set: { model.prefs.quietFrom = $0 })) {
                    ForEach(Self.halfHours, id: \.self) { Text(model.clock($0)).tag($0) }
                }
                Picker("Until", selection: Binding(get: { model.prefs.quietTo }, set: { model.prefs.quietTo = $0 })) {
                    ForEach(Self.halfHours, id: \.self) { Text(model.clock($0)).tag($0) }
                }
            }
        } header: {
            Text("Sound")
        } footer: {
            Text("Buzz only and Quiet hours are for shift workers sleeping in the day, a baby asleep in the room, or a calm night. Notifications only buzz then. Alarms keep their sound.")
        }
    }
}

private struct AlarmSoundSection: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        Section {
            ForEach(AlarmSound.choices) { sound in
                let on = (model.prefs.alarmSound == .phone ? .classic : model.prefs.alarmSound) == sound
                Button {
                    model.prefs.alarmSound = sound
                    AlarmPreview.play(sound)
                } label: {
                    HStack {
                        Image(systemName: "play.circle").foregroundStyle(.secondary)
                        Text(sound.label).foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "checkmark").font(.body.weight(.semibold))
                            .foregroundStyle(Theme.sunArc)
                            .opacity(on ? 1 : 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Plays the sound")
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        } header: {
            Text("Alarm sound")
        } footer: {
            Text("Tap a sound to hear it. Every alarm plays this sound. Classic is your iPhone's own alarm.")
        }
    }
}

private struct WakeHadithSection: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text("اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا")
                    .font(.title3)
                    .multilineTextAlignment(.trailing)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text("“O Allah, bless my ummah in their early mornings.”")
                    .font(.body.italic())
                Text("The Prophet ﷺ, narrated by Abu Dawud and Tirmidhi")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            if model.prefs.sahurAlarm != nil {
                HadithView(id: .monThu, style: .line).hadithRow()
                HadithView(id: .whiteDays, style: .line).hadithRow()
            }
        }
    }
}

/// A choice with a tick, and the time it would next ring.
struct AlarmChoiceRow: View {
    let title: String
    var detail: String? = nil
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title).foregroundStyle(.primary)
                Spacer()
                if let detail { Text(detail).foregroundStyle(.secondary).monospacedDigit() }
                Image(systemName: "checkmark").font(.body.weight(.semibold))
                    .foregroundStyle(Theme.accentText)
                    .opacity(selected ? 1 : 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// The big Off, Notify, Alarm cards on a prayer's page.
private struct ModeCards: View {
    let modes: [AlertMode]
    let value: AlertMode
    var alarmHelp: String? = nil
    let pick: (AlertMode) -> Void

    var body: some View {
        ForEach(modes) { mode in
            Button { pick(mode) } label: {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: mode.symbol)
                        .frame(width: 22)
                        .foregroundStyle(mode == .alarm ? Theme.sunArc : Color.primary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(mode.word).font(.body.weight(.semibold)).foregroundStyle(.primary)
                        Text(mode == .alarm ? (alarmHelp ?? mode.help) : mode.help)
                            .font(.footnote).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.sunArc)
                        .opacity(value == mode ? 1 : 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(value == mode ? .isSelected : [])
        }
    }
}

// MARK: - One prayer's page

private struct PrayerAlertPage: View {
    @Environment(AppModel.self) private var model
    let prayer: Prayer

    var body: some View {
        let name = prayer.name(model.naming)
        let p = model.prefs
        let mode = p.alertMode(prayer)
        Form {
            if mode != .off, let at = alertNextDate(prayer, model: model) {
                Section {
                    HStack(spacing: 14) {
                        Image(systemName: mode.symbol)
                            .font(.title)
                            .foregroundStyle(mode == .alarm ? Theme.sunArc : Color.primary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(model.formatted(at)).font(.title.weight(.semibold)).monospacedDigit()
                            Text("Your \(name) \(mode == .alarm ? "alarm rings" : "notification comes") \(dayWord(at)) at this time")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                }
            }
            Section {
                ModeCards(modes: AlertMode.modes(for: prayer), value: mode,
                          alarmHelp: prayer == .fajr ? "Rings like the Clock app, even on silent, every morning. It follows \(name) wherever you are. Snooze 5 min." : nil) {
                    applyAlertMode($0, prayer, model: model)
                }
            } header: {
                Text("How should \(name) reach you?")
            }
            if mode == .alarm && prayer == .fajr {
                Section {
                    ForEach(WakeUpTiming.allCases) { timing in
                        AlarmChoiceRow(title: timing.label(model.naming), detail: model.nextTime(timing.date), selected: p.wakeUp == timing) {
                            withAnimation { model.prefs.wakeUp = timing }
                        }
                    }
                } header: {
                    Text("When should the alarm ring?")
                } footer: {
                    Text("The time moves a little each day with \(name).")
                }
            }
            if mode == .alarm && PrayerAlarmTiming.prayers.contains(prayer) {
                Section("When should the alarm ring?") {
                    ForEach(PrayerAlarmTiming.choices(for: prayer)) { timing in
                        AlarmChoiceRow(title: timing.label,
                                       detail: model.nextTime({ timing.date(start: $0.time(prayer), end: PrayerAlarmTiming.end(of: prayer, in: $0)) }),
                                       selected: p.alarm(for: prayer) == timing) {
                            withAnimation { model.prefs.setAlarm(timing, for: prayer) }
                        }
                    }
                }
            }
            if mode == .alarm && !p.alarmAtStart(prayer) {
                Section {
                    Toggle(isOn: Binding(get: { model.prefs.notifies(prayer) }, set: { on in model.prefs.setNotify(on, prayer) })) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Notification too")
                            Text("A notification when \(name) begins, as well as the alarm").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            if mode == .notify && prayer != .sunrise {
                Section {
                    HeadsUpPicker()
                } footer: {
                    Text("The same for every prayer set to Notify.")
                }
            }
            if prayer == .fajr && p.wakeUp == .fajrMinus30 {
                Section { HadithView(id: .nightPrayer, style: .line).hadithRow() }
            }
        }
        .navigationTitle(name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func dayWord(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = model.timeZone
        return cal.isDateInToday(date) ? "today" : "tomorrow"
    }
}

// MARK: - Friday

private struct FridayAlertPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let friday = Prayer.dhuhr.name(model.naming, isFriday: true)
        Form {
            Section {
                ModeCards(modes: AlertMode.allCases, value: model.prefs.fridayMode) {
                    applyFridayMode($0, model: model)
                }
            } header: {
                Text("How should the reminder reach you?")
            }
            JumuahLeaveSection()
        }
        .navigationTitle("Leave for \(friday)")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Check my phone

/// What this iPhone allows, read from its own settings, with a way to fix each one.
private struct CheckPhonePage: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var notifications: UNAuthorizationStatus = .notDetermined
    @State private var timeSensitive: UNNotificationSetting = .notSupported
    @State private var alarms: AlarmAccess = .unknown

    enum AlarmAccess { case unknown, allowed, denied, notAsked, oldIOS }

    var body: some View {
        let friday = Prayer.dhuhr.name(model.naming, isFriday: true)
        let notifyCount = Prayer.obligatory.filter { model.prefs.alertMode($0) == .notify }.count
        Form {
            Section {
                switch notifications {
                case .authorized, .provisional, .ephemeral:
                    CheckRow(ok: true, title: "Notifications allowed")
                case .denied:
                    CheckRow(ok: false, title: "Notifications are turned off", detail: "Turn them on in Settings, Notifications, Prayer Times Asia.",
                             button: "Open Settings") { openSettings() }
                default:
                    CheckRow(ok: false, title: "Notifications not allowed yet", button: "Allow notifications") {
                        Task { await askForAlerts(); await refresh() }
                    }
                }
                switch alarms {
                case .allowed:
                    CheckRow(ok: true, title: "Alarms allowed", detail: "Your alarms ring even on silent and in a Focus.")
                case .denied:
                    CheckRow(ok: false, title: "Alarms are turned off", detail: "Without them, alarms come as quiet notifications.",
                             button: "Open Settings") { openSettings() }
                case .notAsked:
                    CheckRow(ok: false, title: "Alarms not allowed yet", button: "Allow alarms") {
                        Task { await requestAlarms(); await refresh() }
                    }
                case .oldIOS:
                    CheckRow(ok: false, title: "Alarms come as notifications on this iPhone", detail: "From iOS 26 they ring like the Clock app, even on silent.")
                case .unknown:
                    EmptyView()
                }
                if timeSensitive == .enabled {
                    CheckRow(ok: true, title: "Time Sensitive is on", detail: "Notifications come through a Focus.")
                } else {
                    CheckRow(ok: false, title: "A Focus can hold notifications back",
                             detail: "In Settings, Focus, pick each Focus you use (Work, Sleep) and add Prayer Times Asia under Apps. Alarms always come through.",
                             button: "Open Settings") { openSettings() }
                }
                CheckRow(ok: false, title: "The silent switch mutes notifications",
                         detail: "No app can sound a notification on silent. Alarms still ring. If you need to hear a prayer, set it to Alarm.")
                if model.prefs.fridayMode == .notify {
                    CheckRow(ok: false, title: "\(friday) reminder is a notification", detail: "Make it an alarm so it rings through silent and Focus.",
                             button: "Make it an alarm") { applyFridayMode(.alarm, model: model) }
                }
                if notifyCount > 0 {
                    CheckRow(ok: true, title: notifyCount == 1 ? "1 prayer is set to Notify" : "\(notifyCount) prayers are set to Notify",
                             detail: "They stay quiet on silent. Change any of them to Alarm on the list.")
                }
            }
        }
        .navigationTitle("Make sure you hear it")
        .navigationBarTitleDisplayMode(.inline)
        .task { await refresh() }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
    }

    private func refresh() async {
        let s = await UNUserNotificationCenter.current().notificationSettings()
        notifications = s.authorizationStatus
        timeSensitive = s.timeSensitiveSetting
        alarms = currentAlarmAccess()
    }

    private func currentAlarmAccess() -> AlarmAccess {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            switch AlarmManager.shared.authorizationState {
            case .authorized: return .allowed
            case .denied: return .denied
            case .notDetermined: return .notAsked
            @unknown default: return .unknown
            }
        }
        #endif
        return .oldIOS
    }

    private func requestAlarms() async {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            _ = try? await AlarmManager.shared.requestAuthorization()
        }
        #endif
    }
}

private struct CheckRow: View {
    let ok: Bool
    let title: String
    var detail: String? = nil
    var button: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: ok ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundStyle(ok ? Color.green : Color.orange)
                .font(.title3)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.body.weight(.semibold))
                if let detail { Text(detail).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) }
                if let button, let action {
                    Button(button, action: action)
                        .buttonStyle(.bordered)
                        .font(.footnote.weight(.semibold))
                        .padding(.top, 2)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - The bell on the Prayer screen

/// Tap a bell: Off, then Notify, then Alarm, then Off again.
@MainActor
func cycleAlert(_ prayer: Prayer, model: AppModel) {
    applyAlertMode(model.prefs.nextAlertMode(prayer), prayer, model: model)
}

/// Hold a bell (or tap a prayer on the dial): pick Off, Notify or Alarm, or open its page.
struct AlertMenuItems: View {
    @Environment(AppModel.self) private var model
    let prayer: Prayer

    var body: some View {
        let mode = model.prefs.alertMode(prayer)
        ForEach(AlertMode.modes(for: prayer)) { m in
            Button { applyAlertMode(m, prayer, model: model) } label: {
                Label(m == mode ? "\(m.word), on now" : m.word, systemImage: m.symbol)
            }
        }
        Button { model.openAlerts(.prayer(prayer)) } label: {
            Label("\(prayer.name(model.naming)) in Alerts and alarms", systemImage: "slider.horizontal.3")
        }
    }
}

/// A few seconds of an alarm sound, heard when a sound is tapped.
enum AlarmPreview {
    private static var player: AVAudioPlayer?

    static func play(_ sound: AlarmSound) {
        stop()
        guard let file = sound.fileName,
              let url = Bundle.main.url(forResource: (file as NSString).deletingPathExtension, withExtension: "caf") else {
            // Classic is the iPhone's own alarm, which apps can't play; a short system alert stands in.
            AudioServicesPlayAlertSound(SystemSoundID(1005))
            return
        }
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        player = try? AVAudioPlayer(contentsOf: url)
        player?.play()
        let current = player
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            if player === current { stop() }
        }
    }

    static func stop() {
        player?.stop()
        player = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
