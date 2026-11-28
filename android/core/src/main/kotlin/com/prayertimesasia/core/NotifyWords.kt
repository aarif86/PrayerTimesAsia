package com.prayertimesasia.core

/**
 * The words of every alert (titles and lines) in the app language, from the shared list in
 * data/app-words (keys notify.* and phone.notify.*). The prayer names are filled in by the caller and
 * follow the prayer names setting, never this language. Same words as web and iPhone.
 */
object NotifyWords {
    private val HOLE = Regex("""\{([a-zA-Z]+)\}""")

    /** The line for this key in this language, with its {holes} filled in. A line the language lacks falls back to English. */
    fun line(lang: RamadanContent.Lang, key: String, vararg args: Pair<String, Any>): String {
        val text = NotifyWordsData.data[lang]?.get(key) ?: NotifyWordsData.data.getValue(RamadanContent.Lang.EN)[key] ?: return ""
        if (args.isEmpty()) return text
        val values = args.toMap()
        return HOLE.replace(text) { m -> values[m.groupValues[1]]?.toString() ?: m.value }
    }
}
