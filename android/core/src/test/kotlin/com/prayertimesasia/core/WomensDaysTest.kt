package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Women's days link the fast record and the prayer tracker. Same cases as web/tests/womensDays.test.ts. */
class WomensDaysTest {
    // Ramadan is 10 to 20 March in these tests.
    private val ramadan: (String) -> Boolean = { it >= "2027-03-10" && it <= "2027-03-20" }
    private val fresh = WomensDays(emptyMap(), emptySet(), null)
    private val P = FastMark.PERIOD

    @Test fun markingTodayPeriodPausesAndUndoingClearsBoth() {
        val s = fresh.setFast("2027-03-12", P, "2027-03-12", ramadan)
        assertEquals("2027-03-12", s.trackerPausedSince)
        assertEquals(P, s.fastLog["2027-03-12"])
        assertEquals(fresh, s.setFast("2027-03-12", null, "2027-03-12", ramadan))
    }

    @Test fun markingAnEarlierDayExcusesOnlyThatDay() {
        val s = fresh.setFast("2027-03-11", P, "2027-03-14", ramadan)
        assertNull(s.trackerPausedSince)
        assertEquals(setOf("2027-03-11"), s.excusedDays)
        val back = s.setFast("2027-03-11", FastMark.SICK, "2027-03-14", ramadan)
        assertEquals(emptySet<String>(), back.excusedDays)
        assertEquals(FastMark.SICK, back.fastLog["2027-03-11"])
    }

    @Test fun aPauseReadsAsPeriodAcrossMidnight() {
        val s = fresh.pause("2027-03-12")
        assertEquals(P, s.mark("2027-03-12", "2027-03-12", ramadan))
        assertEquals(P, s.mark("2027-03-13", "2027-03-13", ramadan))
        assertNull(s.mark("2027-03-14", "2027-03-13", ramadan))
        assertNull(s.mark("2027-03-11", "2027-03-13", ramadan))
        val own = s.copy(fastLog = mapOf("2027-03-12" to FastMark.FASTED))
        assertEquals(FastMark.FASTED, own.mark("2027-03-12", "2027-03-13", ramadan))
        assertEquals(mapOf("2027-03-12" to FastMark.FASTED, "2027-03-13" to P), own.effectiveLog("2027-03-13", ramadan))
    }

    @Test fun outsideRamadanAPauseLeavesTheFastsAlone() {
        val s = fresh.pause("2027-03-25")
        assertNull(s.mark("2027-03-25", "2027-03-26", ramadan))
        val ended = s.endPause("2027-03-26", ramadan)
        assertEquals(emptyMap<String, FastMark>(), ended.fastLog)
        assertEquals(setOf("2027-03-25", "2027-03-26"), ended.excusedDays)
    }

    @Test fun endingAPauseKeepsItsRamadanDaysAsPeriod() {
        val s = fresh.pause("2027-03-19").copy(fastLog = mapOf("2027-03-20" to FastMark.FASTED)).endPause("2027-03-22", ramadan)
        assertNull(s.trackerPausedSince)
        assertEquals(mapOf("2027-03-19" to P, "2027-03-20" to FastMark.FASTED), s.fastLog)
        assertEquals(setOf("2027-03-19", "2027-03-20", "2027-03-21", "2027-03-22"), s.excusedDays)
    }

    @Test fun fastingDuringAPauseEndsItTheDayBefore() {
        val s = fresh.pause("2027-03-12").setFast("2027-03-16", FastMark.FASTED, "2027-03-16", ramadan)
        assertNull(s.trackerPausedSince)
        assertEquals(setOf("2027-03-12", "2027-03-13", "2027-03-14", "2027-03-15"), s.excusedDays)
        assertEquals(P, s.fastLog["2027-03-12"])
        assertEquals(P, s.fastLog["2027-03-15"])
        assertEquals(FastMark.FASTED, s.fastLog["2027-03-16"])
    }

    @Test fun changingADayInsideAPauseKeepsThePauseAfterIt() {
        val s = fresh.pause("2027-03-12").setFast("2027-03-13", FastMark.FASTED, "2027-03-15", ramadan)
        assertEquals(setOf("2027-03-12"), s.excusedDays)
        assertEquals("2027-03-14", s.trackerPausedSince)
        assertEquals(P, s.mark("2027-03-15", "2027-03-15", ramadan))
    }

    @Test fun undoingTheFirstDayOfAPauseCancelsIt() {
        assertEquals(fresh, fresh.pause("2027-03-12").setFast("2027-03-12", null, "2027-03-12", ramadan))
    }

    @Test fun periodInsideAPauseDoesNotStartAnother() {
        val s = fresh.pause("2027-03-12").setFast("2027-03-13", P, "2027-03-13", ramadan)
        assertEquals("2027-03-12", s.trackerPausedSince)
        assertEquals(emptySet<String>(), s.excusedDays)
    }

    @Test fun justTodayMarksTheFastAndAgainUndoesBoth() {
        val s = fresh.toggleExcused("2027-03-14", ramadan)
        assertEquals(setOf("2027-03-14"), s.excusedDays)
        assertEquals(P, s.fastLog["2027-03-14"])
        assertEquals(fresh, s.toggleExcused("2027-03-14", ramadan))
        val sick = fresh.copy(fastLog = mapOf("2027-03-15" to FastMark.SICK)).toggleExcused("2027-03-15", ramadan)
        assertEquals(FastMark.SICK, sick.fastLog["2027-03-15"])
    }

    @Test fun aPauseAcrossTheEndOfAMonth() {
        val r: (String) -> Boolean = { it >= "2027-02-25" && it <= "2027-03-05" }
        val s = fresh.pause("2027-02-27").endPause("2027-03-02", r)
        assertEquals(listOf("2027-02-27", "2027-02-28", "2027-03-01", "2027-03-02"), s.fastLog.keys.sorted())
    }
}
