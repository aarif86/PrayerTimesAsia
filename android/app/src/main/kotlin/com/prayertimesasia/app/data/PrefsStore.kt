package com.prayertimesasia.app.data

import android.content.Context
import com.prayertimesasia.core.CoreJson
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Preferences

/** Everything the user chooses, as one JSON blob (the iOS app's UserDefaults key). */
class PrefsStore(private val context: Context) {
    private val sp = context.getSharedPreferences("prayertimesasia", Context.MODE_PRIVATE)

    /** A new install follows the phone's own clock setting for 24 hour time; after that it is the user's choice. */
    fun load(): Preferences = sp.getString(KEY, null)?.let { Preferences.decode(it) }
        ?: Preferences.decode(null).copy(use24Hour = android.text.format.DateFormat.is24HourFormat(context))

    fun save(prefs: Preferences) {
        sp.edit().putString(KEY, prefs.encode()).apply()
    }

    /** The last place GPS found, so the app opens on it while the phone gets a fresh fix. */
    fun lastGpsPlace(): Place? =
        sp.getString(LAST_GPS_KEY, null)?.let { runCatching { CoreJson.decodeFromString(Place.serializer(), it) }.getOrNull() }

    fun saveLastGpsPlace(place: Place) {
        sp.edit().putString(LAST_GPS_KEY, CoreJson.encodeToString(Place.serializer(), place)).apply()
    }

    companion object {
        private const val KEY = "preferences.v1"
        private const val LAST_GPS_KEY = "lastGpsPlace.v1"
    }
}
