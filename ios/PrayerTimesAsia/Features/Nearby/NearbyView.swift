import MapKit
import SwiftUI

/// Masjids and musollahs (surau, prayer rooms) near the active place, found with
/// Apple Maps search and OpenStreetMap together. Apple's listings are rich in
/// Singapore but thin in much of Malaysia and Indonesia (in Johor Bahru it lists
/// hardly any masjid or surau), where OpenStreetMap fills the gaps.
struct PrayerSpace: Identifiable, Hashable {
    enum Kind: String, CaseIterable, Identifiable {
        case all = "All", masjid = "Masjid", musollah = "Prayer room"
        var id: String { rawValue }
    }

    let id: String
    let name: String
    let address: String
    let coordinate: CLLocationCoordinate2D
    var distanceKm: Double
    let isMusollah: Bool
    let item: MKMapItem
    /// Letters from the map data: w women's space, a wheelchair, p parking, t toilets.
    var facilities: String = ""
    /// OpenStreetMap opening_hours ("Mo-Su 10:00-22:00"), mostly musollahs in malls.
    var hours: String? = nil

    var coordinates: Coordinates { Coordinates(latitude: coordinate.latitude, longitude: coordinate.longitude) }

    static func == (a: PrayerSpace, b: PrayerSpace) -> Bool { a.id == b.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

@MainActor
@Observable
final class NearbySearch {
    private(set) var spaces: [PrayerSpace] = []
    private(set) var searchedAround: Coordinates?
    private(set) var failed = false
    /// Apple Maps is still looking (the list waits only for this).
    private(set) var isLoading = false
    /// OpenStreetMap is still answering; its places join the list when it does.
    private(set) var isAddingMore = false

    private static let queries = ["masjid", "mosque", "musolla", "surau", "prayer room"]
    nonisolated private static let musollahWords = ["musolla", "musalla", "musholla", "surau", "prayer room", "prayer space", "mushola", "prayer hall"]
    nonisolated private static let overpassMirrors = ["https://overpass-api.de/api/interpreter",
                                          "https://overpass.private.coffee/api/interpreter",
                                          "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]

    /// Both sources search well past where you are (Apple about 10 km across,
    /// OpenStreetMap 12 km around), so while you drive the list is kept from
    /// what is already found and only searched again once you are this far on.
    nonisolated static let appleRefreshKm = 4.0
    nonisolated static let osmRefreshKm = 6.0
    /// Give up on OpenStreetMap after this long; Apple's places are already showing.
    nonisolated static let osmDeadline: Duration = .seconds(12)

    private var here: Coordinates?
    private var apple: [PrayerSpace] = []
    private var osm: [PrayerSpace] = []
    private var appleCenter: Coordinates?
    private var osmCenter: Coordinates?
    private var appleOK = false
    private var osmOK = false
    private var lastOSMTry: Date?
    // Owned here, not by the screen, so a GPS update while driving can't
    // cancel a search halfway and start it again from nothing.
    private var appleTask: Task<Void, Never>?
    private var osmTask: Task<Void, Never>?

    /// Call whenever the place changes. Distances update straight away from what
    /// is already found; a new search only starts once you've moved far enough.
    func search(around center: Coordinates, country: String? = nil) {
        if let country, country != self.country {
            self.country = country
            listFailed = false  // a new country: try its ready-made list
        }
        here = center
        searchedAround = center
        rebuild()

        if appleTask == nil, appleCenter.map({ Geo.distanceKm($0, center) >= Self.appleRefreshKm }) ?? true {
            searchApple(around: center)
        }
        // The weekly ready-made list replaces the live OpenStreetMap search,
        // so nothing waits on busy servers. Live search only where it can't help.
        if MasjidList.shared.mayCover(country: country), !listFailed {
            if let ready = MasjidList.shared.places(near: center, country: country) {
                osm = ready.map(Self.space)
                osmCenter = center
                osmOK = true
                rebuild()
                if !MasjidList.shared.isFresh(near: center) { downloadList(near: center) }
            } else {
                downloadList(near: center)
            }
            return
        }

        if osmTask == nil, osmCenter.map({ Geo.distanceKm($0, center) >= Self.osmRefreshKm }) ?? true {
            if let saved = OverpassCache.load(near: center, within: Self.osmRefreshKm),
               let parsed = Self.parseOverpass(saved.data, center: saved.center) {
                osm = parsed
                osmCenter = saved.center
                osmOK = true
                rebuild()
            } else if lastOSMTry.map({ Date().timeIntervalSince($0) > 60 }) ?? true {
                searchOpenStreetMap(around: center)
            }
        }
    }

    private func searchApple(around center: Coordinates) {
        isLoading = true
        let region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude),
                                        latitudinalMeters: 10_000, longitudinalMeters: 10_000)
        appleTask = Task { [weak self] in
            var found: [String: PrayerSpace] = [:]
            var anySucceeded = false
            await withTaskGroup(of: [MKMapItem].self) { group in
                for q in Self.queries {
                    group.addTask {
                        let request = MKLocalSearch.Request()
                        request.naturalLanguageQuery = q
                        request.region = region
                        request.resultTypes = .pointOfInterest
                        return (try? await MKLocalSearch(request: request).start().mapItems) ?? []
                    }
                }
                for await items in group {
                    if !items.isEmpty { anySucceeded = true }
                    for item in items {
                        let c = item.placemark.coordinate
                        let name = item.name ?? "Prayer space"
                        let key = "\(name.lowercased())|\((c.latitude * 2000).rounded())|\((c.longitude * 2000).rounded())"
                        guard found[key] == nil, Self.looksLikePrayerSpace(name) else { continue }
                        let lower = name.lowercased()
                        found[key] = PrayerSpace(
                            id: key, name: name,
                            address: [item.placemark.thoroughfare, item.placemark.locality].compactMap { $0 }.joined(separator: ", "),
                            coordinate: c, distanceKm: 0,
                            isMusollah: Self.musollahWords.contains { lower.contains($0) },
                            item: item)
                    }
                    // First search here: show each answer as it comes rather than
                    // waiting for all five. Later ones (you've driven on) swap in
                    // at the end, so the list doesn't shrink and grow on the way.
                    guard let self, self.appleCenter == nil else { continue }
                    self.apple = Array(found.values)
                    self.rebuild()
                }
            }
            guard let self else { return }
            self.apple = Array(found.values)
            self.appleOK = anySucceeded
            if anySucceeded { self.appleCenter = center }
            self.isLoading = false
            self.appleTask = nil
            self.rebuild()
            // Moved on a lot while searching? Catch up.
            if anySucceeded, let now = self.here { self.search(around: now) }
        }
    }

    private var listTask: Task<Void, Never>?
    private var listFailed = false
    private var country: String?
    private var refreshing = false

    private func downloadList(near center: Coordinates) {
        guard listTask == nil else { return }
        let country = self.country
        let firstTime = MasjidList.shared.places(near: center, country: country) == nil
        if firstTime { isAddingMore = true }
        listTask = Task { [weak self] in
            let ok = await MasjidList.shared.download(near: center, country: country)
            guard let self else { return }
            self.listTask = nil
            if firstTime { self.isAddingMore = false }
            // No list and no copy from last week: fall back to the live search.
            // A weekly refresh just swaps in quietly; only the first download
            // needs the list rebuilt now.
            let wasRefresh = self.refreshing
            self.refreshing = false
            // A quiet daily refresh also swaps in when it worked, so new places
            // (such as added prayer rooms) show without waiting for a move.
            let fresh = ok && self.here.map { MasjidList.shared.isFresh(near: $0) } == true
            guard firstTime || wasRefresh || fresh else { return }
            if !ok { self.listFailed = true }
            if let now = self.here { self.search(around: now) }
        }
    }

    private static func space(_ p: MasjidList.Place) -> PrayerSpace {
        let coordinate = CLLocationCoordinate2D(latitude: p.latitude, longitude: p.longitude)
        let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        item.name = p.name
        return PrayerSpace(id: "osm/\(p.id)", name: p.name, address: p.address, coordinate: coordinate,
                           distanceKm: 0, isMusollah: p.isMusollah, item: item,
                           facilities: p.facilities, hours: p.hours)
    }

    /// Refresh: fetch this area's ready-made list again (last week's copy stays
    /// if there's no signal), and search Apple Maps again.
    func refresh() {
        if let here { MasjidList.shared.forget(near: here) }
        refreshing = true
        retry()
    }

    /// Try again from the empty screen: forget past failures and ask afresh.
    func retry() {
        listFailed = false
        lastOSMTry = nil
        appleCenter = nil
        osmCenter = nil
        if let here { search(around: here) }
    }

    private func searchOpenStreetMap(around center: Coordinates) {
        isAddingMore = true
        lastOSMTry = Date()
        osmTask = Task { [weak self] in
            let data = await Self.fetchOverpass(around: center)
            guard let self else { return }
            if let data, let parsed = Self.parseOverpass(data, center: center) {
                OverpassCache.save(data, center: center)
                self.osm = parsed
                self.osmCenter = center
                self.osmOK = true
            }
            self.isAddingMore = false
            self.osmTask = nil
            self.rebuild()
            if data != nil, let now = self.here { self.search(around: now) }
        }
    }

    /// Merges both sources and measures from where you are now.
    private func rebuild() {
        guard let here else { return }
        func measured(_ s: PrayerSpace) -> PrayerSpace? {
            var s = s
            s.distanceKm = Geo.distanceKm(here, Coordinates(latitude: s.coordinate.latitude, longitude: s.coordinate.longitude))
            return s.distanceKm <= 15 ? s : nil
        }
        var merged = apple.compactMap(measured)
        // The same masjid is often in both; keep Apple's (better directions)
        // and add OpenStreetMap places that aren't already pinned close by.
        for space in osm.compactMap(measured) where !merged.contains(where: { Self.metres($0.coordinate, space.coordinate) < 80 }) {
            merged.append(space)
        }
        spaces = merged.sorted { $0.distanceKm < $1.distanceKm }
        failed = spaces.isEmpty && !appleOK && !osmOK && !isLoading && !isAddingMore
    }

    private nonisolated static func metres(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    /// Muslim places of worship within [radius] metres, from OpenStreetMap's
    /// Overpass API. No result cap: Overpass returns capped results in id order,
    /// not nearest first, which would drop places near the user in busy areas.
    nonisolated static func overpassQuery(around c: Coordinates, radius: Int = 12_000) -> String {
        let at = String(format: "%.4f,%.4f", c.latitude, c.longitude)
        return "[out:json][timeout:20];(nwr[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"](around:\(radius),\(at)););out center tags;"
    }

