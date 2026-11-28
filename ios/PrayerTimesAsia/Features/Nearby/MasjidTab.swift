import MapKit
import SwiftUI

/// The Masjid tab: the nearest five places with walk or drive times, the rest
/// as pins on the map. Your masjid sits at the top. In Singapore it adds the
/// MUIS second Friday prayer list (top of the tab on Friday mornings) and,
/// in the two weeks before Hari Raya, the Raya prayer sessions.
/// Kept in step with the web app (web/src/ui/Masjid.tsx) and Android.
struct NearbyView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.look) private var look
    private var p: LookPalette { look.palette }
    @State private var search = NearbySearch()
    @State private var kind: PrayerSpace.Kind = .all
    @State private var camera: MapCameraPosition = .automatic
    @State private var rings: [Double] = [0.5, 1, 2]
    @State private var labelCamera = LabelCamera()
    @Environment(\.colorScheme) private var scheme
    @State private var selected: PrayerSpace?
    @State private var expanded: String?
    @State private var openOnly = false
    @State private var allFriday = false
    @State private var showAbout = false
    /// Where the bottom panel rests: small (just the search button), half (map and list share the screen, the start), or large.
    @AppStorage("masjidSheetStop") private var stopRaw = SheetStop.half.rawValue
    @GestureState private var drag: CGFloat = 0
    @State private var suggesting = false
    /// When Near me last found the person, so Suggest a prayer room only offers a recent spot as the room's pin.
    @State private var nearMeAt: Date?
    @State private var slow = false
    /// A fresh GPS fix from "Find prayer places near me". It doesn't change the
    /// place your prayer times are for.
    @State private var nearMe: Coordinates?
    @State private var locating = false
    @State private var askedAt: Date?
    @AppStorage("masjidTripMode") private var modeRaw = TripMode.walk.rawValue
    @Environment(\.openURL) private var openURL

    private var stop: SheetStop { SheetStop(rawValue: stopRaw) ?? .half }
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
                GeometryReader { geo in
                    let total = geo.size.height
                    let committed = sheetHeight(stop, total: total)
                    let live = min(max(committed - drag, sheetHeight(.small, total: total)), sheetHeight(.large, total: total))
                    ZStack(alignment: .bottom) {
                        VStack(spacing: 0) {
                            map(list).frame(height: max(total - committed + overlap, 140))
                            Spacer(minLength: 0)
                        }
                        .animation(.snappy, value: stopRaw)
                        sheet(list: list, now: now, height: live, total: total)
                    }
                }
            }
            .background(SkyNow())
            .navigationTitle(W("masjid.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { slow = false; search.refresh() } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel(W("masjid.refresh"))
                        .disabled(here == nil)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAbout = true } label: { Image(systemName: "info.circle") }
                        .accessibilityLabel(W("masjid.about"))
                }
            }
            .sheet(isPresented: $showAbout) { MakersSheet(placement: "masjid") }
            .sheet(isPresented: $suggesting) {
                SuggestRoomView(near: here, live: (nearMeAt.map { Date.now.timeIntervalSince($0) < 300 } ?? false) ? nearMe : nil)
            }
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
                nearMe = Coordinates(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude); nearMeAt = .now
            }
            .onChange(of: selected) { _, space in
                if let space { focus(space.coordinates) }
            }
        }
    }

    // MARK: Sheet

    private enum SheetStop: Int, CaseIterable { case small, half, large }

    private func sheetHeight(_ stop: SheetStop, total: CGFloat) -> CGFloat {
        switch stop {
        case .small: return min(200, total * 0.3)
        case .half: return total * 0.5 + overlap
        case .large: return total * 0.88
        }
    }

    /// The bottom panel. Drag the handle area up or down (or tap it) to give the map or the list more room.
    private func sheet(list: [PrayerSpace], now: Date, height: CGFloat, total: CGFloat) -> some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                LookStrip(look: look, p: p)
                if look == .bands {
                    Capsule().fill(p.tx3.opacity(0.5)).frame(width: 38, height: 5).padding(.top, 6)
                }
            }
                .padding(.bottom, 6)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .top)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 4)
                        .updating($drag) { v, state, _ in state = v.translation.height }
                        .onEnded { v in
                            let target = sheetHeight(stop, total: total) - v.predictedEndTranslation.height
                            let best = SheetStop.allCases.min { abs(sheetHeight($0, total: total) - target) < abs(sheetHeight($1, total: total) - target) } ?? .half
                            withAnimation(.snappy) { stopRaw = best.rawValue }
                            if best == .large { selected = nil }
                        }
                )
                .onTapGesture { withAnimation(.snappy) { stopRaw = (stop == .large ? SheetStop.half : SheetStop(rawValue: stop.rawValue + 1)!).rawValue } }
                .accessibilityElement()
                .accessibilityLabel(W("masjid.listSize"))
                .accessibilityAddTraits(.isButton)
                .accessibilityAdjustableAction { dir in
                    let next = dir == .increment ? stop.rawValue + 1 : stop.rawValue - 1
                    if let s = SheetStop(rawValue: next) { withAnimation(.snappy) { stopRaw = s.rawValue } }
                }
            ScrollView {
                content(list: list, now: now)
                    .padding(.bottom, 14)
            }
            .id("\(modeRaw)-\(kind)-\(openOnly)")
        }
        .frame(height: height, alignment: .top)
        .background(sheetBackground)
    }

    /// How far the list sheet rides up over the map (none in Colour Bands, which is flat).
    private var overlap: CGFloat { look == .bands ? 0 : 24 }

    private var sheetShape: UnevenRoundedRectangle {
        let r: CGFloat = look == .bands ? 0 : 28
        return UnevenRoundedRectangle(topLeadingRadius: r, bottomLeadingRadius: 0, bottomTrailingRadius: 0,
                                      topTrailingRadius: r, style: .continuous)
    }

    @ViewBuilder
    private var sheetBackground: some View {
        switch look {
        case .bands:
            Color.dyn(0xF2F0EB, 0x232326)
        case .gold:
            sheetShape.fill(Color.dyn(0xFBFAF7, 0x0F1338))
        default:
            sheetShape.fill(.regularMaterial)
        }
    }

    // MARK: Map

    @ViewBuilder
    private func map(_ list: [PrayerSpace]) -> some View {
        MapReader { proxy in
        Map(position: $camera, selection: $selected) {
            ForEach(list) { space in
                Marker(space.name, systemImage: space.isMusollah ? "house.fill" : "moon.stars.fill",
                       coordinate: space.coordinate)
                    .tint(space.isMusollah ? Prayer.fajr.tint : p.ac)
                    .tag(space)
            }
            if let m = model.prefs.myMasjid, !list.contains(where: { model.isMyMasjid($0.coordinates) }) {
                Marker(m.name, systemImage: "star.fill", coordinate: CLLocationCoordinate2D(latitude: m.lat, longitude: m.lng))
                    .tint(p.ac)
            }
            // Three rings in 1 2 5 steps that follow the zoom (500 m, 1 and 2 km on foot, 1, 2 and 5 km by car).
            // Their labels are drawn over the map below, so pins never hide them.
            if let you = youCoordinate {
                ForEach(rings, id: \.self) { km in
                    MapCircle(center: you, radius: km * 1000)
                        .foregroundStyle(km == rings.first ? RingStyle.fill(scheme) : .clear)
                        .stroke(RingStyle.line(scheme), style: StrokeStyle(lineWidth: 1.5, dash: [5, 7]))
                }
                // Drawn after the pins so it sits on top of them.
                Annotation(nearMe != nil ? W("phone.masjid.youAreHere") : W("phone.masjid.searchingFrom"), coordinate: you, anchor: .center) {
                    YouBeacon()
                }
                .annotationTitles(.hidden)
            }
        }
        .onMapCameraChange(frequency: .continuous) { ctx in labelCamera.region = ctx.region }
        .onMapCameraChange(frequency: .onEnd) { ctx in
            let r = ctx.region
            let halfH = r.span.latitudeDelta * 111.2 / 2
            let halfW = r.span.longitudeDelta * 111.2 * cos(r.center.latitude * .pi / 180) / 2
            let next = MasjidExtras.rings(halfWidthKm: halfW, halfHeightKm: halfH)
            if next != rings { rings = next }
        }
        .overlay {
            if let you = youCoordinate {
                RingLabels(proxy: proxy, you: you, rings: rings, mode: mode, camera: labelCamera)
            }
        }
        }
        .overlay(alignment: .bottom) {
            if let s = selected { pinCard(s).padding(.bottom, overlap) }
        }
        .overlay(alignment: .topTrailing) {
            if youCoordinate != nil, selected == nil {
                Button { selected = nil; showYou(animated: true) } label: {
                    Image(systemName: "location.fill")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                        .background(.regularMaterial, in: Circle())
                }
                .accessibilityLabel(W("phone.showWhereIAm"))
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
                Text(distanceLine(s.distanceKm)).font(.caption).foregroundStyle(p.tx2)
                if let h {
                    Text(OpeningHours.text(h, use24: use24)).font(.caption)
                        .foregroundStyle(h.open ? Color.green : .secondary)
                }
                if fri != nil {
                    Text(W("masjid.twoFriday", ["time": MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24)]))
                        .font(.caption).foregroundStyle(p.actx)
                }
            }
            Spacer(minLength: 4)
            Button { directions(to: s.item) } label: {
                Label(W("phone.directions"), systemImage: mode == .walk ? "figure.walk" : "car.fill")
                    .font(.footnote.weight(.semibold))
            }
            .buttonStyle(LookProminent(p))
            Button { selected = nil } label: {
                Image(systemName: "xmark").font(.footnote.weight(.bold)).frame(width: 30, height: 30)
            }
            .accessibilityLabel(W("common.close"))
            .foregroundStyle(p.tx2)
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(10)
    }

    private var youCoordinate: CLLocationCoordinate2D? {
        here.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    /// Centre on you at walking scale (about 3 km across), or about 12 km when driving.
    private func showYou(animated: Bool) {
        guard let you = youCoordinate else { return }
        let span: Double = mode == .walk ? 3_000 : 11_000
        rings = mode == .walk ? [0.5, 1, 2] : [1, 2, 5] // until the map reports its real size
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
        VStack(alignment: .leading, spacing: 12) {
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
                    Text(W("phone.masjid.placesFrom"))
                    if let here, let url = MasjidExtras.reportURL(here) {
                        Button { openURL(url) } label: { Label(W("masjid.tellMap"), systemImage: "flag") }
                            .font(.footnote.weight(.semibold))
                    }
                    Button { suggesting = true } label: { Label(W("suggestRoom.button"), systemImage: "plus.circle") }
                        .font(.footnote.weight(.semibold))
                    if model.prefs.myMasjid == nil {
                        Text(W("phone.masjid.scanQr"))
                            .padding(.top, 6)
                    }
                }
                .font(.footnote).foregroundStyle(p.tx2)
                .padding(.horizontal)
                .padding(.top, 6)
            }
        }
    }

    private var nearMeButton: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: findNearMe) {
                HStack(spacing: 8) {
                    if locating { ProgressView().tint(p.actx) } else { Image(systemName: "location.viewfinder") }
                    Text(locating ? W("today.finding") : nearMe != nil ? W("masjid.searchAgain") : W("masjid.findNear"))
                        .lookFont(look == .simple ? 19 : 16, .semibold)
                }
                .foregroundStyle(p.actx)
                .frame(maxWidth: .infinity, minHeight: look == .simple ? 56 : 48)
                .background(look == .bands ? p.card : p.tint,
                            in: RoundedRectangle(cornerRadius: look == .bands ? 0 : p.radius + 8, style: .continuous))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(locating)
            if model.location.isDenied {
                Text(W("phone.masjid.locationOff", ["place": model.activePlace?.name ?? "your saved place"]))
                    .font(.footnote).foregroundStyle(p.tx2)
            }
        }
        .padding(.horizontal)
    }

    private func findNearMe() {
        if model.location.isDenied { return }
        if let fix = model.location.location, fix.timestamp.timeIntervalSinceNow > -120 {
            nearMe = Coordinates(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude); nearMeAt = .now
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
                Text(W("masjid.nearestTo", ["place": hereLabel])).font(Theme.display(look == .simple ? 26 : 22, .bold))
                    .foregroundStyle(p.tx).lineLimit(2)
                Spacer(minLength: 0)
            }
            LookSegmented(p: p, label: W("masjid.howGoing"),
                          options: [(W("masjid.walk"), TripMode.walk.rawValue), (W("masjid.drive"), TripMode.drive.rawValue)],
                          selection: $modeRaw)
            LookSegmented(p: p, label: W("phone.masjid.type"),
                          options: PrayerSpace.Kind.allCases.map { ($0.title, $0) },
                          selection: $kind)
            if search.spaces.contains(where: { hoursNow($0, at: now) != nil }) {
                Toggle(isOn: $openOnly) { Label(W("masjid.openOnly"), systemImage: "clock") }
                    .toggleStyle(.button)
                    .buttonStyle(.bordered)
                    .tint(openOnly ? p.actx : p.tx2)
                    .font(.footnote.weight(.semibold))
            }
            if mode == .drive {
                Text(W("masjid.driveNote"))
                    .font(.footnote).foregroundStyle(p.tx2)
            }
        }
        .padding(.horizontal)
        .padding(.top, 6)
    }

    @ViewBuilder
    private func places(list: [PrayerSpace], now: Date, eid: EidEvent?) -> some View {
        if here == nil {
            ContentUnavailableView(W("masjid.choosePlace"), systemImage: "location.slash",
                                   description: Text(W("masjid.choosePlaceBody")))
        } else if (search.isLoading || search.isAddingMore) && search.spaces.isEmpty && !slow {
            ProgressView(W("masjid.searching")).frame(maxWidth: .infinity).padding(.vertical, 30)
                .task {
                    // Never leave a bare spinner: after a few seconds say so and offer Try again.
                    try? await Task.sleep(for: .seconds(6))
                    slow = true
                }
        } else if list.isEmpty {
            let busy = search.isLoading || search.isAddingMore
            ContentUnavailableView {
                Label(busy ? W("phone.masjid.stillLooking") : search.failed ? W("masjid.failed") : openOnly ? W("masjid.nothingOpen") : W("masjid.nothing"),
                      systemImage: "moon.stars")
            } description: {
                Text(busy ? W("phone.masjid.slow")
                     : search.failed ? W("phone.masjid.needInternet")
                     : openOnly ? W("masjid.nothingOpenBody")
                     : W("phone.masjid.noneWithin", ["name": kind == .musollah ? W("masjid.musollah").lowercased() : W("masjid.masjid").lowercased()]))
            } actions: {
                if busy || search.failed {
                    Button(W("common.tryAgain")) { slow = false; search.retry() }
                        .buttonStyle(.bordered)
                }
            }
        } else {
            if search.isAddingMore {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.mini)
                    Text(W("phone.lookingMore"))
                }
                .font(.caption).foregroundStyle(p.tx2)
                .padding(.horizontal)
            }
            placesList(list: list, now: now, eid: eid)
            let more = list.count - min(list.count, MasjidExtras.show)
            if more > 0 {
                Button {
                    selected = nil
                    withAnimation { camera = .automatic }
                } label: {
                    Text(W("masjid.moreOnMap", ["n": more]))
                        .multilineTextAlignment(.leading)
                }
                .font(.footnote).foregroundStyle(p.tx2)
                .padding(.horizontal)
            }
            if model.prefs.myMasjid == nil {
                Text(W("masjid.keepHint"))
                    .font(.footnote).foregroundStyle(p.tx2)
                    .padding(.horizontal)
            }
        }
    }

    /// The rows: in the look's card, or edge to edge bands of colour in Colour Bands.
    @ViewBuilder
    private func placesList(list: [PrayerSpace], now: Date, eid: EidEvent?) -> some View {
        let shown = Array(list.prefix(MasjidExtras.show))
        if look == .bands {
            VStack(spacing: 0) {
                ForEach(shown.indices, id: \.self) { i in
                    spaceRow(shown[i], index: i, now: now, eid: eid)
                }
            }
        } else {
            VStack(spacing: 0) {
                ForEach(shown.indices, id: \.self) { i in
                    spaceRow(shown[i], index: i, now: now, eid: eid)
                    if i < shown.count - 1 { Rectangle().fill(p.sep).frame(height: 1) }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: p.radius, style: .continuous))
            .lookCard(padding: 0)
            .padding(.horizontal)
        }
    }

    private func spaceRow(_ space: PrayerSpace, index: Int, now: Date, eid: EidEvent?) -> some View {
        SpaceRow(space: space, index: index, mode: mode, singapore: singapore, eid: eid,
                 hours: hoursNow(space, at: now),
                 isOpen: expanded == space.id,
                 onTap: {
                     withAnimation(.snappy) { expanded = expanded == space.id ? nil : space.id }
                     focus(space.coordinates)
                 },
                 onDirections: { directions(to: space.item) },
                 onReport: { if let url = MasjidExtras.reportURL(space.coordinates) { openURL(url) } })
    }

    // MARK: Helpers

    private func distanceLine(_ km: Double) -> String {
        let trip = MasjidExtras.tripText(km, mode: mode)
        return W("phone.masjid.away", ["distance": MasjidExtras.distanceText(km), "extra": trip.map { ", \($0)" } ?? ""])
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
    @Environment(\.look) private var look
    /// The look's colours. In Colour Bands the row is a solid band, so words and icons go white.
    private var p: LookPalette {
        var q = look.palette
        if look == .bands {
            q.tx = .white; q.tx2 = .white; q.actx = .white; q.ac = .white
            q.btn = Color.black.opacity(0.3); q.onBtn = .white; q.sep = Color.white.opacity(0.22)
        }
        return q
    }
    let space: PrayerSpace
    let index: Int
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
                HStack(alignment: .top, spacing: 14) {
                    if look != .bands { iconTile }
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 4) {
                            if mine { Image(systemName: "star.fill").font(.caption).foregroundStyle(p.actx) }
                            Text(space.name).lookFont(look == .simple ? 19 : 17, look == .bands ? .bold : .semibold)
                                .foregroundStyle(p.tx)
                                .multilineTextAlignment(.leading)
                        }
                        if !space.address.isEmpty {
                            Text(space.address).lookFont(13).foregroundStyle(p.tx2).lineLimit(1)
                        }
                        if fri != nil || hours != nil {
                            HStack(spacing: 6) {
                                if fri != nil { chip(W("masjid.twoFridayChip"), fg: p.actx, fill: p.tint) }
                                if let hours {
                                    chip(hours.open ? W("masjid.openNow") : W("masjid.closedNow"), fg: hours.open ? p.tx : p.tx2,
                                         fill: hours.open ? Color.green.opacity(0.2) : p.sep)
                                }
                            }
                        }
                    }
                    Spacer(minLength: 6)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(MasjidExtras.distanceText(space.distanceKm))
                            .lookFont(15).monospacedDigit().foregroundStyle(p.tx2)
                        if let trip { Text(trip).font(.caption).foregroundStyle(p.tx2) }
                    }
                }
                .frame(minHeight: 58)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(isOpen ? W("phone.masjid.hidesDetails") : W("phone.masjid.showsFacilities"))

            if isOpen {
                VStack(alignment: .leading, spacing: 8) {
                    if let d = space.details { roomInfo(d) }
                    facilities(quiet: space.details != nil)
                    if let hours {
                        Label(OpeningHours.text(hours, use24: use24), systemImage: "clock").font(.footnote)
                    }
                    if let fri {
                        Text(W("phone.masjid.secondFriday", ["time": MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24), "women": fri.womenSession2 ? ", " + W("masjid.spaceWomen").lowercased() : ""]))
                            .font(.footnote).foregroundStyle(p.actx)
                    }
                    if let raya, let eid {
                        Text(W("phone.masjid.prayerAt", ["name": eid.shortName, "time": raya.sessions.map { MasjidExtras.clock($0.time, use24: use24) }.joined(separator: ", ")]))
                            .font(.footnote).foregroundStyle(p.actx)
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            Button(action: onDirections) {
                                Label(W("phone.directions"), systemImage: mode == .walk ? "figure.walk" : "car.fill")
                            }
                            .buttonStyle(LookProminent(p))
                            if mine {
                                Label(space.isMusollah ? W("masjid.keptTop") : W("myMasjid.title"), systemImage: "star.fill")
                                    .foregroundStyle(p.actx)
                                    .padding(.horizontal, 8)
                            } else {
                                Button { model.chooseMasjid(name: space.name, coordinates: space.coordinates) } label: {
                                    Label(space.isMusollah ? W("masjid.keepTop") : W("masjid.makeMine"), systemImage: "star")
                                }
                                .buttonStyle(LookQuiet(p))
                            }
                            Button(action: onReport) { Label(W("masjid.report"), systemImage: "flag") }
                                .buttonStyle(LookQuiet(p))
                        }
                        .font(.footnote.weight(.semibold))
                    }
                }
                .foregroundStyle(p.tx)
                .padding(.leading, look == .bands ? 0 : 44)
                .transition(.opacity)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, look == .bands ? 24 : 14)
        .background(rowBackground)
    }

    /// Colour Bands: each row a solid deeper band tone (white words pass contrast), prayer rooms in blue.
    private static let bandTones: [Color] = [
        Color(hex: 0x3A6F63), Color(hex: 0xA3632C), Color(hex: 0xBC5057), Color(hex: 0x6D7940), Color(hex: 0x88702E)
    ]

    @ViewBuilder
    private var rowBackground: some View {
        if look == .bands {
            (space.isMusollah ? Color(hex: 0x4A63B8) : Self.bandTones[index % 5])
        } else if isOpen {
            look.palette.tint
        } else {
            Color.clear
        }
    }

    private var iconTile: some View {
        let room = space.isMusollah
        let fg = room ? Color(hex: 0x6E82E6) : p.actx
        let bg = room ? Color(hex: 0x6E82E6, opacity: 0.2) : p.tint
        return Image(systemName: room ? "house.fill" : "moon.stars.fill")
            .font(.system(size: 16))
            .foregroundStyle(fg)
            .frame(width: 30, height: 30)
            .background(bg, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .accessibilityHidden(true)
    }

    /// The prayer room details from the community list, only the parts we have.
    @ViewBuilder
    private func roomInfo(_ d: MasjidList.RoomDetails) -> some View {
        if !d.howToFind.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                Text(W("masjid.findIt").uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(p.tx2)
                Text(d.howToFind).font(.footnote)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(look == .bands ? Color.white.opacity(0.18) : p.tint, in: RoundedRectangle(cornerRadius: look == .bands ? 0 : 12))
        }
        let chips = d.chips
        if !chips.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(chips, id: \.self) { c in
                        Text(c).font(.caption.weight(.medium))
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .background(Color.primary.opacity(0.07), in: Capsule())
                    }
                }
            }
        }
        if !d.notes.isEmpty || !d.toiletLevel.isEmpty {
            DisclosureGroup(W("masjid.moreDetails")) {
                VStack(alignment: .leading, spacing: 6) {
                    if !d.toiletLevel.isEmpty {
                        let level = d.toiletLevel.replacingOccurrences(of: #"^(also )?(level )?"#, with: "", options: [.regularExpression, .caseInsensitive])
                        Text(W("masjid.toiletOn", ["level": level])).font(.footnote)
                    }
                    if !d.notes.isEmpty { Text(d.notes).font(.footnote) }
                    Text(W("masjid.communityNote"))
                        .font(.caption).foregroundStyle(p.tx2)
                }
                .padding(.top, 4)
            }
            .font(.footnote.weight(.semibold)).tint(p.actx)
        }
    }

    @ViewBuilder
    private func facilities(quiet: Bool = false) -> some View {
        let have = MasjidExtras.facilityLabels.filter { space.facilities.contains($0.0) }
        if have.isEmpty {
            if !quiet { Text(W("masjid.noFacilities")).font(.footnote).foregroundStyle(p.tx2) }
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

    private func chip(_ text: String, fg: Color, fill: Color) -> some View {
        let bands = look == .bands
        return Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(bands ? Color.white : fg)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(bands ? Color.white.opacity(0.22) : fill, in: RoundedRectangle(cornerRadius: bands ? 0 : 10, style: .continuous))
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
    if let j = m.jumuah { parts.append("\(Prayer.dhuhr.name(model.naming, isFriday: true)) \(MasjidExtras.clock(j, use24: use24))") }
    return parts.isEmpty ? nil : parts.joined(separator: ", ")
}

private struct YourMasjidCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.look) private var look
    private var p: LookPalette { look.palette }
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
                    Image(systemName: "star.fill").foregroundStyle(p.actx).frame(width: 24).padding(.top, 2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(W("myMasjid.title").uppercased()).font(.caption2.weight(.bold)).foregroundStyle(p.tx2)
                        Text(link.name).font(.body.weight(.semibold)).foregroundStyle(p.tx).multilineTextAlignment(.leading)
                        Text(W("phone.masjid.away", ["distance": MasjidExtras.distanceText(km), "extra": trip.map { ", \($0)" } ?? ""]))
                            .font(.caption).foregroundStyle(p.tx2)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Group {
                if let iq = iqamahLine(link, model: model) {
                    Text(W("masjid.iqamahLine", ["times": iq]))
                } else {
                    Text(W("masjid.iqamahHow"))
                        .foregroundStyle(p.tx2)
                }
                if let fri {
                    Text(W("phone.masjid.secondFriday", ["time": MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24), "women": fri.womenSession2 ? ", " + W("masjid.spaceWomen").lowercased() : ""]))
                        .foregroundStyle(p.actx)
                }
                if let raya, let eid {
                    Text(W("phone.masjid.prayerAt", ["name": eid.shortName, "time": raya.sessions.map { MasjidExtras.clock($0.time, use24: use24) }.joined(separator: ", ")]))
                        .foregroundStyle(p.actx)
                } else if let e = link.eid {
                    Text(W("masjid.eidAtTime", ["time": MasjidExtras.clock(e, use24: use24)])).foregroundStyle(p.actx)
                }
            }
            .font(.footnote)
            .padding(.leading, 36)
            HStack(spacing: 8) {
                Button(action: onDirections) {
                    Label(W("phone.directions"), systemImage: mode == .walk ? "figure.walk" : "car.fill")
                }
                .buttonStyle(LookProminent(p))
                Button(W("common.remove")) { model.forgetMasjid() }
                    .buttonStyle(LookQuiet(p))
            }
            .font(.footnote.weight(.semibold))
            .padding(.leading, 36)
        }
        .lookCard(padding: 14)
        .overlay(RoundedRectangle(cornerRadius: p.radius, style: .continuous).strokeBorder(p.ac.opacity(0.55), lineWidth: 1))
        .padding(.horizontal)
    }
}

