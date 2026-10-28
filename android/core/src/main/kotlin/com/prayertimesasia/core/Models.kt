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

/** When the Subuh wake-up alarm rings, relative to Subuh or Syuruk. */
@Serializable
enum class WakeUpTiming {
    @SerialName("atFajr") AT_FAJR,
    @SerialName("fajrPlus15") FAJR_PLUS_15,
    @SerialName("sunriseMinus30") SUNRISE_MINUS_30,
    @SerialName("sunriseMinus15") SUNRISE_MINUS_15;

    fun label(naming: NamingStyle): String {
        val fajr = Prayer.FAJR.name(naming)
        val sunrise = Prayer.SUNRISE.name(naming)
        return when (this) {
            AT_FAJR -> "At $fajr"
            FAJR_PLUS_15 -> "15 min after $fajr begins"
            SUNRISE_MINUS_30 -> "30 min before $sunrise"
            SUNRISE_MINUS_15 -> "15 min before $sunrise"
        }
    }

    fun date(day: PrayerDay): java.time.Instant = when (this) {
        AT_FAJR -> day.time(Prayer.FAJR)
        FAJR_PLUS_15 -> day.time(Prayer.FAJR).plusSeconds(15 * 60)
        SUNRISE_MINUS_30 -> day.time(Prayer.SUNRISE).minusSeconds(30 * 60)
        SUNRISE_MINUS_15 -> day.time(Prayer.SUNRISE).minusSeconds(15 * 60)
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
    val reminderMinutesBefore: Int = 0,

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

    /** Subuh wake-up alarm; null = off. */
    val wakeUp: WakeUpTiming? = null,
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
