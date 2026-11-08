#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

/// A snoozed (or ringing) prayer alarm on the Lock Screen and in the Dynamic
/// Island: how long until it rings again, and a Stop button that ends it for
/// good. AlarmKit needs this to show the snooze countdown.
@available(iOS 26.0, *)
struct WakeUpAlarmActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<WakeUpMetadata>.self) { context in
            HStack(spacing: 12) {
                Image(systemName: icon(context.state)).font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label(context.state)).font(.headline)
                    remaining(context.state).font(.title3.weight(.semibold))
                }
                Spacer()
                stopButton(context.state)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.6))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(label(context.state), systemImage: icon(context.state)).font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    remaining(context.state).font(.title3.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    stopButton(context.state)
                }
            } compactLeading: {
                Image(systemName: "alarm")
            } compactTrailing: {
                remaining(context.state).frame(maxWidth: 48)
            } minimal: {
                Image(systemName: "alarm")
            }
        }
    }

    private func isSnoozed(_ state: AlarmPresentationState) -> Bool {
        if case .countdown = state.mode { return true }
        return false
    }

    private func label(_ state: AlarmPresentationState) -> String {
        isSnoozed(state) ? "Snoozed" : "Prayer alarm"
    }

    private func icon(_ state: AlarmPresentationState) -> String {
        isSnoozed(state) ? "zzz" : "alarm"
    }

    /// Ends the alarm for good, so a snooze never rings again.
    private func stopButton(_ state: AlarmPresentationState) -> some View {
        Button(intent: StopPrayerAlarmIntent(alarmID: state.alarmID)) {
            Label("Stop", systemImage: "stop.fill").font(.headline)
        }
        .tint(Color(red: 1, green: 0.62, blue: 0.4))
        .accessibilityLabel("Stop alarm")
    }

    @ViewBuilder
    private func remaining(_ state: AlarmPresentationState) -> some View {
        switch state.mode {
        case .countdown(let countdown):
            Text(timerInterval: Date.now...max(Date.now, countdown.fireDate), countsDown: true)
                .monospacedDigit()
        default:
            Text("")
        }
    }
}
#endif
