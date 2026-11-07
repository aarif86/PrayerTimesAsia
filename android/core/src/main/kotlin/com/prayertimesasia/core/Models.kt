package com.prayertimesasia.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.ZoneId
import java.util.UUID

@Serializable
data class Place(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val region: String? = null,
    val countryCode: String? = null,
    val countryName: String? = null,
    val timeZoneId: String,
    val coordinates: Coordinates,
    /** Regency / city level (e.g. "Kota Bandung"). Used to find the Kemenag timetable in Indonesia. */
    val district: String? = null,
) {
    val zone: ZoneId get() = runCatching { ZoneId.of(timeZoneId) }.getOrElse { ZoneId.systemDefault() }
    val profile: CountryProfile get() = AsiaRegions.profile(countryCode) ?: AsiaRegions.fallback
    val isInAsia: Boolean get() = AsiaRegions.profile(countryCode) != null

    val subtitle: String
        get() = listOfNotNull(region, countryName).filter { it != name }.joinToString(", ")

    /** Same spot for our purposes (prayer times differ by < 1 min within ~15 km). */
    fun isNear(other: Place): Boolean = Geo.distanceKm(coordinates, other.coordinates) < 2
}

@Serializable
data class TripStop(
    val id: String = UUID.randomUUID().toString(),
    val countryCode: String,
    val countryName: String,
    val placeName: String,
    /** Epoch milliseconds. */
    val arrived: Long,
)

/** When the Subuh wake-up alarm rings, relative to Subuh or Syuruk. In the order of the night. */
@Serializable
enum class WakeUpTiming(val part: Part, private val minutes: Int) {
    @SerialName("fajrMinus30") FAJR_MINUS_30(Part.BEFORE_FAJR, -30),
    @SerialName("atFajr") AT_FAJR(Part.FROM_FAJR, 0),
    @SerialName("fajrPlus5") FAJR_PLUS_5(Part.FROM_FAJR, 5),
    @SerialName("fajrPlus10") FAJR_PLUS_10(Part.FROM_FAJR, 10),
    @SerialName("fajrPlus15") FAJR_PLUS_15(Part.FROM_FAJR, 15),
    @SerialName("fajrPlus30") FAJR_PLUS_30(Part.FROM_FAJR, 30),
    @SerialName("sunriseMinus60") SUNRISE_MINUS_60(Part.BEFORE_SUNRISE, 60),
    @SerialName("sunriseMinus45") SUNRISE_MINUS_45(Part.BEFORE_SUNRISE, 45),
    @SerialName("sunriseMinus30") SUNRISE_MINUS_30(Part.BEFORE_SUNRISE, 30),
    @SerialName("sunriseMinus15") SUNRISE_MINUS_15(Part.BEFORE_SUNRISE, 15);

    /** The heading each choice sits under in the list. */
    enum class Part { BEFORE_FAJR, FROM_FAJR, BEFORE_SUNRISE }

    fun label(naming: NamingStyle): String {
        val fajr = Prayer.FAJR.name(naming)
        val sunrise = Prayer.SUNRISE.name(naming)
        return when {
            this == FAJR_MINUS_30 -> "30 min before $fajr for tahajjud"
            this == AT_FAJR -> "At $fajr"
            this == SUNRISE_MINUS_60 -> "1 hour before $sunrise"
            part == Part.BEFORE_SUNRISE -> "$minutes min before $sunrise"
            else -> "$minutes min after $fajr begins"
        }
    }

    fun date(day: PrayerDay): java.time.Instant =
        if (part == Part.BEFORE_SUNRISE) {
            // Where Subuh to Syuruk is short, never ring before Subuh has begun.
            maxOf(day.time(Prayer.FAJR), day.time(Prayer.SUNRISE).minusSeconds(minutes * 60L))
        } else {
            day.time(Prayer.FAJR).plusSeconds(minutes * 60L)
        }
}

/** The second, earlier alarm for sahur (or a longer night prayer), before Subuh. */
@Serializable
enum class SahurTiming(val minutes: Int) {
    @SerialName("fajrMinus60") FAJR_MINUS_60(60),
    @SerialName("fajrMinus90") FAJR_MINUS_90(90),
    @SerialName("fajrMinus120") FAJR_MINUS_120(120);

    fun label(naming: NamingStyle): String {
        val fajr = Prayer.FAJR.name(naming)
        return when (this) {
            FAJR_MINUS_60 -> "1 hour before $fajr"
            FAJR_MINUS_90 -> "1 hour 30 min before $fajr"
            FAJR_MINUS_120 -> "2 hours before $fajr"
        }
    }

    fun date(day: PrayerDay): java.time.Instant = day.time(Prayer.FAJR).minusSeconds(minutes * 60L)
}

