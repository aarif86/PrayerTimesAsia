package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** The tracker pause: the same rules as the web and iPhone. */
class TrackerTest {
    private val pasirRis = Place(name = "Pasir Ris", countryCode = "SG", countryName = "Singapore",
        timeZoneId = "Asia/Singapore", coordinates = Coordinates(1.3721, 103.9474))
    private val now = Instant.parse("2026-11-05T05:00:00Z") // 1 pm in Singapore

    @Test fun pauseDaysCrossAMonthEnd() {
        assertEquals(listOf("2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"), trackerDays("2026-10-30", "2026-11-02"))
        assertEquals(listOf("2026-11-05"), trackerDays("2026-11-05", "2026-11-05"))
        assertEquals(emptyList<String>(), trackerDays("2026-11-06", "2026-11-05"))
    }

    @Test fun pausedDaysCountAsExcusedAndKeepTheStreak() {
        val five = Prayer.obligatory.toSet()
        val prefs = Preferences(useGPS = false, manualPlace = pasirRis, trackerEnabled = true, trackerPausedSince = "2026-11-03",
            prayedLog = mapOf("2026-11-01" to five, "2026-11-02" to five))
        val r = Resolver(prefs)
        assertTrue(r.isExcused(now))
        assertTrue(r.isExcused("2026-11-03", "2026-11-05"))
        assertFalse(r.isExcused("2026-11-02", "2026-11-05"))
        assertFalse(r.isExcused("2026-11-06", "2026-11-05")) // days ahead aren't counted yet
        assertEquals(5, r.streak(now)) // 1-2 Nov prayed, 3-5 Nov paused
    }

    @Test fun pauseMovesToAnotherPhone() {
        val p = Preferences(trackerEnabled = true, trackerPausedSince = "2026-11-03")
        val moved = MovedSettings.from(p)
        assertEquals("2026-11-03", moved.trackerPausedSince)
        assertEquals("2026-11-03", moved.appliedTo(Preferences()).trackerPausedSince)
    }
}
