package com.prayertimesasia.core

import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue

class RoomSuggestionTest {
    @Test
    fun emailListsOnlyWhatWasFilledIn() {
        val (subject, body) = RoomSuggestion.email(" Pasir Ris Mall ", "3", "", "Next to the toilets", "",
            setOf(RoomSuggestion.Has.ABLUTION, RoomSuggestion.Has.WOMEN), Coordinates(1.3734561, 103.9499123), Coordinates(1.37, 103.95), "Version 1, Android")
        assertEquals("Suggest a prayer room: Pasir Ris Mall | Prayer Times Asia", subject)
        assertTrue(body.startsWith("Place: Pasir Ris Mall\nLevel: 3\nHow to find it: Next to the toilets\nHas: Women's space, Place for wudhu\n"))
        assertTrue("mlat=1.37346&mlon=103.94991" in body)
        assertFalse("Near" in body)
    }

    @Test
    fun needsANameAndAnAddressOrPin() {
        assertFalse(RoomSuggestion.ready("X", "", null))
        assertTrue(RoomSuggestion.ready("X", "1 Road", null))
        assertFalse(RoomSuggestion.ready(" ", "1 Road", null))
    }
}
