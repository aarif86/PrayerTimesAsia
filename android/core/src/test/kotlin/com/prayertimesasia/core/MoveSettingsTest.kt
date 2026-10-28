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
}
