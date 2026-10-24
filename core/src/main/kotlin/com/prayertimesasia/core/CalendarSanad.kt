package com.prayertimesasia.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * The sanad idea applied to the calendar: when Ramadan, Eid and the new year
 * begin, per authority, with the source of each date. Before an authority
 * announces, only the astronomical estimate is shown, labelled as a projection.
 */
@Serializable
enum class HijriEvent(val raw: String) {
    @SerialName("1_ramadan") RAMADAN("1_ramadan"),
    @SerialName("1_syawal") SYAWAL("1_syawal"),
    @SerialName("10_zulhijjah") ADHA("10_zulhijjah"),
    @SerialName("1_muharram") MUHARRAM("1_muharram");

    val hijriMonth: Int get() = when (this) { RAMADAN -> 9; SYAWAL -> 10; ADHA -> 12; MUHARRAM -> 1 }
    val hijriDay: Int get() = if (this == ADHA) 10 else 1

    fun title(style: NamingStyle): String = when (this) {
        RAMADAN -> "1 Ramadan"
        SYAWAL -> when (style) {
            NamingStyle.MALAY -> "Hari Raya Aidilfitri"
            NamingStyle.INDONESIAN -> "Idul Fitri"
            else -> "Eid al-Fitr"
        }
        ADHA -> when (style) {
            NamingStyle.MALAY -> "Hari Raya Aidiladha"
            NamingStyle.INDONESIAN -> "Idul Adha"
            else -> "Eid al-Adha"
        }
        MUHARRAM -> when (style) {
            NamingStyle.MALAY, NamingStyle.INDONESIAN -> "Awal Muharram"
            else -> "Islamic New Year"
        }
    }
}

/** One authority's date for one event, from data/calendar.json. */
@Serializable
data class CalendarAnnouncement(
    val event: HijriEvent,
    @SerialName("hijri_year") val hijriYear: Int,
    val authority: String,
    val country: String,
    /** "yyyy-MM-dd" (Gregorian, local). */
    val date: String,
    val status: Status,
    /** rukyah | hisab | umm_al_qura | following_other_authority */
    val basis: String,
    @SerialName("source_url") val sourceUrl: String? = null,
    @SerialName("announced_at") val announcedAt: String? = null,
) {
    @Serializable
    enum class Status { @SerialName("expected") EXPECTED, @SerialName("announced") ANNOUNCED }

    val basisLabel: String
        get() = when (basis) {
            "rukyah" -> "moon sighting"
            "hisab" -> "calculation"
            "umm_al_qura" -> "Umm al-Qura calendar"
            "following_other_authority" -> "follows another authority"
            else -> basis
        }

    val gregorian: LocalDate?
        get() {
            val p = date.split("-").mapNotNull { it.toIntOrNull() }
            if (p.size != 3) return null
            return runCatching { LocalDate.of(p[0], p[1], p[2]) }.getOrNull()
        }
}

@Serializable
data class CalendarDataset(
    val version: Int,
    val licence: String,
    val announcements: List<CalendarAnnouncement>,
) {
    fun announcements(event: HijriEvent, hijriYear: Int) = announcements.filter { it.event == event && it.hijriYear == hijriYear }

    companion object {
        val empty = CalendarDataset(1, "CC-BY-4.0", emptyList())
        fun decode(text: String): CalendarDataset = CoreJson.decodeFromString(serializer(), text)
    }
}

object CalendarSanad {
    data class Authority(val id: String, val name: String, val country: String)

    /** Who decides the dates, by country. */
    val authorities: List<Authority> = listOf(
        Authority("MUIS", "MUIS (Singapore)", "SG"),
        Authority("JAKIM", "Penyimpan Mohor Besar Raja-Raja (Malaysia)", "MY"),
        Authority("KEMENAG", "Kemenag (Indonesia)", "ID"),
        Authority("MUHAMMADIYAH", "Muhammadiyah (Indonesia)", "ID"),
        Authority("KHEU", "Ministry of Religious Affairs (Brunei)", "BN"),
        Authority("CHULARAJMONTRI", "Chularajmontri (Thailand)", "TH"),
        Authority("KMF", "Korea Muslim Federation", "KR"),
        Authority("UMMALQURA", "Saudi Arabia (Umm al-Qura / Supreme Court)", "SA"),
        Authority("DIYANET", "Diyanet (Türkiye)", "TR"),
    )

    fun defaultAuthority(country: String): String? = authorities.firstOrNull { it.country == country }?.id

    fun authorityName(id: String): String = authorities.firstOrNull { it.id == id }?.name ?: id

    /** The Umm al-Qura calendar's Gregorian date for an event: the estimate shown before any announcement. */
    fun expected(event: HijriEvent, hijriYear: Int): LocalDate? = Hijri.toLocalDate(hijriYear, event.hijriMonth, event.hijriDay)

    data class Upcoming(val event: HijriEvent, val hijriYear: Int) {
        val id: String get() = "${event.raw}-$hijriYear"
    }

    /** The next [count] events on or after [date]. */
    fun upcoming(after: Instant, zone: ZoneId, count: Int = 4): List<Upcoming> {
        val today = Hijri.date(after, zone)
        val out = mutableListOf<Upcoming>()
        for (year in today.year..(today.year + 1)) {
            for (event in listOf(HijriEvent.MUHARRAM, HijriEvent.RAMADAN, HijriEvent.SYAWAL, HijriEvent.ADHA)) {
                val ahead = compareValuesBy(Triple(year, event.hijriMonth, event.hijriDay), Triple(today.year, today.month, today.day),
                    { it.first }, { it.second }, { it.third }) >= 0
                if (ahead) out += Upcoming(event, year)
            }
        }
        return out.take(count)
    }
}
