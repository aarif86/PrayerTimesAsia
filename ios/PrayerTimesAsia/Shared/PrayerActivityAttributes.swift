import ActivityKit
import Foundation

/// Live Activity: a countdown to the next prayer on the Lock Screen and in the
/// Dynamic Island. Started and refreshed by the app (no push server).
struct PrayerActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var prayerName: String
        var symbol: String
        var time: Date
        var timeText: String
    }

    var placeName: String
}
