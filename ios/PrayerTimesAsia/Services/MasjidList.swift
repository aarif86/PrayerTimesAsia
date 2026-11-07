import Foundation
import MapKit

/// Ready-made masjid and surau lists for Singapore, Malaysia and Brunei, built
/// every week from OpenStreetMap (tools/build_masjid_list.py, the Masjid lists
/// workflow) and downloaded once a week. With these on the phone the Masjid tab
/// fills at once, even on a weak signal, without asking the busy Overpass
/// servers. Only the country's list is fetched; nothing about you is sent.
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

    nonisolated static let baseURL = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/masjids/"
    nonisolated static let maxAge: TimeInterval = 7 * 24 * 3600

    /// Rough outline of each country, a little wider so a place near a border
    /// (Johor Bahru from Woodlands) also gets its neighbour's list.
    nonisolated private static let boxes: [String: (minLat: Double, maxLat: Double, minLon: Double, maxLon: Double)] = [
        "SG": (1.13, 1.50, 103.55, 104.15),
        "MY": (0.80, 7.50, 99.50, 119.40),
        "BN": (4.00, 5.10, 113.95, 115.40),
    ]

    private var loaded: [String: [Place]] = [:]
    private var failedAt: [String: Date] = [:]

    /// The lists that cover this point (empty outside SG, MY and BN).
    nonisolated static func countries(near c: Coordinates) -> [String] {
        boxes.filter { _, b in
            c.latitude >= b.minLat - 0.15 && c.latitude <= b.maxLat + 0.15
                && c.longitude >= b.minLon - 0.15 && c.longitude <= b.maxLon + 0.15
        }.keys.sorted()
    }

    /// Places within [km] of here from the lists on the phone, nearest first.
    /// Nil when a list this area needs isn't on the phone yet.
    func places(near c: Coordinates, withinKm km: Double) -> [Place]? {
        let needed = Self.countries(near: c)
        guard !needed.isEmpty else { return nil }
        var all: [Place] = []
        for cc in needed {
            if loaded[cc] == nil, let data = try? Data(contentsOf: Self.file(cc)) {
                loaded[cc] = Self.parse(data)
                // A damaged file: remove it so the next download replaces it.
                if loaded[cc] == nil { try? FileManager.default.removeItem(at: Self.file(cc)) }
            }
            guard let list = loaded[cc] else { return nil }
            all += list
        }
        // A cheap box test first: Malaysia's list has thousands of places.
        let dLat = km / 111.0
        let dLon = km / (111.0 * max(0.2, cos(c.latitude * .pi / 180)))
        return all.filter { abs($0.latitude - c.latitude) <= dLat && abs($0.longitude - c.longitude) <= dLon }
            .filter { Geo.distanceKm(c, Coordinates(latitude: $0.latitude, longitude: $0.longitude)) <= km }
    }

    /// True when every list this area needs is on the phone and less than a week old.
    func isFresh(near c: Coordinates) -> Bool {
        Self.countries(near: c).allSatisfy { cc in
            guard let date = (try? Self.file(cc).resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate else { return false }
            return Date().timeIntervalSince(date) < Self.maxAge
        }
    }

    /// Fetches this area's lists that are missing or a week old. True when every
    /// list it needs is now on the phone. A list that failed isn't asked for
    /// again for five minutes.
    func download(near c: Coordinates) async -> Bool {
        var ok = true
        for cc in Self.countries(near: c) {
            let file = Self.file(cc)
            let age = (try? file.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
                .map { Date().timeIntervalSince($0) }
            if let age, age < Self.maxAge { continue }
            if let failed = failedAt[cc], Date().timeIntervalSince(failed) < 300 { ok = ok && age != nil; continue }
            guard let url = URL(string: Self.baseURL + cc.lowercased() + ".json") else { continue }
            var request = URLRequest(url: url, timeoutInterval: 15)
            request.setValue("PrayerTimesAsia iOS", forHTTPHeaderField: "User-Agent")
            if let (data, response) = try? await URLSession.shared.data(for: request),
               (response as? HTTPURLResponse)?.statusCode == 200,
               let parsed = Self.parse(data), !parsed.isEmpty {
                try? FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
                try? data.write(to: file, options: .atomic)
                loaded[cc] = parsed
                failedAt[cc] = nil
            } else {
                failedAt[cc] = Date()
                // Last week's copy still counts.
                ok = ok && age != nil
            }
        }
        return ok
    }

    nonisolated static func file(_ cc: String) -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return support.appendingPathComponent("masjids", isDirectory: true).appendingPathComponent(cc.lowercased() + ".json")
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
