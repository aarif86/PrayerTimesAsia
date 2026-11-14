package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Journey and musafir: the same rules as the web and iPhone. */
class MusafirTest {
    private val shafii = Musafir.Rules(AsrSchool.STANDARD, 81.0)
    private val hanafi = Musafir.Rules(AsrSchool.HANAFI, 78.0)
    private val sg = Coordinates(1.3521, 103.8198)
    private val kl = Coordinates(3.139, 101.6869)
    /** A point [km] due north of Singapore. */
    private fun north(km: Double) = Coordinates(sg.latitude + km / 111.195, sg.longitude)

    @Test fun nothingWithoutAHome() {
        assertNull(Musafir.status(null, kl, 0, shafii))
    }

    @Test fun homeNearbyAndTraveller() {
        assertEquals(Musafir.Status.Home, Musafir.status(sg, north(1.0), 0, shafii))
        assertTrue(Musafir.status(sg, north(50.0), 0, shafii) is Musafir.Status.Nearby)
        assertTrue(Musafir.status(sg, kl, 0, shafii) is Musafir.Status.Traveller)
    }

    @Test fun switching81To89ChangesAnEightyFiveKmTrip() {
        assertTrue(Musafir.status(sg, north(85.0), 0, shafii) is Musafir.Status.Traveller)
        assertTrue(Musafir.status(sg, north(85.0), 0, shafii.copy(thresholdKm = 89.0)) is Musafir.Status.Nearby)
    }

    @Test fun concessionEndsAfterThreeOrFifteenDays() {
        assertTrue(Musafir.status(sg, kl, 3, shafii) is Musafir.Status.Traveller)
        assertTrue(Musafir.status(sg, kl, 4, shafii) is Musafir.Status.Settled)
        assertTrue(Musafir.status(sg, kl, 15, hanafi) is Musafir.Status.Traveller)
        assertTrue(Musafir.status(sg, kl, 16, hanafi) is Musafir.Status.Settled)
    }

    @Test fun neverSaysEightyOneKmIsLessThanEightyOne() {
        val s = Musafir.status(sg, north(80.7), 0, shafii)!!
        assertTrue(s is Musafir.Status.Nearby)
        val (counts, text) = Musafir.distanceCheck(s, shafii)!!
        assertEquals(false, counts)
        assertTrue(text, text.startsWith("You are 80 km from home. That is less than 81 km"))
    }
}
