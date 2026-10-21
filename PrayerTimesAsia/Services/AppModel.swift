import CoreLocation
import Foundation
import Observation

/// The app's single source of truth: where you are, which rules apply there,
/// and today's times. Views read from it; only it writes Preferences.
@MainActor
@Observable
final class AppModel {
    /// Saved and acted on by `preferencesChanged(from:)`, which RootView calls
    /// from `.onChange(of: prefs)`.
    var prefs: Preferences

    let location = LocationService()
    /// The place resolved from the latest GPS fix.
    private(set) var gpsPlace: Place?
    private(set) var isResolvingPlace = false
    var selectedTab: Tab = .today

    enum Tab: String, Hashable { case today, qibla, journey, settings }

    @ObservationIgnored private let geocoder = CLGeocoder()
    @ObservationIgnored private var lastGeocoded: CLLocation?

    init() {
        prefs = Preferences.load()
        if let demo = Self.demoPreferences() { prefs = demo }
    }

    /// `-demo` (home in Singapore) or `-demo-travel` (just landed in Hanoi)
    /// launch arguments give CI a fixed place for simulator screenshots.
    /// Not saved: preferencesChanged only runs on later edits.
    private static func demoPreferences() -> Preferences? {
        let args = ProcessInfo.processInfo.arguments
        guard args.contains("-demo") || args.contains("-demo-travel") else { return nil }
        let home = Place(name: "Pasir Ris", region: nil, countryCode: "SG", countryName: "Singapore",
                         timeZoneID: "Asia/Singapore", coordinates: Coordinates(latitude: 1.3721, longitude: 103.9474))
        var p = Preferences()
        p.hasOnboarded = true
        p.useGPS = false
        p.home = home
        p.manualPlace = home
        p.lastCountryCode = "SG"
        if args.contains("-demo-travel") {
            let hanoi = Place(name: "Hoàn Kiếm", region: "Hanoi", countryCode: "VN", countryName: "Vietnam",
                              timeZoneID: "Asia/Ho_Chi_Minh", coordinates: Coordinates(latitude: 21.0285, longitude: 105.8542))
            p.manualPlace = hanoi
            p.lastCountryCode = "VN"
            p.arrivedAt = .now
            p.arrivalBannerDismissed = false
            p.trip = [TripStop(countryCode: "VN", countryName: "Vietnam", placeName: "Hoàn Kiếm", arrived: .now),
                      TripStop(countryCode: "SG", countryName: "Singapore", placeName: "Pasir Ris",
                               arrived: .now.addingTimeInterval(-86_400 * 30))]
        }
        return p
    }

