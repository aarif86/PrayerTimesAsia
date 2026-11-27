package com.prayertimesasia.core

/**
 * The quick guide new users see once, after choosing their place (and again from
 * Settings). The words live in data/guide-words.json and are written into
 * GuideWordsData.kt by tools/build_guide_words.py.
 */
/** One moment on a card's little phone: an app screen, the box the finger points at
 *  (fractions of the screen), the words under it, and whether the finger taps. */
data class GuideStep(val shot: String, val x: Float, val y: Float, val w: Float, val h: Float, val say: String, val tap: Boolean)

object GuideWords {
    val cards: List<String> get() = GuideWordsData.cards

    /** The steps the little phone plays on this card. */
    fun steps(card: String): List<GuideStep> = GuideWordsData.steps[card].orEmpty()

    /** The line for this key in this language, with its {holes} filled in. */
    fun word(lang: RamadanContent.Lang, key: String, args: Map<String, String> = emptyMap()): String {
        var line = GuideWordsData.data[lang]?.get(key) ?: GuideWordsData.data[RamadanContent.Lang.EN]?.get(key) ?: key
        args.forEach { (name, value) -> line = line.replace("{$name}", value) }
        return line
    }
}
