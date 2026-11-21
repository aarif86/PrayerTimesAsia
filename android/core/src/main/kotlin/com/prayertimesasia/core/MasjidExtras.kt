package com.prayertimesasia.core

import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/** A Singapore masjid with a second Friday prayer (MUIS list, data/friday-sg.json). */
data class FridayMosque(val name: String, val district: String, val lat: Double, val lng: Double, val womenSession2: Boolean) {
    val coordinates get() = Coordinates(lat, lng)
}

data class EidSession(val time: String, val khutbah: String?, val women: Boolean)
data class EidMosque(val name: String, val lat: Double?, val lng: Double?, val sessions: List<EidSession>, val note: String?)
data class EidEvent(val name: String, val date: String, val sourceUrl: String, val mosques: List<EidMosque>) {
    /** "Hari Raya Aidilfitri", without the Hijri year. */
    val shortName get() = name.replace(Regex(" \\d+H$"), "")
}

enum class TripMode { WALK, DRIVE }

/**
 * What the Masjid tab adds around the place list: Singapore's second Friday
 * prayers and Hari Raya sessions (both from MUIS), trip times, report links.
 * Kept in step with web/src/core/friday.ts, eid.ts and the Masjid tab.
 */
object MasjidExtras {
    val friday: List<FridayMosque> get() = MasjidExtrasData.friday
    val eidEvents: List<EidEvent> get() = MasjidExtrasData.eid
    const val FRIDAY_SOURCE_URL = MasjidExtrasData.FRIDAY_SOURCE_URL
    const val FRIDAY_SOURCE_UPDATED = MasjidExtrasData.FRIDAY_SOURCE_UPDATED
    const val FRIDAY_SECOND_FROM = MasjidExtrasData.FRIDAY_SECOND_FROM

    /** How many places the list shows; the rest are on the map. */
    const val SHOW = 5

    fun inSingapore(c: Coordinates, countryCode: String?): Boolean =
        if (countryCode != null) countryCode.equals("SG", ignoreCase = true)
        else c.latitude > 1.15 && c.latitude < 1.48 && c.longitude > 103.59 && c.longitude < 104.1

    /** The listed two-session masjid at this spot (within 300 m). */
    fun fridayAt(c: Coordinates): FridayMosque? =
        friday.map { it to Geo.distanceKm(c, it.coordinates) }.filter { it.second <= 0.3 }.minByOrNull { it.second }?.first

    fun fridayNearest(c: Coordinates): List<Pair<FridayMosque, Double>> =
        friday.map { it to Geo.distanceKm(c, it.coordinates) }.sortedBy { it.second }

    /** "Masjid Al-Ansar", "Al-Ansar Mosque" and "Al Ansar" all become "alansar". */
    fun nameKey(name: String): String =
        name.lowercase().replace(Regex("\\b(masjid|mosque|mesjid)\\b"), "").replace(Regex("[^a-z]"), "")

    /** The Eid to show: from 14 days before its date until the day itself. [today] is "yyyy-MM-dd" in Singapore. */
    fun currentEid(today: String, events: List<EidEvent> = MasjidExtrasData.eid): EidEvent? {
        val t = runCatching { java.time.LocalDate.parse(today) }.getOrNull() ?: return null
        return events.firstOrNull { e ->
            val d = runCatching { java.time.LocalDate.parse(e.date) }.getOrNull() ?: return@firstOrNull false
            !t.isAfter(d) && java.time.temporal.ChronoUnit.DAYS.between(t, d) <= 14 && e.mosques.isNotEmpty()
        }
    }

    fun eidAt(e: EidEvent, name: String, c: Coordinates): EidMosque? {
        val key = nameKey(name)
        return e.mosques.firstOrNull { m ->
            (m.lat != null && m.lng != null && Geo.distanceKm(c, Coordinates(m.lat, m.lng)) <= 0.3) || (key.isNotEmpty() && nameKey(m.name) == key)
        }
    }

    fun distanceText(km: Double): String = if (km < 1) "${(km * 1000).roundToInt()} m" else fmt("%.1f km", km)

    /** About 5 km an hour on foot, shown up to 2 km; by car a rough town pace (the maps app shows the jams). */
    fun tripText(km: Double, mode: TripMode): String? = when (mode) {
        TripMode.WALK -> if (km > 2) null else "${max(1, (km / 0.08).roundToInt())} min walk"
        TripMode.DRIVE -> "${max(2, (km * 2 + 2).roundToInt())} min drive"
    }

    /** Ring sets for the map, each a 1 2 5 step like a map's distance scale, from very close to far out. */
    val RING_SETS: List<List<Double>> = listOf(
        listOf(0.25, 0.5, 1.0), listOf(0.5, 1.0, 2.0), listOf(1.0, 2.0, 5.0), listOf(2.0, 5.0, 10.0), listOf(5.0, 10.0, 20.0))

    /** Labels sit on each ring this far below the right hand side, in degrees, so they line up like a ruler. */
    const val RING_LABEL_ANGLE = 35.0

    /**
     * The three rings that suit what the map shows: the widest set whose outer label still lands
     * on screen. Half the map's width and height in km. Walk opens on 500 m, 1 and 2 km, Drive on 1, 2 and 5 km.
     */
    fun ringsFor(halfWidthKm: Double, halfHeightKm: Double): List<Double> {
        val a = Math.toRadians(RING_LABEL_ANGLE)
        return RING_SETS.lastOrNull { s -> s.last() * cos(a) <= halfWidthKm * 0.9 && s.last() * sin(a) <= halfHeightKm * 0.9 } ?: RING_SETS.first()
    }

