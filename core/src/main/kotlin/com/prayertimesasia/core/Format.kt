package com.prayertimesasia.core

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max

/** `String.format` with ASCII digits whatever the phone's language. */
fun fmt(format: String, vararg args: Any?): String = String.format(Locale.ROOT, format, *args)

object TimeFormat {
    private val h24 = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
    private val h12 = DateTimeFormatter.ofPattern("h:mm", Locale.US)
    private val ampm = DateTimeFormatter.ofPattern("a", Locale.US)
    private val full12 = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

    /** "5:29 AM" or "05:29". */
    fun formatted(instant: Instant, zone: ZoneId, use24Hour: Boolean): String =
        (if (use24Hour) h24 else full12).format(instant.atZone(zone))

    /**
     * "5:29" and "AM" separately, so the suffix can be set smaller on the same
     * line and never wraps on its own. No suffix in 24-hour mode.
     */
    fun parts(instant: Instant, zone: ZoneId, use24Hour: Boolean): Pair<String, String?> {
        val z = instant.atZone(zone)
        return if (use24Hour) h24.format(z) to null else h12.format(z) to ampm.format(z)
    }

    /** "9h 22m", "22m", "45s". */
    fun short(seconds: Double): String {
        val s = max(0, ceil(seconds).toInt())
        if (s < 60) return "${s}s"
        val minutes = (s + 59) / 60
        val h = minutes / 60
        val m = minutes % 60
        return if (h > 0) "${h}h ${m}m" else "${m}m"
    }

    /** "1:05:09" / "12:30" countdown. */
    fun countdown(seconds: Double): String {
        val s = max(0, ceil(seconds).toInt())
        val h = s / 3600
        val m = (s % 3600) / 60
        val sec = s % 60
        return if (h > 0) fmt("%d:%02d:%02d", h, m, sec) else fmt("%d:%02d", m, sec)
    }

    /** "1 hour 5 minutes" for TalkBack. */
    fun spoken(seconds: Double): String {
        val total = max(60.0, seconds).toInt() / 60
        val h = total / 60
        val m = total % 60
        val hours = if (h == 1) "1 hour" else "$h hours"
        val mins = if (m == 1) "1 minute" else "$m minutes"
        return if (seconds >= 3600) "$hours $mins" else mins
    }
}
