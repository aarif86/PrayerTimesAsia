import Foundation

/// The parameters one authority uses to turn the sun's position into prayer times.
///
/// Every time the engine produces is `ceil(astronomical time + offset)` to the
/// minute. The offsets are each authority's precautionary minutes (ihtiyat). For
/// MUIS and JAKIM they were fitted against the full 2026 official timetables
/// (tools/validate_official.py) so that the offline calculation is never earlier
/// than the official time: prayers up to 2 minutes later, sunrise up to 1 earlier.
/// When online, OfficialTimetables replaces the calculation with the exact table.
struct CalculationMethod: Identifiable, Hashable, Sendable {
    let id: String
    /// Long name, e.g. "MUIS · Singapore".
    let name: String
    /// Short label for chips, e.g. "MUIS".
    let shortName: String
    let fajrAngle: Double
    /// Sun depression for Isha. Nil when Isha is a fixed interval after Maghrib.
    let ishaAngle: Double?
    /// Minutes after Maghrib, used instead of `ishaAngle` (Umm al-Qura, Qatar).
    let ishaInterval: Double?
    /// Ramadan override for `ishaInterval` (Umm al-Qura uses 120).
    let ramadanIshaInterval: Double?
    /// Sun depression for Maghrib. Nil means at sunset (Jafari uses 4.5°).
    let maghribAngle: Double?
    /// Precautionary minutes added before rounding up.
    let offsets: [Prayer: Double]
    /// True when the angles and offsets reproduce an authority's own published
    /// timetable; false for widely used international conventions.
    let matchesOfficialTable: Bool
    let note: String

    var parameterSummary: String {
        let isha = ishaAngle.map { "Isha \(Self.format($0))°" } ?? "Isha +\(Int(ishaInterval ?? 0)) min"
        return "Fajr \(Self.format(fajrAngle))° · \(isha)"
    }

    private static func format(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v)
    }
}

extension CalculationMethod {
    static let muis = CalculationMethod(
        id: "muis", name: "MUIS · Singapore", shortName: "MUIS",
        fajrAngle: 20, ishaAngle: 18, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [.fajr: 0.625, .sunrise: -0.375, .dhuhr: 1.5, .asr: 0.5, .maghrib: 0.875, .isha: 0.5],
        matchesOfficialTable: true,
        note: "Majlis Ugama Islam Singapura. Online, the app shows MUIS's official timetable; offline it calculates, never earlier than the official time.")

    static let jakim = CalculationMethod(
        id: "jakim", name: "JAKIM · Malaysia", shortName: "JAKIM",
        fajrAngle: 18, ishaAngle: 18, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [.fajr: 2.375, .sunrise: -1.375, .dhuhr: 2.5, .asr: 2.25, .maghrib: 2.25, .isha: 2.375],
        matchesOfficialTable: true,
        note: "Malaysia's 18° Subuh criterion (since 2019). Online, the app shows JAKIM's official e-Solat timetable for your zone; offline it calculates, never earlier than the official time.")

    static let kemenag = CalculationMethod(
        id: "kemenag", name: "Kemenag · Indonesia", shortName: "Kemenag",
        fajrAngle: 20, ishaAngle: 18, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [.fajr: 2, .sunrise: -2, .dhuhr: 2, .asr: 2, .maghrib: 2, .isha: 2],
        matchesOfficialTable: false,
        note: "Kementerian Agama angles (20°/18°) with a 2-minute ihtiyat.")

    static let southeastAsia = CalculationMethod(
        id: "sea", name: "Southeast Asia standard", shortName: "SEA 20°/18°",
        fajrAngle: 20, ishaAngle: 18, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [.dhuhr: 1],
        matchesOfficialTable: false,
        note: "The 20°/18° convention used across the Malay world. A sensible default where no national timetable exists.")

    static let mwl = CalculationMethod(
        id: "mwl", name: "Muslim World League", shortName: "MWL",
        fajrAngle: 18, ishaAngle: 17, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [:], matchesOfficialTable: false,
        note: "The most widely used international convention; common in East Asia.")

    static let karachi = CalculationMethod(
        id: "karachi", name: "Karachi · University of Islamic Sciences", shortName: "Karachi",
        fajrAngle: 18, ishaAngle: 18, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [:], matchesOfficialTable: false,
        note: "Standard across Pakistan, India, Bangladesh and Afghanistan.")

    static let ummAlQura = CalculationMethod(
        id: "ummalqura", name: "Umm al-Qura · Makkah", shortName: "Umm al-Qura",
        fajrAngle: 18.5, ishaAngle: nil, ishaInterval: 90, ramadanIshaInterval: 120, maghribAngle: nil,
        offsets: [:], matchesOfficialTable: false,
        note: "Saudi Arabia. Isha is 90 minutes after Maghrib, 120 in Ramadan.")

    static let dubai = CalculationMethod(
        id: "dubai", name: "Dubai · UAE", shortName: "UAE",
        fajrAngle: 18.2, ishaAngle: 18.2, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [.sunrise: -3, .dhuhr: 3, .asr: 3, .maghrib: 3], matchesOfficialTable: false,
        note: "United Arab Emirates convention.")

    static let qatar = CalculationMethod(
        id: "qatar", name: "Qatar", shortName: "Qatar",
        fajrAngle: 18, ishaAngle: nil, ishaInterval: 90, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [:], matchesOfficialTable: false,
        note: "Isha 90 minutes after Maghrib.")

    static let kuwait = CalculationMethod(
        id: "kuwait", name: "Kuwait", shortName: "Kuwait",
        fajrAngle: 18, ishaAngle: 17.5, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [:], matchesOfficialTable: false, note: "Kuwait convention.")

    static let turkey = CalculationMethod(
        id: "diyanet", name: "Diyanet · Türkiye", shortName: "Diyanet",
        fajrAngle: 18, ishaAngle: 17, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [.sunrise: -7, .dhuhr: 5, .asr: 4, .maghrib: 7], matchesOfficialTable: false,
        note: "An approximation of the Diyanet method; most accurate within Türkiye.")

    static let tehran = CalculationMethod(
        id: "tehran", name: "Tehran · Jafari", shortName: "Jafari",
        fajrAngle: 17.7, ishaAngle: 14, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: 4.5,
        offsets: [:], matchesOfficialTable: false,
        note: "Institute of Geophysics, University of Tehran. Maghrib when the sun is 4.5° below the horizon.")

    static let egyptian = CalculationMethod(
        id: "egyptian", name: "Egyptian General Authority", shortName: "Egypt",
        fajrAngle: 19.5, ishaAngle: 17.5, ishaInterval: nil, ramadanIshaInterval: nil, maghribAngle: nil,
        offsets: [:], matchesOfficialTable: false, note: "Common in the Levant.")

    static let all: [CalculationMethod] = [
        .muis, .jakim, .kemenag, .southeastAsia, .mwl, .karachi,
        .ummAlQura, .dubai, .qatar, .kuwait, .turkey, .tehran, .egyptian,
    ]

    static func with(id: String) -> CalculationMethod? { all.first { $0.id == id } }
}
