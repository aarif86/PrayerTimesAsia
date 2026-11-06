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
enum class WakeUpTiming {
    @SerialName("fajrMinus30") FAJR_MINUS_30,
    @SerialName("atFajr") AT_FAJR,
    @SerialName("fajrPlus15") FAJR_PLUS_15,
    @SerialName("sunriseMinus30") SUNRISE_MINUS_30,
    @SerialName("sunriseMinus15") SUNRISE_MINUS_15;

    fun label(naming: NamingStyle): String {
        val fajr = Prayer.FAJR.name(naming)
        val sunrise = Prayer.SUNRISE.name(naming)
        return when (this) {
            FAJR_MINUS_30 -> "30 min before $fajr for tahajjud"
            AT_FAJR -> "At $fajr"
            FAJR_PLUS_15 -> "15 min after $fajr begins"
            SUNRISE_MINUS_30 -> "30 min before $sunrise"
            SUNRISE_MINUS_15 -> "15 min before $sunrise"
        }
    }

    fun date(day: PrayerDay): java.time.Instant = when (this) {
        FAJR_MINUS_30 -> day.time(Prayer.FAJR).minusSeconds(30 * 60)
        AT_FAJR -> day.time(Prayer.FAJR)
        FAJR_PLUS_15 -> day.time(Prayer.FAJR).plusSeconds(15 * 60)
        SUNRISE_MINUS_30 -> day.time(Prayer.SUNRISE).minusSeconds(30 * 60)
        SUNRISE_MINUS_15 -> day.time(Prayer.SUNRISE).minusSeconds(15 * 60)
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
    @SerialName("bands") BANDS;

    val label: String
        get() = when (this) {
            LIST -> "Side Dial"
            CENTRE -> "Centre Dial"
            DIAL -> "Day Dial"
            SUN_PATH -> "Sun Path"
            BANDS -> "Colour Bands"
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
) {
    fun encode(): String = CoreJson.encodeToString(serializer(), this)

    companion object {
        fun decode(text: String?): Preferences =
            text?.let { runCatching { CoreJson.decodeFromString(serializer(), it) }.getOrNull() } ?: Preferences()
    }
}
