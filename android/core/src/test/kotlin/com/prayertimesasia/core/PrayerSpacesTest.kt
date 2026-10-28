package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PrayerSpacesTest {
    @Test fun keepsPrayerSpacesAndDropsLookalikes() {
        for (name in listOf("Al-Istighfar Mosque", "Musollah@Pasir Ris Mall", "Surau Raudhatul Jannah",
            "Masjid Kampong Siglap", "Prayer Room", "Tokyo Camii", "Seoul Central Masjid",
            "Masjid Jalan Kebun", "Masjid Jamek")) {
            assertTrue(name, PrayerSpaces.looksLikePrayerSpace(name))
        }
        for (name in listOf("Darul Ghufran Mosque Stop", "Mosque Street", "Jalan Masjid", "Masjid Jamek LRT Station",
            "Mosque Road Car Park", "Bugis Mosque Bus Stop", "Starbucks")) {
            assertFalse(name, PrayerSpaces.looksLikePrayerSpace(name))
        }
    }

    @Test fun parsesOverpass() {
        val center = Coordinates(1.3721, 103.9474)
        val json = """
        {"elements":[
          {"type":"node","id":1,"lat":1.3725,"lon":103.9480,"tags":{"amenity":"place_of_worship","religion":"muslim","name":"Musollah@Pasir Ris Mall"}},
          {"type":"way","id":2,"center":{"lat":1.3810,"lon":103.9550},"tags":{"amenity":"place_of_worship","religion":"muslim","name":"Masjid Al-Istighfar","addr:street":"Pasir Ris Walk"}},
          {"type":"node","id":3,"lat":1.3726,"lon":103.9481,"tags":{"amenity":"place_of_worship","religion":"muslim","name":"Musollah@Pasir Ris Mall"}},
          {"type":"node","id":4,"lat":5.0,"lon":110.0,"tags":{"name":"Far Away Masjid"}},
          {"type":"node","id":5,"lat":1.3700,"lon":103.9400,"tags":{"amenity":"place_of_worship","religion":"muslim"}}
        ]}
        """
        val spaces = PrayerSpaces.parseOverpass(json, center)
        assertEquals(listOf("Musollah@Pasir Ris Mall", "Masjid", "Masjid Al-Istighfar"), spaces.map { it.name })
        assertTrue(spaces[0].isMusollah)
        assertFalse(spaces[2].isMusollah)
        assertEquals("Pasir Ris Walk", spaces[2].address)
        assertTrue(PrayerSpaces.overpassQuery(center).contains("around:12000,1.37210,103.94740"))
        assertTrue(PrayerSpaces.overpassQuery(center).endsWith(");out center;"))
    }

    @Test fun citySearch() {
        assertEquals("Kuala Lumpur", Cities.search("kuala l").first().name)
        assertEquals("Malé", Cities.search("male").first().name)
        assertTrue(Cities.search("japan").any { it.name == "Tokyo" })
        val place = Cities.search("Bandung").first().place()
        assertEquals("Bandung", place.district)
        assertEquals("Indonesia", place.countryName)
    }
}
