package com.prayertimesasia.app.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.prayertimesasia.core.BlessedTime
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.SahurDay
import com.prayertimesasia.core.Season
import com.prayertimesasia.core.WakeUpTiming
import java.time.Instant

/**
 * Prayer alerts at the exact minute, worked out on the phone: AlarmManager
 * alarms for the next two days (exact when the user allows it, as close as the
 * system permits otherwise), re-planned whenever one rings, the app opens, the
 * phone restarts or the time zone changes. Nothing comes from a server.
 */
object AlarmScheduler {
    enum class Kind { PRAYER, EARLY, WAKE, REFRESH }

    const val DEFAULT_REMINDER_MINUTES = 15
    val REMINDER_CHOICES = listOf(5, 10, 15, 20, 30, 45, 60)

    /** Which sound a prayer time alert plays; the azan only when the recordings are in the app (see Azan). */
    enum class Sound { STANDARD, AZAN, AZAN_SUBUH }

    data class Alert(val id: String, val title: String, val body: String, val at: Instant, val kind: Kind,
                     val sound: Sound = Sound.STANDARD)

    /** What should ring in the next two days, soonest first. Pure, so it can be tested. */
    fun plan(r: Resolver, now: Instant): List<Alert> {
        val place = r.activePlace ?: return emptyList()
        val p = r.prefs
        val here = if (place.isInAsia) "${place.name} ${place.profile.flag}" else place.name
        val out = mutableListOf<Alert>()
        for (offset in 0..2) {
            val day = r.day(now, offset) ?: continue
            val key = "${day.year}-${day.month}-${day.day}"
            val early = p.reminderMinutesBefore
            if (p.notificationsEnabled || early > 0) {
                for (prayer in Prayer.all.filter { it in p.notifyPrayers }) {
                    val time = day.time(prayer)
                    val name = r.prayerName(prayer, time)
                    val id = "$key-${prayer.raw}"
                    if (early > 0) {
                        // The heads-up before the prayer, on its own switch: for when a
                        // meeting or work would otherwise run past the time.
                        val title = if (prayer == Prayer.SUNRISE) "${Prayer.FAJR.name(r.naming)} ends in $early min" else "$name in $early min"
                        out += Alert("$id-early", title, "$name at ${r.formatted(time)} · $here", time.minusSeconds(early * 60L), Kind.EARLY)
                    }
                    if (!p.notificationsEnabled) continue
                    if (prayer == Prayer.SUNRISE) {
                        out += Alert(id, "$name · ${r.formatted(time)}", "${Prayer.FAJR.name(r.naming)} has ended. $here", time, Kind.PRAYER)
                        continue
                    }
                    val sound = when {
                        !p.azanSound -> Sound.STANDARD
                        prayer == Prayer.FAJR -> Sound.AZAN_SUBUH
                        else -> Sound.AZAN
                    }
                    if (prayer == Prayer.MAGHRIB && r.isRamadanDay(time)) {
                        out += Alert(id, "Time to berbuka · $name ${r.formatted(time)}", "$BERBUKA_DOA · $here", time, Kind.PRAYER, sound)
                        continue
                    }
                    out += Alert(id, "$name · ${r.formatted(time)}", "It's time for $name in $here", time, Kind.PRAYER, sound)
                }
            }
            out += ramadanAlerts(r, day, key, here, maghribAlertOn = p.notificationsEnabled && Prayer.MAGHRIB in p.notifyPrayers)
            out += wakeUps(r, day, key, place.name)
        }
        // Widgets move on at each prayer even with alerts off.
        r.next(now)?.let { (_, t) -> out += Alert("refresh", "", "", t, Kind.REFRESH) }
        return out.filter { it.at > now }.sortedBy { it.at }.take(48)
    }

    private const val BERBUKA_DOA = "Allahumma laka sumtu wa bika amantu wa 'ala rizqika aftartu"

