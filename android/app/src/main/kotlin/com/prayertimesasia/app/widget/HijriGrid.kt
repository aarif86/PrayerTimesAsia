package com.prayertimesasia.app.widget

import com.prayertimesasia.core.Hijri
import java.time.LocalDate

/**
 * One Hijri month laid out as a grid for the Hijri Calendar widget, as this community counts it
 * (the same Hijri date as the Prayer screen). Dates are expected, the local religious authority decides.
 * Same layout as the iPhone's HijriMonthGrid.
 */
internal data class HijriGrid(
    val month: Int,
    val year: Int,
    /** Empty cells before day 1 (Sunday first). */
    val lead: Int,
    val cells: List<Cell>,
    /** In Ramadan, the civil day of 1 Syawal, shown as one more cell after the last day. */
    val eidAfter: Int?,
    /** Days until the next 1 Ramadan, null during Ramadan. */
    val daysToRamadan: Int?,
) {
    enum class Mark { NONE, NUZUL, LAST_TEN, EID }
    data class Cell(val day: Int, val gregorianDay: Int, val mark: Mark, val isToday: Boolean)

    companion object {
        fun of(today: LocalDate, hijriOf: (LocalDate) -> Hijri.HijriDate): HijriGrid {
            val h = hijriOf(today)
            fun at(day: Int): LocalDate = today.plusDays((day - h.day).toLong())
            var length = h.day
            while (length < 30 && hijriOf(at(length + 1)).month == h.month) length++
            val cells = (1..length).map { d ->
                val mark = when {
                    h.month == 9 && d == 17 -> Mark.NUZUL
                    h.month == 9 && d >= 21 -> Mark.LAST_TEN
                    (h.month == 10 && d == 1) || (h.month == 12 && d == 10) -> Mark.EID
                    else -> Mark.NONE
                }
                Cell(d, at(d).dayOfMonth, mark, d == h.day)
            }
            val daysToRamadan = if (h.month == 9) null else (1..400).firstOrNull { i ->
                val n = hijriOf(today.plusDays(i.toLong()))
                n.month == 9 && n.day == 1
            }
            return HijriGrid(
                month = h.month, year = h.year,
                lead = at(1).dayOfWeek.value % 7,
                cells = cells,
                eidAfter = if (h.month == 9) at(length + 1).dayOfMonth else null,
                daysToRamadan = daysToRamadan,
            )
        }
    }
}
