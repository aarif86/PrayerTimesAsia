package com.prayertimesasia.core

import kotlinx.serialization.Serializable
import java.net.URLDecoder

/**
 * "Your masjid": the jamaah (iqamah) rules a masjid screen shares through its
 * QR code. Same short format as the web app (web/src/core/masjidLink.ts) and
 * the iPhone, checked against testdata/masjid-links.json:
 *
 *     prayertimesasia://masjid?n=Masjid+Al-Firdaus&ll=1.3721,103.9474&tz=Asia/Singapore&cc=SG&i=10,10,10,5,10&j=13:00
 *
 * n name · ll latitude,longitude · tz time zone · cc country (optional) ·
 * i Subuh, Zohor, Asar, Maghrib, Isyak: minutes after azan ("10"), a fixed
 * time ("13:15"), or empty · j Jumu'ah (khutbah) time (optional).
 */
@Serializable
data class MasjidLink(
    val name: String,
    val lat: Double,
    val lng: Double,
    val tz: String,
    val cc: String? = null,
    /** Prayer raw value → rule. */
    val jamaah: Map<String, Rule> = emptyMap(),
    val jumuah: String? = null,
) {
    @Serializable
    data class Rule(val after: Int? = null, val fixed: String? = null)

    val coordinates: Coordinates get() = Coordinates(lat, lng)

    /** As a mosque profile, so the existing jamaah code shows its times. */
    val profile: MosqueProfile
        get() = MosqueProfile(
            id = "my-masjid", name = name, lat = lat, lng = lng, country = cc ?: "",
            radiusKm = RADIUS_KM, fingerprint = null,
            jamaah = jamaah.mapValues { (_, r) -> MosqueProfile.JamaahRule(fixed = r.fixed, afterMinutes = r.after) },
            jumuah = jumuah, source = "Shared by the masjid screen", verifiedAt = "", grade = SourceGrade.MASJID,
        )

    companion object {
        /** A masjid that's yours covers your home area, a little wider than the 3 km of a published profile. */
        const val RADIUS_KM = 10.0

        private val HHMM = Regex("^([01]?\\d|2[0-3]):([0-5]\\d)$")
        private val ZONE = Regex("^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$")

        private fun hhmm(s: String): String? = if (HHMM.matches(s)) s.padStart(5, '0') else null

        /** Reads "masjid?..." (or a whole URL containing it). Anything odd gives null. */
        fun parse(text: String): MasjidLink? {
            val at = text.indexOf("masjid?")
            if (at < 0) return null
            val q = mutableMapOf<String, String>()
            for (pair in text.substring(at + "masjid?".length).split('&')) {
                if (pair.isEmpty()) continue
                val key = pair.substringBefore('=')
                // Form encoding: "+" is a space (a real plus arrives as %2B).
                val value = runCatching { URLDecoder.decode(pair.substringAfter('=', ""), "UTF-8") }.getOrNull() ?: continue
                q.putIfAbsent(key, value)
            }
            val name = q["n"].orEmpty().trim().take(80)
            val ll = q["ll"].orEmpty().split(',').map { it.toDoubleOrNull() }
            val tz = q["tz"].orEmpty()
            if (name.isEmpty() || ll.size != 2) return null
            val lat = ll[0] ?: return null
            val lng = ll[1] ?: return null
            if (!lat.isFinite() || !lng.isFinite() || kotlin.math.abs(lat) > 90 || kotlin.math.abs(lng) > 180 || !ZONE.matches(tz)) return null

            val parts = q["i"].orEmpty().split(',')
            val jamaah = mutableMapOf<String, Rule>()
            Prayer.obligatory.forEachIndexed { k, prayer ->
                val v = parts.getOrNull(k).orEmpty().trim()
                val minutes = if (Regex("^\\d{1,2}$").matches(v)) v.toInt() else null
                when {
                    minutes != null && minutes <= 60 -> jamaah[prayer.raw] = Rule(after = minutes)
                    hhmm(v) != null -> jamaah[prayer.raw] = Rule(fixed = hhmm(v))
                }
            }
            val cc = q["cc"]?.takeIf { Regex("^[A-Za-z]{2}$").matches(it) }?.uppercase()
            return MasjidLink(name, lat, lng, tz, cc, jamaah, hhmm(q["j"].orEmpty()))
        }
    }
}
