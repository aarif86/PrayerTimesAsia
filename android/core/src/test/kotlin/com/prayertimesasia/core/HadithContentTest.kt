package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The hadith around the app: complete, plain to read, and on unless turned off. */
class HadithContentTest {
    @Test
    fun everyHadithIsComplete() {
        assertEquals(HadithId.entries.size, Hadith.ALL.size)
        for (h in Hadith.ALL) {
            assertTrue(h.arabic.isNotBlank())
            for (lang in RamadanContent.Lang.entries) {
                assertFalse("${h.id} has a colon", ':' in h.meaning(lang))
                assertTrue(h.source(lang).isNotBlank())
            }
        }
    }

    @Test
    fun alertLineNamesTheBookOnly() {
        assertEquals("“When you hear the azan, say what the muazzin says.” al Bukhari", Hadith.of(HadithId.AZAN).alertLine(RamadanContent.Lang.EN))
    }

    @Test
    fun onByDefaultAndOldSettingsKeepIt() {
        val old = Preferences.decode("{}")
        assertTrue(old.showHadith)
        assertTrue(old.hadithInAlerts)
        assertEquals(emptyList<String>(), old.hiddenHadith)
        assertEquals(listOf("river"), Preferences.decode("""{"hiddenHadith":["river"]}""").hiddenHadith)
    }
}
