package com.prayertimesasia.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate

/**
 * "Move my settings": Android reads the same codes as the iPhone and the web
 * (testdata/move-settings.json) and its own codes come back unchanged.
 */
class MoveSettingsTest {
    private data class Case(val name: String, val code: String, val settings: MovedSettings)

    private val cases: List<Case> by lazy {
        val dir = File(System.getProperty("testdata.dir") ?: "../../testdata")
        Json.parseToJsonElement(File(dir, "move-settings.json").readText()).jsonObject.getValue("cases").jsonArray.map {
            val o = it.jsonObject
            Case(
                o.getValue("name").jsonPrimitive.content,
                o.getValue("code").jsonPrimitive.content,
                MovedSettings.MoveJson.decodeFromJsonElement(MovedSettings.serializer(), o.getValue("settings")),
            )
        }
    }

    @Test fun readsTheSharedCodes() {
        for (c in cases) assertEquals(c.name, c.settings, MovedSettings.fromCode(c.code))
    }

    @Test fun findsTheCodeInALink() {
        val c = cases[1]
        assertEquals(c.settings, MovedSettings.fromCode("Here: https://aarif86.github.io/PrayerTimesAsia/app/#move=${c.code} "))
        assertNull(MovedSettings.fromCode("PTA1.not-a-code"))
        assertNull(MovedSettings.fromCode("hello"))
    }

    @Test fun roundTrip() {
        val moved = cases[1].settings
        val prefs = moved.appliedTo(Preferences())
        assertTrue(prefs.hasOnboarded)
        assertEquals("Singapore", prefs.home?.name)
        assertEquals("Kota Bandung", prefs.savedPlaces[1].district)
        assertEquals(TodayStyle.BANDS, prefs.todayStyle)
        assertEquals(WakeUpTiming.SUNRISE_MINUS_30, prefs.wakeUp)
        assertEquals(setOf(Prayer.FAJR, Prayer.MAGHRIB, Prayer.ISHA), prefs.notifyPrayers)
        val back = MovedSettings.from(prefs)
        assertEquals(moved, back)
        assertEquals(moved, MovedSettings.fromCode(back.code))
    }

    @Test fun sahurAlarmMoves() {
        val prefs = Preferences(wakeUp = WakeUpTiming.FAJR_MINUS_30, sahurAlarm = SahurTiming.FAJR_MINUS_90,
            sahurDays = setOf(SahurDay.MON_THU, SahurDay.WHITE_DAYS))
        val moved = MovedSettings.from(prefs)
        assertEquals(listOf("monThu", "whiteDays"), moved.sahurDays)
        val back = MovedSettings.fromCode(moved.code)!!.appliedTo(Preferences())
        assertEquals(WakeUpTiming.FAJR_MINUS_30, back.wakeUp)
        assertEquals(SahurTiming.FAJR_MINUS_90, back.sahurAlarm)
        assertEquals(setOf(SahurDay.MON_THU, SahurDay.WHITE_DAYS), back.sahurDays)
        // The default days are left out of the code.
        assertEquals(null, MovedSettings.from(Preferences(sahurAlarm = SahurTiming.FAJR_MINUS_60)).sahurDays)
    }

    @Test fun prayerAlarmsMove() {
        val prefs = Preferences(asrAlarm = PrayerAlarmTiming.PLUS_10, alarmSound = AlarmSound.BELLS, alarmRingtone = "content://x")
        val moved = MovedSettings.from(prefs)
        assertEquals(PrayerAlarmTiming.PLUS_10, moved.asrAlarm)
        assertEquals(AlarmSound.BELLS, moved.alarmSound)
        val back = MovedSettings.fromCode(moved.code)!!.appliedTo(Preferences())
        assertEquals(PrayerAlarmTiming.PLUS_10, back.asrAlarm)
        assertEquals(AlarmSound.BELLS, back.alarmSound)
        // The picked ringtone stays on its own phone.
        assertEquals(null, back.alarmRingtone)
        assertEquals(null, MovedSettings.from(Preferences()).alarmSound)
    }

    @Test fun freshInstallIsEmpty() {
        assertEquals(cases[0].settings, MovedSettings.from(Preferences()))
        assertEquals(MovedSettings(), MovedSettings.fromCode(MovedSettings().code))
    }

