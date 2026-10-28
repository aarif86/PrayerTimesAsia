package com.prayertimesasia.app.data

import android.content.Context
import android.os.Build
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.core.Place
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
