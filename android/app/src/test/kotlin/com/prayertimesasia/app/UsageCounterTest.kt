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
}
