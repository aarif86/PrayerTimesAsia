package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The long summer days note. Same cases as web/tests/longDays.test.ts. */
class LongDaysTest {
    private val mwl = CalculationMethod.MWL

    @Test fun londonAndOsloAroundMidsummer() {
        assertTrue(LongDays.twilightLastsAllNight(2027, 6, 21, 51.51, mwl))
        assertTrue(LongDays.twilightLastsAllNight(2027, 7, 10, 59.91, mwl))
    }

    @Test fun notInWinterTheTropicsOrSouthernEurope() {
        assertFalse(LongDays.twilightLastsAllNight(2027, 12, 21, 51.51, mwl))
        assertFalse(LongDays.twilightLastsAllNight(2027, 6, 21, 1.35, mwl))
        assertFalse(LongDays.twilightLastsAllNight(2027, 6, 21, 41.01, mwl))
        assertFalse(LongDays.twilightLastsAllNight(2027, 6, 21, -33.87, mwl))
    }

    @Test fun londonStopsOnceNightsAreDarkAgain() {
        assertFalse(LongDays.twilightLastsAllNight(2027, 9, 15, 51.51, mwl))
        assertFalse(LongDays.twilightLastsAllNight(2027, 3, 15, 51.51, mwl))
    }

    @Test fun farSouthInDecember() {
        assertTrue(LongDays.twilightLastsAllNight(2027, 12, 21, -54.8, mwl))
        assertFalse(LongDays.twilightLastsAllNight(2027, 6, 21, -54.8, mwl))
    }

    @Test fun oneKeyPerPlaceAndSummer() {
        assertEquals("GB:52:0:2027", LongDays.key(2027, 6, 51.51, -0.13, "GB"))
        assertEquals("GB:51:0:2027", LongDays.key(2027, 8, 51.4, -0.2, "GB"))
        assertEquals(LongDays.key(2027, 12, -54.8, -68.3, "AR"), LongDays.key(2028, 1, -54.8, -68.3, "AR"))
    }

    @Test fun wordsHaveNoColonsOrDashes() {
        for (lang in RamadanContent.Lang.entries) {
            val w = LongDays.words(lang)
            val text = listOf(w.title, w.body("Fajr", "Isha"), w.close).joinToString(" ")
            assertFalse(text, Regex("[:–—]| - ").containsMatchIn(text))
            assertTrue(text.contains("Fajr"))
        }
    }
}
