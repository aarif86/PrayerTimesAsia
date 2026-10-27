package com.prayertimesasia.app

import android.content.Context
import android.location.Location
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.app.data.Directories
import com.prayertimesasia.app.data.LocationService
import com.prayertimesasia.app.data.OfficialRepository
import com.prayertimesasia.app.data.PrefsStore
import com.prayertimesasia.app.ui.theme.SkyColors
import com.prayertimesasia.app.widget.WidgetUpdater
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.MasjidLink
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.TripStop
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.util.Locale

enum class Tab { PRAYER, QIBLA, FALAK, MASJID, SETTINGS }

/** What the activity can ask the user for; the app state asks through it. */
interface Permissions {
    suspend fun notifications(): Boolean
    suspend fun location(): Boolean
    suspend fun camera(): Boolean
}

/**
 * The app's single source of truth: where you are, which rules apply there, and
 * the times (through [Resolver]). Screens read it; only it writes Preferences.
 */
class AppState(
    val context: Context,
    private val store: PrefsStore?,
    val official: OfficialRepository,
    val directories: Directories,
    initialPrefs: Preferences = store?.load() ?: Preferences(),
    /** A fixed instant (demo mode and screenshots): the clock never moves. */
    val fixedNow: Instant? = null,
    /** Alarms, widgets, downloads and GPS. Off for screenshots. */
    val sideEffects: Boolean = true,
    private val locale: Locale = Locale.getDefault(),
) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val location = LocationService(context)

    var prefs by mutableStateOf(initialPrefs)
        private set
    /** The place resolved from the latest GPS fix. */
    var gpsPlace by mutableStateOf<Place?>(null)
        private set
    var now by mutableStateOf(fixedNow ?: Instant.now())
    var selectedTab by mutableStateOf(Tab.PRAYER)
    var showJourney by mutableStateOf(false)
    /** A masjid from a screen's QR code, waiting for the user to say yes. */
    var pendingMasjid by mutableStateOf<MasjidLink?>(null)
    var locationRequested by mutableStateOf(false)
    var permissions: Permissions? = null
    /** Screenshots: pretend the phone faces the qibla. */
    var demoAligned = false

    /** The rules and times for right now. Cheap to build; read it fresh each time. */
    val resolver: Resolver
        get() = Resolver(prefs, gpsPlace, { s, y, m, d -> official.times(s, y, m, d) }, directories.mosques, locale)

    fun tick() {
        if (fixedNow == null) now = Instant.now()
    }

    /** Applies a change to the preferences, saves, and reschedules what depends on them. */
    fun update(transform: (Preferences) -> Preferences) {
        val old = prefs
        val new = transform(old)
        if (new == old) return
        prefs = new
        preferencesChanged(old)
    }

    private fun preferencesChanged(old: Preferences) {
        if (!sideEffects) return
        store?.save(prefs)
        // Ticking a prayer in the tracker shouldn't reschedule every alarm.
        val a = prefs.copy(prayedLog = emptyMap(), excusedDays = emptySet(), showMore = false)
        val b = old.copy(prayedLog = emptyMap(), excusedDays = emptySet(), showMore = false)
        if (a == b) return
        refreshOfficialTimetable()
        rescheduleAlerts()
    }

    // MARK: Sky and appearance

    /** Between Maghrib and sunrise; null until today's times are known. */
    val isNightNow: Boolean?
        get() = resolver.day(now)?.let { now < it.time(Prayer.SUNRISE) || now >= it.time(Prayer.MAGHRIB) }

    /** Light or Dark as chosen; Automatic follows the sky (null: follow the phone until the times are known). */
    val darkTheme: Boolean?
        get() = when (prefs.appearance) {
            Appearance.LIGHT -> false
            Appearance.DARK -> true
            Appearance.SYSTEM -> isNightNow
        }

    /** The sky right now, shared by every tab. */
    val skyNow: SkyColors get() = resolver.day(now)?.let { SkyColors.at(now, it) } ?: SkyColors.night

    // MARK: Places

    fun onLocation(location: Location) {
        scope.launch {
            val place = this@AppState.location.place(location)
            val previous = gpsPlace
            if (previous == null || !previous.isNear(place) || previous.name != place.name) {
                gpsPlace = place
                if (prefs.useGPS) arrived(place)
                refreshOfficialTimetable()
            }
        }
    }

    fun choose(place: Place) {
        update { p ->
            p.copy(
                manualPlace = place, useGPS = false,
                savedPlaces = if (p.savedPlaces.any { it.isNear(place) }) p.savedPlaces else listOf(place) + p.savedPlaces,
            )
        }
        arrived(place)
    }

    fun useGPS() {
        update { it.copy(useGPS = true) }
        scope.launch {
            val granted = location.hasPermission || (permissions?.location() ?: false)
            locationRequested = true
            if (granted) location.refresh { onLocation(it) }
        }
        gpsPlace?.let { arrived(it) }
    }

    fun refreshLocation() {
        if (sideEffects && prefs.useGPS && location.hasPermission) location.refresh { onLocation(it) }
    }

    fun setHome(place: Place) = update { it.copy(home = place) }

    /** prayertimesasia://masjid?... from a masjid screen's QR code (or the web app's "Open in the app"). */
    fun openLink(uri: String?) {
        if (uri == null || !uri.startsWith("prayertimesasia:")) return
        MasjidLink.parse(uri)?.let { pendingMasjid = it }
    }

    fun followPendingMasjid() {
        val link = pendingMasjid ?: return
        pendingMasjid = null
        update { it.copy(myMasjid = link) }
    }

    fun forgetMasjid() = update { it.copy(myMasjid = null) }

    /** Travel mode: notice a new country, remember when we got here, show the welcome card. */
    private fun arrived(place: Place) {
        update { prev ->
            var p = prev
            if (p.home == null && place.countryCode != null && place.name != "Current location") p = p.copy(home = place)
            val code = place.countryCode
            if (code != null && code != p.lastCountryCode) {
                val firstEver = p.lastCountryCode == null
                val stop = TripStop(countryCode = code, countryName = place.countryName ?: code, placeName = place.name,
                    arrived = System.currentTimeMillis())
                p = p.copy(lastCountryCode = code, arrivedAt = System.currentTimeMillis(),
                    arrivalBannerDismissed = firstEver, trip = (listOf(stop) + p.trip).take(30))
            }
            p
        }
    }

    // MARK: Tracker

    fun togglePrayed(prayer: Prayer, on: Instant) = update { p ->
        val key = resolver.dayKey(on)
        val set = (p.prayedLog[key] ?: emptySet()).let { if (prayer in it) it - prayer else it + prayer }
        var log = if (set.isEmpty()) p.prayedLog - key else p.prayedLog + (key to set)
        // Keep about a year of history.
        if (log.size > 400) log = log - log.keys.min()
        p.copy(prayedLog = log)
    }

    fun toggleExcused(on: Instant) = update { p ->
        val key = resolver.dayKey(on)
        p.copy(excusedDays = if (key in p.excusedDays) p.excusedDays - key else p.excusedDays + key)
    }

    // MARK: Alerts

    /** Asks for notification permission when needed, then turns alerts on for [prayers]. */
    fun enableAlerts(prayers: Set<Prayer>? = null) {
        scope.launch {
            val granted = permissions?.notifications() ?: true
            if (!granted) return@launch
            update { it.copy(notificationsEnabled = true, notifyPrayers = prayers ?: it.notifyPrayers) }
        }
    }

    fun toggleNotify(prayer: Prayer) {
        if (!prefs.notificationsEnabled) {
            enableAlerts(setOf(prayer))
            return
        }
        update { p -> p.copy(notifyPrayers = if (prayer in p.notifyPrayers) p.notifyPrayers - prayer else p.notifyPrayers + prayer) }
    }

    fun rescheduleAlerts() {
        if (!sideEffects) return
        AlarmScheduler.reschedule(context, resolver)
        scope.launch { WidgetUpdater.updateAll(context) }
    }

    // MARK: Lifecycle

    /** Downloads this year's official table for where you are (and next year's in December). */
    fun refreshOfficialTimetable() {
        if (!sideEffects) return
        val r = resolver
        val source = r.officialSource ?: return
        val today = LocalDate.now(r.zone)
        val years = if (today.monthValue == 12) listOf(today.year, today.year + 1) else listOf(today.year)
        scope.launch {
            var changed = false
            for (y in years) changed = official.ensure(source, y) || changed
            if (changed) rescheduleAlerts()
        }
    }

    fun appBecameActive() {
        tick()
        if (!sideEffects) return
        refreshLocation()
        refreshOfficialTimetable()
        scope.launch { directories.refreshIfStale() }
        rescheduleAlerts()
    }

    /** The day [offset] days from today, or today. */
    fun day(offset: Int = 0): PrayerDay? = resolver.day(now, offset)

    /** Where the user lives, for which of the makers' offers is relevant: home country, else where they are now. */
    val offerCountry: String get() = prefs.home?.countryCode ?: resolver.profile.code
}
