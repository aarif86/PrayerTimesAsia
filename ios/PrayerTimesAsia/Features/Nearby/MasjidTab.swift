import MapKit
import SwiftUI

/// The Masjid tab: the nearest five places with walk or drive times, the rest
/// as pins on the map. Your masjid sits at the top. In Singapore it adds the
/// MUIS second Friday prayer list (top of the tab on Friday mornings) and,
/// in the two weeks before Hari Raya, the Raya prayer sessions.
/// Kept in step with the web app (web/src/ui/Masjid.tsx) and Android.
struct NearbyView: View {
    @Environment(AppModel.self) private var model
    @State private var search = NearbySearch()
    @State private var kind: PrayerSpace.Kind = .all
    @State private var camera: MapCameraPosition = .automatic
    @State private var selected: PrayerSpace?
    @State private var expanded: String?
    @State private var openOnly = false
    @State private var allFriday = false
    @State private var showAbout = false
    @State private var slow = false
    /// A fresh GPS fix from "Find prayer places near me". It doesn't change the
    /// place your prayer times are for.
    @State private var nearMe: Coordinates?
    @State private var locating = false
    @State private var askedAt: Date?
    @AppStorage("masjidTripMode") private var modeRaw = TripMode.walk.rawValue
    @Environment(\.openURL) private var openURL

    private var mode: TripMode { TripMode(rawValue: modeRaw) ?? .walk }
    private var use24: Bool { model.prefs.use24Hour }

    private var here: Coordinates? { nearMe ?? model.activePlace?.coordinates }
    private var hereLabel: String {
        if nearMe != nil || model.prefs.useGPS { return "you" }
        return model.activePlace?.name ?? "you"
    }
    private var country: String? {
        guard let nearMe else { return model.activePlace?.countryCode }
        return MasjidExtras.inSingapore(nearMe, countryCode: nil) ? "SG" : model.activePlace?.countryCode
    }
    private var singapore: Bool {
        guard let here else { return false }
        return MasjidExtras.inSingapore(here, countryCode: nearMe == nil ? model.activePlace?.countryCode : nil)
    }

    private static let args = ProcessInfo.processInfo.arguments

    /// Friday in Singapore until the second prayer is done (about 3 PM): the Friday card goes to the top.
    private func isFridayMorning(_ now: Date) -> Bool {
        if Self.args.contains("-friday") { return true }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Singapore")!
        let c = cal.dateComponents([.weekday, .hour], from: now)
        return c.weekday == 6 && (c.hour ?? 0) < 15
    }

    private func currentEid(_ now: Date) -> EidEvent? {
        guard singapore else { return nil }
        if Self.args.contains("-eid-sample") { return MasjidExtras.currentEid(today: "2027-03-01", events: [MasjidExtras.sampleEid]) }
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Asia/Singapore")
        f.dateFormat = "yyyy-MM-dd"
        return MasjidExtras.currentEid(today: f.string(from: now))
    }

    private func hoursNow(_ s: PrayerSpace, at now: Date) -> OpeningHours.Now? {
        guard let h = s.hours else { return nil }
        return OpeningHours.at(h, date: now, timeZone: model.activePlace?.timeZone ?? .current)
    }

