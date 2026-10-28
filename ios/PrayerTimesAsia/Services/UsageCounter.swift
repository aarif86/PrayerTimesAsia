import Foundation
import UIKit

/// Anonymous usage counts, sent to TelemetryDeck (privacy-first: no IP
/// addresses stored, nothing linked to a person). The web app and the Android
/// app send the same events with the same keys, so one dashboard shows all.
/// See docs/analytics.md.
///
/// What is sent: a random ID made on this phone, the app version, iOS version,
/// language, and the city and country of the place in use (never coordinates).
/// Nothing is sent until config/analytics.json in the GitHub repo has an App
/// ID, when Settings → Privacy → Share anonymous usage counts is off, or in demo mode.
enum UsageCounter {
    static let configURL = URL(string: "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/config/analytics.json")!
    static let endpoint = URL(string: "https://nom.telemetrydeck.com/v2/")!
    /// App opens closer together than this count once.
    static let openGap: TimeInterval = 3_600

    private static let idKey = "usage.id"
    private static let openedKey = "usage.opened"
    private static let configKey = "usage.config"
    private static let configFetchedKey = "usage.configFetched"

    struct Config: Codable, Equatable {
        var telemetryDeckAppID: String
        var enabled: Bool

        init(telemetryDeckAppID: String, enabled: Bool) {
            self.telemetryDeckAppID = telemetryDeckAppID
            self.enabled = enabled
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            telemetryDeckAppID = (try? c.decodeIfPresent(String.self, forKey: .telemetryDeckAppID)) ?? ""
            enabled = (try? c.decodeIfPresent(Bool.self, forKey: .enabled)) ?? true
        }

        var appID: String? {
            let id = telemetryDeckAppID.trimmingCharacters(in: .whitespaces)
            return enabled && !id.isEmpty ? id : nil
        }
    }

    /// The keys every event carries; the same names as the web and Android apps.
    static func payload(version: String, system: String, language: String, city: String?, countryCode: String?) -> [String: String] {
        var out = [
            "App.platform": "ios",
            "App.version": version,
            "App.language": String(language.prefix(2)).lowercased(),
            "TelemetryDeck.AppInfo.version": version,
            "TelemetryDeck.Device.platform": "iOS",
            "TelemetryDeck.Device.operatingSystem": "iOS",
            "TelemetryDeck.Device.systemVersion": system,
            "TelemetryDeck.RunContext.locale": language,
        ]
        if let cc = countryCode?.uppercased(), cc.count == 2, cc.allSatisfy(\.isLetter) {
            out["Place.country"] = cc
            out["TelemetryDeck.UserPreference.region"] = cc
        }
        if let city = cleanCity(city) { out["Place.city"] = city }
        return out
    }

    /// A place name fit to count: not the "Current location" placeholder, and short.
    static func cleanCity(_ name: String?) -> String? {
        let t = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, t != "Current location" else { return nil }
        return String(t.prefix(60))
    }

    static func shouldCountOpen(last: Date?, now: Date) -> Bool {
        guard let last else { return true }
        return now.timeIntervalSince(last) >= openGap
    }

    /// Counts this app open (and the first ever as an install), at most once an hour.
    @MainActor
    static func countOpen(place: Place?) {
        let defaults = UserDefaults.standard
        let now = Date.now
        guard shouldCountOpen(last: defaults.object(forKey: openedKey) as? Date, now: now) else { return }
        defaults.set(now, forKey: openedKey)
        let fresh = defaults.string(forKey: idKey) == nil
        if fresh { defaults.set(UUID().uuidString, forKey: idKey) }
        let id = defaults.string(forKey: idKey) ?? UUID().uuidString
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let body = payload(version: version, system: UIDevice.current.systemVersion,
                           language: Locale.preferredLanguages.first ?? "en",
                           city: place?.district ?? place?.name, countryCode: place?.countryCode)
        let types = fresh ? ["App.installed", "App.opened"] : ["App.opened"]
        Task.detached(priority: .utility) { await send(types: types, payload: body, clientUser: id) }
    }

    private static func send(types: [String], payload: [String: String], clientUser: String) async {
        guard let appID = await config()?.appID else { return }
        #if DEBUG
        let test = true
        #else
        let test = false
        #endif
        let signals: [[String: Any]] = types.map {
            ["appID": appID, "clientUser": clientUser, "type": $0, "isTestMode": test, "payload": payload]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: signals) else { return }
        var request = URLRequest(url: endpoint, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        _ = try? await URLSession.shared.data(for: request)
    }

    /// The switch and App ID from the repo, re-read at most twice a day.
    private static func config() async -> Config? {
        let defaults = UserDefaults.standard
        let cached = defaults.data(forKey: configKey).flatMap { try? JSONDecoder().decode(Config.self, from: $0) }
        if let cached, let at = defaults.object(forKey: configFetchedKey) as? Date, Date.now.timeIntervalSince(at) < 12 * 3_600 {
            return cached
        }
        var request = URLRequest(url: configURL, timeoutInterval: 20)
        request.setValue("PrayerTimesAsia/1.0 (iOS)", forHTTPHeaderField: "User-Agent")
        guard let result = try? await URLSession.shared.data(for: request),
              (result.1 as? HTTPURLResponse)?.statusCode == 200,
              let fresh = try? JSONDecoder().decode(Config.self, from: result.0) else { return cached }
        defaults.set(try? JSONEncoder().encode(fresh), forKey: configKey)
        defaults.set(Date.now, forKey: configFetchedKey)
        return fresh
    }
}
