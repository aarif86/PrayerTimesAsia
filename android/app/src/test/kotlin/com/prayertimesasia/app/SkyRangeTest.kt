package com.prayertimesasia.app

import com.prayertimesasia.app.ui.falak.skyRange
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

/** The Falak sky slider always includes the time now, so it opens on now even late at night. */
class SkyRangeTest {
    private val fajr = Instant.parse("2026-11-26T21:30:00Z")   // 5:30 AM SGT on the 27th
    private val isha = Instant.parse("2026-11-27T12:00:00Z")   // 8:00 PM SGT

    @Test fun at_1_20_am_the_slider_starts_at_now() {
        val now = Instant.parse("2026-11-26T17:20:00Z")         // 1:20 AM SGT
        assertEquals(now to isha.plusSeconds(2700), skyRange(fajr, isha, now))
    }

    @Test fun at_midday_the_slider_is_fajr_to_isha_with_45_minutes_each_side() {
        val now = Instant.parse("2026-11-27T05:00:00Z")         // 1:00 PM SGT
        assertEquals(fajr.minusSeconds(2700) to isha.plusSeconds(2700), skyRange(fajr, isha, now))
    }

    @Test fun late_after_isha_the_slider_ends_at_now() {
        val now = Instant.parse("2026-11-27T13:30:00Z")         // 9:30 PM SGT, after Isha plus 45 minutes
        assertEquals(fajr.minusSeconds(2700) to now, skyRange(fajr, isha, now))
    }
}
