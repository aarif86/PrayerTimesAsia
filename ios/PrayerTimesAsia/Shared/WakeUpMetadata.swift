#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import AppIntents

/// What the prayer alarms carry (nothing extra). Shared with the widgets, which
/// show the snooze countdown on the Lock Screen and in the Dynamic Island.
@available(iOS 26.0, *)
struct WakeUpMetadata: AlarmMetadata {}

/// Stop one prayer alarm for good: ringing, snoozed or waiting. Used by the
/// alarm's own Done button and by the Stop button on the Lock Screen and in the
/// Dynamic Island, so a snoozed alarm never rings again once stopped.
@available(iOS 26.0, *)
struct StopPrayerAlarmIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Stop alarm"
    static let isDiscoverable = false

    @Parameter(title: "Alarm")
    var alarmID: String

    init() { alarmID = "" }
    init(alarmID: UUID) { self.alarmID = alarmID.uuidString }

    func perform() async throws -> some IntentResult {
        if let id = UUID(uuidString: alarmID) {
            try? AlarmManager.shared.stop(id: id)
            try? AlarmManager.shared.cancel(id: id)
        }
        for activity in Activity<AlarmAttributes<WakeUpMetadata>>.activities
        where activity.content.state.alarmID.uuidString == alarmID {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        return .result()
    }
}
#endif