// MARK: - Singapore Friday and Hari Raya

private struct FridayCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.look) private var look
    private var p: LookPalette { look.palette }
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
        f.locale = AppWords.formatLocale
        return f.string(from: d)
    }

    var body: some View {
        let use24 = model.prefs.use24Hour
        let list = MasjidExtras.fridayNearest(from)
        let shown = all ? list : Array(list.prefix(3))
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "calendar").foregroundStyle(p.actx).frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(today ? W("masjid.fridayToday") : W("masjid.fridaySg")).font(.headline)
                    Text(W("masjid.fridayHold", ["n": list.count, "time": MasjidExtras.clock(MasjidExtras.fridaySecondFrom, use24: use24), "name": Prayer.dhuhr.name(model.naming)]))
                        .font(.footnote).foregroundStyle(p.tx2)
                }
            }
            VStack(spacing: 0) {
                ForEach(shown.indices, id: \.self) { i in
                    let row = shown[i]
                    HStack(spacing: 10) {
                        Button { onFocus(row.mosque.coordinates) } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: "moon.stars.fill").foregroundStyle(p.actx).frame(width: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(row.mosque.name).font(.subheadline.weight(.semibold)).foregroundStyle(p.tx)
                                        .multilineTextAlignment(.leading)
                                    Text(row.mosque.district + (row.mosque.womenSession2 ? W("masjid.women2") : ""))
                                        .font(.caption).foregroundStyle(p.tx2).multilineTextAlignment(.leading)
                                }
                                Spacer(minLength: 4)
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(MasjidExtras.distanceText(row.km)).font(.subheadline.monospacedDigit()).foregroundStyle(p.tx2)
                                    if let trip = MasjidExtras.tripText(row.km, mode: mode) {
                                        Text(trip).font(.caption).foregroundStyle(p.tx2)
                                    }
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Button { onDirections(row.mosque) } label: {
                            Image(systemName: mode == .walk ? "figure.walk" : "car.fill")
                                .frame(width: 36, height: 36)
                                .background(p.tint, in: Circle())
                        }
                        .accessibilityLabel(W("masjid.directionsTo", ["name": row.mosque.name]))
                        .foregroundStyle(p.actx)
                    }
                    .padding(.vertical, 8)
                }
            }
            Button { withAnimation(.snappy) { all.toggle() } } label: {
                Label(all ? W("masjid.showNearest3") : W("masjid.seeAll", ["n": list.count]), systemImage: all ? "chevron.up" : "chevron.down")
                    .font(.footnote.weight(.semibold))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(W("phone.masjid.muisUpdated", ["date": updated]))
                if let url = URL(string: MasjidExtras.fridaySourceURL) {
                    Button(W("masjid.seeMuis")) { openURL(url) }.font(.caption.weight(.semibold))
                }
            }
            .font(.caption).foregroundStyle(p.tx2)
        }
        .lookCard(padding: 14)
        .overlay {
            if today {
                RoundedRectangle(cornerRadius: p.radius, style: .continuous).strokeBorder(p.ac.opacity(0.55), lineWidth: 1)
            }
        }
        .padding(.horizontal)
    }
}