    @Test fun trackerHistoryIsAdded() {
        val here = Preferences(
            prayedLog = mapOf("2026-10-25" to setOf(Prayer.ISHA), "2026-10-01" to setOf(Prayer.FAJR)),
            use24Hour = true,
        )
        val prefs = MovedSettings(prayedLog = mapOf("2026-10-25" to listOf("fajr"))).appliedTo(here)
        assertEquals(mapOf("2026-10-25" to setOf(Prayer.FAJR, Prayer.ISHA), "2026-10-01" to setOf(Prayer.FAJR)), prefs.prayedLog)
        assertFalse(prefs.use24Hour)
    }

    @Test fun longHistoryStillFitsAQRCode() {
        val start = LocalDate.of(2021, 1, 1)
        val log = (0 until 2000).associate { start.plusDays(it.toLong()).toString() to listOf("fajr", "isha") }
        val (link, kept) = MovedSettings(trackerEnabled = true, prayedLog = log).qrLink(maxCharacters = 700)
        assertTrue(link.length <= 700)
        assertTrue((kept ?: 0) > 0)
        assertNotNull(MovedSettings.fromCode(link)?.prayedLog?.get("2026-06-23"))
    }

    @Test fun ramadanRecordRoundTrip() {
        val moved = cases.first { it.name.startsWith("Ramadan record") }.settings
        val prefs = moved.appliedTo(Preferences())
        assertEquals(FastMark.PERIOD, prefs.fastLog["2026-02-25"])
        assertEquals(FastMark.QADHA, prefs.fastLog["2026-04-10"])
        assertEquals(setOf("2026-02-17", "2026-02-18", "2026-03-16"), prefs.tarawihLog)
        assertEquals(setOf("2026-02-18", "2026-02-19"), prefs.quranLog)
        val back = MovedSettings.from(prefs)
        assertEquals(moved, back)
        assertEquals(moved, MovedSettings.fromCode(back.code))
        assertTrue("Your Ramadan record of fasts, Tarawih and juz" in back.summary)
    }

    @Test fun ramadanRecordIsAdded() {
        val here = Preferences(fastLog = mapOf("2026-02-18" to FastMark.SICK, "2025-03-01" to FastMark.FASTED), tarawihLog = setOf("2025-03-01"))
        val moved = MovedSettings(fastLog = mapOf("2026-02-18" to "fasted", "bad" to "fasted", "2026-02-19" to "someday"), tarawihLog = listOf("2026-02-18", "x"))
        val prefs = moved.appliedTo(here)
        assertEquals(mapOf("2026-02-18" to FastMark.FASTED, "2025-03-01" to FastMark.FASTED), prefs.fastLog)
        assertEquals(setOf("2025-03-01", "2026-02-18"), prefs.tarawihLog)
    }

    @Test fun olderCodeKeepsThisPhonesRamadanRecord() {
        val here = Preferences(fastLog = mapOf("2026-02-18" to FastMark.FASTED), tarawihLog = setOf("2026-02-18"), quranLog = setOf("2026-02-19"))
        val old = MovedSettings.fromCode(cases[1].code)!!
        val prefs = old.appliedTo(here)
        assertEquals("Singapore", prefs.home?.name)
        assertEquals(mapOf("2026-02-18" to FastMark.FASTED), prefs.fastLog)
        assertEquals(setOf("2026-02-18"), prefs.tarawihLog)
        assertEquals(setOf("2026-02-19"), prefs.quranLog)
    }

    @Test fun qrKeepsOnlyThisYearsRamadanRecord() {
        val days = (2020..2026).flatMap { y -> (1..30).map { d -> LocalDate.of(y, 3, d).toString() } }
        val moved = MovedSettings(fastLog = days.associateWith { "fasted" }, tarawihLog = days, quranLog = days)
        val full = moved.link()
        val qr = moved.qrLink(maxCharacters = full.length - 1)
        assertTrue(qr.ramadanTrimmed)
        assertNull(qr.keptDays)
        val back = MovedSettings.fromCode(qr.link)!!
        assertTrue(back.fastLog!!.keys.all { it.startsWith("2026-") })
        assertEquals(30, back.tarawihLog!!.size)
        assertFalse(moved.qrLink(maxCharacters = full.length).ramadanTrimmed)
        assertEquals("The QR code carries only this year's Ramadan record. To bring all of it, share the link instead.",
            MovedSettings.trimNote(null, true))
        assertNull(MovedSettings.trimNote(null, false))
    }
}
