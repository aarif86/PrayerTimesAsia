package com.prayertimesasia.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull

/** A masjid or musollah (surau, prayer room) near you, from OpenStreetMap. */
data class PrayerSpace(
    val id: String,
    val name: String,
    val address: String,
    val coordinates: Coordinates,
    val distanceKm: Double,
    val isMusollah: Boolean,
)

/**
 * Masjids and musollahs near a point, found with OpenStreetMap's Overpass API
 * (the Android stand-in for the iOS app's Apple Maps search). Only the search
 * area is sent, and only when the Masjid tab is open.
 */
object PrayerSpaces {
    const val OVERPASS_URL = "https://overpass-api.de/api/interpreter"
    private val musollahWords = listOf("musolla", "musalla", "musholla", "surau", "prayer room", "prayer space", "mushola", "musolah", "musollah")

    /** Muslim places of worship within [radiusM] metres, nodes and buildings, with their centres. */
    fun overpassQuery(center: Coordinates, radiusM: Int = 10_000): String {
        val around = "(around:$radiusM,${fmt("%.5f", center.latitude)},${fmt("%.5f", center.longitude)})"
        return "[out:json][timeout:25];(" +
            "node[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$around;" +
            "way[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$around;" +
            "relation[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$around;" +
            ");out center 150;"
    }

    fun parseOverpass(text: String, center: Coordinates, maxKm: Double = 15.0): List<PrayerSpace> {
        val root = CoreJson.parseToJsonElement(text).jsonObject
        val elements = root["elements"]?.jsonArray ?: return emptyList()
        val found = LinkedHashMap<String, PrayerSpace>()
        for (el in elements) {
            val o = el as? JsonObject ?: continue
            val type = (o["type"] as? JsonPrimitive)?.contentOrNull ?: "node"
            val id = (o["id"] as? JsonPrimitive)?.longOrNull ?: continue
            val c = o["center"] as? JsonObject
            val lat = ((o["lat"] ?: c?.get("lat")) as? JsonPrimitive)?.doubleOrNull ?: continue
            val lon = ((o["lon"] ?: c?.get("lon")) as? JsonPrimitive)?.doubleOrNull ?: continue
            val tags = (o["tags"] as? JsonObject)?.mapValues { (it.value as? JsonPrimitive)?.contentOrNull ?: "" } ?: emptyMap()
            val name = tags["name:en"]?.takeIf { it.isNotBlank() } ?: tags["name"]?.takeIf { it.isNotBlank() }
            val lower = (name ?: "").lowercase()
            val musollah = musollahWords.any { lower.contains(it) } ||
                tags["place_of_worship"] in setOf("musalla", "prayer_room", "musholla") ||
                tags["building"] == "no" && name == null
            if (name != null && !looksLikePrayerSpace(name) && !lower.contains("al-") && !lower.contains("darul")) {
                // OSM is already filtered to Muslim places of worship; only drop the obvious lookalikes.
                if (isTransportOrStreet(lower)) continue
            }
            val point = Coordinates(lat, lon)
            val km = Geo.distanceKm(center, point)
            if (km > maxKm) continue
            val address = listOfNotNull(
                listOfNotNull(tags["addr:housenumber"], tags["addr:street"]).joinToString(" ").takeIf { it.isNotBlank() },
                tags["addr:city"] ?: tags["addr:suburb"],
            ).joinToString(", ")
            val display = name ?: if (musollah) "Musollah" else "Masjid"
            val key = "${display.lowercase()}|${Math.round(lat * 2000)}|${Math.round(lon * 2000)}"
            if (found.containsKey(key)) continue
            found[key] = PrayerSpace("$type/$id", display, address, point, km, musollah)
        }
        return found.values.sortedBy { it.distanceKm }
    }

    private fun isTransportOrStreet(n: String): Boolean {
        val transport = listOf(" stop", "bus ", "station", "mrt", "lrt", "car park", "carpark", " exit", "halte")
        if (transport.any { n.contains(it) }) return true
        val streetWords = setOf("street", "st", "road", "rd", "jalan", "jln", "lorong", "avenue", "ave")
        val tokens = n.split(Regex("[^\\p{L}]+")).filter { it.isNotEmpty() }
        val first = tokens.firstOrNull() ?: return false
        val last = tokens.last()
        return first in streetWords || last in streetWords
    }

    /**
     * A search for "mosque" also returns shops and streets named after one; keep
     * results whose name says what they are (the iOS NearbySearch filter).
     */
    fun looksLikePrayerSpace(name: String): Boolean {
        val n = name.lowercase()
        if (isTransportOrStreet(n)) return false
        val words = listOf("masjid", "mosque", "mesjid", "musolla", "musalla", "musholla", "mushola", "surau",
            "prayer", "jami", "islamic cent", "islamic center", "camii", "cami ", "masjed", "مسجد",
            "清真寺", "モスク", "모스크", "nhà thờ hồi giáo", "มัสยิด")
        return words.any { n.contains(it) }
    }
}
