package com.prayertimesasia.app

import com.prayertimesasia.app.ui.falak.lastThirdStart
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

/** The last third of the night, which the Falak sky slider marks. */
class SkyRangeTest {
    @Test fun last_third_starts_a_third_of_the_night_before_fajr() {
        // Night from 7:05 PM to 5:29 AM next day is 10h24m, so the last third starts 3h28m before Fajr.
        val maghrib = Instant.parse("2026-11-27T11:05:00Z")   // 7:05 PM SGT
        val fajr = Instant.parse("2026-11-27T21:29:00Z")      // 5:29 AM SGT on the 28th
        assertEquals(fajr.minusSeconds(12_480L), lastThirdStart(maghrib, fajr))
    }
}
