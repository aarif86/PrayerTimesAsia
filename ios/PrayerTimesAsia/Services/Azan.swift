import Foundation
import UserNotifications

/// The azan for prayer time alerts. The recordings live in Resources/ as
/// azan.caf and azan-subuh.caf, made from one source recording by
/// tools/make_azan.sh. iOS plays at most 30 seconds of a notification sound
/// (longer files fall back to the default sound), so these are the opening of
/// the azan; Android plays it in full.
///
/// Until the recordings are added the switch stays hidden and alerts use the
/// phone's own sound.
enum Azan {
    enum Sound: Sendable { case standard, azan, azanSubuh, alarm(AlarmSound) }

    static let fileName = "azan.caf"
    static let subuhFileName = "azan-subuh.caf"

    static var isAvailable: Bool { has(fileName) }

    static func notificationSound(_ sound: Sound) -> UNNotificationSound {
        switch sound {
        case .standard:
            return .default
        case .azan:
            return has(fileName) ? UNNotificationSound(named: UNNotificationSoundName(fileName)) : .default
        case .alarm(let sound):
            // Older iPhones without AlarmKit: the chosen alarm tone as the alert sound.
            guard let file = sound.fileName, has(file) else { return .default }
            return UNNotificationSound(named: UNNotificationSoundName(file))
        case .azanSubuh:
            // No separate Subuh recording? The ordinary azan is the next best thing.
            if has(subuhFileName) { return UNNotificationSound(named: UNNotificationSoundName(subuhFileName)) }
            return notificationSound(.azan)
        }
    }

    private static func has(_ file: String) -> Bool {
        let parts = file.split(separator: ".")
        return Bundle.main.url(forResource: String(parts[0]), withExtension: String(parts[1])) != nil
    }
}
