package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TimeKindTest {
    private fun m(id: String) = CalculationMethod.withId(id)!!

    @Test fun namesThePlainKinds() {
        assertEquals(TimeKind.PUBLISHED, TimeKind.of(SourceGrade.OFFICIAL, true, m("muis")))
        assertEquals(TimeKind.FORMULA, TimeKind.of(SourceGrade.OFFICIAL, false, m("ummalqura")))
        assertEquals(TimeKind.FORMULA, TimeKind.of(SourceGrade.CALCULATED, false, m("jakim")))
        assertEquals(TimeKind.CALCULATED, TimeKind.of(SourceGrade.CALCULATED, false, m("mwl")))
        assertEquals(TimeKind.MASJID, TimeKind.of(SourceGrade.MASJID, false, m("mwl")))
    }

    @Test fun knowsWhichCountryAMethodBelongsTo() {
        assertEquals("MY", TimeKind.methodCountry(m("jakim"))?.code)
        assertEquals("SG", TimeKind.methodCountry(m("muis"))?.code)
        assertNull(TimeKind.methodCountry(m("mwl")))
    }

    @Test fun onlyWarnsForAPinnedMethodUsedInAnotherCountry() {
        assertEquals("MY", TimeKind.awayFromMethodCountry(true, m("jakim"), "SG")?.code)
        assertNull(TimeKind.awayFromMethodCountry(true, m("jakim"), "MY"))
        assertNull(TimeKind.awayFromMethodCountry(false, m("jakim"), "SG"))
        assertNull(TimeKind.awayFromMethodCountry(true, m("mwl"), "SG"))
        assertNull(TimeKind.awayFromMethodCountry(true, m("jakim"), null))
    }
}
