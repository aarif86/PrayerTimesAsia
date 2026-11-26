import Foundation
import UserNotifications

/// The azan for prayer time alerts, in two lengths made from one recording by
/// tools/make_azan.sh (see docs/azan-clip-spec.md):
///   azan-short.caf  the opening takbir only, about 12 seconds (the default)
///   azan.caf        the "full" azan
/// iOS plays at most 30 seconds of a notification sound (a longer file falls
/// back to the default sound), so on iPhone the full azan is the opening, up
/// to the end of a phrase before 30 seconds. Android and the web play it all.
///
/// Fajr always uses the short call: the full recording is the ordinary azan,
/// without the Fajr line. An azan-subuh.caf, if one is ever added, is used for
/// Fajr instead.
///
/// Until the recordings are added the switch stays hidden and alerts use the
/// phone's own sound.
enum Azan {
    enum Sound: Sendable { case standard, azan, azanFull, azanSubuh, alarm(AlarmSound) }

    static let shortFileName = "azan-short.caf"
    static let fullFileName = "azan.caf"
    static let subuhFileName = "azan-subuh.caf"

    /// True when the app has its own recording, or the person picked their own (see OwnAzan).
    static var isAvailable: Bool { has(shortFileName) || has(fullFileName) || OwnAzan.isSet }

    /// True when the app has both lengths, so the Short or Full choice is worth showing.
    static var hasBothLengths: Bool { has(shortFileName) && has(fullFileName) }

    /// The bundled file for a length, falling back to the other length if only one is there.
    static func fileURL(full: Bool) -> URL? {
        let order = full ? [fullFileName, shortFileName] : [shortFileName, fullFileName]
        return order.lazy.compactMap(url).first
    }

    static func notificationSound(_ sound: Sound) -> UNNotificationSound {
        switch sound {
        case .standard:
            return .default
        case .azan, .azanFull:
            // Their own azan (one file for every prayer, Fajr too) comes before the app's.
            if let own = OwnAzan.soundName { return UNNotificationSound(named: UNNotificationSoundName(own)) }
            var full = false
            if case .azanFull = sound { full = true }
            guard let file = fileURL(full: full)?.lastPathComponent else { return .default }
            return UNNotificationSound(named: UNNotificationSoundName(file))
        case .alarm(let sound):
            // Older iPhones without AlarmKit: the chosen alarm tone as the alert sound.
            guard let file = sound.fileName, has(file) else { return .default }
            return UNNotificationSound(named: UNNotificationSoundName(file))
        case .azanSubuh:
            if let own = OwnAzan.soundName { return UNNotificationSound(named: UNNotificationSoundName(own)) }
            // No separate Fajr recording? The short call, which is the same at Fajr.
            if has(subuhFileName) { return UNNotificationSound(named: UNNotificationSoundName(subuhFileName)) }
            return notificationSound(.azan)
        }
    }

    private static func url(_ file: String) -> URL? {
        let parts = file.split(separator: ".")
        return Bundle.main.url(forResource: String(parts[0]), withExtension: String(parts[1]))
    }

    private static func has(_ file: String) -> Bool { url(file) != nil }
}
