import MapKit
import SwiftUI

/// Masjids and musollahs (surau, prayer rooms) near the active place, found with
/// Apple Maps search. Works anywhere Apple has listings - which in much of Asia
/// is where a traveller needs it most.
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
    private static let musollahWords = ["musolla", "musalla", "musholla", "surau", "prayer room", "prayer space", "mushola"]

    func search(around center: Coordinates) async {
        if let last = searchedAround, Geo.distanceKm(last, center) < 0.5, !spaces.isEmpty { return }
        isLoading = true
        failed = false
        defer { isLoading = false }
        let region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude),
                                        latitudinalMeters: 10_000, longitudinalMeters: 10_000)
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
        spaces = found.values.sorted { $0.distanceKm < $1.distanceKm }
        searchedAround = center
        failed = !anySucceeded && spaces.isEmpty
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
                                                     : "Apple Maps has no \(kind == .musollah ? "musollah" : "masjid") listed within 15 km. Use the Qibla tab to pray where you are."))
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
        }
    }
}
