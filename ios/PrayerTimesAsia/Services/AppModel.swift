import CoreLocation
import Foundation
import Observation
import SwiftUI

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
    /// Journey opens as a sheet (from Settings or the musafir chip).
    var showJourney = false
    /// Wake up for Subuh (the alarm chip on the Prayer screen, or Settings).
    var showWakeUp = false
    /// "Welcome back" after a reinstall brought the settings back.
    var showWelcomeBack = false
    /// A masjid from a screen's QR code, waiting for the user to say yes.
    var pendingMasjid: MasjidLink?

    /// `settings` is not a tab; `-tab settings` opens the Settings sheet.
    enum Tab: String, Hashable { case today, qibla, falak, nearby, journey, wakeup, settings }

    @ObservationIgnored private let geocoder = CLGeocoder()
    @ObservationIgnored private var lastGeocoded: CLLocation?

    init() {
        prefs = Preferences.load()
        if let demo = Self.demoPreferences() { prefs = demo }
        if Preferences.didRestore, !Self.isDemo {
            // A reinstall: settings came back from the keychain. Ask again for
            // what iOS forgets when an app is deleted.
            showWelcomeBack = true
            if prefs.useGPS { location.requestPermission() }
            if prefs.notificationsEnabled || prefs.anyAlarm {
                Task { _ = await NotificationScheduler.requestPermission(); scheduleNotifications() }
            }
        }
        if ProcessInfo.processInfo.arguments.contains("-masjid-link") { pendingMasjid = Self.demoMasjid }
    }

    /// For screenshots only: a made-up masjid in Pasir Ris with typical iqamah gaps.
    static let demoMasjid = MasjidLink(
        name: "Example Masjid, Pasir Ris", lat: 1.3735, lng: 103.9490, tz: "Asia/Singapore", cc: "SG",
        jamaah: ["fajr": .init(after: 15), "dhuhr": .init(after: 10), "asr": .init(after: 10),
                 "maghrib": .init(after: 5), "isha": .init(after: 10)],
        jumuah: "13:00")

    // MARK: Your masjid

    /// prayertimesasia://masjid?... from a masjid screen's QR code (or the web app's "Open in the app").
    func open(url: URL) {
        guard url.scheme == "prayertimesasia", let link = MasjidLink.parse(url.absoluteString) else { return }
        pendingMasjid = link
    }

    func followPendingMasjid() {
        if let link = pendingMasjid { prefs.myMasjid = link }
        pendingMasjid = nil
    }

    func forgetMasjid() { prefs.myMasjid = nil }

    /// Your masjid, when the place shown is within reach of it (not while travelling).
    var myMasjidHere: MasjidLink? {
        guard let m = prefs.myMasjid, let place = activePlace,
              Geo.distanceKm(m.coordinates, place.coordinates) <= MasjidLink.radiusKm else { return nil }
        return m
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
        p.homeConfirmed = true
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
        p.appearance = args.contains("-light") ? .light : args.contains("-auto") ? .system : .dark
        p.todayStyle = args.contains("-dial") ? .dial : args.contains("-sunpath") ? .sunPath : args.contains("-centre") ? .centre : args.contains("-bands") ? .bands : args.contains("-sidedial") ? .list : .centre
        if args.contains("-masjid") { p.myMasjid = demoMasjid }
        // -arrival: the Welcome card at home too (as after a reinstall).
        if args.contains("-arrival") { p.arrivalBannerDismissed = false }
        if args.contains("-largetext") { p.largeText = true }
        // -season ramadan (or sighting, lastTen, raya, syawal): the tester's Ramadan preview.
        if let i = args.firstIndex(of: "-season"), i + 1 < args.count, let season = SeasonPreview(rawValue: args[i + 1]) {
            p.seasonPreview = season
            p.khatamPlan = season == .ramadan || season == .lastTen
            let back = [SeasonPreview.ramadan: 11, .lastTen: 25, .raya: 30, .syawal: 37][season] ?? 0
            for i in stride(from: 1, through: min(back, 30), by: 1) {
                let c = cal.dateComponents([.year, .month, .day], from: Date.now.addingTimeInterval(Double(-i) * 86_400))
                let key = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
                if season == .syawal && i < 7 { if i == 2 || i == 4 { p.fastLog[key] = .syawal }; continue }
                p.fastLog[key] = [7, 8].contains(back - i + 1) ? .period : (back - i + 1) == 14 ? .travel : .fasted
            }
        }
        if args.contains("-wake") {
            p.wakeUp = .fajrMinus30
            p.sahurAlarm = .fajrMinus90
            p.sahurDays = [.ramadan, .monThu]
            p.asrAlarm = .plus10
            p.ishaAlarm = .atStart
            p.alarmSound = .chime
        }
        if args.contains("-demo-visitor") {
            // A visitor from Sydney in Kuala Lumpur: International names, Malay underneath.
            p.home = Place(name: "Sydney", region: nil, countryCode: "AU", countryName: "Australia",
                           timeZoneID: "Australia/Sydney", coordinates: Coordinates(latitude: -33.8688, longitude: 151.2093))
            p.homeConfirmed = true
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
            p.musafirEnabled = true
        }
        if args.contains("-demo-travel") {
            let hanoi = Place(name: "Hoàn Kiếm", region: "Hanoi", countryCode: "VN", countryName: "Vietnam",
                              timeZoneID: "Asia/Ho_Chi_Minh", coordinates: Coordinates(latitude: 21.0285, longitude: 105.8542))
            p.manualPlace = hanoi
            p.lastCountryCode = "VN"
            p.musafirEnabled = true
            p.arrivedAt = .now
            p.musafirChipDismissed = false
            p.arrivalBannerDismissed = false
            p.trip = [TripStop(countryCode: "VN", countryName: "Vietnam", placeName: "Hoàn Kiếm", arrived: .now),
                      TripStop(countryCode: "SG", countryName: "Singapore", placeName: "Pasir Ris",
                               arrived: .now.addingTimeInterval(-86_400 * 30))]
        }
        return p
    }

    /// The sky right now, shared by every tab; moved on once a minute by `tickSky()`.
    private(set) var skyNow: SkyColors = .night
    /// Between Maghrib and sunrise; nil until today's times are known.
    private(set) var isNightNow: Bool?

    func tickSky(_ date: Date = .now) {
        let day = day(containing: date)
        let sky = day.map { SkyColors.at(date, day: $0) } ?? .night
        if sky != skyNow { skyNow = sky }
        let night = day.map { date < $0.time(.sunrise) || date >= $0.time(.maghrib) }
        if night != isNightNow { isNightNow = night }
    }

    /// Light or Dark as chosen; Automatic follows the sky - light from sunrise
    /// to Maghrib, the soft night after (nil: follow the phone until we know the times).
    var colorScheme: ColorScheme? {
        switch prefs.appearance {
        case .light: .light
        case .dark: .dark
        case .system: isNightNow.map { $0 ? .dark : .light }
        }
    }

    /// Applies a `-tab <name>` launch argument once the UI is up (screenshots).
    func applyDemoTab() {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-tab"), i + 1 < args.count, let tab = Tab(rawValue: args[i + 1]) {
            if tab == .journey { showJourney = true } else if tab == .wakeup { showWakeUp = true } else { selectedTab = tab }
        }
    }

    // MARK: Where and which rules

    var activePlace: Place? { prefs.useGPS ? (gpsPlace ?? prefs.manualPlace) : prefs.manualPlace }

    var profile: CountryProfile { activePlace?.profile ?? AsiaRegions.fallback }

    var method: CalculationMethod {
        prefs.methodOverrideID.flatMap(CalculationMethod.with(id:)).map(profile.here) ?? profile.method
    }

    var isMethodAutomatic: Bool { prefs.methodOverrideID == nil }
    /// Whose times these are, in plain words (official timetable, the authority's method, or a standard one).
    var sourceSummary: String { profile.sourceSummary(method: method, pinned: !isMethodAutomatic) }
    /// The same in one sentence or two, for the welcome card.
    var sourceShort: String { profile.sourceSummary(method: method, pinned: !isMethodAutomatic, short: true) }
    var asrSchool: AsrSchool { prefs.asrOverride ?? profile.asr }
    /// Your prayer names, from your phone's language (English unless it has
    /// names in it), not from where you are, so they stay the same as you travel.
    var naming: NamingStyle { prefs.namingOverride ?? personalNaming }
    var personalNaming: NamingStyle { NamingStyle.personal() }
    /// The words used where you are (the masjid's signs, the azan app locals use).
    var localNaming: NamingStyle { profile.naming }

    /// The local word for a prayer, when it differs from yours.
    func localName(_ prayer: Prayer, at time: Date) -> String? {
        guard prefs.showLocalNames, localNaming != naming else { return nil }
        // At home you already know the local words; the hint is for travel.
        if let home = prefs.home?.countryCode, home == profile.code { return nil }
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

    /// Nil until home is set and the user has said it is home, so a guessed
    /// home never tells anyone they are a traveller (or at home) by mistake.
    var musafirStatus: Musafir.Status? {
        guard let place = activePlace, prefs.homeConfirmed else { return nil }
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
        // Jamaah: your own masjid first, else a published masjid profile here.
        if let jamaahFrom = myMasjidHere?.profile ?? mosque {
            result.mosqueName = jamaahFrom.name
            result.jamaah = jamaahFrom.jamaahTimes(for: result, timeZone: place.timeZone, isFriday: isFriday(result.time(.dhuhr)))
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

    /// The prayer open now and when its time runs out; nil between sunrise and Zohor.
    func window(at now: Date) -> PrayerWindow? {
        guard let today = day(containing: now),
              let yesterday = day(containing: now.addingTimeInterval(-86_400)),
              let tomorrow = day(containing: now.addingTimeInterval(86_400)) else { return nil }
        return PrayerWindow.open(at: now, yesterday: yesterday, today: today, tomorrow: tomorrow)
    }

    /// A time of day given as minutes past midnight, "11:00 PM" or "23:00".
    func clock(_ minutes: Int) -> String {
        let h = (minutes / 60) % 24, m = String(format: "%02d", minutes % 60)
        if prefs.use24Hour { return String(format: "%02d", h) + ":" + m }
        return "\(h % 12 == 0 ? 12 : h % 12):\(m) \(h < 12 ? "AM" : "PM")"
    }

    /// Minutes past local midnight at the active place.
    private func minuteOfDay(_ date: Date) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.hour, .minute], from: date)
        return c.hour! * 60 + c.minute!
    }

    func inQuietHours(_ date: Date) -> Bool {
        PrayerWindow.inQuietHours(minuteOfDay(date), from: prefs.quietFrom, to: prefs.quietTo)
    }

    /// Quiet hours and "Buzz only". Subuh always keeps its sound: it is a wake up.
    func isSilent(_ date: Date, prayer: Prayer) -> Bool {
        if prefs.buzzOnly { return true }
        if prayer == .fajr { return false }
        return prefs.quietHours && inQuietHours(date)
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

    func isExcused(_ date: Date) -> Bool { isExcused(key: dayKey(date)) }

    /// Marked excused on its own, or inside a pause (from the day it began up to today).
    func isExcused(key: String) -> Bool {
        if prefs.excusedDays.contains(key) { return true }
        guard let since = prefs.trackerPausedSince else { return false }
        return key >= since && key <= dayKey(.now)
    }

    /// How a day went: prayers ticked and whether it was excused.
    func trackerDay(_ key: String) -> (prayed: Int, excused: Bool) {
        ((prefs.prayedLog[key] ?? []).intersection(Prayer.obligatory).count, isExcused(key: key))
    }

    var trackerPaused: Bool { prefs.trackerPausedSince != nil }

    /// Pause for haid, nifas or illness: today and every day until it's ended
    /// count as excused, so the streak waits.
    func pauseTracker(_ date: Date = .now) { prefs.trackerPausedSince = dayKey(date) }

    /// End the pause: the paused days are kept as excused days, today included.
    func endTrackerPause(_ date: Date = .now) {
        guard let since = prefs.trackerPausedSince else { return }
        prefs.excusedDays.formUnion(Self.days(from: since, to: dayKey(date)))
        prefs.trackerPausedSince = nil
    }

    /// Every "yyyy-MM-dd" from `from` to `to`, both included (at most a year).
    nonisolated static func days(from: String, to: String) -> [String] {
        let parts = from.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return [] }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        guard let start = cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return [] }
        var out: [String] = []
        for i in 0..<366 {
            let c = cal.dateComponents([.year, .month, .day], from: cal.date(byAdding: .day, value: i, to: start)!)
            let key = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
            if key > to { break }
            out.append(key)
        }
        return out
    }

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
            let complete = isExcused(key: key) || (prefs.prayedLog[key]?.count ?? 0) >= Prayer.obligatory.count
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
        a.trackerPausedSince = nil; b.trackerPausedSince = nil
        a.hiddenHadith = []; b.hiddenHadith = []
        a.fastLog = [:]; b.fastLog = [:]
        a.tarawihLog = []; b.tarawihLog = []
        a.quranLog = []; b.quranLog = []
        a.zakatPaid = []; b.zakatPaid = []
        guard a != b else {
            // ...unless a nudge is waiting on that tick (or the pause) to be dropped.
            if prefs.trackerEnabled && prefs.windowNudge { scheduleNotifications() }
            return
        }
        refreshOfficialTimetable()
        scheduleNotifications()
    }

    func appBecameActive() {
        location.refresh()
        refreshOfficialTimetable()
        Task { await mosques.refreshIfStale() }
        Task {
            let h = hijri(of: .now)
            await hijriCalendar.refreshIfStale(soon: (h.month == 8 || h.month == 9) && h.day >= 28)
        }
        scheduleNotifications()
        countOpen()
    }

    /// Anonymous count of this open, a few seconds in so the GPS place has usually arrived.
    private func countOpen() {
        guard prefs.shareUsage, prefs.hasOnboarded, !Self.isDemo else { return }
        Task {
            try? await Task.sleep(for: .seconds(8))
            guard prefs.shareUsage else { return }
            UsageCounter.countOpen(place: activePlace)
        }
    }

    private static var isDemo: Bool { ProcessInfo.processInfo.arguments.contains { $0.hasPrefix("-demo") || $0 == "-widget-preview" } }

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

    /// Home, picked by the user. Also counts as saying "this is home".
    func setHome(_ place: Place) {
        var p = prefs
        p.home = place
        p.homeConfirmed = true
        prefs = p
    }

    /// "Yes, this is home" for the home the app guessed.
    func confirmHome() { prefs.homeConfirmed = true }

    /// Travel mode: notice a new country, remember when we got here, show the welcome card.
    private func arrived(at place: Place) {
        var p = prefs
        if p.home == nil, place.countryCode != nil, place.name != "Current location" { p.home = place }
        if let code = place.countryCode, code != p.lastCountryCode {
            let isFirstEver = p.lastCountryCode == nil
            p.lastCountryCode = code
            p.arrivedAt = .now
            p.musafirChipDismissed = false
            p.arrivalBannerDismissed = isFirstEver
            p.trip.insert(TripStop(countryCode: code, countryName: place.countryName ?? code,
                                   placeName: place.name, arrived: .now), at: 0)
            if p.trip.count > 30 { p.trip.removeLast(p.trip.count - 30) }
        }
        prefs = p
        // Fetch this area's masjid list now, while there's signal, so the
        // Masjid tab works at once (and offline) later. Tiny, and only once a week.
        if !Self.isDemo {
            let coordinates = place.coordinates, country = place.countryCode
            Task { _ = await MasjidList.shared.download(near: coordinates, country: country) }
        }
        refreshOfficialTimetable()
        scheduleNotifications()
    }

    // MARK: Ramadan and Syawal

    /// The local calendar day containing `date`.
    func civil(_ date: Date) -> CivilDay { CivilDay(date, timeZone: timeZone) }

    var isSeasonPreview: Bool { prefs.seasonPreview != .off }

    /// Days the tester's "Try Ramadan" moves the calendar by (0 when off).
    var seasonShift: Int {
        let today = civil(.now)
        if let cached = shiftCache, cached.key == "\(today.key)-\(prefs.seasonPreview.rawValue)" { return cached.shift }
        let shift = Season.previewShift(today: today, preview: prefs.seasonPreview)
        shiftCache = ("\(today.key)-\(prefs.seasonPreview.rawValue)", shift)
        return shift
    }
    @ObservationIgnored private var shiftCache: (key: String, shift: Int)?

    /// The Hijri date of a civil day as this community counts it (Core/Season.swift).
    func hijri(of g: CivilDay) -> Hijri.HijriDate {
        if isSeasonPreview { return Season.baseHijri(g.adding(seasonShift)) }
        return Season.communityHijri(g, adjustment: prefs.hijriAdjustment, announcements: hijriCalendar.dataset.announcements, authority: communityAuthority)
    }

    func hijri(of date: Date) -> Hijri.HijriDate { hijri(of: civil(date)) }

    func hijriLabel(_ date: Date) -> String {
        let h = hijri(of: date)
        let name = naming.hijriMonths[max(0, min(11, h.month - 1))]
        let shown = naming.isRightToLeft ? "\u{2068}" + name + "\u{2069}" : name
        return "\(h.day) \(shown) \(h.year)"
    }

    func isRamadanDay(_ date: Date) -> Bool { hijri(of: date).month == 9 }

    func season(at date: Date) -> Season.Info {
        let h = hijri(of: date)
        var next: (event: HijriEvent, day: CivilDay, announced: Bool)?
        if !isSeasonPreview, h.day >= 27, h.month == 8 || h.month == 9 {
            let event: HijriEvent = h.month == 8 ? .ramadan : .syawal
            if let d = Season.authorityDate(hijriCalendar.dataset.announcements, authority: communityAuthority, event: event, hijriYear: h.year),
               civil(date).days(to: d.day) >= 0 {
                next = (event, d.day, d.announced)
            }
        }
        return Season.info(h, nextStart: next)
    }

    func day(of g: CivilDay) -> PrayerDay? { day(containing: g.noon(in: timeZone)) }

    /// Imsak: 10 minutes before Subuh, as MUIS, JAKIM and Kemenag publish it.
    func imsak(_ day: PrayerDay) -> Date { day.time(.fajr).addingTimeInterval(-600) }

    enum FastingMomentKind { case imsak, berbuka }
    /// In Ramadan, the moment to count down to: Imsak before dawn, Berbuka after it,
    /// then tomorrow's Imsak (if tomorrow is a fast).
    func fastingMoment(_ now: Date) -> (kind: FastingMomentKind, time: Date)? {
        guard let today = day(containing: now) else { return nil }
        if isRamadanDay(now) {
            if now < imsak(today) { return (.imsak, imsak(today)) }
            if now < today.time(.maghrib) { return (.berbuka, today.time(.maghrib)) }
        }
        if let tomorrow = day(containing: now.addingTimeInterval(86_400)), isRamadanDay(tomorrow.time(.dhuhr)) {
            return (.imsak, imsak(tomorrow))
        }
        return nil
    }

    /// Every civil day of a Hijri month for this community, from the 1st.
    func monthDays(hijriYear: Int, month: Int) -> [CivilDay] {
        guard let est = Season.gregorian(hijriYear: hijriYear, month: month, day: 1) else { return [] }
        let guess = est.adding(isSeasonPreview ? -seasonShift : 0)
        var first: CivilDay?
        for delta in [0, 1, -1, 2, -2, 3, -3] {
            let d = guess.adding(delta), h = hijri(of: d)
            if h.year == hijriYear && h.month == month && h.day == 1 { first = d; break }
        }
        guard let first else { return [] }
        var out: [CivilDay] = []
        for i in 0..<30 {
            let d = first.adding(i)
            if hijri(of: d).month != month { break }
            out.append(d)
        }
        return out
    }

    struct FastSummary { var days: [CivilDay]; var fasted: Int; var missed: Int; var replaced: Int; var owed: Int; var syawal: Int }

    /// This Ramadan's fasts: kept, missed and still to replace, and Syawal fasts.
    func fastSummary(hijriYear: Int) -> FastSummary {
        let days = monthDays(hijriYear: hijriYear, month: 9)
        let today = civil(.now).key
        var fasted = 0, missed = 0
        for d in days where d.key <= today {
            switch prefs.fastLog[d.key] {
            case .fasted?: fasted += 1
            case let m? where m.isMissed: missed += 1
            default: break
            }
        }
        let after = days.last?.key ?? today
        let until = monthDays(hijriYear: hijriYear + 1, month: 9).first?.key ?? "9999"
        let syawalDays = Set(monthDays(hijriYear: hijriYear, month: 10).map(\.key))
        var replaced = 0, syawal = 0
        for (k, m) in prefs.fastLog where k > after && k < until {
            if m == .qadha { replaced += 1 }
            if m == .syawal && syawalDays.contains(k) { syawal += 1 }
        }
        return FastSummary(days: days, fasted: fasted, missed: missed, replaced: replaced, owed: max(0, missed - replaced), syawal: syawal)
    }

    func setFast(_ key: String, _ mark: FastMark?) {
        prefs.fastLog[key] = mark
        if prefs.fastLog.count > 800, let oldest = prefs.fastLog.keys.min() { prefs.fastLog[oldest] = nil }
    }

    /// Raya prayer time at your masjid, when its screen has one.
    var eidPrayer: String? { myMasjidHere?.eid }

    /// Ramadan's own alerts: Imsak (10 minutes before), Berbuka at Maghrib, qiyam in the last ten nights.
    private func ramadanAlerts(_ pd: PrayerDay, here: String, maghribAlertOn: Bool) -> [NotificationScheduler.Alert] {
        var out: [NotificationScheduler.Alert] = []
        let id = "\(pd.year)-\(pd.month)-\(pd.day)"
        let s = season(at: pd.time(.dhuhr))
        if s.phase == .ramadan {
            if prefs.imsakAlert {
                out.append(.init(id: id + "-imsak", title: "Imsak in 10 minutes · \(formatted(imsak(pd)))",
                                 body: "Finish your sahur. Subuh at \(formatted(pd.time(.fajr))) · \(here)",
                                 fireDate: imsak(pd).addingTimeInterval(-600), silent: isSilent(imsak(pd), prayer: .fajr)))
            }
            if prefs.berbukaAlert && !maghribAlertOn {
                out.append(.init(id: id + "-berbuka", title: "Time to berbuka · \(formatted(pd.time(.maghrib)))",
                                 body: "Allahumma laka sumtu wa bika amantu wa 'ala rizqika aftartu. Ramadan day \(s.ramadanDay ?? 0) · \(here)",
                                 fireDate: pd.time(.maghrib), silent: isSilent(pd.time(.maghrib), prayer: .maghrib)))
            }
        }
        if prefs.qiyamAlert, s.lastTen, let night = s.nightTonight, let next = day(containing: pd.time(.dhuhr).addingTimeInterval(86_400)),
           let place = activePlace,
           let last = BlessedTime.compute(day: pd, nextDay: next, coordinates: place.coordinates, isRamadan: false).first(where: { $0.0 == .lastThird }) {
            out.append(.init(id: id + "-qiyam", title: "Night \(night) · the last third has begun",
                             body: s.oddNight ? "An odd night of the last ten. Seek Lailatul Qadr." : "One of the last ten nights of Ramadan.",
                             fireDate: last.1, silent: isSilent(last.1, prayer: .isha)))
        }
        return out
    }

    // MARK: Notifications

    func scheduleNotifications() {
        guard let place = activePlace else { return }
        var alerts: [NotificationScheduler.Alert] = []
        let early = prefs.reminderMinutesBefore
        let onTime = prefs.notificationsEnabled
        let nudges = prefs.trackerEnabled && prefs.windowNudge && !trackerPaused
        let jumuah = prefs.jumuahReminderMinutes
        let here = place.isInAsia ? "\(place.name) \(place.profile.flag)" : place.name
        let maghribAlertOn = onTime && prefs.notifyPrayers.contains(.maghrib)
        // Settings, Hadith: one line under each prayer alert.
        let hadithLine = prefs.hadithInAlerts ? "\n" + Hadith.of(.azan).alertLine(RamadanContent.lang(naming)) : ""
        var ramadan: [NotificationScheduler.Alert] = []
        // iOS keeps at most 64 pending, so fewer days when there are more alerts a day.
        let perDay = (onTime ? 6 : 0) + (early > 0 ? 6 : 0) + (nudges ? 4 : 0) + (jumuah > 0 ? 1 : 0)
        let days = max(2, min(12, 60 / max(perDay, 1)))
        for offset in -1..<days {
            guard let pd = day(containing: Date.now.addingTimeInterval(Double(offset) * 86_400)) else { continue }
            if nudges, let next = day(containing: pd.time(.dhuhr).addingTimeInterval(86_400)) {
                for w in PrayerWindow.windows(of: pd, next: next) where prefs.notifyPrayers.contains(w.prayer) {
                    // Already ticked or excused: no nudge (ticking reschedules).
                    if isPrayed(w.prayer, on: w.start) || isExcused(w.start) { continue }
                    // Open until Subuh: a nudge then would only disturb sleep.
                    if w.prayer == .isha { continue }
                    let at = w.nudgeAt
                    let name = w.prayer.name(naming, isFriday: isFriday(w.start))
                    let left = Int((w.end.timeIntervalSince(at) / 60).rounded())
                    alerts.append(.init(
                        id: "\(pd.year)-\(pd.month)-\(pd.day)-\(w.prayer.rawValue)-nudge",
                        title: "\(name) time ends in \(left) min",
                        body: "\(name) is open until \(formatted(w.end)). Tick it in the app once you have prayed.",
                        fireDate: at, silent: isSilent(at, prayer: w.prayer)))
                }
            }
            guard offset >= 0 else { continue }
            if offset < 6 { ramadan += ramadanAlerts(pd, here: here, maghribAlertOn: maghribAlertOn) }
            if jumuah > 0 && isFriday(pd.time(.dhuhr)) {
                let start = pd.jamaah[.dhuhr] ?? pd.time(.dhuhr)
                let at = start.addingTimeInterval(Double(-jumuah) * 60)
                let name = Prayer.dhuhr.name(naming, isFriday: true)
                let where_ = pd.jamaah[.dhuhr] != nil ? pd.mosqueName.map { " at \($0)" } ?? "" : ""
                alerts.append(.init(id: "\(pd.year)-\(pd.month)-\(pd.day)-jumuah", title: "\(name) in \(jumuah) min",
                                    body: "Time to get ready and leave for \(name)\(where_), \(formatted(start)).",
                                    fireDate: at, silent: isSilent(at, prayer: .dhuhr)))
            }
            for prayer in Prayer.allCases where prefs.notifyPrayers.contains(prayer) {
                let time = pd.time(prayer)
                let name = prayer.name(naming, isFriday: isFriday(time))
                let id = "\(pd.year)-\(pd.month)-\(pd.day)-\(prayer.rawValue)"
                let silent = isSilent(time, prayer: prayer)
                if early > 0 {
                    // The heads-up before the prayer, on its own switch: for when a
                    // meeting or work would otherwise run past the time.
                    let title = prayer == .sunrise ? "\(Prayer.fajr.name(naming)) ends in \(early) min" : "\(name) in \(early) min"
                    let at = time.addingTimeInterval(Double(-early) * 60)
                    alerts.append(.init(id: id + "-early", title: title,
                                        body: "\(name) at \(formatted(time)) · \(here)",
                                        fireDate: at, silent: isSilent(at, prayer: prayer)))
                }
                guard onTime else { continue }
                // An alarm at the same minute rings instead, so it doesn't sound twice.
                if prefs.alarmAtStart(prayer) { continue }
                if prayer == .sunrise {
                    alerts.append(.init(id: id, title: "\(name) · \(formatted(time))",
                                        body: "\(Prayer.fajr.name(naming)) has ended. \(here)", fireDate: time, silent: silent))
                    continue
                }
                if prayer == .maghrib && isRamadanDay(time) {
                    alerts.append(.init(id: id, title: "Time to berbuka · \(name) \(formatted(time))",
                                        body: "Allahumma laka sumtu wa bika amantu wa 'ala rizqika aftartu · \(here)", fireDate: time,
                                        sound: prefs.azanSound ? .azan : .standard, silent: silent))
                    continue
                }
                alerts.append(.init(id: id, title: "\(name) · \(formatted(time))",
                                    body: "It's time for \(name) in \(here)\(hadithLine)", fireDate: time,
                                    sound: prefs.azanSound ? (prayer == .fajr ? .azanSubuh : .azan) : .standard, silent: silent))
            }
        }
        // Subuh wake-up: a real alarm (AlarmKit, iOS 26+) where possible,
        // otherwise a notification.
        // Subuh and sahur a week ahead (sahur may be days away); the other
        // prayers' alarms three days ahead, which the app refreshes on every open.
        let plan = wakeUpPlan(from: .now, days: 7)
        let soon = Date.now.addingTimeInterval(3 * 86_400)
        let wakeUps = plan.filter { $0.prayer == nil || $0.date < soon }.map { ($0.date, $0.title) }
        let sound = prefs.alarmSound
        let notificationAlerts = ramadan + alerts
        let notificationsOn = onTime || early > 0 || nudges || jumuah > 0 || !ramadan.isEmpty
        // Demo screenshots never ask for alarm permission.
        let isDemo = ProcessInfo.processInfo.arguments.contains { $0.hasPrefix("-demo") }
        Task {
            let alarmsHandled = isDemo ? true : await WakeUpAlarm.schedule(wakeUps, sound: sound)
            var all = notificationsOn ? notificationAlerts : []
            if !alarmsHandled {
                all += wakeUps.map {
                    NotificationScheduler.Alert(id: "wake-\(Int($0.0.timeIntervalSince1970))", title: $0.1,
                                                body: place.name, fireDate: $0.0, sound: .alarm(sound))
                }
            }
            NotificationScheduler.reschedule(enabled: !all.isEmpty, alerts: all)
        }
        WidgetBridge.publish(self)
    }

    /// One alarm: the Subuh alarm, the earlier sahur alarm, or another prayer's.
    struct WakeUp: Equatable {
        let date: Date
        let title: String
        let isSahur: Bool
        /// The prayer, for the other four prayers' alarms.
        var prayer: Prayer? = nil
    }

    /// The next wake-up or sahur alarm, looking a week ahead (the sahur alarm
    /// may be days away). Stops at the first day that has one.
    func nextWakeUp(after now: Date) -> WakeUp? {
        guard prefs.anyAlarm else { return nil }
        for offset in 0..<8 {
            if let first = wakeUpPlan(from: now, days: 1, startingAt: offset).first { return first }
        }
        return nil
    }

    /// The wake-up and sahur alarms for the next `days` days, soonest first.
    func wakeUpPlan(from now: Date, days: Int, startingAt start: Int = 0) -> [WakeUp] {
        guard prefs.anyAlarm else { return [] }
        let fajr = Prayer.fajr.name(naming)
        var out: [WakeUp] = []
        for offset in start..<(start + days) {
            guard let pd = day(containing: now.addingTimeInterval(Double(offset) * 86_400)) else { continue }
            if let sahur = prefs.sahurAlarm,
               SahurDay.rings(on: pd, prefs.sahurDays, timeZone: timeZone, hijriAdjustment: prefs.hijriAdjustment) {
                out.append(WakeUp(date: sahur.date(in: pd), title: "Wake up for sahur · \(fajr) at \(formatted(pd.time(.fajr)))", isSahur: true))
            }
            if let timing = prefs.wakeUp {
                let title = timing == .fajrMinus30
                    ? "Wake up for tahajjud · \(fajr) at \(formatted(pd.time(.fajr)))"
                    : "Wake up for \(fajr) · ends \(formatted(pd.time(.sunrise)))"
                out.append(WakeUp(date: timing.date(in: pd), title: title, isSahur: false))
            }
            for prayer in PrayerAlarmTiming.prayers {
                guard let timing = prefs.alarm(for: prayer) else { continue }
                let start = pd.time(prayer)
                let end = PrayerAlarmTiming.end(of: prayer, in: pd)
                let name = prayer.name(naming, isFriday: isFriday(start))
                let title = timing == .endMinus30
                    ? "\(name) ends in 30 min · \(formatted(end))"
                    : prayer == .isha ? "Time for \(name) · \(formatted(start))" : "Time for \(name) · open until \(formatted(end))"
                out.append(WakeUp(date: timing.date(start: start, end: end), title: title, isSahur: false, prayer: prayer))
            }
        }
        var seen = Set<Date>()
        return out.filter { $0.date > now && seen.insert($0.date).inserted }.sorted { $0.date < $1.date }
    }
}
