package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Early reminders when away from home. Same cases as web tests/away.test.ts. */
class AwayReminderTest {
    private fun place(name: String, lat: Double, lon: Double) =
        Place(id = name, name = name, timeZoneId = "Asia/Singapore", coordinates = Coordinates(lat, lon))
    private val home = place("Pasir Ris", 1.3721, 103.9474)
    private val near = place("Tampines", 1.3496, 103.9568)
    private val kl = place("Kuala Lumpur", 3.139, 101.6869)
    private val d = AwayReminder.DEFAULT_MINUTES

    @Test fun awayOnlyPastFiveKmFromAConfirmedHome() {
        assertFalse(AwayReminder.isAway(home, true, near))
        assertTrue(AwayReminder.isAway(home, true, kl))
        assertFalse(AwayReminder.isAway(home, false, kl))
        assertFalse(AwayReminder.isAway(null, true, kl))
        assertFalse(AwayReminder.isAway(home, true, null))
    }

    @Test fun cleanKeepsOnlyFivePrayersWithRealChoices() {
        assertEquals(d + ("asr" to 45), AwayReminder.clean(mapOf("asr" to 45, "fajr" to 7, "sunrise" to 15)))
        assertEquals(d, AwayReminder.clean(null))
    }

    @Test fun oneEarlyReminderPerPrayer() {
        assertEquals(60, AwayReminder.minutes(Prayer.ASR, true, true, d, 15, false))
        assertEquals(15, AwayReminder.minutes(Prayer.ASR, true, false, d, 15, false))
        assertEquals(0, AwayReminder.minutes(Prayer.ASR, false, true, d, 0, false))
        assertEquals(0, AwayReminder.minutes(Prayer.FAJR, true, true, d + ("fajr" to 30), 0, true))
        assertEquals(30, AwayReminder.minutes(Prayer.FAJR, true, true, d + ("fajr" to 30), 0, false))
    }

    @Test fun onByDefaultAtOneHourWithFajrOff() {
        val p = Preferences()
        assertTrue(p.awayReminder)
        assertEquals(d, p.awayMinutes)
    }
}
