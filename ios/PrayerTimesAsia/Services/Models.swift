import Foundation

struct Place: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var name: String
    var region: String?
    var countryCode: String?
    var countryName: String?
    var timeZoneID: String
    var coordinates: Coordinates
    /// Regency / city level (Apple's subAdministrativeArea), e.g. "Kota Bandung".
    /// Used to find the Kemenag timetable in Indonesia.
    var district: String? = nil

    var timeZone: TimeZone { TimeZone(identifier: timeZoneID) ?? .current }
    var profile: CountryProfile { AsiaRegions.profile(for: countryCode) ?? AsiaRegions.fallback }
    var isInAsia: Bool { AsiaRegions.profile(for: countryCode) != nil }

    var subtitle: String {
        [region, countryName].compactMap { $0 }.filter { $0 != name }.joined(separator: ", ")
    }

    /// Same spot for our purposes (prayer times differ by < 1 min within ~15 km).
    func isNear(_ other: Place) -> Bool {
        Geo.distanceKm(coordinates, other.coordinates) < 2
    }
}

struct TripStop: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var countryCode: String
    var countryName: String
    var placeName: String
    var arrived: Date
}

/// When the Subuh wake-up alarm rings, relative to Subuh or Syuruk.
/// Declared in the order of the night, so the list reads earliest first.
enum WakeUpTiming: String, Codable, CaseIterable, Identifiable, Sendable {
    case fajrMinus30
    case atFajr, fajrPlus5, fajrPlus10, fajrPlus15, fajrPlus30
    case sunriseMinus60, sunriseMinus45, sunriseMinus30, sunriseMinus15

    var id: String { rawValue }

    /// The heading each choice sits under in the list.
    enum Part: CaseIterable { case beforeFajr, fromFajr, beforeSunrise }
    var group: Part {
        switch self {
        case .fajrMinus30: .beforeFajr
        case .atFajr, .fajrPlus5, .fajrPlus10, .fajrPlus15, .fajrPlus30: .fromFajr
        case .sunriseMinus60, .sunriseMinus45, .sunriseMinus30, .sunriseMinus15: .beforeSunrise
        }
    }

    /// Minutes from Subuh (or before Syuruk for the Syuruk group).
    private var minutes: Int {
        switch self {
        case .fajrMinus30: -30
        case .atFajr: 0
        case .fajrPlus5: 5
        case .fajrPlus10: 10
        case .fajrPlus15: 15
        case .fajrPlus30: 30
        case .sunriseMinus60: 60
        case .sunriseMinus45: 45
        case .sunriseMinus30: 30
        case .sunriseMinus15: 15
        }
    }

    func label(_ naming: NamingStyle) -> String {
        let fajr = Prayer.fajr.name(naming), sunrise = Prayer.sunrise.name(naming)
        switch self {
        case .fajrMinus30: return "30 min before \(fajr) for tahajjud"
        case .atFajr: return "At \(fajr)"
        case .sunriseMinus60: return "1 hour before \(sunrise)"
        default:
            return group == .beforeSunrise ? "\(minutes) min before \(sunrise)" : "\(minutes) min after \(fajr) begins"
        }
    }

    func date(in day: PrayerDay) -> Date {
        if group == .beforeSunrise {
            // Where Subuh to Syuruk is short, never ring before Subuh has begun.
            return max(day.time(.fajr), day.time(.sunrise).addingTimeInterval(Double(-minutes) * 60))
        }
        return day.time(.fajr).addingTimeInterval(Double(minutes) * 60)
    }
}

/// The second, earlier alarm for sahur (or a longer qiyam), before Subuh.
enum SahurTiming: String, Codable, CaseIterable, Identifiable, Sendable {
    case fajrMinus60, fajrMinus90, fajrMinus120

    var id: String { rawValue }
    var minutes: Int {
        switch self {
        case .fajrMinus60: 60
        case .fajrMinus90: 90
        case .fajrMinus120: 120
        }
    }

    func label(_ naming: NamingStyle) -> String {
        let fajr = Prayer.fajr.name(naming)
        switch self {
        case .fajrMinus60: return "1 hour before \(fajr)"
        case .fajrMinus90: return "1 hour 30 min before \(fajr)"
        case .fajrMinus120: return "2 hours before \(fajr)"
        }
    }

    func date(in day: PrayerDay) -> Date { day.time(.fajr).addingTimeInterval(Double(-minutes) * 60) }
}

