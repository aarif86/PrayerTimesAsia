package com.prayertimesasia.app.alarms

import com.prayertimesasia.core.RamadanContent
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.core.Hadith
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.prayertimesasia.core.BlessedTime
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerAlarmTiming
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.PrayerWindow
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
    enum class Kind { PRAYER, EARLY, WAKE, REFRESH, NUDGE, JUMUAH }

    const val DEFAULT_REMINDER_MINUTES = 15
    val REMINDER_CHOICES = listOf(5, 10, 15, 20, 30, 45, 60)

    /** Which sound a prayer time alert plays; the azan only when the recordings are in the app (see Azan). */
    enum class Sound { STANDARD, AZAN, AZAN_SUBUH }

    /**
     * [silent]: buzz only (quiet hours or "Buzz only"). [unlessPrayed]: a nudge that
     * is dropped when it rings if that prayer has been ticked (or the day excused) by then.
     */
    data class Alert(val id: String, val title: String, val body: String, val at: Instant, val kind: Kind,
                     val sound: Sound = Sound.STANDARD, val silent: Boolean = false,
                     val unlessPrayed: Pair<Prayer, Instant>? = null)

    /** What should ring in the next two days, soonest first. Pure, so it can be tested. */
    fun plan(r: Resolver, now: Instant): List<Alert> {
        val place = r.activePlace ?: return emptyList()
        val p = r.prefs
        val here = if (place.isInAsia) "${place.name} ${place.profile.flag}" else place.name
        val out = mutableListOf<Alert>()
        val nudges = p.trackerEnabled && p.windowNudge && p.trackerPausedSince == null
        for (offset in -1..2) {
            val day = r.day(now, offset) ?: continue
            val key = "${day.year}-${day.month}-${day.day}"
            if (nudges) {
                r.day(now, offset + 1)?.let { next ->
                    for (w in PrayerWindow.windowsOf(day, next)) {
                        // Isyak is open until Subuh: a nudge then would only disturb sleep.
                        if (w.prayer == Prayer.ISHA || w.prayer !in p.notifyPrayers) continue
                        if (r.isPrayed(w.prayer, w.start) || r.isExcused(w.start)) continue
                        val at = w.nudgeAt
                        val name = r.prayerName(w.prayer, w.start)
                        val left = (w.end.epochSecond - at.epochSecond) / 60
                        out += Alert("$key-${w.prayer.raw}-nudge", "$name time ends in $left min",
                            "$name is open until ${r.formatted(w.end)}. Tick it in the app once you have prayed.", at, Kind.NUDGE,
                            silent = r.isSilent(at, w.prayer), unlessPrayed = w.prayer to w.start)
                    }
                }
            }
            if (offset < 0) continue
            val jumuah = p.jumuahReminderMinutes
            if (jumuah > 0 && r.isFriday(day.time(Prayer.DHUHR))) {
                val start = day.jamaah[Prayer.DHUHR] ?: day.time(Prayer.DHUHR)
                val at = start.minusSeconds(jumuah * 60L)
                val name = Prayer.DHUHR.name(r.naming, true)
                val where = if (day.jamaah[Prayer.DHUHR] != null) day.mosqueName?.let { " at $it" } ?: "" else ""
                out += Alert("$key-jumuah", "$name in $jumuah min", "Time to get ready and leave for $name$where, ${r.formatted(start)}.",
                    at, Kind.JUMUAH, silent = r.isSilent(at, Prayer.DHUHR))
            }
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
                        val at = time.minusSeconds(early * 60L)
                        out += Alert("$id-early", title, "$name at ${r.formatted(time)} · $here", at, Kind.EARLY, silent = r.isSilent(at, prayer))
                    }
                    if (!p.notificationsEnabled) continue
                    // An alarm at the same minute rings instead, so it doesn't sound twice.
                    if (p.alarmAtStart(prayer)) continue
                    if (prayer == Prayer.SUNRISE) {
                        out += Alert(id, "$name · ${r.formatted(time)}", "${Prayer.FAJR.name(r.naming)} has ended. $here", time, Kind.PRAYER,
                            silent = r.isSilent(time, prayer))
                        continue
                    }
                    val sound = when {
                        !p.azanSound -> Sound.STANDARD
                        prayer == Prayer.FAJR -> Sound.AZAN_SUBUH
                        else -> Sound.AZAN
                    }
                    if (prayer == Prayer.MAGHRIB && r.isRamadanDay(time)) {
                        out += Alert(id, "Time to berbuka · $name ${r.formatted(time)}", "$BERBUKA_DOA · $here", time, Kind.PRAYER, sound,
                            silent = r.isSilent(time, prayer))
                        continue
                    }
                    out += Alert(id, "$name · ${r.formatted(time)}", "It's time for $name in $here${hadithLine(r, HadithId.AZAN)}", time, Kind.PRAYER, sound,
                        silent = r.isSilent(time, prayer))
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
                    "Finish your sahur. Subuh at ${r.formatted(day.time(Prayer.FAJR))} · $here", imsak.minusSeconds(600), Kind.PRAYER, silent = r.isSilent(imsak, Prayer.FAJR))
            }
            if (p.berbukaAlert && !maghribAlertOn) {
                out += Alert("$key-berbuka", "Time to berbuka · ${r.formatted(day.time(Prayer.MAGHRIB))}",
                    "$BERBUKA_DOA. Ramadan day ${s.ramadanDay ?: 0} · $here", day.time(Prayer.MAGHRIB), Kind.PRAYER, silent = r.isSilent(day.time(Prayer.MAGHRIB), Prayer.MAGHRIB))
            }
        }
        val night = s.nightTonight
        if (p.qiyamAlert && s.lastTen && night != null) {
            r.blessedTimes(day).firstOrNull { it.first == BlessedTime.LAST_THIRD }?.let { (_, t) ->
                out += Alert("$key-qiyam", "Night $night · the last third has begun",
                    if (s.oddNight) "An odd night of the last ten. Seek Lailatul Qadr." else "One of the last ten nights of Ramadan.", t, Kind.PRAYER, silent = r.isSilent(t, Prayer.ISHA))
            }
        }
        return out
    }

    /** Settings, Hadith: one line under the alert, or nothing when it is off. */
    private fun hadithLine(r: Resolver, id: HadithId): String =
        if (r.prefs.hadithInAlerts) "\n" + Hadith.of(id).alertLine(RamadanContent.lang(r.naming)) else ""

    /** Every alarm on one day (Subuh, sahur and the other prayers), as they ring. */
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
                Alert("$key-wake", "Wake up for tahajjud", "$fajr at ${r.formatted(day.time(Prayer.FAJR))} · $placeName${hadithLine(r, HadithId.NIGHT_PRAYER)}", w.date(day), Kind.WAKE)
            } else {
                Alert("$key-wake", "Wake up for $fajr", "$fajr ends at ${r.formatted(day.time(Prayer.SUNRISE))} · $placeName${hadithLine(r, HadithId.FAJR_RAKAAT)}", w.date(day), Kind.WAKE)
            }
        }
        for (prayer in PrayerAlarmTiming.prayers) {
            val t = p.alarm(prayer) ?: continue
            val start = day.time(prayer)
            val end = PrayerAlarmTiming.end(prayer, day)
            val name = r.prayerName(prayer, start)
            val title = if (t == PrayerAlarmTiming.END_MINUS_30) "$name ends in 30 min" else "Time for $name"
            val body = if (prayer == Prayer.ISHA) "$name began at ${r.formatted(start)} · $placeName" else "$name is open until ${r.formatted(end)} · $placeName"
            out += Alert("$key-${prayer.raw}-alarm", title, body, t.date(start, end), Kind.WAKE)
        }
        return out
    }

    /** The next alarm, looking a week ahead (the sahur alarm may be days away). */
    fun nextWakeUp(r: Resolver, now: Instant): Alert? {
        if (!r.prefs.anyAlarm) return null
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
        // Every alarm Off: nothing may ring again, not even a snooze.
        if (!r.prefs.anyAlarm) stopRinging(context)
    }

    private const val SNOOZE_KEY = "snoozes"

    /**
     * Stops every alarm that is ringing now and every snooze waiting to ring
     * again. Used when an alarm is turned Off and by "Turn off all alarms".
     */
    fun stopRinging(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager?
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sp.getStringSet(SNOOZE_KEY, emptySet())!!.forEach { raw ->
            val parts = raw.split('|', limit = 2)
            val code = parts[0].toIntOrNull() ?: return@forEach
            pending(context, code, null)?.let { am?.cancel(it); it.cancel() }
        }
        sp.edit().remove(SNOOZE_KEY).apply()
        val nm = context.getSystemService(android.app.NotificationManager::class.java) ?: return
        nm.activeNotifications.filter { it.notification.category == android.app.Notification.CATEGORY_ALARM }
            .forEach { nm.cancel(it.id) }
    }

    /** Is an alarm snoozed (waiting to ring again)? */
    fun hasSnooze(context: Context, now: Instant = Instant.now()): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(SNOOZE_KEY, emptySet())!!
            .any { (it.split('|').getOrNull(1)?.toLongOrNull() ?: 0L) > now.toEpochMilli() }

    /** Is this snooze still meant to ring (not stopped since it was set)? */
    fun isSnoozeWaiting(context: Context, id: String): Boolean {
        val code = id.hashCode().toString()
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(SNOOZE_KEY, emptySet())!!
            .any { it.substringBefore('|') == code }
    }

    /** A snooze has rung (or been stopped with I'm up): it no longer waits. */
    fun forgetSnooze(context: Context, id: String) {
        val code = id.hashCode().toString()
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val left = sp.getStringSet(SNOOZE_KEY, emptySet())!!.filterNot { it.substringBefore('|') == code }.toSet()
        sp.edit().putStringSet(SNOOZE_KEY, left).apply()
    }

    const val SNOOZE_SUFFIX = "-snooze"
    const val SNOOZE_MINUTES = 5L

    /**
     * Rings this alarm again in [SNOOZE_MINUTES]. It is kept apart from the
     * planned alarms, so re-planning never cancels it, but it is remembered so
     * that turning the alarm Off (or every alarm Off) stops it.
     */
    fun snooze(context: Context, id: String, title: String, body: String, now: Instant = Instant.now()) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager? ?: return
        val alert = Alert(id + SNOOZE_SUFFIX, title, body, now.plusSeconds(SNOOZE_MINUTES * 60), Kind.WAKE)
        val pi = pending(context, alert.id.hashCode(), alert) ?: return
        val t = alert.at.toEpochMilli()
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val code = alert.id.hashCode().toString()
        val snoozes = sp.getStringSet(SNOOZE_KEY, emptySet())!!.filterNot { it.substringBefore('|') == code }.toSet() + "$code|$t"
        sp.edit().putStringSet(SNOOZE_KEY, snoozes).apply()
        val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        try {
            if (exact) am.setAlarmClock(AlarmManager.AlarmClockInfo(t, openApp(context)), pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
        }
    }

    private fun openApp(context: Context): PendingIntent =
        PendingIntent.getActivity(context, 1, Intent(context, com.prayertimesasia.app.MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun pending(context: Context, code: Int, alert: Alert?): PendingIntent? {
        val intent = Intent(context, AlarmReceiver::class.java).setAction("com.prayertimesasia.app.ALERT")
        if (alert != null) {
            intent.putExtra("id", alert.id).putExtra("title", alert.title).putExtra("body", alert.body).putExtra("kind", alert.kind.name)
                .putExtra("sound", alert.sound.name).putExtra("silent", alert.silent)
            alert.unlessPrayed?.let { (prayer, start) -> intent.putExtra("unlessPrayed", prayer.raw).putExtra("unlessPrayedAt", start.toEpochMilli()) }
        }
        val flags = PendingIntent.FLAG_IMMUTABLE or (if (alert == null) PendingIntent.FLAG_NO_CREATE else PendingIntent.FLAG_UPDATE_CURRENT)
        return PendingIntent.getBroadcast(context, code, intent, flags)
    }
}
