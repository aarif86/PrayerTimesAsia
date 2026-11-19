package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MasjidExtrasTest {
    @Test fun fridayListMatchesTheWeb() {
        assertEquals(24, MasjidExtras.friday.size)
        assertEquals("Masjid Al-Istighfar", MasjidExtras.fridayAt(Coordinates(1.37106, 103.96412))?.name)
        assertNull(MasjidExtras.fridayAt(Coordinates(1.38, 103.97)))
        assertEquals("Masjid Abdul Gafoor", MasjidExtras.fridayNearest(Coordinates(1.3044, 103.8537)).first().first.name)
    }

    @Test fun eidShowsTwoWeeksBefore() {
        val e = EidEvent("Hari Raya Aidilfitri 1448H", "2027-03-10", "x", listOf(EidMosque("Al-Ansar", null, null, listOf(EidSession("07:20", "Malay", true)), null)))
        assertNull(MasjidExtras.currentEid("2027-02-20", listOf(e)))
        assertNotNull(MasjidExtras.currentEid("2027-02-25", listOf(e)))
        assertNull(MasjidExtras.currentEid("2027-03-11", listOf(e)))
        assertEquals("Al-Ansar", MasjidExtras.eidAt(e, "Al-Ansar Mosque", Coordinates(1.0, 103.0))?.name)
        assertEquals("Hari Raya Aidilfitri", e.shortName)
    }

    @Test fun tripTimes() {
        assertEquals("23 min walk", MasjidExtras.tripText(1.85, TripMode.WALK))
        assertNull(MasjidExtras.tripText(2.5, TripMode.WALK))
        assertEquals("6 min drive", MasjidExtras.tripText(1.9, TripMode.DRIVE))
        assertEquals("1 PM", MasjidExtras.clock("13:00", false))
        assertEquals("7:20 AM", MasjidExtras.clock("07:20", false))
    }

    @Test fun gravesLeftOut() {
        assertTrue(PrayerSpaces.isGraveOrShrine("Kubur Kassim"))
        assertFalse(PrayerSpaces.isGraveOrShrine("Masjid Kubur Kassim"))
        assertEquals("wa", PrayerSpaces.facilitiesOf(mapOf("female" to "yes", "wheelchair" to "limited")))
    }

    @Test fun openingHours() {
        assertEquals(OpeningHours.Now(false, opensAt = "10:00"), OpeningHours.at("Mo-Su 10:00-22:00", 2, 9 * 60))
        assertEquals(OpeningHours.Now(true, "22:00"), OpeningHours.at("Mo-Su 10:00-22:00", 2, 13 * 60))
        assertEquals(OpeningHours.Now(false), OpeningHours.at("Mo-Fr 08:00-20:00; Sa,Su off", 5, 12 * 60))
        assertEquals(OpeningHours.Now(true, "02:00"), OpeningHours.at("Mo-Su 18:00-02:00", 1, 60))
        assertNull(OpeningHours.at("Jan-Mar Mo-Fr 09:00-17:00", 0, 600))
    }

    @Test fun tileRowsKeepFacilitiesAndHours() {
        val p = MasjidLists.parse("""{"places":[["n1",1.3,103.8,"Surau Mall","",1,"wa","Mo-Su 10:00-22:00"],["n2",1.31,103.81,"Masjid X","",0],["n3",1.32,103.82,"Kubur Kassim","",0]]}""")!!
        assertEquals(2, p.size)
        assertEquals("wa", p[0].facilities)
        assertEquals("Mo-Su 10:00-22:00", p[0].hours)
        assertEquals("", p[1].facilities)
    }
}
