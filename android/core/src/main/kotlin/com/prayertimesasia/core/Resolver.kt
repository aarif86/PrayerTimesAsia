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
    /** Ramadan and Eid announcements from data/calendar.json. */
    val announcements: List<CalendarAnnouncement> = emptyList(),
) {
    val activePlace: Place? get() = if (prefs.useGPS) gpsPlace ?: prefs.manualPlace else prefs.manualPlace

    val profile: CountryProfile get() = activePlace?.profile ?: AsiaRegions.fallback

    val method: CalculationMethod
        get() = CalculationMethod.withId(prefs.methodOverrideId)?.let(profile::here) ?: profile.method

    val isMethodAutomatic: Boolean get() = prefs.methodOverrideId == null
    /** Whose times these are, in plain words (official timetable, the authority's method, or a standard one). */
    val sourceSummary: String get() = profile.sourceSummary(method, pinned = !isMethodAutomatic)
    /** The same in one sentence or two, for the welcome card. */
    val sourceShort: String get() = profile.sourceSummary(method, pinned = !isMethodAutomatic, short = true)
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

    /** Your masjid, when the place shown is within reach of it (not while travelling). */
    val myMasjidHere: MasjidLink?
        get() {
            val m = prefs.myMasjid ?: return null
            val place = activePlace ?: return null
            return if (Geo.distanceKm(m.coordinates, place.coordinates) <= MasjidLink.RADIUS_KM) m else null
        }

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
        // Jamaah: your own masjid first, else a published masjid profile here.
        val jamaahFrom = myMasjidHere?.profile ?: mosque
        if (jamaahFrom != null) {
            result = result.copy(
                mosqueName = jamaahFrom.name,
                jamaah = jamaahFrom.jamaahTimes(result, zone, isFriday(result.time(Prayer.DHUHR))),
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

    /** The prayer open now and when its time runs out; null between sunrise and Zohor. */
    fun window(now: Instant): PrayerWindow? {
        val today = day(now, 0) ?: return null
        val yesterday = day(now, -1) ?: return null
        val tomorrow = day(now, 1) ?: return null
        return PrayerWindow.open(now, yesterday, today, tomorrow)
    }

    /** Minutes past local midnight at the active place. */
    fun minuteOfDay(instant: Instant): Int = instant.atZone(zone).let { it.hour * 60 + it.minute }

    fun inQuietHours(instant: Instant): Boolean = PrayerWindow.inQuietHours(minuteOfDay(instant), prefs.quietFrom, prefs.quietTo)

    /** Quiet hours and "Buzz only". Subuh always keeps its sound: it is a wake up. */
    fun isSilent(instant: Instant, prayer: Prayer): Boolean = when {
        prefs.buzzOnly -> true
        prayer == Prayer.FAJR -> false
        else -> prefs.quietHours && inQuietHours(instant)
    }

    /** A time of day given as minutes past midnight, "11:00 PM" or "23:00". */
    fun clock(minutes: Int): String {
        val h = (minutes / 60) % 24
        val m = "%02d".format(minutes % 60)
        if (prefs.use24Hour) return "%02d:%s".format(h, m)
        return "${if (h % 12 == 0) 12 else h % 12}:$m ${if (h < 12) "AM" else "PM"}"
    }

    fun isFriday(instant: Instant): Boolean = instant.atZone(zone).dayOfWeek == DayOfWeek.FRIDAY

    fun formatted(instant: Instant): String = TimeFormat.formatted(instant, zone, prefs.use24Hour)
    fun timeParts(instant: Instant): Pair<String, String?> = TimeFormat.parts(instant, zone, prefs.use24Hour)

    fun prayerName(prayer: Prayer, time: Instant): String = prayer.name(naming, isFriday(time))

    /** Local calendar key ("yyyy-MM-dd") for an instant at the active place. */
    fun dayKey(instant: Instant): String = instant.atZone(zone).toLocalDate().toString()

    fun isPrayed(prayer: Prayer, on: Instant): Boolean = prefs.prayedLog[dayKey(on)]?.contains(prayer) ?: false
    fun isExcused(on: Instant): Boolean = isExcused(dayKey(on), dayKey(on))

    /** Marked excused on its own, or inside a pause (from the day it began up to [today]). */
    fun isExcused(key: String, today: String): Boolean {
        if (key in prefs.excusedDays) return true
        val since = prefs.trackerPausedSince ?: return false
        return key >= since && key <= today
    }

    /** How a day went: prayers ticked (of the five) and whether it was excused. */
    fun trackerDay(key: String, today: String): Pair<Int, Boolean> =
        (prefs.prayedLog[key].orEmpty().count { it in Prayer.obligatory }) to isExcused(key, today)

    /**
     * Consecutive days with all five prayers marked (or excused). Today counts
     * once complete; an unfinished today doesn't break the streak.
     */
    fun streak(now: Instant): Int {
        var count = 0
        var date: LocalDate = now.atZone(zone).toLocalDate()
        val today = date.toString()
        for (i in 0 until 400) {
            val key = date.toString()
            val complete = isExcused(key, today) || (prefs.prayedLog[key]?.size ?: 0) >= Prayer.obligatory.size
            if (complete) count++ else if (i > 0) break
            date = date.minusDays(1)
        }
        return count
    }

    /** Blessed times for a shown day (Show more). */
    fun blessedTimes(shown: PrayerDay): List<Pair<BlessedTime, Instant>> {
        val place = activePlace ?: return emptyList()
        val nextDay = day(shown.time(Prayer.DHUHR).plusSeconds(86_400)) ?: return emptyList()
        return BlessedTime.compute(shown, nextDay, place.coordinates, isRamadanDay(shown.time(Prayer.DHUHR)))
    }

    fun hijri(instant: Instant): String {
        val h = hijriOf(instant)
        val name = naming.hijriMonths[(h.month - 1).coerceIn(0, 11)]
        return "${h.day} ${if (naming.isRightToLeft) "\u2068$name\u2069" else name} ${h.year}"
    }

    // MARK: Ramadan and Syawal (core Season.kt)

    fun civil(instant: Instant): LocalDate = instant.atZone(zone).toLocalDate()

    val isSeasonPreview: Boolean get() = prefs.seasonPreview != SeasonPreview.OFF

    /** Days the tester's "Try Ramadan" moves the calendar by (0 when off). */
    val seasonShift: Int by lazy { Season.previewShift(LocalDate.now(zone), prefs.seasonPreview) }

    /** The Hijri date of a civil day as this community counts it. */
    fun hijriOf(g: LocalDate): Hijri.HijriDate =
        if (isSeasonPreview) Season.baseHijri(g.plusDays(seasonShift.toLong()))
        else Season.communityHijri(g, prefs.hijriAdjustment, announcements, communityAuthority)

    fun hijriOf(instant: Instant): Hijri.HijriDate = hijriOf(civil(instant))

    fun isRamadanDay(instant: Instant): Boolean = hijriOf(instant).month == 9

    fun season(at: Instant): Season.Info {
        val h = hijriOf(at)
        var next: Season.NextStart? = null
        if (!isSeasonPreview && h.day >= 27 && (h.month == 8 || h.month == 9)) {
            val event = if (h.month == 8) HijriEvent.RAMADAN else HijriEvent.SYAWAL
            Season.authorityDate(announcements, communityAuthority, event, h.year)?.let { (d, announced) ->
                if (!d.isBefore(civil(at))) next = Season.NextStart(event, d, announced)
            }
        }
        return Season.info(h, next)
    }

    fun dayOf(g: LocalDate): PrayerDay? = day(g.atTime(12, 0).atZone(zone).toInstant())

    /** Imsak: 10 minutes before Subuh, as MUIS, JAKIM and Kemenag publish it. */
    fun imsak(day: PrayerDay): Instant = day.time(Prayer.FAJR).minusSeconds(600)

    enum class FastingKind { IMSAK, BERBUKA }

    /** In Ramadan, the moment to count down to: Imsak before dawn, Berbuka after it, then tomorrow's Imsak. */
    fun fastingMoment(now: Instant): Pair<FastingKind, Instant>? {
        val today = day(now) ?: return null
        if (isRamadanDay(now)) {
            if (now < imsak(today)) return FastingKind.IMSAK to imsak(today)
            if (now < today.time(Prayer.MAGHRIB)) return FastingKind.BERBUKA to today.time(Prayer.MAGHRIB)
        }
        val tomorrow = day(now.plusSeconds(86_400)) ?: return null
        return if (isRamadanDay(tomorrow.time(Prayer.DHUHR))) FastingKind.IMSAK to imsak(tomorrow) else null
    }

    fun monthDays(hijriYear: Int, month: Int): List<LocalDate> =
        Season.monthDays(hijriYear, month, if (isSeasonPreview) seasonShift else 0) { hijriOf(it) }

    fun fastSummary(hijriYear: Int, today: LocalDate): Season.FastSummary =
        Season.fastSummary(hijriYear, today, prefs.fastLog, if (isSeasonPreview) seasonShift else 0) { hijriOf(it) }

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

/** Every "yyyy-MM-dd" from [from] to [to], both included (at most a year). */
fun trackerDays(from: String, to: String): List<String> {
    val start = runCatching { LocalDate.parse(from) }.getOrNull() ?: return emptyList()
    return (0L until 366L).map { start.plusDays(it).toString() }.takeWhile { it <= to }
}
