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
    case all
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
                .navigationTitle(W("settings.alertsAlarms"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } }
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
        case .all: AnyView(AllFivePage())
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
    case .off: return (W("common.off"), "")
    case .notify:
        if prayer == .sunrise { return (W("alerts.chipNotify", ["time": at]), W("alerts.whenEnds", ["name": Prayer.fajr.name(model.naming)])) }
        var parts: [String] = []
        if Azan.isAvailable && p.azanSound { parts.append(W("alerts.withAzan")) }
        if p.reminderMinutesBefore > 0 { parts.append(W("alerts.earlyN", ["n": p.reminderMinutesBefore])) }
        return (W("alerts.chipNotify", ["time": at]), parts.isEmpty ? W("alerts.whenBegins") : parts.joined(separator: ", "))
    case .alarm:
        let label = prayer == .fajr ? (p.wakeUp?.label(model.naming) ?? "") : (p.alarm(for: prayer)?.label ?? "")
        var rest = label.prefix(1).lowercased() + label.dropFirst()
        if p.notifies(prayer) && !p.alarmAtStart(prayer) { rest += W("alerts.notifAtTime") }
        return (W("alerts.alarmWhen", ["when": at]), rest)
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
            TestAlertSection()
            EachPrayerSection(path: $path, justSet: $justSet)
            AwayReminderSection()
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
                    Text(W("alerts.alarmSet", ["name": prayer.name(model.naming), "time": model.formatted(at)]))
                        .font(.subheadline.weight(.semibold))
                    Spacer(minLength: 4)
                    Button(W("alerts.changeTime")) { justSet = nil; path.append(.prayer(prayer)) }
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
                    Label(W("phone.alerts.silentFocus"), systemImage: "bell.badge")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(W("phone.alerts.silentSub"))
                        .font(.footnote).foregroundStyle(.secondary)
                    Text(W("alerts.checkPhone"))
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

/// "Check that it works": one tap sends a sample alert about 3 seconds later.
private struct TestAlertSection: View {
    @Environment(AppModel.self) private var model
    @State private var result: Bool?

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text(W("test.title")).font(.subheadline.weight(.semibold))
                Text(W("phone.alerts.sampleSoon"))
                    .font(.footnote).foregroundStyle(.secondary)
                Button {
                    Task { result = await send() }
                } label: {
                    Text(W("settings.testAlert"))
                        .font(.footnote.weight(.bold))
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .frame(minHeight: 44)
                        .background(Capsule().fill(Theme.sunArc))
                        .foregroundStyle(.black)
                }
                .buttonStyle(.plain)
                if let result {
                    Text(result ? W("phone.alerts.testComing") : W("phone.alerts.notAllowedIphone"))
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func send() async -> Bool {
        let now = Date.now
        let name = model.current(at: now).map { $0.prayer.name(model.naming) } ?? W("tab.prayer")
        let quiet = model.prefs.buzzOnly
        let sound: Azan.Sound = model.prefs.azanSound && Azan.isAvailable ? .azan(voice: model.prefs.azanVoice, full: model.prefs.azanFull, fajr: false) : .standard
        return await NotificationScheduler.sendTest(title: W("notify.testTitle", ["name": name]), body: W("notify.testBody"), sound: sound, silent: quiet)
    }
}

/// Set for all prayers: one level and an optional early reminder, applied to the five prayers.
private struct AllFivePage: View {
    @Environment(AppModel.self) private var model
    @State private var level: AllLevel = .notify
    @State private var early: Int?
    @State private var fajrToo = true
    @State private var done = false
    @State private var started = false

    private var levels: [AllLevel] { AllLevel.allCases.filter { $0 != .azan || Azan.isAvailable } }

