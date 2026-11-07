package com.prayertimesasia.app

import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerAlarmTiming
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.SahurDay
import com.prayertimesasia.core.SahurTiming
import com.prayertimesasia.core.WakeUpTiming
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

class AlarmPlanTest {
    private val place = DemoConfig().pasirRis
    private val now = DemoConfig.night // 4:49 am, before Subuh

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
        val today = r.day(now)!!
        // The next alert is this morning's Subuh, at the exact minute.
        assertEquals(today.time(Prayer.FAJR), first.at)
        assertTrue(first.title, first.title.startsWith("Subuh · "))
        assertTrue(first.body, first.body.contains("Pasir Ris"))
        val early = plan.first { it.kind == AlarmScheduler.Kind.EARLY }
        assertEquals(today.time(Prayer.FAJR).minusSeconds(600), early.at)
        val wake = plan.first { it.kind == AlarmScheduler.Kind.WAKE }
        assertEquals(today.time(Prayer.SUNRISE).minusSeconds(1800), wake.at)
        // Syuruk isn't a prayer: no alert unless chosen.
        assertTrue(plan.none { it.id.endsWith("-sunrise") })
    }

    @Test fun tahajjudAndSahurAlarms() {
        // Demo night is Sunday 25 October 2026, 4:49 am: the sahur alarm (Mondays and Thursdays) rings before Monday's Subuh.
        val prefs = Preferences(useGPS = false, manualPlace = place, home = place, wakeUp = WakeUpTiming.FAJR_MINUS_30,
            sahurAlarm = SahurTiming.FAJR_MINUS_120, sahurDays = setOf(SahurDay.MON_THU))
        val r = Resolver(prefs, locale = Locale("en", "SG"))
        val plan = AlarmScheduler.plan(r, now)
        val monday = r.day(now, 1)!!
        val sahur = plan.single { it.id.endsWith("-sahur") }
        assertEquals(monday.time(Prayer.FAJR).minusSeconds(7200), sahur.at)
        assertEquals("Wake up for sahur", sahur.title)
        val tahajjud = plan.first { it.id.endsWith("-wake") }
        assertEquals("Wake up for tahajjud", tahajjud.title)
        assertEquals(AlarmScheduler.Kind.WAKE, sahur.kind)
        assertEquals(sahur, AlarmScheduler.nextWakeUp(r, monday.time(Prayer.FAJR).minusSeconds(4 * 3600)))
    }

    @Test fun alarmsForTheOtherPrayers() {
        // Asar 10 min after it begins, Isyak on time: an alarm on time stands in for the Isyak alert.
        val prefs = Preferences(useGPS = false, manualPlace = place, home = place, notificationsEnabled = true,
            asrAlarm = PrayerAlarmTiming.PLUS_10, ishaAlarm = PrayerAlarmTiming.AT_START)
        val r = Resolver(prefs, locale = Locale("en", "SG"))
        val plan = AlarmScheduler.plan(r, now)
        val today = r.day(now)!!
        val key = "${today.year}-${today.month}-${today.day}"
        val asr = plan.single { it.id == "$key-asr-alarm" }
        assertEquals(today.time(Prayer.ASR).plusSeconds(600), asr.at)
        assertEquals(AlarmScheduler.Kind.WAKE, asr.kind)
        assertEquals("Time for Asar", asr.title)
        assertTrue(plan.any { it.id == "$key-isha-alarm" })
        assertTrue(plan.none { it.id == "$key-isha" })
        assertTrue(plan.any { it.id == "$key-asr" })
        assertEquals(today.time(Prayer.ASR).plusSeconds(600), AlarmScheduler.nextWakeUp(r, today.time(Prayer.DHUHR))?.at)
    }

    @Test fun reminderBeforePrayerWorksOnItsOwn() {
        // Only the heads-up switched on: every chosen prayer gets a reminder 15 min early, and no alert at the time itself.
        val prefs = Preferences(useGPS = false, manualPlace = place, home = place, notificationsEnabled = false,
            reminderMinutesBefore = AlarmScheduler.DEFAULT_REMINDER_MINUTES)
        val r = Resolver(prefs, locale = Locale("en", "SG"))
        val plan = AlarmScheduler.plan(r, now)
        assertTrue(plan.none { it.kind == AlarmScheduler.Kind.PRAYER })
        val today = r.day(now)!!
        val first = plan.first { it.kind == AlarmScheduler.Kind.EARLY }
        assertEquals(today.time(Prayer.FAJR).minusSeconds(900), first.at)
        assertEquals("Subuh in 15 min", first.title)
        // One per chosen prayer each day (two days ahead, minus the ones already past).
        assertTrue(plan.count { it.kind == AlarmScheduler.Kind.EARLY } >= 10)
    }

    @Test fun azanAtPrayerTimeWithASubuhAzanAtSubuh() {
        val on = Preferences(useGPS = false, manualPlace = place, home = place, notificationsEnabled = true, reminderMinutesBefore = 10)
        val plan = AlarmScheduler.plan(Resolver(on, locale = Locale("en", "SG")), now)
        val prayers = plan.filter { it.kind == AlarmScheduler.Kind.PRAYER }
        assertEquals(AlarmScheduler.Sound.AZAN_SUBUH, prayers.first { it.id.endsWith("-fajr") }.sound)
        assertTrue(prayers.filter { !it.id.endsWith("-fajr") }.all { it.sound == AlarmScheduler.Sound.AZAN })
        // Reminders before the prayer stay quiet: the azan is for the time itself.
        assertTrue(plan.filter { it.kind == AlarmScheduler.Kind.EARLY }.all { it.sound == AlarmScheduler.Sound.STANDARD })

        val off = on.copy(azanSound = false)
        val quiet = AlarmScheduler.plan(Resolver(off, locale = Locale("en", "SG")), now)
        assertTrue(quiet.all { it.sound == AlarmScheduler.Sound.STANDARD })
    }
}
