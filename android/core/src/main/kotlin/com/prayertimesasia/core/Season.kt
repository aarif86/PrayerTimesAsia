package com.prayertimesasia.core

import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Ramadan and Syawal, the way the user's community counts them.
 *
 * The Umm al-Qura calendar (plus the user's ± day adjustment) is only the
 * estimate. When the user's authority (MUIS, JAKIM's Penyimpan Mohor Besar
 * Raja-Raja, Kemenag, ...) has published or announced the first day of Ramadan
 * or Syawal in data/calendar.json, that date wins, so Imsak, Berbuka and Raya
 * appear on the days people actually fast and celebrate.
 *
 * Same rules as web/src/core/season.ts and ios Core/Season.swift.
 */

/** For testers: pretend today is one of these days, to try every part of Ramadan and Syawal. */
@Serializable
enum class SeasonPreview(val label: String, val target: Pair<Int, Int>?) {
    OFF("Off (real dates)", null),
    SIGHTING("Moon sighting night (29 Syaaban)", 8 to 29),
    RAMADAN("Ramadan (day 12)", 9 to 12),
    LAST_TEN("Last ten nights (day 26)", 9 to 26),
    RAYA("Hari Raya morning (1 Syawal)", 10 to 1),
    SYAWAL("Syawal (day 8)", 10 to 8),
}

/** How a day's fast went. */
@Serializable
enum class FastMark(val label: String, val letter: String) {
    FASTED("Fasted", ""), PERIOD("Period", "P"), SICK("Sick", "S"), TRAVEL("Travelling", "T"),
    OTHER("Other reason", "O"), QADHA("Replaced a fast", "G"), SYAWAL("Syawal fast", "");

    val isMissed: Boolean get() = this in MISSED

    companion object { val MISSED = listOf(PERIOD, SICK, TRAVEL, OTHER) }
}

object Season {
    enum class Phase { NONE, SYAABAN, RAMADAN, RAYA, SYAWAL }

    data class NextStart(val event: HijriEvent, val day: LocalDate, val announced: Boolean)

    data class Info(
        val hijri: Hijri.HijriDate,
        val phase: Phase,
        val ramadanDay: Int?,
        val syawalDay: Int?,
        /** The Ramadan night that begins at Maghrib this evening (night 1 is the evening before the first fast). */
        val nightTonight: Int?,
        val lastTen: Boolean,
        val oddNight: Boolean,
        val nuzulQuran: Boolean,
        val sightingTonight: HijriEvent?,
        val nextStart: NextStart?,
    )

    /** The Umm al-Qura date of a civil day, shifted by the user's adjustment. */
    fun baseHijri(g: LocalDate, adjustment: Int = 0): Hijri.HijriDate = Hijri.fromLocalDate(g.plusDays(adjustment.toLong()))

    /** The authority's own date for an event: an announcement beats its published expectation. */
    fun authorityDate(list: List<CalendarAnnouncement>, authority: String?, event: HijriEvent, hijriYear: Int): Pair<LocalDate, Boolean>? {
        if (authority == null) return null
        val mine = list.filter { it.authority == authority && it.event == event && it.hijriYear == hijriYear }
        val pick = mine.firstOrNull { it.status == CalendarAnnouncement.Status.ANNOUNCED } ?: mine.firstOrNull() ?: return null
        val day = pick.gregorian ?: return null
        return day to (pick.status == CalendarAnnouncement.Status.ANNOUNCED)
    }

    /**
     * The Hijri date of a civil day for this community: around Ramadan and Syawal
     * it follows the authority's first days; elsewhere it is the adjusted estimate.
     */
    fun communityHijri(g: LocalDate, adjustment: Int, list: List<CalendarAnnouncement>, authority: String?): Hijri.HijriDate {
        val base = baseHijri(g, adjustment)
        if (base.month !in 8..10) return base
        val y = base.year
        val n = g.toEpochDay()
        val r = authorityDate(list, authority, HijriEvent.RAMADAN, y)
        val s = authorityDate(list, authority, HijriEvent.SYAWAL, y)
        if (s != null) {
            val sn = s.first.toEpochDay()
            if (n >= sn && n < sn + 29) return Hijri.HijriDate((n - sn + 1).toInt(), 10, y)
        }
        if (r != null) {
            val rn = r.first.toEpochDay()
            val end = s?.first?.toEpochDay() ?: (rn + 30)
            if (n >= rn && n < end) return Hijri.HijriDate(minOf(30, (n - rn + 1).toInt()), 9, y)
            if (n < rn && base.month >= 9) return Hijri.HijriDate((30 - (rn - n) + 1).toInt(), 8, y)
        } else if (s != null) {
            // Raya announced without a start date: count back from it.
            val sn = s.first.toEpochDay()
            if (n < sn && base.month == 10) return Hijri.HijriDate((30 - (sn - n) + 1).toInt(), 9, y)
        }
        return base
    }

