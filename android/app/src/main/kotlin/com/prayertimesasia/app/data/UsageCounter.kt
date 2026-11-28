package com.prayertimesasia.app.data

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.core.CommunityCard
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.app.alarms.OwnAzan
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.time.LocalDate
import java.util.Locale
import java.util.UUID

/**
 * Anonymous usage counts, sent to TelemetryDeck (privacy-first: no IP addresses
 * stored, nothing linked to a person). The web and iPhone apps send the same
 * events with the same keys, so one dashboard shows all. See docs/analytics.md.
 *
 * What is sent: a random ID made on this phone, the app version, Android
 * version, language, and the city and country of the place in use (never
 * coordinates). Nothing is sent until config/analytics.json in the GitHub repo
 * has an App ID, when Settings → Privacy → Share anonymous usage counts is off,
 * or in demo mode.
 */
class UsageCounter(context: Context) {
    private val appContext = context.applicationContext
    private val sp = context.getSharedPreferences("prayertimesasia.usage", Context.MODE_PRIVATE)

    data class Config(val appId: String, val enabled: Boolean) {
        /** The App ID to send with, or null when counting is off. */
        val activeAppId: String? get() = appId.trim().takeIf { enabled && it.isNotEmpty() }

        companion object {
            fun decode(text: String): Config? = runCatching {
                val o = Json.parseToJsonElement(text).jsonObject
                Config(o["telemetryDeckAppID"]?.jsonPrimitive?.content ?: "", o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true)
            }.getOrNull()
        }
    }

    /** Counts this app open (and the first ever as an install), at most once an hour. Never throws. */
    suspend fun countOpen(place: Place?): Unit = withContext(Dispatchers.IO) {
        runCatching<Unit> {
            val now = System.currentTimeMillis()
            if (!shouldCountOpen(sp.getLong(OPENED, 0L).takeIf { it > 0 }, now)) return@runCatching
            sp.edit().putLong(OPENED, now).apply()
            val fresh = !sp.contains(ID)
            if (fresh) sp.edit().putString(ID, UUID.randomUUID().toString()).apply()
            val id = sp.getString(ID, null) ?: return@runCatching
            val appId = config()?.activeAppId ?: return@runCatching
            val body = payload(BuildConfig.VERSION_NAME, Build.VERSION.RELEASE ?: "?", Locale.getDefault().toLanguageTag(),
                place?.district ?: place?.name, place?.countryCode)
            val types = if (fresh) listOf("App.installed", "App.opened") else listOf("App.opened")
            Http.postJson(ENDPOINT, signals(appId, id, types, body, BuildConfig.DEBUG))
        }
        Unit
    }

    enum class CardEvent(val type: String) { SEEN("Card.seen"), TAPPED("Card.tapped") }

    /**
     * Counts a Barakah Picks card seen (once a day on this phone) or tapped. Only
     * the card and the usual anonymous keys are sent, never who tapped.
     * AppState.countCard checks Settings first. Never throws.
     */
    suspend fun countCard(event: CardEvent, card: CommunityCard, placement: String, place: Place?): Unit = withContext(Dispatchers.IO) {
        runCatching<Unit> {
            if (event == CardEvent.SEEN) {
                val today = LocalDate.now().toString()
                val key = SEEN_PREFIX + card.id
                if (!shouldCountSeen(sp.getString(key, null), today)) return@runCatching
                sp.edit().putString(key, today).apply()
            }
            if (!sp.contains(ID)) sp.edit().putString(ID, UUID.randomUUID().toString()).apply()
            val id = sp.getString(ID, null) ?: return@runCatching
            val appId = config()?.activeAppId ?: return@runCatching
            val body = payload(BuildConfig.VERSION_NAME, Build.VERSION.RELEASE ?: "?", Locale.getDefault().toLanguageTag(),
                place?.district ?: place?.name, place?.countryCode).toMutableMap()
            body["Card.id"] = card.id
            body["Card.kind"] = card.kind.name.lowercase()
            body["Card.placement"] = placement
            Http.postJson(ENDPOINT, signals(appId, id, listOf(event.type), body, BuildConfig.DEBUG))
        }
        Unit
    }

    // A day of use (App.daySummary): minutes on screen, opens and screens used on
    // one day, kept on the phone and sent once, as one event, on the first open of
    // a later day. The same as the web and iPhone apps (docs/analytics.md).

    private var activeSince: Long? = null

    private fun readTally(): DayTally? = sp.getString(TALLY, null)?.let { DayTally.decode(it) }
    private fun writeTally(t: DayTally) { sp.edit().putString(TALLY, t.encode()).apply() }