/// Alarms for the other four prayers (Subuh has `WakeUpTiming`): for heavy
/// sleepers, a nap before Asar, or someone who keeps putting a prayer off.
enum PrayerAlarmTiming: String, Codable, CaseIterable, Identifiable, Sendable {
    case atStart, plus5, plus10, plus15, plus30, endMinus30

    var id: String { rawValue }
    static let prayers: [Prayer] = [.dhuhr, .asr, .maghrib, .isha]

    /// The choices for one prayer. Isyak is open until Subuh, so it has no "before it ends".
    static func choices(for prayer: Prayer) -> [PrayerAlarmTiming] {
        prayer == .isha ? allCases.filter { $0 != .endMinus30 } : allCases
    }

    private var minutes: Int {
        switch self {
        case .atStart, .endMinus30: 0
        case .plus5: 5
        case .plus10: 10
        case .plus15: 15
        case .plus30: 30
        }
    }

    /// Short, as it sits in the row beside the prayer's name.
    var label: String {
        switch self {
        case .atStart: "On time"
        case .endMinus30: "30 min before it ends"
        default: "\(minutes) min after"
        }
    }

    /// When it rings, given the prayer's start and its end (the next prayer).
    func date(start: Date, end: Date) -> Date {
        // A short window (Maghrib far north): never before the prayer has begun.
        if self == .endMinus30 { return max(start, end.addingTimeInterval(-30 * 60)) }
        return start.addingTimeInterval(Double(minutes) * 60)
    }

    /// The prayer's end in this day: the next prayer (Isyak's own start; it has no "before it ends").
    static func end(of prayer: Prayer, in day: PrayerDay) -> Date {
        switch prayer {
        case .dhuhr: day.time(.asr)
        case .asr: day.time(.maghrib)
        default: day.time(.isha)
        }
    }
}

/// The sound every alarm plays. Classic is the phone's own alarm sound; the
/// others are our own tones in Resources/ (tools/make_alarm_sounds.py).
/// "phone" is a ringtone picked on Android; elsewhere it plays Classic.
enum AlarmSound: String, Codable, CaseIterable, Identifiable, Sendable {
    case classic, chime, bells, beeps, phone

    var id: String { rawValue }
    static let choices: [AlarmSound] = [.classic, .chime, .bells, .beeps]

    var label: String {
        switch self {
        case .classic: "Classic alarm"
        case .chime: "Gentle chime"
        case .bells: "Rising bells"
        case .beeps: "Soft beeps"
        case .phone: "From my phone"
        }
    }

    /// The file in the app, nil for the phone's own alarm sound.
    var fileName: String? {
        switch self {
        case .classic, .phone: nil
        default: "alarm-\(rawValue).caf"
        }
    }
}

/// Which mornings the sahur alarm rings: the days people usually fast.
enum SahurDay: String, Codable, CaseIterable, Identifiable, Sendable {
    case ramadan, monThu, whiteDays, everyDay

    var id: String { rawValue }
    var label: String {
        switch self {
        case .ramadan: "Ramadan"
        case .monThu: "Mondays and Thursdays"
        case .whiteDays: "White days (13, 14 and 15 of the Hijri month)"
        case .everyDay: "Every day"
        }
    }

    /// Does the sahur alarm ring before Subuh on this day?
    static func rings(on day: PrayerDay, _ days: Set<SahurDay>, timeZone: TimeZone, hijriAdjustment: Int) -> Bool {
        if days.contains(.everyDay) { return true }
        if days.contains(.monThu) {
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "UTC")!
            if let date = cal.date(from: DateComponents(year: day.year, month: day.month, day: day.day)) {
                let weekday = cal.component(.weekday, from: date)  // 1 = Sunday
                if weekday == 2 || weekday == 5 { return true }
            }
        }
        if days.contains(.ramadan) || days.contains(.whiteDays) {
            let h = Hijri.date(day.time(.dhuhr), timeZone: timeZone, adjustment: hijriAdjustment)
            if days.contains(.ramadan) && h.month == 9 { return true }
            // Not on 13 Zulhijjah, a day of Tashreeq when fasting is not allowed.
            if days.contains(.whiteDays) && (13...15).contains(h.day) && !(h.month == 12 && h.day == 13) { return true }
        }
        return false
    }
}

