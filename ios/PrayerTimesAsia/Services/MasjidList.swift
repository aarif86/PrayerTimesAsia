import Foundation
import MapKit

/// Ready-made masjid and surau lists for every country the app supports,
/// built every week from OpenStreetMap (tools/build_masjid_list.py, the Masjid
/// lists workflow) and cut into one-degree squares (about 110 km). The phone
/// downloads only the few squares around it, once a week, so the Masjid tab
/// fills at once, even on a weak signal, without asking the busy Overpass
/// servers. Only which square is asked for leaves the phone.
@MainActor
final class MasjidList {
    static let shared = MasjidList()

    struct Place {
        let id: String
        let latitude: Double
        let longitude: Double
        let name: String
        let address: String
        let isMusollah: Bool
    }

    struct Index {
        let tiles: Set<String>
        let countries: Set<String>
    }

    nonisolated static let baseURL = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/masjids/"
    nonisolated static let maxAge: TimeInterval = 7 * 24 * 3600

    private var index: Index?
    private var loaded: [String: [Place]] = [:]
    private var failedAt: [String: Date] = [:]

    /// The squares a circle of [km] around here touches (one to four).
    nonisolated static func tiles(around c: Coordinates, km: Double = 15) -> [String] {
        let dLat = km / 111.0
        let dLon = km / (111.0 * max(0.2, cos(c.latitude * .pi / 180)))
        var keys: [String] = []
        for lat in [c.latitude - dLat, c.latitude + dLat] {
            for lon in [c.longitude - dLon, c.longitude + dLon] {
                var wrapped = lon
                if wrapped >= 180 { wrapped -= 360 }
                if wrapped < -180 { wrapped += 360 }
                let key = "\(Int(floor(lat)))_\(Int(floor(wrapped)))"
                if !keys.contains(key) { keys.append(key) }
            }
        }
        return keys
    }

    /// False only when this week's list is known not to cover the country, so
    /// the live search should be used. True while the list is still unknown.
    func mayCover(country: String?) -> Bool {
        guard let country else { return false }
        guard let index = currentIndex() else { return true }
        return index.countries.contains(country.uppercased())
    }

    /// Places within [km] of here, from the squares on the phone. Nil when the
    /// country isn't covered or a square this area needs isn't on the phone yet.
    func places(near c: Coordinates, country: String?, withinKm km: Double = 15) -> [Place]? {
        guard let country, let index = currentIndex(), index.countries.contains(country.uppercased()) else { return nil }
        var all: [Place] = []
        for key in Self.tiles(around: c, km: km) where index.tiles.contains(key) {
            if loaded[key] == nil, let data = try? Data(contentsOf: Self.file("tiles/\(key).json")) {
                loaded[key] = Self.parse(data)
                // A damaged file: remove it so the next download replaces it.
                if loaded[key] == nil { try? FileManager.default.removeItem(at: Self.file("tiles/\(key).json")) }
            }
            guard let list = loaded[key] else { return nil }
            all += list
        }
        return all.filter { Geo.distanceKm(c, Coordinates(latitude: $0.latitude, longitude: $0.longitude)) <= km }
    }

    /// True when the index and this area's squares are on the phone and under a week old.
    func isFresh(near c: Coordinates) -> Bool {
        guard Self.isFresh("index.json"), let index = currentIndex() else { return false }
        return Self.tiles(around: c).filter(index.tiles.contains).allSatisfy { Self.isFresh("tiles/\($0).json") }
    }

    /// Refresh: mark the index and this area's squares as old, so the next
    /// download fetches them again. The copies stay for use without signal.
    func forget(near c: Coordinates) {
        let idx = currentIndex()
        let paths = ["index.json"] + Self.tiles(around: c).filter { idx?.tiles.contains($0) ?? true }.map { "tiles/\($0).json" }
        for path in paths {
            try? FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSince1970: 0)], ofItemAtPath: Self.file(path).path)
        }
        failedAt.removeAll()
    }

    /// Fetches the index and this area's squares when missing or a week old.
    /// True when everything this area needs is on the phone (last week's copy counts).
    func download(near c: Coordinates, country: String?) async -> Bool {
        guard await fetch("index.json", parse: { Self.parseIndex($0) != nil }) else { return false }
        guard let country, let index = currentIndex(), index.countries.contains(country.uppercased()) else { return false }
        var ok = true
        for key in Self.tiles(around: c) where index.tiles.contains(key) {
            let fetched = await fetch("tiles/\(key).json", parse: { Self.parse($0) != nil })
            ok = ok && fetched
        }
        return ok
    }

    /// Downloads one file unless a fresh copy is on the phone. True when a usable
    /// copy (new, or last week's) is on the phone afterwards.
    private func fetch(_ path: String, parse: (Data) -> Bool) async -> Bool {
        let file = Self.file(path)
        let have = FileManager.default.fileExists(atPath: file.path)
        if have, Self.isFresh(path) { return true }
        if let failed = failedAt[path], Date().timeIntervalSince(failed) < 300 { return have }
        guard let url = URL(string: Self.baseURL + path) else { return have }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.setValue("PrayerTimesAsia iOS", forHTTPHeaderField: "User-Agent")
        if let (data, response) = try? await URLSession.shared.data(for: request),
           (response as? HTTPURLResponse)?.statusCode == 200, parse(data) {
            try? FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? data.write(to: file, options: .atomic)
            failedAt[path] = nil
            if path == "index.json" { index = nil } else { loaded[Self.key(path)] = nil }
            return true
        }
        failedAt[path] = Date()
        return have
    }

    private func currentIndex() -> Index? {
        if index == nil, let data = try? Data(contentsOf: Self.file("index.json")) {
            index = Self.parseIndex(data)
        }
        return index
    }

    private nonisolated static func key(_ path: String) -> String {
        path.replacingOccurrences(of: "tiles/", with: "").replacingOccurrences(of: ".json", with: "")
    }

    private nonisolated static func isFresh(_ path: String) -> Bool {
        guard let date = (try? file(path).resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate else { return false }
        return Date().timeIntervalSince(date) < maxAge
    }

    nonisolated static func file(_ path: String) -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return support.appendingPathComponent("masjids", isDirectory: true).appendingPathComponent(path)
    }

    /// `{"tiles": ["3_101", ...], "countries": {"MY": {...}, ...}}`
    nonisolated static func parseIndex(_ data: Data) -> Index? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tiles = root["tiles"] as? [String],
              let countries = root["countries"] as? [String: Any] else { return nil }
        return Index(tiles: Set(tiles), countries: Set(countries.keys))
    }

    /// `{"places": [[id, lat, lon, name, address, musollah 0/1], ...]}`
    nonisolated static func parse(_ data: Data) -> [Place]? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rows = root["places"] as? [[Any]] else { return nil }
        return rows.compactMap { row in
            guard row.count >= 6, let id = row[0] as? String,
                  let lat = (row[1] as? NSNumber)?.doubleValue, let lon = (row[2] as? NSNumber)?.doubleValue else { return nil }
            let musollah = (row[5] as? NSNumber)?.intValue == 1
            let name = (row[3] as? String) ?? ""
            return Place(id: id, latitude: lat, longitude: lon,
                         name: name.isEmpty ? (musollah ? "Musollah" : "Masjid") : name,
                         address: (row[4] as? String) ?? "", isMusollah: musollah)
        }
    }
}
