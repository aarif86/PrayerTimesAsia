import Foundation
import Observation

/// Exact official timetables when online: MUIS for Singapore and JAKIM e-Solat
/// for Malaysia. Requests carry only a year or a zone code, never coordinates.
/// A downloaded year is kept on disk, so it keeps working offline; without a
/// table the app falls back to its own calculation (never earlier than official).
@MainActor
@Observable
final class OfficialTimetables {
    enum Source: Hashable, Sendable {
        case muis
        case jakim(zone: String)
        /// Kemenag regency/city, by the name Apple gives for where you are.
        case kemenag(regency: String)

        var label: String {
            switch self {
            case .muis: "MUIS official timetable"
            case .jakim(let zone): "JAKIM e-Solat · zone \(zone)"
            case .kemenag(let regency): "Kemenag · \(regency)"
            }
        }

        /// Authority name for the source badge.
        var authority: String {
            switch self {
            case .muis: "MUIS"
            case .jakim: "JAKIM"
            case .kemenag: "Kemenag"
            }
        }

        func cacheKey(year: Int) -> String {
            switch self {
            case .muis: "muis-\(year)"
            case .jakim(let zone): "jakim-\(zone)-\(year)"
            case .kemenag(let regency): "kemenag-\(OfficialTimetables.kemenagCore(regency).core)-\(year)"
            }
        }
    }

    /// cacheKey → "yyyy-MM-dd" → prayer rawValue → "HH:mm". Not observed directly
    /// (it fills lazily from disk during view updates); `revision` is.
    @ObservationIgnored private var tables: [String: [String: [String: String]]] = [:]
    /// Bumped whenever a new table is downloaded, so views re-read.
    private(set) var revision = 0
    @ObservationIgnored private var inFlight: Set<String> = []
    @ObservationIgnored private var failedAt: [String: Date] = [:]

    /// data.gov.sg publishes one MUIS dataset per year. Years after release are
    /// read from config/official-sources.json in the GitHub repo (no personal
    /// data is sent), so a new year needs a one-line commit, not an app update.
    static let muisDatasets: [Int: String] = [
        2026: "d_d441e7242e78efc566024dd5b0d9829c",
    ]
    static let remoteConfig = URL(string: "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/config/official-sources.json")!

    private static func muisDataset(year: Int) async -> String? {
        if let id = muisDatasets[year] { return id }
        struct Config: Decodable { let muisDatasets: [String: String] }
        guard let data = try? await get(remoteConfig),
              let config = try? JSONDecoder().decode(Config.self, from: data) else { return nil }
        return config.muisDatasets[String(year)]
    }

    /// Which official table applies, if any. Only when the method in use is that
    /// authority's own - a user who pinned another method gets that method.
    static func source(for place: Place, method: CalculationMethod, zoneOverride: String?) -> Source? {
        switch (place.countryCode?.uppercased(), method.id) {
        case ("SG", "muis"): return .muis
        case ("MY", "jakim"): return .jakim(zone: zoneOverride ?? nearestJakimZone(to: place.coordinates))
        case ("ID", "kemenag"):
            guard let name = place.district ?? place.region ?? (place.name == "Current location" ? nil : place.name)
            else { return nil }
            return .kemenag(regency: name)
        default: return nil
        }
    }

    static func nearestJakimZone(to c: Coordinates) -> String {
        var best = ("WLY01", Double.greatestFiniteMagnitude)
        for (zone, lat, lng) in JakimZones.points {
            let d = Geo.distanceKm(c, Coordinates(latitude: lat, longitude: lng))
            if d < best.1 { best = (zone, d) }
        }
        return best.0
    }

    func times(_ source: Source, year: Int, month: Int, day: Int) -> [Prayer: String]? {
        _ = revision
        let key = source.cacheKey(year: year)
        if tables[key] == nil, let disk = Self.loadFromDisk(key) { tables[key] = disk }
        guard let row = tables[key]?[String(format: "%04d-%02d-%02d", year, month, day)] else { return nil }
        var out: [Prayer: String] = [:]
        for prayer in Prayer.allCases {
            guard let t = row[prayer.rawValue] else { return nil }
            out[prayer] = t
        }
        return out
    }