private struct EidCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.look) private var look
    private var p: LookPalette { look.palette }
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
                Image(systemName: "moon.stars.fill").foregroundStyle(p.actx).frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(W("phone.masjid.prayerName", ["name": event.shortName])).font(.headline)
                    Text(W("masjid.eidNearest", ["date": dateText])).font(.footnote).foregroundStyle(p.tx2)
                }
            }
            ForEach(shown) { row in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "moon.stars.fill").foregroundStyle(p.actx).frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.mosque.name).font(.subheadline.weight(.semibold))
                        Text(row.mosque.sessions.map { s in
                            MasjidExtras.clock(s.time, use24: use24) + (s.khutbah.map { " (\($0))" } ?? "")
                        }.joined(separator: ", "))
                        .font(.caption).foregroundStyle(p.tx2)
                        let extra = [row.mosque.sessions.contains { $0.women } ? "Space for women" : nil, row.mosque.note].compactMap { $0 }
                        if !extra.isEmpty {
                            Text(extra.joined(separator: ". ")).font(.caption).foregroundStyle(p.tx2)
                        }
                    }
                    Spacer(minLength: 4)
                    if let km = row.km {
                        Text(MasjidExtras.distanceText(km)).font(.subheadline.monospacedDigit()).foregroundStyle(p.tx2)
                    }
                }
                .padding(.vertical, 4)
            }
            if rows.count > 3 {
                Button { withAnimation(.snappy) { all.toggle() } } label: {
                    Label(all ? W("masjid.showNearest3") : W("masjid.seeAll", ["n": rows.count]), systemImage: all ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(W("phone.masjid.muis"))
                if let url = URL(string: event.sourceURL) {
                    Button(W("masjid.seeMuis")) { openURL(url) }.font(.caption.weight(.semibold))
                }
            }
            .font(.caption).foregroundStyle(p.tx2)
        }
        .lookCard(padding: 14)
        .overlay(RoundedRectangle(cornerRadius: p.radius, style: .continuous).strokeBorder(p.ac.opacity(0.55), lineWidth: 1))
        .padding(.horizontal)
    }

    private var dateText: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: event.date) else { return event.date }
        f.dateFormat = "EEEE d MMMM"
        f.locale = AppWords.formatLocale
        return f.string(from: d)
    }
}