    /** The app came on screen: one open for today, start the clock, and send the last day's summary if due. */
    suspend fun tallyStart(place: Place?, prefs: Preferences? = null): Unit = withContext(Dispatchers.IO) {
        runCatching<Unit> {
            val (tally, finished) = roll(readTally(), LocalDate.now().toString())
            writeTally(tally.copy(opens = tally.opens + 1))
            activeSince = System.currentTimeMillis()
            if (finished == null) return@runCatching
            if (!sp.contains(ID)) sp.edit().putString(ID, UUID.randomUUID().toString()).apply()
            val id = sp.getString(ID, null) ?: return@runCatching
            val appId = config()?.activeAppId ?: return@runCatching
            val base = payload(BuildConfig.VERSION_NAME, Build.VERSION.RELEASE ?: "?", Locale.getDefault().toLanguageTag(),
                place?.district ?: place?.name, place?.countryCode)
            Http.postJson(ENDPOINT, signals(appId, id, listOf("App.daySummary"), dayPayload(base, finished, prefs?.let { settingsPayload(it, widgetCount(appContext), OwnAzan.isSet(appContext)) } ?: emptyMap()), BuildConfig.DEBUG))
        }
        Unit
    }

    /** The app left the screen: adds the time since it came on. */
    fun tallyStop() {
        val since = activeSince ?: return
        activeSince = null
        runCatching { writeTally(roll(readTally(), LocalDate.now().toString()).first.addSeconds((System.currentTimeMillis() - since) / 1000.0)) }
    }

    /** Something worth knowing was done today (Did.qiblaCompass ...). AppState.usageAction checks Settings first. */
    fun tallyAction(action: String) {
        runCatching { writeTally(roll(readTally(), LocalDate.now().toString()).first.addAction(action)) }
    }

    /** A screen (tab) was used today. */
    fun tallyScreen(screen: String) {
        runCatching { writeTally(roll(readTally(), LocalDate.now().toString()).first.addScreen(screen)) }
    }

    data class DayTally(val day: String, val seconds: Double = 0.0, val opens: Int = 0, val screens: List<String> = emptyList(), val actions: List<String> = emptyList()) {
        fun addAction(action: String) = if (action in actions) this else copy(actions = actions + action)
        fun addSeconds(s: Double) = copy(seconds = seconds + Math.round(s.coerceIn(0.0, MAX_STRETCH_S)).toDouble())
        fun addScreen(screen: String) = if (screen in screens) this else copy(screens = screens + screen)
        fun encode(): String = buildJsonObject {
            put("day", day); put("seconds", seconds); put("opens", opens)
            put("screens", JsonArray(screens.map { JsonPrimitive(it) }))
            put("actions", JsonArray(actions.map { JsonPrimitive(it) }))
        }.toString()

