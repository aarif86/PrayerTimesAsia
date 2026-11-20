package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Alerts and alarms: one Off, Notify or Alarm per prayer. Same cases as web tests/alertMode.test.ts. */
class AlertModeTest {
    @Test fun startsOffAndNotifyTurnsOnOnlyThatPrayer() {
        var p = Preferences()
        Prayer.entries.forEach { assertEquals(AlertMode.OFF, p.alertMode(it)) }
        p = p.withAlertMode(AlertMode.NOTIFY, Prayer.DHUHR)
        assertTrue(p.notificationsEnabled)
        assertEquals(setOf(Prayer.DHUHR), p.notifyPrayers)
        assertEquals(AlertMode.OFF, p.alertMode(Prayer.ASR))
    }

    @Test fun alarmKeepsNotificationAndOffClearsBoth() {
        var p = Preferences().withAlertMode(AlertMode.NOTIFY, Prayer.FAJR).withAlertMode(AlertMode.ALARM, Prayer.FAJR)
        assertEquals(WakeUpTiming.AT_FAJR, p.wakeUp)
        assertEquals(AlertMode.ALARM, p.alertMode(Prayer.FAJR))
        assertTrue(p.notifies(Prayer.FAJR))
        p = p.withAlertMode(AlertMode.NOTIFY, Prayer.FAJR)
        assertEquals(null, p.wakeUp)
        p = p.withAlertMode(AlertMode.OFF, Prayer.FAJR)
        assertFalse(p.notifies(Prayer.FAJR))
    }

    @Test fun bellCycleAndSunrise() {
        var p = Preferences()
        val seen = mutableListOf<AlertMode>()
        repeat(4) { val m = p.nextAlertMode(Prayer.MAGHRIB); p = p.withAlertMode(m, Prayer.MAGHRIB); seen += m }
        assertEquals(listOf(AlertMode.NOTIFY, AlertMode.ALARM, AlertMode.OFF, AlertMode.NOTIFY), seen)
        var q = Preferences()
        q = q.withAlertMode(q.nextAlertMode(Prayer.SUNRISE), Prayer.SUNRISE)
        assertEquals(AlertMode.NOTIFY, q.alertMode(Prayer.SUNRISE))
        assertEquals(AlertMode.OFF, q.nextAlertMode(Prayer.SUNRISE))
    }

    @Test fun friday() {
        var p = Preferences()
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