    private func visible(at now: Date) -> [PrayerSpace] {
        search.spaces.filter { s in
            switch kind {
            case .all: true
            case .masjid: !s.isMusollah
            case .musollah: s.isMusollah
            }
        }
        .filter { !openOnly || hoursNow($0, at: now)?.open == true }
    }

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 300)) { context in
                let now = context.date
                let list = visible(at: now)
                VStack(spacing: 0) {
                    map(list)
                    ScrollView {
                        content(list: list, now: now)
                            .padding(.vertical, 14)
                    }
                    .background(.regularMaterial,
                                in: UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22, style: .continuous))
                }
            }
            .background(SkyNow())
            .navigationTitle("Masjid & Musollah")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { slow = false; search.refresh() } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("Refresh the masjid list")
                        .disabled(here == nil)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAbout = true } label: { Image(systemName: "info.circle") }
                        .accessibilityLabel("About this app")
                }
            }
            .sheet(isPresented: $showAbout) { MakersSheet(placement: "masjid") }
            .task(id: here) {
                guard let c = here else { return }
                slow = false
                expanded = nil
                showYou(animated: false)
                search.search(around: c, country: country)
            }
            .onChange(of: model.activePlace?.coordinates) { _, _ in nearMe = nil }
            .onChange(of: model.location.location) { _, fix in
                guard locating, let fix, let asked = askedAt, fix.timestamp >= asked.addingTimeInterval(-60) else { return }
                locating = false
                nearMe = Coordinates(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude)
            }
            .onChange(of: selected) { _, space in
                if let space { focus(space.coordinates) }
            }
        }
    }

    // MARK: Map

    @ViewBuilder
    private func map(_ list: [PrayerSpace]) -> some View {
        Map(position: $camera, selection: $selected) {
            ForEach(list) { space in
                Marker(space.name, systemImage: space.isMusollah ? "house.fill" : "moon.stars.fill",
                       coordinate: space.coordinate)
                    .tint(space.isMusollah ? Prayer.fajr.tint : Theme.accent)
                    .tag(space)
            }
            if let m = model.prefs.myMasjid, !list.contains(where: { model.isMyMasjid($0.coordinates) }) {
                Marker(m.name, systemImage: "star.fill", coordinate: CLLocationCoordinate2D(latitude: m.lat, longitude: m.lng))
                    .tint(Theme.accent)
            }
            // Rings at 1, 2 and 5 km, labelled at the bottom, so a pin reads as near or far at a glance.
            if let you = youCoordinate {
                ForEach(Self.ringsKm, id: \.self) { km in
                    MapCircle(center: you, radius: km * 1000)
                        .foregroundStyle(km == Self.ringsKm.first ? Color.blue.opacity(0.07) : .clear)
                        .stroke(Color.blue.opacity(0.55), style: StrokeStyle(lineWidth: 1.5, dash: [5, 7]))
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: you.latitude - km / 111.2, longitude: you.longitude), anchor: .center) {
                        Text(ringLabel(km))
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.blue)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(.regularMaterial, in: Capsule())
                            .overlay(Capsule().stroke(Color.blue.opacity(0.35)))
                            .accessibilityHidden(true)
                    }
                    .annotationTitles(.hidden)
                }
                // Drawn after the pins so it sits on top of them.
                Annotation(nearMe != nil ? "You are here" : "Searching from here", coordinate: you, anchor: .center) {
                    YouBeacon()
                }
                .annotationTitles(.hidden)
            }
        }
        .frame(height: 260)
        .overlay(alignment: .bottom) {
            if let s = selected { pinCard(s) }
        }
        .overlay(alignment: .topTrailing) {
            if youCoordinate != nil, selected == nil {
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
    }

    /// A tapped pin: its name, how far, opening hours, Friday, directions.
    private func pinCard(_ s: PrayerSpace) -> some View {
        let now = Date.now
        let h = hoursNow(s, at: now)
        let fri = singapore ? MasjidExtras.fridayAt(s.coordinates) : nil
        return HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(s.name).font(.subheadline.weight(.semibold)).lineLimit(2)
                Text(distanceLine(s.distanceKm)).font(.caption).foregroundStyle(.secondary)
                if let h {
                    Text(OpeningHours.text(h, use24: use24)).font(.caption)
                        .foregroundStyle(h.open ? Color.green : .secondary)
                }
                if fri != nil {
                    Text("Two Friday prayers, 2nd from \(MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24))")
                        .font(.caption).foregroundStyle(Theme.accentText)
                }
            }
            Spacer(minLength: 4)
            Button { directions(to: s.item) } label: {
                Label("Directions", systemImage: mode == .walk ? "figure.walk" : "car.fill")
                    .font(.footnote.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
            Button { selected = nil } label: {
                Image(systemName: "xmark").font(.footnote.weight(.bold)).frame(width: 30, height: 30)
            }
            .accessibilityLabel("Close")
            .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(10)
    }

    static let ringsKm: [Double] = [1, 2, 5]

    /// "1 km, 13 min" on foot, "5 km, 12 min" by car.
    private func ringLabel(_ km: Double) -> String {
        let trip = MasjidExtras.tripText(km, mode: mode)?
            .replacingOccurrences(of: " walk", with: "").replacingOccurrences(of: " drive", with: "")
        return "\(Int(km)) km" + (trip.map { ", \($0)" } ?? "")
    }

    private var youCoordinate: CLLocationCoordinate2D? {
        here.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    /// Centre on you at walking scale (about 3 km across), or about 12 km when driving.
    private func showYou(animated: Bool) {
        guard let you = youCoordinate else { return }
        let span: Double = mode == .walk ? 3_000 : 11_000
        let target = MapCameraPosition.region(MKCoordinateRegion(center: you, latitudinalMeters: span, longitudinalMeters: span))
        if animated { withAnimation { camera = target } } else { camera = target }
    }

    private func focus(_ c: Coordinates) {
        withAnimation {
            camera = .camera(MapCamera(centerCoordinate: CLLocationCoordinate2D(latitude: c.latitude, longitude: c.longitude), distance: 1500))
        }
    }

    // MARK: List

    @ViewBuilder
    private func content(list: [PrayerSpace], now: Date) -> some View {
        let eid = currentEid(now)
        let friday = isFridayMorning(now)
        LazyVStack(alignment: .leading, spacing: 12) {
            if let m = model.prefs.myMasjid, let here {
                YourMasjidCard(link: m, from: here, mode: mode, singapore: singapore, eid: eid,
                               onFocus: focus, onDirections: { directions(to: mapItem(m.name, m.coordinates)) })
            }

            nearMeButton

            if let eid, let here {
                EidCard(event: eid, from: here, spaces: search.spaces)
            }
            if friday, singapore, let here {
                FridayCard(from: here, today: true, all: $allFriday, mode: mode, onFocus: focus,
                           onDirections: { directions(to: mapItem($0.name, $0.coordinates)) })
            }

            header(list: list, now: now)

            places(list: list, now: now, eid: eid)

            if !friday, singapore, let here {
                FridayCard(from: here, today: false, all: $allFriday, mode: mode, onFocus: focus,
                           onDirections: { directions(to: mapItem($0.name, $0.coordinates)) })
            }

            if here != nil {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Places from Apple Maps and OpenStreetMap, which volunteers keep up to date. Missing one, or a pin in the wrong spot? Tell the map, no sign up needed.")
                    if let here, let url = MasjidExtras.reportURL(here) {
                        Button { openURL(url) } label: { Label("Tell the map", systemImage: "flag") }
                            .font(.footnote.weight(.semibold))
                    }
                    if model.prefs.myMasjid == nil {
                        Text("A masjid with a Prayer Times Asia screen? Scan its QR code with the Camera app to see its iqamah times on your Prayer screen.")
                            .padding(.top, 6)
                    }
                }
                .font(.footnote).foregroundStyle(.secondary)
                .padding(.horizontal)
                .padding(.top, 6)
            }
        }
    }

    private var nearMeButton: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: findNearMe) {
                HStack(spacing: 8) {
                    if locating { ProgressView().tint(.white) } else { Image(systemName: "location.viewfinder") }
                    Text(locating ? "Finding where you are…" : nearMe != nil ? "Search again from here" : "Find prayer places near me")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity, minHeight: 30)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
            .disabled(locating)
            if model.location.isDenied {
                Text("Location is turned off for this app in Settings. Showing places near \(model.activePlace?.name ?? "your saved place").")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal)
    }

    private func findNearMe() {
        if model.location.isDenied { return }
        if let fix = model.location.location, fix.timestamp.timeIntervalSinceNow > -120 {
            nearMe = Coordinates(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude)
            showYou(animated: true)
            return
        }
        locating = true
        askedAt = .now
        model.location.requestPermission()
        model.location.refresh()
        Task {
            try? await Task.sleep(for: .seconds(20))
            if locating { locating = false }
        }
    }

    @ViewBuilder
    private func header(list: [PrayerSpace], now: Date) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Nearest to \(hereLabel)").font(.title3.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 8)
                Picker("How you're going", selection: $modeRaw) {
                    Text("Walk").tag(TripMode.walk.rawValue)
                    Text("Drive").tag(TripMode.drive.rawValue)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 170)
            }
            Picker("Type", selection: $kind) {
                ForEach(PrayerSpace.Kind.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            if search.spaces.contains(where: { hoursNow($0, at: now) != nil }) {
                Toggle(isOn: $openOnly) { Label("Open now only", systemImage: "clock") }
                    .toggleStyle(.button)
                    .buttonStyle(.bordered)
                    .tint(openOnly ? Theme.accent : .secondary)
                    .font(.footnote.weight(.semibold))
            }
            if mode == .drive {
                Text("Drive times are a rough guide. Your maps app shows the traffic, so a masjid a little further away may be quicker.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal)
        .padding(.top, 6)
    }

    @ViewBuilder
    private func places(list: [PrayerSpace], now: Date, eid: EidEvent?) -> some View {
        if here == nil {
            ContentUnavailableView("Choose a place", systemImage: "location.slash",
                                   description: Text("Tap the button above, or pick a city on the Prayer tab."))
        } else if (search.isLoading || search.isAddingMore) && search.spaces.isEmpty && !slow {
            ProgressView("Searching nearby…").frame(maxWidth: .infinity).padding(.vertical, 30)
                .task {
                    // Never leave a bare spinner: after a few seconds say so and offer Try again.
                    try? await Task.sleep(for: .seconds(6))
                    slow = true
                }
        } else if list.isEmpty {
            let busy = search.isLoading || search.isAddingMore
            ContentUnavailableView {
                Label(busy ? "Still looking" : search.failed ? "Couldn't search" : openOnly ? "Nothing open right now" : "Nothing listed nearby",
                      systemImage: "moon.stars")
            } description: {
                Text(busy ? "The connection is slow. Places will appear here as soon as they arrive."
                     : search.failed ? "Searching needs an internet connection."
                     : openOnly ? "Only places with opening hours on the map count here. Turn off Open now only to see the rest."
                     : "Neither Apple Maps nor OpenStreetMap lists a \(kind == .musollah ? "musollah" : "masjid") within 15 km. Use the Qibla tab to pray where you are.")
            } actions: {
                if busy || search.failed {
                    Button("Try again") { slow = false; search.retry() }
                        .buttonStyle(.bordered)
                }
            }
        } else {
            if search.isAddingMore {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.mini)
                    Text("Looking for more surau and musollah…")
                }
                .font(.caption).foregroundStyle(.secondary)
                .padding(.horizontal)
            }
            VStack(spacing: 0) {
                ForEach(Array(list.prefix(MasjidExtras.show))) { space in
                    SpaceRow(space: space, mode: mode, singapore: singapore, eid: eid,
                             hours: hoursNow(space, at: now),
                             isOpen: expanded == space.id,
                             onTap: {
                                 withAnimation(.snappy) { expanded = expanded == space.id ? nil : space.id }
                                 focus(space.coordinates)
                             },
                             onDirections: { directions(to: space.item) },
                             onReport: { if let url = MasjidExtras.reportURL(space.coordinates) { openURL(url) } })
                    if space.id != list.prefix(MasjidExtras.show).last?.id { Divider().padding(.leading, 52) }
                }
            }
            .padding(.horizontal)
            let more = list.count - min(list.count, MasjidExtras.show)
            if more > 0 {
                Button {
                    selected = nil
                    withAnimation { camera = .automatic }
                } label: {
                    Text("\(more) more within 15 km are on the map. Tap a pin to see its name and directions.")
                        .multilineTextAlignment(.leading)
                }
                .font(.footnote).foregroundStyle(.secondary)
                .padding(.horizontal)
            }
            if model.prefs.myMasjid == nil {
                Text("Tap a place and choose Make it my masjid to keep it at the top.")
                    .font(.footnote).foregroundStyle(.secondary)
                    .padding(.horizontal)
            }
        }
    }

    // MARK: Helpers

    private func distanceLine(_ km: Double) -> String {
        let trip = MasjidExtras.tripText(km, mode: mode)
        return "\(MasjidExtras.distanceText(km)) away" + (trip.map { ", \($0)" } ?? "")
    }

    private func mapItem(_ name: String, _ c: Coordinates) -> MKMapItem {
        let item = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: c.latitude, longitude: c.longitude)))
        item.name = name
        return item
    }

    private func directions(to item: MKMapItem) {
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey:
            mode == .walk ? MKLaunchOptionsDirectionsModeWalking : MKLaunchOptionsDirectionsModeDriving])
    }
}

