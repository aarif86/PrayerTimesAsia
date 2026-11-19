import Foundation

/// Where a country's times come from: the authority's timetable the app
/// downloads, the authority's own method calculated on the phone, or a
/// standard method where no authority's times can be used.
enum TimesSource: String, Sendable, Hashable {
    case table, authority, standard
}

/// What the app does by default in each country: whose times it follows, which
/// method, which Asr school, and how prayer names are spelled.
///
/// This table is the heart of "travel mode": land in a new country and these
/// defaults switch automatically (unless the user pinned their own). The rows
/// live in data/countries.json (one copy for all three apps); edit that and run
/// tools/gen_countries.py, which writes Countries.swift.
///
/// The owner's rule: the local official or state religious authority first; a
/// standard method only where no authority's times can be used, and the app says so.
struct CountryProfile: Sendable, Hashable {
    let code: String          // ISO 3166-1 alpha-2
    let name: String
    let methodID: String
    let asr: AsrSchool
    let naming: NamingStyle
    var source: TimesSource = .standard
    /// Who sets the times, e.g. "Diyanet, Türkiye's Presidency of Religious Affairs".
    var authority: String? = nil
    /// What the person should know here, e.g. which masjids differ.
    var note: String? = nil
    /// The country's rule for short summer nights, used when the method has none of its own.
    var highLatitude: HighLatitudeRule? = nil

    /// The country's method, with the country's own rule for short summer nights.
    var method: CalculationMethod { (CalculationMethod.with(id: methodID) ?? .mwl).withHighLatitude(highLatitude) }

    /// A method picked in Settings, used here: keeps its own high-latitude rule, else takes the country's.
    func here(_ m: CalculationMethod) -> CalculationMethod {
        m.highLatitude == .fallback ? m.withHighLatitude(highLatitude) : m
    }

    var flag: String {
        code.uppercased().unicodeScalars
            .compactMap { UnicodeScalar(127397 + $0.value) }
            .map { String($0) }.joined()
    }

    /// Where the times come from, in plain words. Same wording as the web and Android apps.
    func sourceSummary(method: CalculationMethod, pinned: Bool, short: Bool = false) -> String {
        if short {
            if pinned { return "You chose \(method.name) in Settings." }
            switch source {
            case .table: return "Official timetable from \(authority ?? name)."
            case .authority: return "Follows \(authority ?? name)."
            case .standard: return "No official timetable here, so the app uses \(method.name). Your local masjid may differ by a few minutes."
            }
        }
        if pinned {
            let auto = source == .standard ? "the method most used here" : (authority ?? "the local authority")
            return "You chose \(method.name) in Settings. Automatic would follow \(auto)."
        }
        switch source {
        case .table:
            return "Official timetable from \(authority ?? name). When it can't be downloaded, the app works it out with the same method."
        case .authority:
            return "Follows \(authority ?? name), worked out on your phone with their method so it works offline." + (note.map { " \($0)" } ?? "")
        case .standard:
            let lead = note ?? "No official timetable the app can use here yet, so it uses \(method.name), a standard method."
            return lead + " Your local masjid may differ by a few minutes. You can choose another method in Settings, or send us your masjid's timetable."
        }
    }
}

enum AsiaRegions {
    static let profiles: [CountryProfile] = Countries.profiles

    private static let byCode: [String: CountryProfile] =
        Dictionary(uniqueKeysWithValues: profiles.map { ($0.code, $0) })

    static func profile(for countryCode: String?) -> CountryProfile? {
        guard let code = countryCode?.uppercased() else { return nil }
        return byCode[code]
    }

    /// Somewhere not in the table: still works, with the international method.
    static let fallback = CountryProfile(code: "", name: "Worldwide", methodID: "mwl",
                                         asr: .standard, naming: .international, highLatitude: .angle)

    /// Offline country guess from the phone's time zone, for when the phone has
    /// GPS but no data to reverse-geocode (fresh off the plane, no roaming).
    /// The phone's zone updates from the mobile network on landing.
    static func countryCode(forTimeZone id: String) -> String? {
        Countries.timeZoneCountries[id]
    }

    /// A representative zone for a country (first match), used when a search
    /// result comes back without a time zone.
    static func timeZoneID(forCountry code: String?) -> String? {
        guard let code = code?.uppercased() else { return nil }
        return Countries.timeZoneCountries.filter { $0.value == code }.keys.sorted().first
    }
}

extension NamingStyle {
    /// Your names, when you haven't picked any: your phone's language when we
    /// have names in it, else English (International). Your home country does
    /// not change them, so a Singapore user on an English phone sees Fajr, and
    /// picks Malay in Settings for Subuh. Read from the phone only, never from
    /// your IP address.
    static func personal(locale: Locale = .deviceLanguage) -> NamingStyle {
        forLanguage(locale.language.languageCode?.identifier) ?? .international
    }

    /// The names that go with a language code (ISO 639).
    static func forLanguage(_ code: String?) -> NamingStyle? {
        switch code?.lowercased() {
        case "ms": .malay
        case "id", "in": .indonesian
        case "tr": .turkish
        case "ar": .arabicScript
        case "ur": .urdu
        case "bn": .bengali
        case "fr": .french
        default: nil
        }
    }
}

extension Locale {
    /// The phone's own language with its region. `Locale.current` follows the
    /// app's (English only) translations, so it would always say English.
    static var deviceLanguage: Locale {
        let first = Locale(identifier: Locale.preferredLanguages.first ?? "en")
        let lang = first.language.languageCode?.identifier ?? "en"
        guard let region = Locale.current.region?.identifier ?? first.region?.identifier else { return Locale(identifier: lang) }
        return Locale(identifier: "\(lang)_\(region)")
    }
}