    func hasTable(_ source: Source, year: Int) -> Bool {
        let key = source.cacheKey(year: year)
        return tables[key] != nil || Self.loadFromDisk(key) != nil
    }

    /// Downloads the year's table if it isn't cached. Returns true if new data arrived.
    @discardableResult
    func ensure(_ source: Source, year: Int) async -> Bool {
        let key = source.cacheKey(year: year)
        if hasTable(source, year: year) || inFlight.contains(key) { return false }
        if let failed = failedAt[key], Date.now.timeIntervalSince(failed) < 30 * 60 { return false }
        inFlight.insert(key)
        defer { inFlight.remove(key) }
        do {
            let table: [String: [String: String]]
            switch source {
            case .muis:
                guard let dataset = await Self.muisDataset(year: year) else { throw URLError(.fileDoesNotExist) }
                table = try await Self.fetchMUIS(dataset: dataset)
            case .jakim(let zone):
                table = try await Self.fetchJAKIM(zone: zone, year: year)
            case .kemenag(let regency):
                table = try await fetchKemenag(regency: regency, year: year)
            }
            // A year is ~365 rows; Kemenag comes month by month, so accept a
            // partial year (missing days fall back to the calculation).
            guard table.count > 25 else { throw URLError(.cannotParseResponse) }
            tables[key] = table
            Self.saveToDisk(key, table)
            revision += 1
            return true
        } catch {
            failedAt[key] = .now
            return false
        }
    }

    // MARK: Fetching

