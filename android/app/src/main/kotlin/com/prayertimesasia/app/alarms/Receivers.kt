package com.prayertimesasia.app.alarms

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.prayertimesasia.app.MainActivity
import com.prayertimesasia.app.PrayerApp
import com.prayertimesasia.app.R
import com.prayertimesasia.app.widget.WidgetUpdater
import com.prayertimesasia.core.AlarmSound
import com.prayertimesasia.core.Prayer
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object Notifications {
    const val PRAYER = "prayer"
    /** "before-prayer" replaced the quieter "reminder" channel: Android never lets an app raise a channel's importance afterwards. */
    const val REMINDER = "before-prayer"
    const val WAKE = "wakeup"
    /** Prayer time alerts with the azan. Android fixes a channel's sound when it is created, so each recording has its own. */
    const val AZAN = "prayer-azan"
    const val AZAN_SUBUH = "prayer-azan-subuh"
    /** Buzz only: quiet hours and "Buzz only". A channel's sound can't change, so silence has its own. */
    const val QUIET = "prayer-quiet"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel(PRAYER, "Prayer times", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "An alert at the exact time each prayer begins."
        })
        nm.deleteNotificationChannel("reminder")
        nm.createNotificationChannel(NotificationChannel(REMINDER, "Reminder before prayer", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "A heads-up a few minutes before each prayer, so a meeting doesn't run past it."
        })
        Azan.uri(context, subuh = false)?.let { uri ->
            nm.createNotificationChannel(NotificationChannel(AZAN, "Prayer times with azan", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "The azan at the time each prayer begins."
                setSound(uri, Azan.attributes)
            })
            nm.createNotificationChannel(NotificationChannel(AZAN_SUBUH, "Subuh with azan", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "The Subuh azan at the time Subuh begins."
                setSound(Azan.uri(context, subuh = true) ?: uri, Azan.attributes)
            })
        }
        nm.createNotificationChannel(NotificationChannel(QUIET, "Quiet alerts (buzz only)", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Prayer alerts during your quiet hours, or all of them with Buzz only on. They vibrate, with no sound."
            setSound(null, null)
            enableVibration(true)
        })
        nm.createNotificationChannel(alarmChannel(WAKE, "Prayer alarms",
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)))
        // Android fixes a channel's sound when it is made, so each alarm sound has its own.
        for (sound in listOf(AlarmSound.CHIME, AlarmSound.BELLS, AlarmSound.BEEPS)) {
            nm.createNotificationChannel(alarmChannel("$WAKE-${sound.raw}", "Prayer alarms (${sound.label})", rawUri(context, sound)))
        }
    }

    private val alarmAttributes: AudioAttributes =
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()

    @androidx.annotation.RequiresApi(26)
    private fun alarmChannel(id: String, name: String, sound: Uri?): NotificationChannel =
        NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Rings like an alarm until you tap I'm up."
            setSound(sound, alarmAttributes)
            enableVibration(true)
        }

    /** One of our own alarm tones in res/raw. */
    fun rawUri(context: Context, sound: AlarmSound): Uri? {
        val res = when (sound) {
            AlarmSound.CHIME -> R.raw.alarm_chime
            AlarmSound.BELLS -> R.raw.alarm_bells
            AlarmSound.BEEPS -> R.raw.alarm_beeps
            else -> return null
        }
        return Uri.parse("android.resource://${context.packageName}/$res")
    }

    /** The sound an alarm plays now: the chosen tone, a ringtone from the phone, or the phone's alarm sound. */
    fun alarmUri(context: Context, sound: AlarmSound, ringtone: String?): Uri? = when (sound) {
        AlarmSound.PHONE -> ringtone?.let(Uri::parse) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        AlarmSound.CLASSIC -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        else -> rawUri(context, sound)
    }

    /**
     * The channel for the chosen alarm sound. A ringtone picked from the phone
     * gets its own channel, made when first needed (older ones are removed).
     */
    private fun wakeChannel(context: Context): String {
        val prefs = (context.applicationContext as? PrayerApp)?.state?.prefs ?: return WAKE
        return when (prefs.alarmSound) {
            AlarmSound.CLASSIC -> WAKE
            AlarmSound.PHONE -> {
                val ringtone = prefs.alarmRingtone ?: return WAKE
                if (Build.VERSION.SDK_INT < 26) return WAKE
                val id = "$WAKE-phone-${Integer.toHexString(ringtone.hashCode())}"
                val nm = context.getSystemService(NotificationManager::class.java) ?: return WAKE
                nm.notificationChannels.filter { it.id.startsWith("$WAKE-phone-") && it.id != id }.forEach { nm.deleteNotificationChannel(it.id) }
                if (nm.getNotificationChannel(id) == null) {
                    nm.createNotificationChannel(alarmChannel(id, "Prayer alarms (your ringtone)", Uri.parse(ringtone)))
                }
                id
            }
            else -> "$WAKE-${prefs.alarmSound.raw}"
        }
    }

    fun canPost(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun post(context: Context, id: String, title: String, body: String, kind: AlarmScheduler.Kind,
             sound: AlarmScheduler.Sound = AlarmScheduler.Sound.STANDARD, silent: Boolean = false) {
        if (!canPost(context)) return
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val channel = when {
            silent && kind != AlarmScheduler.Kind.WAKE -> QUIET
            else -> channelFor(kind, sound, context)
        }
        val wake = kind == AlarmScheduler.Kind.WAKE
        val builder = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(if (wake) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
            .setPriority(if (wake) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
        if (wake) {
            // Keeps ringing like an alarm until "I'm up" is tapped or it is swiped away,
            // and stops by itself after 10 minutes.
            val done = PendingIntent.getBroadcast(context, id.hashCode(),
                Intent(context, WakeDoneReceiver::class.java).putExtra("notification", id.hashCode()),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            // Snooze: rings again in 5 minutes, as often as it is pressed.
            val base = id.removeSuffix(AlarmScheduler.SNOOZE_SUFFIX)
            val snooze = PendingIntent.getBroadcast(context, (base + AlarmScheduler.SNOOZE_SUFFIX).hashCode(),
                Intent(context, SnoozeReceiver::class.java).putExtra("notification", id.hashCode())
                    .putExtra("id", base).putExtra("title", title).putExtra("body", body),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            builder.addAction(0, "Snooze 5 min", snooze)
            builder.addAction(0, "I'm up", done)
                .setTimeoutAfter(10 * 60 * 1000L)
                .setOngoing(false)
        }
        val n = builder.build()
        if (wake) n.flags = n.flags or android.app.Notification.FLAG_INSISTENT
        try {
            NotificationManagerCompat.from(context).notify(id.hashCode(), n)
        } catch (_: SecurityException) {
        }
    }

    private fun channelFor(kind: AlarmScheduler.Kind, sound: AlarmScheduler.Sound, context: Context): String =
        when (kind) {
            AlarmScheduler.Kind.EARLY, AlarmScheduler.Kind.NUDGE, AlarmScheduler.Kind.JUMUAH -> REMINDER
            AlarmScheduler.Kind.WAKE -> wakeChannel(context)
            else -> when {
                sound == AlarmScheduler.Sound.STANDARD || !Azan.isAvailable(context) -> PRAYER
                sound == AlarmScheduler.Sound.AZAN_SUBUH -> AZAN_SUBUH
                else -> AZAN
            }
        }
}

/** Rings an alert, then plans the next ones and moves the widgets on. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val kind = runCatching { AlarmScheduler.Kind.valueOf(intent.getStringExtra("kind") ?: "") }.getOrNull()
        // A nudge for a prayer ticked (or a day excused) since it was planned stays quiet.
        val done = intent.getStringExtra("unlessPrayed")?.let { raw ->
            val state = (context.applicationContext as? PrayerApp)?.state ?: return@let false
            val prayer = Prayer.entries.firstOrNull { it.raw == raw } ?: return@let false
            val at = Instant.ofEpochMilli(intent.getLongExtra("unlessPrayedAt", 0))
            state.resolver.isPrayed(prayer, at) || state.resolver.isExcused(at) || state.prefs.trackerPausedSince != null
        } ?: false
        if (kind != null && kind != AlarmScheduler.Kind.REFRESH && !done) {
            Notifications.post(context, intent.getStringExtra("id") ?: "alert", intent.getStringExtra("title") ?: "",
                intent.getStringExtra("body") ?: "", kind,
                runCatching { AlarmScheduler.Sound.valueOf(intent.getStringExtra("sound") ?: "") }.getOrDefault(AlarmScheduler.Sound.STANDARD),
                intent.getBooleanExtra("silent", false))
        }
        refresh(context, goAsync())
    }
}

/** "I'm up" on an alarm: stops it ringing. */
class WakeDoneReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        NotificationManagerCompat.from(context).cancel(intent.getIntExtra("notification", 0))
    }
}

/** "Snooze 5 min" on an alarm: stops it ringing and rings it again in 5 minutes. */
class SnoozeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        NotificationManagerCompat.from(context).cancel(intent.getIntExtra("notification", 0))
        AlarmScheduler.snooze(context, intent.getStringExtra("id") ?: "alarm",
            intent.getStringExtra("title") ?: "", intent.getStringExtra("body") ?: "")
    }
}

/** After a restart, an app update, or a clock or time-zone change, the alarms are planned again. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        refresh(context, goAsync())
    }
}

private fun refresh(context: Context, pending: BroadcastReceiver.PendingResult) {
    val app = context.applicationContext as? PrayerApp
    if (app == null) {
        pending.finish()
        return
    }
    CoroutineScope(Dispatchers.Main).launch {
        try {
            AlarmScheduler.reschedule(context, app.state.resolver)
            WidgetUpdater.updateAll(context)
        } finally {
            pending.finish()
        }
    }
}
