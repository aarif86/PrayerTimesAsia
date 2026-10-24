package com.prayertimesasia.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.math.abs
import kotlin.math.max

/**
 * Falak Mode: the classical, offline sun-and-shadow layer. Qibla from the sun
 * (istiwa' a'zam and the daily rashdul qiblat) and the tongkat istiwa' (shadow
 * stick) for Zuhur and Asr. Anything worked out from the user's own observation
 * is Grade F and never replaces A/B data.
 *
 * Line-by-line port of the iOS Falak.swift; keep the two in step.
 */
object Falak {
    /** Shown on every Falak screen until the shariah review panel signs it off. */
    const val REVIEW_NOTE =
        "Pending review by a falak and shariah panel. For learning and checking; follow your authority's times."

    data class SunPosition(
        /** Degrees above the horizon (geometric, no refraction). */
        val altitude: Double,
        /** Degrees clockwise from true north. */
        val azimuth: Double,
    )

    fun sunPosition(at: Instant, c: Coordinates): SunPosition {
        val (decl, eqt) = Astro.sun(Astro.jd(at))
        val utcHours = Astro.fix(at.epochSeconds() / 3600, 24.0)
        val h = 15 * (utcHours + c.longitude / 15 + eqt - 12)
        val lat = c.latitude
        val alt = Astro.darcsin(Astro.dsin(lat) * Astro.dsin(decl) + Astro.dcos(lat) * Astro.dcos(decl) * Astro.dcos(h))
        val az = Astro.darctan2(-Astro.dcos(decl) * Astro.dsin(h),
            Astro.dsin(decl) * Astro.dcos(lat) - Astro.dcos(decl) * Astro.dsin(lat) * Astro.dcos(h))
        return SunPosition(alt, Astro.fix(az, 360.0))
    }

    /**
     * Local solar noon (zawal): the instant the sun crosses the meridian and
     * a vertical stick's shadow is at its shortest.
     */
    fun solarNoon(year: Int, month: Int, day: Int, longitude: Double): Instant {
        val midnight = Astro.utcMidnight(year, month, day)
        var hours = 12 - longitude / 15
        repeat(3) {
            val jd = Astro.jd(midnight.plusSecondsD(hours * 3600))
            hours = 12 - Astro.sun(jd).equationOfTime - longitude / 15
        }
        return midnight.plusSecondsD(hours * 3600)
    }

    /**
     * Istiwa' a'zam: the two noons a year (about 28 May and 16 July) when the
     * sun stands directly over the Ka'bah. Returns the Makkah noon on the day
     * closest to each crossing.
     */
    fun qiblaDays(year: Int): List<Instant> {
        val out = mutableListOf<Instant>()
        var prev: Pair<Instant, Double>? = null
        var date = LocalDate.of(year, 1, 1)
        while (date.year == year) {
            val noon = solarNoon(date.year, date.monthValue, date.dayOfMonth, Geo.kaaba.longitude)
            val diff = Astro.sun(Astro.jd(noon)).declination - Geo.kaaba.latitude
            prev?.let { (pt, pd) ->
                if ((pd < 0) != (diff < 0)) out += if (abs(pd) < abs(diff)) pt else noon
            }
            prev = noon to diff
            date = date.plusDays(1)
        }
        return out
    }

    /** The next Qibla Day noon at or after [date] (today's counts until it has passed). */
    fun nextQiblaDay(after: Instant): Instant {
        val year = after.atZone(ZoneOffset.UTC).year
        return (qiblaDays(year) + qiblaDays(year + 1)).first { it.plusSeconds(10 * 60) >= after }
    }

    data class Alignment(val time: Instant, val kind: Kind, val altitude: Double) {
        enum class Kind { SUN_IN_QIBLA, SUN_OPPOSITE }

        /** What the shadow does at this moment. */
        val shadowNote: String
            get() = when (kind) {
                Kind.SUN_IN_QIBLA -> "Shadows point directly away from the qibla. Face along the shadow, from its tip to the base of the stick."
                Kind.SUN_OPPOSITE -> "Shadows point directly towards the qibla. Face along the shadow, from the base of the stick to its tip."
            }
    }

    /**
     * Rashdul qiblat for one local day: the moments the sun's azimuth lines up
     * with the qibla bearing (or its opposite), so a vertical shadow lies along
     * the qibla line. Only moments with the sun at least [minAltitude] up.
     */
    fun rashdulQiblat(year: Int, month: Int, day: Int, zone: ZoneId, coordinates: Coordinates,
                      minAltitude: Double = 5.0): List<Alignment> {
        val start = LocalDate.of(year, month, day).atStartOfDay(zone).toInstant()
        val qibla = Geo.qiblaBearing(coordinates)
        val targets = listOf(qibla to Alignment.Kind.SUN_IN_QIBLA, Astro.fix(qibla + 180, 360.0) to Alignment.Kind.SUN_OPPOSITE)
        val out = mutableListOf<Alignment>()
        var prev: Pair<Instant, List<Double>>? = null
        for (minute in 0..(24 * 60)) {
            val t = start.plusSeconds(minute * 60L)
            val sun = sunPosition(t, coordinates)
            val deltas = targets.map { Geo.angleDelta(sun.azimuth, it.first) }
            val p = prev
            if (p != null && sun.altitude >= minAltitude) {
                val (pt, pd) = p
                for (i in targets.indices) {
                    if ((pd[i] < 0) != (deltas[i] < 0) && abs(pd[i] - deltas[i]) < 90) {
                        // Interpolate to the second within the minute.
                        val f = pd[i] / (pd[i] - deltas[i])
                        out += Alignment(pt.plusSecondsD(60 * f), targets[i].second, sun.altitude)
                    }
                }
            }
            prev = t to deltas
        }
        return out.sortedBy { it.time }
    }

