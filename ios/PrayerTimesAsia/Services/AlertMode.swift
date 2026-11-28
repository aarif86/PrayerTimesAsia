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
        case .off: W("common.off")
        case .notify: W("alerts.modeNotify")
        case .alarm: W("alerts.modeAlarm")
        }
    }

    /// What a choice means, on the big cards of a prayer's page.
    var help: String {
        switch self {
        case .off: W("alerts.helpOff")
        case .notify: W("alerts.helpNotify")
        case .alarm: W("phone.alerts.alarmRings")
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

/// What "Set for all prayers" can do: Off, Notification, Short azan (a notification that plays it) or Alarm.
enum AllLevel: String, CaseIterable, Identifiable, Sendable {
    case off, notify, azan, alarm
    var id: String { rawValue }
}

/// The three words people see, plus Off: Azan, Notification, Alarm (owner's choice, 27 Nov 2026).
/// Azan and Notification are both a notification at prayer time, one with the call to prayer and
/// one quiet. Nothing new is saved except quietPrayers (the prayers kept quiet).
enum AlertChoice: String, CaseIterable, Identifiable, Sendable {
    case azan, notification, alarm, off
    var id: String { rawValue }

    var word: String {
        switch self {
        case .azan: W("alerts.modeAzan")
        case .notification: W("alerts.modeNotify")
        case .alarm: W("alerts.modeAlarm")
        case .off: W("common.off")
        }
    }

    var help: String {
        switch self {
        case .azan: W("alerts.helpAzan")
        case .notification: W("alerts.helpNotify")
        case .alarm: W("phone.alerts.alarmRings")
        case .off: W("alerts.helpOff")
        }
    }

    var symbol: String {
        switch self {
        case .azan: "speaker.wave.2.fill"
        case .notification: "bell.fill"
        case .alarm: "alarm.fill"
        case .off: "bell.slash"
        }
    }

    /// Syuruk only says Subuh has ended, so it has no azan and no alarm. Azan is for the five prayers.
    static func choices(for prayer: Prayer, azanAvailable: Bool = true) -> [AlertChoice] {
        if prayer == .sunrise { return [.notification, .off] }
        return (azanAvailable ? [.azan] : []) + [.notification, .alarm, .off]
    }
}

extension Preferences {
    static let defaultFridayMinutes = 30

    /// Does this prayer's notification play the azan? Needs the azan switch on and the prayer not kept quiet.
    func azanPlays(_ prayer: Prayer) -> Bool {
        azanSound && prayer != .sunrise && !quietPrayers.contains(prayer)
    }

    func alertChoice(_ prayer: Prayer) -> AlertChoice {
        switch alertMode(prayer) {
        case .off: .off
        case .alarm: .alarm
        // With no azan recordings or own azan on the phone the notification plays the normal sound, so it is a Notification.
        case .notify: azanPlays(prayer) && Azan.isAvailable ? .azan : .notification
        }
    }

    /// Azan, Notification, Alarm or Off for one prayer. Azan and Notification change only this prayer.
    mutating func setAlertChoice(_ choice: AlertChoice, _ prayer: Prayer) {
        switch choice {
        case .off: setAlertMode(.off, prayer)
        case .alarm: setAlertMode(.alarm, prayer)
        case .notification:
            setAlertMode(.notify, prayer)
            if azanSound { quietPrayers.insert(prayer) }
        case .azan:
            setAlertMode(.notify, prayer)
            // The azan was off for the whole app: turning it on must not switch it on for the other prayers.
            if !azanSound { quietPrayers = Set(Prayer.allCases); azanSound = true }
            quietPrayers.remove(prayer)
        }
    }

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

    /// "Set for all prayers": one choice for the five main prayers at once. Sunrise and
    /// Jumu'ah are not touched. Short azan is a notification, and the azan sound is one
    /// setting for the whole app, so Notification turns it off and Short azan turns it on.
    /// Fajr is left alone when includeFajr is false, so a Fajr alarm someone set up
    /// carefully is never replaced by accident. early is the early reminder in minutes,
    /// or nil to leave it as it is. Same rule as the web applyToAllFive.
    mutating func applyToAllFive(_ level: AllLevel, early: Int?, includeFajr: Bool = true) {
        let mode: AlertMode = level == .off ? .off : (level == .alarm ? .alarm : .notify)
        for prayer in Prayer.obligatory where prayer != .fajr || includeFajr { setAlertMode(mode, prayer) }
        if level == .notify { azanSound = false }
        // A Fajr left alone keeps its own quiet choice.
        if level == .azan { azanSound = true; quietPrayers = includeFajr ? [] : quietPrayers.intersection([.fajr]) }
        guard let early else { return }
        reminderMinutesBefore = early
        // Away from home the app uses its own minutes for each prayer, so they follow the same choice.
        // A Fajr that has an alarm keeps its own (Off), so the two never ring together.
        let away = early == 0 ? 0 : (AwayReminder.choices.min { abs($0 - early) < abs($1 - early) } ?? 0)
        for prayer in Prayer.obligatory {
            if prayer == .fajr && (!includeFajr || hasAlarm(.fajr)) { continue }
            awayMinutes[prayer.rawValue] = away
        }
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
