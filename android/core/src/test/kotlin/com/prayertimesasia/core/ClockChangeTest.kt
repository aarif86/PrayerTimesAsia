package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Days when the clocks change are 23 or 25 hours long. The Prayer screen, the
 * Ramadan countdown and alerts must step one calendar day at a time, never by
 * adding 24 hours (which can land on the same day twice or skip one).
 */
class ClockChangeTest {
    private val london = Place(name = "London", countryCode = "GB", countryName = "United Kingdom",
        timeZoneId = "Europe/London", coordinates = Coordinates(51.5074, -0.1278))
    private val zone = ZoneId.of("Europe/London")
    private val r = Resolver(Preferences(useGPS = false, manualPlace = london, home = london))
    private fun at(y: Int, m: Int, d: Int, h: Int, min: Int) = ZonedDateTime.of(y, m, d, h, min, 0, 0, zone).toInstant()
    private fun dateOf(i: java.time.Instant) = i.atZone(zone).toLocalDate()

    @Test fun lastNightsIshaJustAfterMidnightAfterClocksGoForward() {
        // Sunday 28 March 2027 is 23 hours long in London.
        val cur = r.current(at(2027, 3, 29, 0, 30))!!
        assertEquals(Prayer.ISHA, cur.first)
        assertEquals(LocalDate.of(2027, 3, 28), dateOf(cur.second))
    }

    @Test fun tomorrowsFajrAfterIshaOnTheLongDay() {
        // Sunday 25 October 2026 is 25 hours long in London.
        val next = r.next(at(2026, 10, 25, 23, 30))!!
        assertEquals(Prayer.FAJR, next.first)
        assertEquals(LocalDate.of(2026, 10, 26), dateOf(next.second))
    }

    @Test fun nextDayIsNeverSkippedOrRepeated() {
        assertEquals(LocalDate.of(2027, 3, 28), r.day(at(2027, 3, 27, 23, 30), 1)!!.let { LocalDate.of(it.year, it.month, it.day) })
        assertEquals(LocalDate.of(2026, 10, 26), r.day(at(2026, 10, 25, 0, 30), 1)!!.let { LocalDate.of(it.year, it.month, it.day) })
        assertEquals(LocalDate.of(2027, 3, 28), r.day(at(2027, 3, 29, 0, 30), -1)!!.let { LocalDate.of(it.year, it.month, it.day) })
    }

    @Test fun streakCountsEveryDayOverTheClockChange() {
        val five = Prayer.obligatory.toSet()
        val log = listOf("2027-03-26", "2027-03-27", "2027-03-28", "2027-03-29").associateWith { five }
        val t = Resolver(Preferences(useGPS = false, manualPlace = london, trackerEnabled = true, prayedLog = log))
        assertEquals(4, t.streak(at(2027, 3, 29, 0, 30)))
    }
}
