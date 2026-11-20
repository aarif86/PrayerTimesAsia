package com.prayertimesasia.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** First Jumaat (at Zohor, or your masjid's own time), or the second one some Singapore masjids hold from 2 PM. */
@Serializable
enum class JumuahSession(val raw: String) {
    @SerialName("first") FIRST("first"),
    @SerialName("second") SECOND("second");

    companion object {
        fun of(raw: String?): JumuahSession? = entries.firstOrNull { it.raw == raw }
    }
}

/**
 * "Leave for Jumaat": a Friday reminder to get ready and leave for the masjid.
 * Same choices and words in web/src/core/jumuahLeave.ts and ios Core/JumuahLeave.swift.
 */
object JumuahLeave {
    /** Minutes before Jumaat. 0 is off. */
    val CHOICES = listOf(0, 15, 30, 45, 60, 90, 120, 150, 180)

    /** "14:00", from the Islamic Religious Council of Singapore (MUIS) list. */
    const val SECOND_SESSION_FROM = MasjidExtras.FRIDAY_SECOND_FROM

    /** The older choice 20 moves up to 30, so the reminder still comes early enough. Anything else not on the list is off. */
    fun snap(m: Int): Int = when (m) {
        20 -> 30
        in CHOICES -> m
        else -> 0
    }

    /** "15 min", "1 hour", "2 hours" in the alert's language. */
    fun span(minutes: Int, lang: RamadanContent.Lang): String {
        if (minutes >= 60 && minutes % 30 == 0) {
            val h = minutes / 60
            val half = minutes % 60 == 30
            return when (lang) {
                RamadanContent.Lang.EN -> if (half) "$h ${if (h == 1) "hour" else "hours"} 30 min" else if (h == 1) "1 hour" else "$h hours"
                RamadanContent.Lang.MS -> if (half) "$h jam 30 minit" else "$h jam"
                RamadanContent.Lang.ID -> if (half) "$h jam 30 menit" else "$h jam"
            }
        }
        return when (lang) {
            RamadanContent.Lang.EN -> "$minutes min"
            RamadanContent.Lang.MS -> "$minutes minit"
            RamadanContent.Lang.ID -> "$minutes menit"
        }
    }

    /** The picker label: "Off", "15 min before", "1 hour before", "2 hours before". */
    fun label(minutes: Int): String = if (minutes == 0) "Off" else "${span(minutes, RamadanContent.Lang.EN)} before"

    /**
     * The words of the reminder. [name] is the Friday prayer's name ("Jumaat"),
     * [at] the start time already formatted, [where] the masjid when the time comes from it.
     */
    fun words(lang: RamadanContent.Lang, minutes: Int, name: String, second: Boolean, at: String, where: String?): Pair<String, String> {
        val span = span(minutes, lang)
        return when (lang) {
            RamadanContent.Lang.MS -> Pair(
                "Masa untuk bertolak ke solat $name${if (second) " sesi kedua" else ""}",
                "${if (second) "Sesi kedua solat" else "Solat"} $name${where?.let { " di $it" } ?: ""} bermula pada $at, $span lagi.",
            )
            RamadanContent.Lang.ID -> Pair(
                "Saatnya berangkat untuk salat $name${if (second) " sesi kedua" else ""}",
                "${if (second) "Sesi kedua salat" else "Salat"} $name${where?.let { " di $it" } ?: ""} dimulai pukul $at, $span lagi.",
            )
            RamadanContent.Lang.EN -> Pair(
                "Time to leave for ${if (second) "the second " else ""}$name",
                "${if (second) "The second " else ""}$name${where?.let { " at $it" } ?: ""} starts ${if (second) "from" else "at"} $at, $span from now.",
            )
        }
    }
}