    /// Applies a `-tab <name>` launch argument once the UI is up (screenshots).
    func applyDemoTab() {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-tab"), i + 1 < args.count, let tab = Tab(rawValue: args[i + 1]) {
            selectedTab = tab
        }
    }

    // MARK: Where and which rules

    var activePlace: Place? { prefs.useGPS ? (gpsPlace ?? prefs.manualPlace) : prefs.manualPlace }

    var profile: CountryProfile { activePlace?.profile ?? AsiaRegions.fallback }

    var method: CalculationMethod {
        prefs.methodOverrideID.flatMap(CalculationMethod.with(id:)) ?? profile.method
    }

    var isMethodAutomatic: Bool { prefs.methodOverrideID == nil }
    var asrSchool: AsrSchool { prefs.asrOverride ?? profile.asr }
    var naming: NamingStyle { prefs.namingOverride ?? profile.naming }
    var timeZone: TimeZone { activePlace?.timeZone ?? .current }

    var musafirRules: Musafir.Rules {
        Musafir.Rules(school: asrSchool, thresholdKm: asrSchool == .hanafi ? 78 : prefs.musafirThresholdKm)
    }

    var daysHere: Int {
        guard let arrived = prefs.arrivedAt else { return 0 }
        return max(0, Calendar.current.dateComponents([.day], from: arrived, to: .now).day ?? 0)
    }

    var musafirStatus: Musafir.Status? {
        guard let place = activePlace else { return nil }
        return Musafir.status(home: prefs.home?.coordinates, current: place.coordinates,
                              daysHere: daysHere, rules: musafirRules)
    }

    // MARK: Times

    func day(containing date: Date) -> PrayerDay? {
        guard let place = activePlace else { return nil }
        return PrayerEngine.compute(for: date, in: place.timeZone, at: place.coordinates,
                                    method: method, asr: asrSchool)
    }

    /// The next obligatory prayer (or sunrise, which ends Subuh) after `now`.
    func next(after now: Date) -> (prayer: Prayer, time: Date)? {
        guard let today = day(containing: now) else { return nil }
        if let upcoming = today.ordered.first(where: { $0.time > now }) { return upcoming }
        guard let tomorrow = day(containing: now.addingTimeInterval(86_400)) else { return nil }
        return (.fajr, tomorrow.time(.fajr))
    }

    /// The period we're in: the last time that has passed (Isha carries over past midnight).
    func current(at now: Date) -> (prayer: Prayer, time: Date)? {
        guard let today = day(containing: now) else { return nil }
        if let passed = today.ordered.last(where: { $0.time <= now }) { return passed }
        guard let yesterday = day(containing: now.addingTimeInterval(-86_400)) else { return nil }
        return (.isha, yesterday.time(.isha))
    }

    func formatted(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeZone = timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = prefs.use24Hour ? "HH:mm" : "h:mm a"
        return f.string(from: date)
    }

    func isFriday(_ date: Date) -> Bool {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.component(.weekday, from: date) == 6
    }

    // MARK: Lifecycle

    func preferencesChanged(from old: Preferences) {
        prefs.save()
        if prefs.notificationsEnabled || old.notificationsEnabled { scheduleNotifications() }
    }

    func appBecameActive() {
        location.refresh()
        scheduleNotifications()
    }

    /// Called when GPS moves. Reverse-geocodes when online; falls back to the
    /// phone's time zone for the country when offline, so times still appear.
    func handle(location newLocation: CLLocation) {
        if let last = lastGeocoded, newLocation.distance(from: last) < 1_000, gpsPlace != nil { return }
        lastGeocoded = newLocation
        let coords = Coordinates(latitude: newLocation.coordinate.latitude, longitude: newLocation.coordinate.longitude)

        // Show times immediately with an offline guess, then refine.
        let tz = TimeZone.current
        let guessCode = AsiaRegions.countryCode(forTimeZone: tz.identifier)
        let offline = Place(name: "Current location", region: nil, countryCode: guessCode,
                            countryName: AsiaRegions.profile(for: guessCode)?.name,
                            timeZoneID: tz.identifier, coordinates: coords)
        if gpsPlace == nil || !(gpsPlace!.isNear(offline)) { adopt(gps: offline) }

        isResolvingPlace = true
        geocoder.cancelGeocode()
        geocoder.reverseGeocodeLocation(newLocation) { [weak self] placemarks, _ in
            Task { @MainActor in
                guard let self else { return }
                self.isResolvingPlace = false
                guard let mark = placemarks?.first else { return }
                let code = mark.isoCountryCode
                let place = Place(
                    name: mark.subLocality ?? mark.locality ?? mark.administrativeArea ?? mark.country ?? "Current location",
                    region: mark.subLocality != nil ? mark.locality : mark.administrativeArea,
                    countryCode: code,
                    countryName: AsiaRegions.profile(for: code)?.name ?? mark.country,
                    timeZoneID: (mark.timeZone ?? tz).identifier,
                    coordinates: coords)
                self.adopt(gps: place)
            }
        }
    }

    private func adopt(gps place: Place) {
        gpsPlace = place
        if prefs.useGPS { arrived(at: place) }
    }

    func choose(manual place: Place) {
        prefs.manualPlace = place
        prefs.useGPS = false
        if !prefs.savedPlaces.contains(where: { $0.isNear(place) }) {
            prefs.savedPlaces.insert(place, at: 0)
        }
        arrived(at: place)
    }

    func useGPS() {
        prefs.useGPS = true
        location.requestPermission()
        location.refresh()
        if let gpsPlace { arrived(at: gpsPlace) }
    }

    func setHome(_ place: Place) {
        prefs.home = place
    }

    /// Travel mode: notice a new country, remember when we got here, show the welcome card.
    private func arrived(at place: Place) {
        var p = prefs
        if p.home == nil, place.countryCode != nil, place.name != "Current location" { p.home = place }
        if let code = place.countryCode, code != p.lastCountryCode {
            let isFirstEver = p.lastCountryCode == nil
            p.lastCountryCode = code
            p.arrivedAt = .now
            p.arrivalBannerDismissed = isFirstEver
            p.trip.insert(TripStop(countryCode: code, countryName: place.countryName ?? code,
                                   placeName: place.name, arrived: .now), at: 0)
            if p.trip.count > 30 { p.trip.removeLast(p.trip.count - 30) }
        }
        prefs = p
        scheduleNotifications()
    }

    // MARK: Notifications

    func scheduleNotifications() {
        guard let place = activePlace else { return }
        var alerts: [NotificationScheduler.Alert] = []
        let lead = Double(prefs.reminderMinutesBefore) * 60
        for offset in 0..<12 {
            guard let pd = day(containing: Date.now.addingTimeInterval(Double(offset) * 86_400)) else { continue }
            for prayer in Prayer.obligatory where prefs.notifyPrayers.contains(prayer) {
                let time = pd.time(prayer)
                let name = prayer.name(naming, isFriday: isFriday(time))
                let title = prefs.reminderMinutesBefore > 0
                    ? "\(name) in \(prefs.reminderMinutesBefore) min"
                    : "It's time for \(name)"
                alerts.append(.init(
                    id: "\(pd.year)-\(pd.month)-\(pd.day)-\(prayer.rawValue)",
                    title: title,
                    body: "\(name) · \(formatted(time)) · \(place.name)",
                    fireDate: time.addingTimeInterval(-lead)))
            }
        }
        NotificationScheduler.reschedule(enabled: prefs.notificationsEnabled, alerts: alerts)
    }
}
