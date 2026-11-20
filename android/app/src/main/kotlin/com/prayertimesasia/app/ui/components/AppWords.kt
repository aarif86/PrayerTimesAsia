package com.prayertimesasia.app.ui.components

import android.app.LocaleManager
import android.content.Context
import android.os.Build
import android.os.LocaleList
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource

/**
 * The shared app words (data/app-words), written into app_words.xml in res/values,
 * values-ms and values-in by tools/build_android_words.py. A line can have {holes}, filled in here:
 * `tr(R.string.today_leftToPray, "time" to "19m")`.
 */
object AppWords {
    private val HOLE = Regex("""\{([a-z]+)\}""")

    /** Fills the {holes} in a line. A hole with no value stays as it is. */
    fun fill(line: String, args: Array<out Pair<String, Any>>): String {
        if (args.isEmpty()) return line
        val values = args.toMap()
        return HOLE.replace(line) { m -> values[m.groupValues[1]]?.toString() ?: m.value }
    }

    /** The app languages, in the order Settings shows them. Each name is written in its own language. */
    val LANGUAGES: List<Pair<String, String>> = listOf("en" to "English", "ms" to "Bahasa Melayu", "id" to "Bahasa Indonesia")

    /** The language picked for this app in Settings (Android 13 and later), or null when it follows the phone. */
    fun picked(context: Context): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return null
        val locales = context.getSystemService(LocaleManager::class.java)?.applicationLocales ?: return null
        if (locales.size() == 0) return null
        val tag = locales[0].language
        return when (tag) { "in" -> "id"; else -> tag }.takeIf { t -> LANGUAGES.any { it.first == t } }
    }

    /** Pick the app language (null = follow the phone). Android 13 and later only; the app restarts its screen in that language. */
    fun pick(context: Context, language: String?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val manager = context.getSystemService(LocaleManager::class.java) ?: return
        manager.applicationLocales = if (language == null) LocaleList.getEmptyLocaleList() else LocaleList.forLanguageTags(language)
    }
}

/** A line from the shared app words in the app language, with its {holes} filled in. */
@Composable
fun tr(@StringRes id: Int, vararg args: Pair<String, Any>): String = AppWords.fill(stringResource(id), args)

/** The same outside Compose (alerts, widgets). */
fun Context.word(@StringRes id: Int, vararg args: Pair<String, Any>): String = AppWords.fill(getString(id), args)

/** For a count: the `_one` line when there is exactly one, else the usual line. `n` fills the {n} hole. */
@Composable
fun trCount(@StringRes id: Int, @StringRes oneId: Int, n: Int, vararg args: Pair<String, Any>): String =
    tr(if (n == 1) oneId else id, "n" to n, *args)
