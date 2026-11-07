package com.prayertimesasia.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max

/**
 * Ready-made masjid and surau lists for Singapore, Malaysia and Brunei, built
 * every week from OpenStreetMap (tools/build_masjid_list.py) and downloaded
 * once a week, so the Masjid tab fills at once without the busy Overpass servers.
 */
object MasjidLists {
    const val BASE_URL = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/masjids/"
    const val MAX_AGE_MS = 7L * 24 * 3600 * 1000

    private data class Box(val minLat: Double, val maxLat: Double, val minLon: Double, val maxLon: Double)

    // A little wider than each country, so a place near a border gets both lists.
    private val boxes = mapOf(
        "SG" to Box(1.13, 1.50, 103.55, 104.15),
        "MY" to Box(0.80, 7.50, 99.50, 119.40),
        "BN" to Box(4.00, 5.10, 113.95, 115.40),
    )

    /** The lists that cover this point (empty outside SG, MY and BN). */
    fun countries(c: Coordinates): List<String> = boxes.filter { (_, b) ->
        c.latitude in (b.minLat - 0.15)..(b.maxLat + 0.15) && c.longitude in (b.minLon - 0.15)..(b.maxLon + 0.15)
    }.keys.sorted()

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
    fun near(places: List<PrayerSpace>, here: Coordinates, km: Double = 15.0): List<PrayerSpace> {
        val dLat = km / 111.0
        val dLon = km / (111.0 * max(0.2, cos(Math.toRadians(here.latitude))))
        return places.asSequence()
            .filter { abs(it.coordinates.latitude - here.latitude) <= dLat && abs(it.coordinates.longitude - here.longitude) <= dLon }
            .map { it.copy(distanceKm = Geo.distanceKm(here, it.coordinates)) }
            .filter { it.distanceKm <= km }
            .sortedBy { it.distanceKm }
            .toList()
    }
}
