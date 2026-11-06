import SwiftUI

/// Wake up for Subuh: the Subuh alarm and the earlier sahur alarm, opened from
/// the alarm chip on the Prayer screen (and from Settings).
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
                    ForEach(WakeUpTiming.allCases) { timing in
                        choice(timing.label(model.naming), detail: timeToday(timing.date), selected: model.prefs.wakeUp == timing) {
                            setWakeUp(timing)
                        }
                    }
                } header: {
                    Text("\(fajr) alarm")
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
                }

                Section {
                    Text(alarmNote)
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Wake up for \(fajr)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    private var alarmNote: String {
        if #available(iOS 26.0, *) {
            return "A real alarm that rings even in Silent mode and Focus, like the Clock app."
        }
        return "On this iPhone the alarm comes as a notification. From iOS 26 it rings like a real alarm, even in Silent mode."
    }

    private func choice(_ title: String, detail: String? = nil, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).foregroundStyle(.primary)
                Spacer()
                if let detail { Text(detail).foregroundStyle(.secondary).monospacedDigit() }
                Image(systemName: "checkmark").font(.body.weight(.semibold))
                    .foregroundStyle(Theme.sunArc)
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
        return "\(when) \(model.formatted(w.date))\(w.isSahur ? " for sahur" : "")"
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