    private static func get(_ url: URL) async throws -> Data {
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.setValue("PrayerTimesAsia/1.0 (iOS)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return data
    }

    /// e-Solat: {"prayerTime":[{"date":"01-Jan-2026","fajr":"06:06:00","syuruk":"07:18:00",
    /// "dhuhr":"13:19:00","asr":"16:42:00","maghrib":"19:17:00","isha":"20:31:00",...}],...}
    /// Month abbreviations are Malay ("Mac", "Ogos", "Dis").
    static func fetchJAKIM(zone: String, year: Int) async throws -> [String: [String: String]] {
        var c = URLComponents(string: "https://www.e-solat.gov.my/index.php")!
        c.queryItems = [.init(name: "r", value: "esolatApi/takwimsolat"),
                        .init(name: "period", value: "year"),
                        .init(name: "zone", value: zone)]
        let data = try await get(c.url!)
        return try parseJAKIM(data, year: year)
    }

    static func parseJAKIM(_ data: Data, year: Int) throws -> [String: [String: String]] {
        struct Response: Decodable { let prayerTime: [Row]? }
        struct Row: Decodable {
            let date: String
            let fajr: String, syuruk: String, dhuhr: String, asr: String, maghrib: String, isha: String
        }
        let rows = try JSONDecoder().decode(Response.self, from: data).prayerTime ?? []
        var out: [String: [String: String]] = [:]
        for r in rows {
            guard let date = jakimDate(r.date), date.hasPrefix("\(year)-") else { continue }
            let values = [Prayer.fajr: r.fajr, .sunrise: r.syuruk, .dhuhr: r.dhuhr, .asr: r.asr,
                          .maghrib: r.maghrib, .isha: r.isha]
            var row: [String: String] = [:]
            for (p, v) in values { if let t = hhmm(v) { row[p.rawValue] = t } }
            if row.count == 6 { out[date] = row }
        }
        return out
    }

    private static let malayMonths: [String: Int] = [
        "jan": 1, "feb": 2, "mac": 3, "mar": 3, "apr": 4, "mei": 5, "may": 5, "jun": 6, "jul": 7,
        "ogos": 8, "ogo": 8, "aug": 8, "sep": 9, "okt": 10, "oct": 10, "nov": 11, "dis": 12, "dec": 12,
    ]

    static func jakimDate(_ s: String) -> String? {
        let parts = s.split(separator: "-")
        guard parts.count == 3, let d = Int(parts[0]), let y = Int(parts[2]),
              let m = malayMonths[parts[1].lowercased()] else { return nil }
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    /// data.gov.sg: {"result":{"records":[{"Date":"2026-01-01","Subuh":"05:44","Syuruk":"07:08",
    /// "Zohor":"13:10","Asar":"16:34","Maghrib":"19:11","Isyak":"20:25"},...]}}
    static func fetchMUIS(dataset: String) async throws -> [String: [String: String]] {
        var c = URLComponents(string: "https://data.gov.sg/api/action/datastore_search")!
        c.queryItems = [.init(name: "resource_id", value: dataset), .init(name: "limit", value: "400")]
        return try parseMUIS(try await get(c.url!))
    }

    static func parseMUIS(_ data: Data) throws -> [String: [String: String]] {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let result = json["result"] as? [String: Any],
              let records = result["records"] as? [[String: Any]] else { throw URLError(.cannotParseResponse) }
        let columns: [(Prayer, [String])] = [
            (.fajr, ["subuh"]), (.sunrise, ["syuruk"]), (.dhuhr, ["zohor", "zuhur"]),
            (.asr, ["asar"]), (.maghrib, ["maghrib"]), (.isha, ["isyak"]),
        ]
        var out: [String: [String: String]] = [:]
        for record in records {
            let lower = Dictionary(record.map { ($0.key.lowercased(), $0.value) }, uniquingKeysWith: { a, _ in a })
            guard let date = (lower["date"] as? String)?.prefix(10) else { continue }
            var row: [String: String] = [:]
            for (prayer, names) in columns {
                guard let raw = names.lazy.compactMap({ lower[$0] as? String }).first,
                      var t = hhmm(raw) else { continue }
                // Guard against a 12-hour afternoon value ("1:10" for 13:10).
                if prayer != .fajr, prayer != .sunrise, let h = Int(t.prefix(2)), h < 11 {
                    t = String(format: "%02d", h + 12) + t.dropFirst(2)
                }
                row[prayer.rawValue] = t
            }
            if row.count == 6 { out[String(date)] = row }
        }
        return out
    }

    /// "06:06:00" / "6:06" → "06:06"
    static func hhmm(_ s: String) -> String? {
        let p = s.trimmingCharacters(in: .whitespaces).split(separator: ":")
        guard p.count >= 2, let h = Int(p[0]), let m = Int(p[1]), (0..<24).contains(h), (0..<60).contains(m) else { return nil }
        return String(format: "%02d:%02d", h, m)
    }

    // MARK: Kemenag (Indonesia) via api.myquran.com v2

    /// (id, "KOTA BANDUNG" / "KAB. BOGOR"), downloaded once and cached.
    @ObservationIgnored private var kemenagCities: [(id: String, name: String)]?

    private func fetchKemenag(regency: String, year: Int) async throws -> [String: [String: String]] {
        let cities = try await kemenagCityList()
        guard let id = Self.matchKemenagCity([regency], in: cities) else { throw URLError(.fileDoesNotExist) }
        var out: [String: [String: String]] = [:]
        for month in 1...12 {
            let url = URL(string: "https://api.myquran.com/v2/sholat/jadwal/\(id)/\(year)/\(String(format: "%02d", month))")!
            guard let data = try? await Self.get(url), let rows = try? Self.parseKemenag(data) else { continue }
            out.merge(rows) { a, _ in a }
        }
        return out
    }

    private func kemenagCityList() async throws -> [(id: String, name: String)] {
        if let kemenagCities { return kemenagCities }
        struct Response: Decodable { struct City: Decodable { let id: String; let lokasi: String }; let data: [City] }
        let data: Data
        if let disk = try? Data(contentsOf: Self.directory.appendingPathComponent("kemenag-cities.json")) {
            data = disk
        } else {
            data = try await Self.get(URL(string: "https://api.myquran.com/v2/sholat/kota/semua")!)
            try? FileManager.default.createDirectory(at: Self.directory, withIntermediateDirectories: true)
            try? data.write(to: Self.directory.appendingPathComponent("kemenag-cities.json"), options: .atomic)
        }
        let list = try JSONDecoder().decode(Response.self, from: data).data.map { (id: $0.id, name: $0.lokasi) }
        kemenagCities = list
        return list
    }

    /// {"data":{"jadwal":[{"date":"2026-10-01","subuh":"04:23","terbit":"05:35","dzuhur":"11:46",
    /// "ashar":"14:51","maghrib":"17:50","isya":"18:59",...}]}}
    static func parseKemenag(_ data: Data) throws -> [String: [String: String]] {
        struct Response: Decodable {
            struct Body: Decodable { let jadwal: [Row] }
            struct Row: Decodable {
                let date: String
                let subuh: String, terbit: String, dzuhur: String, ashar: String, maghrib: String, isya: String
            }
            let data: Body
        }
        var out: [String: [String: String]] = [:]
        for r in try JSONDecoder().decode(Response.self, from: data).data.jadwal {
            let values = [Prayer.fajr: r.subuh, .sunrise: r.terbit, .dhuhr: r.dzuhur, .asr: r.ashar,
                          .maghrib: r.maghrib, .isha: r.isya]
            var row: [String: String] = [:]
            for (p, v) in values { if let t = hhmm(v) { row[p.rawValue] = t } }
            if row.count == 6 { out[String(r.date.prefix(10))] = row }
        }
        return out
    }

    enum RegencyKind { case city, regency, unknown }

    /// "Kota Bandung" / "Bandung City" / "KOTA BANDUNG" → ("BANDUNG", .city);
    /// "Kabupaten Bogor" / "Bogor Regency" / "KAB. BOGOR" → ("BOGOR", .regency).
    nonisolated static func kemenagCore(_ name: String) -> (core: String, kind: RegencyKind) {
        let upper = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil).uppercased()
            .replacingOccurrences(of: ".", with: " ")
        var tokens = upper.split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init)
        var kind = RegencyKind.unknown
        if tokens.first == "KOTA" || tokens.last == "CITY" { kind = .city }
        if ["KAB", "KABUPATEN"].contains(tokens.first ?? "") || tokens.last == "REGENCY" { kind = .regency }
        let filler: Set<String> = ["KOTA", "KAB", "KABUPATEN", "ADMINISTRASI", "ADM", "REGENCY", "CITY", "OF"]
        tokens.removeAll { filler.contains($0) }
        return (tokens.joined(separator: " "), kind)
    }