// MARK: - One place

private struct SpaceRow: View {
    @Environment(AppModel.self) private var model
    let space: PrayerSpace
    let mode: TripMode
    let singapore: Bool
    let eid: EidEvent?
    let hours: OpeningHours.Now?
    let isOpen: Bool
    let onTap: () -> Void
    let onDirections: () -> Void
    let onReport: () -> Void

    var body: some View {
        let use24 = model.prefs.use24Hour
        let fri = singapore ? MasjidExtras.fridayAt(space.coordinates) : nil
        let raya = eid.flatMap { MasjidExtras.eidAt($0, name: space.name, coordinates: space.coordinates) }
        let mine = model.isMyMasjid(space.coordinates)
        let trip = MasjidExtras.tripText(space.distanceKm, mode: mode)
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onTap) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: space.isMusollah ? "house.fill" : "moon.stars.fill")
                        .foregroundStyle(space.isMusollah ? Prayer.fajr.tint : Theme.accent)
                        .frame(width: 28)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 4) {
                            if mine { Image(systemName: "star.fill").font(.caption).foregroundStyle(Theme.accentText) }
                            Text(space.name).font(.body.weight(.semibold)).foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                        }
                        if !space.address.isEmpty {
                            Text(space.address).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                        if fri != nil || hours != nil {
                            HStack(spacing: 6) {
                                if fri != nil { chip("2 Friday prayers", color: Theme.accentText) }
                                if let hours { chip(hours.open ? "Open now" : "Closed now", color: hours.open ? .green : .secondary) }
                            }
                        }
                    }
                    Spacer(minLength: 6)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(MasjidExtras.distanceText(space.distanceKm))
                            .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                        if let trip { Text(trip).font(.caption).foregroundStyle(.secondary) }
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(isOpen ? "Hides the details" : "Shows facilities, directions and more")

            if isOpen {
                VStack(alignment: .leading, spacing: 8) {
                    facilities
                    if let hours {
                        Label(OpeningHours.text(hours, use24: use24), systemImage: "clock").font(.footnote)
                    }
                    if let fri {
                        Text("Second Friday prayer from \(MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24))\(fri.womenSession2 ? ", with space for women" : "").")
                            .font(.footnote).foregroundStyle(Theme.accentText)
                    }
                    if let raya, let eid {
                        Text("\(eid.shortName) prayer at \(raya.sessions.map { MasjidExtras.clock($0.time, use24: use24) }.joined(separator: ", ")).")
                            .font(.footnote).foregroundStyle(Theme.accentText)
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            Button(action: onDirections) {
                                Label("Directions", systemImage: mode == .walk ? "figure.walk" : "car.fill")
                            }
                            .buttonStyle(.borderedProminent).tint(Theme.accent)
                            if mine {
                                Label(space.isMusollah ? "Kept at the top" : "Your masjid", systemImage: "star.fill")
                                    .foregroundStyle(Theme.accentText)
                                    .padding(.horizontal, 8)
                            } else {
                                Button { model.chooseMasjid(name: space.name, coordinates: space.coordinates) } label: {
                                    Label(space.isMusollah ? "Keep it at the top" : "Make it my masjid", systemImage: "star")
                                }
                                .buttonStyle(.bordered).tint(Theme.accent)
                            }
                            Button(action: onReport) { Label("Report a problem", systemImage: "flag") }
                                .buttonStyle(.bordered).tint(.secondary)
                        }
                        .font(.footnote.weight(.semibold))
                    }
                }
                .padding(.leading, 40)
                .transition(.opacity)
            }
        }
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private var facilities: some View {
        let have = MasjidExtras.facilityLabels.filter { space.facilities.contains($0.0) }
        if have.isEmpty {
            Text("The map doesn't list this place's facilities yet.").font(.footnote).foregroundStyle(.secondary)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(have.indices, id: \.self) { i in
                        Label(have[i].1, systemImage: have[i].2)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .background(Color.primary.opacity(0.07), in: Capsule())
                    }
                }
            }
        }
    }

    private func chip(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(color.opacity(0.12), in: Capsule())
    }
}

