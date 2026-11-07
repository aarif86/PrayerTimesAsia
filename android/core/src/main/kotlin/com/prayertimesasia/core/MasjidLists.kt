package com.prayertimesasia.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max

/**
 * Ready-made masjid and surau lists for every country the app supports, built
 * every week from OpenStreetMap (tools/build_masjid_list.py) and cut into
 * one-degree squares (about 110 km). The phone downloads only the few squares
 * around it, once a week, so the Masjid tab fills at once without the busy
 * Overpass servers.
 */
object MasjidLists {
    const val BASE_URL = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/masjids/"
    const val MAX_AGE_MS = 7L * 24 * 3600 * 1000

    data class Index(val tiles: Set<String>, val countries: Set<String>)

    /** The squares a circle of [km] around here touches (one to four). */
    fun tiles(c: Coordinates, km: Double = 15.0): List<String> {
        val dLat = km / 111.0
        val dLon = km / (111.0 * max(0.2, cos(Math.toRadians(c.latitude))))
        val keys = mutableListOf<String>()
        for (lat in listOf(c.latitude - dLat, c.latitude + dLat)) {
            for (lon in listOf(c.longitude - dLon, c.longitude + dLon)) {
                val wrapped = when {
                    lon >= 180 -> lon - 360
                    lon < -180 -> lon + 360
                    else -> lon
                }
                val key = "${floor(lat).toInt()}_${floor(wrapped).toInt()}"
                if (key !in keys) keys += key
            }
        }
        return keys
    }

    /** `{"tiles": ["3_101", ...], "countries": {"MY": {...}}}`; null when unreadable. */
    fun parseIndex(text: String): Index? = runCatching {
        val root = Json.parseToJsonElement(text).jsonObject
        Index(
            tiles = root["tiles"]!!.jsonArray.map { it.jsonPrimitive.content }.toSet(),
            countries = root["countries"]!!.jsonObject.keys,
        )
    }.getOrNull()

    /** `{"places": [[id, lat, lon, name, address, musollah 0/1], ...]}`; null when unreadable. */
    fun parse(text: String): List<PrayerSpace>? = runCatching {
        Json.parseToJsonElement(text).jsonObject["places"]!!.jsonArray.mapNotNull { row ->
            val r = row as? JsonArray ?: return@mapNotNull null
            if (r.size < 6) return@mapNotNull null
            val lat = (r[1] as? JsonPrimitive)?.doubleOrNull ?: return@mapNotNull null
            val lon = (r[2] as? JsonPrimitive)?.doubleOrNull ?: return@mapNotNull null
            val musollah = (r[5] as? JsonPrimitive)?.intOrNull == 1
            val name = (r[3] as? JsonPrimitive)?.contentOrNull.orEmpty()
            PrayerSpace(
                id = "osm/" + ((r[0] as? JsonPrimitive)?.contentOrNull ?: "$lat,$lon"),
                name = name.ifEmpty { if (musollah) "Musollah" else "Masjid" },
                address = (r[4] as? JsonPrimitive)?.contentOrNull.orEmpty(),
                coordinates = Coordinates(lat, lon),
                distanceKm = 0.0,
                isMusollah = musollah,
            )
        }
    }.getOrNull()

    /** Places within [km] of [here], nearest first. */
    fun near(places: List<PrayerSpace>, here: Coordinates, km: Double = 15.0): List<PrayerSpace> =
        places.asSequence()
            .map { it.copy(distanceKm = Geo.distanceKm(here, it.coordinates)) }
            .filter { it.distanceKm <= km }
            .sortedBy { it.distanceKm }
            .toList()
}
