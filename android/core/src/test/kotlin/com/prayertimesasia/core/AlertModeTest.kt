package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Alerts and alarms: one Off, Notify or Alarm per prayer. Same cases as web tests/alertMode.test.ts. */
class AlertModeTest {
    /** Someone who has not turned alerts on (before the new-install default). */
    private val OLD = Preferences(notificationsEnabled = false)

    @Test fun newInstallIsNotifyForFivePrayersAndOffForSunrise() {
        val p = Preferences()
        Prayer.obligatory.forEach { assertEquals(AlertMode.NOTIFY, p.alertMode(it)) }
        assertEquals(AlertMode.OFF, p.alertMode(Prayer.SUNRISE))
        assertTrue(p.allFiveNotify())
    }

    @Test fun allFiveButtonDropsAnOldLeftoverList() {
        val p = OLD.copy(notifyPrayers = setOf(Prayer.SUNRISE, Prayer.ASR)).withNotifyAllFive()
        assertEquals(AlertMode.OFF, p.alertMode(Prayer.SUNRISE))
        assertTrue(p.allFiveNotify())
    }

    @Test fun savedChoicesAreKept() {
        assertFalse(Preferences.decode("{\"notificationsEnabled\":false}").notificationsEnabled)
        assertFalse(Preferences.decode("{}").notificationsEnabled)
        assertTrue(Preferences.decode("{\"notificationsEnabled\":true}").notificationsEnabled)
        assertTrue(Preferences.decode(null).notificationsEnabled)
    }

    @Test fun allFiveButtonLeavesAlarmAndSunriseAlone() {
        val p = OLD.withAlertMode(AlertMode.ALARM, Prayer.FAJR).withNotifyAllFive()
        assertEquals(AlertMode.ALARM, p.alertMode(Prayer.FAJR))
        assertEquals(WakeUpTiming.AT_FAJR, p.wakeUp)
        listOf(Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA).forEach { assertEquals(AlertMode.NOTIFY, p.alertMode(it)) }
        assertEquals(AlertMode.OFF, p.alertMode(Prayer.SUNRISE))
        assertFalse(p.allFiveNotify())
        assertTrue(OLD.withNotifyAllFive().allFiveNotify())
    }

    @Test fun startsOffAndNotifyTurnsOnOnlyThatPrayer() {
        var p = OLD
        Prayer.entries.forEach { assertEquals(AlertMode.OFF, p.alertMode(it)) }
        p = p.withAlertMode(AlertMode.NOTIFY, Prayer.DHUHR)
        assertTrue(p.notificationsEnabled)
        assertEquals(setOf(Prayer.DHUHR), p.notifyPrayers)
        assertEquals(AlertMode.OFF, p.alertMode(Prayer.ASR))
    }

    @Test fun alarmKeepsNotificationAndOffClearsBoth() {
        var p = OLD.withAlertMode(AlertMode.NOTIFY, Prayer.FAJR).withAlertMode(AlertMode.ALARM, Prayer.FAJR)
        assertEquals(WakeUpTiming.AT_FAJR, p.wakeUp)
        assertEquals(AlertMode.ALARM, p.alertMode(Prayer.FAJR))
        assertTrue(p.notifies(Prayer.FAJR))
        p = p.withAlertMode(AlertMode.NOTIFY, Prayer.FAJR)
        assertEquals(null, p.wakeUp)
        p = p.withAlertMode(AlertMode.OFF, Prayer.FAJR)
        assertFalse(p.notifies(Prayer.FAJR))
    }

    @Test fun bellCycleAndSunrise() {
        var p = OLD
        val seen = mutableListOf<AlertMode>()
        repeat(4) { val m = p.nextAlertMode(Prayer.MAGHRIB); p = p.withAlertMode(m, Prayer.MAGHRIB); seen += m }
        assertEquals(listOf(AlertMode.NOTIFY, AlertMode.ALARM, AlertMode.OFF, AlertMode.NOTIFY), seen)
        var q = OLD
        q = q.withAlertMode(q.nextAlertMode(Prayer.SUNRISE), Prayer.SUNRISE)
        assertEquals(AlertMode.NOTIFY, q.alertMode(Prayer.SUNRISE))
        assertEquals(AlertMode.OFF, q.nextAlertMode(Prayer.SUNRISE))
    }

    @Test fun friday() {
        var p = OLD
        assertEquals(AlertMode.OFF, p.fridayMode)
        p = p.withFridayMode(AlertMode.ALARM)
        assertEquals(30, p.jumuahReminderMinutes)
        assertTrue(p.jumuahLeaveAlarm)
        p = p.copy(jumuahReminderMinutes = 180).withFridayMode(AlertMode.NOTIFY)
        assertEquals(180, p.jumuahReminderMinutes)
        assertEquals(AlertMode.NOTIFY, p.fridayMode)
        assertEquals(0, p.withFridayMode(AlertMode.OFF).jumuahReminderMinutes)
    }

    @Test fun reminderOnlyPeopleSeeNotify() {
        val old = Preferences.decode("""{"notificationsEnabled":false,"reminderMinutesBefore":10,"notifyPrayers":["asr"]}""")
        assertEquals(AlertMode.NOTIFY, old.alertMode(Prayer.ASR))
        assertEquals(AlertMode.OFF, old.alertMode(Prayer.DHUHR))
        assertFalse(Preferences.decode("""{"notificationsEnabled":false}""").notificationsEnabled)
    }
}