// MARK: - The look's own parts

/// The slim strip on top of the list sheet: just the handle for Centre Dial, the sun's curve for
/// Sun Path, six colour stripes for Colour Bands, a thin gold line for Calm Gold.
private struct LookStrip: View {
    let look: TodayStyle
    let p: LookPalette

    private static let stripes: [Color] = [
        Color(hex: 0x3A6F63), Color(hex: 0x8A9A52), Color(hex: 0xAB8D3A),
        Color(hex: 0xCD7D38), Color(hex: 0xD3705C), Color(hex: 0xC9565D)
    ]

    var body: some View {
        switch look {
        case .bands:
            HStack(spacing: 0) {
                ForEach(0..<6, id: \.self) { i in Self.stripes[i] }
            }
            .frame(height: 8)
            .accessibilityHidden(true)
        case .simple:
            grab
        case .gold:
            VStack(spacing: 10) {
                grab
                Rectangle().fill(p.ac.opacity(0.7)).frame(height: 1)
                    .padding(.horizontal)
            }
            .accessibilityHidden(true)
        case .sunPath:
            VStack(spacing: 0) {
                grab
                SunCurve(color: p.ac).frame(height: 34)
            }
            .accessibilityHidden(true)
        default:
            grab
        }
    }

    private var grab: some View {
        Capsule().fill(p.tx3.opacity(0.5)).frame(width: 38, height: 5)
            .frame(maxWidth: .infinity)
            .padding(.top, 8)
    }
}

