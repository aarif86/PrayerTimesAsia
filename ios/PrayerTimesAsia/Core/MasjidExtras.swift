import Foundation

/// A Singapore masjid with a second Friday prayer (MUIS list, data/friday-sg.json).
struct FridayMosque: Hashable, Sendable {
    let name: String
    let district: String
    let lat: Double
    let lng: Double
    let womenSession2: Bool
    var coordinates: Coordinates { Coordinates(latitude: lat, longitude: lng) }
}

struct EidSession: Hashable, Sendable {
    let time: String
    let khutbah: String?
    let women: Bool
}

struct EidMosque: Hashable, Sendable {
    let name: String
    let lat: Double?
    let lng: Double?
    let sessions: [EidSession]
    let note: String?
}

struct EidEvent: Hashable, Sendable {
    let name: String
    let date: String
    let sourceURL: String
    let mosques: [EidMosque]
    /// "Hari Raya Aidilfitri", without the Hijri year.
    var shortName: String { name.replacingOccurrences(of: #" \d+H$"#, with: "", options: .regularExpression) }
}

enum TripMode: String, CaseIterable, Identifiable, Sendable {
    case walk, drive
    var id: String { rawValue }
}

/// What the Masjid tab adds around the place list: Singapore's second Friday
/// prayers and Hari Raya sessions (both from MUIS), trip times, report links.
/// Kept in step with web/src/core/friday.ts, eid.ts and Android's MasjidExtras.
enum MasjidExtras {
    static var friday: [FridayMosque] { MasjidExtrasData.friday }
    static var eidEvents: [EidEvent] { MasjidExtrasData.eid }
    static let fridaySourceURL = MasjidExtrasData.fridaySourceURL
    static let fridaySourceUpdated = MasjidExtrasData.fridaySourceUpdated
    static let fridaySecondFrom = MasjidExtrasData.fridaySecondFrom

    /// How many places the list shows; the rest are on the map.
    static let show = 5

    static func inSingapore(_ c: Coordinates, countryCode: String?) -> Bool {
        if let countryCode { return countryCode.uppercased() == "SG" }
        return c.latitude > 1.15 && c.latitude < 1.48 && c.longitude > 103.59 && c.longitude < 104.1
    }

    /// The listed two-session masjid at this spot (within 300 m).
    static func fridayAt(_ c: Coordinates) -> FridayMosque? {
        friday.map { ($0, Geo.distanceKm(c, $0.coordinates)) }.filter { $0.1 <= 0.3 }.min { $0.1 < $1.1 }?.0
    }

    static func fridayNearest(_ c: Coordinates) -> [(mosque: FridayMosque, km: Double)] {
        friday.map { (mosque: $0, km: Geo.distanceKm(c, $0.coordinates)) }.sorted { $0.km < $1.km }
    }

    /// "Masjid Al-Ansar", "Al-Ansar Mosque" and "Al Ansar" all become "alansar".
    static func nameKey(_ name: String) -> String {
        name.lowercased()
            .replacingOccurrences(of: #"\b(masjid|mosque|mesjid)\b"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "[^a-z]", with: "", options: .regularExpression)
    }

    private static func day(_ iso: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: iso)
    }

    /// The Eid to show: from 14 days before its date until the day itself. `today` is "yyyy-MM-dd" in Singapore.
    static func currentEid(today: String, events: [EidEvent] = MasjidExtrasData.eid) -> EidEvent? {
        guard let t = day(today) else { return nil }
        return events.first { e in
            guard let d = day(e.date), !e.mosques.isEmpty else { return false }
            let days = d.timeIntervalSince(t) / 86_400
            return days >= 0 && days <= 14
        }
    }

    static func eidAt(_ e: EidEvent, name: String, coordinates c: Coordinates) -> EidMosque? {
        let key = nameKey(name)
        return e.mosques.first { m in
            if let lat = m.lat, let lng = m.lng, Geo.distanceKm(c, Coordinates(latitude: lat, longitude: lng)) <= 0.3 { return true }
            return !key.isEmpty && nameKey(m.name) == key
        }
    }

    static func distanceText(_ km: Double) -> String {
        km < 1 ? "\(Int((km * 1000).rounded())) m" : String(format: "%.1f km", km)
    }

    /// About 5 km an hour on foot, shown up to 2 km; by car a rough town pace (the maps app shows the jams).
    static func tripText(_ km: Double, mode: TripMode) -> String? {
        switch mode {
        case .walk: km > 2 ? nil : "\(max(1, Int((km / 0.08).rounded()))) min walk"
        case .drive: "\(max(2, Int((km * 2 + 2).rounded()))) min drive"
        }
    }

    /// Ring sets for the map, each a 1 2 5 step like a map's distance scale, from very close to far out.
    static let ringSets: [[Double]] = [[0.25, 0.5, 1], [0.5, 1, 2], [1, 2, 5], [2, 5, 10], [5, 10, 20]]

    /// Labels sit on each ring this far below the right hand side, in degrees, so they line up like a ruler.
    static let ringLabelAngle = 35.0

    /// The three rings that suit what the map shows: the widest set whose outer label still lands
    /// on screen. Half the map's width and height in km. Walk opens on 500 m, 1 and 2 km, Drive on 1, 2 and 5 km.
    static func rings(halfWidthKm: Double, halfHeightKm: Double) -> [Double] {
        let a = ringLabelAngle * .pi / 180
        return ringSets.last { $0[2] * cos(a) <= halfWidthKm * 0.9 && $0[2] * sin(a) <= halfHeightKm * 0.9 } ?? ringSets[0]
    }

    /// "500 m" or "2 km".
    static func ringDistance(_ km: Double) -> String {
        km < 1 ? "\(Int((km * 1000).rounded())) m" : "\(Int(km.rounded())) km"
    }

    /// A note on OpenStreetMap at this spot, for a volunteer to fix or add the place. No sign up needed.
    static func reportURL(_ c: Coordinates) -> URL? {
        URL(string: String(format: "https://www.openstreetmap.org/note/new#map=19/%.5f/%.5f", c.latitude, c.longitude))
    }

    static let facilityLabels: [(Character, String, String)] = [
        ("w", "Women's space", "figure.stand.dress"),
        ("a", "Wheelchair access", "figure.roll"),
        ("p", "Parking", "parkingsign"),
        ("t", "Toilets", "toilet"),
    ]

    /// "13:00" as 1 PM, or 13:00 with the 24 hour clock.
    static func clock(_ hhmm: String, use24: Bool) -> String {
        if use24 { return hhmm }
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2 else { return hhmm }
        return "\((p[0] + 11) % 12 + 1)\(p[1] != 0 ? String(format: ":%02d", p[1]) : "") \(p[0] < 12 ? "AM" : "PM")"
    }

    /// Sample Raya list for screenshots (`-eid-sample`), same as the web's ?eid=sample.
    static let sampleEid = EidEvent(
        name: "Hari Raya Aidilfitri 1448H", date: "2027-03-10", sourceURL: "https://www.muis.gov.sg/",
        mosques: [
            EidMosque(name: "Masjid Al-Istighfar", lat: 1.37106, lng: 103.96412,
                      sessions: [EidSession(time: "07:20", khutbah: "Malay", women: true),
                                 EidSession(time: "08:45", khutbah: "Malay", women: true)], note: nil),
            EidMosque(name: "Masjid Al-Firdaus", lat: nil, lng: nil,
                      sessions: [EidSession(time: "07:30", khutbah: "Malay", women: true)], note: nil),
        ])
}

/// The common part of OpenStreetMap's opening_hours ("Mo-Su 10:00-22:00",
/// "Mo-Fr 08:00-20:00; Sa,Su off", "24/7"). Anything else gives nil, so the
/// app says nothing rather than something wrong. Same rules as web and Android.
enum OpeningHours {
    struct Now: Equatable {
        var open: Bool
        var until: String? = nil
        var opensAt: String? = nil
    }

    private struct Rule { var days: [Bool]; var spans: [(Int, Int)] }
    private static let dayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

    private static func days(_ text: String) -> [Bool]? {
        var out = Array(repeating: false, count: 7)
        for part in text.split(separator: ",", omittingEmptySubsequences: false) {
            let ends = part.split(separator: "-", omittingEmptySubsequences: false).map(String.init)
            guard ends.count <= 2, let a = dayNames.firstIndex(of: ends[0]) else { return nil }
            let b: Int
            if ends.count == 2 { guard let x = dayNames.firstIndex(of: ends[1]) else { return nil }; b = x } else { b = a }
            var i = a
            while true { out[i] = true; if i == b { break }; i = (i + 1) % 7 }
        }
        return out
    }

    private static func minutes(_ s: Substring) -> Int? {
        let p = s.split(separator: ":", omittingEmptySubsequences: false)
        guard p.count == 2, (1...2).contains(p[0].count), p[1].count == 2,
              let h = Int(p[0]), let m = Int(p[1]) else { return nil }
        return h * 60 + m
    }

    private static func spans(_ text: String) -> [(Int, Int)]? {
        var out: [(Int, Int)] = []
        for part in text.split(separator: ",", omittingEmptySubsequences: false) {
            let ends = part.split(separator: "-", omittingEmptySubsequences: false)
            guard ends.count == 2, let a = minutes(ends[0]), var b = minutes(ends[1]) else { return nil }
            if b <= a { b += 24 * 60 }
            out.append((a, b))
        }
        return out
    }

    private static func parse(_ raw: String) -> [Rule]? {
        let text = raw.trimmingCharacters(in: .whitespaces)
        if text.isEmpty { return nil }
        if text == "24/7" { return [Rule(days: Array(repeating: true, count: 7), spans: [(0, 24 * 60)])] }
        var rules: [Rule] = []
        for r in text.split(separator: ";").map({ $0.trimmingCharacters(in: .whitespaces) }) where !r.isEmpty {
            let tidy = r.replacingOccurrences(of: #"\s*,\s*"#, with: ",", options: .regularExpression)
                .replacingOccurrences(of: #"\s*-\s*"#, with: "-", options: .regularExpression)
            var tokens = tidy.split(whereSeparator: { $0 == " " || $0 == "\t" }).map(String.init)
            guard let first = tokens.first else { continue }
            var d = Array(repeating: true, count: 7)
            if dayNames.contains(where: { first.hasPrefix($0) }) {
                guard let parsed = days(first) else { return nil }
                d = parsed
                tokens.removeFirst()
            } else if first.hasPrefix("PH") { continue }
            guard tokens.count == 1 else { return nil }
            let s: [(Int, Int)]
            switch tokens[0] {
            case "off", "closed": s = []
            case "24/7": s = [(0, 24 * 60)]
            default: guard let parsed = spans(tokens[0]) else { return nil }; s = parsed
            }
            rules.append(Rule(days: d, spans: s))
        }
        return rules.isEmpty ? nil : rules
    }

    private static func hhmm(_ min: Int) -> String { String(format: "%02d:%02d", min / 60 % 24, min % 60) }

    /// `weekday` 0 = Monday; `minute` of the day in the place's own time.
    static func at(_ raw: String, weekday: Int, minute: Int) -> Now? {
        guard let rules = parse(raw) else { return nil }
        func spansFor(_ d: Int) -> [(Int, Int)] { var s: [(Int, Int)] = []; for r in rules where r.days[d] { s = r.spans }; return s }
        let today = spansFor(weekday)
        for (a, b) in today where minute >= a && minute < b { return Now(open: true, until: b - a >= 24 * 60 ? nil : hhmm(b)) }
        for (a, b) in spansFor((weekday + 6) % 7) where b > 24 * 60 && minute < b - 24 * 60 && a < 24 * 60 {
            return Now(open: true, until: hhmm(b - 24 * 60))
        }
        let later = today.filter { $0.0 > minute }.min { $0.0 < $1.0 }
        return Now(open: false, opensAt: later.map { hhmm($0.0) })
    }

    /// Now in the given time zone.
    static func at(_ raw: String, date: Date, timeZone: TimeZone) -> Now? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.weekday, .hour, .minute], from: date)
        // Calendar weekday: 1 = Sunday.
        return at(raw, weekday: ((c.weekday ?? 2) + 5) % 7, minute: (c.hour ?? 0) * 60 + (c.minute ?? 0))
    }

    static func text(_ n: Now, use24: Bool) -> String {
        if n.open, let until = n.until { return "Open now, until \(MasjidExtras.clock(until, use24: use24))" }
        if n.open { return "Open now, all day" }
        if let at = n.opensAt { return "Closed now, opens \(MasjidExtras.clock(at, use24: use24))" }
        return "Closed today"
    }
}
