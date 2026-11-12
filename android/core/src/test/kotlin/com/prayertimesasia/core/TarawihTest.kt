package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The Tarawih counter. Same cases as web/tests/tarawih.test.ts. */
class TarawihTest {
    @Test fun countsTwoRakaatATapAndStopsAtTheTotal() {
        var n = 0
        repeat(3) { n = Tarawih.tap(n, 8) }
        assertEquals(6, n)
        assertEquals(8, Tarawih.tap(n, 8))
        assertEquals(8, Tarawih.tap(8, 8))
        assertEquals(20, Tarawih.tap(18, 20))
        assertEquals(20, Tarawih.tap(20, 20))
    }

    @Test fun undoNeverGoesBelowNothing() {
        assertEquals(4, Tarawih.undo(6))
        assertEquals(0, Tarawih.undo(0))
    }

    @Test fun oneDotPerSalam() {
        assertEquals(4, Tarawih.sets(8))
        assertEquals(10, Tarawih.sets(20))
    }

    @Test fun keepsEightOrTwentyOnly() {
        assertNull(Preferences.decode("{}").tarawihRakaat)
        assertEquals(8, Preferences.decode("""{"tarawihRakaat": 8}""").tarawihRakaat)
        assertEquals(20, Preferences.decode("""{"tarawihRakaat": 20}""").tarawihRakaat)
        assertNull(Preferences.decode("""{"tarawihRakaat": 11}""").tarawihRakaat)
    }

    @Test fun theChoiceTravelsWithMoveMySettings() {
        val moved = MovedSettings.from(Preferences(tarawihRakaat = 20))
        assertEquals(20, moved.tarawihRakaat)
        assertEquals(20, MovedSettings.fromCode(moved.code)!!.appliedTo(Preferences()).tarawihRakaat)
        assertNull(MovedSettings.from(Preferences()).tarawihRakaat)
        assertNull(moved.copy(tarawihRakaat = 11).appliedTo(Preferences()).tarawihRakaat)
    }
}