/// The sun's arc with the sun at the top.
private struct SunCurve: View {
    let color: Color

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            path.move(to: CGPoint(x: -10, y: size.height - 2))
            path.addQuadCurve(to: CGPoint(x: size.width + 10, y: size.height - 2),
                              control: CGPoint(x: size.width / 2, y: -size.height * 0.5))
            ctx.stroke(path, with: .color(color.opacity(0.6)), lineWidth: 2.5)
            let sun = CGRect(x: size.width / 2 - 6, y: 5, width: 12, height: 12)
            ctx.fill(Path(ellipseIn: sun), with: .color(color))
        }
    }
}

/// A small navy bar with a ring pattern, the Centre Dial strip.
private struct KawungDots: View {
    private static let gold = Color(hex: 0xE2B65A)

    var body: some View {
        Canvas { ctx, size in
            ctx.fill(Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 5), with: .color(Color(hex: 0x262B5E)))
            var x: CGFloat = 0
            while x < size.width + 22 {
                let ring = CGRect(x: x - 10, y: size.height / 2 - 10, width: 20, height: 20)
                ctx.stroke(Path(ellipseIn: ring), with: .color(Self.gold.opacity(0.16)), lineWidth: 1)
                x += 22
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(Self.gold.opacity(0.4), lineWidth: 1))
    }
}