// MARK: - Your masjid

/// "Subuh +15 min, Zohor 1:15 PM", one line.
@MainActor func iqamahLine(_ m: MasjidLink, model: AppModel) -> String? {
    let use24 = model.prefs.use24Hour
    var parts = Prayer.obligatory.compactMap { p -> String? in
        guard let r = m.jamaah[p.rawValue] else { return nil }
        return "\(p.name(model.naming)) \(r.fixed.map { MasjidExtras.clock($0, use24: use24) } ?? "+\(r.after ?? 0) min")"
    }
    if let j = m.jumuah { parts.append("Jumaat \(MasjidExtras.clock(j, use24: use24))") }
    return parts.isEmpty ? nil : parts.joined(separator: ", ")
}

private struct YourMasjidCard: View {
    @Environment(AppModel.self) private var model
    let link: MasjidLink
    let from: Coordinates
    let mode: TripMode
    let singapore: Bool
    let eid: EidEvent?
    let onFocus: (Coordinates) -> Void
    let onDirections: () -> Void

    var body: some View {
        let use24 = model.prefs.use24Hour
        let c = link.coordinates
        let km = Geo.distanceKm(from, c)
        let trip = MasjidExtras.tripText(km, mode: mode)
        let fri = singapore ? MasjidExtras.fridayAt(c) : nil
        let raya = eid.flatMap { MasjidExtras.eidAt($0, name: link.name, coordinates: c) }
        VStack(alignment: .leading, spacing: 8) {
            Button { onFocus(c) } label: {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "star.fill").foregroundStyle(Theme.accentText).frame(width: 24).padding(.top, 2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("YOUR MASJID").font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                        Text(link.name).font(.body.weight(.semibold)).foregroundStyle(.primary).multilineTextAlignment(.leading)
                        Text("\(MasjidExtras.distanceText(km)) away\(trip.map { ", \($0)" } ?? "")")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Group {
                if let iq = iqamahLine(link, model: model) {
                    Text("Iqamah \(iq)")
                } else {
                    Text("Iqamah times show here when your masjid puts up a Prayer Times Asia screen. Scan its QR code once.")
                        .foregroundStyle(.secondary)
                }
                if let fri {
                    Text("Second Friday prayer from \(MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24))\(fri.womenSession2 ? ", with space for women" : "").")
                        .foregroundStyle(Theme.accentText)
                }
                if let raya, let eid {
                    Text("\(eid.shortName) prayer at \(raya.sessions.map { MasjidExtras.clock($0.time, use24: use24) }.joined(separator: ", ")).")
                        .foregroundStyle(Theme.accentText)
                } else if let e = link.eid {
                    Text("Hari Raya prayer at \(MasjidExtras.clock(e, use24: use24)).").foregroundStyle(Theme.accentText)
                }
            }
            .font(.footnote)
            .padding(.leading, 36)
            HStack(spacing: 8) {
                Button(action: onDirections) {
                    Label("Directions", systemImage: mode == .walk ? "figure.walk" : "car.fill")
                }
                .buttonStyle(.borderedProminent).tint(Theme.accent)
                Button("Remove") { model.forgetMasjid() }
                    .buttonStyle(.bordered).tint(.secondary)
            }
            .font(.footnote.weight(.semibold))
            .padding(.leading, 36)
        }
        .padding(14)
        .background(Theme.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.accent.opacity(0.25)))
        .padding(.horizontal)
    }
}

