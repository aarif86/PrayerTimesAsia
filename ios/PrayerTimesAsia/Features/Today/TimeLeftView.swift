import SwiftUI

/// The one countdown on the Prayer screen. While a prayer is open (and not
/// yet ticked) it says how long is left to pray it: "19m left to pray". Every
/// prayer's time ends when the next one starts (Subuh at Syuruk), so this is
/// the same moment as the next prayer, said the way busy people ask it.
/// Between Syuruk and Zohor, or once ticked, it counts to the next prayer.
/// Same wording as the web app and Android.
struct Countdown {
    let count: String
    let label: String
    let urgent: Bool
    let done: Bool
    var text: String { "\(count) \(label)" }

    @MainActor init(now: Date, next: (prayer: Prayer, time: Date), model: AppModel) {
        let w = model.window(at: now)
        done = w.map { model.prefs.trackerEnabled && model.isPrayed($0.prayer, on: $0.start) } ?? false
        if let w, !done {
            count = TodayView.short(w.end.timeIntervalSince(now))
            label = "left to pray"
            urgent = w.prayer != .isha && now >= w.nudgeAt
        } else {
            count = TodayView.short(next.time.timeIntervalSince(now))
            label = "until \(next.prayer.name(model.naming, isFriday: model.isFriday(next.time)))"
            urgent = false
        }
    }
}

/// Big and Simple: for older eyes and anyone who wants only the times. The
/// prayer now, how long is left to pray it, and the five times in big
/// rows. Tap a row to tick it when the tracker is on. Nothing else.
struct SimpleTimes: View {
    @Environment(AppModel.self) private var model
    let now: Date
    let day: PrayerDay
    let current: (prayer: Prayer, time: Date)?
    let next: (prayer: Prayer, time: Date)?

    var body: some View {
        VStack(spacing: 18) {
            VStack(spacing: 6) {
                if let current {
                    HStack(spacing: 10) {
                        Text(current.prayer.name(model.naming, isFriday: model.isFriday(current.time)))
                            .font(.system(size: 56, weight: .heavy, design: .rounded))
                            .foregroundStyle(current.prayer.tint)
                            .minimumScaleFactor(0.6).lineLimit(1)
                        if let next, Countdown(now: now, next: next, model: model).done {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 34)).foregroundStyle(Theme.accent)
                        }
                    }
                }
                if let next {
                    let t = Countdown(now: now, next: next, model: model)
                    Text(t.text).font(.largeTitle.weight(.bold).monospacedDigit())
                        .foregroundStyle(t.urgent ? Theme.accent : .primary)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 12)
            VStack(spacing: 10) {
                ForEach(Prayer.allCases, id: \.self) { prayer in row(prayer) }
            }
        }
        // Already big: don't let the phone's largest text sizes squeeze the rows.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private func row(_ prayer: Prayer) -> some View {
        let time = day.time(prayer)
        let trackable = model.prefs.trackerEnabled && prayer != .sunrise && time <= now
        let prayed = trackable && model.isPrayed(prayer, on: time)
        let isNow = current?.prayer == prayer && current?.time == time
        return Button {
            if trackable { withAnimation(.snappy) { model.togglePrayed(prayer, on: time) } }
        } label: {
            HStack(spacing: 14) {
                Text(prayer.name(model.naming, isFriday: model.isFriday(time)))
                    .font(.system(size: 28, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 8)
                Text(model.formatted(time)).font(.system(size: 28, weight: .semibold).monospacedDigit())
                    .lineLimit(1).fixedSize()
                if trackable {
                    Image(systemName: prayed ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 30)).foregroundStyle(prayed ? Theme.accent : .secondary)
                }
            }
            .padding(.horizontal, 20)
            .frame(minHeight: 76)
            .background(isNow ? prayer.tint.opacity(0.22) : Color.primary.opacity(0.07),
                        in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(alignment: .leading) {
                UnevenRoundedRectangle(topLeadingRadius: 20, bottomLeadingRadius: 20).fill(prayer.tint).frame(width: 8)
            }
        }
        .buttonStyle(.plain)
        .disabled(!trackable)
        .accessibilityLabel("\(prayer.name(model.naming)) \(model.formatted(time))\(prayed ? ", prayed" : "")")
    }
}