/// Walk and Drive, or All, Masjid and Prayer room, in the look's colours.
private struct LookSegmented<Value: Hashable>: View {
    let p: LookPalette
    let label: String
    let options: [(String, Value)]
    @Binding var selection: Value

    var body: some View {
        let radius: CGFloat = p.radius == 0 ? 0 : 10
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { i in
                let on = options[i].1 == selection
                Button { selection = options[i].1 } label: {
                    Text(options[i].0)
                        .lookFont(15, .semibold)
                        .foregroundStyle(on ? p.tx : p.tx2)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background {
                            if on {
                                RoundedRectangle(cornerRadius: max(radius - 2, 0), style: .continuous)
                                    .fill(Color.dyn(Color.white, Color.white.opacity(0.16)))
                                    .shadow(color: .black.opacity(0.15), radius: 2, y: 1)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(2)
        .background(p.sep, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
    }
}

/// The look's big button: its button colour with the matching words.
private struct LookProminent: ButtonStyle {
    let p: LookPalette
    init(_ p: LookPalette) { self.p = p }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(p.onBtn)
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(p.btn, in: RoundedRectangle(cornerRadius: p.radius == 0 ? 0 : 22, style: .continuous))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

/// The look's quiet button: a soft fill with the main text colour.
private struct LookQuiet: ButtonStyle {
    let p: LookPalette
    init(_ p: LookPalette) { self.p = p }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(p.tx)
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(p.sep, in: RoundedRectangle(cornerRadius: p.radius == 0 ? 0 : 22, style: .continuous))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

/// Where you are: a blue dot with soft waves beaming out from it.
private struct YouBeacon: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme
    @State private var beaming = false

    var body: some View {
        let dark = scheme == .dark
        // Brighter blue on the dark map, with a thin dark edge so the white rim stands out.
        let you = dark ? Color(red: 0.24, green: 0.61, blue: 1) : Color(red: 0.04, green: 0.42, blue: 1)
        let glow = dark ? Color(red: 0.35, green: 0.69, blue: 1).opacity(0.55) : you.opacity(0.30)
        let ring = dark ? Color(red: 0.55, green: 0.78, blue: 1).opacity(0.95) : you.opacity(0.85)
        let edge = Color.black.opacity(dark ? 0.55 : 0.18)
        ZStack {
            // A glow that is always there and gently breathes.
            Circle()
                .fill(RadialGradient(gradient: Gradient(stops: [.init(color: glow, location: 0), .init(color: glow, location: 0.6), .init(color: .clear, location: 1)]),
                                     center: .center, startRadius: 0, endRadius: 23))
                .frame(width: 46, height: 46)
                .scaleEffect(reduceMotion ? 1 : (beaming ? 1.18 : 1))
                .animation(reduceMotion ? nil : .easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: beaming)
            if reduceMotion {
                // Nothing moves: a still ring keeps the dot just as easy to find.
                Circle().stroke(ring, lineWidth: 2).frame(width: 38, height: 38).opacity(0.55)
            } else {
                // One clear ring that travels out and fades, every 2.4 seconds.
                Circle().stroke(ring, lineWidth: 2)
                    .frame(width: beaming ? 110 : 22, height: beaming ? 110 : 22)
                    .opacity(beaming ? 0 : 0.95)
                    .animation(.timingCurve(0.2, 0.6, 0.3, 1, duration: 2.4).repeatForever(autoreverses: false), value: beaming)
            }
            Circle().fill(edge).frame(width: 22, height: 22)
            Circle().fill(.white).frame(width: 20, height: 20)
            Circle().fill(you).frame(width: 14, height: 14)
                .shadow(color: glow, radius: 7)
        }
        .frame(width: 130, height: 130)
        .allowsHitTesting(false)
        .onAppear { beaming = true }
    }
}

/// Colours for the distance rings and their labels, lighter on the dark map so they show.
private enum RingStyle {
    static func line(_ s: ColorScheme) -> Color { s == .dark ? Color(red: 0.55, green: 0.76, blue: 1).opacity(0.85) : Color(red: 0.04, green: 0.37, blue: 0.86).opacity(0.75) }
    static func fill(_ s: ColorScheme) -> Color { s == .dark ? Color(red: 0.47, green: 0.73, blue: 1).opacity(0.10) : Color(red: 0.04, green: 0.42, blue: 1).opacity(0.07) }
    static func chip(_ s: ColorScheme) -> Color { s == .dark ? Color(red: 0.06, green: 0.11, blue: 0.22).opacity(0.94) : Color.white.opacity(0.97) }
    static func text(_ s: ColorScheme) -> Color { s == .dark ? Color(red: 0.81, green: 0.89, blue: 1) : Color(red: 0.04, green: 0.33, blue: 0.78) }
}

/// Where the map camera is right now, kept apart so only the ring labels redraw while the map moves.
@Observable private final class LabelCamera {
    var region: MKCoordinateRegion?
}

/// "1 km, 13 min" on foot, "5 km, 12 min" by car, on each ring below its right hand side so they
/// line up like a ruler. Drawn over the map, so masjid pins never cover them.
private struct RingLabels: View {
    let proxy: MapProxy
    let you: CLLocationCoordinate2D
    let rings: [Double]
    let mode: TripMode
    let camera: LabelCamera
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let _ = camera.region // redraw as the map moves
        let a = MasjidExtras.ringLabelAngle * .pi / 180
        GeometryReader { geo in
            ForEach(rings, id: \.self) { km in
                let lat = you.latitude - km * sin(a) / 111.2
                let lng = you.longitude + km * cos(a) / (111.2 * cos(you.latitude * .pi / 180))
                if let p = proxy.convert(CLLocationCoordinate2D(latitude: lat, longitude: lng), to: .local),
                   geo.frame(in: .local).insetBy(dx: -20, dy: -10).contains(p) {
                    Text(label(km))
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(RingStyle.text(scheme))
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(RingStyle.chip(scheme), in: Capsule())
                        .overlay(Capsule().stroke(RingStyle.line(scheme).opacity(0.6)))
                        .shadow(color: .black.opacity(0.25), radius: 3)
                        .fixedSize()
                        .position(p)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func label(_ km: Double) -> String {
        let trip = MasjidExtras.tripText(km, mode: mode)?
            .replacingOccurrences(of: " walk", with: "").replacingOccurrences(of: " drive", with: "")
        return MasjidExtras.ringDistance(km) + (trip.map { ", \($0)" } ?? "")
    }
}
