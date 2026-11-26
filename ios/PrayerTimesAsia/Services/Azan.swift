import Foundation
import UserNotifications

/// The azan for prayer time alerts. Each voice has up to three files in
/// Resources/, made by tools/make_azan.sh (see docs/azan-clip-spec.md):
///   azan-VOICE-short.caf  the opening takbir only (the default length)
///   azan-VOICE.caf        the "full" azan
///   azan-VOICE-fajr.caf   a Fajr azan, played at Fajr when Full is chosen
/// iOS plays at most 30 seconds of a notification sound (a longer file falls
/// back to the default sound), so the iPhone files stop at the end of a phrase
/// before 30 seconds. Android and the web play the full azan.
///
/// A voice only shows once its files are in the app, so a slot waiting for
/// permission (docs/AUDIO_LICENSES.csv) stays hidden until then. With no voices
/// at all the switch stays hidden and alerts use the phone's own sound.
enum Azan {
    enum Sound: Sendable {
        case standard
        /// The chosen voice (nil = the first in the app), full or short, and whether it is Fajr.
        case azan(voice: String?, full: Bool, fajr: Bool)
        case alarm(AlarmSound)
    }
    enum Kind: String, CaseIterable, Sendable { case short = "-short", full = "", fajr = "-fajr" }

    /// Every voice slot, in the order shown. The last four wait for permission.
    static let allVoices = ["asim", "makkah", "khalaf", "sudais", "aqsa", "egypt", "madinah"]

    /// The voices whose recordings are in the app.
    static var voices: [String] { allVoices.filter { has($0, .short) || has($0, .full) } }

    /// The chosen voice, or the first one there if it is missing.
    static func voiceOrDefault(_ voice: String?) -> String? {
        let all = voices
        return all.first { $0 == voice } ?? all.first
    }

    /// True when the app has its own recording, or the person picked their own (see OwnAzan).
    static var isAvailable: Bool { !voices.isEmpty || OwnAzan.isSet }

    static func has(_ voice: String, _ kind: Kind) -> Bool { url(voice, kind) != nil }

    /// Which file plays: Fajr plays the voice's Fajr azan when Full is chosen,
    /// otherwise the short call. A missing length falls back to the other one.
    static func kind(for voice: String, full: Bool, fajr: Bool) -> Kind {
        let short: Kind = has(voice, .short) ? .short : .full
        if fajr { return full && has(voice, .fajr) ? .fajr : short }
        if full { return has(voice, .full) ? .full : .short }
        return short
    }

    static func url(_ voice: String, _ kind: Kind) -> URL? {
        Bundle.main.url(forResource: "azan-\(voice)\(kind.rawValue)", withExtension: "caf")
    }

    static func notificationSound(_ sound: Sound) -> UNNotificationSound {
        switch sound {
        case .standard:
            return .default
        case .azan(let chosen, let full, let fajr):
            // Their own azan (one file for every prayer, Fajr too) comes before the app's.
            if let own = OwnAzan.soundName { return UNNotificationSound(named: UNNotificationSoundName(own)) }
            guard let voice = voiceOrDefault(chosen) else { return .default }
            let k = kind(for: voice, full: full, fajr: fajr)
            guard has(voice, k) else { return .default }
            return UNNotificationSound(named: UNNotificationSoundName("azan-\(voice)\(k.rawValue).caf"))
        case .alarm(let sound):
            // Older iPhones without AlarmKit: the chosen alarm tone as the alert sound.
            guard let file = sound.fileName, hasFile(file) else { return .default }
            return UNNotificationSound(named: UNNotificationSoundName(file))
        }
    }

    private static func hasFile(_ file: String) -> Bool {
        let parts = file.split(separator: ".")
        return Bundle.main.url(forResource: String(parts[0]), withExtension: String(parts[1])) != nil
    }
}
