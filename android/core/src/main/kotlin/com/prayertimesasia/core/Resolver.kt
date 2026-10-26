package com.prayertimesasia.core

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.max

/**
 * Where you are, which rules apply there, and the day's times - the iOS
 * AppModel's logic without any UI, so the app, the alarms and the widgets all
 * agree. Immutable: build a new one when anything changes.
 */
class Resolver(
    val prefs: Preferences,
    /** The place resolved from the latest GPS fix. */
    val gpsPlace: Place? = null,
    /** A downloaded official table row, if cached. */
    private val officialTimes: (OfficialSource, Int, Int, Int) -> Map<Prayer, String>? = { _, _, _, _ -> null },
    val mosques: MosqueDataset = MosqueDataset.empty,
    /** The phone's language and region, for your names when you haven't chosen. */
    private val locale: java.util.Locale = java.util.Locale.getDefault(),
    private val systemZone: ZoneId = ZoneId.systemDefault(),
) {
    val activePlace: Place? get() = if (prefs.useGPS) gpsPlace ?: prefs.manualPlace else prefs.manualPlace

    val profile: CountryProfile get() = activePlace?.profile ?: AsiaRegions.fallback

    val method: CalculationMethod get() = CalculationMethod.withId(prefs.methodOverrideId) ?: profile.method

    val isMethodAutomatic: Boolean get() = prefs.methodOverrideId == null
    val asrSchool: AsrSchool get() = prefs.asrOverride ?: profile.asr

    /** Your prayer names - from your home or your phone, not from where you are. */
    val naming: NamingStyle get() = prefs.namingOverride ?: personalNaming
    val personalNaming: NamingStyle get() = NamingStyle.personal(prefs.home?.countryCode, locale)
    /** The words used where you are (the masjid's signs). */
    val localNaming: NamingStyle get() = profile.naming

    /** The local word for a prayer, when it differs from yours. */
    fun localName(prayer: Prayer, time: Instant): String? {
        if (!prefs.showLocalNames || localNaming == naming) return null
        val local = prayer.name(localNaming, isFriday(time))
        return if (local == prayer.name(naming, isFriday(time))) null else local
    }

    /** Whose Ramadan and Eid dates you follow (calendar sanad). */
    val communityAuthority: String?
        get() = prefs.communityAuthority
            ?: CalendarSanad.defaultAuthority((prefs.home ?: activePlace)?.profile?.code ?: profile.code)

    val zone: ZoneId get() = activePlace?.zone ?: systemZone

    val musafirRules: Musafir.Rules
        get() = Musafir.Rules(asrSchool, if (asrSchool == AsrSchool.HANAFI) 78.0 else prefs.musafirThresholdKm)

    fun daysHere(now: Instant): Int {
        val arrived = prefs.arrivedAt ?: return 0
        return max(0, ChronoUnit.DAYS.between(Instant.ofEpochMilli(arrived).atZone(systemZone), now.atZone(systemZone)).toInt())
    }

    fun musafirStatus(now: Instant): Musafir.Status? {
        val place = activePlace ?: return null
        return Musafir.status(prefs.home?.coordinates, place.coordinates, daysHere(now), musafirRules)
    }

    /** The official table that applies here (MUIS / JAKIM / Kemenag), if any. */
    val officialSource: OfficialSource?
        get() = activePlace?.let { Official.source(it, method, prefs.jakimZoneOverride) }

    /** The mosque profile (Grade B) covering where you are, if any. */
    val nearbyMosque: MosqueProfile? get() = activePlace?.let { mosques.profile(it.coordinates) }

    /**
     * Official table (A) → nearby mosque's own timetable (B) → calculation with
     * the country's method (D; A when the method itself is the authority's exact
     * published rule, as with Umm al-Qura).
     */
    fun day(containing: Instant): PrayerDay? {
        val place = activePlace ?: return null
        val mosque = mosques.profile(place.coordinates)
        val zone = place.zone
        val computed = PrayerEngine.compute(containing, zone, place.coordinates, method, asrSchool)
        val source = officialSource
        val table = source?.let { officialTimes(it, computed.year, computed.month, computed.day) }
        val tableTimes = table?.let { times(it, computed, zone, keepAsrFrom = if (asrSchool == AsrSchool.HANAFI) computed else null) }
        var result: PrayerDay
        if (source != null && tableTimes != null) {
            result = PrayerDay(computed.year, computed.month, computed.day, tableTimes,
                officialSource = source.label, grade = SourceGrade.OFFICIAL)
            val mosqueMethod = mosque?.method
            if (mosque != null && mosqueMethod != null) {
                val theirs = PrayerEngine.compute(containing, zone, place.coordinates, mosqueMethod,
                    prefs.asrOverride ?: mosque.asrSchool ?: asrSchool)
                val alt = disagreements(result, theirs)
                result = result.copy(alternate = alt, alternateSource = if (alt.isEmpty()) null else mosque.name)
            }
        } else if (isMethodAutomatic && mosque?.method != null) {
            result = PrayerEngine.compute(containing, zone, place.coordinates, mosque.method!!,
                prefs.asrOverride ?: mosque.asrSchool ?: asrSchool)
            result = result.copy(grade = mosque.grade, officialSource = "${mosque.name} timetable")
        } else {
            result = computed.copy(grade = if (method.id == "ummalqura") SourceGrade.OFFICIAL else SourceGrade.CALCULATED)
        }
        if (mosque != null) {
            result = result.copy(
                mosqueName = mosque.name,
                jamaah = mosque.jamaahTimes(result, zone, isFriday(result.time(Prayer.DHUHR))),
            )
        }
        return result
    }

    /** The next obligatory prayer (or sunrise, which ends Subuh) after [now]. */
    fun next(after: Instant): Pair<Prayer, Instant>? {
        val today = day(after) ?: return null
        today.ordered.firstOrNull { it.second > after }?.let { return it }
        val tomorrow = day(after.plusSeconds(86_400)) ?: return null
        return Prayer.FAJR to tomorrow.time(Prayer.FAJR)
    }

    /** The period we're in: the last time that has passed (Isha carries over past midnight). */
    fun current(at: Instant): Pair<Prayer, Instant>? {
        val today = day(at) ?: return null
        today.ordered.lastOrNull { it.second <= at }?.let { return it }
        val yesterday = day(at.minusSeconds(86_400)) ?: return null
        return Prayer.ISHA to yesterday.time(Prayer.ISHA)
    }

    /** The prayer day [offset] local days from the one containing [now]. */
    fun day(now: Instant, offset: Int): PrayerDay? {
        if (offset == 0) return day(now)
        val local = now.atZone(zone).toLocalDate().plusDays(offset.toLong())
        return day(local.atTime(LocalTime.NOON).atZone(zone).toInstant())
    }

    fun isFriday(instant: Instant): Boolean = instant.atZone(zone).dayOfWeek == DayOfWeek.FRIDAY

    fun formatted(instant: Instant): String = TimeFormat.formatted(instant, zone, prefs.use24Hour)
    fun timeParts(instant: Instant): Pair<String, String?> = TimeFormat.parts(instant, zone, prefs.use24Hour)

    fun prayerName(prayer: Prayer, time: Instant): String = prayer.name(naming, isFriday(time))

    /** Local calendar key ("yyyy-MM-dd") for an instant at the active place. */
    fun dayKey(instant: Instant): String = instant.atZone(zone).toLocalDate().toString()

    fun isPrayed(prayer: Prayer, on: Instant): Boolean = prefs.prayedLog[dayKey(on)]?.contains(prayer) ?: false
    fun isExcused(on: Instant): Boolean = dayKey(on) in prefs.excusedDays

    /**
     * Consecutive days with all five prayers marked (or excused). Today counts
     * once complete; an unfinished today doesn't break the streak.
     */
    fun streak(now: Instant): Int {
        var count = 0
        var date: LocalDate = now.atZone(zone).toLocalDate()
        for (i in 0 until 400) {
            val key = date.toString()
            val complete = key in prefs.excusedDays || (prefs.prayedLog[key]?.size ?: 0) >= Prayer.obligatory.size
            if (complete) count++ else if (i > 0) break
            date = date.minusDays(1)
        }
        return count
    }

    /** Blessed times for a shown day (Show more). */
    fun blessedTimes(shown: PrayerDay): List<Pair<BlessedTime, Instant>> {
        val place = activePlace ?: return emptyList()
        val nextDay = day(shown.time(Prayer.DHUHR).plusSeconds(86_400)) ?: return emptyList()
        val ramadan = Hijri.isRamadan(shown.time(Prayer.DHUHR), zone, prefs.hijriAdjustment)
        return BlessedTime.compute(shown, nextDay, place.coordinates, ramadan)
    }

    fun hijri(instant: Instant): String = Hijri.format(instant, zone, naming, prefs.hijriAdjustment)

    companion object {
        /** Prayers where [other] differs from [day] by more than 2 minutes. */
        fun disagreements(day: PrayerDay, other: PrayerDay): Map<Prayer, Instant> =
            Prayer.obligatory.filter { abs(other.time(it).secondsSince(day.time(it))) > 120 }
                .associateWith { other.time(it) }

        private fun times(table: Map<Prayer, String>, day: PrayerDay, zone: ZoneId, keepAsrFrom: PrayerDay?): Map<Prayer, Instant>? {
            val out = mutableMapOf<Prayer, Instant>()
            for (prayer in Prayer.all) {
                // Official tables are Shafi'i; a Hanafi user keeps the calculated Asr.
                if (prayer == Prayer.ASR && keepAsrFrom != null) { out[prayer] = keepAsrFrom.time(Prayer.ASR); continue }
                val parts = table[prayer]?.split(":")?.mapNotNull { it.toIntOrNull() } ?: return null
                if (parts.size != 2 || parts[0] !in 0..23 || parts[1] !in 0..59) return null
                out[prayer] = LocalDate.of(day.year, day.month, day.day).atTime(parts[0], parts[1]).atZone(zone).toInstant()
            }
            return out
        }
    }
}
