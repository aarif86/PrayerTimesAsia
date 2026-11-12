package com.prayertimesasia.app.widget

import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.RamadanContent
import com.prayertimesasia.core.RamadanWordKey
import com.prayertimesasia.core.RamadanWords
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.TodayStyle
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

/** What a widget shows, worked out once from the app's resolver (official tables included). */
data class WidgetModel(
    val placeName: String,
    val flag: String,
    val hijri: String,
    val dateLine: String,
    val sourceLabel: String,
    val day: PrayerDay,
    val now: Instant,
    val current: Pair<Prayer, Instant>?,
    val next: Pair<Prayer, Instant>?,
    val style: TodayStyle,
    val names: Map<Prayer, String>,
    val times: Map<Prayer, Pair<String, String?>>,
    val nextName: String?,
    val nextTime: String?,
    val zone: java.time.ZoneId,
    /** In Ramadan, the fast's next moment (Imsak or Berbuka), as the Ramadan card shows it; null otherwise. */
    val fast: FastMoment? = null,
) {
    /** "Berbuka" at 7:05 PM, in the prayer names' language. */
    data class FastMoment(val kind: Resolver.FastingKind, val at: Instant, val label: String, val time: String)

    /**
     * Which row carries the live countdown: the next prayer's ("in "), or once the
     * next is tomorrow's Subuh, the one we are in ("Subuh in ").
     */
    fun countdownRow(): Pair<Prayer, String>? {
        val next = this.next ?: return null
        if (kotlin.math.abs(day.time(next.first).epochSecond - next.second.epochSecond) < 60) return next.first to "in "
        val cur = current?.first ?: return null
        return cur to "$nextName in "
    }

    companion object {
        fun from(r: Resolver, now: Instant, style: TodayStyle = r.prefs.todayStyle): WidgetModel? {
            val place = r.activePlace ?: return null
            val day = r.day(now) ?: return null
            val next = r.next(now)
            return WidgetModel(
                placeName = place.name,
                flag = if (place.isInAsia) place.profile.flag else "",
                hijri = r.hijri(now),
                dateLine = DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.ENGLISH).format(day.date),
                sourceLabel = day.officialSource ?: "${r.method.shortName} · calculated",
                day = day, now = now, current = r.current(now), next = next, style = style,
                names = Prayer.all.associateWith { r.prayerName(it, day.time(it)) },
                times = Prayer.all.associateWith { r.timeParts(day.time(it)) },
                nextName = next?.let { r.prayerName(it.first, it.second) },
                nextTime = next?.let { r.formatted(it.second) },
                zone = r.zone,
                fast = r.fastingMoment(now)?.let { (kind, at) ->
                    val t = RamadanWords.In(RamadanContent.lang(r.naming))
                    FastMoment(kind, at, t(if (kind == Resolver.FastingKind.IMSAK) RamadanWordKey.imsak else RamadanWordKey.berbuka), r.formatted(at))
                },
            )
        }
    }
}
