package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MasjidListsTest {
    @Test fun picksTheSquaresAnAreaNeeds() {
        assertEquals(listOf("3_101"), MasjidLists.tiles(Coordinates(3.1390, 101.6869)))
        assertEquals(setOf("0_103", "0_104", "1_103", "1_104"), MasjidLists.tiles(Coordinates(1.05, 103.95)).toSet())
        assertEquals(setOf("-17_179", "-17_-180"), MasjidLists.tiles(Coordinates(-16.5, 179.95)).toSet())
    }

    @Test fun readsTheIndex() {
        val index = MasjidLists.parseIndex("""{"updated":"2026-11-07","countries":{"MY":{"places":2}},"tiles":["3_101"]}""")!!
        assertEquals(setOf("3_101"), index.tiles)
        assertEquals(setOf("MY"), index.countries)
        assertNull(MasjidLists.parseIndex("oops"))
    }

    @Test fun readsASquareAndKeepsNearbyPlaces() {
        val json = """{"tile":"3_101","updated":"2026-11-07","places":[["n1",3.1418,101.6917,"Masjid Negara","",0],["w2",3.15,101.7,"","Jalan Ampang",1],["n3",3.9,101.9,"Far Away Masjid","",0]]}"""
        val all = MasjidLists.parse(json)!!
        assertEquals(listOf("Masjid Negara", "Musollah", "Far Away Masjid"), all.map { it.name })
        val near = MasjidLists.near(all, Coordinates(3.1390, 101.6869))
        assertEquals(listOf("Masjid Negara", "Musollah"), near.map { it.name })
        assertEquals(listOf(false, true), near.map { it.isMusollah })
        assertNull(MasjidLists.parse("oops"))
    }
}
