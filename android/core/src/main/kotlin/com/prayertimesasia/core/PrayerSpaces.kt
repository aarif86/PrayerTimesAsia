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
    /** Letters from OpenStreetMap: w women's space, a wheelchair, p parking, t toilets. */
    val facilities: String = "",
    /** OpenStreetMap opening_hours, mostly on prayer rooms in malls. */
    val hours: String? = null,
    /** From the community prayer room list: how to find it, level, MRT, mats, notes. */
    val details: RoomDetails? = null,
)

/** Extra facts about a prayer room from the community list. Only what is known; empty means unknown. */
data class RoomDetails(
    val howToFind: String = "",
    val level: String = "",
    val mrt: String = "",
    val provided: String = "",
    val toiletLevel: String = "",
    /** "women 3, men 5, shared 4" */
    val capacity: String = "",
    val notes: String = "",
) {
    val isEmpty get() = listOf(howToFind, level, mrt, provided, toiletLevel, capacity, notes).all { it.isEmpty() }

    /** "3" and "B1" read as "Level 3"; "Basement" stays as it is. */
    val levelText: String get() =
        if (Regex("^(b|l)?\\d{1,2}$", RegexOption.IGNORE_CASE).matches(level)) "Level " + level.removePrefix("l").removePrefix("L").uppercase() else level

    /** "Room for about 3 women", ... */
    val roomFor: List<String> get() = capacity.split(",").mapNotNull { part ->
        val bits = part.trim().split(" ")
        val n = bits.getOrNull(1)?.toIntOrNull() ?: return@mapNotNull null
        if (bits.size != 2) return@mapNotNull null
        "Room for about $n ${when (bits[0]) { "women" -> "women"; "men" -> "men"; else -> "people" }}"
    }

    /** Level, what is provided, who it fits and the nearest MRT, as short chips. */
    val chips: List<String> get() = buildList {
        if (level.isNotEmpty()) add(levelText)
        provided.split(",").map { it.trim() }.filter { it.isNotEmpty() }.forEach { add(it) }
        addAll(roomFor)
        if (mrt.isNotEmpty()) add("Near $mrt MRT")
    }

    /** "Also basement" and "Level 3" both end up as the bare level. */
    val toiletLevelText: String get() = toiletLevel.replace(Regex("^(also )?(level )?", RegexOption.IGNORE_CASE), "")
}

/**
 * Masjids and musollahs near a point, found with OpenStreetMap's Overpass API
 * (the Android stand-in for the iOS app's Apple Maps search). Only the search
 * area is sent, and only when the Masjid tab is open.
 */
object PrayerSpaces {
    /** Tried in order, so one busy or dead server can't leave the list empty. */
    val OVERPASS_URLS = listOf(
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    )
    private val musollahWords = listOf("musolla", "musalla", "musholla", "surau", "prayer room", "prayer space", "mushola", "musolah", "musollah")

    /**
     * Muslim places of worship within [radiusM] metres, nodes and buildings, with their centres.
     * No result cap: Overpass caps in id order, not nearest first, so a cap dropped
     * nearby surau in busy areas such as Johor Bahru next to Singapore.
     */
    fun overpassQuery(center: Coordinates, radiusM: Int = 12_000): String {
        val around = "(around:$radiusM,${fmt("%.5f", center.latitude)},${fmt("%.5f", center.longitude)})"
        return "[out:json][timeout:25];(" +
            "node[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$around;" +
            "way[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$around;" +
            "relation[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$around;" +
            ");out center;"
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
            if (name != null && isGraveOrShrine(name)) continue
            val point = Coordinates(lat, lon)
            val km = Geo.distanceKm(center, point)
            if (km > maxKm) continue
            val address = listOfNotNull(
                listOfNotNull(tags["addr:housenumber"], tags["addr:street"]).joinToString(" ").takeIf { it.isNotBlank() },
                tags["addr:city"] ?: tags["addr:suburb"],
            ).joinToString(", ")
            val display = name ?: if (musollah) "Prayer room" else "Masjid"
            val key = "${display.lowercase()}|${Math.round(lat * 2000)}|${Math.round(lon * 2000)}"
            if (found.containsKey(key)) continue
            found[key] = PrayerSpace("$type/$id", display, address, point, km, musollah, facilitiesOf(tags), tags["opening_hours"]?.takeIf { it.isNotBlank() })
        }
        return found.values.sortedBy { it.distanceKm }
    }

    private val yes = setOf("yes", "designated", "limited", "separate", "only")

    /** The same letters the weekly list builder writes (tools/build_masjid_list.py). */
    fun facilitiesOf(tags: Map<String, String>): String = buildString {
        if (listOf("female", "women", "prayer_room:female", "female_prayer_room").any { tags[it]?.lowercase() in yes }) append('w')
        if (tags["wheelchair"]?.lowercase() in yes) append('a')
        if (tags["parking"]?.lowercase().let { it != null && it != "" && it != "no" }) append('p')
        if (tags["toilets"]?.lowercase() in yes) append('t')
    }

    /**
     * Graves and shrines that OpenStreetMap tags as places of worship (Kubur Kassim,
     * Keramat Radin Mas). Not places to pray in, unless the name also says masjid or surau.
     */
    fun isGraveOrShrine(name: String): Boolean {
        val n = name.lowercase()
        if (!Regex("\\b(kubur|keramat|makam|maqam|tomb|grave|cemetery|perkuburan|dargah|shrine)\\b").containsMatchIn(n)) return false
        return !Regex("\\b(masjid|mosque|surau|musolla|musalla|musholla|mushola|prayer)\\b").containsMatchIn(n)
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
        if (isTransportOrStreet(n) || isGraveOrShrine(name)) return false
        val words = listOf("masjid", "mosque", "mesjid", "musolla", "musalla", "musholla", "mushola", "surau",
            "prayer", "jami", "islamic cent", "islamic center", "camii", "cami ", "masjed", "مسجد",
            "清真寺", "モスク", "모스크", "nhà thờ hồi giáo", "มัสยิด")
        return words.any { n.contains(it) }
    }
}
