import ActivityKit
import Foundation
import WidgetKit

/// Keeps the widgets and the Live Activity in step with the app.
@MainActor
enum WidgetBridge {
    /// Writes the next 7 days for the widgets and asks WidgetKit to reload.
    static func publish(_ model: AppModel) {
        guard let snapshot = snapshot(model) else { return }
        snapshot.save()
        WidgetCenter.shared.reloadAllTimelines()
        LiveCountdown.refresh(model)
    }

    /// What the widgets show, built from the app's resolver.
    static func snapshot(_ model: AppModel) -> WidgetSnapshot? {
        guard let place = model.activePlace else { return nil }
        var days: [WidgetSnapshot.Day] = []
        for offset in 0..<7 {
            guard let d = model.day(containing: Date.now.addingTimeInterval(Double(offset) * 86_400)) else { continue }
            var times: [String: Date] = [:]
            for p in Prayer.allCases { times[p.rawValue] = d.time(p) }
            days.append(.init(year: d.year, month: d.month, day: d.day, times: times))
        }
        let today = model.day(containing: .now)
        let snapshot = WidgetSnapshot(
            placeName: place.name,
            flag: place.isInAsia ? place.profile.flag : "",
            timeZoneID: place.timeZoneID,
            naming: model.naming,
            use24Hour: model.prefs.use24Hour,
            sourceLabel: today?.officialSource ?? model.method.shortName,
            days: days,
            updated: .now,
            hijriAdjustment: model.prefs.hijriAdjustment)
        return snapshot
    }
}

/// The Live Activity has no push server behind it, so the app moves it on to
/// the next prayer whenever it runs; between runs the countdown keeps ticking
/// on its own and goes stale (dimmed) once its prayer time passes.
@MainActor
enum LiveCountdown {
    static var isAvailable: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    static func refresh(_ model: AppModel) {
        let running = Activity<PrayerActivityAttributes>.activities
        guard model.prefs.liveActivityEnabled, isAvailable, let place = model.activePlace,
              let next = model.next(after: .now) else {
            end(running)
            return
        }
        let state = PrayerActivityAttributes.ContentState(
            prayerName: next.prayer.name(model.naming, isFriday: model.isFriday(next.time)),
            symbol: next.prayer.symbol,
            time: next.time,
            timeText: model.formatted(next.time))
        let content = ActivityContent(state: state, staleDate: next.time.addingTimeInterval(15 * 60))

        if let current = running.first, current.attributes.placeName == place.name {
            if current.content.state != state {
                Task { await current.update(content) }
            }
            end(Array(running.dropFirst()))
            return
        }
        end(running)
        _ = try? Activity.request(attributes: PrayerActivityAttributes(placeName: place.name),
                                  content: content, pushType: nil)
    }

    static func end(_ activities: [Activity<PrayerActivityAttributes>]) {
        for activity in activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }
}
