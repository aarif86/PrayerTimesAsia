package com.prayertimesasia.core

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.tan

@Serializable
data class Coordinates(val latitude: Double, val longitude: Double)

/** One local calendar day of prayer times at one place. */
data class PrayerDay(
    /** The local calendar date these times belong to. */
    val year: Int, val month: Int, val day: Int,
    val times: Map<Prayer, Instant>,
    /** Set when these times come from an authority's published table rather than the calculation. */
    val officialSource: String? = null,
    val grade: SourceGrade = SourceGrade.CALCULATED,
    /** Congregation times from a nearby mosque's profile, when known. */
    val jamaah: Map<Prayer, Instant> = emptyMap(),
    val mosqueName: String? = null,
    /**
     * A second credible source's times, kept only for prayers where it differs
     * from [times] by more than 2 minutes - shown side by side, never silently picked.
     */
    val alternate: Map<Prayer, Instant> = emptyMap(),
    val alternateSource: String? = null,
) {
    fun time(prayer: Prayer): Instant = times.getValue(prayer)

    /** Times in chronological order (same order as [Prayer.all]). */
    val ordered: List<Pair<Prayer, Instant>> get() = Prayer.all.map { it to time(it) }

    val date: LocalDate get() = LocalDate.of(year, month, day)
}

/**
 * Offline prayer-time calculation. Pure JVM, no network, no state - this is
 * what makes the app work the moment you land anywhere in Asia.
 *
 * The solar model is the classic praytimes.org formulation (accurate to well
 * under a minute at Asian latitudes). It is a line-by-line port of the iOS
 * app's PrayerEngine.swift; keep the two in step.
 */
object PrayerEngine {
    fun compute(
        year: Int, month: Int, day: Int,
        at: Coordinates,
        method: CalculationMethod,
        asr: AsrSchool,
        isRamadan: Boolean = false,
    ): PrayerDay {
        val lat = at.latitude
        val lng = at.longitude
        val jd0 = Astro.julianDay(year, month, day) - lng / (15 * 24)

        fun noon(t: Double): Double = Astro.fix(12 - Astro.sun(jd0 + t).equationOfTime, 24.0)

        // Hours (local mean time) when the sun is `angle` degrees below the horizon.
        fun angleTime(angle: Double, t: Double, morning: Boolean): Double? {
            val decl = Astro.sun(jd0 + t).declination
            val x = (-Astro.dsin(angle) - Astro.dsin(decl) * Astro.dsin(lat)) / (Astro.dcos(decl) * Astro.dcos(lat))
            if (x < -1 || x > 1) return null // twilight never ends/starts at this latitude today
            val span = Astro.darccos(x) / 15
            return noon(t) + if (morning) -span else span
        }

        fun asrTime(t: Double): Double? {
            val decl = Astro.sun(jd0 + t).declination
            val angle = -Astro.darccot(asr.shadowFactor + Astro.dtan(abs(lat - decl)))
            return angleTime(angle, t, morning = false)
        }

        // Two refinement passes: each one re-evaluates the sun's position at the
        // previous estimate of each time, which converges well within a minute.
        val t = mutableMapOf(
            Prayer.FAJR to 5.0, Prayer.SUNRISE to 6.0, Prayer.DHUHR to 12.0,
            Prayer.ASR to 13.0, Prayer.MAGHRIB to 18.0, Prayer.ISHA to 18.0,
        )
        repeat(2) {
            val p = t.mapValues { it.value / 24 }
            t[Prayer.FAJR] = angleTime(method.fajrAngle, p.getValue(Prayer.FAJR), true) ?: t.getValue(Prayer.FAJR)
            t[Prayer.SUNRISE] = angleTime(0.833, p.getValue(Prayer.SUNRISE), true) ?: t.getValue(Prayer.SUNRISE)
            t[Prayer.DHUHR] = noon(p.getValue(Prayer.DHUHR))
            t[Prayer.ASR] = asrTime(p.getValue(Prayer.ASR)) ?: t.getValue(Prayer.ASR)
            t[Prayer.MAGHRIB] = angleTime(method.maghribAngle ?: 0.833, p.getValue(Prayer.MAGHRIB), false)
                ?: t.getValue(Prayer.MAGHRIB)
            method.ishaAngle?.let { ishaAngle ->
                t[Prayer.ISHA] = angleTime(ishaAngle, p.getValue(Prayer.ISHA), false) ?: t.getValue(Prayer.ISHA)
            }
        }

        val sunset = angleTime(0.833, t.getValue(Prayer.MAGHRIB) / 24, false) ?: t.getValue(Prayer.MAGHRIB)
        val night = 24 - (sunset - t.getValue(Prayer.SUNRISE))
        val interval = (if (isRamadan) method.ramadanIshaInterval else null) ?: method.ishaInterval
        if (interval != null) t[Prayer.ISHA] = t.getValue(Prayer.MAGHRIB) + interval / 60
        // High-latitude safety net ("one-seventh of the night") for days when the
        // sun never reaches the twilight angle. Never triggers in tropical Asia.
        val fajrSevenths = t.getValue(Prayer.SUNRISE) - night / 7
        if (angleTime(method.fajrAngle, t.getValue(Prayer.FAJR) / 24, true) == null) t[Prayer.FAJR] = fajrSevenths
        val ishaAngle = method.ishaAngle
        if (ishaAngle != null && angleTime(ishaAngle, t.getValue(Prayer.ISHA) / 24, false) == null) {
            t[Prayer.ISHA] = sunset + night / 7
        }

        val midnightUTC = Astro.utcMidnight(year, month, day)
        val times = Prayer.all.associateWith { prayer ->
            val hoursUTC = t.getValue(prayer) - lng / 15
            val seconds = hoursUTC * 3600 + (method.offsets[prayer] ?: 0.0) * 60
            // Round UP to the whole minute: a time is never shown earlier than it is.
            val minutes = ceil(seconds / 60)
            midnightUTC.plusSeconds((minutes * 60).toLong())
        }
        return PrayerDay(year, month, day, times)
    }

