import Foundation

/// One choice per prayer in "Alerts and alarms": Off, Notify or Alarm.
/// Same rules in web core/alertMode.ts and android core AlertMode.kt.
///
/// Nothing new is saved. The choice is read from the settings the app already had:
/// Notify is a prayer in notifyPrayers (with notificationsEnabled), Alarm is that
/// prayer's alarm (wakeUp for Subuh). A prayer can have an alarm and a notification
/// when it begins, which the Alarm page shows as "Notification too".
enum AlertMode: String, CaseIterable, Identifiable, Sendable {
    case off, notify, alarm
    var id: String { rawValue }

    var word: String {
        switch self {
        case .off: "Off"
        case .notify: "Notify"
        case .alarm: "Alarm"
        }
    }

    /// What a choice means, on the big cards of a prayer's page.
    var help: String {
        switch self {
        case .off: "Nothing for this prayer"
        case .notify: "A notification with sound. Quiet when your phone is on silent or in a Focus."
        case .alarm: "Rings until you stop it, even on silent and in a Focus. Snooze 5 min."
        }
    }

    /// The bell beside a prayer on the Prayer screen.
    var symbol: String {
        switch self {
        case .off: "bell.slash"
        case .notify: "bell.fill"
        case .alarm: "alarm.fill"
        }
    }

    /// Syuruk is only a note that Subuh has ended: no alarm for it.
    static func modes(for prayer: Prayer) -> [AlertMode] {
        prayer == .sunrise ? [.off, .notify] : [.off, .notify, .alarm]
    }
}

extension Preferences {
    static let defaultFridayMinutes = 30

    func hasAlarm(_ prayer: Prayer) -> Bool {
        prayer == .fajr ? wakeUp != nil : alarm(for: prayer) != nil
    }

    /// A notification when the prayer begins.
    func notifies(_ prayer: Prayer) -> Bool {
        notificationsEnabled && notifyPrayers.contains(prayer)
    }

    func alertMode(_ prayer: Prayer) -> AlertMode {
        if hasAlarm(prayer) { return .alarm }
        return notifies(prayer) ? .notify : .off
    }

    private mutating func setHasAlarm(_ on: Bool, _ prayer: Prayer) {
        if prayer == .fajr {
            wakeUp = on ? (wakeUp ?? .atFajr) : nil
        } else if PrayerAlarmTiming.prayers.contains(prayer) {
            setAlarm(on ? (alarm(for: prayer) ?? .atStart) : nil, for: prayer)
        }
    }

    /// Turn the notification when a prayer begins on or off, leaving its alarm alone.
    mutating func setNotify(_ on: Bool, _ prayer: Prayer) {
        if on {
            // Alerts were never turned on: the old list (all five) was only a default, so start from this one prayer.
            if !notificationsEnabled { notificationsEnabled = true; notifyPrayers = [] }
            notifyPrayers.insert(prayer)
        } else {
            notifyPrayers.remove(prayer)
        }
    }

    /// Off clears both. Notify clears the alarm. Alarm keeps a notification the
    /// prayer already had, so a 30 min tahajjud alarm still leaves the Subuh
    /// notification at Subuh. An alarm at the very start takes its place anyway.
    mutating func setAlertMode(_ mode: AlertMode, _ prayer: Prayer) {
        switch mode {
        case .off: setHasAlarm(false, prayer); setNotify(false, prayer)
        case .notify: setHasAlarm(false, prayer); setNotify(true, prayer)
        case .alarm:
            if prayer == .sunrise { setNotify(true, prayer) } else { setHasAlarm(true, prayer) }
        }
    }

    /// All five main prayers are on Notify (no Off, no Alarm). Sunrise does not count.
    var allFiveNotify: Bool {
        Prayer.obligatory.allSatisfy { alertMode($0) == .notify }
    }

    /// "Notify me for all 5 prayers": every main prayer that is Off goes to Notify.
    /// A prayer on Alarm stays on Alarm. Sunrise is not touched.
    mutating func notifyAllFive() {
        // Alerts were never turned on: an old saved list is only a leftover, so start clean (same as setNotify).
        if !notificationsEnabled { notificationsEnabled = true; notifyPrayers = [] }
        for prayer in Prayer.obligatory { notifyPrayers.insert(prayer) }
    }

    /// The bell on the Prayer screen: Off, then Notify, then Alarm, then Off again.
    func nextAlertMode(_ prayer: Prayer) -> AlertMode {
        let modes = AlertMode.modes(for: prayer)
        let i = modes.firstIndex(of: alertMode(prayer)) ?? 0
        return modes[(i + 1) % modes.count]
    }

    /// Leave for Jumaat, the Friday row.
    var fridayMode: AlertMode {
        guard jumuahReminderMinutes > 0 else { return .off }
        return jumuahLeaveAlarm ? .alarm : .notify
    }

    /// Off, Notify or Alarm for the Friday reminder, 30 min before unless already set.
    mutating func setFridayMode(_ mode: AlertMode) {
        if mode == .off { jumuahReminderMinutes = 0; jumuahLeaveAlarm = false; return }
        if jumuahReminderMinutes <= 0 { jumuahReminderMinutes = Self.defaultFridayMinutes }
        jumuahLeaveAlarm = mode == .alarm
    }

    /// The one case the single screen could not show truthfully: "Reminder before
    /// prayer" on while "Prayer time alerts" was off. Those prayers now show as
    /// Notify and also get the notification at the time. Does nothing a second time.
    mutating func unifyAlerts() {
        if !notificationsEnabled && reminderMinutesBefore > 0 && !notifyPrayers.isEmpty { notificationsEnabled = true }
    }
}
