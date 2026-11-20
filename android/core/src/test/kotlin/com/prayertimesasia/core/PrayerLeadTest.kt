package com.prayertimesasia.core

import java.time.Instant
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull

/** What leads the Prayer screen and widgets. Same cases as web/tests/prayerLead.test.ts. */
class PrayerLeadTest {
    private val t = Instant.ofEpochSecond(1_800_000_000)

    @Test fun anOpenPrayerLeadsAsNow() {
        assertEquals(PrayerLead(Prayer.ASR, t, false), PrayerLead.of(Prayer.ASR to t, Prayer.MAGHRIB to t.plusSeconds(3600)))
        assertEquals(Prayer.ASR, PrayerLead.open(Prayer.ASR to t)?.first)
    }

    @Test fun fromSyurukToZohorTheNextPrayerLeads() {
        assertEquals(PrayerLead(Prayer.DHUHR, t.plusSeconds(3180), true), PrayerLead.of(Prayer.SUNRISE to t, Prayer.DHUHR to t.plusSeconds(3180)))
        assertNull(PrayerLead.open(Prayer.SUNRISE to t))
    }

    @Test fun subuhStaysOpenUntilSyuruk() {
        assertEquals(Prayer.FAJR, PrayerLead.of(Prayer.FAJR to t, Prayer.SUNRISE to t.plusSeconds(600))?.prayer)
    }

    @Test fun nothingWithoutTimes() {
        assertNull(PrayerLead.of(null, Prayer.DHUHR to t))
    }
}
