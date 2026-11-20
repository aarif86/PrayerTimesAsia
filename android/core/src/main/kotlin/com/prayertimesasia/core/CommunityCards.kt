package com.prayertimesasia.core

import java.time.LocalDate

/**
 * The small cards under Show more on the Prayer screen and in Settings. No ad
 * networks, nothing tracked: each card is a plain link. The list lives in
 * data/community-cards.json (written into CommunityCardsData.kt by
 * tools/build_community_cards.py), every card approved by hand against
 * docs/community-cards.md. Same rules as communityCards.ts and CommunityCards.swift.
 */
data class CommunityCard(
    val id: String,
    /** OURS = the makers' own services; SPONSOR = a paid community card, shown with a Sponsored tag. */
    val kind: Kind,
    /** Two letter country codes, or "*" for everywhere. */
    val countries: List<String>,
    val title: String,
    val subtitle: String,
    val site: String,
    val link: String,
    val icon: Icon,
    /** First and last day shown (YYYY-MM-DD, the phone's own date). */
    val from: String?,
    val until: String?,
) {
    enum class Kind { OURS, SPONSOR }
    enum class Icon { KAABA, GLOBE, SHOP, HEART }

    val isSponsor: Boolean get() = kind == Kind.SPONSOR

    /** The website, tagged with where in the app it was tapped so visits show in the site's own analytics. The app records nothing. */
    fun url(placement: String): String {
        val sep = if ("?" in link) "&" else if (link.endsWith("/")) "?" else "/?"
        return "$link${sep}utm_source=prayertimesasia&utm_medium=app&utm_campaign=$placement"
    }

    companion object {
        val all: List<CommunityCard> get() = CommunityCardsData.all

        /** Every card for this country on this day: its own cards plus the ones for everywhere, in list order. */
        fun cardsFor(country: String, today: LocalDate, cards: List<CommunityCard> = all): List<CommunityCard> {
            val key = today.toString()
            return cards.filter { c ->
                ("*" in c.countries || country in c.countries) &&
                    (c.from == null || c.from <= key) && (c.until == null || key <= c.until)
            }
        }

        /** Today's one card on the Prayer screen. It moves to the next one each day. */
        fun ofTheDay(country: String, today: LocalDate, cards: List<CommunityCard> = all): CommunityCard? {
            val pool = cardsFor(country, today, cards)
            return if (pool.isEmpty()) null else pool[Math.floorMod(today.toEpochDay(), pool.size.toLong()).toInt()]
        }

        /** The makers' own cards, listed in Settings. */
        fun ours(country: String, today: LocalDate = LocalDate.now()): List<CommunityCard> =
            cardsFor(country, today).filter { it.kind == Kind.OURS }
    }
}
