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
    var wakeUp: WakeUpTiming?

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
        wakeUp = field(.wakeUp)
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
        wakeUp = p.wakeUp
    }

    /// These preferences with the moved settings in place. Every moved setting
    /// replaces this phone's (a missing one goes back to its default), except the
    /// tracker history, which is added to what this phone already has.
    func applied(to p: Preferences) -> Preferences {
        let d = Preferences()
        var out = p
        out.hasOnboarded = true
        out.useGPS = useGPS ?? d.useGPS
        out.home = home?.place
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
        out.wakeUp = wakeUp
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

    /// The link for a QR code: everything if it fits, otherwise the tracker
    /// history trimmed to the most recent days that fit. `keptDays` says how many made it.
    func qrLink(maxCharacters: Int = qrMaxCharacters) -> (link: String, keptDays: Int?) {
        let full = link
        let days = (prayedLog ?? [:]).keys.sorted()
        guard full.count > maxCharacters, !days.isEmpty else { return (full, nil) }
        var keep = days.count
        while true {
            keep /= 2
            var trimmed = self
            let recent = Set(days.suffix(keep))
            trimmed.prayedLog = keep == 0 ? nil : prayedLog?.filter { recent.contains($0.key) }
            let l = trimmed.link
            if l.count <= maxCharacters || keep == 0 { return (l, keep) }
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
        if notifyPrayers != nil || reminderMinutesBefore != nil { lines.append("Which prayers to alert") }
        if wakeUp != nil { lines.append("Your wake-up alarm") }
        if musafirEnabled == true { lines.append("Musafir features") }
        return lines.isEmpty ? ["The standard settings"] : lines
    }
}
