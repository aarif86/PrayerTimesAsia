package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Parsers use the exact response shapes seen from e-solat.gov.my, data.gov.sg and api.myquran.com. */
class OfficialTest {
    @Test fun parsesJakimWithMalayMonths() {
        val json = """
        {"prayerTime":[
          {"hijri":"1447-07-11","date":"01-Jan-2026","day":"Thursday","imsak":"05:56:00","fajr":"06:06:00",
           "syuruk":"07:18:00","dhuha":"07:43:00","dhuhr":"13:19:00","asr":"16:42:00","maghrib":"19:17:00","isha":"20:31:00"},
          {"hijri":"1447-09-12","date":"01-Mac-2026","day":"Sunday","imsak":"06:02:00","fajr":"06:12:00",
           "syuruk":"07:21:00","dhuha":"07:46:00","dhuhr":"13:25:00","asr":"16:35:00","maghrib":"19:26:00","isha":"20:35:00"}
        ],"status":"OK!","serverTime":"2026-10-21 12:00:00","periodType":"year","lang":"ms_my","zone":"WLY01","bearing":"292° 31′ 9″"}
        """
        val table = Official.parseJakim(json, 2026)
        assertEquals("06:06", table["2026-01-01"]?.get("fajr"))
        assertEquals("07:18", table["2026-01-01"]?.get("sunrise"))
        assertEquals("20:35", table["2026-03-01"]?.get("isha"))
        assertEquals("2026-08-15", Official.jakimDate("15-Ogos-2026"))
        assertEquals("2026-12-31", Official.jakimDate("31-Dis-2026"))
    }

    @Test fun parsesMuis() {
        val json = """
        {"success":true,"result":{"records":[
          {"_id":1,"Date":"2026-01-01","Day":"Thurs","Subuh":"05:44","Syuruk":"07:08","Zohor":"13:10",
           "Asar":"16:34","Maghrib":"19:11","Isyak":"20:25"},
          {"_id":2,"Date":"2026-01-02","Day":"Fri","Subuh":"5:45","Syuruk":"7:08","Zohor":"1:10",
           "Asar":"4:35","Maghrib":"7:12","Isyak":"8:26"}
        ]}}
        """
        val table = Official.parseMuis(json)
        assertEquals(mapOf("fajr" to "05:44", "sunrise" to "07:08", "dhuhr" to "13:10",
            "asr" to "16:34", "maghrib" to "19:11", "isha" to "20:25"), table["2026-01-01"])
        // 12-hour afternoon values are lifted to 24-hour.
        assertEquals(mapOf("fajr" to "05:45", "sunrise" to "07:08", "dhuhr" to "13:10",
            "asr" to "16:35", "maghrib" to "19:12", "isha" to "20:26"), table["2026-01-02"])
    }

    @Test fun nearestJakimZone() {
        assertEquals("WLY01", Official.nearestJakimZone(Coordinates(3.1478, 101.6953))) // KLCC area
        assertEquals("JHR02", Official.nearestJakimZone(Coordinates(1.4927, 103.7414))) // Johor Bahru
        assertEquals("PNG01", Official.nearestJakimZone(Coordinates(5.4141, 100.3288))) // George Town
        assertEquals("SWK08", Official.nearestJakimZone(Coordinates(1.5535, 110.3593))) // Kuching
        assertEquals("SBH07", Official.nearestJakimZone(Coordinates(5.9804, 116.0735))) // Kota Kinabalu
    }

    @Test fun sourceOnlyForTheAuthoritysOwnMethod() {
        val kl = Place(name = "KL", countryCode = "MY", countryName = "Malaysia", timeZoneId = "Asia/Kuala_Lumpur",
            coordinates = Coordinates(3.1478, 101.6953))
        assertEquals(OfficialSource.Jakim("WLY01"), Official.source(kl, CalculationMethod.JAKIM, null))
        assertEquals(OfficialSource.Jakim("SGR01"), Official.source(kl, CalculationMethod.JAKIM, "SGR01"))
        assertNull(Official.source(kl, CalculationMethod.MWL, null))
        val sg = Place(name = "SG", countryCode = "SG", countryName = "Singapore", timeZoneId = "Asia/Singapore",
            coordinates = Coordinates(1.35, 103.82))
        assertEquals(OfficialSource.Muis, Official.source(sg, CalculationMethod.MUIS, null))
        assertEquals("muis-2026", OfficialSource.Muis.cacheKey(2026))
        assertEquals("kemenag-BANDUNG-2026", OfficialSource.Kemenag("Kota Bandung").cacheKey(2026))
    }

    private val cities = listOf(
        "1201" to "KAB. BANDUNG", "1202" to "KAB. BANDUNG BARAT", "1219" to "KOTA BANDUNG",
        "1204" to "KAB. BOGOR", "1222" to "KOTA BOGOR", "1301" to "KOTA JAKARTA",
        "1638" to "KOTA SURABAYA", "2622" to "KOTA MAKASSAR",
    )

    @Test fun matchesKemenagPlaceNames() {
        assertEquals("1219", Official.matchKemenagCity(listOf("Kota Bandung"), cities))
        assertEquals("1219", Official.matchKemenagCity(listOf("Bandung City"), cities))
        assertEquals("1202", Official.matchKemenagCity(listOf("Kabupaten Bandung Barat"), cities))
        assertEquals("1204", Official.matchKemenagCity(listOf("Bogor Regency"), cities))
        assertEquals("1222", Official.matchKemenagCity(listOf("Bogor"), cities)) // city preferred when unsaid
        assertEquals("1301", Official.matchKemenagCity(listOf("Jakarta Selatan"), cities))
        assertEquals("1301", Official.matchKemenagCity(listOf("South Jakarta"), cities))
        assertEquals("1638", Official.matchKemenagCity(listOf("Nowhere", "Surabaya"), cities))
        assertNull(Official.matchKemenagCity(listOf("Tokyo"), cities))
    }

    @Test fun parsesKemenag() {
        val json = """
        {"status":true,"data":{"id":1301,"lokasi":"KOTA JAKARTA","daerah":"DKI JAKARTA","jadwal":[
          {"tanggal":"Kamis, 01/10/2026","imsak":"04:13","subuh":"04:23","terbit":"05:35","dhuha":"06:02",
           "dzuhur":"11:46","ashar":"14:51","maghrib":"17:50","isya":"18:59","date":"2026-10-01"}]}}
        """
        assertEquals(mapOf("fajr" to "04:23", "sunrise" to "05:35", "dhuhr" to "11:46",
            "asr" to "14:51", "maghrib" to "17:50", "isha" to "18:59"), Official.parseKemenag(json)["2026-10-01"])
        val list = Official.parseKemenagCities("""{"status":true,"data":[{"id":"1301","lokasi":"KOTA JAKARTA"}]}""")
        assertEquals(listOf("1301" to "KOTA JAKARTA"), list)
    }
}
