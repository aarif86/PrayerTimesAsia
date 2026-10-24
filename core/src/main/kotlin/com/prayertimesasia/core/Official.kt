package com.prayertimesasia.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import java.text.Normalizer

/** "yyyy-MM-dd" → prayer raw value → "HH:mm". */
typealias OfficialTable = Map<String, Map<String, String>>

/**
 * Exact official timetables when online: MUIS for Singapore, JAKIM e-Solat for
 * Malaysia and Kemenag for Indonesia. Requests carry only a year, a zone code or a
 * regency name, never coordinates. This file holds the pure parts (which source
 * applies, the parsers); the app downloads and caches.
 */
sealed class OfficialSource {
    data object Muis : OfficialSource()
    data class Jakim(val zone: String) : OfficialSource()
    /** Kemenag regency/city, by the name the geocoder gives for where you are. */
    data class Kemenag(val regency: String) : OfficialSource()

    val label: String
        get() = when (this) {
            Muis -> "MUIS official timetable"
            is Jakim -> "JAKIM e-Solat · zone $zone"
            is Kemenag -> "Kemenag · $regency"
        }

    /** Authority name for the source badge. */
    val authority: String
        get() = when (this) {
            Muis -> "MUIS"
            is Jakim -> "JAKIM"
            is Kemenag -> "Kemenag"
        }

    /** Subscribable calendar feed built by the iOS repo's feeds workflow from the same official table. */
    val calendarFeed: String?
        get() {
            val name = when (this) {
                Muis -> "sg-muis"
                is Jakim -> "my-${zone.lowercase()}"
                is Kemenag -> return null
            }
            return "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/feeds/$name.ics"
        }

    fun cacheKey(year: Int): String = when (this) {
        Muis -> "muis-$year"
        is Jakim -> "jakim-$zone-$year"
        is Kemenag -> "kemenag-${Official.kemenagCore(regency).core}-$year"
    }
}

object Official {
    /**
     * data.gov.sg publishes one MUIS dataset per year. Years after release are
     * read from config/official-sources.json in the GitHub repo.
     */
    val muisDatasets: Map<Int, String> = mapOf(2026 to "d_d441e7242e78efc566024dd5b0d9829c")
    const val REMOTE_CONFIG = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/config/official-sources.json"

    fun muisUrl(dataset: String) = "https://data.gov.sg/api/action/datastore_search?resource_id=$dataset&limit=400"
    fun jakimUrl(zone: String) = "https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=$zone"
    const val KEMENAG_CITIES_URL = "https://api.myquran.com/v2/sholat/kota/semua"
    fun kemenagUrl(id: String, year: Int, month: Int) =
        "https://api.myquran.com/v2/sholat/jadwal/$id/$year/${month.toString().padStart(2, '0')}"

    /**
     * Which official table applies, if any. Only when the method in use is that
     * authority's own - a user who pinned another method gets that method.
     */
    fun source(place: Place, method: CalculationMethod, zoneOverride: String?): OfficialSource? =
        when (place.countryCode?.uppercase() to method.id) {
            "SG" to "muis" -> OfficialSource.Muis
            "MY" to "jakim" -> OfficialSource.Jakim(zoneOverride ?: nearestJakimZone(place.coordinates))
            "ID" to "kemenag" -> {
                val name = place.district ?: place.region ?: (if (place.name == "Current location") null else place.name)
                name?.let { OfficialSource.Kemenag(it) }
            }
            else -> null
        }

    fun nearestJakimZone(c: Coordinates): String {
        var best = "WLY01" to Double.MAX_VALUE
        for ((zone, lat, lng) in JakimZones.points) {
            val d = Geo.distanceKm(c, Coordinates(lat, lng))
            if (d < best.second) best = zone to d
        }
        return best.first
    }

    private val json = Json { ignoreUnknownKeys = true }

    private fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