    /** Ramadan's own alerts: Imsak (10 minutes before), Berbuka at Maghrib, qiyam in the last ten nights. */
    private fun ramadanAlerts(r: Resolver, day: PrayerDay, key: String, here: String, maghribAlertOn: Boolean): List<Alert> {
        val p = r.prefs
        val out = mutableListOf<Alert>()
        val s = r.season(day.time(Prayer.DHUHR))
        if (s.phase == Season.Phase.RAMADAN) {
            val imsak = r.imsak(day)
            if (p.imsakAlert) {
                out += Alert("$key-imsak", "Imsak in 10 minutes · ${r.formatted(imsak)}",
                    "Finish your sahur. Subuh at ${r.formatted(day.time(Prayer.FAJR))} · $here", imsak.minusSeconds(600), Kind.PRAYER)
            }
            if (p.berbukaAlert && !maghribAlertOn) {
                out += Alert("$key-berbuka", "Time to berbuka · ${r.formatted(day.time(Prayer.MAGHRIB))}",
                    "$BERBUKA_DOA. Ramadan day ${s.ramadanDay ?: 0} · $here", day.time(Prayer.MAGHRIB), Kind.PRAYER)
            }
        }
        val night = s.nightTonight
        if (p.qiyamAlert && s.lastTen && night != null) {
            r.blessedTimes(day).firstOrNull { it.first == BlessedTime.LAST_THIRD }?.let { (_, t) ->
                out += Alert("$key-qiyam", "Night $night · the last third has begun",
                    if (s.oddNight) "An odd night of the last ten. Seek Lailatul Qadr." else "One of the last ten nights of Ramadan.", t, Kind.PRAYER)
            }
        }
        return out
    }

    /** The Subuh wake-up and the sahur alarm on one day, as they ring. */
    private fun wakeUps(r: Resolver, day: com.prayertimesasia.core.PrayerDay, key: String, placeName: String): List<Alert> {
        val p = r.prefs
        val fajr = Prayer.FAJR.name(r.naming)
        val out = mutableListOf<Alert>()
        p.sahurAlarm?.let { s ->
            if (SahurDay.rings(day, p.sahurDays, r.zone, p.hijriAdjustment)) {
                out += Alert("$key-sahur", "Wake up for sahur", "$fajr at ${r.formatted(day.time(Prayer.FAJR))} · $placeName", s.date(day), Kind.WAKE)
            }
        }
        p.wakeUp?.let { w ->
            out += if (w == WakeUpTiming.FAJR_MINUS_30) {
                Alert("$key-wake", "Wake up for tahajjud", "$fajr at ${r.formatted(day.time(Prayer.FAJR))} · $placeName", w.date(day), Kind.WAKE)
            } else {
                Alert("$key-wake", "Wake up for $fajr", "$fajr ends at ${r.formatted(day.time(Prayer.SUNRISE))} · $placeName", w.date(day), Kind.WAKE)
            }
        }
        return out
    }

    /** The next wake-up or sahur alarm, looking a week ahead (the sahur alarm may be days away). */
    fun nextWakeUp(r: Resolver, now: Instant): Alert? {
        if (r.prefs.wakeUp == null && r.prefs.sahurAlarm == null) return null
        val place = r.activePlace ?: return null
        for (offset in 0..7) {
            val day = r.day(now, offset) ?: continue
            wakeUps(r, day, "${day.year}-${day.month}-${day.day}", place.name).filter { it.at > now }.minByOrNull { it.at }?.let { return it }
        }
        return null
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
                    // A wake-up is a real alarm: the clock icon shows in the status bar and
                    // battery saving never holds it back.
                    a.kind == Kind.WAKE && exact -> am.setAlarmClock(AlarmManager.AlarmClockInfo(t, openApp(context)), pi)
                    exact -> am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
                    else -> am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
                }
            } catch (_: SecurityException) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
            }
        }
        sp.edit().putStringSet(KEY, codes.map { it.toString() }.toSet()).apply()
    }

    private fun openApp(context: Context): PendingIntent =
        PendingIntent.getActivity(context, 1, Intent(context, com.prayertimesasia.app.MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun pending(context: Context, code: Int, alert: Alert?): PendingIntent? {
        val intent = Intent(context, AlarmReceiver::class.java).setAction("com.prayertimesasia.app.ALERT")
        if (alert != null) {
            intent.putExtra("id", alert.id).putExtra("title", alert.title).putExtra("body", alert.body).putExtra("kind", alert.kind.name)
                .putExtra("sound", alert.sound.name)
        }
        val flags = PendingIntent.FLAG_IMMUTABLE or (if (alert == null) PendingIntent.FLAG_NO_CREATE else PendingIntent.FLAG_UPDATE_CURRENT)
        return PendingIntent.getBroadcast(context, code, intent, flags)
    }
}
