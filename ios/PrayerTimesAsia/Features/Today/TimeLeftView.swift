import SwiftUI

/// "Zohor is open until 4:08 PM · 2h 33m left". Busy people ask how long they
/// still have, not only when the next prayer starts. Nothing between sunrise
/// and Zohor, when no prayer is due. Same wording as the web app.
struct TimeLeftText {
    let line: String
    let left: String?
    let urgent: Bool
    let done: Bool

    @MainActor init?(now: Date, model: AppModel) {
        guard let w = model.window(at: now) else { return nil }
        let name = w.prayer.name(model.naming, isFriday: model.isFriday(w.start))
        let fajr = Prayer.fajr.name(model.naming)
        done = model.prefs.trackerEnabled && model.isPrayed(w.prayer, on: w.start)
        urgent = !done && w.prayer != .isha && now >= w.nudgeAt
        if done {
            line = "\(name) prayed. Alhamdulillah."; left = nil
        } else if w.prayer == .isha {
            line = "\(name) is open until \(fajr) at \(model.formatted(w.end))."
            left = "\(TodayView.short(w.end.timeIntervalSince(now))) left"
        } else {
            line = "\(name) is open until \(model.formatted(w.end))."
            left = "\(TodayView.short(w.end.timeIntervalSince(now))) left"
        }
    }
}

struct TimeLeftBar: View {
    @Environment(AppModel.self) private var model
    let now: Date

    var body: some View {
        if let t = TimeLeftText(now: now, model: model) {
            HStack(spacing: 8) {
                Image(systemName: t.done ? "checkmark.circle.fill" : "hourglass")
                    .foregroundStyle(t.urgent ? Theme.accent : .secondary)
                Text(t.line).frame(maxWidth: .infinity, alignment: .leading)
                if let left = t.left {
                    Text(left).font(.subheadline.weight(.bold).monospacedDigit())
                        .foregroundStyle(t.urgent ? Theme.accent : .primary)
                        .fixedSize()
                }
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(t.done ? .secondary : .primary)
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(t.urgent ? Theme.accent.opacity(0.18) : Color.primary.opacity(0.07),
                        in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .accessibilityElement(children: .combine)
        }
    }
}

/// Big and Simple: for older eyes and anyone who wants only the times. The
/// prayer now, how long is left, the next prayer, and the five times in big
/// rows. Tap a row to tick it when the tracker is on. Nothing else.
struct SimpleTimes: View {
    @Environment(AppModel.self) private var model
    let now: Date
    let day: PrayerDay
    let current: (prayer: Prayer, time: Date)?
    let next: (prayer: Prayer, time: Date)?

    var body: some View {
        let t = TimeLeftText(now: now, model: model)
        VStack(spacing: 18) {
            VStack(spacing: 6) {
                if let current, current.prayer != .sunrise, t != nil {
                    Text(current.prayer.name(model.naming, isFriday: model.isFriday(current.time)))
                        .font(.system(size: 56, weight: .heavy, design: .rounded))
                        .foregroundStyle(current.prayer.tint)
                        .minimumScaleFactor(0.6).lineLimit(1)
                }
                if let t {
                    Text(t.line).font(.title2.weight(.semibold)).multilineTextAlignment(.center)
                        .foregroundStyle(t.urgent ? Theme.accent : .primary)
                    if let left = t.left { Text(left).font(.largeTitle.weight(.bold).monospacedDigit()) }
                }
                if let next {
                    Text("Next is **\(next.prayer.name(model.naming, isFriday: model.isFriday(next.time)))** at **\(model.formatted(next.time))**, in \(TodayView.short(next.time.timeIntervalSince(now)))")
                        .font(.title3).foregroundStyle(.secondary).multilineTextAlignment(.center)
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