    /// Asks every mirror at once and takes the first good answer, so one busy
    /// server can't hold up the list. Only the search area is sent. Nil when
    /// none answer within [osmDeadline].
    nonisolated static func fetchOverpass(around center: Coordinates) async -> Data? {
        let query = overpassQuery(around: center)
        enum Answer: Sendable { case mirror(Data?), timeUp }
        return await withTaskGroup(of: Answer.self) { group in
            for base in Self.overpassMirrors {
                group.addTask {
                    var parts = URLComponents(string: base)
                    parts?.queryItems = [URLQueryItem(name: "data", value: query)]
                    guard let url = parts?.url else { return .mirror(nil) }
                    var request = URLRequest(url: url, timeoutInterval: 15)
                    request.setValue("PrayerTimesAsia iOS", forHTTPHeaderField: "User-Agent")
                    guard let answer = try? await URLSession.shared.data(for: request),
                          (answer.1 as? HTTPURLResponse)?.statusCode == 200,
                          Self.parseOverpass(answer.0, center: center) != nil else { return .mirror(nil) }
                    return .mirror(answer.0)
                }
            }
            group.addTask {
                try? await Task.sleep(for: Self.osmDeadline)
                return .timeUp
            }
            var mirrorsLeft = Self.overpassMirrors.count
            for await answer in group {
                switch answer {
                case .mirror(let data?):
                    group.cancelAll()
                    return data
                case .mirror(nil):
                    mirrorsLeft -= 1
                    if mirrorsLeft == 0 { group.cancelAll(); return nil }
                case .timeUp:
                    group.cancelAll()
                    return nil
                }
            }
            return nil
        }
    }

