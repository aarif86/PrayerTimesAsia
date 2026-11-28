import Foundation
import UserNotifications

/// Local notifications only - nothing is sent from a server. iOS allows 64
/// pending requests, so we keep 12 days × 5 prayers and top up on every launch.
enum NotificationScheduler {
    struct Alert: Sendable {
        let id: String
        let title: String
        let body: String
        let fireDate: Date
        var sound: Azan.Sound = .standard
        /// Buzz only: quiet hours or the "Buzz only" switch.
        var silent = false
    }

    static func requestPermission() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    /// A sample alert about 3 seconds from now, the way a real one arrives. The person locks the
    /// screen (iOS shows no banner while the app is open). False when alerts are not allowed.
    static func sendTest(title: String, body: String, sound: Azan.Sound, silent: Bool, timeSensitive: Bool = true) async -> Bool {
        let center = UNUserNotificationCenter.current()
        guard await requestPermission() else { return false }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = silent ? nil : Azan.notificationSound(sound)
        content.interruptionLevel = timeSensitive ? .timeSensitive : .active
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
        do { try await center.add(UNNotificationRequest(identifier: "test", content: content, trigger: trigger)) } catch { return false }
        return true
    }

    static func reschedule(enabled: Bool, alerts: [Alert], timeSensitive: Bool = true) {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        guard enabled else { return }
        let now = Date.now
        for alert in alerts.filter({ $0.fireDate > now }).sorted(by: { $0.fireDate < $1.fireDate }).prefix(60) {
            let content = UNMutableNotificationContent()
            content.title = alert.title
            content.body = alert.body
            content.sound = alert.silent ? nil : Azan.notificationSound(alert.sound)
            // Time Sensitive: rings through Focus (Work, Do Not Disturb...) so a
            // reminder isn't lost in a meeting. The capability is in the app's
            // entitlements (project.yml). The person can turn it off in Alerts and alarms.
            content.interruptionLevel = timeSensitive ? .timeSensitive : .active
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: alert.fireDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            center.add(UNNotificationRequest(identifier: alert.id, content: content, trigger: trigger))
        }
    }
}