/**
 * Alarms for the other four prayers (Subuh has [WakeUpTiming]): for heavy
 * sleepers, a nap before Asar, or someone who keeps putting a prayer off.
 */
@Serializable
enum class PrayerAlarmTiming(val raw: String, private val minutes: Int) {
    @SerialName("atStart") AT_START("atStart", 0),
    @SerialName("plus5") PLUS_5("plus5", 5),
    @SerialName("plus10") PLUS_10("plus10", 10),
    @SerialName("plus15") PLUS_15("plus15", 15),
    @SerialName("plus30") PLUS_30("plus30", 30),
    @SerialName("endMinus30") END_MINUS_30("endMinus30", 0);

    /** Short, as it sits in the row beside the prayer's name. */
    val label: String
        get() = when (this) {
            AT_START -> "On time"
            END_MINUS_30 -> "30 min before it ends"
            else -> "$minutes min after"
        }

    /** When it rings, given the prayer's start and its end (the next prayer). */
    fun date(start: java.time.Instant, end: java.time.Instant): java.time.Instant =
        // A short window (Maghrib far north): never before the prayer has begun.
        if (this == END_MINUS_30) maxOf(start, end.minusSeconds(30 * 60L)) else start.plusSeconds(minutes * 60L)

    companion object {
        val prayers: List<Prayer> = listOf(Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

        /** The choices for one prayer. Isyak is open until Subuh, so it has no "before it ends". */
        fun choices(prayer: Prayer): List<PrayerAlarmTiming> =
            if (prayer == Prayer.ISHA) entries.filter { it != END_MINUS_30 } else entries

        /** The prayer's end in this day: the next prayer (Isyak's own start; it has no "before it ends"). */
        fun end(prayer: Prayer, day: PrayerDay): java.time.Instant = when (prayer) {
            Prayer.DHUHR -> day.time(Prayer.ASR)
            Prayer.ASR -> day.time(Prayer.MAGHRIB)
            else -> day.time(Prayer.ISHA)
        }

        fun of(raw: String?): PrayerAlarmTiming? = entries.firstOrNull { it.raw == raw }
    }
}

/**
 * The sound every alarm plays. Classic is the phone's default alarm sound; the
 * others are our own tones in res/raw (tools/make_alarm_sounds.py); PHONE is a
 * ringtone picked from the phone ([Preferences.alarmRingtone]).
 */
@Serializable
enum class AlarmSound(val raw: String, val label: String) {
    @SerialName("classic") CLASSIC("classic", "Classic alarm"),
    @SerialName("chime") CHIME("chime", "Gentle chime"),
    @SerialName("bells") BELLS("bells", "Rising bells"),
    @SerialName("beeps") BEEPS("beeps", "Soft beeps"),
    @SerialName("phone") PHONE("phone", "From my phone");

    companion object {
        fun of(raw: String?): AlarmSound? = entries.firstOrNull { it.raw == raw }
    }
}

/** Which mornings the sahur alarm rings: the days people usually fast. */
@Serializable
enum class SahurDay(val raw: String, val label: String) {
    @SerialName("ramadan") RAMADAN("ramadan", "Ramadan"),
    @SerialName("monThu") MON_THU("monThu", "Mondays and Thursdays"),
    @SerialName("whiteDays") WHITE_DAYS("whiteDays", "White days (13, 14 and 15 of the Hijri month)"),
    @SerialName("everyDay") EVERY_DAY("everyDay", "Every day");

    companion object {
        val DEFAULT: Set<SahurDay> = setOf(RAMADAN, MON_THU)

        /** Does the sahur alarm ring before Subuh on this day? */
        fun rings(day: PrayerDay, days: Set<SahurDay>, zone: java.time.ZoneId, hijriAdjustment: Int): Boolean {
            if (EVERY_DAY in days) return true
            if (MON_THU in days) {
                val weekday = java.time.LocalDate.of(day.year, day.month, day.day).dayOfWeek
                if (weekday == java.time.DayOfWeek.MONDAY || weekday == java.time.DayOfWeek.THURSDAY) return true
            }
            if (RAMADAN in days || WHITE_DAYS in days) {
                val h = Hijri.date(day.time(Prayer.DHUHR), zone, hijriAdjustment)
                if (RAMADAN in days && h.month == 9) return true
                // Not on 13 Zulhijjah, a day of Tashreeq when fasting is not allowed.
                if (WHITE_DAYS in days && h.day in 13..15 && !(h.month == 12 && h.day == 13)) return true
            }
            return false
        }
    }
}

/** Light, dark, or follow the sky. */
@Serializable
enum class Appearance {
    @SerialName("system") SYSTEM, @SerialName("light") LIGHT, @SerialName("dark") DARK;

