import Foundation

struct Place: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var name: String
    var region: String?
    var countryCode: String?
    var countryName: String?
    var timeZoneID: String
    var coordinates: Coordinates

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

    private static let key = "preferences.v1"

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
