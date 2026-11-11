import Foundation

/// "Move my settings": everything a user chose, packed into one short code they
/// carry to another phone themselves (QR code, link or copy-paste). No account
/// and no server - the settings travel inside the code.
///
/// The format is shared with the Android and web apps (docs/move-settings.md,
/// checked by testdata/move-settings.json):
///
///     PTA1.<base64url of raw DEFLATE of the JSON below>
///
/// The JSON holds only what differs from the defaults, so a missing key means
/// "the default". Places carry no id; the receiving app gives them new ones.
struct MovedSettings: Codable, Equatable {
    struct MovedPlace: Codable, Equatable {
        var name: String
        var region: String?
        var countryCode: String?
        var countryName: String?
        var timeZoneID: String
        var lat: Double
        var lon: Double
        var district: String?
    }

    var v = MovedSettings.version
    var useGPS: Bool?
    var home: MovedPlace?
    var manualPlace: MovedPlace?
    var savedPlaces: [MovedPlace]?
    var methodOverrideID: String?
    var asrOverride: AsrSchool?
    var namingOverride: NamingStyle?
    var use24Hour: Bool?
    var hijriAdjustment: Int?
    var notifyPrayers: [Prayer]?
    var reminderMinutesBefore: Int?
    var musafirEnabled: Bool?
    var musafirThresholdKm: Double?
    var jakimZoneOverride: String?
    var communityAuthority: String?
    var appearance: Appearance?
    var todayStyle: TodayStyle?
    var showOffers: Bool?
    var showLocalNames: Bool?
    var trackerEnabled: Bool?
    var prayedLog: [String: [Prayer]]?
    var excusedDays: [String]?
    var trackerPausedSince: String?
    var wakeUp: WakeUpTiming?
    var sahurAlarm: SahurTiming?
    var sahurDays: [SahurDay]?
    var dhuhrAlarm: PrayerAlarmTiming?
    var asrAlarm: PrayerAlarmTiming?
    var maghribAlarm: PrayerAlarmTiming?
    var ishaAlarm: PrayerAlarmTiming?
    var alarmSound: AlarmSound?
    var windowNudge: Bool?
    var quietHours: Bool?
    var quietFrom: Int?
    var quietTo: Int?
    var buzzOnly: Bool?
    var largeText: Bool?
    var jumuahReminderMinutes: Int?
    /// The Ramadan record: how each day's fast went, and the days Tarawih was prayed and the juz read.
    var fastLog: [String: FastMark]?
    var tarawihLog: [String]?
    var quranLog: [String]?

    static let version = 1
    static let prefix = "PTA1."
    /// The web app's address; a phone camera that scans the QR code opens it straight into "Bring in settings".
    static let linkBase = "https://aarif86.github.io/PrayerTimesAsia/app/#move="
    /// Phone cameras read a QR code of this many characters off a screen without fuss.
    static let qrMaxCharacters = 1500

    init() {}

    /// Field by field, so one value this version doesn't know (a new look, say)
    /// is skipped instead of throwing the whole code away.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func field<T: Decodable>(_ key: CodingKeys) -> T? { (try? c.decodeIfPresent(T.self, forKey: key)) ?? nil }
        self.v = field(.v) ?? 0
        useGPS = field(.useGPS)
        home = field(.home)
        manualPlace = field(.manualPlace)
        savedPlaces = (try? c.decodeIfPresent([Lenient<MovedPlace>].self, forKey: .savedPlaces))?.map { $0.compactMap { $0.value } }
        methodOverrideID = field(.methodOverrideID)
        asrOverride = field(.asrOverride)
        namingOverride = field(.namingOverride)
        use24Hour = field(.use24Hour)
        hijriAdjustment = field(.hijriAdjustment)
        notifyPrayers = (try? c.decodeIfPresent([Lenient<Prayer>].self, forKey: .notifyPrayers))?.map { $0.compactMap { $0.value } }
        reminderMinutesBefore = field(.reminderMinutesBefore)
        musafirEnabled = field(.musafirEnabled)
        musafirThresholdKm = field(.musafirThresholdKm)
        jakimZoneOverride = field(.jakimZoneOverride)
        communityAuthority = field(.communityAuthority)
        appearance = field(.appearance)
        todayStyle = field(.todayStyle)
        showOffers = field(.showOffers)
        showLocalNames = field(.showLocalNames)
        trackerEnabled = field(.trackerEnabled)
        if let log: [String: [Lenient<Prayer>]] = field(.prayedLog) {
            prayedLog = log.mapValues { $0.compactMap { $0.value } }
        }
        excusedDays = field(.excusedDays)
        trackerPausedSince = field(.trackerPausedSince)
        wakeUp = field(.wakeUp)
        sahurAlarm = field(.sahurAlarm)
        sahurDays = (try? c.decodeIfPresent([Lenient<SahurDay>].self, forKey: .sahurDays))?.map { $0.compactMap { $0.value } }
        dhuhrAlarm = field(.dhuhrAlarm)
        asrAlarm = field(.asrAlarm)
        maghribAlarm = field(.maghribAlarm)
        ishaAlarm = field(.ishaAlarm)
        alarmSound = field(.alarmSound)
        windowNudge = field(.windowNudge)
        quietHours = field(.quietHours)
        quietFrom = field(.quietFrom)
        quietTo = field(.quietTo)
        buzzOnly = field(.buzzOnly)
        largeText = field(.largeText)
        jumuahReminderMinutes = field(.jumuahReminderMinutes)
        if let log: [String: Lenient<FastMark>] = field(.fastLog) {
            fastLog = log.compactMapValues { $0.value }
        }
        tarawihLog = (try? c.decodeIfPresent([Lenient<String>].self, forKey: .tarawihLog))?.map { $0.compactMap { $0.value } }
        quranLog = (try? c.decodeIfPresent([Lenient<String>].self, forKey: .quranLog))?.map { $0.compactMap { $0.value } }
    }

    private struct Lenient<T: Decodable>: Decodable {
        let value: T?
        init(from decoder: Decoder) throws { value = try? T(from: decoder) }
    }
}