    /**
     * e-Solat: {"prayerTime":[{"date":"01-Jan-2026","fajr":"06:06:00","syuruk":"07:18:00",
     * "dhuhr":"13:19:00","asr":"16:42:00","maghrib":"19:17:00","isha":"20:31:00",...}],...}
     * Month abbreviations are Malay ("Mac", "Ogos", "Dis").
     */
    fun parseJakim(text: String, year: Int): OfficialTable {
        val root = json.parseToJsonElement(text).jsonObject
        val rows = (root["prayerTime"] as? JsonArray) ?: return emptyMap()
        val out = mutableMapOf<String, Map<String, String>>()
        for (el in rows) {
            val r = el as? JsonObject ?: continue
            val date = r.string("date")?.let(::jakimDate) ?: continue
            if (!date.startsWith("$year-")) continue
            val values = mapOf(Prayer.FAJR to "fajr", Prayer.SUNRISE to "syuruk", Prayer.DHUHR to "dhuhr",
                Prayer.ASR to "asr", Prayer.MAGHRIB to "maghrib", Prayer.ISHA to "isha")
            val row = values.mapNotNull { (p, k) -> r.string(k)?.let(::hhmm)?.let { p.raw to it } }.toMap()
            if (row.size == 6) out[date] = row
        }
        return out
    }

    private val malayMonths = mapOf(
        "jan" to 1, "feb" to 2, "mac" to 3, "mar" to 3, "apr" to 4, "mei" to 5, "may" to 5, "jun" to 6, "jul" to 7,
        "ogos" to 8, "ogo" to 8, "aug" to 8, "sep" to 9, "okt" to 10, "oct" to 10, "nov" to 11, "dis" to 12, "dec" to 12,
    )

    fun jakimDate(s: String): String? {
        val parts = s.split("-")
        if (parts.size != 3) return null
        val d = parts[0].toIntOrNull() ?: return null
        val y = parts[2].toIntOrNull() ?: return null
        val m = malayMonths[parts[1].lowercase()] ?: return null
        return fmt("%04d-%02d-%02d", y, m, d)
    }

    /**
     * data.gov.sg: {"result":{"records":[{"Date":"2026-01-01","Subuh":"05:44","Syuruk":"07:08",
     * "Zohor":"13:10","Asar":"16:34","Maghrib":"19:11","Isyak":"20:25"},...]}}
     */
    fun parseMuis(text: String): OfficialTable {
        val root = json.parseToJsonElement(text).jsonObject
        val records = root["result"]?.jsonObject?.get("records")?.jsonArray
            ?: throw IllegalArgumentException("Not a data.gov.sg response")
        val columns = listOf(
            Prayer.FAJR to listOf("subuh"), Prayer.SUNRISE to listOf("syuruk"), Prayer.DHUHR to listOf("zohor", "zuhur"),
            Prayer.ASR to listOf("asar"), Prayer.MAGHRIB to listOf("maghrib"), Prayer.ISHA to listOf("isyak"),
        )
        val out = mutableMapOf<String, Map<String, String>>()
        for (el in records) {
            val record = el as? JsonObject ?: continue
            val lower = mutableMapOf<String, String>()
            for ((k, v) in record) {
                val s = (v as? JsonPrimitive)?.contentOrNull ?: continue
                lower.putIfAbsent(k.lowercase(), s)
            }
            val date = lower["date"]?.take(10) ?: continue
            val row = mutableMapOf<String, String>()
            for ((prayer, names) in columns) {
                val raw = names.firstNotNullOfOrNull { lower[it] } ?: continue
                var t = hhmm(raw) ?: continue
                // Guard against a 12-hour afternoon value ("1:10" for 13:10).
                val h = t.take(2).toInt()
                if (prayer != Prayer.FAJR && prayer != Prayer.SUNRISE && h < 11) {
                    t = fmt("%02d", h + 12) + t.drop(2)
                }
                row[prayer.raw] = t
            }
            if (row.size == 6) out[date] = row
        }
        return out
    }

    /** "06:06:00" / "6:06" → "06:06" */
    fun hhmm(s: String): String? {
        val p = s.trim().split(":")
        if (p.size < 2) return null
        val h = p[0].toIntOrNull() ?: return null
        val m = p[1].toIntOrNull() ?: return null
        if (h !in 0..23 || m !in 0..59) return null
        return fmt("%02d:%02d", h, m)
    }

