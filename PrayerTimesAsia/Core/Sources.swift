import Foundation

/// Where a day's times come from - the "sanad" shown next to every timetable.
enum SourceGrade: String, Codable, Sendable {
    case official = "A"
    case masjid = "B"
    case community = "C"
    case calculated = "D"
    /// The user's own observation of the sun or sky (Falak Mode). The last
    /// rung: never replaces A-D data, only checks it.
    case falak = "F"

    var title: String {
        switch self {
        case .official: "Official"
        case .masjid: "Masjid-confirmed"
        case .community: "Community-verified"
        case .calculated: "Calculated"
        case .falak: "Falak (observed)"
        }
    }

    var explanation: String {
        switch self {
        case .official: "Published by the national or state religious authority, or its exact published method."
        case .masjid: "From a named mosque's own timetable, checked against our calculation."
        case .community: "Method confirmed by two or more independent local contributors."
        case .calculated: "Astronomical calculation on your phone. The method is shown; local mosques may differ by a few minutes."
        case .falak: "Worked out from your own observation of the sun's shadow or the sky, with honest ± minutes. Used to learn and to check, never in place of the grades above."
        }
    }
}

/// A mosque's own timetable rule, reverse-engineered from its printed timetable
/// with tools/fingerprint.py and published in data/mosques.json.
struct MosqueProfile: Codable, Identifiable, Hashable, Sendable {
    struct Fingerprint: Codable, Hashable, Sendable {
        var fajrAngle: Double
        var ishaAngle: Double?
        var ishaInterval: Double?
        var asrFactor: Int
        /// Prayer rawValue → precautionary minutes.
        var offsets: [String: Double]
    }

    /// Congregation (iqamah) rule for one prayer. Exactly one field is set.
    struct JamaahRule: Codable, Hashable, Sendable {
        /// "HH:mm" local, e.g. Zuhr at 12:00.
        var fixed: String?
        /// Minutes after the prayer time begins.
        var afterMinutes: Int?
        /// Minutes before sunrise (common for Fajr, e.g. Tokyo Camii: 45).
        var beforeSunriseMinutes: Int?
    }

    var id: String
    var name: String
    var lat: Double
    var lng: Double
    var country: String
    /// How far from the mosque its timetable is applied.
    var radiusKm: Double?
    var fingerprint: Fingerprint?
    /// Prayer rawValue → rule.
    var jamaah: [String: JamaahRule]?
    /// Friday prayer, "HH:mm" local.
    var jumuah: String?
    var source: String
    var verifiedAt: String
    var grade: SourceGrade

    var coordinates: Coordinates { Coordinates(latitude: lat, longitude: lng) }

    var method: CalculationMethod? {
        guard let fp = fingerprint else { return nil }
        var offsets: [Prayer: Double] = [:]
        for (k, v) in fp.offsets { if let p = Prayer(rawValue: k) { offsets[p] = v } }
        let isha = fp.ishaAngle.map { "Isha \($0)°" } ?? "Isha +\(Int(fp.ishaInterval ?? 0)) min"
        return CalculationMethod(
            id: "mosque-\(id)", name: name, shortName: name,
            fajrAngle: fp.fajrAngle, ishaAngle: fp.ishaAngle, ishaInterval: fp.ishaInterval,
            ramadanIshaInterval: nil, maghribAngle: nil, offsets: offsets,
            matchesOfficialTable: false,
            note: "\(name)'s own timetable (Fajr \(fp.fajrAngle)° · \(isha)), from: \(source).")
    }

    var asrSchool: AsrSchool? {
        fingerprint.map { $0.asrFactor == 2 ? .hanafi : .standard }
    }

    /// Jamaah times for a day, in the place's time zone.
    func jamaahTimes(for day: PrayerDay, timeZone: TimeZone, isFriday: Bool) -> [Prayer: Date] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        func at(_ hhmm: String) -> Date? {
            let p = hhmm.split(separator: ":").compactMap { Int($0) }
            guard p.count == 2 else { return nil }
            return cal.date(from: DateComponents(year: day.year, month: day.month, day: day.day, hour: p[0], minute: p[1]))
        }
        var out: [Prayer: Date] = [:]
        for prayer in Prayer.obligatory {
            if prayer == .dhuhr, isFriday, let j = jumuah, let d = at(j) { out[prayer] = d; continue }
            guard let rule = jamaah?[prayer.rawValue] else { continue }
            if let f = rule.fixed, let d = at(f) {
                out[prayer] = d
            } else if let m = rule.afterMinutes {
                out[prayer] = day.time(prayer).addingTimeInterval(Double(m) * 60)
            } else if let m = rule.beforeSunriseMinutes {
                out[prayer] = day.time(.sunrise).addingTimeInterval(Double(-m) * 60)
            }
        }
        return out
    }
}

struct MosqueDataset: Codable, Sendable {
    var version: Int
    var licence: String
    var mosques: [MosqueProfile]

    /// The closest profile whose radius covers `point`.
    func profile(near point: Coordinates) -> MosqueProfile? {
        mosques
            .map { ($0, Geo.distanceKm($0.coordinates, point)) }
            .filter { $0.1 <= ($0.0.radiusKm ?? 3) }
            .min { $0.1 < $1.1 }?.0
    }
}