    var body: some View {
        let fajrOwn = model.prefs.wakeUp != nil
        Form {
            Section {
                ForEach(levels) { l in
                    Button { level = l; done = false } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(name(l)).foregroundStyle(.primary)
                                Text(detail(l)).font(.footnote).foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                            if level == l { Image(systemName: "checkmark").foregroundStyle(Theme.sunArc) }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                Text(W("all.step1"))
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    Text(W("phone.alerts.noFullAzan"))
                    if level == .azan || level == .notify {
                        Text(W("all.azanFoot"))
                    }
                }
            }
            if level == .notify || level == .azan {
                Section(W("all.step2")) {
                    Picker(W("early.row"), selection: Binding(get: { early ?? -1 }, set: { early = $0 < 0 ? nil : $0; done = false })) {
                        Text(W("all.keep")).tag(-1)
                        Text(W("common.off")).tag(0)
                        ForEach(Preferences.reminderChoices, id: \.self) { Text(W("common.minBefore", ["n": $0])).tag($0) }
                    }
                    .pickerStyle(.menu)
                }
            }
            if fajrOwn {
                Section {
                    Toggle(W("all.fajrToo", ["name": Prayer.fajr.name(model.naming)]), isOn: Binding(get: { fajrToo }, set: { fajrToo = $0; done = false }))
                } footer: {
                    Text(W("all.fajrTooSub"))
                }
            }
            Section {
                Button {
                    apply()
                } label: {
                    Label(done ? W("all.applied") : W("all.apply"), systemImage: done ? "checkmark.circle.fill" : "bell.badge.fill")
                }
            }
        }
        .navigationTitle(W("all.row"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !started else { return }
            started = true
            fajrToo = model.prefs.wakeUp == nil
            switch model.prefs.alertMode(.dhuhr) {
            case .alarm: level = .alarm
            case .notify: level = model.prefs.azanSound && Azan.isAvailable ? .azan : .notify
            case .off: level = .off
            }
        }
    }

    private func apply() {
        let mins = (level == .notify || level == .azan) ? early : nil
        withAnimation { model.prefs.applyToAllFive(level, early: mins, includeFajr: fajrToo) }
        Task {
            if level == .off { await WakeUpAlarm.stopRinging() } else { await askForAlerts(); await model.refreshNotificationStatus() }
            done = true
        }
    }

    private func name(_ l: AllLevel) -> String {
        switch l {
        case .off: W("common.off")
        case .notify: W("phone.alerts.notification")
        case .azan: W("all.azanName")
        case .alarm: W("alerts.modeAlarm")
        }
    }

    private func detail(_ l: AllLevel) -> String {
        switch l {
        case .off: W("all.offDesc")
        case .notify: W("all.notifyDesc")
        case .azan: W("all.azanDesc")
        case .alarm: W("all.alarmDesc")
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
            Button { path.append(.all) } label: {
                HStack(spacing: 12) {
                    Image(systemName: "bell.badge.fill").foregroundStyle(Theme.sunArc)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(W("all.row")).font(.headline).foregroundStyle(.primary)
                        Text(W("all.rowSub")).font(.footnote).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
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
            row(name: W("alerts.fridayLeave", ["friday": friday]), mode: fridayMode,
                lead: fridayMode == .off ? W("common.off") : (fridayMode == .alarm ? W("alerts.modeAlarm") : W("phone.alerts.notification")),
                rest: W("alerts.fridayStarts", ["when": JumuahLeave.label(model.prefs.jumuahReminderMinutes).lowercased()]),
                modes: AlertMode.allCases,
                open: { path.append(.friday) },
                pick: { applyFridayMode($0, model: model) })
            HeadsUpPicker()
        } header: {
            Text(W("alerts.eachPrayer"))
        } footer: {
            Text(W("phone.alerts.pickOff"))
        }
    }

    private func row(name: String, mode: AlertMode, lead: String, rest: String, modes: [AlertMode],
                     open: @escaping () -> Void, pick: @escaping (AlertMode) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).foregroundStyle(.primary)
                    if mode == .off { Text(W("common.off")).font(.footnote).foregroundStyle(.secondary) }
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
                        Text(W("alerts.change"))
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
                .accessibilityHint(W("phone.alerts.changeTime"))
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
            Text(W("common.off")).tag(0)
            ForEach(Preferences.reminderChoices, id: \.self) { Text(W("common.minBefore", ["n": $0])).tag($0) }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(W("alerts.headsUp"))
                Text(W("alerts.headsUpSub")).font(.footnote).foregroundStyle(.secondary)
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
                    Label(W("phone.stopSnoozed"), systemImage: "stop.circle.fill")
                        .font(.body.weight(.semibold))
                }
            }
            if let next = model.nextWakeUp(after: .now) {
                LabeledContent(W("wake.next"), value: nextText(next))
            } else {
                Text(W("wake.noneOn")).foregroundStyle(.secondary)
            }
            if model.prefs.anyAlarm {
                Button(role: .destructive) { turnOffAll() } label: {
                    Label(W("wake.allOff"), systemImage: "alarm.waves.left.and.right")
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
        return W("phone.alerts.alarmAsNotification")
    }

    private func nextText(_ w: AppModel.WakeUp) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = model.timeZone
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEEE"
        f.locale = AppWords.formatLocale
        let when = cal.isDateInToday(w.date) ? W("common.today") : cal.isDateInTomorrow(w.date) ? W("common.tomorrow") : f.string(from: w.date)
        let what = w.isSahur ? " " + W("phone.alerts.forSahurWord") : w.prayer.map { " " + W("phone.alerts.forNameWord", ["name": $0.name(model.naming, isFriday: model.isFriday(w.date))]) } ?? ""
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
                    Text(W("wake.sahur"))
                    Text(W("wake.sahurSub", ["name": Prayer.fajr.name(model.naming)])).font(.footnote).foregroundStyle(.secondary)
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
            Text(W("alerts.fasting"))
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
                Text(W("wake.sahurOn"))
            } footer: {
                Text(W("wake.hijriNote"))
            }
        }
        let maghrib = Prayer.maghrib.name(model.naming)
        Section {
            ramadanSwitch(W("settings.imsakAlert"), W("phone.alerts.imsakBody", ["extra": about { model.imsak($0).addingTimeInterval(-600) }]), \.imsakAlert)
            ramadanSwitch(W("settings.berbukaAlert"), W("phone.alerts.berbukaBody", ["time": maghrib, "extra": about { $0.time(.maghrib) }]), \.berbukaAlert)
            ramadanSwitch(W("settings.qiyam"),
                          "On the last ten nights of Ramadan, a notification when the last third of the night begins, the best time for qiyam.\(model.nextLastThird().map { " About \(model.formatted($0)) here." } ?? "")",
                          \.qiyamAlert)
        } header: {
            Text(W("alerts.ramadanOnly"))
        } footer: {
            Text(W("alerts.ramadanFoot"))
        }
        if model.prefs.trackerEnabled {
            Section {
                Toggle(isOn: Binding(get: { model.prefs.windowNudge }, set: { model.prefs.windowNudge = $0 })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(W("settings.nudge"))
                        Text(W("phone.alerts.nudgeSub")).font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    /// " About 5:23 AM here." when the app knows the time.
    private func about(_ date: (PrayerDay) -> Date) -> String {
        model.nextTime(date).map { W("alerts.aboutHere", ["time": $0]) } ?? ""
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

/// Which voice and how long. Tapping a choice picks it and plays it; tapping again stops it.
private struct AzanChoiceRows: View {
    @Environment(AppModel.self) private var model
    @State private var player: AVAudioPlayer?
    @State private var playing: String?

    private static let names = [
        "asim": W("voice.asim"), "makkah": W("voice.makkah"), "khalaf": W("voice.khalaf"),
        "sudais": W("voice.sudais"), "aqsa": W("voice.aqsa"), "egypt": W("voice.egypt"), "madinah": W("voice.madinah"),
    ]

    @State private var ownSet = OwnAzan.isSet

    private var ownRow: some View {
        NavigationLink {
            OwnAzanView()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(W("phone.azan.own"))
                    Text(ownSet ? W("phone.alerts.yourFile") : W("phone.alerts.pickAudio")).font(.footnote).foregroundStyle(.secondary)
                }
                Spacer()
                Text(ownSet ? W("common.on") : W("common.off")).foregroundStyle(.secondary)
            }
        }
    }

    var body: some View {
        let voices = Azan.voices
        let voice = Azan.voiceOrDefault(model.prefs.azanVoice) ?? "asim"
        if ownSet {
            Section { ownRow }
                .onAppear { ownSet = OwnAzan.isSet }
        } else {
        Section {
            if voices.count > 1 {
                ForEach(voices, id: \.self) { v in
                    HStack(spacing: 12) {
                        Button {
                            play(v, voice: v, full: false)
                        } label: {
                            Image(systemName: playing == v ? "stop.circle.fill" : "play.circle.fill")
                                .font(.title2)
                                .foregroundStyle(.tint)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("\(playing == v ? "Stop" : "Listen"), \(Self.names[v] ?? v)")
                        Button {
                            model.prefs.azanVoice = v
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(Self.names[v] ?? v).foregroundStyle(.primary)
                                    if let note = note(v) { Text(note).font(.footnote).foregroundStyle(.secondary) }
                                }
                                Spacer()
                                if v == voice { Image(systemName: "checkmark").foregroundStyle(.tint) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.borderless)
                    }
                }
            }
            ownRow
            if Azan.has(voice, .full) {
                HStack {
                    Text(W("alerts.azanLength"))
                    Spacer()
                    HStack(spacing: 2) {
                        ForEach([false, true], id: \.self) { full in
                            let on = model.prefs.azanFull == full
                            Button {
                                model.prefs.azanFull = full
                                play(full ? "full" : "short", voice: voice, full: full)
                            } label: {
                                Text(full ? W("alerts.azanFull") : W("alerts.azanShort"))
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(on ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
                                    .frame(maxWidth: .infinity, minHeight: 32)
                                    .background(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.clear), in: RoundedRectangle(cornerRadius: 8))
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.borderless)
                            .accessibilityAddTraits(on ? .isSelected : [])
                        }
                    }
                    .padding(2)
                    .background(Color.secondary.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                    .frame(maxWidth: 210)
                }
            }
        } header: {
            Text(W("alerts.azanVoice"))
        } footer: {
            VStack(alignment: .leading, spacing: 8) {
                if Azan.has(voice, .full) {
                    Text(W("phone.alerts.shortFull", ["name": Prayer.fajr.name(model.naming)]))
                }
                Text(W("alerts.azanVoiceSub"))
                    .font(.caption)
            }
        }
        .onAppear { ownSet = OwnAzan.isSet }
        }
    }

    private func note(_ v: String) -> String? {
        if !Azan.has(v, .full) { return W("voice.shortOnly") }
        if Azan.has(v, .fajr) { return W("voice.fajrToo") }
        return nil
    }

    private func play(_ key: String, voice: String, full: Bool) {
        if playing == key { stop(); return }
        stop()
        guard let url = Azan.url(voice, Azan.kind(for: voice, full: full, fajr: false)),
              let p = try? AVAudioPlayer(contentsOf: url) else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback)
        player = p
        p.play()
        playing = key
        let seconds = p.duration
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(seconds + 0.2))
            if player === p { stop() }
        }
    }

    private func stop() {
        player?.stop()
        player = nil
        playing = nil
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
                        Text(W("settings.azan"))
                        Text(W("phone.alerts.azanSub")).font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            Toggle(isOn: Binding(get: { model.prefs.buzzOnly }, set: { model.prefs.buzzOnly = $0 })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(W("settings.buzzOnly"))
                    Text(W("alerts.buzzSub")).font(.footnote).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: Binding(get: { model.prefs.quietHours }, set: { model.prefs.quietHours = $0 })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(W("settings.quietHours"))
                    Text(W("alerts.quietSub", ["name": Prayer.fajr.name(model.naming)])).font(.footnote).foregroundStyle(.secondary)
                }
            }
            if model.prefs.quietHours {
                Picker(W("settings.from"), selection: Binding(get: { model.prefs.quietFrom }, set: { model.prefs.quietFrom = $0 })) {
                    ForEach(Self.halfHours, id: \.self) { Text(model.clock($0)).tag($0) }
                }
                Picker(W("settings.until"), selection: Binding(get: { model.prefs.quietTo }, set: { model.prefs.quietTo = $0 })) {
                    ForEach(Self.halfHours, id: \.self) { Text(model.clock($0)).tag($0) }
                }
            }
        } header: {
            Text(W("alerts.sound"))
        } footer: {
            Text(W("phone.alerts.soundFoot"))
        }
        // Voice and length. Their own azan (Settings, Your own azan) replaces these, so they hide then.
        if Azan.isAvailable && model.prefs.azanSound && !Azan.voices.isEmpty {
            AzanChoiceRows()
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
                .accessibilityHint(W("phone.alerts.playsSound"))
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        } header: {
            Text(W("wake.sound"))
        } footer: {
            Text(W("phone.alerts.tapSound"))
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
                Text(W("alerts.morningsHadith"))
                    .font(.body.italic())
                Text(W("alerts.morningsSource"))
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
                            Text(W("phone.alerts.yourAt", ["a": name, "b": mode == .alarm ? W("phone.alerts.alarmRingsWord") : W("phone.alerts.notifComesWord"), "c": dayWord(at)]))
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                }
            }
            Section {
                ModeCards(modes: AlertMode.modes(for: prayer), value: mode,
                          alarmHelp: prayer == .fajr ? W("phone.alerts.helpAlarmFajr", ["name": name]) : nil) {
                    applyAlertMode($0, prayer, model: model)
                }
            } header: {
                Text(W("alerts.howReach", ["name": name]))
            }
            if mode == .alarm && prayer == .fajr {
                Section {
                    ForEach(WakeUpTiming.allCases) { timing in
                        AlarmChoiceRow(title: timing.label(model.naming), detail: model.nextTime(timing.date), selected: p.wakeUp == timing) {
                            withAnimation { model.prefs.wakeUp = timing }
                        }
                    }
                } header: {
                    Text(W("alerts.whenAlarm"))
                } footer: {
                    Text(W("alerts.movesWith", ["name": name]))
                }
            }
            if mode == .alarm && PrayerAlarmTiming.prayers.contains(prayer) {
                Section(W("alerts.whenAlarm")) {
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
                            Text(W("alerts.notifyToo"))
                            Text(W("alerts.notifyTooSub", ["name": name])).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            if mode == .notify && prayer != .sunrise {
                Section {
                    HeadsUpPicker()
                } footer: {
                    Text(W("alerts.headsUpSame"))
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
        return cal.isDateInToday(date) ? W("common.today").lowercased() : W("common.tomorrow").lowercased()
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
                Text(W("alerts.howReminder"))
            }
            JumuahLeaveSection()
        }
        .navigationTitle(W("jumuah.leaveFor", ["friday": friday]))
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
                    CheckRow(ok: true, title: W("alerts.allowed"))
                case .denied:
                    CheckRow(ok: false, title: W("phone.alerts.notificationsOff"), detail: W("phone.alerts.turnOnIn"),
                             button: W("phone.alerts.openSettings")) { openSettings() }
                default:
                    CheckRow(ok: false, title: W("alerts.notAllowedYet"), button: W("alerts.allowButton")) {
                        Task { await askForAlerts(); await refresh() }
                    }
                }
                switch alarms {
                case .allowed:
                    CheckRow(ok: true, title: W("phone.alerts.alarmsAllowed"), detail: W("phone.alerts.alarmsRing"))
                case .denied:
                    CheckRow(ok: false, title: W("phone.alerts.alarmsOff"), detail: W("phone.alerts.withoutThem"),
                             button: W("phone.alerts.openSettings")) { openSettings() }
                case .notAsked:
                    CheckRow(ok: false, title: W("phone.alerts.alarmsNotYet"), button: W("phone.alerts.allowAlarms")) {
                        Task { await requestAlarms(); await refresh() }
                    }
                case .oldIOS:
                    CheckRow(ok: false, title: W("phone.alerts.alarmsAsNotif"), detail: W("phone.alerts.fromIos26"))
                case .unknown:
                    EmptyView()
                }
                if timeSensitive == .enabled {
                    CheckRow(ok: true, title: W("phone.alerts.timeSensitive"), detail: W("phone.alerts.throughFocus"))
                } else {
                    CheckRow(ok: false, title: W("phone.alerts.focusHolds"),
                             detail: W("phone.alerts.focusHow"),
                             button: W("phone.alerts.openSettings")) { openSettings() }
                }
                CheckRow(ok: false, title: W("phone.alerts.silentMutes"),
                         detail: W("phone.alerts.noAppSilent"))
                if model.prefs.fridayMode == .notify {
                    CheckRow(ok: false, title: W("alerts.fridayIsNotify", ["friday": friday]), detail: W("phone.alerts.makeAlarmSilent"),
                             button: W("alerts.makeAlarm")) { applyFridayMode(.alarm, model: model) }
                }
                if notifyCount > 0 {
                    CheckRow(ok: true, title: notifyCount == 1 ? W("phone.alerts.onePrayerNotify") : W("phone.alerts.nPrayersNotify", ["n": notifyCount]),
                             detail: W("phone.alerts.quietSilent"))
                }
            }
        }
        .navigationTitle(W("alerts.checkTitle"))
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
                Label(m == mode ? W("phone.alerts.onNow", ["name": m.word]) : m.word, systemImage: m.symbol)
            }
        }
        Button { model.openAlerts(.prayer(prayer)) } label: {
            Label(W("phone.alerts.inAlerts", ["name": prayer.name(model.naming)]), systemImage: "slider.horizontal.3")
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

/// Early reminders when away from home: one choice per prayer. Home and the check stay on the phone.
private struct AwayReminderSection: View {
    @Environment(AppModel.self) private var model

    private func word(_ m: Int) -> String { m == 60 ? W("early.hour") : W("early.min", ["n": m]) }

    var body: some View {
        Section {
            Toggle(isOn: Binding(
                get: { model.prefs.awayReminder },
                set: { on in
                    model.prefs.awayReminder = on
                    if on { Task { await askForAlerts() } }
                })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(W("early.awaySwitch"))
                    Text(W("early.awaySwitchSub")).font(.footnote).foregroundStyle(.secondary)
                }
            }
            if model.prefs.home == nil {
                Text(W("early.noHome")).font(.footnote).foregroundStyle(.secondary)
            } else if !model.prefs.homeConfirmed {
                HomeQuestionCard()
            }
            if model.prefs.awayReminder {
                ForEach(AwayReminder.prayers) { prayer in
                    Picker(prayer.name(model.naming), selection: Binding(
                        get: { model.prefs.awayMinutes[prayer.rawValue] ?? 0 },
                        set: { model.prefs.awayMinutes[prayer.rawValue] = $0 })) {
                        Text(W("common.off")).tag(0)
                        ForEach(AwayReminder.choices, id: \.self) { Text(word($0)).tag($0) }
                    }
                    .pickerStyle(.menu)
                }
            }
        } header: {
            Text(W("early.awayHead"))
        } footer: {
            Text(model.prefs.awayReminder ? W("phone.alerts.fajrOff")
                 : W("early.privacy"))
        }
    }
}