    /** How many days to move "today" so it lands on the tester's chosen day. */
    fun previewShift(today: LocalDate, preview: SeasonPreview): Int {
        val (month, day) = preview.target ?: return 0
        val h = baseHijri(today)
        for (year in listOf(h.year, h.year + 1, h.year - 1)) {
            val g = Hijri.toLocalDate(year, month, day) ?: continue
            return ChronoUnit.DAYS.between(today, g).toInt()
        }
        return 0
    }

    fun info(hijri: Hijri.HijriDate, nextStart: NextStart? = null): Info {
        val m = hijri.month
        val d = hijri.day
        var phase = Phase.NONE
        if (m == 8 && d >= 15) phase = Phase.SYAABAN
        if (m == 9) phase = Phase.RAMADAN
        if (m == 10) phase = if (d == 1) Phase.RAYA else Phase.SYAWAL
        val night = when {
            m == 9 && d < 30 -> d + 1
            m == 8 && d >= 29 -> 1
            else -> null
        }
        val lastTen = (night ?: 0) >= 21
        return Info(
            hijri, phase, if (m == 9) d else null, if (m == 10) d else null, night, lastTen,
            lastTen && (night ?: 0) % 2 == 1, m == 9 && d == 17,
            if (d == 29 && m == 8) HijriEvent.RAMADAN else if (d == 29 && m == 9) HijriEvent.SYAWAL else null,
            nextStart,
        )
    }

    /** Every civil day of a Hijri month for this community, from the 1st. */
    fun monthDays(hijriYear: Int, month: Int, shift: Int, hijriOf: (LocalDate) -> Hijri.HijriDate): List<LocalDate> {
        val est = Hijri.toLocalDate(hijriYear, month, 1)?.minusDays(shift.toLong()) ?: return emptyList()
        val first = listOf(0, 1, -1, 2, -2, 3, -3).map { est.plusDays(it.toLong()) }
            .firstOrNull { hijriOf(it).let { h -> h.year == hijriYear && h.month == month && h.day == 1 } } ?: return emptyList()
        val out = mutableListOf<LocalDate>()
        for (i in 0 until 30) {
            val d = first.plusDays(i.toLong())
            if (hijriOf(d).month != month) break
            out += d
        }
        return out
    }

    data class FastSummary(val days: List<LocalDate>, val fasted: Int, val missed: Int, val replaced: Int, val owed: Int, val syawal: Int)

    /** This Ramadan's fasts: kept, missed and still to replace, and Syawal fasts. */
    fun fastSummary(
        hijriYear: Int, today: LocalDate, log: Map<String, FastMark>, shift: Int, hijriOf: (LocalDate) -> Hijri.HijriDate,
    ): FastSummary {
        val days = monthDays(hijriYear, 9, shift, hijriOf)
        val todayKey = today.toString()
        var fasted = 0
        var missed = 0
        for (d in days) {
            if (d.toString() > todayKey) continue
            val m = log[d.toString()] ?: continue
            if (m == FastMark.FASTED) fasted++ else if (m.isMissed) missed++
        }
        val after = days.lastOrNull()?.toString() ?: todayKey
        val until = monthDays(hijriYear + 1, 9, shift, hijriOf).firstOrNull()?.toString() ?: "9999"
        val syawalDays = monthDays(hijriYear, 10, shift, hijriOf).map { it.toString() }.toSet()
        var replaced = 0
        var syawal = 0
        for ((k, m) in log) {
            if (k <= after || k >= until) continue
            if (m == FastMark.QADHA) replaced++
            if (m == FastMark.SYAWAL && k in syawalDays) syawal++
        }
        return FastSummary(days, fasted, missed, replaced, maxOf(0, missed - replaced), syawal)
    }
}
