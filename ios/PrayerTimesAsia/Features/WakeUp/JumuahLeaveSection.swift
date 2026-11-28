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
                        Text(W("alerts.when"))
                        if let next = model.nextJumuahLeave() {
                            Text(nextText(next, friday: friday)).font(.footnote).foregroundStyle(.secondary).monospacedDigit()
                        }
                    }
                }
                .pickerStyle(.menu)
                .accessibilityLabel(W("alerts.whenLeave", ["friday": friday]))
            }
            if sg && model.prefs.jumuahReminderMinutes > 0 {
                Picker(selection: Binding(
                    get: { model.prefs.jumuahSession },
                    set: { model.prefs.jumuahSession = $0 })) {
                    Text(W("jumuah.first")).tag(JumuahSession.first)
                    Text(W("jumuah.second")).tag(JumuahSession.second)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(W("jumuah.session"))
                        Text(W("jumuah.sessionSub", ["dhuhr": zohor, "time": twoPM])).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .pickerStyle(.menu)
            }
        } footer: {
            let from = sg && model.prefs.jumuahSession == .second ? twoPM
                : model.myMasjidHere?.jumuah != nil ? W("jumuah.ownTime", ["friday": friday]) : W("jumuah.startOf", ["dhuhr": zohor])
            Text(W("jumuah.foot", ["from": from])
                 + (sg ? W("jumuah.footSg") : "")
                 + W("jumuah.footWho", ["friday": friday, "dhuhr": zohor]))
        }
    }

    private var secondClock: String {
        let p = JumuahLeave.secondSessionFrom.split(separator: ":").compactMap { Int($0) }
        return p.count == 2 ? model.clock(p[0] * 60 + p[1]) : JumuahLeave.secondSessionFrom
    }

    private func nextText(_ next: (leave: Date, start: Date, second: Bool), friday: String) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = model.timeZone
        let day = cal.isDate(next.leave, inSameDayAs: .now) ? W("common.today") : W("phone.alerts.friday")
        return W("phone.alerts.fridaySummary", ["a": day, "b": model.formatted(next.leave), "c": friday, "d": model.formatted(next.start)])
    }
}
