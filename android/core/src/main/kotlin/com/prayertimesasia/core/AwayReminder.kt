package com.prayertimesasia.core

/**
 * Early reminders when away from home. Same rules as web core/away.ts and ios Core/AwayReminder.swift.
 *
 * "Away" means the place the app shows is more than [AWAY_KM] from the home the user
 * confirmed. Home and the check stay on the device.
 */
object AwayReminder {
    const val AWAY_KM = 5.0
    /** How early the away reminder can be, in minutes. 0 is off. */
    val CHOICES = listOf(15, 30, 45, 60)
    val PRAYERS = listOf(Prayer.FAJR, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

    /** Fajr starts Off: most people are asleep. The rest start at 1 hour. */
    val DEFAULT_MINUTES: Map<String, Int> = mapOf("fajr" to 0, "dhuhr" to 60, "asr" to 60, "maghrib" to 60, "isha" to 60)

    fun isAway(home: Place?, homeConfirmed: Boolean, here: Place?): Boolean {
        if (home == null || !homeConfirmed || here == null) return false
        return Geo.distanceKm(home.coordinates, here.coordinates) > AWAY_KM
    }

    /** Keep only the five prayers, each with Off or one of the choices. */
    fun clean(raw: Map<String, Int>?): Map<String, Int> {
        val out = DEFAULT_MINUTES.toMutableMap()
        raw?.forEach { (k, v) -> if (k in out && (v == 0 || v in CHOICES)) out[k] = v }
        return out
    }

    /**
     * The one early reminder a prayer gets, in minutes, or 0 for none. Away uses the away
     * choice (when that switch is on), at home uses the old single early reminder.
     */
    fun minutes(prayer: Prayer, away: Boolean, awayOn: Boolean, awayMinutes: Map<String, Int>, atHome: Int, hasAlarm: Boolean): Int {
        if (away && awayOn && prayer != Prayer.SUNRISE) {
            // A Fajr alarm already wakes the person: no early reminder on top of it.
            if (prayer == Prayer.FAJR && hasAlarm) return 0
            return awayMinutes[prayer.raw] ?: 0
        }
        return atHome
    }
}