    /**
     * {"data":{"jadwal":[{"date":"2026-10-01","subuh":"04:23","terbit":"05:35","dzuhur":"11:46",
     * "ashar":"14:51","maghrib":"17:50","isya":"18:59",...}]}}
     */
    fun parseKemenag(text: String): OfficialTable {
        val root = json.parseToJsonElement(text).jsonObject
        val rows = root["data"]?.jsonObject?.get("jadwal")?.jsonArray
            ?: throw IllegalArgumentException("Not a Kemenag schedule")
        val out = mutableMapOf<String, Map<String, String>>()
        for (el in rows) {
            val r = el as? JsonObject ?: continue
            val date = r.string("date") ?: continue
            val values = mapOf(Prayer.FAJR to "subuh", Prayer.SUNRISE to "terbit", Prayer.DHUHR to "dzuhur",
                Prayer.ASR to "ashar", Prayer.MAGHRIB to "maghrib", Prayer.ISHA to "isya")
            val row = values.mapNotNull { (p, k) -> r.string(k)?.let(::hhmm)?.let { p.raw to it } }.toMap()
            if (row.size == 6) out[date.take(10)] = row
        }
        return out
    }

    /** The Kemenag city list: [(id, "KOTA BANDUNG")]. */
    fun parseKemenagCities(text: String): List<Pair<String, String>> {
        val root = json.parseToJsonElement(text).jsonObject
        return root["data"]?.jsonArray?.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            val id = o.string("id") ?: return@mapNotNull null
            val name = o.string("lokasi") ?: return@mapNotNull null
            id to name
        } ?: emptyList()
    }

    enum class RegencyKind { CITY, REGENCY, UNKNOWN }
    data class RegencyKey(val core: String, val kind: RegencyKind)

    /**
     * "Kota Bandung" / "Bandung City" / "KOTA BANDUNG" → ("BANDUNG", CITY);
     * "Kabupaten Bogor" / "Bogor Regency" / "KAB. BOGOR" → ("BOGOR", REGENCY).
     */
    fun kemenagCore(name: String): RegencyKey {
        val folded = Normalizer.normalize(name, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
        val upper = folded.uppercase().replace(".", " ")
        val tokens = upper.split(Regex("[^\\p{L}\\p{N}]+")).filter { it.isNotEmpty() }.toMutableList()
        var kind = RegencyKind.UNKNOWN
        if (tokens.firstOrNull() == "KOTA" || tokens.lastOrNull() == "CITY") kind = RegencyKind.CITY
        if ((tokens.firstOrNull() ?: "") in setOf("KAB", "KABUPATEN") || tokens.lastOrNull() == "REGENCY") kind = RegencyKind.REGENCY
        val filler = setOf("KOTA", "KAB", "KABUPATEN", "ADMINISTRASI", "ADM", "REGENCY", "CITY", "OF")
        tokens.removeAll { it in filler }
        return RegencyKey(tokens.joinToString(" "), kind)
    }

    /** Best Kemenag id for the given place names (most specific first). */
    fun matchKemenagCity(names: List<String>, list: List<Pair<String, String>>): String? {
        val entries = list.map { it.first to kemenagCore(it.second) }
        for (name in names) {
            val want = kemenagCore(name)
            if (want.core.isEmpty()) continue
            val exact = entries.filter { it.second.core == want.core }
            val hit = exact.firstOrNull { it.second.kind == want.kind }
                ?: exact.firstOrNull { it.second.kind == RegencyKind.CITY }
                ?: exact.firstOrNull()
            if (hit != null) return hit.first
            // "Jakarta Selatan" / "South Jakarta" → KOTA JAKARTA: whole-word containment, longest wins.
            val words = want.core.split(" ").toSet()
            val partial = entries.filter { e ->
                val w = e.second.core.split(" ").filter { it.isNotEmpty() }
                w.isNotEmpty() && words.containsAll(w)
            }
            val best = partial.maxWithOrNull(compareBy<Pair<String, RegencyKey>>({ it.second.core.length },
                { if (it.second.kind == RegencyKind.CITY) 1 else 0 }))
            if (best != null) return best.first
        }
        return null
    }
}
