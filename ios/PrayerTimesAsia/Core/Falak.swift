import Foundation

/// Falak Mode F1: the classical, offline sun-and-shadow layer (brief v03 §8).
/// Qibla from the sun (istiwa' a'zam and the daily rashdul qiblat) and the
/// tongkat istiwa' (shadow stick) for Zuhur and Asr. Anything worked out from
/// the user's own observation is Grade F and never replaces A/B data.
///
/// tools/falak_reference.py is a line-by-line Python port; keep the two in step.
enum Falak {
    /// Shown on every Falak screen until the shariah review panel signs it off.
    static let reviewNote = "Pending review by a falak and shariah panel. For learning and checking; follow your authority's times."

    // MARK: Sun position

    struct SunPosition: Equatable {
        /// Degrees above the horizon (geometric, no refraction).
        var altitude: Double
        /// Degrees clockwise from true north.
        var azimuth: Double
    }

    static func sunPosition(at date: Date, coordinates c: Coordinates) -> SunPosition {
        let jd = date.timeIntervalSince1970 / 86_400 + 2_440_587.5
        let (decl, eqt) = Astro.sun(jd: jd)
        let utcHours = Astro.fix(date.timeIntervalSince1970 / 3600, 24)
        let h = 15 * (utcHours + c.longitude / 15 + eqt - 12)
        let lat = c.latitude
        let alt = Astro.darcsin(Astro.dsin(lat) * Astro.dsin(decl) + Astro.dcos(lat) * Astro.dcos(decl) * Astro.dcos(h))
        let az = Astro.darctan2(-Astro.dcos(decl) * Astro.dsin(h),
                                Astro.dsin(decl) * Astro.dcos(lat) - Astro.dcos(decl) * Astro.dsin(lat) * Astro.dcos(h))
        return SunPosition(altitude: alt, azimuth: Astro.fix(az, 360))
    }

    /// Local solar noon (zawal): the instant the sun crosses the meridian and
    /// a vertical stick's shadow is at its shortest.
    static func solarNoon(year: Int, month: Int, day: Int, longitude: Double) -> Date {
        let midnight = Astro.utcMidnight(year: year, month: month, day: day)
        var hours = 12 - longitude / 15
        for _ in 0..<3 {
            let jd = midnight.addingTimeInterval(hours * 3600).timeIntervalSince1970 / 86_400 + 2_440_587.5
            hours = 12 - Astro.sun(jd: jd).equationOfTime - longitude / 15
        }
        return midnight.addingTimeInterval(hours * 3600)
    }

    // MARK: Qibla from the sun

