import SwiftUI

/// "Leave for Jumaat": when to leave, on the Friday page of Alerts and alarms
/// (Off, Notify or Alarm is chosen above it). Singapore also gets the first or
/// second session. Same as web ui/WakeUp.tsx FridayPage and Android.
struct JumuahLeaveSection: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let friday = Prayer.dhuhr.name(model.naming, isFriday: true)
        let zohor = Prayer.dhuhr.name(model.naming)
        let sg = model.activePlace.map { MasjidExtras.inSingapore($0.coordinates, countryCode: $0.countryCode) } ?? false
        let twoPM = secondClock
        Section {
            if model.prefs.jumuahReminderMinutes > 0 {
                Picker(selection: Binding(
                    get: { model.prefs.jumuahReminderMinutes },
                    set: { minutes in withAnimation { model.prefs.jumuahReminderMinutes = minutes } })) {
                    ForEach(JumuahLeave.choices.filter { $0 > 0 }, id: \.self) { Text(JumuahLeave.label($0)).tag($0) }
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("When")
                        if let next = model.nextJumuahLeave() {
                            Text(nextText(next, friday: friday)).font(.footnote).foregroundStyle(.secondary).monospacedDigit()
                        }
                    }
                }
                .pickerStyle(.menu)
                .accessibilityLabel("When to leave for \(friday)")
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