        companion object {
            fun decode(text: String): DayTally? = runCatching {
                val o = Json.parseToJsonElement(text).jsonObject
                DayTally(
                    o["day"]!!.jsonPrimitive.content,
                    o["seconds"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0,
                    o["opens"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
                    (o["screens"] as? JsonArray)?.map { it.jsonPrimitive.content } ?: emptyList(),
                    (o["actions"] as? JsonArray)?.map { it.jsonPrimitive.content } ?: emptyList(),
                )
            }.getOrNull()
        }
    }

    /** The switch and App ID from the repo, re-read at most twice a day. */
    private fun config(): Config? {
        val cached = sp.getString(CONFIG, null)?.let { Config.decode(it) }
        if (cached != null && System.currentTimeMillis() - sp.getLong(CONFIG_AT, 0L) < 12 * 3_600_000L) return cached
        val text = runCatching { Http.get(CONFIG_URL, 20_000) }.getOrNull() ?: return cached
        val fresh = Config.decode(text) ?: return cached
        sp.edit().putString(CONFIG, text).putLong(CONFIG_AT, System.currentTimeMillis()).apply()
        return fresh
    }

    companion object {
        const val CONFIG_URL = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/config/analytics.json"
        const val ENDPOINT = "https://nom.telemetrydeck.com/v2/"
        /** App opens closer together than this count once. */
        const val OPEN_GAP_MS = 3_600_000L
        private const val ID = "id"
        private const val OPENED = "opened"
        private const val CONFIG = "config"
        private const val CONFIG_AT = "configAt"

        fun shouldCountOpen(last: Long?, now: Long): Boolean = last == null || now - last >= OPEN_GAP_MS

        /** A card counts as seen once a day on each phone, however often it scrolls past. */
        fun shouldCountSeen(lastSeenDay: String?, today: String): Boolean = lastSeenDay != today
        private const val SEEN_PREFIX = "cardSeen."
        private const val TALLY = "day"

        /** One stretch on screen counts at most this long (a phone left open on a table). */
        const val MAX_STRETCH_S = 2 * 3_600.0
        val SCREENS = listOf("prayer", "qibla", "falak", "masjid", "settings")

        /** Today's tally, and the older one if it has anything to send. */
        fun roll(t: DayTally?, today: String): Pair<DayTally, DayTally?> = when {
            t != null && t.day == today -> t to null
            t != null && (t.seconds > 0 || t.opens > 0) -> DayTally(today) to t
            else -> DayTally(today) to null
        }

        fun minutesBand(minutes: Double): String = when {
            minutes < 1 -> "under 1"
            minutes < 5 -> "1 to 5"
            minutes < 15 -> "5 to 15"
            minutes < 30 -> "15 to 30"
            minutes < 60 -> "30 to 60"
            else -> "over 60"
        }

        /** Things done today, each sent as true or false (Did.qiblaCompass ...). The same list on the web and iPhone apps. */
        val ACTIONS = listOf("qiblaCompass", "qiblaFaced", "falakShadow", "falakLevel", "falakAR")

        /** How many widgets are on the Home Screen. */
        fun widgetCount(context: Context): Int = runCatching {
            val manager = AppWidgetManager.getInstance(context)
            listOf("com.prayertimesasia.app.widget.NextPrayerWidgetReceiver", "com.prayertimesasia.app.widget.TimetableWidgetReceiver")
                .sumOf { manager.getAppWidgetIds(ComponentName(context.packageName, it)).size }
        }.getOrDefault(0)

        /**
         * How the app is set up, as short words and yes or no (never anything typed by the person, never a place).
         * Sent once a day inside App.daySummary; the same keys as the web and iPhone apps.
         */
        fun settingsPayload(p: Preferences, widgets: Int, ownAzan: Boolean): Map<String, String> {
            val alerts = if (p.notificationsEnabled) p.notifyPrayers.size else 0
            val alarms = listOf(p.wakeUp, p.sahurAlarm, p.dhuhrAlarm, p.asrAlarm, p.maghribAlarm, p.ishaAlarm).count { it != null }
            return mapOf(
                "Pref.look" to when (p.todayStyle) { TodayStyle.SUN_PATH -> "sunPath"; TodayStyle.LIST, TodayStyle.DIAL -> "centre"; else -> p.todayStyle.name.lowercase() },
                "Pref.theme" to p.appearance.name.lowercase(),
                "Pref.language" to "auto",
                "Pref.alertPrayers" to alerts.toString(),
                "Pref.alertsOn" to (alerts > 0).toString(),
                "Pref.azanSound" to p.azanSound.toString(),
                "Pref.azanVoice" to p.azanVoice,
                "Pref.azanLength" to if (p.azanFull) "full" else "short",
                "Pref.ownAzan" to ownAzan.toString(),
                "Pref.alarms" to alarms.toString(),
                "Pref.largeText" to p.largeText.toString(),
                "Pref.tracker" to p.trackerEnabled.toString(),
                "Pref.myMasjid" to (p.myMasjid != null).toString(),
                "Pref.widgets" to widgets.toString(),
            )
        }

        fun dayPayload(base: Map<String, String>, t: DayTally, settings: Map<String, String> = emptyMap()): Map<String, String> {
            val out = base.toMutableMap()
            out["Day.date"] = t.day
            out["Day.minutes"] = Math.round(t.seconds / 60).toString()
            out["Day.minutesBand"] = minutesBand(t.seconds / 60)
            out["Day.opens"] = t.opens.toString()
            out["Day.screens"] = t.screens.sorted().joinToString(",")
            for (s in SCREENS) out["Used.$s"] = (s in t.screens).toString()
            for (a in ACTIONS) out["Did.$a"] = (a in t.actions).toString()
            out.putAll(settings)
            return out
        }

        /** A place name fit to count: not the "Current location" placeholder, and short. */
        fun cleanCity(name: String?): String? = name?.trim()?.takeIf { it.isNotEmpty() && it != "Current location" }?.take(60)

        /** The keys every event carries; the same names as the web and iPhone apps. */
        fun payload(version: String, system: String, language: String, city: String?, countryCode: String?): Map<String, String> {
            val out = linkedMapOf(
                "App.platform" to "android",
                "App.version" to version,
                "App.language" to language.take(2).lowercase(),
                "TelemetryDeck.AppInfo.version" to version,
                "TelemetryDeck.Device.platform" to "Android",
                "TelemetryDeck.Device.operatingSystem" to "Android",
                "TelemetryDeck.Device.systemVersion" to system,
                "TelemetryDeck.RunContext.locale" to language,
            )
            val cc = countryCode?.uppercase()
            if (cc != null && cc.length == 2 && cc.all { it in 'A'..'Z' }) {
                out["Place.country"] = cc
                out["TelemetryDeck.UserPreference.region"] = cc
            }
            cleanCity(city)?.let { out["Place.city"] = it }
            return out
        }

        fun signals(appId: String, clientUser: String, types: List<String>, payload: Map<String, String>, testMode: Boolean): String =
            JsonArray(types.map { type ->
                buildJsonObject {
                    put("appID", appId)
                    put("clientUser", clientUser)
                    put("type", type)
                    put("isTestMode", testMode)
                    put("payload", buildJsonObject { payload.forEach { (k, v) -> put(k, JsonPrimitive(v)) } })
                }
            }).toString()
    }
}
