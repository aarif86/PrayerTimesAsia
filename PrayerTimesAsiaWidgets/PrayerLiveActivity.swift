import ActivityKit
import SwiftUI
import WidgetKit

struct PrayerLiveActivity: Widget {
    private static let glow = Color(red: 1, green: 0.78, blue: 0.54)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrayerActivityAttributes.self) { context in
            HStack(spacing: 14) {
                Image(systemName: context.state.symbol)
                    .font(.title2)
                    .foregroundStyle(Self.glow)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(context.state.prayerName) at \(context.state.timeText)")
                        .font(.headline)
                    Text(context.attributes.placeName)
                        .font(.caption)
                        .opacity(0.75)
                }
                Spacer()
                countdown(context.state.time)
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
            }
            .padding(16)
            .foregroundStyle(.white)
            .activityBackgroundTint(Color(red: 0.07, green: 0.09, blue: 0.25).opacity(0.92))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.prayerName, systemImage: context.state.symbol)
                        .font(.headline)
                        .foregroundStyle(Self.glow)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.timeText).font(.headline)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.attributes.placeName).font(.caption).opacity(0.75)
                        Spacer()
                        countdown(context.state.time).font(.title2.weight(.semibold))
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.symbol).foregroundStyle(Self.glow)
            } compactTrailing: {
                countdown(context.state.time)
                    .frame(maxWidth: 52)
                    .font(.caption.weight(.semibold))
            } minimal: {
                Image(systemName: context.state.symbol).foregroundStyle(Self.glow)
            }
            .keylineTint(Self.glow)
        }
    }

    private func countdown(_ time: Date) -> some View {
        Text(timerInterval: Date.now...max(Date.now, time), countsDown: true)
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
    }
}
