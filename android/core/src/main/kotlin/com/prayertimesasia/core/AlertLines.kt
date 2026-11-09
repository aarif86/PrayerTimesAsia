package com.prayertimesasia.core

import java.time.LocalDate

/**
 * The short line under each on-time prayer alert, approved by Ustaz Aarif
 * Raziff. Lines live in data/alert-lines.json (English, Malay, Indonesian).
 * Each prayer has its own lines plus 20 shared ones, handed out by date so
 * the same words rarely come back and never twice on one day. Same rule as
 * web/src/core/alertLines.ts and ios Core/AlertLines.swift.
 */
object AlertLines {
    private val order = listOf(Prayer.FAJR, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

    /** Days since 1970-01-01 for a calendar date. */
    fun dayNumber(year: Int, month: Int, day: Int): Int = LocalDate.of(year, month, day).toEpochDay().toInt()

    /** The alert line for this prayer on this date, with the prayer's name filled in. */
    fun line(lang: RamadanContent.Lang, prayer: Prayer, friday: Boolean, year: Int, month: Int, day: Int, name: String): String {
        val d = dayNumber(year, month, day)
        val k = order.indexOf(prayer).coerceAtLeast(0)
        val set = AlertLinesData.data.getValue(lang)
        val line = when {
            prayer == Prayer.DHUHR && friday -> set.getValue("jumuah").let { it[Math.floorMod(Math.floorDiv(d, 7), it.size)] }
            Math.floorMod(d + k, 4) == 0 -> set.getValue("any").let { it[Math.floorMod(Math.floorDiv(d * 5 + k, 4), it.size)] }
            else -> (set[prayer.raw] ?: set.getValue("any")).let { it[Math.floorMod(d, it.size)] }
        }
        return line.replace("{p}", name)
    }
}
