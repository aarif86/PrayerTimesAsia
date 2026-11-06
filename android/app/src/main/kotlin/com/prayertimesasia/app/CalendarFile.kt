package com.prayertimesasia.app

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.prayertimesasia.core.Prayer
import java.io.File
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * An .ics calendar file of the next 30 days of prayer times, each with an
 * alert, made on the phone and handed to a calendar app. "Only Zohor and Asar"
 * is for a work or school calendar, so meetings and classes don't land on
 * prayer time. Same format as the web and iPhone.
 */
object CalendarFile {
    private val STAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC)

    private fun esc(s: String) = s.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")

    fun make(state: AppState, prayers: List<Prayer>, days: Int = 30): String? {
        val r = state.resolver
        val place = r.activePlace ?: return null
        val now = Instant.now()
        val early = state.prefs.reminderMinutesBefore
        val lines = mutableListOf("BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Prayer Times Asia//Android//EN", "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH", "X-WR-CALNAME:${esc("Prayer times · ${place.name}")}")
        for (i in 0 until days) {
            val day = r.day(now, i) ?: continue
            for (p in prayers) {
                val t = day.time(p)
                val name = r.prayerName(p, t)
                val source = day.officialSource ?: "${r.method.shortName} method"
                lines += listOf("BEGIN:VEVENT",
                    "UID:android-${day.year}-${day.month}-${day.day}-${p.raw}-${"%.3f".format(java.util.Locale.ROOT, place.coordinates.latitude)}@prayertimes.asia",
                    "DTSTAMP:${STAMP.format(now)}", "DTSTART:${STAMP.format(t)}", "DURATION:PT15M", "SUMMARY:${esc(name)}",
                    "DESCRIPTION:${esc("$name begins ${r.formatted(t)} in ${place.name}. Source: $source.")}", "TRANSP:TRANSPARENT",
                    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:${esc(name)}", "TRIGGER:PT0M", "END:VALARM")
                if (early > 0) lines += listOf("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:${esc("$name in $early min")}", "TRIGGER:-PT${early}M", "END:VALARM")
                lines += "END:VEVENT"
            }
        }
        lines += "END:VCALENDAR"
        return lines.joinToString("\r\n") + "\r\n"
    }

    /** Writes the file to the cache and opens the share sheet (calendar apps import .ics files). */
    fun share(context: Context, state: AppState, prayers: List<Prayer>) {
        val text = make(state, prayers) ?: return
        val dir = File(context.cacheDir, "calendar").apply { mkdirs() }
        val slug = (state.resolver.activePlace?.name ?: "here").lowercase().replace(Regex("[^a-z0-9]+"), "-")
        val file = File(dir, "prayer-times-${if (prayers.size == 2) "work-" else ""}$slug.ics")
        file.writeText(text)
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        val send = Intent(Intent.ACTION_SEND).setType("text/calendar").putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        runCatching {
            context.startActivity(Intent.createChooser(send, "Add prayer times to a calendar").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
