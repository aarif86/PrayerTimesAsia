import Foundation
import SwiftUI
#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
#endif

/// Prayer alarms (Subuh, sahur and the other prayers) as real alarms: on iOS 26+ AlarmKit rings through Silent
/// mode and Focus like the Clock app. Earlier iOS (or if the user declines)
/// falls back to a notification - `schedule` returns false in that case.
///
/// Every refresh clears all of this app's waiting alarms (asking AlarmKit for
/// them, not a saved list) and sets the new ones, one refresh at a time. Before,
/// two refreshes at once (opening the app, a GPS fix, changing a setting) could
/// each save their own list, and the alarms of the one that lost were never
/// cancelled: they rang even after the alarm was set to Off.
enum WakeUpAlarm {
    /// The old saved list of alarm IDs, still cleared for phones updating from it.
    private static let idsKey = "wakeUp.alarmIDs"

    @MainActor private static var running: Task<Bool, Never>?

    @MainActor
    static func schedule(_ alarms: [(Date, String)], sound: AlarmSound = .classic) async -> Bool {
        let previous = running
        let task = Task { @MainActor in
            _ = await previous?.value
            return await replace(with: alarms, sound: sound)
        }
        running = task
        return await task.value
    }

    /// Stops every prayer alarm that is ringing or snoozed, so nothing rings
    /// again until the next one that is set. Waiting alarms stay.
    @MainActor
    static func stopRinging() async {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let manager = AlarmManager.shared
            for alarm in (try? manager.alarms) ?? [] where alarm.state != .scheduled {
                try? manager.stop(id: alarm.id)
                try? manager.cancel(id: alarm.id)
            }
            await endStaleActivities()
        }
        #endif
    }

    /// Is a prayer alarm ringing or snoozed right now?
    @MainActor
    static var isRingingOrSnoozed: Bool {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            return ((try? AlarmManager.shared.alarms) ?? []).contains { $0.state != .scheduled }
        }
        #endif
        return false
    }

    @MainActor
    private static func replace(with alarms: [(Date, String)], sound: AlarmSound) async -> Bool {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let manager = AlarmManager.shared
            // Phones updating from the saved list: clear those too.
            for id in UserDefaults.standard.stringArray(forKey: idsKey) ?? [] {
                if let uuid = UUID(uuidString: id) { try? manager.cancel(id: uuid) }
            }
            UserDefaults.standard.removeObject(forKey: idsKey)
            // Every waiting alarm of this app goes. A snoozed or ringing one stays
            // (the app refreshes in the background too), unless every alarm is
            // now Off: then nothing may ring again.
            for alarm in (try? manager.alarms) ?? [] where alarm.state == .scheduled || alarms.isEmpty {
                try? manager.stop(id: alarm.id)
                try? manager.cancel(id: alarm.id)
            }
            await endStaleActivities()
            guard !alarms.isEmpty else { return true }
            var state = manager.authorizationState
            if state == .notDetermined {
                state = (try? await manager.requestAuthorization()) ?? .denied
            }
            guard state == .authorized else { return false }
            for (date, title) in alarms where date > .now {
                let id = UUID()
                let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.fill")
                // Snooze: rings again in 5 minutes. Stop on the Lock Screen ends it.
                let snooze = AlarmButton(text: "Snooze 5 min", textColor: .white, systemImageName: "zzz")
                let alert = AlarmPresentation.Alert(title: LocalizedStringResource("\(title)"), stopButton: stop,
                                                    secondaryButton: snooze, secondaryButtonBehavior: .countdown)
                let countdown = AlarmPresentation.Countdown(title: "Snoozed. Rings again in 5 min")
                let attributes = AlarmAttributes<WakeUpMetadata>(presentation: AlarmPresentation(alert: alert, countdown: countdown),
                                                                 tintColor: Color(red: 1, green: 0.62, blue: 0.4))
                // Classic is the phone's own alarm sound; the others are our tones in Resources/.
                let tone: AlertConfiguration.AlertSound = sound.fileName.map { .named($0) } ?? .default
                let configuration = AlarmManager.AlarmConfiguration<WakeUpMetadata>(
                    countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: 5 * 60),
                    schedule: .fixed(date), attributes: attributes,
                    stopIntent: StopPrayerAlarmIntent(alarmID: id), sound: tone)
                _ = try? await manager.schedule(id: id, configuration: configuration)
            }
            return true
        }
        #endif
        return false
    }

    #if canImport(AlarmKit)
    /// Lock Screen and Dynamic Island cards left over from alarms that have
    /// already ended (they showed as a pile of "Snoozed" cards).
    @available(iOS 26.0, *)
    @MainActor
    private static func endStaleActivities() async {
        let live = Set(((try? AlarmManager.shared.alarms) ?? []).filter { $0.state != .scheduled }.map(\.id))
        for activity in Activity<AlarmAttributes<WakeUpMetadata>>.activities
        where !live.contains(activity.content.state.alarmID) {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
    #endif
}
