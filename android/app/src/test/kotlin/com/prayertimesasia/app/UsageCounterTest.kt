package com.prayertimesasia.app

import com.prayertimesasia.app.data.UsageCounter
import com.prayertimesasia.core.Preferences
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Anonymous usage counts: what is sent, and when nothing is. */
class UsageCounterTest {
    @Test fun sendsNothingWithoutAnAppIdOrWhenSwitchedOff() {
        assertNull(UsageCounter.Config("", true).activeAppId)
        assertNull(UsageCounter.Config("AAAA", false).activeAppId)
        assertEquals("AAAA", UsageCounter.Config(" AAAA ", true).activeAppId)
        assertNull(UsageCounter.Config.decode("""{"about":"x","telemetryDeckAppID":"","enabled":true}""")?.activeAppId)
        assertNull(UsageCounter.Config.decode("not json"))
    }

    @Test fun sharesOnlyCityAndCountry() {
        val p = UsageCounter.payload("1.0.0", "15", "en-SG", "Pasir Ris", "sg")
        assertEquals("android", p["App.platform"])
        assertEquals("en", p["App.language"])
        assertEquals("SG", p["Place.country"])
        assertEquals("Pasir Ris", p["Place.city"])
        assertFalse(p.keys.any { it.contains("coordinate", true) || it.contains("latitude", true) })
        assertNull(UsageCounter.payload("1", "15", "en", "Current location", null)["Place.city"])
    }

    @Test fun buildsTelemetryDeckSignals() {
        val json = UsageCounter.signals("APP", "user", listOf("App.installed", "App.opened"), mapOf("App.platform" to "android"), false)
        val list = Json.parseToJsonElement(json).jsonArray
        assertEquals(2, list.size)
        val first = list[0].jsonObject
        assertEquals("APP", first["appID"]!!.jsonPrimitive.content)
        assertEquals("App.installed", first["type"]!!.jsonPrimitive.content)
        assertEquals("android", first["payload"]!!.jsonObject["App.platform"]!!.jsonPrimitive.content)
    }

    @Test fun countsAnOpenAtMostOnceAnHour() {
        assertTrue(UsageCounter.shouldCountOpen(null, 1_000))
        assertFalse(UsageCounter.shouldCountOpen(1_000, 1_000 + UsageCounter.OPEN_GAP_MS - 1))
        assertTrue(UsageCounter.shouldCountOpen(1_000, 1_000 + UsageCounter.OPEN_GAP_MS))
    }

    @Test fun onByDefaultAndRemembersOff() {
        assertTrue(Preferences().shareUsage)
        assertTrue(Preferences.decode("{}").shareUsage)
        assertFalse(Preferences.decode("""{"shareUsage":false}""").shareUsage)
    }

    @Test fun aDayOfUseIsSentOnceTheNextDay() {
        val empty = UsageCounter.DayTally("2026-11-17")
        assertNull(UsageCounter.roll(empty, "2026-11-17").second)
        assertNull("an empty day sends nothing", UsageCounter.roll(empty, "2026-11-18").second)
        val t = empty.copy(opens = 3).addSeconds(10 * 3_600.0).addScreen("prayer").addScreen("prayer").addScreen("qibla")
        assertEquals(UsageCounter.MAX_STRETCH_S, t.seconds, 0.0)
        val (today, finished) = UsageCounter.roll(t, "2026-11-18")
        assertEquals(t, finished)
        assertEquals(UsageCounter.DayTally("2026-11-18"), today)
        assertEquals(t, UsageCounter.DayTally.decode(t.encode()))
        val p = UsageCounter.dayPayload(mapOf("App.platform" to "android"), t)
        assertEquals("120", p["Day.minutes"])
        assertEquals("over 60", p["Day.minutesBand"])
        assertEquals("3", p["Day.opens"])
        assertEquals("prayer,qibla", p["Day.screens"])
        assertEquals("true", p["Used.qibla"])
        assertEquals("false", p["Used.masjid"])
        assertEquals("1 to 5", UsageCounter.minutesBand(4.9))
    }
}