extension MovedSettings.MovedPlace {
    init(_ p: Place) {
        self.init(name: p.name, region: p.region, countryCode: p.countryCode, countryName: p.countryName,
                  timeZoneID: p.timeZoneID, lat: p.coordinates.latitude, lon: p.coordinates.longitude, district: p.district)
    }

    var place: Place {
        Place(name: name, region: region, countryCode: countryCode, countryName: countryName, timeZoneID: timeZoneID,
              coordinates: Coordinates(latitude: lat, longitude: lon), district: district)
    }
}

extension MovedSettings {
    /// What to put in the code: only the settings that differ from a fresh install.
    init(_ p: Preferences) {
        let d = Preferences()
        func changed<T: Equatable>(_ a: T, _ b: T) -> T? { a == b ? nil : a }
        self.init()
        useGPS = changed(p.useGPS, d.useGPS)
        home = p.home.map(MovedPlace.init)
        manualPlace = p.manualPlace.map(MovedPlace.init)
        savedPlaces = p.savedPlaces.isEmpty ? nil : p.savedPlaces.map(MovedPlace.init)
        methodOverrideID = p.methodOverrideID
        asrOverride = p.asrOverride
        namingOverride = p.namingOverride
        use24Hour = changed(p.use24Hour, d.use24Hour)
        hijriAdjustment = changed(p.hijriAdjustment, d.hijriAdjustment)
        notifyPrayers = changed(p.notifyPrayers, d.notifyPrayers).map { set in Prayer.allCases.filter { set.contains($0) } }
        reminderMinutesBefore = changed(p.reminderMinutesBefore, d.reminderMinutesBefore)
        musafirEnabled = changed(p.musafirEnabled, d.musafirEnabled)
        musafirThresholdKm = changed(p.musafirThresholdKm, d.musafirThresholdKm)
        jakimZoneOverride = p.jakimZoneOverride
        communityAuthority = p.communityAuthority
        appearance = changed(p.appearance, d.appearance)
        todayStyle = changed(p.todayStyle, d.todayStyle)
        showOffers = changed(p.showOffers, d.showOffers)
        showLocalNames = changed(p.showLocalNames, d.showLocalNames)
        trackerEnabled = changed(p.trackerEnabled, d.trackerEnabled)
        let log = p.prayedLog.filter { !$0.value.isEmpty }
        prayedLog = log.isEmpty ? nil : log.mapValues { set in Prayer.allCases.filter { set.contains($0) } }
        excusedDays = p.excusedDays.isEmpty ? nil : p.excusedDays.sorted()
        trackerPausedSince = p.trackerPausedSince
        wakeUp = p.wakeUp
        sahurAlarm = p.sahurAlarm
        sahurDays = p.sahurDays == d.sahurDays ? nil : SahurDay.allCases.filter { p.sahurDays.contains($0) }
        dhuhrAlarm = p.dhuhrAlarm
        asrAlarm = p.asrAlarm
        maghribAlarm = p.maghribAlarm
        ishaAlarm = p.ishaAlarm
        alarmSound = changed(p.alarmSound, d.alarmSound)
        windowNudge = changed(p.windowNudge, d.windowNudge)
        quietHours = changed(p.quietHours, d.quietHours)
        quietFrom = changed(p.quietFrom, d.quietFrom)
        quietTo = changed(p.quietTo, d.quietTo)
        buzzOnly = changed(p.buzzOnly, d.buzzOnly)
        largeText = changed(p.largeText, d.largeText)
        jumuahReminderMinutes = changed(p.jumuahReminderMinutes, d.jumuahReminderMinutes)
        fastLog = p.fastLog.isEmpty ? nil : p.fastLog
        tarawihLog = p.tarawihLog.isEmpty ? nil : p.tarawihLog.sorted()
        quranLog = p.quranLog.isEmpty ? nil : p.quranLog.sorted()
    }

