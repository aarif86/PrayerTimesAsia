import AudioToolbox
import AVFoundation
import SwiftUI

/// Prayer alarms: Subuh first (with the earlier sahur alarm), then the other
/// four prayers and the sound they all play. Opened from the alarm chip on the
/// Prayer screen (and from Settings).
/// "Allahumma barik li ummati fi bukuriha" (Abu Dawud, Tirmidhi).
struct WakeUpView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let fajr = Prayer.fajr.name(model.naming)
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا")
                            .font(.title3)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .environment(\.layoutDirection, .rightToLeft)
                        Text("“O Allah, bless my ummah in their early mornings.”")
                            .font(.body.italic())
                        Text("The Prophet ﷺ, narrated by Abu Dawud and Tirmidhi")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    if let next = model.nextWakeUp(after: .now) {
                        LabeledContent("Next alarm", value: nextText(next))
                    }
                }

                Section {
                    choice("Off", selected: model.prefs.wakeUp == nil) { setWakeUp(nil) }
                    wakeChoices(.beforeFajr)
                } header: {
                    Text("\(fajr) alarm")
                }
                Section { HadithView(id: .nightPrayer, style: .line).hadithRow() }
                Section {
                    wakeChoices(.fromFajr)
                } header: {
                    Text("From \(fajr)")
                }
                Section {
                    wakeChoices(.beforeSunrise)
                } header: {
                    Text("Before \(Prayer.sunrise.name(model.naming))")
                } footer: {
                    Text("Rings every morning and moves with \(fajr) wherever you are.")
                }

                Section {
                    choice("Off", selected: model.prefs.sahurAlarm == nil) { setSahur(nil) }
                    ForEach(SahurTiming.allCases) { timing in
                        choice(timing.label(model.naming), detail: timeToday(timing.date), selected: model.prefs.sahurAlarm == timing) {
                            setSahur(timing)
                        }
                    }
                } header: {
                    Text("Sahur alarm")
                } footer: {
                    Text("An earlier alarm to eat sahur before a fast, or for a longer night prayer.")
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
                    Section {
                        HadithView(id: .monThu, style: .line).hadithRow()
                        HadithView(id: .whiteDays, style: .line).hadithRow()
                    }
                }

                Section {
                    ForEach(PrayerAlarmTiming.prayers) { prayer in
                        prayerPicker(prayer)
                    }
                } header: {
                    Text("Other prayers")
                } footer: {
                    Text("An alarm rings loudly until you stop it. If it rings at the very start of a prayer, it takes the place of that prayer's alert.")
                }

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
                    Text("Tap a sound to hear it. Every alarm plays this sound. Classic is your iPhone's own alarm. The azan will join the list once the recordings are ready.")
                }

                Section {
                    Text(alarmNote)
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Prayer alarms")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .onDisappear { AlarmPreview.stop() }
        }
    }

    private var alarmNote: String {
        if #available(iOS 26.0, *) {
            return "A real alarm that rings even in Silent mode and Focus, like the Clock app. Tap Done to stop it, or Snooze 5 min to hear it again in 5 minutes."
        }
        return "On this iPhone the alarm comes as a notification. From iOS 26 it rings like a real alarm, even in Silent mode."
    }

    private func wakeChoices(_ group: WakeUpTiming.Part) -> some View {
        ForEach(WakeUpTiming.allCases.filter { $0.group == group }) { timing in
            choice(timing.label(model.naming), detail: timeToday(timing.date), selected: model.prefs.wakeUp == timing) {
                setWakeUp(timing)
            }
        }
    }

    private func choice(_ title: String, detail: String? = nil, selected: Bool, action: @escaping () -> Void) -> some View {
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

    /// The time this choice would ring tomorrow morning (or this morning, before Subuh).
    private func timeToday(_ date: (PrayerDay) -> Date) -> String? {
        let now = Date.now
        for offset in 0..<2 {
            if let day = model.day(containing: now.addingTimeInterval(Double(offset) * 86_400)) {
                let t = date(day)
                if t > now { return model.formatted(t) }
            }
        }
        return nil
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

    /// One prayer's alarm, as a menu: Off, on time, minutes after, or before it ends.
    private func prayerPicker(_ prayer: Prayer) -> some View {
        let name = prayer.name(model.naming)
        let current = model.prefs.alarm(for: prayer)
        return Picker(selection: Binding(
            get: { current },
            set: { timing in
                Task {
                    if timing != nil { _ = await NotificationScheduler.requestPermission() }
                    withAnimation { model.prefs.setAlarm(timing, for: prayer) }
                }
            })) {
            Text("Off").tag(PrayerAlarmTiming?.none)
            ForEach(PrayerAlarmTiming.choices(for: prayer)) { timing in
                Text(timing.label).tag(PrayerAlarmTiming?.some(timing))
            }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                if let current, let t = timeToday({ current.date(start: $0.time(prayer), end: PrayerAlarmTiming.end(of: prayer, in: $0)) }) {
                    Text(t).font(.footnote).foregroundStyle(.secondary).monospacedDigit()
                }
            }
        }
        .pickerStyle(.menu)
        .accessibilityLabel("\(name) alarm")
    }

    private func setWakeUp(_ timing: WakeUpTiming?) {
        Task {
            if timing != nil { _ = await NotificationScheduler.requestPermission() }
            withAnimation { model.prefs.wakeUp = timing }
        }
    }

    private func setSahur(_ timing: SahurTiming?) {
        Task {
            if timing != nil { _ = await NotificationScheduler.requestPermission() }
            withAnimation { model.prefs.sahurAlarm = timing }
        }
    }
}

/// A few seconds of an alarm sound, to hear it before choosing. Plays even in
/// Silent mode, like the alarm itself will.
@MainActor
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
