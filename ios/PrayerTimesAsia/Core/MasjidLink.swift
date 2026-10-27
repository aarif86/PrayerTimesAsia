import Foundation

/// "Your masjid": the jamaah (iqamah) rules a masjid screen shares through its
/// QR code. Same short format as the web app (web/src/core/masjidLink.ts) and
/// Android, checked against testdata/masjid-links.json:
///
///     prayertimesasia://masjid?n=Masjid+Al-Firdaus&ll=1.3721,103.9474&tz=Asia/Singapore&cc=SG&i=10,10,10,5,10&j=13:00
///
/// n name · ll latitude,longitude · tz time zone · cc country (optional) ·
/// i Subuh, Zohor, Asar, Maghrib, Isyak: minutes after azan ("10"), a fixed
/// time ("13:15"), or empty · j Jumu'ah (khutbah) time (optional).
struct MasjidLink: Codable, Hashable, Identifiable, Sendable {
    struct Rule: Codable, Hashable, Sendable {
        var after: Int?
        var fixed: String?
    }

    var name: String
    var lat: Double
    var lng: Double
    var tz: String
    var cc: String?
    /// Prayer rawValue → rule.
    var jamaah: [String: Rule]
    var jumuah: String?

    var id: String { "\(name)|\(lat)|\(lng)" }
    var coordinates: Coordinates { Coordinates(latitude: lat, longitude: lng) }

    /// A masjid that's yours covers your home area, a little wider than the 3 km of a published profile.
    static let radiusKm = 10.0

    /// Reads "masjid?..." (or a whole URL containing it). Anything odd gives nil.
    static func parse(_ text: String) -> MasjidLink? {
        guard let at = text.range(of: "masjid?") else { return nil }
        // Form encoding: "+" is a space (a real plus arrives as %2B).
        var q: [String: String] = [:]
        for pair in text[at.upperBound...].split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            let key = String(kv[0])
            let raw = kv.count > 1 ? String(kv[1]).replacingOccurrences(of: "+", with: " ") : ""
            if q[key] == nil { q[key] = raw.removingPercentEncoding ?? raw }
        }

        let name = String((q["n"] ?? "").trimmingCharacters(in: .whitespaces).prefix(80))
        let ll = (q["ll"] ?? "").split(separator: ",", omittingEmptySubsequences: false).map { Double($0) }
        let tz = q["tz"] ?? ""
        guard !name.isEmpty, ll.count == 2, let lat = ll[0], let lng = ll[1],
              lat.isFinite, lng.isFinite, abs(lat) <= 90, abs(lng) <= 180,
              tz.range(of: #"^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$"#, options: .regularExpression) != nil
        else { return nil }

        var jamaah: [String: Rule] = [:]
        let parts = (q["i"] ?? "").split(separator: ",", omittingEmptySubsequences: false).map(String.init)
        for (k, prayer) in Prayer.obligatory.enumerated() {
            let v = k < parts.count ? parts[k].trimmingCharacters(in: .whitespaces) : ""
            if v.range(of: #"^\d{1,2}$"#, options: .regularExpression) != nil, let n = Int(v), n <= 60 {
                jamaah[prayer.rawValue] = Rule(after: n)
            } else if let t = hhmm(v) {
                jamaah[prayer.rawValue] = Rule(fixed: t)
            }
        }
        let cc = q["cc"].flatMap { $0.range(of: "^[A-Za-z]{2}$", options: .regularExpression) != nil ? $0.uppercased() : nil }
        return MasjidLink(name: name, lat: lat, lng: lng, tz: tz, cc: cc, jamaah: jamaah, jumuah: hhmm(q["j"] ?? ""))
    }

    /// "9:05" → "09:05"; nil unless a valid 24-hour time.
    private static func hhmm(_ s: String) -> String? {
        guard s.range(of: #"^([01]?\d|2[0-3]):([0-5]\d)$"#, options: .regularExpression) != nil else { return nil }
        let p = s.split(separator: ":")
        return (p[0].count == 1 ? "0" : "") + s
    }

    /// As a mosque profile, so the existing jamaah code shows its times.
    var profile: MosqueProfile {
        MosqueProfile(
            id: "my-masjid", name: name, lat: lat, lng: lng, country: cc ?? "",
            radiusKm: Self.radiusKm, fingerprint: nil,
            jamaah: jamaah.mapValues { MosqueProfile.JamaahRule(fixed: $0.fixed, afterMinutes: $0.after, beforeSunriseMinutes: nil) },
            jumuah: jumuah, source: "Shared by the masjid screen", verifiedAt: "", grade: .masjid)
    }
}
