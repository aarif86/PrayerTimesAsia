package com.prayertimesasia.core

import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.Instant
import java.time.ZoneId

/** Masjid links from a masjid screen's QR code; testdata/masjid-links.json is shared with the web and iPhone tests. */
class MasjidLinkTest {
    private val cases = CoreJson.parseToJsonElement(
        File(System.getProperty("testdata.dir") ?: "../../testdata", "masjid-links.json").readText()).jsonObject

    @Test fun readsTheSharedLinks() {
        val valid = cases.getValue("valid").jsonArray
        assertTrue(valid.isNotEmpty())
        for (c in valid) {
            val o = c.jsonObject
            val expected = CoreJson.decodeFromJsonElement(MasjidLink.serializer(), o.getValue("expected"))
            val link = o.getValue("link").jsonPrimitive.content
            assertEquals(link, expected, MasjidLink.parse(link))
        }
    }

    @Test fun refusesBrokenLinks() {
        for (c in cases.getValue("invalid").jsonArray) {
            val link = c.jsonPrimitive.content
            assertNull(link, MasjidLink.parse(link))
        }
    }

    @Test fun yourMasjidGivesJamaahNearbyOnly() {
        val link = MasjidLink.parse("prayertimesasia://masjid?n=Masjid+Ujian&ll=1.3721,103.9474&tz=Asia/Singapore&i=15,13:15,,5,")!!
        val pasirRis = Place(name = "Pasir Ris", countryCode = "SG", countryName = "Singapore",
            timeZoneId = "Asia/Singapore", coordinates = Coordinates(1.3721, 103.9474))
        val r = Resolver(Preferences(useGPS = false, manualPlace = pasirRis, myMasjid = link))
        val day = r.day(Instant.parse("2026-10-26T04:00:00Z"))!!
        assertEquals("Masjid Ujian", day.mosqueName)
        assertEquals(day.time(Prayer.FAJR).plusSeconds(15 * 60), day.jamaah[Prayer.FAJR])
        assertEquals(day.time(Prayer.MAGHRIB).plusSeconds(5 * 60), day.jamaah[Prayer.MAGHRIB])
        assertNull(day.jamaah[Prayer.ASR])
        assertEquals(13, day.jamaah.getValue(Prayer.DHUHR).atZone(ZoneId.of("Asia/Singapore")).hour)

        val kl = pasirRis.copy(name = "Kuala Lumpur", countryCode = "MY", timeZoneId = "Asia/Kuala_Lumpur", coordinates = Coordinates(3.139, 101.6869))
        val away = Resolver(Preferences(useGPS = false, manualPlace = kl, myMasjid = link)).day(Instant.parse("2026-10-26T04:00:00Z"))!!
        assertTrue(away.jamaah.isEmpty())
    }
}
