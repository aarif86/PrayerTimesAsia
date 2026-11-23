package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Qibla, distance and the Jumaat leave choices. Same cases as web/tests/featureSweepCore.test.ts. */
class FeatureSweepTest {
    private val singapore = Coordinates(1.3521, 103.8198)

    @Test fun qiblaPointsTheRightWayFromWellKnownCities() {
        assertEquals(293.0, Geo.qiblaBearing(singapore), 1.0)
        assertEquals(118.9, Geo.qiblaBearing(Coordinates(51.5074, -0.1278)), 1.0)
        assertEquals(58.5, Geo.qiblaBearing(Coordinates(40.7128, -74.006)), 1.0)
        assertEquals(277.0, Geo.qiblaBearing(Coordinates(-33.8688, 151.2093)), 1.0)
    }

    @Test fun qiblaStaysInRangeAcrossTheDateLineAndAtThePoles() {
        for ((lat, lng) in listOf(0.0 to 179.9, 0.0 to -179.9, 89.9 to 0.0, -89.9 to 100.0, 21.4225 to 39.8262)) {
            val b = Geo.qiblaBearing(Coordinates(lat, lng))
            assertTrue(b >= 0.0 && b < 360.0)
            assertTrue(!b.isNaN())
        }
    }

    @Test fun distanceIsInKmZeroAtTheKaabaAndTheSameBothWays() {
        assertEquals(0.0, Geo.distanceKm(Geo.kaaba, Geo.kaaba), 0.0)
        val d = Geo.distanceKm(singapore, Geo.kaaba)
        assertTrue(d > 7200 && d < 7350)
        assertEquals(d, Geo.distanceKm(Geo.kaaba, singapore), 1e-6)
    }

    @Test fun compassPointsAndTheShortWayRound() {
        assertEquals("N", Geo.compassPoint(0.0))
        assertEquals("N", Geo.compassPoint(359.0))
        assertEquals("WNW", Geo.compassPoint(293.0))
        assertEquals("W", Geo.compassPoint(-90.0))
        assertEquals(-20.0, Geo.angleDelta(350.0, 10.0), 1e-9)
        assertEquals(20.0, Geo.angleDelta(10.0, 350.0), 1e-9)
        assertEquals(180.0, Geo.angleDelta(180.0, 0.0), 1e-9)
    }

    @Test fun jumaatLeaveKeepsListedChoicesMovesTwentyUpAndTurnsOthersOff() {
        assertEquals(60, JumuahLeave.snap(60))
        assertEquals(30, JumuahLeave.snap(20))
        assertEquals(0, JumuahLeave.snap(7))
        assertEquals(0, JumuahLeave.snap(-15))
    }

    @Test fun jumaatLeaveSaysTheTimeInPlainWords() {
        assertEquals("15 min", JumuahLeave.span(15, RamadanContent.Lang.EN))
        assertEquals("1 hour", JumuahLeave.span(60, RamadanContent.Lang.EN))
        assertEquals("1 hour 30 min", JumuahLeave.span(90, RamadanContent.Lang.EN))
        assertEquals("3 hours", JumuahLeave.span(180, RamadanContent.Lang.EN))
        assertEquals("1 jam 30 minit", JumuahLeave.span(90, RamadanContent.Lang.MS))
        assertEquals("1 jam 30 menit", JumuahLeave.span(90, RamadanContent.Lang.ID))
    }
}