    /** Shadow of a vertical stick of [height] with the sun at [altitude] degrees. */
    fun shadowLength(height: Double, altitude: Double): Double =
        if (altitude <= 0) Double.POSITIVE_INFINITY else height / Astro.dtan(altitude)

    /** Sun altitude implied by a stick and its measured shadow. */
    fun altitude(height: Double, shadow: Double): Double = Astro.darctan2(height, shadow)

    data class ShadowDay(
        /** Zawal: shortest shadow; Zuhur begins as it starts to lengthen. */
        val noon: Instant,
        val noonAltitude: Double,
        /** Compass direction the noon shadow points, degrees from north. */
        val noonShadowBearing: Double,
        /** Geometric Asr: shadow = noon shadow + 1x (Shafi'i) or 2x (Hanafi) the stick. */
        val asrShafii: Instant?,
        val asrHanafi: Instant?,
    ) {
        fun noonShadow(height: Double) = shadowLength(height, noonAltitude)
        fun asrShadow(height: Double, school: AsrSchool) = noonShadow(height) + school.shadowFactor * height
    }

    fun shadowDay(year: Int, month: Int, day: Int, coordinates: Coordinates): ShadowDay {
        val noon = solarNoon(year, month, day, coordinates.longitude)
        val sun = sunPosition(noon, coordinates)
        // Any height works for the Asr altitude: the ratio is all that matters.
        fun asr(factor: Double): Instant? {
            val target = altitude(1.0, shadowLength(1.0, sun.altitude) + factor)
            return time(target, noon, coordinates, afternoon = true)
        }
        return ShadowDay(noon, sun.altitude, Astro.fix(sun.azimuth + 180, 360.0), asr(1.0), asr(2.0))
    }

    /** When the sun is at [altitude] on the given side of [noon], to the second. */
    fun time(altitude: Double, noon: Instant, coordinates: Coordinates, afternoon: Boolean): Instant? {
        val step = if (afternoon) 60.0 else -60.0
        var prevT = noon
        var prevAlt = sunPosition(noon, coordinates).altitude
        if (prevAlt < altitude) return null
        for (i in 1..(12 * 60)) {
            val t = noon.plusSecondsD(i * step)
            val alt = sunPosition(t, coordinates).altitude
            if (alt < altitude) {
                val f = (prevAlt - altitude) / (prevAlt - alt)
                return prevT.plusSecondsD(step * f)
            }
            prevT = t
            prevAlt = alt
        }
        return null
    }

    /** One shadow-stick observation, compared with the sun's computed position. */
    data class Reading(
        val altitude: Double,
        /** When the computed sun reaches the observed altitude (same side of noon). */
        val sunTime: Instant?,
        /** sunTime - clock time, minutes. Positive: your shadow says it's later. */
        val offsetMinutes: Double?,
        /** Honest ± from measuring to the nearest half centimetre (plus 1 min for the model). */
        val uncertaintyMinutes: Double?,
        val afternoon: Boolean,
        val asrReached: Boolean?,
    )

    fun reading(height: Double, shadow: Double, clock: Instant, coordinates: Coordinates, zone: ZoneId,
                school: AsrSchool, measurementError: Double = 0.5): Reading? {
        if (height <= 0 || shadow <= 0) return null
        val c = clock.atZone(zone).toLocalDate()
        val day = shadowDay(c.year, c.monthValue, c.dayOfMonth, coordinates)
        val afternoon = clock >= day.noon
        val alt = altitude(height, shadow)
        fun whenShadow(s: Double): Instant? =
            time(altitude(height, max(s, 0.01)), day.noon, coordinates, afternoon)
        val sunTime = whenShadow(shadow)
        val a = whenShadow(shadow - measurementError)
        val b = whenShadow(shadow + measurementError)
        val uncertainty = if (a != null && b != null) abs(b.secondsSince(a)) / 120 + 1 else null
        return Reading(
            altitude = alt, sunTime = sunTime,
            offsetMinutes = sunTime?.let { it.secondsSince(clock) / 60 },
            uncertaintyMinutes = uncertainty, afternoon = afternoon,
            asrReached = if (afternoon) shadow >= day.asrShadow(height, school) else null,
        )
    }
}