/// Light, dark, or follow the phone.
enum Appearance: String, Codable, CaseIterable, Identifiable, Sendable {
    case system, light, dark
    var id: String { rawValue }
    var label: String {
        switch self {
        case .system: "Automatic (follows the sky)"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

/// Everything the user chooses, persisted as one JSON blob. `nil` overrides
/// mean "automatic for the country I'm in" - the travel-mode behaviour.
struct Preferences: Codable, Equatable, Sendable {
    var hasOnboarded = false
    var useGPS = true
    var manualPlace: Place?
    var savedPlaces: [Place] = []
    var home: Place?
    /// The user said this is home (or picked it). Until then home is only the
    /// app's guess from where the phone first was, and Journey asks about it.
    var homeConfirmed = false

    var methodOverrideID: String?
    var asrOverride: AsrSchool?
    var namingOverride: NamingStyle?
    var use24Hour = false
    var hijriAdjustment = 0

    var notificationsEnabled = false
    var notifyPrayers: Set<Prayer> = Set(Prayer.obligatory)
    /// Minutes before each chosen prayer for the "Reminder before prayer"
    /// heads-up; 0 = off. Separate from the alert at the prayer time itself.
    var reminderMinutesBefore = 0
    static let defaultReminderMinutes = 15
    static let reminderChoices = [5, 10, 15, 20, 30, 45, 60]
    /// Prayer time alerts play the azan (a Subuh azan at Subuh) instead of the
    /// phone's alert sound, when the app has the recordings (see Azan.swift).
    var azanSound = true

    var musafirThresholdKm: Double = 81
    /// Pinned JAKIM zone; nil = nearest to where you are.
    var jakimZoneOverride: String?

    // Travel-mode memory
    var lastCountryCode: String?
    var arrivedAt: Date?
    var arrivalBannerDismissed = true
    /// The big "Musafir" line was closed for this trip; the luggage button stays with the other buttons. Reset on each new arrival.
    var musafirChipDismissed = false
    var trip: [TripStop] = []

    /// Keep a Live Activity countdown to the next prayer on the Lock Screen.
    var liveActivityEnabled = false

    // Prayer tracker (opt-in)
    var trackerEnabled = false
    /// "yyyy-MM-dd" (local date) → prayers marked as prayed.
    var prayedLog: [String: Set<Prayer>] = [:]
    /// Days excused (haid, illness, ...): they keep the streak alive.
    var excusedDays: Set<String> = []
    /// "yyyy-MM-dd" the tracker was paused (haid, nifas, illness); every day from
    /// then until the pause ends counts as excused. nil = not paused.
    var trackerPausedSince: String?

    /// Subuh wake-up alarm; nil = off.
    var wakeUp: WakeUpTiming?
    /// The earlier sahur alarm; nil = off. Rings only on `sahurDays`.
    var sahurAlarm: SahurTiming?
    var sahurDays: Set<SahurDay> = [.ramadan, .monThu]
    /// Alarms for the other prayers; nil = off.
    var dhuhrAlarm: PrayerAlarmTiming?
    var asrAlarm: PrayerAlarmTiming?
    var maghribAlarm: PrayerAlarmTiming?
    var ishaAlarm: PrayerAlarmTiming?
    /// The sound every alarm plays.
    var alarmSound: AlarmSound = .classic

    /// The alarm for one of the other four prayers.
    func alarm(for prayer: Prayer) -> PrayerAlarmTiming? {
        switch prayer {
        case .dhuhr: dhuhrAlarm
        case .asr: asrAlarm
        case .maghrib: maghribAlarm
        case .isha: ishaAlarm
        default: nil
        }
    }

    mutating func setAlarm(_ timing: PrayerAlarmTiming?, for prayer: Prayer) {
        switch prayer {
        case .dhuhr: dhuhrAlarm = timing
        case .asr: asrAlarm = timing
        case .maghrib: maghribAlarm = timing
        case .isha: ishaAlarm = timing == .endMinus30 ? nil : timing
        default: break
        }
    }

    /// Is any alarm on: Subuh, sahur or one of the other prayers?
    var anyAlarm: Bool {
        wakeUp != nil || sahurAlarm != nil || PrayerAlarmTiming.prayers.contains { alarm(for: $0) != nil }
    }

    /// An alarm at the very start of this prayer rings instead of its alert.
    func alarmAtStart(_ prayer: Prayer) -> Bool {
        prayer == .fajr ? wakeUp == .atFajr : alarm(for: prayer) == .atStart
    }

    /// Whose Ramadan/Eid dates you follow; nil = the authority of your home country.
    var communityAuthority: String?

    var appearance: Appearance = .system
    /// The Prayer screen style the user picked; nil until they pick one, so
    /// everyone starts on Centre Dial.
    var stylePick: TodayStyle?
    var todayStyle: TodayStyle {
        get { stylePick ?? .centre }
        set { stylePick = newValue }
    }
    /// The makers' own offers (Badal, NasarDigital) on the Prayer and Masjid screens.
    var showOffers = true
    /// Travel concessions (jamak, qasar) and the Journey screen. Off until the
    /// user turns it on - offered when they land in another country.
    var musafirEnabled = false
    /// Under each prayer, the word used where you are, when it differs from yours.
    var showLocalNames = true
    /// The "Turn on prayer alerts" bar on the Prayer screen was closed.
    var alertsPromptDismissed = false
    /// The masjid whose iqamah times show on the Prayer screen, from its screen's QR code.
    var myMasjid: MasjidLink?
    /// Anonymous usage counts (city and country, never coordinates). See UsageCounter.
    var shareUsage = true

    // Ramadan and Syawal
    /// For testers: pretend today is a day in Ramadan or Syawal. Never moved to another phone.
    var seasonPreview: SeasonPreview = .off
    /// "Imsak in 10 minutes" in Ramadan.
    var imsakAlert = true
    /// "Time to berbuka" at Maghrib in Ramadan.
    var berbukaAlert = true
    /// The last ten nights: a gentle alert at the last third of the night.
    var qiyamAlert = false
    /// A juz a day to finish the Quran in the month.
    var khatamPlan = false
    /// "yyyy-MM-dd" → how that day's fast went.
    var fastLog: [String: FastMark] = [:]
    /// Days Tarawih was prayed.
    var tarawihLog: Set<String> = []
    /// How many rakaat of Tarawih the user prays (8 or 20), for the counter; nil until they choose.
    var tarawihRakaat: Int?
    /// Days the day's juz was read.
    var quranLog: Set<String> = []
    /// Hijri years zakat fitrah was paid.
    var zakatPaid: Set<Int> = []
    /// Tracker users: one nudge before a prayer's time runs out, if it isn't ticked.
    var windowNudge = true
    /// Alerts only buzz between these minutes past midnight; Subuh keeps its sound.
    var quietHours = false
    var quietFrom = 23 * 60
    var quietTo = 6 * 60
    /// Every alert buzzes only, never a sound.
    var buzzOnly = false
    /// Bigger text everywhere, for older eyes.
    var largeText = false
    /// The moving opening screen. Off goes straight to the app; it still shows the first time.
    var showOpening = true
    /// Fridays: a reminder this many minutes before Jumaat (0 = off).
    var jumuahReminderMinutes = 0
    static let jumuahReminderChoices = [0, 20, 30, 45, 60, 90]
    /// Short hadith and ayat on some screens (Core/HadithContent.swift).
    var showHadith = true
    /// One hadith line under prayer alerts and the Subuh alarm.
    var hadithInAlerts = true
    /// Hadith closed with their ✕, by id. Turning Show hadith back on brings them all back.
    var hiddenHadith: [String] = []

    private static let key = "preferences.v1"

    init() {}

    /// Field-by-field with defaults, so adding a preference in an update never
    /// throws away the ones a user already set.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = Preferences()
        func v<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
            (try? c.decodeIfPresent(T.self, forKey: key)) ?? fallback
        }
        hasOnboarded = v(.hasOnboarded, d.hasOnboarded)
        useGPS = v(.useGPS, d.useGPS)
        manualPlace = v(.manualPlace, d.manualPlace)
        savedPlaces = v(.savedPlaces, d.savedPlaces)
        home = v(.home, d.home)
        homeConfirmed = v(.homeConfirmed, d.homeConfirmed)
        methodOverrideID = v(.methodOverrideID, d.methodOverrideID)
        asrOverride = v(.asrOverride, d.asrOverride)
        namingOverride = v(.namingOverride, d.namingOverride)
        use24Hour = v(.use24Hour, d.use24Hour)
        hijriAdjustment = v(.hijriAdjustment, d.hijriAdjustment)
        notificationsEnabled = v(.notificationsEnabled, d.notificationsEnabled)
        notifyPrayers = v(.notifyPrayers, d.notifyPrayers)
        reminderMinutesBefore = v(.reminderMinutesBefore, d.reminderMinutesBefore)
        azanSound = v(.azanSound, d.azanSound)
        musafirThresholdKm = v(.musafirThresholdKm, d.musafirThresholdKm)
        jakimZoneOverride = v(.jakimZoneOverride, d.jakimZoneOverride)
        lastCountryCode = v(.lastCountryCode, d.lastCountryCode)
        arrivedAt = v(.arrivedAt, d.arrivedAt)
        arrivalBannerDismissed = v(.arrivalBannerDismissed, d.arrivalBannerDismissed)
        musafirChipDismissed = v(.musafirChipDismissed, d.musafirChipDismissed)
        trip = v(.trip, d.trip)
        liveActivityEnabled = v(.liveActivityEnabled, d.liveActivityEnabled)
        trackerEnabled = v(.trackerEnabled, d.trackerEnabled)
        prayedLog = v(.prayedLog, d.prayedLog)
        excusedDays = v(.excusedDays, d.excusedDays)
        trackerPausedSince = v(.trackerPausedSince, d.trackerPausedSince)
        wakeUp = v(.wakeUp, d.wakeUp)
        sahurAlarm = v(.sahurAlarm, d.sahurAlarm)
        sahurDays = v(.sahurDays, d.sahurDays)
        dhuhrAlarm = v(.dhuhrAlarm, d.dhuhrAlarm)
        asrAlarm = v(.asrAlarm, d.asrAlarm)
        maghribAlarm = v(.maghribAlarm, d.maghribAlarm)
        ishaAlarm = v(.ishaAlarm, d.ishaAlarm)
        if ishaAlarm == .endMinus30 { ishaAlarm = nil }
        alarmSound = v(.alarmSound, d.alarmSound)
        communityAuthority = v(.communityAuthority, d.communityAuthority)
        appearance = v(.appearance, d.appearance)
        stylePick = v(.stylePick, d.stylePick)
        showOffers = v(.showOffers, d.showOffers)
        musafirEnabled = v(.musafirEnabled, d.musafirEnabled)
        showLocalNames = v(.showLocalNames, d.showLocalNames)
        alertsPromptDismissed = v(.alertsPromptDismissed, d.alertsPromptDismissed)
        myMasjid = v(.myMasjid, d.myMasjid)
        shareUsage = v(.shareUsage, d.shareUsage)
        seasonPreview = v(.seasonPreview, d.seasonPreview)
        imsakAlert = v(.imsakAlert, d.imsakAlert)
        berbukaAlert = v(.berbukaAlert, d.berbukaAlert)
        qiyamAlert = v(.qiyamAlert, d.qiyamAlert)
        khatamPlan = v(.khatamPlan, d.khatamPlan)
        fastLog = v(.fastLog, d.fastLog)
        tarawihLog = v(.tarawihLog, d.tarawihLog)
        tarawihRakaat = v(.tarawihRakaat, d.tarawihRakaat)
        if let n = tarawihRakaat, !Tarawih.choices.contains(n) { tarawihRakaat = nil }
        quranLog = v(.quranLog, d.quranLog)
        zakatPaid = v(.zakatPaid, d.zakatPaid)
        windowNudge = v(.windowNudge, d.windowNudge)
        quietHours = v(.quietHours, d.quietHours)
        quietFrom = v(.quietFrom, d.quietFrom)
        quietTo = v(.quietTo, d.quietTo)
        if !(0..<1440).contains(quietFrom) { quietFrom = d.quietFrom }
        if !(0..<1440).contains(quietTo) { quietTo = d.quietTo }
        buzzOnly = v(.buzzOnly, d.buzzOnly)
        largeText = v(.largeText, d.largeText)
        showOpening = v(.showOpening, d.showOpening)
        jumuahReminderMinutes = v(.jumuahReminderMinutes, d.jumuahReminderMinutes)
        if !Self.jumuahReminderChoices.contains(jumuahReminderMinutes) { jumuahReminderMinutes = 0 }
        showHadith = v(.showHadith, d.showHadith)
        hadithInAlerts = v(.hadithInAlerts, d.hadithInAlerts)
        hiddenHadith = v(.hiddenHadith, d.hiddenHadith)
    }

    /// Set when `load()` brought settings back from the keychain copy.
    nonisolated(unsafe) static var didRestore = false

    /// This phone's settings. On a fresh install (nothing saved yet) they come
    /// back from the keychain copy, so deleting the app loses nothing.
    static func load() -> Preferences {
        if let data = UserDefaults.standard.data(forKey: key),
           let prefs = try? JSONDecoder().decode(Preferences.self, from: data) {
            return prefs
        }
        if let data = SettingsBackup.load(),
           var prefs = try? JSONDecoder().decode(Preferences.self, from: data), prefs.hasOnboarded {
            prefs.seasonPreview = .off
            didRestore = true
            UserDefaults.standard.set(data, forKey: key)
            return prefs
        }
        return Preferences()
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
            SettingsBackup.save(data)
        }
    }
}