    /// Istiwa' a'zam: the two noons a year (about 28 May and 16 July) when the
    /// sun stands directly over the Ka'bah, so every upright shadow on the
    /// sunlit half of the earth points straight away from it. Returns the
    /// Makkah noon on the day closest to each crossing.
    static func qiblaDays(year: Int) -> [Date] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        var out: [Date] = []
        var prev: (Date, Double)?
        var date = cal.date(from: DateComponents(year: year, month: 1, day: 1))!
        while cal.component(.year, from: date) == year {
            let c = cal.dateComponents([.year, .month, .day], from: date)
            let noon = solarNoon(year: c.year!, month: c.month!, day: c.day!, longitude: Geo.kaaba.longitude)
            let jd = noon.timeIntervalSince1970 / 86_400 + 2_440_587.5
            let diff = Astro.sun(jd: jd).declination - Geo.kaaba.latitude
            if let (pt, pd) = prev, (pd < 0) != (diff < 0) {
                out.append(abs(pd) < abs(diff) ? pt : noon)
            }
            prev = (noon, diff)
            date = cal.date(byAdding: .day, value: 1, to: date)!
        }
        return out
    }

    /// The next Qibla Day noon at or after `date` (today's counts until it has passed).
    static func nextQiblaDay(after date: Date) -> Date {
        let year = Calendar(identifier: .gregorian).dateComponents(in: TimeZone(identifier: "UTC")!, from: date).year!
        return (qiblaDays(year: year) + qiblaDays(year: year + 1)).first { $0.addingTimeInterval(10 * 60) >= date }!
    }

    struct Alignment: Equatable {
        enum Kind { case sunInQibla, sunOpposite }
        var time: Date
        var kind: Kind
        var altitude: Double

        /// What the shadow does at this moment.
        var shadowNote: String {
            switch kind {
            case .sunInQibla: "Shadows point directly away from the qibla. Face along the shadow, from its tip to the base of the stick."
            case .sunOpposite: "Shadows point directly towards the qibla. Face along the shadow, from the base of the stick to its tip."
            }
        }
    }

    /// Rashdul qiblat for one local day: the moments the sun's azimuth lines up
    /// with the qibla bearing (or its opposite), so a vertical shadow lies
    /// along the qibla line. Only moments with the sun at least `minAltitude`
    /// up are returned - a low sun casts long, fuzzy shadows.
    static func rashdulQiblat(year: Int, month: Int, day: Int, timeZone: TimeZone,
                              coordinates: Coordinates, minAltitude: Double = 5) -> [Alignment] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        guard let start = cal.date(from: DateComponents(year: year, month: month, day: day)) else { return [] }
        let qibla = Geo.qiblaBearing(from: coordinates)
        let targets: [(Double, Alignment.Kind)] = [(qibla, .sunInQibla), (Astro.fix(qibla + 180, 360), .sunOpposite)]
        var out: [Alignment] = []
        var prev: (Date, [Double])?
        for minute in 0...(24 * 60) {
            let t = start.addingTimeInterval(Double(minute) * 60)
            let sun = sunPosition(at: t, coordinates: coordinates)
            let deltas = targets.map { Geo.angleDelta(sun.azimuth, $0.0) }
            if let (pt, pd) = prev, sun.altitude >= minAltitude {
                for i in targets.indices where (pd[i] < 0) != (deltas[i] < 0) && abs(pd[i] - deltas[i]) < 90 {
                    // Interpolate to the second within the minute.
                    let f = pd[i] / (pd[i] - deltas[i])
                    let hit = pt.addingTimeInterval(60 * f)
                    out.append(Alignment(time: hit, kind: targets[i].1, altitude: sun.altitude))
                }
            }
            prev = (t, deltas)
        }
        return out.sorted { $0.time < $1.time }
    }

    // MARK: Tongkat istiwa' (shadow stick)

    /// Shadow of a vertical stick of `height` with the sun at `altitude` degrees.
    static func shadowLength(height: Double, altitude: Double) -> Double {
        altitude <= 0 ? .infinity : height / Astro.dtan(altitude)
    }

    /// Sun altitude implied by a stick and its measured shadow.
    static func altitude(height: Double, shadow: Double) -> Double {
        Astro.darctan2(height, shadow)
    }

    struct ShadowDay: Equatable {
        /// Zawal: shortest shadow; Zuhur begins as it starts to lengthen.
        var noon: Date
        var noonAltitude: Double
        /// Compass direction the noon shadow points, degrees from north.
        var noonShadowBearing: Double
        /// Geometric Asr: shadow = noon shadow + 1x (Shafi'i) or 2x (Hanafi) the stick.
        var asrShafii: Date?
        var asrHanafi: Date?

        func noonShadow(height: Double) -> Double { Falak.shadowLength(height: height, altitude: noonAltitude) }
        func asrShadow(height: Double, school: AsrSchool) -> Double { noonShadow(height: height) + school.shadowFactor * height }
    }

    static func shadowDay(year: Int, month: Int, day: Int, coordinates: Coordinates) -> ShadowDay {
        let noon = solarNoon(year: year, month: month, day: day, longitude: coordinates.longitude)
        let sun = sunPosition(at: noon, coordinates: coordinates)
        // Any height works for the Asr altitude: the ratio is all that matters.
        func asr(_ factor: Double) -> Date? {
            let target = altitude(height: 1, shadow: shadowLength(height: 1, altitude: sun.altitude) + factor)
            return time(whenAltitude: target, from: noon, coordinates: coordinates, afternoon: true)
        }
        return ShadowDay(noon: noon, noonAltitude: sun.altitude,
                         noonShadowBearing: Astro.fix(sun.azimuth + 180, 360),
                         asrShafii: asr(1), asrHanafi: asr(2))
    }

    /// When the sun is at `altitude` on the given side of `noon`, to the second.
    static func time(whenAltitude altitude: Double, from noon: Date,
                     coordinates: Coordinates, afternoon: Bool) -> Date? {
        let step: Double = afternoon ? 60 : -60
        var prevT = noon
        var prevAlt = sunPosition(at: noon, coordinates: coordinates).altitude
        guard prevAlt >= altitude else { return nil }
        for i in 1...(12 * 60) {
            let t = noon.addingTimeInterval(Double(i) * step)
            let alt = sunPosition(at: t, coordinates: coordinates).altitude
            if alt < altitude {
                let f = (prevAlt - altitude) / (prevAlt - alt)
                return prevT.addingTimeInterval(step * f)
            }
            prevT = t; prevAlt = alt
        }
        return nil
    }

    /// One shadow-stick observation, compared with the sun's computed position.
    struct Reading: Equatable {
        var altitude: Double
        /// When the computed sun reaches the observed altitude (same side of noon).
        var sunTime: Date?
        /// sunTime - clock time, minutes. Positive: your shadow says it's later.
        var offsetMinutes: Double?
        /// Honest ± from measuring to the nearest half centimetre (plus 1 min for the model).
        var uncertaintyMinutes: Double?
        var afternoon: Bool
        var asrReached: Bool?
    }

    static func reading(height: Double, shadow: Double, at clock: Date,
                        coordinates: Coordinates, timeZone: TimeZone,
                        school: AsrSchool, measurementError: Double = 0.5) -> Reading? {
        guard height > 0, shadow > 0 else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let c = cal.dateComponents([.year, .month, .day], from: clock)
        let day = shadowDay(year: c.year!, month: c.month!, day: c.day!, coordinates: coordinates)
        let afternoon = clock >= day.noon
        let alt = altitude(height: height, shadow: shadow)
        func when(_ s: Double) -> Date? {
            time(whenAltitude: altitude(height: height, shadow: max(s, 0.01)), from: day.noon,
                 coordinates: coordinates, afternoon: afternoon)
        }
        let sunTime = when(shadow)
        var uncertainty: Double?
        if let a = when(shadow - measurementError), let b = when(shadow + measurementError) {
            uncertainty = abs(b.timeIntervalSince(a)) / 120 + 1
        }
        return Reading(
            altitude: alt, sunTime: sunTime,
            offsetMinutes: sunTime.map { $0.timeIntervalSince(clock) / 60 },
            uncertaintyMinutes: uncertainty, afternoon: afternoon,
            asrReached: afternoon ? shadow >= day.asrShadow(height: height, school: school) : nil)
    }
}