// MARK: - Singapore Friday and Hari Raya

private struct FridayCard: View {
    @Environment(AppModel.self) private var model
    let from: Coordinates
    let today: Bool
    @Binding var all: Bool
    let mode: TripMode
    let onFocus: (Coordinates) -> Void
    let onDirections: (FridayMosque) -> Void
    @Environment(\.openURL) private var openURL

    private var updated: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: MasjidExtras.fridaySourceUpdated) else { return MasjidExtras.fridaySourceUpdated }
        f.dateFormat = "d MMM yyyy"
        return f.string(from: d)
    }

    var body: some View {
        let use24 = model.prefs.use24Hour
        let list = MasjidExtras.fridayNearest(from)
        let shown = all ? list : Array(list.prefix(3))
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "calendar").foregroundStyle(Theme.accentText).frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(today ? "Friday prayer today" : "Friday prayer in Singapore").font(.headline)
                    Text("\(list.count) masjids hold a second Friday prayer from \(MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24)), for those who can't make the first one at Zohor.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            VStack(spacing: 0) {
                ForEach(shown.indices, id: \.self) { i in
                    let row = shown[i]
                    HStack(spacing: 10) {
                        Button { onFocus(row.mosque.coordinates) } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: "moon.stars.fill").foregroundStyle(Theme.accent).frame(width: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(row.mosque.name).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                                        .multilineTextAlignment(.leading)
                                    Text(row.mosque.district + (row.mosque.womenSession2 ? ". Space for women in the 2nd prayer" : ""))
                                        .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                                }
                                Spacer(minLength: 4)
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(MasjidExtras.distanceText(row.km)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                                    if let trip = MasjidExtras.tripText(row.km, mode: mode) {
                                        Text(trip).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Button { onDirections(row.mosque) } label: {
                            Image(systemName: mode == .walk ? "figure.walk" : "car.fill")
                                .frame(width: 36, height: 36)
                                .background(Theme.accent.opacity(0.15), in: Circle())
                        }
                        .accessibilityLabel("Directions to \(row.mosque.name)")
                        .foregroundStyle(Theme.accentText)
                    }
                    .padding(.vertical, 8)
                }
            }
            Button { withAnimation(.snappy) { all.toggle() } } label: {
                Label(all ? "Show the nearest 3" : "See all \(list.count)", systemImage: all ? "chevron.up" : "chevron.down")
                    .font(.footnote.weight(.semibold))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("From the Islamic Religious Council of Singapore (MUIS), updated \(updated). No booking needed, except on public holidays.")
                if let url = URL(string: MasjidExtras.fridaySourceURL) {
                    Button("See the MUIS list") { openURL(url) }.font(.caption.weight(.semibold))
                }
            }
            .font(.caption).foregroundStyle(.secondary)
        }
        .padding(14)
        .background(Theme.accent.opacity(today ? 0.12 : 0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.accent.opacity(today ? 0.3 : 0.15)))
        .padding(.horizontal)
    }
}

