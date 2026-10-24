package com.prayertimesasia.app.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.Resolver
import java.time.Instant

/**
 * Prayer alerts at the exact minute, worked out on the phone: AlarmManager
 * alarms for the next two days (exact when the user allows it, as close as the
 * system permits otherwise), re-planned whenever one rings, the app opens, the
 * phone restarts or the time zone changes. Nothing comes from a server.
 */
object AlarmScheduler {
    enum class Kind { PRAYER, EARLY, WAKE, REFRESH }

    data class Alert(val id: String, val title: String, val body: String, val at: Instant, val kind: Kind)

    /** What should ring in the next two days, soonest first. Pure, so it can be tested. */
    fun plan(r: Resolver, now: Instant): List<Alert> {
        val place = r.activePlace ?: return emptyList()
        val p = r.prefs
        val here = if (place.isInAsia) "${place.name} ${place.profile.flag}" else place.name
        val out = mutableListOf<Alert>()
        for (offset in 0..2) {
            val day = r.day(now, offset) ?: continue
            val key = "${day.year}-${day.month}-${day.day}"
            if (p.notificationsEnabled) {
                for (prayer in Prayer.all.filter { it in p.notifyPrayers }) {
                    val time = day.time(prayer)
                    val name = r.prayerName(prayer, time)
                    val id = "$key-${prayer.raw}"
                    if (prayer == Prayer.SUNRISE) {
                        out += Alert(id, "$name · ${r.formatted(time)}", "${Prayer.FAJR.name(r.naming)} has ended. $here", time, Kind.PRAYER)
                        continue
                    }
                    out += Alert(id, "$name · ${r.formatted(time)}", "It's time for $name in $here", time, Kind.PRAYER)
                    if (p.reminderMinutesBefore > 0) {
                        out += Alert("$id-early", "$name in ${p.reminderMinutesBefore} min", "$name at ${r.formatted(time)} · $here",
                            time.minusSeconds(p.reminderMinutesBefore * 60L), Kind.EARLY)
                    }
                }
            }
            p.wakeUp?.let { w ->
                val fajr = Prayer.FAJR.name(r.naming)
                out += Alert("$key-wake", "Wake up for $fajr", "$fajr ends at ${r.formatted(day.time(Prayer.SUNRISE))} · ${place.name}", w.date(day), Kind.WAKE)
            }
        }
        // Widgets move on at each prayer even with alerts off.
        r.next(now)?.let { (_, t) -> out += Alert("refresh", "", "", t, Kind.REFRESH) }
        return out.filter { it.at > now }.sortedBy { it.at }.take(48)
    }

    private const val PREFS = "alarms"
    private const val KEY = "scheduled"

    fun reschedule(context: Context, r: Resolver, now: Instant = Instant.now()) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager? ?: return
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val alerts = plan(r, now)
        val codes = alerts.map { it.id.hashCode() }.toSet()
        // Cancel what is no longer wanted.
        sp.getStringSet(KEY, emptySet())!!.mapNotNull { it.toIntOrNull() }.filter { it !in codes }.forEach { code ->
            pending(context, code, null)?.let { am.cancel(it) }
        }
        val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        for (a in alerts) {
            val pi = pending(context, a.id.hashCode(), a) ?: continue
            val t = a.at.toEpochMilli()
            try {
                when {
                    a.kind == Kind.REFRESH -> am.set(AlarmManager.RTC, t, pi)
                    exact -> am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
                    else -> am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
                }
            } catch (_: SecurityException) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
            }
        }
        sp.edit().putStringSet(KEY, codes.map { it.toString() }.toSet()).apply()
    }

    private fun pending(context: Context, code: Int, alert: Alert?): PendingIntent? {
        val intent = Intent(context, AlarmReceiver::class.java).setAction("com.prayertimesasia.app.ALERT")
        if (alert != null) {
            intent.putExtra("id", alert.id).putExtra("title", alert.title).putExtra("body", alert.body).putExtra("kind", alert.kind.name)
        }
        val flags = PendingIntent.FLAG_IMMUTABLE or (if (alert == null) PendingIntent.FLAG_NO_CREATE else PendingIntent.FLAG_UPDATE_CURRENT)
        return PendingIntent.getBroadcast(context, code, intent, flags)
    }
}
