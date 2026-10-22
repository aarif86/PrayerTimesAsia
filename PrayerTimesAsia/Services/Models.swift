import Foundation

struct Place: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var name: String
    var region: String?
    var countryCode: String?
    var countryName: String?
    var timeZoneID: String
    var coordinates: Coordinates
    /// Regency / city level (Apple's subAdministrativeArea), e.g. "Kota Bandung".
    /// Used to find the Kemenag timetable in Indonesia.
    var district: String? = nil

    var timeZone: TimeZone { TimeZone(identifier: timeZoneID) ?? .current }
    var profile: CountryProfile { AsiaRegions.profile(for: countryCode) ?? AsiaRegions.fallback }
    var isInAsia: Bool { AsiaRegions.profile(for: countryCode) != nil }

    var subtitle: String {
        [region, countryName].compactMap { $0 }.filter { $0 != name }.joined(separator: ", ")
    }

    /// Same spot for our purposes (prayer times differ by < 1 min within ~15 km).
    func isNear(_ other: Place) -> Bool {
        Geo.distanceKm(coordinates, other.coordinates) < 2
    }
}

struct TripStop: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var countryCode: String
    var countryName: String
    var placeName: String
    var arrived: Date
}

/// When the Subuh wake-up alarm rings, relative to Subuh or Syuruk.
enum WakeUpTiming: String, Codable, CaseIterable, Identifiable, Sendable {
    case atFajr, fajrPlus15, sunriseMinus30, sunriseMinus15

    var id: String { rawValue }

    func label(_ naming: NamingStyle) -> String {
        let fajr = Prayer.fajr.name(naming), sunrise = Prayer.sunrise.name(naming)
        switch self {
        case .atFajr: return "At \(fajr)"
        case .fajrPlus15: return "15 min after \(fajr) begins"
        case .sunriseMinus30: return "30 min before \(sunrise)"
        case .sunriseMinus15: return "15 min before \(sunrise)"
        }
    }

    func date(in day: PrayerDay) -> Date {
        switch self {
        case .atFajr: day.time(.fajr)
        case .fajrPlus15: day.time(.fajr).addingTimeInterval(15 * 60)
        case .sunriseMinus30: day.time(.sunrise).addingTimeInterval(-30 * 60)
        case .sunriseMinus15: day.time(.sunrise).addingTimeInterval(-15 * 60)
        }
    }
}

/// Light, dark, or follow the phone.
enum Appearance: String, Codable, CaseIterable, Identifiable, Sendable {
    case system, light, dark
    var id: String { rawValue }
    var label: String {
        switch self {
        case .system: "Automatic"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

/// Everything the user chooses, persisted as one JSON blob. `nil` overrides
/// mean "automatic for the country I'm in" - the travel-mode behaviour.
struct Preferences: Codable, Equatable, Sendable {
    var hasOnboarded = false
    var useGPS = true
    var manualPlace: Place?
    var savedPlaces: [Place] = []
    var home: Place?

    var methodOverrideID: String?
    var asrOverride: AsrSchool?
    var namingOverride: NamingStyle?
    var use24Hour = false
    var hijriAdjustment = 0

    var notificationsEnabled = false
    var notifyPrayers: Set<Prayer> = Set(Prayer.obligatory)
    var reminderMinutesBefore = 0

    var musafirThresholdKm: Double = 81
    /// Pinned JAKIM zone; nil = nearest to where you are.
    var jakimZoneOverride: String?

    // Travel-mode memory
    var lastCountryCode: String?
    var arrivedAt: Date?
    var arrivalBannerDismissed = true
    var trip: [TripStop] = []

    /// Keep a Live Activity countdown to the next prayer on the Lock Screen.
    var liveActivityEnabled = false

    // Prayer tracker (opt-in)
    var trackerEnabled = false
    /// "yyyy-MM-dd" (local date) → prayers marked as prayed.
    var prayedLog: [String: Set<Prayer>] = [:]
    /// Days excused (haid, illness, ...): they keep the streak alive.
    var excusedDays: Set<String> = []

    /// Subuh wake-up alarm; nil = off.
    var wakeUp: WakeUpTiming?

    /// Whose Ramadan/Eid dates you follow; nil = the authority of your home country.
    var communityAuthority: String?

    var appearance: Appearance = .system
    /// Under each prayer, the word used where you are, when it differs from yours.
    var showLocalNames = true
    /// The "Turn on prayer alerts" bar on the Prayer screen was closed.
    var alertsPromptDismissed = false

    private static let key = "preferences.v1"

    init() {}

    /// Field-by-field with defaults, so adding a preference in an update never
    /// throws away the ones a user already set.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = Preferences()
        func v<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
            (try? c.decodeIfPresent(T.self, forKey: key)) ?? fallback
        }
        hasOnboarded = v(.hasOnboarded, d.hasOnboarded)
        useGPS = v(.useGPS, d.useGPS)
        manualPlace = v(.manualPlace, d.manualPlace)
        savedPlaces = v(.savedPlaces, d.savedPlaces)
        home = v(.home, d.home)
        methodOverrideID = v(.methodOverrideID, d.methodOverrideID)
        asrOverride = v(.asrOverride, d.asrOverride)
        namingOverride = v(.namingOverride, d.namingOverride)
        use24Hour = v(.use24Hour, d.use24Hour)
        hijriAdjustment = v(.hijriAdjustment, d.hijriAdjustment)
        notificationsEnabled = v(.notificationsEnabled, d.notificationsEnabled)
        notifyPrayers = v(.notifyPrayers, d.notifyPrayers)
        reminderMinutesBefore = v(.reminderMinutesBefore, d.reminderMinutesBefore)
        musafirThresholdKm = v(.musafirThresholdKm, d.musafirThresholdKm)
        jakimZoneOverride = v(.jakimZoneOverride, d.jakimZoneOverride)
        lastCountryCode = v(.lastCountryCode, d.lastCountryCode)
        arrivedAt = v(.arrivedAt, d.arrivedAt)
        arrivalBannerDismissed = v(.arrivalBannerDismissed, d.arrivalBannerDismissed)
        trip = v(.trip, d.trip)
        liveActivityEnabled = v(.liveActivityEnabled, d.liveActivityEnabled)
        trackerEnabled = v(.trackerEnabled, d.trackerEnabled)
        prayedLog = v(.prayedLog, d.prayedLog)
        excusedDays = v(.excusedDays, d.excusedDays)
        wakeUp = v(.wakeUp, d.wakeUp)
        communityAuthority = v(.communityAuthority, d.communityAuthority)
        appearance = v(.appearance, d.appearance)
        showLocalNames = v(.showLocalNames, d.showLocalNames)
        alertsPromptDismissed = v(.alertsPromptDismissed, d.alertsPromptDismissed)
    }

    static func load() -> Preferences {
        guard let data = UserDefaults.standard.data(forKey: key),
              let prefs = try? JSONDecoder().decode(Preferences.self, from: data) else { return Preferences() }
        return prefs
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}
