import MapKit
import SwiftUI

/// Masjids and musollahs (surau, prayer rooms) near the active place, found with
/// Apple Maps search and OpenStreetMap together. Apple's listings are rich in
/// Singapore but thin in much of Malaysia and Indonesia (in Johor Bahru it lists
/// hardly any masjid or surau), where OpenStreetMap fills the gaps.
struct PrayerSpace: Identifiable, Hashable {
    enum Kind: String, CaseIterable, Identifiable {
        case all = "All", masjid = "Masjid", musollah = "Musollah"
        var id: String { rawValue }
    }

    let id: String
    let name: String
    let address: String
    let coordinate: CLLocationCoordinate2D
    var distanceKm: Double
    let isMusollah: Bool
    let item: MKMapItem

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
    func search(around center: Coordinates) {
        here = center
        searchedAround = center
        rebuild()

        if appleTask == nil, appleCenter.map({ Geo.distanceKm($0, center) >= Self.appleRefreshKm }) ?? true {
            searchApple(around: center)
        }
        // Singapore, Malaysia and Brunei: the weekly ready-made list replaces
        // the live OpenStreetMap search, so nothing waits on busy servers.
        if !MasjidList.countries(near: center).isEmpty, !listFailed {
            if let ready = MasjidList.shared.places(near: center, withinKm: 15) {
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

    private func downloadList(near center: Coordinates) {
        guard listTask == nil else { return }
        let firstTime = MasjidList.shared.places(near: center, withinKm: 15) == nil
        if firstTime { isAddingMore = true }
        listTask = Task { [weak self] in
            let ok = await MasjidList.shared.download(near: center)
            guard let self else { return }
            self.listTask = nil
            if firstTime { self.isAddingMore = false }
            // No list and no copy from last week: fall back to the live search.
            // A weekly refresh just swaps in quietly; only the first download
            // needs the list rebuilt now.
            guard firstTime else { return }
            if !ok { self.listFailed = true }
            if let now = self.here { self.search(around: now) }
        }
    }

    private static func space(_ p: MasjidList.Place) -> PrayerSpace {
        let coordinate = CLLocationCoordinate2D(latitude: p.latitude, longitude: p.longitude)
        let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        item.name = p.name
        return PrayerSpace(id: "osm/\(p.id)", name: p.name, address: p.address, coordinate: coordinate,
                           distanceKm: 0, isMusollah: p.isMusollah, item: item)
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
            let lower = rawName.lowercased()
            let kindTag = (tags["place_of_worship:type"] ?? tags["place_of_worship"] ?? "").lowercased()
            let isMusollah = musollahWords.contains { lower.contains($0) }
                || ["musalla", "musholla", "surau", "prayer_room", "musallah"].contains(kindTag)
            let point = Coordinates(latitude: lat, longitude: lon)
            let km = Geo.distanceKm(center, point)
            guard km <= 15 else { continue }
            let name = rawName.isEmpty ? (isMusollah ? "Musollah" : "Masjid") : rawName
            let key = "\(name.lowercased())|\((lat * 2000).rounded())|\((lon * 2000).rounded())"
            guard found[key] == nil else { continue }
            let street = [tags["addr:housenumber"], tags["addr:street"]].compactMap { $0 }.joined(separator: " ")
            let address = [street.isEmpty ? nil : street, tags["addr:suburb"] ?? tags["addr:city"]]
                .compactMap { $0 }.joined(separator: ", ")
            let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lon)
            let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
            item.name = name
            found[key] = PrayerSpace(id: "osm/\(e["type"] as? String ?? "node")/\(e["id"] as? Int ?? 0)",
                                     name: name, address: address, coordinate: coordinate, distanceKm: km,
                                     isMusollah: isMusollah, item: item)
        }
        return found.values.sorted { $0.distanceKm < $1.distanceKm }
    }

    /// Search for "mosque" also returns shops and streets named after one; keep
    /// results whose name says what they are.
    static func looksLikePrayerSpace(_ name: String) -> Bool {
        let n = name.lowercased()
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

struct NearbyView: View {
    @Environment(AppModel.self) private var model
    @State private var search = NearbySearch()
    @State private var kind: PrayerSpace.Kind = .all
    @State private var camera: MapCameraPosition = .automatic
    @State private var selected: PrayerSpace?
    @State private var showAbout = false
    @State private var slow = false

    private var visible: [PrayerSpace] {
        switch kind {
        case .all: search.spaces
        case .masjid: search.spaces.filter { !$0.isMusollah }
        case .musollah: search.spaces.filter(\.isMusollah)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Map(position: $camera, selection: $selected) {
                    ForEach(visible) { space in
                        Marker(space.name, systemImage: space.isMusollah ? "house.fill" : "moon.stars.fill",
                               coordinate: space.coordinate)
                            .tint(space.isMusollah ? Prayer.fajr.tint : Theme.accent)
                            .tag(space)
                    }
                    // Drawn after the pins so it sits on top of them.
                    if let you = youCoordinate {
                        Annotation("You are here", coordinate: you, anchor: .center) {
                            ZStack {
                                Circle().fill(.blue.opacity(0.18)).frame(width: 44, height: 44)
                                Circle().fill(.blue).frame(width: 18, height: 18)
                                    .overlay(Circle().stroke(.white, lineWidth: 3))
                                    .shadow(radius: 2)
                            }
                        }
                        .annotationTitles(.visible)
                    }
                }
                .frame(height: 300)
                .overlay(alignment: .bottomTrailing) {
                    if youCoordinate != nil {
                        Button { selected = nil; showYou(animated: true) } label: {
                            Image(systemName: "location.fill")
                                .font(.body.weight(.semibold))
                                .frame(width: 44, height: 44)
                                .background(.regularMaterial, in: Circle())
                        }
                        .accessibilityLabel("Show where I am")
                        .padding(12)
                    }
                }

                Picker("Type", selection: $kind) {
                    ForEach(PrayerSpace.Kind.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding([.horizontal, .top])

                if let place = model.activePlace {
                    Label("Distances from you, near \(place.name)", systemImage: "location.fill")
                        .font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal).padding(.vertical, 8)
                }

                MyMasjidRow()
                    .padding(.bottom, 8)

                if search.isAddingMore && !search.spaces.isEmpty {
                    HStack(spacing: 6) {
                        ProgressView().controlSize(.mini)
                        Text("Looking for more surau and musollah…")
                    }
                    .font(.caption).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal).padding(.bottom, 6)
                    .transition(.opacity)
                }

                list
            }
            .background(SkyNow())
            .navigationTitle("Masjid & Musollah")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAbout = true } label: { Image(systemName: "info.circle") }
                        .accessibilityLabel("About this app")
                }
            }
            .sheet(isPresented: $showAbout) { MakersSheet(placement: "masjid") }
            .task(id: model.activePlace?.coordinates) {
                guard let c = model.activePlace?.coordinates else { return }
                slow = false
                showYou(animated: false)
                search.search(around: c)
            }
            .onChange(of: selected) { _, space in
                if let space {
                    withAnimation { camera = .camera(MapCamera(centerCoordinate: space.coordinate, distance: 1500)) }
                }
            }
        }
    }

    private var youCoordinate: CLLocationCoordinate2D? {
        model.activePlace.map { CLLocationCoordinate2D(latitude: $0.coordinates.latitude, longitude: $0.coordinates.longitude) }
    }

    /// Centre on you at walking scale (about 3 km across), rather than zooming
    /// out to fit every pin within 15 km, which hid where you are.
    private func showYou(animated: Bool) {
        guard let you = youCoordinate else { return }
        let target = MapCameraPosition.region(MKCoordinateRegion(center: you, latitudinalMeters: 3_000, longitudinalMeters: 3_000))
        if animated { withAnimation { camera = target } } else { camera = target }
    }

    @ViewBuilder
    private var list: some View {
        if model.activePlace == nil {
            ContentUnavailableView("Choose a place", systemImage: "location.slash",
                                   description: Text("Allow location or pick a city on the Today tab."))
        } else if (search.isLoading || search.isAddingMore) && search.spaces.isEmpty && !slow {
            ProgressView("Searching nearby…").frame(maxHeight: .infinity)
                .task {
                    // Never leave a bare spinner: after a few seconds say so and offer Try again.
                    try? await Task.sleep(for: .seconds(6))
                    slow = true
                }
        } else if visible.isEmpty {
            let busy = search.isLoading || search.isAddingMore
            ContentUnavailableView {
                Label(busy ? "Still looking" : search.failed ? "Couldn't search" : "Nothing listed nearby",
                      systemImage: "moon.stars")
            } description: {
                Text(busy ? "The connection is slow. Places will appear here as soon as they arrive."
                     : search.failed ? "Searching needs an internet connection."
                     : "Neither Apple Maps nor OpenStreetMap lists a \(kind == .musollah ? "musollah" : "masjid") within 15 km. Use the Qibla tab to pray where you are.")
            } actions: {
                if busy || search.failed {
                    Button("Try again") { slow = false; search.retry() }
                        .buttonStyle(.bordered)
                }
            }
        } else {
            List {
                ForEach(visible) { space in
                    Button { selected = space } label: {
                        HStack(spacing: 12) {
                            Image(systemName: space.isMusollah ? "house.fill" : "moon.stars.fill")
                                .foregroundStyle(space.isMusollah ? Prayer.fajr.tint : Theme.accent)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(space.name).font(.body.weight(.semibold)).foregroundStyle(.primary)
                                if !space.address.isEmpty {
                                    Text(space.address).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                }
                            }
                            Spacer()
                            Text(space.distanceKm < 1 ? "\(Int(space.distanceKm * 1000)) m"
                                 : String(format: "%.1f km", space.distanceKm))
                                .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                        }
                    }
                    .listRowBackground(Color.clear)
                .swipeActions {
                        Button("Directions") {
                            space.item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])
                        }
                        .tint(.blue)
                    }
                    .contextMenu {
                        Button("Walking directions", systemImage: "figure.walk") {
                            space.item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])
                        }
                        Button("Driving directions", systemImage: "car.fill") {
                            space.item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
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