    /// Overpass JSON to prayer spaces within 15 km, nearest first.
    nonisolated static func parseOverpass(_ data: Data, center: Coordinates) -> [PrayerSpace]? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let elements = root["elements"] as? [[String: Any]] else { return nil }
        var found: [String: PrayerSpace] = [:]
        for e in elements {
            let mid = e["center"] as? [String: Any]
            guard let lat = (e["lat"] ?? mid?["lat"]) as? Double,
                  let lon = (e["lon"] ?? mid?["lon"]) as? Double else { continue }
            let tags = e["tags"] as? [String: String] ?? [:]
            let rawName = [tags["name:en"], tags["name"]].compactMap { $0 }.first { !$0.isEmpty } ?? ""
            if !rawName.isEmpty, isGraveOrShrine(rawName) { continue }
            let lower = rawName.lowercased()
            let kindTag = (tags["place_of_worship:type"] ?? tags["place_of_worship"] ?? "").lowercased()
            let isMusollah = musollahWords.contains { lower.contains($0) }
                || ["musalla", "musholla", "surau", "prayer_room", "musallah"].contains(kindTag)
            let point = Coordinates(latitude: lat, longitude: lon)
            let km = Geo.distanceKm(center, point)
            guard km <= 15 else { continue }
            let name = rawName.isEmpty ? (isMusollah ? "Prayer room" : "Masjid") : rawName
            let key = "\(name.lowercased())|\((lat * 2000).rounded())|\((lon * 2000).rounded())"
            guard found[key] == nil else { continue }
            let street = [tags["addr:housenumber"], tags["addr:street"]].compactMap { $0 }.joined(separator: " ")
            let address = [street.isEmpty ? nil : street, tags["addr:suburb"] ?? tags["addr:city"]]
                .compactMap { $0 }.joined(separator: ", ")
            let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lon)
            let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
            item.name = name
            let hours = tags["opening_hours"].flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
            found[key] = PrayerSpace(id: "osm/\(e["type"] as? String ?? "node")/\(e["id"] as? Int ?? 0)",
                                     name: name, address: address, coordinate: coordinate, distanceKm: km,
                                     isMusollah: isMusollah, item: item,
                                     facilities: facilities(tags), hours: hours)
        }
        return found.values.sorted { $0.distanceKm < $1.distanceKm }
    }

    /// The same letters the weekly list builder writes (tools/build_masjid_list.py).
    nonisolated static func facilities(_ tags: [String: String]) -> String {
        let yes: Set<String> = ["yes", "designated", "limited", "separate", "only"]
        func has(_ key: String) -> Bool { tags[key].map { yes.contains($0.lowercased()) } ?? false }
        var out = ""
        if ["female", "women", "prayer_room:female", "female_prayer_room"].contains(where: has) { out += "w" }
        if has("wheelchair") { out += "a" }
        if let p = tags["parking"]?.lowercased(), !p.isEmpty, p != "no" { out += "p" }
        if has("toilets") { out += "t" }
        return out
    }

    /// Graves and shrines that OpenStreetMap tags as places of worship (Kubur Kassim,
    /// Keramat Radin Mas). Not places to pray in, unless the name also says masjid or surau.
    nonisolated static func isGraveOrShrine(_ name: String) -> Bool {
        let n = name.lowercased()
        guard n.range(of: #"\b(kubur|keramat|makam|maqam|tomb|grave|cemetery|perkuburan|dargah|shrine)\b"#, options: .regularExpression) != nil
        else { return false }
        return n.range(of: #"\b(masjid|mosque|surau|musolla|musalla|musholla|mushola|prayer)\b"#, options: .regularExpression) == nil
    }

    /// Search for "mosque" also returns shops and streets named after one; keep
    /// results whose name says what they are.
    static func looksLikePrayerSpace(_ name: String) -> Bool {
        let n = name.lowercased()
        if isGraveOrShrine(name) { return false }
        // Bus stops, stations and roads named after a mosque ("Darul Ghufran Mosque
        // Stop", "Mosque Street") - but keep "Masjid Jalan Kebun".
        let transport = [" stop", "bus ", "station", "mrt", "lrt", "car park", "carpark", " exit", "halte"]
        if transport.contains(where: { n.contains($0) }) { return false }
        let streetWords: Set<String> = ["street", "st", "road", "rd", "jalan", "jln", "lorong", "avenue", "ave"]
        let tokens = n.split(whereSeparator: { !$0.isLetter }).map(String.init)
        if let first = tokens.first, let last = tokens.last,
           streetWords.contains(first) || streetWords.contains(last) { return false }
        let words = ["masjid", "mosque", "mesjid", "musolla", "musalla", "musholla", "mushola", "surau",
                     "prayer", "jami", "islamic cent", "islamic center", "camii", "cami ", "masjed", "مسجد",
                     "清真寺", "モスク", "모스크", "nhà thờ hồi giáo", "มัสยิด"]
        return words.contains { n.contains($0) }
    }
}

/// OpenStreetMap answers kept on the phone for a week, so coming back to the
/// same area (home, work, the usual highway stops) shows its masjids at once
/// without asking the busy Overpass servers again. Only the search area and
/// the public answer are kept, nothing about you.
enum OverpassCache {
    private struct Entry: Codable {
        var latitude: Double
        var longitude: Double
        var savedAt: Date
        var data: Data
    }

    static let maxAge: TimeInterval = 7 * 24 * 3600
    private static let maxEntries = 40

    private static var folder: URL? {
        guard let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let url = caches.appendingPathComponent("overpass", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private static func entries() -> [(url: URL, entry: Entry)] {
        guard let folder,
              let files = try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil) else { return [] }
        return files.compactMap { url in
            guard let raw = try? Data(contentsOf: url),
                  let entry = try? JSONDecoder().decode(Entry.self, from: raw) else { return nil }
            return (url, entry)
        }
    }

    /// The freshest saved answer searched within [km] of here, if any.
    static func load(near here: Coordinates, within km: Double) -> (data: Data, center: Coordinates)? {
        let now = Date()
        let usable = entries().filter { now.timeIntervalSince($0.entry.savedAt) < maxAge }
            .map { (entry: $0.entry, center: Coordinates(latitude: $0.entry.latitude, longitude: $0.entry.longitude)) }
            .filter { Geo.distanceKm($0.center, here) < km }
            .min { Geo.distanceKm($0.center, here) < Geo.distanceKm($1.center, here) }
        return usable.map { ($0.entry.data, $0.center) }
    }

    static func save(_ data: Data, center: Coordinates) {
        guard let folder else { return }
        let name = String(format: "%.3f_%.3f.json", center.latitude, center.longitude)
        let entry = Entry(latitude: center.latitude, longitude: center.longitude, savedAt: Date(), data: data)
        guard let raw = try? JSONEncoder().encode(entry) else { return }
        try? raw.write(to: folder.appendingPathComponent(name), options: .atomic)
        // Keep the folder small: drop old answers and the oldest beyond the limit.
        let all = entries().sorted { $0.entry.savedAt > $1.entry.savedAt }
        for (i, item) in all.enumerated() where i >= maxEntries || Date().timeIntervalSince(item.entry.savedAt) > maxAge {
            try? FileManager.default.removeItem(at: item.url)
        }
    }
}
