import Foundation

struct Coordinates: Codable, Hashable, Sendable {
    var latitude: Double
    var longitude: Double
}

/// One local calendar day of prayer times at one place.
struct PrayerDay: Sendable, Equatable {
    /// The local calendar date these times belong to.
    let year: Int, month: Int, day: Int
    let times: [Prayer: Date]
    /// Set when these times come from an authority's published table rather
    /// than the on-device calculation.
    var officialSource: String? = nil
    var grade: SourceGrade = .calculated
    /// Congregation times from a nearby mosque's profile, when known.
    var jamaah: [Prayer: Date] = [:]
    var mosqueName: String? = nil

    func time(_ prayer: Prayer) -> Date { times[prayer]! }

    /// Times in chronological order (same order as `Prayer.allCases`).
    var ordered: [(prayer: Prayer, time: Date)] { Prayer.allCases.map { ($0, time($0)) } }
}

/// Offline prayer-time calculation. Pure Foundation, no network, no state -
/// this is what makes the app work the moment you land anywhere in Asia.
///
/// The solar model is the classic praytimes.org formulation (accurate to well
/// under a minute at Asian latitudes). tools/reference_engine.py is a line-by-
/// line Python port used to validate it against official timetables; keep the
/// two in step.
enum PrayerEngine {
    static func compute(
        year: Int, month: Int, day: Int,
        at coordinates: Coordinates,
        method: CalculationMethod,
        asr: AsrSchool,
        isRamadan: Bool = false
    ) -> PrayerDay {
        let lat = coordinates.latitude
        let lng = coordinates.longitude
        let jd0 = Astro.julianDay(year: year, month: month, day: day) - lng / (15 * 24)

        func noon(_ t: Double) -> Double {
            Astro.fix(12 - Astro.sun(jd: jd0 + t).equationOfTime, 24)
        }
        // Hours (local mean time) when the sun is `angle` degrees below the horizon.
        func angleTime(_ angle: Double, _ t: Double, morning: Bool) -> Double? {
            let decl = Astro.sun(jd: jd0 + t).declination
            let x = (-Astro.dsin(angle) - Astro.dsin(decl) * Astro.dsin(lat)) / (Astro.dcos(decl) * Astro.dcos(lat))
            guard x >= -1, x <= 1 else { return nil } // twilight never ends/starts at this latitude today
            let span = Astro.darccos(x) / 15
            return noon(t) + (morning ? -span : span)
        }
        func asrTime(_ t: Double) -> Double? {
            let decl = Astro.sun(jd: jd0 + t).declination
            let angle = -Astro.darccot(asr.shadowFactor + Astro.dtan(abs(lat - decl)))
            return angleTime(angle, t, morning: false)
        }

        // Two refinement passes: each one re-evaluates the sun's position at the
        // previous estimate of each time, which converges well within a minute.
        var t: [Prayer: Double] = [.fajr: 5, .sunrise: 6, .dhuhr: 12, .asr: 13, .maghrib: 18, .isha: 18]
        for _ in 0..<2 {
            let p = t.mapValues { $0 / 24 }
            t[.fajr] = angleTime(method.fajrAngle, p[.fajr]!, morning: true) ?? t[.fajr]
            t[.sunrise] = angleTime(0.833, p[.sunrise]!, morning: true) ?? t[.sunrise]
            t[.dhuhr] = noon(p[.dhuhr]!)
            t[.asr] = asrTime(p[.asr]!) ?? t[.asr]
            t[.maghrib] = angleTime(method.maghribAngle ?? 0.833, p[.maghrib]!, morning: false) ?? t[.maghrib]
            if let ishaAngle = method.ishaAngle {
                t[.isha] = angleTime(ishaAngle, p[.isha]!, morning: false) ?? t[.isha]
            }
        }

        let sunset = angleTime(0.833, t[.maghrib]! / 24, morning: false) ?? t[.maghrib]!
        let night = 24 - (sunset - t[.sunrise]!)
        if let interval = (isRamadan ? method.ramadanIshaInterval : nil) ?? method.ishaInterval {
            t[.isha] = t[.maghrib]! + interval / 60
        }
        // High-latitude safety net ("one-seventh of the night") for days when the
        // sun never reaches the twilight angle. Never triggers in tropical Asia.
        let fajrSevenths = t[.sunrise]! - night / 7
        if angleTime(method.fajrAngle, t[.fajr]! / 24, morning: true) == nil { t[.fajr] = fajrSevenths }
        if method.ishaAngle != nil, angleTime(method.ishaAngle!, t[.isha]! / 24, morning: false) == nil {
            t[.isha] = sunset + night / 7
        }

        let midnightUTC = Astro.utcMidnight(year: year, month: month, day: day)
        var times: [Prayer: Date] = [:]
        for prayer in Prayer.allCases {
            let hoursUTC = t[prayer]! - lng / 15
            let seconds = hoursUTC * 3600 + (method.offsets[prayer] ?? 0) * 60
            // Round UP to the whole minute: a time is never shown earlier than it is.
            let minutes = (seconds / 60).rounded(.up)
            times[prayer] = midnightUTC.addingTimeInterval(minutes * 60)
        }
        return PrayerDay(year: year, month: month, day: day, times: times)
    }

