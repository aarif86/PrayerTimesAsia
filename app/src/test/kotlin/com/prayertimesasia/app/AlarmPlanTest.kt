package com.prayertimesasia.app

import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.WakeUpTiming
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

class AlarmPlanTest {
    private val place = DemoConfig().pasirRis
    private val now = DemoConfig.night // 8:49 pm, after Isyak

    @Test fun nothingWhenAlertsAreOff() {
        val r = Resolver(Preferences(useGPS = false, manualPlace = place, home = place), locale = Locale("en", "SG"))
        val plan = AlarmScheduler.plan(r, now)
        assertTrue(plan.all { it.kind == AlarmScheduler.Kind.REFRESH })
    }

    @Test fun exactPrayerAlertsEarlyRemindersAndWakeUp() {
        val prefs = Preferences(useGPS = false, manualPlace = place, home = place, notificationsEnabled = true,
            reminderMinutesBefore = 10, wakeUp = WakeUpTiming.SUNRISE_MINUS_30)
        val r = Resolver(prefs, locale = Locale("en", "SG"))
        val plan = AlarmScheduler.plan(r, now)
        assertTrue(plan.all { it.at > now })
        assertEquals(plan.sortedBy { it.at }, plan)
        val first = plan.first { it.kind == AlarmScheduler.Kind.PRAYER }
        val tomorrow = r.day(now, 1)!!
        // The next alert is tomorrow's Subuh, at the exact minute.
        assertEquals(tomorrow.time(Prayer.FAJR), first.at)
        assertTrue(first.title, first.title.startsWith("Subuh · "))
        assertTrue(first.body, first.body.contains("Pasir Ris"))
        val early = plan.first { it.kind == AlarmScheduler.Kind.EARLY }
        assertEquals(tomorrow.time(Prayer.FAJR).minusSeconds(600), early.at)
        val wake = plan.first { it.kind == AlarmScheduler.Kind.WAKE }
        assertEquals(tomorrow.time(Prayer.SUNRISE).minusSeconds(1800), wake.at)
        // Syuruk isn't a prayer: no alert unless chosen.
        assertTrue(plan.none { it.id.endsWith("-sunrise") })
    }
}
