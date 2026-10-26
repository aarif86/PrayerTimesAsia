package com.prayertimesasia.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * The Umm al-Qura calendar (Saudi Arabia's official civil calendar, as published by
 * KACST), the same one iOS uses for `Calendar(identifier: .islamicUmmAlQura)`.
 * Self-contained so the dates are identical on every Android version.
 */
object Hijri {
    data class HijriDate(val day: Int, val month: Int, val year: Int)

    private const val FIRST_YEAR = 1300
    /** 1 Muharram 1300 AH. */
    private val EPOCH: LocalDate = LocalDate.of(1882, 11, 12)

    /** Month lengths, 1300-1600 AH: three hex digits per year, bit i set = month i+1 has 30 days. */
    private const val TABLE = "5552ab9372b657636cb55aaa95649e95d2ba5b53aab4ba9652e2ad56db5a752f25e8ad16a56ab56b4da9b92b2564ba9b35a6d95d4da5d4aa955369752f46e96d46a953525d4bd9ba3b4b69b2aa554ada5d2da6d9eaae94d2ac564aea6d56ad55d4aa9352ba5b53a6b5ea9d52d29a554ad56daea6e4ed1da2aaa95a2da5b9bb27646c95552ab4dbaba5b4da9d52aa592d26d8ed2daad5aa5a4b4979372b6975d69d52c9592b25b4db9d55d2da5d4aa9554daad3aabd2bc4b89a9552d5adb6a6d4dc9d92aa69562ae56d36ab55aaa94d49d95d2ba5b55aad55a9a92e26e55dada6d46a5b27a4d4ad56db5a754f49e92d26a563566b5baab92b2568ba9b55aada5b4da9b52a9a536276575af26d46a95552ad4bd9ba574b69b52a9552da5d4daad96b2e95e2ac9692eaad56ad65d4ad1562bc5b53a6b5db2d64d29a554ad96daea6e8ed1da4d4aa6a2da5b9b72b686d16554ab95b2ba5b5da9d52ca694e46e95d4daad5aaaa4d49b9374b6975d6ad52aa594b2ab55bad95d2dc5d92b25555ab55b4ba97a2745593aab4d69d65d2ba5b4aa954ad15d2dd9da5b45a952d25b8b717656db6aacaa9652b15b2bb5b6daab94d46a8d52da9d55a755749f13e4aa965566b5baab94"

    private val monthBits: IntArray = IntArray(TABLE.length / 3) { TABLE.substring(it * 3, it * 3 + 3).toInt(16) }
    private val lastYear = FIRST_YEAR + monthBits.size - 1

    /** Epoch day of 1 Muharram of each year in the table, plus one past the end. */
    private val yearStarts: LongArray = LongArray(monthBits.size + 1).also { starts ->
        starts[0] = EPOCH.toEpochDay()
        for (i in monthBits.indices) starts[i + 1] = starts[i] + yearLength(monthBits[i])
    }

    private fun monthLength(bits: Int, month: Int) = if (bits and (1 shl (month - 1)) != 0) 30 else 29
    private fun yearLength(bits: Int) = (1..12).sumOf { monthLength(bits, it) }

    /** The Hijri date of a Gregorian date. Dates outside 1882-2174 are clamped to the table. */
    fun fromLocalDate(date: LocalDate): HijriDate {
        val epochDay = date.toEpochDay().coerceIn(yearStarts.first(), yearStarts.last() - 1)
        var i = yearStarts.indexOfLast { it <= epochDay }.coerceAtMost(monthBits.size - 1)
        var rest = (epochDay - yearStarts[i]).toInt()
        var month = 1
        while (month < 12 && rest >= monthLength(monthBits[i], month)) {
            rest -= monthLength(monthBits[i], month)
            month++
        }
        return HijriDate(rest + 1, month, FIRST_YEAR + i)
    }

    /** The Gregorian date of a Hijri date, or null outside the table. */
    fun toLocalDate(year: Int, month: Int, day: Int): LocalDate? {
        if (year < FIRST_YEAR || year > lastYear || month !in 1..12) return null
        val i = year - FIRST_YEAR
        var days = yearStarts[i]
        for (m in 1 until month) days += monthLength(monthBits[i], m)
        if (day < 1 || day > monthLength(monthBits[i], month)) return null
        return LocalDate.ofEpochDay(days + day - 1)
    }

    /**
     * Umm al-Qura date, shifted by the user's ±days adjustment (sighting-based
     * calendars in Southeast Asia can be a day apart from Makkah).
     */
    fun date(instant: Instant, zone: ZoneId, adjustment: Int = 0): HijriDate =
        fromLocalDate(instant.atZone(zone).toLocalDate().plusDays(adjustment.toLong()))

    fun isRamadan(instant: Instant, zone: ZoneId, adjustment: Int = 0): Boolean = date(instant, zone, adjustment).month == 9

    fun format(instant: Instant, zone: ZoneId, style: NamingStyle, adjustment: Int = 0): String {
        val h = date(instant, zone, adjustment)
        val name = style.hijriMonths[(h.month - 1).coerceIn(0, 11)]
        return "${h.day} $name ${h.year}"
    }
}