    /// Convenience: the prayer day for the local calendar date containing `date` in `timeZone`.
    static func compute(
        for date: Date, in timeZone: TimeZone,
        at coordinates: Coordinates, method: CalculationMethod, asr: AsrSchool
    ) -> PrayerDay {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.year, .month, .day], from: date)
        let ramadan = Hijri.isRamadan(date, timeZone: timeZone)
        return compute(year: c.year!, month: c.month!, day: c.day!, at: coordinates,
                       method: method, asr: asr, isRamadan: ramadan)
    }
}

enum Astro {
    static func dsin(_ d: Double) -> Double { sin(d * .pi / 180) }
    static func dcos(_ d: Double) -> Double { cos(d * .pi / 180) }
    static func dtan(_ d: Double) -> Double { tan(d * .pi / 180) }
    static func darcsin(_ x: Double) -> Double { asin(x) * 180 / .pi }
    static func darccos(_ x: Double) -> Double { acos(min(1, max(-1, x))) * 180 / .pi }
    static func darctan2(_ y: Double, _ x: Double) -> Double { atan2(y, x) * 180 / .pi }
    static func darccot(_ x: Double) -> Double { atan(1 / x) * 180 / .pi }

    static func fix(_ a: Double, _ b: Double) -> Double {
        let r = a - b * floor(a / b)
        return r < 0 ? r + b : r
    }

    static func julianDay(year: Int, month: Int, day: Int) -> Double {
        var y = year, m = month
        if m <= 2 { y -= 1; m += 12 }
        let a = Double(y / 100)
        let b = 2 - a + floor(a / 4)
        return floor(365.25 * Double(y + 4716)) + floor(30.6001 * Double(m + 1)) + Double(day) + b - 1524.5
    }

    static func sun(jd: Double) -> (declination: Double, equationOfTime: Double) {
        let d = jd - 2451545.0
        let g = fix(357.529 + 0.98560028 * d, 360)
        let q = fix(280.459 + 0.98564736 * d, 360)
        let l = fix(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g), 360)
        let e = 23.439 - 0.00000036 * d
        let ra = darctan2(dcos(e) * dsin(l), dcos(l)) / 15
        let eqt = q / 15 - fix(ra, 24)
        let decl = darcsin(dsin(e) * dsin(l))
        return (decl, eqt)
    }

    /// The sun's altitude above the horizon in degrees at an instant and place
    /// (negative below the horizon). Drives the Today screen's sun path.
    static func sunAltitude(at date: Date, coordinates c: Coordinates) -> Double {
        let jd = date.timeIntervalSince1970 / 86_400 + 2_440_587.5
        let (decl, eqt) = sun(jd: jd)
        let utcHours = fix(date.timeIntervalSince1970 / 3600, 24)
        let hourAngle = 15 * (utcHours + c.longitude / 15 + eqt - 12)
        return darcsin(dsin(c.latitude) * dsin(decl) + dcos(c.latitude) * dcos(decl) * dcos(hourAngle))
    }

    static func utcMidnight(year: Int, month: Int, day: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal.date(from: DateComponents(year: year, month: month, day: day))!
    }
}