private struct EidCard: View {
    @Environment(AppModel.self) private var model
    let event: EidEvent
    let from: Coordinates
    let spaces: [PrayerSpace]
    @State private var all = false
    @Environment(\.openURL) private var openURL

    private struct Row: Identifiable {
        let mosque: EidMosque
        let km: Double?
        var id: String { mosque.name }
    }

    var body: some View {
        let use24 = model.prefs.use24Hour
        // Place each listed masjid on the map list (by spot or name) to know how far it is.
        let rows = event.mosques.map { m -> Row in
            if let lat = m.lat, let lng = m.lng { return Row(mosque: m, km: Geo.distanceKm(from, Coordinates(latitude: lat, longitude: lng))) }
            let one = EidEvent(name: event.name, date: event.date, sourceURL: event.sourceURL, mosques: [m])
            let match = spaces.first { MasjidExtras.eidAt(one, name: $0.name, coordinates: $0.coordinates) != nil }
            return Row(mosque: m, km: match.map { Geo.distanceKm(from, $0.coordinates) })
        }
        .sorted { ($0.km ?? 1e9) < ($1.km ?? 1e9) }
        let shown = all ? rows : Array(rows.prefix(3))
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "moon.stars.fill").foregroundStyle(Theme.accentText).frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(event.shortName) prayer").font(.headline)
                    Text("\(dateText). Prayer times at the masjids nearest you.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            ForEach(shown) { row in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "moon.stars.fill").foregroundStyle(Theme.accent).frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.mosque.name).font(.subheadline.weight(.semibold))
                        Text(row.mosque.sessions.map { s in
                            MasjidExtras.clock(s.time, use24: use24) + (s.khutbah.map { " (\($0))" } ?? "")
                        }.joined(separator: ", "))
                        .font(.caption).foregroundStyle(.secondary)
                        let extra = [row.mosque.sessions.contains { $0.women } ? "Space for women" : nil, row.mosque.note].compactMap { $0 }
                        if !extra.isEmpty {
                            Text(extra.joined(separator: ". ")).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer(minLength: 4)
                    if let km = row.km {
                        Text(MasjidExtras.distanceText(km)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            if rows.count > 3 {
                Button { withAnimation(.snappy) { all.toggle() } } label: {
                    Label(all ? "Show the nearest 3" : "See all \(rows.count)", systemImage: all ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("From the Islamic Religious Council of Singapore (MUIS).")
                if let url = URL(string: event.sourceURL) {
                    Button("See the MUIS list") { openURL(url) }.font(.caption.weight(.semibold))
                }
            }
            .font(.caption).foregroundStyle(.secondary)
        }
        .padding(14)
        .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.accent.opacity(0.3)))
        .padding(.horizontal)
    }

    private var dateText: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: event.date) else { return event.date }
        f.dateFormat = "EEEE d MMMM"
        return f.string(from: d)
    }
}

/// Where you are: a blue dot with soft waves beaming out from it.
private struct YouBeacon: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var beaming = false

    var body: some View {
        ZStack {
            ForEach(0..<2) { i in
                Circle()
                    .fill(RadialGradient(colors: [.blue.opacity(0.45), .blue.opacity(0.15), .clear],
                                         center: .center, startRadius: 0, endRadius: 9))
                    .frame(width: 18, height: 18)
                    .scaleEffect(reduceMotion ? 2.6 : (beaming ? 9 : 1))
                    .opacity(reduceMotion ? (i == 0 ? 0.5 : 0) : (beaming ? 0 : 0.9))
                    .animation(reduceMotion ? nil : .easeOut(duration: 2.6).repeatForever(autoreverses: false).delay(Double(i) * 1.3),
                               value: beaming)
            }
            Circle().fill(.blue).frame(width: 18, height: 18)
                .overlay(Circle().stroke(.white, lineWidth: 3))
                .shadow(color: .blue.opacity(0.4), radius: 4)
        }
        .frame(width: 170, height: 170)
        .allowsHitTesting(false)
        .onAppear { beaming = true }
    }
}
