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

    static func reschedule(enabled: Bool, alerts: [Alert]) {
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
            // reminder isn't lost in a meeting. iOS honours it once the app's
            // Time Sensitive Notifications capability is on (see PENDING.md);
            // until then it simply behaves as a normal alert.
            content.interruptionLevel = .timeSensitive
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: alert.fireDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            center.add(UNNotificationRequest(identifier: alert.id, content: content, trigger: trigger))
        }
    }
}