    /// These preferences with the moved settings in place. Every moved setting
    /// replaces this phone's (a missing one goes back to its default), except the
    /// tracker history and the Ramadan record, which are added to what this phone
    /// already has (an older code without them leaves this phone's as they are).
    func applied(to p: Preferences) -> Preferences {
        let d = Preferences()
        var out = p
        out.hasOnboarded = true
        out.useGPS = useGPS ?? d.useGPS
        out.home = home?.place
        out.homeConfirmed = home != nil
        out.manualPlace = manualPlace?.place
        out.savedPlaces = savedPlaces?.map(\.place) ?? []
        out.methodOverrideID = methodOverrideID
        out.asrOverride = asrOverride
        out.namingOverride = namingOverride
        out.use24Hour = use24Hour ?? d.use24Hour
        out.hijriAdjustment = max(-2, min(2, hijriAdjustment ?? d.hijriAdjustment))
        out.notifyPrayers = notifyPrayers.map(Set.init) ?? d.notifyPrayers
        out.reminderMinutesBefore = reminderMinutesBefore ?? d.reminderMinutesBefore
        out.musafirEnabled = musafirEnabled ?? d.musafirEnabled
        out.musafirThresholdKm = musafirThresholdKm ?? d.musafirThresholdKm
        out.jakimZoneOverride = jakimZoneOverride
        out.communityAuthority = communityAuthority
        out.appearance = appearance ?? d.appearance
        out.stylePick = todayStyle
        out.showOffers = showOffers ?? d.showOffers
        out.showLocalNames = showLocalNames ?? d.showLocalNames
        out.trackerEnabled = trackerEnabled ?? d.trackerEnabled
        for (day, prayers) in prayedLog ?? [:] where day.wholeMatch(of: #/\d{4}-\d{2}-\d{2}/#) != nil {
            out.prayedLog[day, default: []].formUnion(prayers)
        }
        out.excusedDays.formUnion(excusedDays ?? [])
        out.trackerPausedSince = trackerPausedSince.flatMap { $0.wholeMatch(of: #/\d{4}-\d{2}-\d{2}/#) != nil ? $0 : nil }
        out.wakeUp = wakeUp
        out.sahurAlarm = sahurAlarm
        out.sahurDays = sahurDays.map(Set.init) ?? d.sahurDays
        out.dhuhrAlarm = dhuhrAlarm
        out.asrAlarm = asrAlarm
        out.maghribAlarm = maghribAlarm
        out.ishaAlarm = ishaAlarm == .endMinus30 ? nil : ishaAlarm
        out.alarmSound = alarmSound ?? d.alarmSound
        out.windowNudge = windowNudge ?? d.windowNudge
        out.quietHours = quietHours ?? d.quietHours
        out.quietFrom = quietFrom.flatMap { (0..<1440).contains($0) ? $0 : nil } ?? d.quietFrom
        out.quietTo = quietTo.flatMap { (0..<1440).contains($0) ? $0 : nil } ?? d.quietTo
        out.buzzOnly = buzzOnly ?? d.buzzOnly
        out.largeText = largeText ?? d.largeText
        out.jumuahReminderMinutes = jumuahReminderMinutes.flatMap { Preferences.jumuahReminderChoices.contains($0) ? $0 : nil } ?? 0
        for (day, mark) in fastLog ?? [:] where Self.isDay(day) { out.fastLog[day] = mark }
        out.tarawihLog.formUnion((tarawihLog ?? []).filter(Self.isDay))
        out.quranLog.formUnion((quranLog ?? []).filter(Self.isDay))
        return out
    }

    // MARK: The code

    var code: String {
        let json = (try? JSONEncoder().encode(self)) ?? Data()
        let packed = (try? (json as NSData).compressed(using: .zlib) as Data) ?? Data()
        return Self.prefix + packed.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    var link: String { Self.linkBase + code }

    /// The settings in a code, a link with one, or any text that contains one.
    init?(code text: String) {
        guard let match = text.firstMatch(of: #/PTA1\.([A-Za-z0-9_-]+)/#) else { return nil }
        var b64 = String(match.1).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        b64 += String(repeating: "=", count: (4 - b64.count % 4) % 4)
        guard let packed = Data(base64Encoded: b64),
              let json = try? (packed as NSData).decompressed(using: .zlib) as Data,
              let moved = try? JSONDecoder().decode(MovedSettings.self, from: json),
              moved.v == Self.version else { return nil }
        self = moved
    }

    private static func isDay(_ s: String) -> Bool { s.wholeMatch(of: #/\d{4}-\d{2}-\d{2}/#) != nil }

    /// How far back "this year's Ramadan record" reaches from its newest day: the month itself, Syawal and the replaced fasts after it.
    static let ramadanYearDays = 330

    /// Only the Ramadan record from the newest day back `ramadanYearDays` days; nil if nothing older was there to leave out.
    var latestRamadanYear: MovedSettings? {
        let all = (Array((fastLog ?? [:]).keys) + (tarawihLog ?? []) + (quranLog ?? [])).filter(Self.isDay).sorted()
        guard let newest = all.last, let oldest = all.first else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        guard let end = f.date(from: newest) else { return nil }
        let from = f.string(from: end.addingTimeInterval(-Double(Self.ramadanYearDays) * 86_400))
        guard oldest < from else { return nil }
        var out = self
        let fasts = (fastLog ?? [:]).filter { $0.key >= from }
        let tarawih = (tarawihLog ?? []).filter { $0 >= from }
        let quran = (quranLog ?? []).filter { $0 >= from }
        out.fastLog = fasts.isEmpty ? nil : fasts
        out.tarawihLog = tarawih.isEmpty ? nil : tarawih
        out.quranLog = quran.isEmpty ? nil : quran
        return out
    }

    /// The link for a QR code: everything if it fits. Otherwise first only this
    /// year's Ramadan record (`ramadanTrimmed`), then the tracker history trimmed
    /// to the most recent days that fit (`keptDays` says how many made it).
    func qrLink(maxCharacters: Int = qrMaxCharacters) -> (link: String, keptDays: Int?, ramadanTrimmed: Bool) {
        var base = self
        var l = base.link
        guard l.count > maxCharacters else { return (l, nil, false) }
        let thisYear = latestRamadanYear
        if let thisYear {
            base = thisYear
            l = base.link
            if l.count <= maxCharacters { return (l, nil, true) }
        }
        let ramadanTrimmed = thisYear != nil
        let days = (base.prayedLog ?? [:]).keys.sorted()
        guard !days.isEmpty else { return (l, nil, ramadanTrimmed) }
        var keep = days.count
        while true {
            keep /= 2
            var trimmed = base
            let recent = Set(days.suffix(keep))
            trimmed.prayedLog = keep == 0 ? nil : base.prayedLog?.filter { recent.contains($0.key) }
            let t = trimmed.link
            if t.count <= maxCharacters || keep == 0 { return (t, keep, ramadanTrimmed) }
        }
    }

    /// What people are about to bring in, in a few short lines.
    var summary: [String] {
        var lines: [String] = []
        if let place = home?.name ?? manualPlace?.name { lines.append("Place: \(place)") }
        if let n = savedPlaces?.count, n > 0 { lines.append("\(n) saved place\(n == 1 ? "" : "s")") }
        let days = prayedLog?.count ?? 0
        if trackerEnabled == true || days > 0 {
            lines.append("Prayer tracker" + (days > 0 ? ", \(days) day\(days == 1 ? "" : "s") of history" : ""))
        }
        if methodOverrideID != nil || asrOverride != nil || jakimZoneOverride != nil { lines.append("Your calculation choices") }
        if appearance != nil || todayStyle != nil || use24Hour != nil || namingOverride != nil { lines.append("Your look and prayer names") }
        if notifyPrayers != nil || reminderMinutesBefore != nil || quietHours != nil || buzzOnly != nil || jumuahReminderMinutes != nil {
            lines.append("Which prayers to alert, and how")
        }
        if wakeUp != nil || sahurAlarm != nil || dhuhrAlarm != nil || asrAlarm != nil || maghribAlarm != nil || ishaAlarm != nil {
            lines.append("Your prayer alarms")
        }
        if !(fastLog ?? [:]).isEmpty || !(tarawihLog ?? []).isEmpty || !(quranLog ?? []).isEmpty {
            lines.append("Your Ramadan record of fasts, Tarawih and juz")
        }
        if largeText == true { lines.append("Bigger text") }
        if musafirEnabled == true { lines.append("Musafir features") }
        return lines.isEmpty ? ["The standard settings"] : lines
    }
}