    /** "500 m" or "2 km". */
    fun ringDistance(km: Double): String = if (km < 1) "${(km * 1000).roundToInt()} m" else "${km.roundToInt()} km"

    /** A note on OpenStreetMap at this spot, for a volunteer to fix or add the place. No sign up needed. */
    fun reportUrl(c: Coordinates): String =
        "https://www.openstreetmap.org/note/new#map=19/${fmt("%.5f", c.latitude)}/${fmt("%.5f", c.longitude)}"

    val facilityLabels = listOf('w' to "Women's space", 'a' to "Wheelchair access", 'p' to "Parking", 't' to "Toilets")

    /** "13:00" as 1 PM, or 13:00 with the 24 hour clock. */
    fun clock(hhmm: String, use24: Boolean): String {
        if (use24) return hhmm
        val (h, m) = hhmm.split(":").map { it.toInt() }
        return "${(h + 11) % 12 + 1}${if (m != 0) ":" + m.toString().padStart(2, '0') else ""} ${if (h < 12) "AM" else "PM"}"
    }
}

/**
 * The common part of OpenStreetMap's opening_hours ("Mo-Su 10:00-22:00",
 * "Mo-Fr 08:00-20:00; Sa,Su off", "24/7"). Anything else gives null, so the
 * app says nothing rather than something wrong. Same rules as the web app.
 */
object OpeningHours {
    data class Now(val open: Boolean, val until: String? = null, val opensAt: String? = null)
    private data class Rule(val days: BooleanArray, val spans: List<Pair<Int, Int>>)
    private val DAYS = listOf("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")
    private val dayToken = Regex("^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$")
    private val spanToken = Regex("^(\\d{1,2}):(\\d{2})-(\\d{1,2}):(\\d{2})$")

    private fun days(text: String): BooleanArray? {
        val out = BooleanArray(7)
        for (part in text.split(",")) {
            val m = dayToken.find(part) ?: return null
            val a = DAYS.indexOf(m.groupValues[1])
            val b = if (m.groupValues[2].isNotEmpty()) DAYS.indexOf(m.groupValues[2]) else a
            var i = a
            while (true) { out[i] = true; if (i == b) break; i = (i + 1) % 7 }
        }
        return out
    }

    private fun spans(text: String): List<Pair<Int, Int>>? = text.split(",").map { part ->
        val m = spanToken.find(part) ?: return null
        val a = m.groupValues[1].toInt() * 60 + m.groupValues[2].toInt()
        var b = m.groupValues[3].toInt() * 60 + m.groupValues[4].toInt()
        if (b <= a) b += 24 * 60
        a to b
    }

    private fun parse(raw: String): List<Rule>? {
        val text = raw.trim()
        if (text.isEmpty()) return null
        if (text == "24/7") return listOf(Rule(BooleanArray(7) { true }, listOf(0 to 24 * 60)))
        val rules = mutableListOf<Rule>()
        for (r in text.split(";").map { it.trim() }.filter { it.isNotEmpty() }) {
            val tokens = r.replace(Regex("\\s*,\\s*"), ",").replace(Regex("\\s*-\\s*"), "-").split(Regex("\\s+"))
            var d = BooleanArray(7) { true }
            var rest = tokens
            if (Regex("^(Mo|Tu|We|Th|Fr|Sa|Su)").containsMatchIn(tokens[0])) {
                d = days(tokens[0]) ?: return null
                rest = tokens.drop(1)
            } else if (tokens[0].startsWith("PH")) continue
            if (rest.size != 1) return null
            val s = when (rest[0]) {
                "off", "closed" -> emptyList()
                "24/7" -> listOf(0 to 24 * 60)
                else -> spans(rest[0]) ?: return null
            }
            rules += Rule(d, s)
        }
        return rules.ifEmpty { null }
    }

    private fun hhmm(min: Int) = "${(min / 60 % 24).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}"

    /** [weekday] 0 = Monday; [minute] of the day in the place's own time. */
    fun at(raw: String, weekday: Int, minute: Int): Now? {
        val rules = parse(raw) ?: return null
        fun spansFor(d: Int): List<Pair<Int, Int>> { var s = emptyList<Pair<Int, Int>>(); for (r in rules) if (r.days[d]) s = r.spans; return s }
        val today = spansFor(weekday)
        for ((a, b) in today) if (minute in a until b) return Now(true, if (b - a >= 24 * 60) null else hhmm(b))
        for ((a, b) in spansFor((weekday + 6) % 7)) if (b > 24 * 60 && minute < b - 24 * 60 && a < 24 * 60) return Now(true, hhmm(b - 24 * 60))
        val later = today.filter { it.first > minute }.minByOrNull { it.first }
        return Now(false, opensAt = later?.let { hhmm(it.first) })
    }

    fun text(n: Now, use24: Boolean): String = when {
        n.open && n.until != null -> "Open now, until ${MasjidExtras.clock(n.until, use24)}"
        n.open -> "Open now, all day"
        n.opensAt != null -> "Closed now, opens ${MasjidExtras.clock(n.opensAt, use24)}"
        else -> "Closed today"
    }
}
