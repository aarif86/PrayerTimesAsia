package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** Same cases as web/tests/window.test.ts. */
class PrayerWindowTest {
    private val H = 3600L
    private val M = 60L
    private val D = 86_400L

    private fun day(base: Long): PrayerDay {
        fun at(s: Long) = Instant.ofEpochSecond(base + s)
        return PrayerDay(2026, 11, 7, mapOf(
            Prayer.FAJR to at(5 * H + 40 * M), Prayer.SUNRISE to at(7 * H), Prayer.DHUHR to at(13 * H),
            Prayer.ASR to at(16 * H + 20 * M), Prayer.MAGHRIB to at(19 * H), Prayer.ISHA to at(20 * H + 15 * M),
        ))
    }

    private val y = day(0)
    private val t = day(D)
    private val n = day(2 * D)
    private fun open(s: Long) = PrayerWindow.open(Instant.ofEpochSecond(s), y, t, n)

    @Test fun findsTheOpenPrayer() {
        assertEquals(Prayer.FAJR, open(D + 6 * H)?.prayer)
        assertEquals(t.time(Prayer.ASR), open(D + 14 * H)?.end)
        assertNull(open(D + 9 * H))
        val late = open(D + 23 * H)!!
        assertEquals(Prayer.ISHA, late.prayer)
        assertEquals(n.time(Prayer.FAJR), late.end)
        assertEquals(y.time(Prayer.ISHA), open(D + 2 * H)?.start)
    }

    @Test fun nudges() {
        val w = PrayerWindow.windowsOf(t, n)
        assertEquals(t.time(Prayer.ASR).minusSeconds(30 * M), w[1].nudgeAt)
        assertEquals(t.time(Prayer.SUNRISE).minusSeconds(26 * M), w[0].nudgeAt)
        assertEquals(t.time(Prayer.ISHA).minusSeconds(25 * M), w[3].nudgeAt)
    }

    @Test fun quietHours() {
        assertTrue(PrayerWindow.inQuietHours(23 * 60 + 30, 23 * 60, 6 * 60))
        assertTrue(PrayerWindow.inQuietHours(3 * 60, 23 * 60, 6 * 60))
        assertFalse(PrayerWindow.inQuietHours(6 * 60, 23 * 60, 6 * 60))
        assertTrue(PrayerWindow.inQuietHours(10 * 60, 8 * 60, 15 * 60))
        assertFalse(PrayerWindow.inQuietHours(10 * 60, 8 * 60, 8 * 60))
    }

    @Test fun lifestyleSettingsMoveAndStaySane() {
        val p = Preferences(quietHours = true, quietFrom = 480, quietTo = 900, buzzOnly = true, largeText = true,
            jumuahReminderMinutes = 45, windowNudge = false, todayStyle = TodayStyle.SIMPLE)
        val back = MovedSettings.fromCode(MovedSettings.from(p).code)!!.appliedTo(Preferences())
        assertEquals(480, back.quietFrom)
        assertEquals(900, back.quietTo)
        assertTrue(back.buzzOnly && back.largeText)
        assertEquals(45, back.jumuahReminderMinutes)
        assertFalse(back.windowNudge)
        assertEquals(TodayStyle.SIMPLE, back.todayStyle)
        assertNull(MovedSettings.from(Preferences()).quietHours)
        val bad = Preferences.decode("""{"quietFrom":2000,"jumuahReminderMinutes":17}""")
        assertEquals(23 * 60, bad.quietFrom)
        assertEquals(0, bad.jumuahReminderMinutes)
    }
}
