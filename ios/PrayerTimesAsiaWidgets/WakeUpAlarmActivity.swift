#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

/// A snoozed prayer alarm on the Lock Screen and in the Dynamic Island: how
/// long until it rings again. AlarmKit needs this to show the snooze countdown.
@available(iOS 26.0, *)
struct WakeUpAlarmActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<WakeUpMetadata>.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "zzz").font(.title3)
                Text("Snoozed").font(.headline)
                Spacer()
                remaining(context.state).font(.title2.weight(.semibold))
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.6))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Snoozed", systemImage: "zzz").font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    remaining(context.state).font(.title3.weight(.semibold))
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
