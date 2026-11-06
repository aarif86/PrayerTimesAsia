package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** Ramadan and Syawal follow the authority's announcement. Same cases as web/tests/season.test.ts. */
class SeasonTest {
    // Umm al-Qura: 1 Ramadan 1448 = 8 Feb 2027, 1 Syawal 1448 = 9 Mar 2027.
    private fun ann(event: HijriEvent, date: String, status: CalendarAnnouncement.Status = CalendarAnnouncement.Status.ANNOUNCED) =
        CalendarAnnouncement(event, 1448, "MUIS", "SG", date, status, "rukyah")

    private fun h(y: Int, m: Int, d: Int, list: List<CalendarAnnouncement>, authority: String? = "MUIS") =
        Season.communityHijri(LocalDate.of(y, m, d), 0, list, authority)

    @Test fun ummAlQuraWhenNothingAnnounced() {
        assertEquals(Hijri.HijriDate(1, 9, 1448), h(2027, 2, 8, emptyList()))
    }

    @Test fun ramadanStartsADayLater() {
        val list = listOf(ann(HijriEvent.RAMADAN, "2027-02-09"))
        assertEquals(Hijri.HijriDate(30, 8, 1448), h(2027, 2, 8, list))
        assertEquals(Hijri.HijriDate(1, 9, 1448), h(2027, 2, 9, list))
        assertEquals(Hijri.HijriDate(21, 9, 1448), h(2027, 3, 1, list))
        assertEquals(Hijri.HijriDate(1, 9, 1448), h(2027, 2, 8, list, "JAKIM"))
    }

    @Test fun ramadanEndsOnAnnouncedRaya() {
        val list = listOf(ann(HijriEvent.RAMADAN, "2027-02-09"), ann(HijriEvent.SYAWAL, "2027-03-10"))
        assertEquals(Hijri.HijriDate(29, 9, 1448), h(2027, 3, 9, list))
        assertEquals(Hijri.HijriDate(1, 10, 1448), h(2027, 3, 10, list))
        assertEquals(Hijri.HijriDate(2, 10, 1448), h(2027, 3, 11, list))
    }

    @Test fun announcementBeatsExpected() {
        val list = listOf(ann(HijriEvent.RAMADAN, "2027-02-08", CalendarAnnouncement.Status.EXPECTED), ann(HijriEvent.RAMADAN, "2027-02-09"))
        assertEquals(1, h(2027, 2, 9, list).day)
    }

    @Test fun nights() {
        assertEquals(HijriEvent.RAMADAN, Season.info(Hijri.HijriDate(29, 8, 1448)).sightingTonight)
        assertEquals(1, Season.info(Hijri.HijriDate(29, 8, 1448)).nightTonight)
        val d20 = Season.info(Hijri.HijriDate(20, 9, 1448))
        assertTrue(d20.lastTen)
        assertTrue(d20.oddNight)
        assertFalse(Season.info(Hijri.HijriDate(21, 9, 1448)).oddNight)
        assertEquals(HijriEvent.SYAWAL, Season.info(Hijri.HijriDate(29, 9, 1448)).sightingTonight)
        assertEquals(Season.Phase.RAYA, Season.info(Hijri.HijriDate(1, 10, 1448)).phase)
    }

    @Test fun previewLandsOnTheChosenDay() {
        val today = LocalDate.of(2026, 11, 7)
        val shift = Season.previewShift(today, SeasonPreview.RAMADAN)
        val h = Season.baseHijri(today.plusDays(shift.toLong()))
        assertEquals(9, h.month)
        assertEquals(12, h.day)
        assertEquals(0, Season.previewShift(today, SeasonPreview.OFF))
    }

    @Test fun fastsAndOwed() {
        val hijriOf = { g: LocalDate -> Season.baseHijri(g) }
        val log = mapOf("2027-02-08" to FastMark.FASTED, "2027-02-09" to FastMark.SICK, "2027-03-20" to FastMark.SYAWAL, "2027-04-20" to FastMark.QADHA)
        val sum = Season.fastSummary(1448, LocalDate.of(2027, 5, 1), log, 0, hijriOf)
        assertTrue(sum.days.size in 29..30)
        assertEquals(1, sum.fasted)
        assertEquals(1, sum.missed)
        assertEquals(0, sum.owed)
        assertEquals(1, sum.syawal)
    }
}