    /// Best Kemenag id for the given place names (most specific first).
    nonisolated static func matchKemenagCity(_ names: [String], in list: [(id: String, name: String)]) -> String? {
        let entries = list.map { (id: $0.id, key: kemenagCore($0.name)) }
        for name in names {
            let want = kemenagCore(name)
            guard !want.core.isEmpty else { continue }
            let exact = entries.filter { $0.key.core == want.core }
            if let hit = exact.first(where: { $0.key.kind == want.kind }) ?? exact.first(where: { $0.key.kind == .city }) ?? exact.first {
                return hit.id
            }
            // "Jakarta Selatan" / "South Jakarta" → KOTA JAKARTA: whole-word containment, longest wins.
            let words = Set(want.core.split(separator: " ").map(String.init))
            let partial = entries.filter { e in
                let w = e.key.core.split(separator: " ").map(String.init)
                return !w.isEmpty && Set(w).isSubset(of: words)
            }
            if let best = partial.max(by: { a, b in
                (a.key.core.count, a.key.kind == .city ? 1 : 0) < (b.key.core.count, b.key.kind == .city ? 1 : 0)
            }) {
                return best.id
            }
        }
        return nil
    }

    // MARK: Disk cache

    private static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("OfficialTimetables", isDirectory: true)
    }

    private static func loadFromDisk(_ key: String) -> [String: [String: String]]? {
        let url = directory.appendingPathComponent("\(key).json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode([String: [String: String]].self, from: data)
    }

    private static func saveToDisk(_ key: String, _ table: [String: [String: String]]) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(table) {
            try? data.write(to: directory.appendingPathComponent("\(key).json"), options: .atomic)
        }
    }
}
