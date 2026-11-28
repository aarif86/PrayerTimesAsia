import Foundation
import UIKit
import WidgetKit

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

    // MARK: Barakah Picks counts

    enum CardEvent: String { case seen = "Card.seen", tapped = "Card.tapped" }
    private static let cardSeenKey = "usage.cardSeen"

    /// A card counts as seen once a day on each phone, however often it scrolls past.
    static func shouldCountSeen(_ seen: [String: String], cardID: String, today: String) -> Bool {
        seen[cardID] != today
    }

    /// Counts a card seen or tapped. Only the card and the usual anonymous keys
    /// are sent, never who tapped. AppModel.countCard checks Settings first.
    @MainActor
    static func countCard(_ event: CardEvent, card: CommunityCard, placement: String, place: Place?) {
        let defaults = UserDefaults.standard
        if event == .seen {
            let c = Calendar.current.dateComponents([.year, .month, .day], from: .now)
            let today = "\(c.year ?? 0)-\(c.month ?? 0)-\(c.day ?? 0)"
            let seen = defaults.dictionary(forKey: cardSeenKey) as? [String: String] ?? [:]
            guard shouldCountSeen(seen, cardID: card.id, today: today) else { return }
            var next = seen.filter { $0.value == today }
            next[card.id] = today
            defaults.set(next, forKey: cardSeenKey)
        }
        if defaults.string(forKey: idKey) == nil { defaults.set(UUID().uuidString, forKey: idKey) }
        let id = defaults.string(forKey: idKey) ?? UUID().uuidString
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        var body = payload(version: version, system: UIDevice.current.systemVersion,
                           language: Locale.preferredLanguages.first ?? "en",
                           city: place?.district ?? place?.name, countryCode: place?.countryCode)
        body["Card.id"] = card.id
        body["Card.kind"] = card.kind.rawValue
        body["Card.placement"] = placement
        Task.detached(priority: .utility) { await send(types: [event.rawValue], payload: body, clientUser: id) }
    }

    // MARK: A day of use (App.daySummary)

    /// Minutes on screen, opens and screens used on one day. Kept on the phone and
    /// sent once, as one event, on the first open of a later day. The same as the
    /// web and Android apps (docs/analytics.md).
    struct DayTally: Codable, Equatable {
        var day: String
        var seconds: Double = 0
        var opens: Int = 0
        var screens: [String] = []
        /// Things done today worth knowing about (see `actions`). Optional so a tally saved before this release still loads.
        var actions: [String]?
    }

    /// Things done today, each sent as true or false (Did.qiblaCompass ...). The same list on the web and Android apps.
    static let actions = ["qiblaCompass", "qiblaFaced", "falakShadow", "falakLevel", "falakAR"]

    /// One stretch on screen counts at most this long (a phone left open on a table).
    static let maxStretch: TimeInterval = 2 * 3_600
    static let screens = ["prayer", "qibla", "falak", "masjid", "settings"]
    private static let tallyKey = "usage.day"
    private static var activeSince: Date?

    /// Starts today's tally, handing back the older one if it has anything to send.
    static func roll(_ t: DayTally?, today: String) -> (tally: DayTally, finished: DayTally?) {
        if let t, t.day == today { return (t, nil) }
        guard let t, t.seconds > 0 || t.opens > 0 else { return (DayTally(day: today), nil) }
        return (DayTally(day: today), t)
    }

    static func adding(_ seconds: TimeInterval, to t: DayTally) -> DayTally {
        var out = t
        out.seconds += max(0, min(maxStretch, seconds.rounded()))
        return out
    }

    static func adding(screen: String, to t: DayTally) -> DayTally {
        var out = t
        if !out.screens.contains(screen) { out.screens.append(screen) }
        return out
    }

    static func adding(action: String, to t: DayTally) -> DayTally {
        var out = t
        var have = out.actions ?? []
        if !have.contains(action) { have.append(action) }
        out.actions = have
        return out
    }

    /// How the app is set up, as short words and yes or no (never anything typed by the person,
    /// never a place). Sent once a day inside App.daySummary; the same keys as the web and Android apps.
    static func settingsPayload(_ p: Preferences, widgets: Int) -> [String: String] {
        let alerts = p.notificationsEnabled ? p.notifyPrayers.count : 0
        let alarms = [p.wakeUp != nil, p.sahurAlarm != nil, p.dhuhrAlarm != nil, p.asrAlarm != nil, p.maghribAlarm != nil, p.ishaAlarm != nil].filter { $0 }.count
        return [
            "Pref.look": p.todayStyle.rawValue,
            "Pref.theme": p.appearance.rawValue,
            "Pref.language": p.appLanguageOverride?.rawValue ?? "auto",
            "Pref.alertPrayers": String(alerts),
            "Pref.alertsOn": String(alerts > 0),
            "Pref.azanSound": String(p.azanSound),
            "Pref.azanVoice": p.azanVoice,
            "Pref.azanLength": p.azanFull ? "full" : "short",
            "Pref.ownAzan": String(OwnAzan.isSet),
            "Pref.alarms": String(alarms),
            "Pref.largeText": String(p.largeText),
            "Pref.tracker": String(p.trackerEnabled),
            "Pref.myMasjid": String(p.myMasjid != nil),
            "Pref.widgets": String(widgets),
        ]
    }

    private static let widgetsKey = "usage.widgets"

    /// How many widgets are on the Home Screen or Lock Screen, as last asked. Refreshed each time the app comes on screen.
    static var widgetCount: Int { UserDefaults.standard.integer(forKey: widgetsKey) }

    static func refreshWidgetCount() {
        WidgetCenter.shared.getCurrentConfigurations { result in
            guard case .success(let found) = result else { return }
            UserDefaults.standard.set(found.count, forKey: widgetsKey)
        }
    }

    static func minutesBand(_ minutes: Double) -> String {
        switch minutes {
        case ..<1: return "under 1"
        case ..<5: return "1 to 5"
        case ..<15: return "5 to 15"
        case ..<30: return "15 to 30"
        case ..<60: return "30 to 60"
        default: return "over 60"
        }
    }

    static func dayPayload(_ base: [String: String], _ t: DayTally, settings: [String: String] = [:]) -> [String: String] {
        var out = base
        out["Day.date"] = t.day
        out["Day.minutes"] = String(Int((t.seconds / 60).rounded()))
        out["Day.minutesBand"] = minutesBand(t.seconds / 60)
        out["Day.opens"] = String(t.opens)
        out["Day.screens"] = t.screens.sorted().joined(separator: ",")
        for s in screens { out["Used.\(s)"] = t.screens.contains(s) ? "true" : "false" }
        for a in actions { out["Did.\(a)"] = (t.actions ?? []).contains(a) ? "true" : "false" }
        return out.merging(settings) { _, new in new }
    }

    static func localDay(_ date: Date = .now) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    private static func readTally() -> DayTally? {
        UserDefaults.standard.data(forKey: tallyKey).flatMap { try? JSONDecoder().decode(DayTally.self, from: $0) }
    }

    private static func writeTally(_ t: DayTally) {
        UserDefaults.standard.set(try? JSONEncoder().encode(t), forKey: tallyKey)
    }

    /// The app came on screen: one open for today, start the clock, and on the
    /// first open of a new day send the last day's summary. AppModel checks Settings first.
    @MainActor
    static func tallyStart(place: Place?, settings: [String: String] = [:]) {
        let (tally, finished) = roll(readTally(), today: localDay())
        var t = tally
        t.opens += 1
        writeTally(t)
        activeSince = .now
        guard let finished else { return }
        let defaults = UserDefaults.standard
        if defaults.string(forKey: idKey) == nil { defaults.set(UUID().uuidString, forKey: idKey) }
        let id = defaults.string(forKey: idKey) ?? UUID().uuidString
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let base = payload(version: version, system: UIDevice.current.systemVersion,
                           language: Locale.preferredLanguages.first ?? "en",
                           city: place?.district ?? place?.name, countryCode: place?.countryCode)
        let body = dayPayload(base, finished, settings: settings)
        Task.detached(priority: .utility) { await send(types: ["App.daySummary"], payload: body, clientUser: id) }
    }

    /// The app left the screen: adds the time since it came on.
    @MainActor
    static func tallyStop() {
        guard let since = activeSince else { return }
        let t = roll(readTally(), today: localDay()).tally
        writeTally(adding(Date.now.timeIntervalSince(since), to: t))
        activeSince = nil
    }

    /// Something worth knowing was done today (Did.qiblaCompass ...). AppModel.usageAction checks Settings first.
    @MainActor
    static func tallyAction(_ action: String) {
        writeTally(adding(action: action, to: roll(readTally(), today: localDay()).tally))
    }

    /// A screen (tab) was used today.
    @MainActor
    static func tallyScreen(_ screen: String) {
        writeTally(adding(screen: screen, to: roll(readTally(), today: localDay()).tally))
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
