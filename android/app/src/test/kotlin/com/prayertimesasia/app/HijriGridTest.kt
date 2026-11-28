package com.prayertimesasia.app

import com.prayertimesasia.app.widget.HijriGrid
import com.prayertimesasia.core.Hijri
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Hijri Calendar widget's month grid. */
class HijriGridTest {
    private val umm: (LocalDate) -> Hijri.HijriDate = { Hijri.fromLocalDate(it) }

    @Test fun ramadan_has_days_an_eid_cell_and_no_countdown() {
        val g = HijriGrid.of(LocalDate.of(2027, 2, 20), umm)
        assertEquals(9, g.month)
        assertEquals(1448, g.year)
        assertTrue(g.cells.size in 29..30)
        assertNotNull(g.eidAfter)
        assertNull(g.daysToRamadan)
        assertEquals(1, g.cells.count { it.isToday })
        assertEquals(HijriGrid.Mark.NUZUL, g.cells.first { it.day == 17 }.mark)
        assertEquals(HijriGrid.Mark.LAST_TEN, g.cells.first { it.day == 25 }.mark)
        assertTrue(g.lead in 0..6)
    }

    @Test fun before_ramadan_counts_the_days() {
        val g = HijriGrid.of(LocalDate.of(2026, 11, 28), umm)
        assertTrue(g.month != 9)
        assertNull(g.eidAfter)
        assertTrue("got ${g.daysToRamadan}", g.daysToRamadan in 60..90)
    }
}
