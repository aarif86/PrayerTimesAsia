package com.prayertimesasia.core

import java.time.Instant
import kotlin.math.floor

/**
 * How long each prayer stays open, so the Prayer screen can say "Zohor is open
 * until 3:58 PM, 1h 40m left". Shafi'i reckoning, the same as the web
 * (web/src/core/window.ts) and iPhone (PrayerWindow.swift):
 *  - Subuh until sunrise, Zohor until Asar, Asar until Maghrib, Maghrib until Isyak
 *  - Isyak until Subuh (the owner's choice: no midnight line, so Isyak has no
 *    "time running out" nudge, which would fall in the night)
 * Between sunrise and Zohor no obligatory prayer is open.
 */
data class PrayerWindow(val prayer: Prayer, val start: Instant, val end: Instant) {

    /** When the "time is running out" nudge fires: 30 minutes before the end, or a third of a shorter window. */
    val nudgeAt: Instant
        get() {
            val thirdMinutes = floor((end.epochSecond - start.epochSecond) / 3.0 / 60).toLong()
            return end.minusSeconds(minOf(30L, thirdMinutes) * 60)
        }

    companion object {
        /** The windows that start on [day], in order. Isyak runs into [next]. */
        fun windowsOf(day: PrayerDay, next: PrayerDay): List<PrayerWindow> {
            val maghrib = day.time(Prayer.MAGHRIB)
            return listOf(
                PrayerWindow(Prayer.FAJR, day.time(Prayer.FAJR), day.time(Prayer.SUNRISE)),
                PrayerWindow(Prayer.DHUHR, day.time(Prayer.DHUHR), day.time(Prayer.ASR)),
                PrayerWindow(Prayer.ASR, day.time(Prayer.ASR), maghrib),
                PrayerWindow(Prayer.MAGHRIB, maghrib, day.time(Prayer.ISHA)),
                PrayerWindow(Prayer.ISHA, day.time(Prayer.ISHA), next.time(Prayer.FAJR)),
            )
        }

        /** The prayer open at [now], or null between sunrise and Zohor. */
        fun open(now: Instant, yesterday: PrayerDay, today: PrayerDay, tomorrow: PrayerDay): PrayerWindow? =
            (windowsOf(yesterday, today) + windowsOf(today, tomorrow)).firstOrNull { it.start <= now && now < it.end }

        /** Whether a minute of the day (0 to 1439) falls in quiet hours that may wrap past midnight. */
        fun inQuietHours(minute: Int, from: Int, to: Int): Boolean = when {
            from == to -> false
            from < to -> minute in from until to
            else -> minute >= from || minute < to
        }

        /** "Leave for Jumaat": how long before the khutbah. 0 is off. */
        val JUMUAH_REMINDER_CHOICES = listOf(0, 20, 30, 45, 60, 90)
    }
}
