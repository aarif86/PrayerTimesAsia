package com.prayertimesasia.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The Ramadan page and card have every line in English, Malay and Indonesian, the same as data/ramadan-words.json. */
class RamadanWordsTest {
    @Test fun everyLineInEveryLanguage() {
        for (lang in RamadanContent.Lang.entries) {
            for (key in RamadanWordKey.entries) {
                assertNotNull("$lang $key", RamadanWordsData.data[lang]?.get(key.name))
                assertFalse("$lang $key has a colon", RamadanWords.text(key, lang).contains(':'))
            }
            for (m in FastMark.entries) assertFalse("$lang $m", RamadanWords.mark(m, lang).isEmpty())
        }
    }

    @Test fun sameAsTheSharedWordList() {
        val dir = File(System.getProperty("testdata.dir") ?: "../../testdata").parentFile
        val file = File(dir, "data/ramadan-words.json")
        assertTrue("missing $file", file.exists())
        val json = Json.parseToJsonElement(file.readText()).jsonObject
        for (lang in RamadanContent.Lang.entries) {
            val want = json.getValue(lang.name.lowercase()).jsonObject.mapValues { it.value.jsonPrimitive.content }
            assertEquals(lang.name, want, RamadanWordsData.data[lang])
        }
    }

    @Test fun fillsInTheHoles() {
        assertEquals("Ramadan in about 12 days", RamadanWords.text(RamadanWordKey.beginsInDays, RamadanContent.Lang.EN, "n" to 12))
        assertEquals("Lebih kurang 12 hari lagi menjelang Ramadan", RamadanWords.text(RamadanWordKey.beginsInDays, RamadanContent.Lang.MS, "n" to 12))
        assertEquals("1 Ramadan fast to replace.", RamadanWords.text(RamadanWordKey.fastsToReplace, RamadanContent.Lang.EN, "n" to 1))
        assertEquals("3 Ramadan fasts to replace.", RamadanWords.text(RamadanWordKey.fastsToReplace, RamadanContent.Lang.EN, "n" to 3))
        assertEquals("Bepergian", RamadanWords.mark(FastMark.TRAVEL, RamadanContent.Lang.ID))
        assertEquals("H", RamadanWords.letter(FastMark.PERIOD, RamadanContent.Lang.MS))
        assertEquals("Malam ini malam 27, salah satu malam ganjil. Carilah Lailatul Qadar.", RamadanWords.In(RamadanContent.Lang.ID)(RamadanWordKey.oddNight, "n" to 27))
    }
}
