import SwiftUI

/// "Leave for Jumaat", in the Prayer alarms sheet, its one home.
/// Singapore also gets the first or second session.
/// Same as web ui/JumuahLeave.tsx and Android JumuahLeaveRows.
struct JumuahLeaveSection: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let friday = Prayer.dhuhr.name(model.naming, isFriday: true)
        let zohor = Prayer.dhuhr.name(model.naming)
        let sg = model.activePlace.map { MasjidExtras.inSingapore($0.coordinates, countryCode: $0.countryCode) } ?? false
        let twoPM = secondClock
        Section {
            Picker(selection: Binding(
                get: { model.prefs.jumuahReminderMinutes },
                set: { minutes in
                    Task {
                        if minutes > 0, !(await NotificationScheduler.requestPermission()) { return }
                        withAnimation { model.prefs.jumuahReminderMinutes = minutes }
                    }
                })) {
                ForEach(JumuahLeave.choices, id: \.self) { Text(JumuahLeave.label($0)).tag($0) }
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Remind me to leave")
                    if let next = model.nextJumuahLeave() {
                        Text(nextText(next, friday: friday)).font(.footnote).foregroundStyle(.secondary).monospacedDigit()
                    }
                }
            }
            .pickerStyle(.menu)
            .accessibilityLabel("Remind me to leave for \(friday)")
            if model.prefs.jumuahReminderMinutes > 0 {
                Toggle(isOn: Binding(
                    get: { model.prefs.jumuahLeaveAlarm },
                    set: { on in
                        Task {
                            if on { _ = await NotificationScheduler.requestPermission() } else { await WakeUpAlarm.stopRinging() }
                            withAnimation { model.prefs.jumuahLeaveAlarm = on }
                        }
                    })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Ring as an alarm")
                        Text("Rings even on silent or in a Focus").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            if sg && model.prefs.jumuahReminderMinutes > 0 {
                Picker(selection: Binding(
                    get: { model.prefs.jumuahSession },
                    set: { model.prefs.jumuahSession = $0 })) {
                    Text("First").tag(JumuahSession.first)
                    Text("Second").tag(JumuahSession.second)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Which session")
                        Text("First at \(zohor), second from \(twoPM)").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .pickerStyle(.menu)
            }
        } header: {
            Text("Leave for \(friday)")
        } footer: {
            let from = sg && model.prefs.jumuahSession == .second ? twoPM
                : model.myMasjidHere?.jumuah != nil ? "your masjid's own \(friday) time" : "the start of \(zohor)"
            Text("A reminder on Fridays to get ready and leave in time. It counts back from \(from)."
                 + (sg ? " Only some masjids in Singapore hold a second session. The Masjid tab shows which ones." : "")
                 + " \(friday) is not required of women, travellers or the sick, who pray \(zohor) instead.")
        }
    }

    private var secondClock: String {
        let p = JumuahLeave.secondSessionFrom.split(separator: ":").compactMap { Int($0) }
        return p.count == 2 ? model.clock(p[0] * 60 + p[1]) : JumuahLeave.secondSessionFrom
    }

    private func nextText(_ next: (leave: Date, start: Date, second: Bool), friday: String) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = model.timeZone
        let day = cal.isDate(next.leave, inSameDayAs: .now) ? "Today" : "Friday"
        return "\(day) \(model.formatted(next.leave)), for \(friday) at \(model.formatted(next.start))"
    }
}
