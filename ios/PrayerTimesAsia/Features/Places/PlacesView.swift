import MapKit
import SwiftUI

/// City search for planning a trip or when GPS is off. Uses Apple's on-device
/// MapKit search, so no third-party service ever sees what you look up.
@MainActor
@Observable
final class PlaceSearch: NSObject, MKLocalSearchCompleterDelegate {
    var query = ""
    private(set) var results: [MKLocalSearchCompletion] = []
    @ObservationIgnored private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
    }

    func update() {
        if query.isEmpty { results = [] } else { completer.queryFragment = query }
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let found = completer.results
        Task { @MainActor in self.results = found }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in self.results = [] }
    }

    func resolve(_ completion: MKLocalSearchCompletion) async -> Place? {
        let search = MKLocalSearch(request: MKLocalSearch.Request(completion: completion))
        guard let item = try? await search.start().mapItems.first else { return nil }
        let mark = item.placemark
        let code = mark.isoCountryCode
        let tz = item.timeZone
            ?? AsiaRegions.timeZoneID(forCountry: code).flatMap(TimeZone.init(identifier:))
            ?? .current
        return Place(
            name: completion.title.components(separatedBy: ",").first ?? completion.title,
            region: mark.administrativeArea,
            countryCode: code,
            countryName: AsiaRegions.profile(for: code)?.name ?? mark.country,
            timeZoneID: tz.identifier,
            coordinates: Coordinates(latitude: mark.coordinate.latitude, longitude: mark.coordinate.longitude),
            district: mark.subAdministrativeArea)
    }
}

struct PlacesView: View {
    /// What the picked place is for: where to show times, or where home is.
    enum Purpose { case location, home }
    var purpose: Purpose = .location

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var search = PlaceSearch()
    @State private var resolving = false

    var body: some View {
        @Bindable var search = search
        NavigationStack {
            List {
                if search.query.isEmpty, purpose == .home {
                    homeSuggestions
                } else if search.query.isEmpty {
                    Section {
                        Button {
                            model.useGPS()
                            dismiss()
                        } label: {
                            Label {
                                VStack(alignment: .leading) {
                                    Text("Current location")
                                    if let gps = model.gpsPlace { Text(gps.name).font(.caption).foregroundStyle(.secondary) }
                                }
                            } icon: { Image(systemName: "location.fill") }
                        }
                        .badge(model.prefs.useGPS ? Text("On") : nil)
                    }
                    if !model.prefs.savedPlaces.isEmpty {
                        Section("Saved places") {
                            ForEach(model.prefs.savedPlaces) { place in
                                Button { pick(place) } label: { placeRow(place) }
                            }
                            .onDelete { model.prefs.savedPlaces.remove(atOffsets: $0) }
                        }
                    }
                    Section {
                        Text("Search any city, like Hanoi, Istanbul, London or Toronto. Times are calculated on your phone, so they keep working offline.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                } else {
                    ForEach(search.results, id: \.self) { completion in
                        Button {
                            Task {
                                resolving = true
                                if let place = await search.resolve(completion) { pick(place) }
                                resolving = false
                            }
                        } label: {
                            VStack(alignment: .leading) {
                                Text(completion.title)
                                if !completion.subtitle.isEmpty {
                                    Text(completion.subtitle).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .tint(.primary)
            .overlay { if resolving { ProgressView() } }
            .searchable(text: $search.query, placement: .navigationBarDrawer(displayMode: .always), prompt: "City or place")
            .onChange(of: search.query) { search.update() }
            .navigationTitle(purpose == .home ? "Where is home?" : "Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }

    private func placeRow(_ place: Place) -> some View {
        HStack {
            Text(place.isInAsia ? place.profile.flag : "🌏")
            VStack(alignment: .leading) {
                Text(place.name)
                if !place.subtitle.isEmpty { Text(place.subtitle).font(.caption).foregroundStyle(.secondary) }
            }
            Spacer()
            let picked = purpose == .home
                ? model.prefs.home?.isNear(place) == true
                : (!model.prefs.useGPS && model.prefs.manualPlace?.isNear(place) == true)
            if picked {
                Image(systemName: "checkmark").foregroundStyle(.tint)
            }
        }
    }

    /// For home: where you are now, your saved places, and a note on why it matters.
    @ViewBuilder
    private var homeSuggestions: some View {
        if let here = model.gpsPlace ?? model.activePlace {
            Section {
                Button { pick(here) } label: {
                    Label {
                        VStack(alignment: .leading) {
                            Text("Where I am now")
                            Text(here.name + (here.countryName.map { ", \($0)" } ?? "")).font(.caption).foregroundStyle(.secondary)
                        }
                    } icon: { Image(systemName: "location.fill") }
                }
            }
        }
        let saved = model.prefs.savedPlaces.filter { $0.name != "Current location" }
        if !saved.isEmpty {
            Section("Saved places") {
                ForEach(saved) { place in
                    Button { pick(place) } label: { placeRow(place) }
                }
            }
        }
        Section {
            Text("Search the town or area where you live, like Tampines, Shah Alam or Bandung. Home is used to work out when you count as a traveller.")
                .font(.footnote).foregroundStyle(.secondary)
        }
    }

    private func pick(_ place: Place) {
        switch purpose {
        case .location: model.choose(manual: place)
        case .home: model.setHome(place)
        }
        dismiss()
    }
}
