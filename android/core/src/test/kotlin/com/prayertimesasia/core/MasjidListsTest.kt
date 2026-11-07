package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MasjidListsTest {
    @Test fun picksTheListsAnAreaNeeds() {
        assertEquals(listOf("MY"), MasjidLists.countries(Coordinates(3.1390, 101.6869)))
        assertEquals(listOf("MY", "SG"), MasjidLists.countries(Coordinates(1.4360, 103.7860)))
        assertEquals(listOf("BN", "MY"), MasjidLists.countries(Coordinates(4.8903, 114.9402)))
        assertEquals(emptyList<String>(), MasjidLists.countries(Coordinates(10.7769, 106.7009)))
    }

    @Test fun readsTheListAndKeepsNearbyPlaces() {
        val json = """{"country":"MY","updated":"2026-11-07","places":[["n1",3.1418,101.6917,"Masjid Negara","",0],["w2",3.15,101.7,"","Jalan Ampang",1],["n3",5.4,100.3,"Far Away Masjid","",0]]}"""
        val all = MasjidLists.parse(json)!!
        assertEquals(listOf("Masjid Negara", "Musollah", "Far Away Masjid"), all.map { it.name })
        val near = MasjidLists.near(all, Coordinates(3.1390, 101.6869))
        assertEquals(listOf("Masjid Negara", "Musollah"), near.map { it.name })
        assertEquals(listOf(false, true), near.map { it.isMusollah })
        assertNull(MasjidLists.parse("oops"))
    }
}
