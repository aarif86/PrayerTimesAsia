import Foundation

/// What the app does by default in each Asian country: which authority's
/// method, which Asr school, and how prayer names are spelled.
///
/// This table is the heart of "travel mode": land in a new country and these
/// defaults switch automatically (unless the user pinned their own).
struct CountryProfile: Sendable, Hashable {
    let code: String          // ISO 3166-1 alpha-2
    let name: String
    let methodID: String
    let asr: AsrSchool
    let naming: NamingStyle

    var method: CalculationMethod { CalculationMethod.with(id: methodID) ?? .mwl }
    var flag: String {
        code.uppercased().unicodeScalars
            .compactMap { UnicodeScalar(127397 + $0.value) }
            .map { String($0) }.joined()
    }
}

enum AsiaRegions {
    private static func p(_ code: String, _ name: String, _ method: String, _ asr: AsrSchool = .standard,
                          _ naming: NamingStyle = .arabic) -> CountryProfile {
        CountryProfile(code: code, name: name, methodID: method, asr: asr, naming: naming)
    }

    static let profiles: [CountryProfile] = [
        // Southeast Asia
        p("SG", "Singapore", "muis", .standard, .malay),
        p("MY", "Malaysia", "jakim", .standard, .malay),
        p("BN", "Brunei", "sea", .standard, .malay),
        p("ID", "Indonesia", "kemenag", .standard, .indonesian),
        p("TH", "Thailand", "sea"),
        p("VN", "Vietnam", "sea"),
        p("KH", "Cambodia", "sea"),
        p("LA", "Laos", "sea"),
        p("MM", "Myanmar", "sea"),
        p("PH", "Philippines", "sea"),
        p("TL", "Timor-Leste", "sea"),
        // East Asia
        p("JP", "Japan", "mwl"),
        p("KR", "South Korea", "mwl"),
        p("KP", "North Korea", "mwl"),
        p("CN", "China", "mwl", .hanafi),
        p("TW", "Taiwan", "mwl"),
        p("HK", "Hong Kong", "mwl"),
        p("MO", "Macau", "mwl"),
        p("MN", "Mongolia", "mwl", .hanafi),
        // South Asia
        p("IN", "India", "karachi", .hanafi, .southAsian),
        p("PK", "Pakistan", "karachi", .hanafi, .southAsian),
        p("BD", "Bangladesh", "karachi", .hanafi, .southAsian),
        p("AF", "Afghanistan", "karachi", .hanafi, .southAsian),
        p("NP", "Nepal", "karachi", .hanafi, .southAsian),
        p("BT", "Bhutan", "karachi", .hanafi, .southAsian),
        p("LK", "Sri Lanka", "karachi", .standard, .southAsian),
        p("MV", "Maldives", "karachi", .standard, .southAsian),
        // Central Asia
        p("KZ", "Kazakhstan", "mwl", .hanafi),
        p("UZ", "Uzbekistan", "mwl", .hanafi),
        p("KG", "Kyrgyzstan", "mwl", .hanafi),
        p("TJ", "Tajikistan", "mwl", .hanafi),
        p("TM", "Turkmenistan", "mwl", .hanafi),
        // West Asia
        p("SA", "Saudi Arabia", "ummalqura"),
        p("AE", "United Arab Emirates", "dubai"),
        p("QA", "Qatar", "qatar"),
        p("KW", "Kuwait", "kuwait"),
        p("BH", "Bahrain", "ummalqura"),
        p("OM", "Oman", "mwl"),
        p("YE", "Yemen", "mwl"),
        p("JO", "Jordan", "mwl"),
        p("PS", "Palestine", "mwl"),
        p("IL", "Israel", "mwl"),
        p("LB", "Lebanon", "mwl"),
        p("SY", "Syria", "egyptian"),
        p("IQ", "Iraq", "mwl"),
        p("IR", "Iran", "tehran"),
        p("TR", "Türkiye", "diyanet", .hanafi),
        p("AZ", "Azerbaijan", "mwl"),
        p("GE", "Georgia", "mwl"),
        p("AM", "Armenia", "mwl"),
        p("CY", "Cyprus", "diyanet", .hanafi),
    ]

    private static let byCode: [String: CountryProfile] =
        Dictionary(uniqueKeysWithValues: profiles.map { ($0.code, $0) })

    static func profile(for countryCode: String?) -> CountryProfile? {
        guard let code = countryCode?.uppercased() else { return nil }
        return byCode[code]
    }

    /// Used outside Asia: still works, with the international default.
    static let fallback = CountryProfile(code: "", name: "Outside Asia", methodID: "mwl",
                                         asr: .standard, naming: .arabic)

    /// Offline country guess from the phone's time zone, for when the phone has
    /// GPS but no data to reverse-geocode (fresh off the plane, no roaming).
    /// The phone's zone updates from the mobile network on landing.
    static func countryCode(forTimeZone id: String) -> String? {
        timeZoneCountries[id]
    }

    /// A representative zone for a country (first match), used when a search
    /// result comes back without a time zone.
    static func timeZoneID(forCountry code: String?) -> String? {
        guard let code = code?.uppercased() else { return nil }
        return timeZoneCountries.filter { $0.value == code }.keys.sorted().first
    }

    private static let timeZoneCountries: [String: String] = [
        "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Kuching": "MY", "Asia/Brunei": "BN",
        "Asia/Jakarta": "ID", "Asia/Pontianak": "ID", "Asia/Makassar": "ID", "Asia/Jayapura": "ID",
        "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN", "Asia/Phnom_Penh": "KH",
        "Asia/Vientiane": "LA", "Asia/Yangon": "MM", "Asia/Rangoon": "MM", "Asia/Manila": "PH", "Asia/Dili": "TL",
        "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Pyongyang": "KP", "Asia/Shanghai": "CN", "Asia/Urumqi": "CN",
        "Asia/Taipei": "TW", "Asia/Hong_Kong": "HK", "Asia/Macau": "MO", "Asia/Ulaanbaatar": "MN",
        "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Kabul": "AF",
        "Asia/Kathmandu": "NP", "Asia/Thimphu": "BT", "Asia/Colombo": "LK", "Indian/Maldives": "MV",
        "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ", "Asia/Samarkand": "UZ", "Asia/Bishkek": "KG",
        "Asia/Dushanbe": "TJ", "Asia/Ashgabat": "TM",
        "Asia/Riyadh": "SA", "Asia/Dubai": "AE", "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Bahrain": "BH",
        "Asia/Muscat": "OM", "Asia/Aden": "YE", "Asia/Amman": "JO", "Asia/Gaza": "PS", "Asia/Hebron": "PS",
        "Asia/Jerusalem": "IL", "Asia/Beirut": "LB", "Asia/Damascus": "SY", "Asia/Baghdad": "IQ",
        "Asia/Tehran": "IR", "Europe/Istanbul": "TR", "Asia/Baku": "AZ", "Asia/Tbilisi": "GE",
        "Asia/Yerevan": "AM", "Asia/Nicosia": "CY",
    ]
}
