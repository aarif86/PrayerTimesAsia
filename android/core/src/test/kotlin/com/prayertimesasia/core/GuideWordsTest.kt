package com.prayertimesasia.core

import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue

class GuideWordsTest {
    @Test fun everyCardHasWordsInEveryLanguage() {
        for (lang in RamadanContent.Lang.entries) for (card in GuideWords.cards) {
            assertFalse(GuideWords.word(lang, "${card}_title").endsWith("_title"))
            assertFalse(GuideWords.word(lang, "${card}_body").endsWith("_body"))
        }
        assertEquals("2 of 8", GuideWords.word(RamadanContent.Lang.EN, "of", mapOf("n" to "2", "t" to "8")))
    }

    @Test fun everyCardPlaysStepsWithWordsAndABoxOnTheScreen() {
        for (card in GuideWords.cards) {
            val steps = GuideWords.steps(card)
            assertTrue(card, steps.size >= 2)
            for (s in steps) {
                assertFalse(GuideWords.word(RamadanContent.Lang.MS, s.say) == s.say)
                assertTrue(s.shot, s.x >= 0f && s.y >= 0f && s.x + s.w <= 1.01f && s.y + s.h <= 1.01f)
            }
        }
    }

    @Test fun startsInMalayOrIndonesianWhenThePhoneOrNamesAre() {
        assertEquals(RamadanContent.Lang.MS, GuideWords.startLanguage(NamingStyle.MALAY, "en"))
        assertEquals(RamadanContent.Lang.ID, GuideWords.startLanguage(NamingStyle.INTERNATIONAL, "in"))
        assertEquals(RamadanContent.Lang.EN, GuideWords.startLanguage(NamingStyle.INTERNATIONAL, "fr"))
    }

    @Test fun peopleAlreadyUsingTheAppAreNotShownTheGuide() {
        assertTrue(Preferences.decode("""{"hasOnboarded":true}""").guideSeen == true)
        assertTrue(Preferences.decode(null).guideSeen != true)
        assertTrue(Preferences.decode("""{"hasOnboarded":true,"guideSeen":false}""").guideSeen == false)
    }
}
