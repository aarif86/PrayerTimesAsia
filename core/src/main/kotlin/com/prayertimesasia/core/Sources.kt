package com.prayertimesasia.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/** Where a day's times come from - the "sanad" shown next to every timetable. */
@Serializable
enum class SourceGrade(val code: String) {
    @SerialName("A") OFFICIAL("A"),
    @SerialName("B") MASJID("B"),
    @SerialName("C") COMMUNITY("C"),
    @SerialName("D") CALCULATED("D"),
    /** The user's own observation of the sun or sky (Falak Mode). Never replaces A-D data, only checks it. */
    @SerialName("F") FALAK("F");

    val title: String
        get() = when (this) {
            OFFICIAL -> "Official"
            MASJID -> "Masjid-confirmed"
            COMMUNITY -> "Community-verified"
            CALCULATED -> "Calculated"
            FALAK -> "Falak (observed)"
        }

    val explanation: String
        get() = when (this) {
            OFFICIAL -> "Published by the national or state religious authority, or its exact published method."
            MASJID -> "From a named mosque's own timetable, checked against our calculation."
            COMMUNITY -> "Method confirmed by two or more independent local contributors."
            CALCULATED -> "Astronomical calculation on your phone. The method is shown; local mosques may differ by a few minutes."
            FALAK -> "Worked out from your own observation of the sun's shadow or the sky, with honest ± minutes. Used to learn and to check, never in place of the grades above."
        }
}

/** A mosque's own timetable rule, reverse-engineered from its printed timetable (data/mosques.json). */
@Serializable
data class MosqueProfile(
    val id: String,
    val name: String,
    val lat: Double,
    val lng: Double,
    val country: String,
    /** How far from the mosque its timetable is applied. */
    val radiusKm: Double? = null,
    val fingerprint: Fingerprint? = null,
    /** Prayer raw value → rule. */
    val jamaah: Map<String, JamaahRule>? = null,
    /** Friday prayer, "HH:mm" local. */
    val jumuah: String? = null,
    val source: String,
    val verifiedAt: String,
    val grade: SourceGrade,
) {
    @Serializable
    data class Fingerprint(
        val fajrAngle: Double,
        val ishaAngle: Double? = null,
        val ishaInterval: Double? = null,
        val asrFactor: Int,
        /** Prayer raw value → precautionary minutes. */
        val offsets: Map<String, Double> = emptyMap(),
    )

    /** Congregation (iqamah) rule for one prayer. Exactly one field is set. */
    @Serializable
    data class JamaahRule(
        /** "HH:mm" local, e.g. Zuhr at 12:00. */
        val fixed: String? = null,
        /** Minutes after the prayer time begins. */
        val afterMinutes: Int? = null,
        /** Minutes before sunrise (common for Fajr). */
        val beforeSunriseMinutes: Int? = null,
    )

    val coordinates: Coordinates get() = Coordinates(lat, lng)

    val method: CalculationMethod?
        get() {
            val fp = fingerprint ?: return null
            val offsets = fp.offsets.mapNotNull { (k, v) -> Prayer.fromRaw(k)?.let { it to v } }.toMap()
            val isha = fp.ishaAngle?.let { "Isha ${it}°" } ?: "Isha +${(fp.ishaInterval ?: 0.0).toInt()} min"
            return CalculationMethod(
                id = "mosque-$id", name = name, shortName = name,
                fajrAngle = fp.fajrAngle, ishaAngle = fp.ishaAngle, ishaInterval = fp.ishaInterval,
                ramadanIshaInterval = null, maghribAngle = null, offsets = offsets,
                matchesOfficialTable = false,
                note = "$name's own timetable (Fajr ${fp.fajrAngle}° · $isha), from: $source.")
        }

    val asrSchool: AsrSchool? get() = fingerprint?.let { if (it.asrFactor == 2) AsrSchool.HANAFI else AsrSchool.STANDARD }

    /** Jamaah times for a day, in the place's time zone. */
    fun jamaahTimes(day: PrayerDay, zone: ZoneId, isFriday: Boolean): Map<Prayer, Instant> {
        fun at(hhmm: String): Instant? {
            val p = hhmm.split(":").mapNotNull { it.trim().toIntOrNull() }
            if (p.size != 2 || p[0] !in 0..23 || p[1] !in 0..59) return null
            return LocalDate.of(day.year, day.month, day.day).atTime(LocalTime.of(p[0], p[1])).atZone(zone).toInstant()
        }
        val out = mutableMapOf<Prayer, Instant>()
        for (prayer in Prayer.obligatory) {
            if (prayer == Prayer.DHUHR && isFriday) {
                val d = jumuah?.let(::at)
                if (d != null) { out[prayer] = d; continue }
            }
            val rule = jamaah?.get(prayer.raw) ?: continue
            val fixed = rule.fixed?.let(::at)
            when {
                fixed != null -> out[prayer] = fixed
                rule.afterMinutes != null -> out[prayer] = day.time(prayer).plusSeconds(rule.afterMinutes * 60L)
                rule.beforeSunriseMinutes != null -> out[prayer] = day.time(Prayer.SUNRISE).minusSeconds(rule.beforeSunriseMinutes * 60L)
            }
        }
        return out
    }
}

@Serializable
data class MosqueDataset(
    val version: Int,
    val licence: String,
    val mosques: List<MosqueProfile>,
) {
    /** The closest profile whose radius covers [point]. */
    fun profile(near: Coordinates): MosqueProfile? =
        mosques.map { it to Geo.distanceKm(it.coordinates, near) }
            .filter { it.second <= (it.first.radiusKm ?: 3.0) }
            .minByOrNull { it.second }?.first

    companion object {
        val empty = MosqueDataset(1, "CC-BY-4.0", emptyList())
        fun decode(text: String): MosqueDataset = CoreJson.decodeFromString(serializer(), text)
    }
}

/** One JSON configuration for everything the app reads and stores. */
val CoreJson: Json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
    encodeDefaults = true
}
