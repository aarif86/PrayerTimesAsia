package com.prayertimesasia.app.data

import android.content.Context
import com.prayertimesasia.core.Preferences

/** Everything the user chooses, as one JSON blob (the iOS app's UserDefaults key). */
class PrefsStore(context: Context) {
    private val sp = context.getSharedPreferences("prayertimesasia", Context.MODE_PRIVATE)

    fun load(): Preferences = Preferences.decode(sp.getString(KEY, null))

    fun save(prefs: Preferences) {
        sp.edit().putString(KEY, prefs.encode()).apply()
    }

    companion object {
        private const val KEY = "preferences.v1"
    }
}
