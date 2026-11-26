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
import com.prayertimesasia.app.data.UsageCounter
import com.prayertimesasia.app.ui.theme.SkyColors
import com.prayertimesasia.app.widget.WidgetUpdater
import com.prayertimesasia.core.withNotifyAllFive
import com.prayertimesasia.core.withAllFive
import com.prayertimesasia.core.CommunityCard
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.MasjidLink
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.nextAlertMode
import com.prayertimesasia.core.withAlertMode
import com.prayertimesasia.core.withFridayMode
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.TripStop
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
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
    /**
     * The place resolved from the latest GPS fix. Starts on the last one saved, so the
     * times show at once instead of "Finding where you are" while the phone gets a fresh fix.
     */
    var gpsPlace by mutableStateOf<Place?>(if (sideEffects) store?.lastGpsPlace() else null)
        private set
    /** A fresh fix has arrived since the app started (until then the place is the last saved one). */
    var hasFreshFix by mutableStateOf(false)
        private set

    /** Showing the last known place while the phone checks where it is now. */
    val isCheckingLocation: Boolean
        get() = prefs.useGPS && location.hasPermission && !hasFreshFix && gpsPlace != null
    var now by mutableStateOf(fixedNow ?: Instant.now())
    private var tab by mutableStateOf(Tab.PRAYER)
    var selectedTab: Tab
        get() = tab
        set(value) { tab = value; usageScreen(value) }
    var showJourney by mutableStateOf(false)
    var showTracker by mutableStateOf(false)
    var showRamadan by mutableStateOf(false)
    /** Alerts and alarms (the alarm clock on the Prayer screen, Settings, or holding a bell). */
    var showWakeUp by mutableStateOf(false)
    /** The page Alerts and alarms opens on: "check", "friday", a prayer's raw name, or null for the list. */
    var alertsPage by mutableStateOf<String?>(null)

    /** Alerts and alarms, opened on one page (or the main list when null). */
    fun openAlerts(page: String? = null) {
        alertsPage = page
        showWakeUp = true
    }
    /** A day picked in the month calendar, to show on the Prayer screen (days from today). */
    var showDayRequest by mutableStateOf<Int?>(null)
    /** A masjid from a screen's QR code, waiting for the user to say yes. */
    var pendingMasjid by mutableStateOf<MasjidLink?>(null)
    var locationRequested by mutableStateOf(false)
    var permissions: Permissions? = null
    /** Screenshots: pretend the phone faces the qibla. */
    var demoAligned = false
    /** Screenshots: pretend the phone points this many degrees from north (the web's ?heading=). */
    var demoHeading: Double? = null
    /** Screenshots: a Ramadan preview without the testers' PREVIEW tag (store pictures). */
    var demoMode = false
    /** Screenshots: show the Google Play review button before the app is live. */
    var demoShowsStores = false

    /** The rules and times for right now. Cheap to build; read it fresh each time. */
    val resolver: Resolver get() = resolverFor(prefs, gpsPlace)

    private fun resolverFor(prefs: Preferences, gps: Place?) =
        Resolver(prefs, gps, { s, y, m, d -> official.times(s, y, m, d) }, directories.mosques, locale,
            announcements = directories.calendar.announcements, monthStarts = directories.calendar.monthStarts)

    /**
     * For the home screen widgets. The launcher can ask a widget to redraw (on a resize, say) when the
     * app's process has just been started, before GPS has answered, so the live place is empty even
     * though the phone knows where you are. Fall back to the last GPS place, then home, then any
     * saved place, so a widget only ever asks for a location when there truly is none.
     */
    fun widgetResolver(): Resolver {
        val live = resolver
        if (live.activePlace != null) return live
        val fallback = store?.lastGpsPlace() ?: prefs.home ?: prefs.savedPlaces.firstOrNull() ?: return live
        return resolverFor(prefs.copy(useGPS = false, manualPlace = fallback), null)
    }

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
        // Picked a city by hand: no location question is waiting, so ask about alerts right away. GPS users are asked when the app comes back from that question.
        if (!old.hasOnboarded && new.hasOnboarded && !new.useGPS) askNotificationsOnce()
    }

    private fun preferencesChanged(old: Preferences) {
        if (!sideEffects) return
        store?.save(prefs)
        // Ticking a prayer in the tracker shouldn't reschedule every alarm.
        val a = prefs.copy(prayedLog = emptyMap(), excusedDays = emptySet(), trackerPausedSince = null, showMore = false,
            fastLog = emptyMap(), tarawihLog = emptySet(), tarawihRakaat = null, quranLog = emptySet(), zakatPaid = emptySet())
        val b = old.copy(prayedLog = emptyMap(), excusedDays = emptySet(), trackerPausedSince = null, showMore = false,
            fastLog = emptyMap(), tarawihLog = emptySet(), tarawihRakaat = null, quranLog = emptySet(), zakatPaid = emptySet())
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
        hasFreshFix = true
        // Show times at once with an offline guess (the phone's time zone gives the
        // country) when we've moved, then refine with the geocoder's town name.
        val guess = this.location.offlinePlace(location)
        val before = gpsPlace
        if (before == null || !before.isNear(guess)) adoptGps(guess)
        scope.launch {
            val place = this@AppState.location.place(location)
            val previous = gpsPlace
            if (previous == null || !previous.isNear(place) || previous.name != place.name) adoptGps(place)
        }
    }

    private fun adoptGps(place: Place) {
        gpsPlace = place
        if (sideEffects) store?.saveLastGpsPlace(place)
        if (prefs.useGPS) arrived(place)
        refreshOfficialTimetable()
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

    /** Home, picked by the user. Also counts as saying "this is home". */
    fun setHome(place: Place) = update { it.copy(home = place, homeConfirmed = true) }

    /** "Yes, this is home" for the home the app guessed. */
    fun confirmHome() = update { it.copy(homeConfirmed = true) }

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

    /** Picked on the Masjid tab: pinned at the top. Keeps iqamah times a QR code already gave the same masjid. */
    fun chooseMasjid(name: String, c: Coordinates) {
        val old = prefs.myMasjid
        if (old != null && kotlin.math.abs(old.lat - c.latitude) < 0.003 && kotlin.math.abs(old.lng - c.longitude) < 0.003) return
        val place = resolver.activePlace
        update {
            it.copy(myMasjid = MasjidLink(name.take(80), Math.round(c.latitude * 10_000) / 10_000.0, Math.round(c.longitude * 10_000) / 10_000.0,
                place?.timeZoneId ?: java.time.ZoneId.systemDefault().id, place?.countryCode))
        }
    }

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
                p = p.copy(lastCountryCode = code, arrivedAt = System.currentTimeMillis(), musafirChipDismissed = false,
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

    /** Pause for haid, nifas or illness: today and every day until it's ended count as excused, so the streak waits.
     *  In Ramadan the paused days read as "Period" in the fast record too. */
    fun pauseTracker(on: Instant) = update { it.copy(trackerPausedSince = resolver.dayKey(on)) }

    /** End the pause: the paused days are kept as excused days, today included, and as "Period" fasts in Ramadan. */
    fun endTrackerPause(on: Instant) = update { p ->
        if (p.trackerPausedSince == null) return@update p
        p.withWomensDays(womensDays(p).endPause(resolver.dayKey(on), resolver::isRamadanKey))
    }

    /** "Just today": in Ramadan it marks that fast "Period" too, and again undoes both. */
    fun toggleExcused(on: Instant) = update { p ->
        p.withWomensDays(womensDays(p).toggleExcused(resolver.dayKey(on), resolver::isRamadanKey))
    }

    // MARK: Ramadan

    /** Marks how a day's fast went; null clears it. "Period" pauses the tracker too, and changing it back undoes both. Keeps about two years. */
    fun setFast(key: String, mark: com.prayertimesasia.core.FastMark?) = update { p ->
        val w = womensDays(p).setFast(key, mark, resolver.dayKey(Instant.now()), resolver::isRamadanKey)
        var log = w.fastLog
        if (log.size > 800) log = log - log.keys.min()
        p.withWomensDays(w.copy(fastLog = log))
    }

    private fun womensDays(p: Preferences) = com.prayertimesasia.core.WomensDays(p.fastLog, p.excusedDays, p.trackerPausedSince)
    private fun Preferences.withWomensDays(w: com.prayertimesasia.core.WomensDays) =
        copy(fastLog = w.fastLog, excusedDays = w.excusedDays, trackerPausedSince = w.trackerPausedSince)

    fun setTarawihRakaat(n: Int) = update { it.copy(tarawihRakaat = n.takeIf { v -> v in com.prayertimesasia.core.Tarawih.CHOICES }) }
    /** The counter reached the total: tick tonight's Tarawih (never unticks). */
    fun markTarawih(key: String) = update { p -> if (key in p.tarawihLog) p else p.copy(tarawihLog = p.tarawihLog + key) }
    fun toggleTarawih(key: String) = update { p -> p.copy(tarawihLog = if (key in p.tarawihLog) p.tarawihLog - key else p.tarawihLog + key) }
    fun toggleJuz(key: String) = update { p -> p.copy(quranLog = if (key in p.quranLog) p.quranLog - key else p.quranLog + key) }

    /** A Ramadan alert switch: asks for notification permission when turned on. */
    fun setRamadanAlert(on: Boolean, apply: (Preferences, Boolean) -> Preferences) {
        if (!on) { update { apply(it, false) }; return }
        scope.launch {
            val granted = permissions?.notifications() ?: true
            update { apply(it, granted) }
        }
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

    /** "Notify me for all 5 prayers": every prayer that is Off goes to Notify; one on Alarm stays on Alarm. */
    fun notifyAllFive() {
        update { it.withNotifyAllFive() }
        scope.launch { permissions?.notifications() }
    }

    /**
     * New installs have alerts on, so ask the phone once, after the welcome screen, if it may show them.
     * The answer is the phone's; the choice stays and "Check my phone" explains how to change it.
     */
    private fun askNotificationsOnce() {
        if (!sideEffects || !prefs.hasOnboarded || !prefs.notificationsEnabled) return
        val install = context.getSharedPreferences("install", Context.MODE_PRIVATE)
        if (install.getBoolean("notificationsAsked", false)) return
        install.edit().putBoolean("notificationsAsked", true).apply()
        scope.launch { if (permissions?.notifications() == true) rescheduleAlerts() }
    }

    /** "Reminder before prayer": asks for notification permission, then rings [minutes] before each chosen prayer. */
    fun enableReminder(minutes: Int = AlarmScheduler.DEFAULT_REMINDER_MINUTES) {
        scope.launch {
            val granted = permissions?.notifications() ?: true
            if (!granted) return@launch
            update { it.copy(reminderMinutesBefore = minutes) }
        }
    }

    /** "Remind me when I am out": asks for notification permission first, then turns it on or off. */
    fun setAwayReminder(on: Boolean) {
        scope.launch {
            if (on && permissions?.notifications() == false) return@launch
            update { it.copy(awayReminder = on) }
        }
    }

    fun setAwayMinutes(prayer: com.prayertimesasia.core.Prayer, minutes: Int) =
        update { it.copy(awayMinutes = it.awayMinutes + (prayer.raw to minutes)) }

    /** The Subuh alarm: asks for notification permission first (the alarm rings as one). */
    fun setWakeUp(timing: com.prayertimesasia.core.WakeUpTiming) {
        scope.launch {
            permissions?.notifications()
            update { it.copy(wakeUp = timing) }
        }
    }

    /** The earlier sahur alarm, as [setWakeUp]. */
    fun setSahurAlarm(timing: com.prayertimesasia.core.SahurTiming) {
        scope.launch {
            permissions?.notifications()
            update { it.copy(sahurAlarm = timing) }
        }
    }

    /** An alarm for one of the other four prayers, as [setWakeUp]; null turns it off. */
    fun setPrayerAlarm(prayer: com.prayertimesasia.core.Prayer, timing: com.prayertimesasia.core.PrayerAlarmTiming?) {
        scope.launch {
            if (timing != null) permissions?.notifications() else stopRinging()
            update { it.withAlarm(prayer, timing) }
        }
    }

    /** Subuh alarm Off; anything ringing or snoozed stops too. */
    fun turnOffWakeUp() {
        stopRinging()
        update { it.copy(wakeUp = null) }
    }

    /** Sahur alarm Off; anything ringing or snoozed stops too. */
    fun turnOffSahurAlarm() {
        stopRinging()
        update { it.copy(sahurAlarm = null) }
    }

    /** Every alarm Off in one tap, and anything ringing or snoozed stops now. */
    fun turnOffAllAlarms() {
        stopRinging()
        update { p ->
            com.prayertimesasia.core.PrayerAlarmTiming.prayers.fold(p.copy(wakeUp = null, sahurAlarm = null, jumuahLeaveAlarm = false)) { acc, prayer -> acc.withAlarm(prayer, null) }
        }
    }

    /** Stops what is ringing or snoozed (the planned alarms stay). */
    fun stopRinging() {
        if (sideEffects) AlarmScheduler.stopRinging(context)
        snoozeTick++
    }

    /** Bumped when a snooze is stopped, so the alarm sheet looks again. */
    var snoozeTick by mutableStateOf(0)

    /** "Ring as an alarm" for the leave reminder, like the other alarms. Off also stops it if it is ringing. */
    fun setJumuahLeaveAlarm(on: Boolean) {
        scope.launch {
            if (on) permissions?.notifications() else stopRinging()
            update { it.copy(jumuahLeaveAlarm = on) }
        }
    }

    /** "Leave for Jumaat": asks for notification permission, then reminds [minutes] before Jumaat on Fridays. */
    fun enableJumuahReminder(minutes: Int) {
        scope.launch {
            val granted = permissions?.notifications() ?: true
            if (!granted) return@launch
            update { it.copy(jumuahReminderMinutes = minutes) }
        }
    }

    /** Off, Notify or Alarm for one prayer (Alerts and alarms). Asks for permission when something turns on. */
    fun setAlertMode(prayer: Prayer, mode: com.prayertimesasia.core.AlertMode) {
        if (mode == com.prayertimesasia.core.AlertMode.OFF) {
            stopRinging()
            update { it.withAlertMode(mode, prayer) }
            return
        }
        scope.launch {
            permissions?.notifications()
            update { it.withAlertMode(mode, prayer) }
        }
    }

    /**
     * "Send a test alert": a sample alert about 3 seconds later, the way a real one arrives, with the
     * azan when that sound is on. False when the phone will not show alerts (the page says so).
     */
    suspend fun sendTestAlert(title: String, body: String): Boolean {
        if (permissions?.notifications() == false) return false
        if (!com.prayertimesasia.app.alarms.Notifications.canPost(context)) return false
        scope.launch {
            delay(3000)
            val quiet = prefs.buzzOnly
            val sound = if (prefs.azanSound && !quiet && com.prayertimesasia.app.alarms.Azan.isAvailable(context)) AlarmScheduler.Sound.AZAN else AlarmScheduler.Sound.STANDARD
            com.prayertimesasia.app.alarms.Notifications.post(context, "test", title, body, AlarmScheduler.Kind.PRAYER, sound, silent = quiet)
        }
        return true
    }

    /** "Set for all prayers": one level for the five prayers, and an optional early reminder. Asks for permission when something turns on. */
    fun setAllFive(level: com.prayertimesasia.core.AllLevel, early: Int?, includeFajr: Boolean) {
        if (level == com.prayertimesasia.core.AllLevel.OFF) {
            stopRinging()
            update { it.withAllFive(level, early, includeFajr) }
            return
        }
        scope.launch {
            permissions?.notifications()
            update { it.withAllFive(level, early, includeFajr) }
        }
    }

    /** The bell on the Prayer screen: Off, then Notify, then Alarm. */
    fun cycleAlert(prayer: Prayer) = setAlertMode(prayer, prefs.nextAlertMode(prayer))

    /** Off, Notify or Alarm for Leave for Jumaat. */
    fun setFridayMode(mode: com.prayertimesasia.core.AlertMode) {
        if (mode == com.prayertimesasia.core.AlertMode.OFF) {
            stopRinging()
            update { it.withFridayMode(mode) }
            return
        }
        scope.launch {
            permissions?.notifications()
            update { it.withFridayMode(mode) }
        }
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
        val h = resolver.hijriOf(now)
        scope.launch {
            directories.refreshIfStale(soon = (h.month == 8 || h.month == 9) && h.day >= 28)
            rescheduleAlerts()
        }
        rescheduleAlerts()
        askNotificationsOnce()
        countOpen()
        countOpenDay()
    }

    /** Counts separate days the app was opened, on this phone only (for the review line and star box). */
    private fun countOpenDay() {
        if (!prefs.hasOnboarded) return
        val d = java.time.LocalDate.now()
        val key = "${d.year}-${d.monthValue}-${d.dayOfMonth}"
        if (prefs.lastOpenDay == key) return
        update { it.copy(lastOpenDay = key, openDayCount = it.openDayCount + 1) }
    }

    private val usage by lazy { UsageCounter(context) }

    /** Anonymous count of this open, a few seconds in so the GPS place has usually arrived. */
    private fun countOpen() {
        if (!prefs.shareUsage || !prefs.hasOnboarded) return
        scope.launch {
            delay(8_000)
            if (prefs.shareUsage) usage.countOpen(resolver.activePlace)
        }
    }

    private val usageOn: Boolean get() = prefs.shareUsage && prefs.hasOnboarded && sideEffects && fixedNow == null

    /** Minutes on screen, opens and screens used today, sent as one summary the next day. */
    fun usageVisible(visible: Boolean) {
        if (!visible) { if (sideEffects) usage.tallyStop(); return }
        if (!usageOn) return
        scope.launch { usage.tallyStart(resolver.activePlace) }
        usageScreen(selectedTab)
    }

    private fun usageScreen(tab: Tab) {
        if (usageOn) usage.tallyScreen(tab.name.lowercase())
    }

    /** Anonymous count of a Barakah Picks card seen (once a day) or tapped (docs/community-cards.md). */
    fun countCard(event: UsageCounter.CardEvent, card: CommunityCard, placement: String) {
        if (!prefs.shareUsage || !sideEffects || fixedNow != null) return
        scope.launch { usage.countCard(event, card, placement, resolver.activePlace) }
    }

    /** The day [offset] days from today, or today. */
    fun day(offset: Int = 0): PrayerDay? = resolver.day(now, offset)

    /** Where the user lives, for which of the makers' offers is relevant: home country, else where they are now. */
    val offerCountry: String get() = prefs.home?.countryCode ?: resolver.profile.code
}
