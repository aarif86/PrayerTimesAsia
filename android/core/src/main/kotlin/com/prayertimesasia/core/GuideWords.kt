package com.prayertimesasia.core

/**
 * The quick guide new users see once, after choosing their place (and again from
 * Settings). The words live in data/guide-words.json and are written into
 * GuideWordsData.kt by tools/build_guide_words.py.
 */
object GuideWords {
    val cards: List<String> get() = GuideWordsData.cards

    /** The line for this key in this language, with its {holes} filled in. */
    fun word(lang: RamadanContent.Lang, key: String, args: Map<String, String> = emptyMap()): String {
        var line = GuideWordsData.data[lang]?.get(key) ?: GuideWordsData.data[RamadanContent.Lang.EN]?.get(key) ?: key
        args.forEach { (name, value) -> line = line.replace("{$name}", value) }
        return line
    }

    /** The prayer names' language if it is Malay or Indonesian, else the phone's. */
    fun startLanguage(naming: NamingStyle, localeLanguage: String): RamadanContent.Lang {
        val fromNames = RamadanContent.lang(naming)
        if (fromNames != RamadanContent.Lang.EN) return fromNames
        return when (localeLanguage.lowercase()) {
            "ms" -> RamadanContent.Lang.MS
            "id", "in" -> RamadanContent.Lang.ID
            else -> RamadanContent.Lang.EN
        }
    }
}
