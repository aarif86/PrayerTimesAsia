package com.prayertimesasia.core

import java.time.Instant
import kotlin.math.ceil
import kotlin.math.max

/** The extra times behind "Show more" on the Prayer screen: free, worked out on the phone. */
enum class BlessedTime(val raw: String) {
    IMSAK("imsak"), DHUHA("dhuha"), MIDNIGHT("midnight"), LAST_THIRD("lastThird");

    /**
     * In English for everyone: Singapore's Malay, Chinese and Indian Muslims
     * all read these the same way. (The style is kept for a future translation.)
     */
    @Suppress("UNUSED_PARAMETER")
    fun name(style: NamingStyle): String = when (this) {
        IMSAK -> "Imsak"
        DHUHA -> "Dhuha"
        MIDNIGHT -> "Middle of the night"
        LAST_THIRD -> "Last third of the night"
    }

    /** The dial has room for a word or two. */
    val shortName: String
        get() = when (this) {
            MIDNIGHT -> "Midnight"
            LAST_THIRD -> "Last third"
            else -> name(NamingStyle.INTERNATIONAL)
        }

    /** One line on what the time is and how it is worked out. */
    val note: String
        get() = when (this) {
            IMSAK -> "10 minutes before Subuh - stop eating for the fast"
            DHUHA -> "Sun a spear's length up (about 4½°)"
            MIDNIGHT -> "Halfway from Maghrib to Subuh"
            LAST_THIRD -> "Best time for tahajjud and dua"
        }

    companion object {
        /**
         * Times for the night *after* [day] (Maghrib of [day] to Subuh of [nextDay]),
         * and Dhuha/Imsak of [day]. Imsak only in Ramadan.
         */
        fun compute(day: PrayerDay, nextDay: PrayerDay, coordinates: Coordinates, isRamadan: Boolean): List<Pair<BlessedTime, Instant>> {
            val out = mutableListOf<Pair<BlessedTime, Instant>>()
            if (isRamadan) out += IMSAK to day.time(Prayer.FAJR).minusSeconds(10 * 60)
            val noon = Falak.solarNoon(day.year, day.month, day.day, coordinates.longitude)
            Falak.time(4.5, noon, coordinates, afternoon = false)?.let { dhuha ->
                out += DHUHA to roundUp(maxOf(dhuha, day.time(Prayer.SUNRISE)))
            }
            val night = nextDay.time(Prayer.FAJR).secondsSince(day.time(Prayer.MAGHRIB))
            out += MIDNIGHT to roundUp(day.time(Prayer.MAGHRIB).plusSecondsD(night / 2))
            out += LAST_THIRD to roundUp(day.time(Prayer.MAGHRIB).plusSecondsD(night * 2 / 3))
            return out
        }

        private fun roundUp(d: Instant): Instant = Instant.ofEpochSecond((ceil(d.epochSeconds() / 60) * 60).toLong())
    }
}
