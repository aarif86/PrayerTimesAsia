package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The worldwide country table (data/countries.json): authority first, standard method only as a fallback. */
class WorldTest {
    @Test fun everyCountryHasAKnownMethod() {
        assertTrue(AsiaRegions.profiles.size > 140)
        for (p in AsiaRegions.profiles) assertNotNull(p.code, CalculationMethod.withId(p.methodId))
    }

    @Test fun followsTheAuthority() {
        assertEquals(TimesSource.AUTHORITY, AsiaRegions.profile("SA")?.source)
        assertEquals(AsrSchool.STANDARD, AsiaRegions.profile("TR")?.asr) // Diyanet's Ikindi is one shadow length
        assertEquals("moonsighting", AsiaRegions.profile("GB")?.method?.id)
        assertEquals("FR", AsiaRegions.countryCode("Europe/Paris"))
    }

    @Test fun sourceLinesHaveNoColonsOrDashes() {
        for (p in AsiaRegions.profiles) for (pinned in listOf(false, true)) for (short in listOf(false, true)) {
            val text = p.sourceSummary(p.method, pinned, short)
            assertFalse(p.code, text.contains(":") || text.contains(" - ") || text.contains("—"))
        }
    }

    @Test fun countrySummerNightRule() {
        val norway = AsiaRegions.profile("NO")!!
        assertEquals(HighLatitudeRule.ANGLE, norway.here(CalculationMethod.EGYPTIAN).highLatitude)
        assertEquals(HighLatitudeRule.MOONSIGHTING, norway.here(CalculationMethod.MOONSIGHTING).highLatitude)
        assertEquals(HighLatitudeRule.FALLBACK, AsiaRegions.profile("MY")!!.method.highLatitude)
    }

    @Test fun findsWorldCitiesOffline() {
        val london = Cities.search("London").first()
        assertEquals("GB", london.country)
        assertEquals("Europe/London", london.zone)
        assertEquals("America/Toronto", Cities.search("Toronto").first().zone)
    }
}
