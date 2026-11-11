package com.prayertimesasia.core

import java.util.Locale

/**
 * Every word on the Ramadan page and the Ramadan card, in English, Malay and
 * Indonesian (data/ramadan-words.json, written into RamadanWordsData.kt by
 * tools/build_ramadan_words.py). The language follows the prayer names, like the
 * doa and the alerts. The doa and niat text itself is in [RamadanContent].
 */
object RamadanWords {
    /** The line for this key in this language, with its {holes} filled in. */
    fun text(key: RamadanWordKey, lang: RamadanContent.Lang, vararg args: Pair<String, Any>): String {
        val words = RamadanWordsData.data[lang].orEmpty()
        val one = if (args.any { it.first == "n" && it.second.toString() == "1" }) words[key.name + "_one"] else null
        var line = one ?: words[key.name] ?: RamadanWordsData.data[RamadanContent.Lang.EN]?.get(key.name).orEmpty()
        for ((name, value) in args) line = line.replace("{$name}", value.toString())
        return line
    }

    fun mark(m: FastMark, lang: RamadanContent.Lang): String = line("mark_" + m.name.lowercase(), lang)

    /** One letter for a day in the month grid; empty for a kept fast. */
    fun letter(m: FastMark, lang: RamadanContent.Lang): String = line("letter_" + m.name.lowercase(), lang)

    fun locale(lang: RamadanContent.Lang): Locale = when (lang) {
        RamadanContent.Lang.EN -> Locale.UK
        RamadanContent.Lang.MS -> Locale.forLanguageTag("ms-MY")
        RamadanContent.Lang.ID -> Locale.forLanguageTag("id-ID")
    }

    private fun line(key: String, lang: RamadanContent.Lang): String =
        RamadanWordsData.data[lang]?.get(key) ?: RamadanWordsData.data[RamadanContent.Lang.EN]?.get(key).orEmpty()

    /** A short way to write lines in one language: `val t = RamadanWords.In(lang); t(RamadanWordKey.imsak)`. */
    class In(val lang: RamadanContent.Lang) {
        operator fun invoke(key: RamadanWordKey, vararg args: Pair<String, Any>): String = text(key, lang, *args)
        fun mark(m: FastMark): String = RamadanWords.mark(m, lang)
        fun letter(m: FastMark): String = RamadanWords.letter(m, lang)
    }
}
