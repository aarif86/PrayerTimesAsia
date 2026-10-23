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
    let official = OfficialTimetables()
    let mosques = MosqueDirectory()
    let hijriCalendar = CalendarDirectory()
    /// The place resolved from the latest GPS fix.
    private(set) var gpsPlace: Place?
    private(set) var isResolvingPlace = false
    var selectedTab: Tab = .today
    /// Settings opens as a sheet from the gear on Today.
    var showSettings = false

    /// `settings` is not a tab; `-tab settings` opens the Settings sheet.
    enum Tab: String, Hashable { case today, qibla, falak, nearby, journey, settings }

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
        guard args.contains("-demo") || args.contains("-demo-travel") || args.contains("-demo-makkah")
                || args.contains("-demo-visitor") else { return nil }
        let home = Place(name: "Pasir Ris", region: nil, countryCode: "SG", countryName: "Singapore",
                         timeZoneID: "Asia/Singapore", coordinates: Coordinates(latitude: 1.3721, longitude: 103.9474))
        var p = Preferences()
        p.hasOnboarded = true
        p.useGPS = false
        p.home = home
        p.manualPlace = home
        p.lastCountryCode = "SG"
        // Show the tracker with a three-day streak.
        p.trackerEnabled = true
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Singapore")!
        for back in 1...3 {
            let c = cal.dateComponents([.year, .month, .day], from: Date.now.addingTimeInterval(Double(-back) * 86_400))
            p.prayedLog[String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)] = Set(Prayer.obligatory)
        }
        p.appearance = args.contains("-light") ? .light : .dark
        p.todayStyle = args.contains("-dial") ? .dial : .list
        if args.contains("-demo-visitor") {
            // A visitor from Sydney in Kuala Lumpur: International names, Malay underneath.
            p.home = Place(name: "Sydney", region: nil, countryCode: "AU", countryName: "Australia",
                           timeZoneID: "Australia/Sydney", coordinates: Coordinates(latitude: -33.8688, longitude: 151.2093))
            p.manualPlace = Place(name: "Kuala Lumpur", region: nil, countryCode: "MY", countryName: "Malaysia",
                                  timeZoneID: "Asia/Kuala_Lumpur", coordinates: Coordinates(latitude: 3.139, longitude: 101.6869))
            p.lastCountryCode = "MY"
            p.trackerEnabled = false
        }
        if args.contains("-demo-makkah") {
            // A place where it is daytime while CI runs (European/Asian evening).
            p.manualPlace = Place(name: "Makkah", region: nil, countryCode: "SA", countryName: "Saudi Arabia",
                                  timeZoneID: "Asia/Riyadh", coordinates: Geo.kaaba)
            p.lastCountryCode = "SA"
        }
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
            if tab == .settings { showSettings = true } else { selectedTab = tab }
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
    /// Your prayer names - from your home or your phone, not from where you
    /// are, so they stay the same as you travel.
    var naming: NamingStyle { prefs.namingOverride ?? personalNaming }
    var personalNaming: NamingStyle { NamingStyle.personal(homeCountry: prefs.home?.countryCode) }
    /// The words used where you are (the masjid's signs, the azan app locals use).
    var localNaming: NamingStyle { profile.naming }

    /// The local word for a prayer, when it differs from yours.
    func localName(_ prayer: Prayer, at time: Date) -> String? {
        guard prefs.showLocalNames, localNaming != naming else { return nil }
        let local = prayer.name(localNaming, isFriday: isFriday(time))
        return local == prayer.name(naming, isFriday: isFriday(time)) ? nil : local
    }
    /// Whose Ramadan and Eid dates you follow (calendar sanad).
    var communityAuthority: String? {
        prefs.communityAuthority ?? CalendarSanad.defaultAuthority(country: (prefs.home ?? activePlace)?.profile.code ?? profile.code)
    }
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

    /// The official table that applies here (MUIS / JAKIM), if any.
    var officialSource: OfficialTimetables.Source? {
        guard let place = activePlace else { return nil }
        return OfficialTimetables.source(for: place, method: method, zoneOverride: prefs.jakimZoneOverride)
    }

    /// The mosque profile (Grade B) covering where you are, if any.
    var nearbyMosque: MosqueProfile? {
        activePlace.flatMap { mosques.profile(near: $0.coordinates) }
    }

    /// Resolver (brief §6.3): official table (A) → nearby mosque's own timetable
    /// (B) → calculation with the country's method (D; A when the method itself
    /// is the authority's exact published rule, as with Umm al-Qura).
    func day(containing date: Date) -> PrayerDay? {
        guard let place = activePlace else { return nil }
        let mosque = mosques.profile(near: place.coordinates)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = place.timeZone

        var result: PrayerDay
        let computed = PrayerEngine.compute(for: date, in: place.timeZone, at: place.coordinates,
                                            method: method, asr: asrSchool)
        if let source = officialSource,
           let table = official.times(source, year: computed.year, month: computed.month, day: computed.day),
           let times = Self.times(from: table, on: computed, calendar: cal, keepAsrFrom: asrSchool == .hanafi ? computed : nil) {
            result = PrayerDay(year: computed.year, month: computed.month, day: computed.day, times: times,
                               officialSource: source.label, grade: .official)
            if let mosque, let mosqueMethod = mosque.method {
                let theirs = PrayerEngine.compute(for: date, in: place.timeZone, at: place.coordinates, method: mosqueMethod,
                                                  asr: prefs.asrOverride ?? mosque.asrSchool ?? asrSchool)
                result.alternate = Self.disagreements(result, theirs)
                result.alternateSource = result.alternate.isEmpty ? nil : mosque.name
            }
        } else if isMethodAutomatic, let mosque, let mosqueMethod = mosque.method {
            result = PrayerEngine.compute(for: date, in: place.timeZone, at: place.coordinates, method: mosqueMethod,
                                          asr: prefs.asrOverride ?? mosque.asrSchool ?? asrSchool)
            result.grade = mosque.grade
            result.officialSource = "\(mosque.name) timetable"
        } else {
            result = computed
            result.grade = method.id == "ummalqura" ? .official : .calculated
        }
        if let mosque {
            result.mosqueName = mosque.name
            result.jamaah = mosque.jamaahTimes(for: result, timeZone: place.timeZone, isFriday: isFriday(result.time(.dhuhr)))
        }
        return result
    }

    /// Prayers where `other` differs from `day` by more than 2 minutes.
    nonisolated static func disagreements(_ day: PrayerDay, _ other: PrayerDay) -> [Prayer: Date] {
        var out: [Prayer: Date] = [:]
        for prayer in Prayer.obligatory where abs(other.time(prayer).timeIntervalSince(day.time(prayer))) > 120 {
            out[prayer] = other.time(prayer)
        }
        return out
    }

    private static func times(from table: [Prayer: String], on day: PrayerDay, calendar: Calendar,
                              keepAsrFrom computed: PrayerDay?) -> [Prayer: Date]? {
        var times: [Prayer: Date] = [:]
        for prayer in Prayer.allCases {
            // Official tables are Shafi'i; a Hanafi user keeps the calculated Asr.
            if prayer == .asr, let computed { times[prayer] = computed.time(.asr); continue }
            let parts = table[prayer]!.split(separator: ":").compactMap { Int($0) }
            guard parts.count == 2, let d = calendar.date(from: DateComponents(
                year: day.year, month: day.month, day: day.day, hour: parts[0], minute: parts[1])) else { return nil }
            times[prayer] = d
        }
        return times
    }

    /// Downloads this year's official table for where you are (and next year's in December).
    func refreshOfficialTimetable() {
        guard let source = officialSource else { return }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let now = cal.dateComponents([.year, .month], from: .now)
        let years = now.month == 12 ? [now.year!, now.year! + 1] : [now.year!]
        Task {
            var changed = false
            for year in years { changed = await official.ensure(source, year: year) || changed }
            if changed { scheduleNotifications() }
        }
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

    /// "5:29" and "AM" separately, so the suffix can be set smaller on the same
    /// line and never wraps on its own. No suffix in 24-hour mode.
    func timeParts(_ date: Date) -> (time: String, suffix: String?) {
        let f = DateFormatter()
        f.timeZone = timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = prefs.use24Hour ? "HH:mm" : "h:mm"
        let time = f.string(from: date)
        guard !prefs.use24Hour else { return (time, nil) }
        f.dateFormat = "a"
        return (time, f.string(from: date))
    }

    func isFriday(_ date: Date) -> Bool {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.component(.weekday, from: date) == 6
    }

    // MARK: Prayer tracker

    /// Local calendar key ("yyyy-MM-dd") for a date at the active place.
    func dayKey(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    func isPrayed(_ prayer: Prayer, on date: Date) -> Bool {
        prefs.prayedLog[dayKey(date)]?.contains(prayer) ?? false
    }

    func togglePrayed(_ prayer: Prayer, on date: Date) {
        let key = dayKey(date)
        var set = prefs.prayedLog[key] ?? []
        if set.contains(prayer) { set.remove(prayer) } else { set.insert(prayer) }
        prefs.prayedLog[key] = set.isEmpty ? nil : set
        // Keep about a year of history.
        if prefs.prayedLog.count > 400, let oldest = prefs.prayedLog.keys.min() { prefs.prayedLog[oldest] = nil }
    }

    func isExcused(_ date: Date) -> Bool { prefs.excusedDays.contains(dayKey(date)) }

    func toggleExcused(_ date: Date) {
        let key = dayKey(date)
        if prefs.excusedDays.contains(key) { prefs.excusedDays.remove(key) } else { prefs.excusedDays.insert(key) }
    }

    /// Consecutive days with all five prayers marked (or excused). Today counts
    /// once complete; an unfinished today doesn't break the streak.
    var streak: Int {
        var count = 0
        var date = Date.now
        for i in 0..<400 {
            let key = dayKey(date)
            let complete = prefs.excusedDays.contains(key) || (prefs.prayedLog[key]?.count ?? 0) >= Prayer.obligatory.count
            if complete { count += 1 } else if i > 0 { break }
            date = date.addingTimeInterval(-86_400)
        }
        return count
    }

    // MARK: Lifecycle

    func preferencesChanged(from old: Preferences) {
        prefs.save()
        // Ticking a prayer in the tracker shouldn't reschedule every alarm.
        var a = prefs, b = old
        a.prayedLog = [:]; b.prayedLog = [:]
        a.excusedDays = []; b.excusedDays = []
        guard a != b else { return }
        refreshOfficialTimetable()
        scheduleNotifications()
    }

    func appBecameActive() {
        location.refresh()
        refreshOfficialTimetable()
        Task { await mosques.refreshIfStale() }
        Task { await hijriCalendar.refreshIfStale() }
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
                    coordinates: coords,
                    district: mark.subAdministrativeArea)
                self.adopt(gps: place)
            }
        }
    }

    private func adopt(gps place: Place) {
        gpsPlace = place
        if prefs.useGPS { arrived(at: place) }
        refreshOfficialTimetable()
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
        refreshOfficialTimetable()
        scheduleNotifications()
    }

    // MARK: Notifications

    func scheduleNotifications() {
        guard let place = activePlace else { return }
        var alerts: [NotificationScheduler.Alert] = []
        let early = prefs.reminderMinutesBefore
        let here = place.isInAsia ? "\(place.name) \(place.profile.flag)" : place.name
        // iOS keeps at most 64 pending; early reminders double the count.
        for offset in 0..<(early > 0 ? 6 : 12) {
            guard let pd = day(containing: Date.now.addingTimeInterval(Double(offset) * 86_400)) else { continue }
            for prayer in Prayer.allCases where prefs.notifyPrayers.contains(prayer) {
                let time = pd.time(prayer)
                let name = prayer.name(naming, isFriday: isFriday(time))
                let id = "\(pd.year)-\(pd.month)-\(pd.day)-\(prayer.rawValue)"
                if prayer == .sunrise {
                    alerts.append(.init(id: id, title: "\(name) · \(formatted(time))",
                                        body: "\(Prayer.fajr.name(naming)) has ended. \(here)", fireDate: time))
                    continue
                }
                alerts.append(.init(id: id, title: "\(name) · \(formatted(time))",
                                    body: "It's time for \(name) in \(here)", fireDate: time))
                if early > 0 {
                    alerts.append(.init(id: id + "-early", title: "\(name) in \(early) min",
                                        body: "\(name) at \(formatted(time)) · \(here)",
                                        fireDate: time.addingTimeInterval(Double(-early) * 60)))
                }
            }
        }
        // Subuh wake-up: a real alarm (AlarmKit, iOS 26+) where possible,
        // otherwise a notification.
        var wakeUps: [(Date, String)] = []
        if let timing = prefs.wakeUp {
            for offset in 0..<7 {
                guard let pd = day(containing: Date.now.addingTimeInterval(Double(offset) * 86_400)) else { continue }
                let fajr = Prayer.fajr.name(naming)
                wakeUps.append((timing.date(in: pd), "Wake up for \(fajr) · ends \(formatted(pd.time(.sunrise)))"))
            }
        }
        let notificationAlerts = alerts
        let notificationsOn = prefs.notificationsEnabled
        Task {
            let alarmsHandled = await WakeUpAlarm.schedule(wakeUps)
            var all = notificationsOn ? notificationAlerts : []
            if !alarmsHandled {
                all += wakeUps.map {
                    NotificationScheduler.Alert(id: "wake-\(Int($0.0.timeIntervalSince1970))", title: $0.1,
                                                body: place.name, fireDate: $0.0)
                }
            }
            NotificationScheduler.reschedule(enabled: !all.isEmpty, alerts: all)
        }
        WidgetBridge.publish(self)
    }
}
