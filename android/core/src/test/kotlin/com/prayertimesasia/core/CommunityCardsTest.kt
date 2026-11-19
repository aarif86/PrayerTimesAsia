package com.prayertimesasia.core

import java.time.LocalDate
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue

/** The community cards by country, one a day. Same cases as web/tests/communityCards.test.ts. */
class CommunityCardsTest {
    private fun card(id: String, countries: List<String>, kind: CommunityCard.Kind = CommunityCard.Kind.OURS, from: String? = null, until: String? = null) =
        CommunityCard(id, kind, countries, id, id, "$id.com", "https://$id.com", CommunityCard.Icon.GLOBE, from, until)

    @Test fun badalAndNasarDigitalEverywhereOneADay() {
        for (country in listOf("SG", "MY", "ID", "VN", "GB")) {
            assertEquals(listOf("badal", "digital"), CommunityCard.cardsFor(country, LocalDate.of(2026, 11, 17)).map { it.id })
        }
        val a = CommunityCard.ofTheDay("SG", LocalDate.of(2026, 11, 17))!!.id
        assertNotEquals(a, CommunityCard.ofTheDay("SG", LocalDate.of(2026, 11, 18))!!.id)
        assertEquals(a, CommunityCard.ofTheDay("SG", LocalDate.of(2026, 11, 19))!!.id)
    }

    @Test fun eachCountryGetsItsOwnCardsPlusEverywhere() {
        val all = listOf(card("everywhere", listOf("*")), card("sgshop", listOf("SG")), card("myshop", listOf("MY", "BN")))
        val d = LocalDate.of(2026, 11, 17)
        assertEquals(listOf("everywhere", "sgshop"), CommunityCard.cardsFor("SG", d, all).map { it.id })
        assertEquals(listOf("everywhere", "myshop"), CommunityCard.cardsFor("BN", d, all).map { it.id })
        assertEquals(listOf("everywhere"), CommunityCard.cardsFor("FR", d, all).map { it.id })
    }

    @Test fun paidCardOnlyBetweenItsDates() {
        val all = listOf(card("paid", listOf("SG"), CommunityCard.Kind.SPONSOR, "2026-12-01", "2026-12-31"))
        assertTrue(CommunityCard.cardsFor("SG", LocalDate.of(2026, 11, 30), all).isEmpty())
        assertEquals(1, CommunityCard.cardsFor("SG", LocalDate.of(2026, 12, 1), all).size)
        assertEquals(1, CommunityCard.cardsFor("SG", LocalDate.of(2026, 12, 31), all).size)
        assertNull(CommunityCard.ofTheDay("SG", LocalDate.of(2027, 1, 2), all))
    }

    @Test fun linkTags() {
        assertEquals("https://badal.sg/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=prayer", CommunityCard.all[0].url("prayer"))
    }
}
