package com.prayertimesasia.core

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReviewsTest {
    @Test fun playButtonOnlyOnceLive() {
        assertEquals(listOf("google"), Reviews.links(onGooglePlay = false).map { it.id })
        assertEquals(listOf("play", "google"), Reviews.links(onGooglePlay = true).map { it.id })
        assertEquals("https://g.page/r/CSq5hZxhRs1BEBM/review", Reviews.links().last().url)
    }

    @Test fun noteEmail() {
        val (subject, body) = Reviews.noteEmail(Reviews.NoteKind.KIND, " Thank you ", "Version 1, Android", mayShare = true)
        assertEquals("A kind word | Prayer Times Asia", subject)
        assertEquals("Thank you\n\nYou may share these words on the website, without my name.\n\nVersion 1, Android\n", body)
        assertEquals("(no words)\n", Reviews.noteEmail(Reviews.NoteKind.IDEA, "", null, true).second)
    }

    @Test fun calmMoments() {
        val now = Instant.parse("2026-11-19T04:00:00Z")
        assertFalse(Reviews.isCalm(9, 10, now, null, null))
        assertTrue(Reviews.isCalm(10, 10, now, now.minusSeconds(3600), now.plusSeconds(3600)))
        assertFalse(Reviews.isCalm(10, 10, now, now.minusSeconds(3600), now.plusSeconds(600)))
        assertFalse(Reviews.isCalm(10, 10, now, now.minusSeconds(300), now.plusSeconds(3600)))
    }

    @Test fun starsOnlyAfterOurLineAndRarely() {
        val now = Instant.parse("2026-11-19T04:00:00Z")
        val p = Preferences(hasOnboarded = true, openDayCount = 20)
        assertFalse(Reviews.mayAskForStars(p, now, null, null))
        assertTrue(Reviews.mayAskForStars(p.copy(noteCardDone = true), now, null, null))
        assertFalse(Reviews.mayAskForStars(p.copy(noteCardDone = true, starBoxAskedAt = now.toEpochMilli() - 86_400_000), now, null, null))
    }

    @Test fun oldSettingsKeepDefaults() {
        val p = Preferences.decode("""{"hasOnboarded":true}""")
        assertEquals(0, p.openDayCount)
        assertEquals("", p.reviewDraft)
    }
}
