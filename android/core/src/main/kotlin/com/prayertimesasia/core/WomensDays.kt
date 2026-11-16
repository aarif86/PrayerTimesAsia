package com.prayertimesasia.core

import java.time.LocalDate

/**
 * Women's days: the Ramadan fast record and the prayer tracker pause are one
 * fact, so marking it in one place marks it in the other. Pausing the tracker in
 * Ramadan shows those days as "Period" in the fast record; marking a fast day
 * "Period" pauses the tracker (today) or excuses that day (an earlier day).
 * Changing it back undoes both. Everything stays on this phone.
 *
 * Same rules as web/src/core/womensDays.ts and ios Core/WomensDays.swift.
 * Days are "yyyy-MM-dd" in the place's own calendar.
 */
data class WomensDays(
    val fastLog: Map<String, FastMark>,
    val excusedDays: Set<String>,
    val trackerPausedSince: String?,
) {
    private fun inPause(key: String, today: String): Boolean {
        val since = trackerPausedSince ?: return false
        return key >= since && key <= today
    }

    /** How a fast day went: what was marked, or "Period" for an unmarked Ramadan day inside a tracker pause. */
    fun mark(key: String, today: String, isRamadan: (String) -> Boolean): FastMark? =
        fastLog[key] ?: if (inPause(key, today) && isRamadan(key)) FastMark.PERIOD else null

    /** The fast record with the paused Ramadan days read as "Period", for counting. */
    fun effectiveLog(today: String, isRamadan: (String) -> Boolean): Map<String, FastMark> {
        val since = trackerPausedSince ?: return fastLog
        val extra = span(since, today).filter { it !in fastLog && isRamadan(it) }.associateWith { FastMark.PERIOD }
        return if (extra.isEmpty()) fastLog else fastLog + extra
    }

    private fun withPeriods(log: Map<String, FastMark>, days: List<String>, isRamadan: (String) -> Boolean): Map<String, FastMark> =
        log + days.filter { it !in log && isRamadan(it) }.associateWith { FastMark.PERIOD }

    /** Mark how a fast day went, and keep the prayer tracker in step. */
    fun setFast(key: String, newMark: FastMark?, today: String, isRamadan: (String) -> Boolean): WomensDays {
        val before = mark(key, today, isRamadan)
        val log = if (newMark == null) fastLog - key else fastLog + (key to newMark)
        if (newMark == FastMark.PERIOD && before != FastMark.PERIOD) {
            if (inPause(key, today)) return copy(fastLog = log)
            return if (key == today && trackerPausedSince == null) copy(fastLog = log, trackerPausedSince = today)
            else copy(fastLog = log, excusedDays = excusedDays + key)
        }
        if (before != FastMark.PERIOD || newMark == FastMark.PERIOD) return copy(fastLog = log)
        // No longer a period day: the tracker counts it again.
        val excused = excusedDays - key
        val since = trackerPausedSince
        if (since == null || !inPause(key, today)) return copy(fastLog = log, excusedDays = excused)
        // Split the pause around this day: the days before stay excused, the days after stay paused.
        val earlier = if (key > since) span(since, add(key, -1)) else emptyList()
        return WomensDays(
            fastLog = withPeriods(log, earlier, isRamadan),
            excusedDays = excused + earlier,
            trackerPausedSince = if (key < today) add(key, 1) else null,
        )
    }

    /** Pause the tracker from today. Ramadan days in the pause read as "Period" until it ends. */
    fun pause(today: String): WomensDays = copy(trackerPausedSince = today)

    /** End the pause: the paused days stay excused, and their Ramadan days stay "Period" in the fast record. */
    fun endPause(today: String, isRamadan: (String) -> Boolean): WomensDays {
        val since = trackerPausedSince ?: return this
        val days = span(since, today)
        return WomensDays(withPeriods(fastLog, days, isRamadan), excusedDays + days, null)
    }

    /** "Just today" in the tracker: excuse one day, and in Ramadan mark that fast "Period". Again to undo both. */
    fun toggleExcused(key: String, isRamadan: (String) -> Boolean): WomensDays =
        if (key in excusedDays) copy(excusedDays = excusedDays - key, fastLog = if (fastLog[key] == FastMark.PERIOD) fastLog - key else fastLog)
        else copy(excusedDays = excusedDays + key, fastLog = withPeriods(fastLog, listOf(key), isRamadan))

    companion object {
        private fun add(key: String, n: Long): String = LocalDate.parse(key).plusDays(n).toString()

        /** Every day from [from] to [to], both included (at most a year). */
        fun span(from: String, to: String): List<String> {
            val out = mutableListOf<String>()
            var d = runCatching { LocalDate.parse(from) }.getOrNull() ?: return out
            while (d.toString() <= to && out.size < 366) { out += d.toString(); d = d.plusDays(1) }
            return out
        }
    }
}
