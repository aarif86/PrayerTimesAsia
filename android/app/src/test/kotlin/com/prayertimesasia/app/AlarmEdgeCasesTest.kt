package com.prayertimesasia.app

import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerAlarmTiming
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.WakeUpTiming
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale

/** The alert plan at the edges: no place, midnight, Fridays, quiet hours and clock changes. */
class AlarmEdgeCasesTest {
    private val place = DemoConfig().pasirRis
    private val sg = ZoneId.of("Asia/Singapore")
    private val london = Place(id = "t-london", name = "London", countryCode = "GB", countryName = "United Kingdom",
        timeZoneId = "Europe/London", coordinates = Coordinates(51.5074, -0.1278))
    private fun sgAt(y: Int, m: Int, d: Int, h: Int, min: Int): Instant = ZonedDateTime.of(y, m, d, h, min, 0, 0, sg).toInstant()
    private fun resolver(prefs: Preferences) = Resolver(prefs, locale = Locale("en", "SG"))
    private fun on(p: Place = place) = Preferences(useGPS = false, manualPlace = p, home = p, notificationsEnabled = true)

    @Test fun nothingWithoutAPlace() {
        val r = resolver(Preferences(useGPS = false, manualPlace = null, notificationsEnabled = true, wakeUp = WakeUpTiming.AT_FAJR))
        assertTrue(AlarmScheduler.plan(r, sgAt(2026, 11, 16, 9, 0)).isEmpty())
        assertEquals(null, AlarmScheduler.nextWakeUp(r, sgAt(2026, 11, 16, 9, 0)))
    }

    @Test fun tomorrowsSubuhJustBeforeAndAfterMidnight() {
        val r = resolver(on())
        val before = AlarmScheduler.plan(r, sgAt(2026, 11, 16, 23, 59)).first { it.kind == AlarmScheduler.Kind.PRAYER }
        assertEquals("2026-11-17-fajr", before.id)
        val after = AlarmScheduler.plan(r, sgAt(2026, 11, 17, 0, 1)).first { it.kind == AlarmScheduler.Kind.PRAYER }
        assertEquals("2026-11-17-fajr", after.id)
    }

    @Test fun planIsSortedInTheFutureAndEachIdOnce() {
        val now = sgAt(2026, 11, 16, 9, 0)
        val plan = AlarmScheduler.plan(resolver(on().copy(reminderMinutesBefore = 10, wakeUp = WakeUpTiming.AT_FAJR)), now)
        assertTrue(plan.all { it.at > now })
        assertEquals(plan.sortedBy { it.at }, plan)
        assertEquals(plan.size, plan.map { it.id }.toSet().size)
    }

    @Test fun jumaatReminderOnFridaysOnly() {
        val prefs = Preferences(useGPS = false, manualPlace = place, home = place, jumuahReminderMinutes = 30)
        val r = resolver(prefs)
        // Friday 20 November 2026.
        val friday = AlarmScheduler.plan(r, sgAt(2026, 11, 20, 6, 0)).single { it.kind == AlarmScheduler.Kind.JUMUAH }
        assertEquals("2026-11-20-jumuah", friday.id)
        assertEquals(r.day(sgAt(2026, 11, 20, 12, 0))!!.time(Prayer.DHUHR).minusSeconds(1800), friday.at)
        // Monday to Wednesday: none.
        assertTrue(AlarmScheduler.plan(r, sgAt(2026, 11, 16, 6, 0)).none { it.kind == AlarmScheduler.Kind.JUMUAH })
    }

    @Test fun quietHoursAcrossMidnightButSubuhKeepsItsSound() {
        val r = resolver(on().copy(quietHours = true, quietFrom = 20 * 60, quietTo = 6 * 60))
        val plan = AlarmScheduler.plan(r, sgAt(2026, 11, 16, 9, 0))
        assertTrue(plan.single { it.id == "2026-11-16-isha" }.silent)
        assertFalse(plan.single { it.id == "2026-11-17-fajr" }.silent)
        assertFalse(plan.single { it.id == "2026-11-16-dhuhr" }.silent)
    }

    @Test fun buzzOnlySilencesEveryAlert() {
        val plan = AlarmScheduler.plan(resolver(on().copy(buzzOnly = true)), sgAt(2026, 11, 16, 9, 0))
        assertTrue(plan.filter { it.kind == AlarmScheduler.Kind.PRAYER }.all { it.silent })
    }

    @Test fun anAlarmOnTimeStandsInForTheAlert() {
        val plan = AlarmScheduler.plan(resolver(on().copy(wakeUp = WakeUpTiming.AT_FAJR, dhuhrAlarm = PrayerAlarmTiming.AT_START)), sgAt(2026, 11, 16, 9, 0))
        val ids = plan.map { it.id }
        assertTrue(ids.contains("2026-11-17-wake"))
        assertFalse(ids.contains("2026-11-17-fajr"))
        assertTrue(ids.contains("2026-11-16-dhuhr-alarm"))
        assertFalse(ids.contains("2026-11-16-dhuhr"))
    }

    @Test fun everyDayOnceAroundTheClockChange() {
        // 00:30 on Sunday 25 October 2026, the 25 hour day in London.
        val now = ZonedDateTime.of(2026, 10, 25, 0, 30, 0, 0, ZoneId.of("Europe/London")).toInstant()
        val plan = AlarmScheduler.plan(resolver(on(london)), now)
        assertEquals(plan.size, plan.map { it.id }.toSet().size)
        val days = plan.filter { it.kind == AlarmScheduler.Kind.PRAYER }.map { it.id.split("-").take(3).joinToString("-") }.toSet()
        assertTrue(days.toString(), days.containsAll(listOf("2026-10-25", "2026-10-26")))
    }
}
