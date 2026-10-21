import Foundation
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
#endif

/// Subuh wake-up as a real alarm: on iOS 26+ AlarmKit rings through Silent
/// mode and Focus like the Clock app. Earlier iOS (or if the user declines)
/// falls back to a notification - `schedule` returns false in that case.
enum WakeUpAlarm {
    private static let idsKey = "wakeUp.alarmIDs"

    @MainActor
    static func schedule(_ alarms: [(Date, String)]) async -> Bool {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let manager = AlarmManager.shared
            cancelScheduled(manager)
            guard !alarms.isEmpty else { return true }
            var state = manager.authorizationState
            if state == .notDetermined {
                state = (try? await manager.requestAuthorization()) ?? .denied
            }
            guard state == .authorized else { return false }
            var ids: [String] = []
            for (date, title) in alarms where date > .now {
                let id = UUID()
                let stop = AlarmButton(text: "Done", textColor: .white, systemImageName: "checkmark")
                let alert = AlarmPresentation.Alert(title: LocalizedStringResource("\(title)"), stopButton: stop)
                let attributes = AlarmAttributes<WakeUpMetadata>(presentation: AlarmPresentation(alert: alert),
                                                                 tintColor: Color(red: 1, green: 0.62, blue: 0.4))
                let configuration = AlarmManager.AlarmConfiguration<WakeUpMetadata>.alarm(
                    schedule: .fixed(date), attributes: attributes)
                if (try? await manager.schedule(id: id, configuration: configuration)) != nil {
                    ids.append(id.uuidString)
                }
            }
            UserDefaults.standard.set(ids, forKey: idsKey)
            return true
        }
        #endif
        return false
    }

    #if canImport(AlarmKit)
    @available(iOS 26.0, *)
    private static func cancelScheduled(_ manager: AlarmManager) {
        for id in UserDefaults.standard.stringArray(forKey: idsKey) ?? [] {
            if let uuid = UUID(uuidString: id) { try? manager.cancel(id: uuid) }
        }
        UserDefaults.standard.removeObject(forKey: idsKey)
    }
    #endif
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct WakeUpMetadata: AlarmMetadata {}
#endif
