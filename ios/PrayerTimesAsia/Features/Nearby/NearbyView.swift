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
    let distanceKm: Double
    let isMusollah: Bool
    let item: MKMapItem

    static func == (a: PrayerSpace, b: PrayerSpace) -> Bool { a.id == b.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

@MainActor
@Observable
final class NearbySearch {
    private(set) var spaces: [PrayerSpace] = []
    private(set) var isLoading = false
    private(set) var searchedAround: Coordinates?
    private(set) var failed = false

    private static let queries = ["masjid", "mosque", "musolla", "surau", "prayer room"]
    nonisolated private static let musollahWords = ["musolla", "musalla", "musholla", "surau", "prayer room", "prayer space", "mushola", "prayer hall"]
    nonisolated private static let overpassMirrors = ["https://overpass-api.de/api/interpreter",
                                          "https://overpass.private.coffee/api/interpreter",
                                          "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]

    func search(around center: Coordinates) async {
        if let last = searchedAround, Geo.distanceKm(last, center) < 0.5, !spaces.isEmpty { return }
        isLoading = true
        failed = false
        defer { isLoading = false }
        let region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude),
                                        latitudinalMeters: 10_000, longitudinalMeters: 10_000)
        // OpenStreetMap runs alongside the Apple searches.
        async let osm = Self.searchOpenStreetMap(around: center)
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
                    let km = Geo.distanceKm(center, Coordinates(latitude: c.latitude, longitude: c.longitude))
                    guard km <= 15, found[key] == nil, Self.looksLikePrayerSpace(name) else { continue }
                    let lower = name.lowercased()
                    found[key] = PrayerSpace(
                        id: key, name: name,
                        address: [item.placemark.thoroughfare, item.placemark.locality].compactMap { $0 }.joined(separator: ", "),
                        coordinate: c, distanceKm: km,
                        isMusollah: Self.musollahWords.contains { lower.contains($0) },
                        item: item)
                }
            }
        }
        let fromOSM = await osm
        if fromOSM != nil { anySucceeded = true }
        var merged = Array(found.values)
        // The same masjid is often in both; keep Apple's (better directions)
        // and add OpenStreetMap places that aren't already pinned close by.
        for space in fromOSM ?? [] where !merged.contains(where: { Self.metres($0.coordinate, space.coordinate) < 80 }) {
            merged.append(space)
        }
        spaces = merged.sorted { $0.distanceKm < $1.distanceKm }
        searchedAround = center
        failed = !anySucceeded && spaces.isEmpty
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

    /// Asks every mirror at once and takes the first answer, so one busy server
    /// can't hold up the list. Only the search area is sent. Nil when none answer.
    nonisolated static func searchOpenStreetMap(around center: Coordinates) async -> [PrayerSpace]? {
        let query = overpassQuery(around: center)
        return await withTaskGroup(of: [PrayerSpace]?.self) { group in
            for base in Self.overpassMirrors {
                group.addTask {
                    var parts = URLComponents(string: base)
                    parts?.queryItems = [URLQueryItem(name: "data", value: query)]
                    guard let url = parts?.url else { return nil }
                    var request = URLRequest(url: url, timeoutInterval: 20)
                    request.setValue("PrayerTimesAsia iOS", forHTTPHeaderField: "User-Agent")
                    guard let answer = try? await URLSession.shared.data(for: request),
                          (answer.1 as? HTTPURLResponse)?.statusCode == 200 else { return nil }
                    return Self.parseOverpass(answer.0, center: center)
                }
            }
            for await result in group {
                if let result {
                    group.cancelAll()
                    return result
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
                    if let place = model.activePlace {
                        Annotation("You", coordinate: CLLocationCoordinate2D(latitude: place.coordinates.latitude,
                                                                             longitude: place.coordinates.longitude)) {
                            Circle().fill(.blue).frame(width: 14, height: 14)
                                .overlay(Circle().stroke(.white, lineWidth: 3))
                        }
                    }
                    ForEach(visible) { space in
                        Marker(space.name, systemImage: space.isMusollah ? "house.fill" : "moon.stars.fill",
                               coordinate: space.coordinate)
                            .tint(space.isMusollah ? Prayer.fajr.tint : Theme.accent)
                            .tag(space)
                    }
                }
                .frame(height: 300)

                Picker("Type", selection: $kind) {
                    ForEach(PrayerSpace.Kind.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding()

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
                await search.search(around: c)
            }
            .onChange(of: selected) { _, space in
                if let space {
                    withAnimation { camera = .camera(MapCamera(centerCoordinate: space.coordinate, distance: 1500)) }
                }
            }
        }
    }

    @ViewBuilder
    private var list: some View {
        if model.activePlace == nil {
            ContentUnavailableView("Choose a place", systemImage: "location.slash",
                                   description: Text("Allow location or pick a city on the Today tab."))
        } else if search.isLoading && search.spaces.isEmpty {
            ProgressView("Searching nearby…").frame(maxHeight: .infinity)
        } else if visible.isEmpty {
            ContentUnavailableView(search.failed ? "Couldn't search" : "Nothing listed nearby",
                                   systemImage: "moon.stars",
                                   description: Text(search.failed
                                                     ? "Searching needs an internet connection."
                                                     : "Neither Apple Maps nor OpenStreetMap lists a \(kind == .musollah ? "musollah" : "masjid") within 15 km. Use the Qibla tab to pray where you are."))
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