    /** Convenience: the prayer day for the local calendar date containing [instant] in [zone]. */
    fun compute(
        instant: Instant, zone: ZoneId,
        at: Coordinates, method: CalculationMethod, asr: AsrSchool, hijriAdjustment: Int = 0,
    ): PrayerDay {
        val d = instant.atZone(zone).toLocalDate()
        val ramadan = Hijri.isRamadan(instant, zone, hijriAdjustment)
        return compute(d.year, d.monthValue, d.dayOfMonth, at, method, asr, ramadan)
    }
}

object Astro {
    private const val RAD = Math.PI / 180

    fun dsin(d: Double) = sin(d * RAD)
    fun dcos(d: Double) = cos(d * RAD)
    fun dtan(d: Double) = tan(d * RAD)
    fun darcsin(x: Double) = asin(x) / RAD
    fun darccos(x: Double) = acos(min(1.0, max(-1.0, x))) / RAD
    fun darctan2(y: Double, x: Double) = atan2(y, x) / RAD
    fun darccot(x: Double) = atan(1 / x) / RAD

    fun fix(a: Double, b: Double): Double {
        val r = a - b * floor(a / b)
        return if (r < 0) r + b else r
    }

    fun julianDay(year: Int, month: Int, day: Int): Double {
        var y = year
        var m = month
        if (m <= 2) { y -= 1; m += 12 }
        val a = (y / 100).toDouble()
        val b = 2 - a + floor(a / 4)
        return floor(365.25 * (y + 4716)) + floor(30.6001 * (m + 1)) + day + b - 1524.5
    }

    data class Sun(val declination: Double, val equationOfTime: Double)

    fun sun(jd: Double): Sun {
        val d = jd - 2451545.0
        val g = fix(357.529 + 0.98560028 * d, 360.0)
        val q = fix(280.459 + 0.98564736 * d, 360.0)
        val l = fix(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g), 360.0)
        val e = 23.439 - 0.00000036 * d
        val ra = darctan2(dcos(e) * dsin(l), dcos(l)) / 15
        val eqt = q / 15 - fix(ra, 24.0)
        val decl = darcsin(dsin(e) * dsin(l))
        return Sun(decl, eqt)
    }

    /** Julian day of an instant. */
    fun jd(instant: Instant): Double = instant.epochSeconds() / 86_400 + 2_440_587.5

    /**
     * The sun's altitude above the horizon in degrees at an instant and place
     * (negative below the horizon). Drives the Today screen's sun path.
     */
    fun sunAltitude(at: Instant, c: Coordinates): Double {
        val (decl, eqt) = sun(jd(at))
        val utcHours = fix(at.epochSeconds() / 3600, 24.0)
        val hourAngle = 15 * (utcHours + c.longitude / 15 + eqt - 12)
        return darcsin(dsin(c.latitude) * dsin(decl) + dcos(c.latitude) * dcos(decl) * dcos(hourAngle))
    }

    fun utcMidnight(year: Int, month: Int, day: Int): Instant =
        LocalDate.of(year, month, day).atStartOfDay().toInstant(ZoneOffset.UTC)
}

/** Seconds since the epoch, with the fraction. */
fun Instant.epochSeconds(): Double = epochSecond + nano / 1e9

/** An instant from fractional epoch seconds. */
fun instantOfSeconds(seconds: Double): Instant {
    val whole = floor(seconds)
    return Instant.ofEpochSecond(whole.toLong(), ((seconds - whole) * 1e9).toLong())
}

/** [this] plus a fractional number of seconds. */
fun Instant.plusSecondsD(seconds: Double): Instant = instantOfSeconds(epochSeconds() + seconds)

/** Seconds from [other] to this instant (positive when this is later). */
fun Instant.secondsSince(other: Instant): Double = epochSeconds() - other.epochSeconds()