    val label: String
        get() = when (this) {
            SYSTEM -> "Automatic (follows the sky)"
            LIGHT -> "Light"
            DARK -> "Dark"
        }
}

/** How the Prayer screen shows the day. */
@Serializable
enum class TodayStyle {
    /** The Day Dial centred at the top, then the day and the list. The default. */
    @SerialName("centre") CENTRE,
    /** "Side Dial": the Day Dial beside the date, the list below. */
    @SerialName("list") LIST,
    /** The Day Dial fills the screen, every time inside it at its hour. */
    @SerialName("dial") DIAL,
    /** The sun's arc across the top, the current prayer small at the top left, then the list. */
    @SerialName("sunPath") SUN_PATH,
    /** Each prayer a full-width band of colour, like the classic Singapore timetable. */
    @SerialName("bands") BANDS,
    /** Big and Simple: the prayer now, the time left, and five big rows. For older eyes. */
    @SerialName("simple") SIMPLE;

    val label: String
        get() = when (this) {
            LIST -> "Side Dial"
            CENTRE -> "Centre Dial"
            DIAL -> "Day Dial"
            SUN_PATH -> "Sun Path"
            BANDS -> "Colour Bands"
            SIMPLE -> "Big and Simple"
        }
}

/**
 * Everything the user chooses, persisted as one JSON blob. Null overrides mean
 * "automatic for the country I'm in" - the travel-mode behaviour. Every field
 * has a default, so adding a preference never throws away the ones already set.
 */
@Serializable
data class Preferences(
    val hasOnboarded: Boolean = false,
    val useGPS: Boolean = true,
    val manualPlace: Place? = null,
    val savedPlaces: List<Place> = emptyList(),
    val home: Place? = null,

    val methodOverrideId: String? = null,
    val asrOverride: AsrSchool? = null,
    val namingOverride: NamingStyle? = null,
    val use24Hour: Boolean = false,
    val hijriAdjustment: Int = 0,

    val notificationsEnabled: Boolean = false,
    val notifyPrayers: Set<Prayer> = Prayer.obligatory.toSet(),
    /** Minutes before each chosen prayer for "Reminder before prayer"; 0 = off. Separate from the alert at the time itself. */
    val reminderMinutesBefore: Int = 0,
    /** Prayer time alerts play the azan (a Subuh azan at Subuh) when the app has the recordings. */
    val azanSound: Boolean = true,

    val musafirThresholdKm: Double = 81.0,
    /** Pinned JAKIM zone; null = nearest to where you are. */
    val jakimZoneOverride: String? = null,

    // Travel-mode memory
    val lastCountryCode: String? = null,
    /** Epoch milliseconds. */
    val arrivedAt: Long? = null,
    val arrivalBannerDismissed: Boolean = true,
    val trip: List<TripStop> = emptyList(),

    // Prayer tracker (opt-in)
    val trackerEnabled: Boolean = false,
    /** "yyyy-MM-dd" (local date) → prayers marked as prayed. */
    val prayedLog: Map<String, Set<Prayer>> = emptyMap(),
    /** Days excused (haid, illness, ...): they keep the streak alive. */
    val excusedDays: Set<String> = emptySet(),
    /** "yyyy-MM-dd" the tracker was paused (haid, nifas, illness); every day from then until the pause ends counts as excused. */
    val trackerPausedSince: String? = null,

    /** Subuh wake-up alarm; null = off. */
    val wakeUp: WakeUpTiming? = null,
    /** The earlier sahur alarm; null = off. Rings only on [sahurDays]. */
    val sahurAlarm: SahurTiming? = null,
    val sahurDays: Set<SahurDay> = SahurDay.DEFAULT,
    /** Alarms for the other prayers; null = off. */
    val dhuhrAlarm: PrayerAlarmTiming? = null,
    val asrAlarm: PrayerAlarmTiming? = null,
    val maghribAlarm: PrayerAlarmTiming? = null,
    val ishaAlarm: PrayerAlarmTiming? = null,
    /** The sound every alarm plays. */
    val alarmSound: AlarmSound = AlarmSound.CLASSIC,
    /** The ringtone picked from this phone for [AlarmSound.PHONE]; never moved to another phone. */
    val alarmRingtone: String? = null,
    /** Whose Ramadan/Eid dates you follow; null = the authority of your home country. */
    val communityAuthority: String? = null,

    val appearance: Appearance = Appearance.SYSTEM,
    val todayStyle: TodayStyle = TodayStyle.CENTRE,
    /** The makers' own offers (Badal, NasarDigital) on the Prayer and Masjid screens. */
    val showOffers: Boolean = true,
    /** Travel concessions (jamak, qasar) and the Journey screen. Off until the user turns it on. */
    val musafirEnabled: Boolean = false,
    /** Under each prayer, the word used where you are, when it differs from yours. */
    val showLocalNames: Boolean = true,
    /** The "Turn on prayer alerts" bar on the Prayer screen was closed. */
    val alertsPromptDismissed: Boolean = false,
    /** Show the blessed times (Dhuha, the middle and last third of the night). */
    val showMore: Boolean = false,
    /** The Falak shadow stick, centimetres. */
    val stickHeight: Double = 100.0,
    /** The masjid whose iqamah times show on the Prayer screen, from its screen's QR code. */
    val myMasjid: MasjidLink? = null,
    /** Anonymous usage counts (city and country, never coordinates). See the app's UsageCounter. */
    val shareUsage: Boolean = true,

    // Ramadan and Syawal
    /** For testers: pretend today is a day in Ramadan or Syawal. Never moved to another phone. */
    val seasonPreview: SeasonPreview = SeasonPreview.OFF,
    /** "Imsak in 10 minutes" in Ramadan. */
    val imsakAlert: Boolean = true,
    /** "Time to berbuka" at Maghrib in Ramadan. */
    val berbukaAlert: Boolean = true,
    /** The last ten nights: a gentle alert at the last third of the night. */
    val qiyamAlert: Boolean = false,
    /** A juz a day to finish the Quran in the month. */
    val khatamPlan: Boolean = false,
    /** "yyyy-MM-dd" → how that day's fast went. */
    val fastLog: Map<String, FastMark> = emptyMap(),
    /** Days Tarawih was prayed. */
    val tarawihLog: Set<String> = emptySet(),
    /** Days the day's juz was read. */
    val quranLog: Set<String> = emptySet(),
    /** Hijri years zakat fitrah was paid. */
    val zakatPaid: Set<Int> = emptySet(),
    /** Tracker users: one nudge before a prayer's time runs out, if it isn't ticked. */
    val windowNudge: Boolean = true,
    /** Alerts only buzz between these minutes past midnight; Subuh keeps its sound. */
    val quietHours: Boolean = false,
    val quietFrom: Int = 23 * 60,
    val quietTo: Int = 6 * 60,
    /** Every alert buzzes only, never a sound. */
    val buzzOnly: Boolean = false,
    /** Bigger text everywhere, for older eyes. */
    val largeText: Boolean = false,
    /** Fridays: a reminder this many minutes before Jumaat (0 = off). */
    val jumuahReminderMinutes: Int = 0,
) {
    fun encode(): String = CoreJson.encodeToString(serializer(), this)

    /** The alarm for one of the other four prayers. */
    fun alarm(prayer: Prayer): PrayerAlarmTiming? = when (prayer) {
        Prayer.DHUHR -> dhuhrAlarm
        Prayer.ASR -> asrAlarm
        Prayer.MAGHRIB -> maghribAlarm
        Prayer.ISHA -> ishaAlarm
        else -> null
    }

    fun withAlarm(prayer: Prayer, timing: PrayerAlarmTiming?): Preferences = when (prayer) {
        Prayer.DHUHR -> copy(dhuhrAlarm = timing)
        Prayer.ASR -> copy(asrAlarm = timing)
        Prayer.MAGHRIB -> copy(maghribAlarm = timing)
        Prayer.ISHA -> copy(ishaAlarm = timing.takeIf { it != PrayerAlarmTiming.END_MINUS_30 })
        else -> this
    }

    /** Is any alarm on: Subuh, sahur or one of the other prayers? */
    val anyAlarm: Boolean
        get() = wakeUp != null || sahurAlarm != null || PrayerAlarmTiming.prayers.any { alarm(it) != null }

    /** An alarm at the very start of this prayer rings instead of its alert. */
    fun alarmAtStart(prayer: Prayer): Boolean =
        if (prayer == Prayer.FAJR) wakeUp == WakeUpTiming.AT_FAJR else alarm(prayer) == PrayerAlarmTiming.AT_START

    companion object {
        fun decode(text: String?): Preferences =
            (text?.let { runCatching { CoreJson.decodeFromString(serializer(), it) }.getOrNull() } ?: Preferences()).sane()

        /** Times of day must be real ones and the Jumaat reminder one of the choices. */
        private fun Preferences.sane(): Preferences = copy(
            quietFrom = quietFrom.takeIf { it in 0 until 1440 } ?: 23 * 60,
            quietTo = quietTo.takeIf { it in 0 until 1440 } ?: 6 * 60,
            jumuahReminderMinutes = jumuahReminderMinutes.takeIf { it in PrayerWindow.JUMUAH_REMINDER_CHOICES } ?: 0,
            // Isyak is open until Subuh: it has no "before it ends" alarm.
            ishaAlarm = ishaAlarm.takeIf { it != PrayerAlarmTiming.END_MINUS_30 },
        )
    }
}
