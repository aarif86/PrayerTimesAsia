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
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.prayertimesasia.app.MainActivity
import com.prayertimesasia.app.PrayerApp
import com.prayertimesasia.app.R
import com.prayertimesasia.app.widget.WidgetUpdater
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object Notifications {
    const val PRAYER = "prayer"
    const val REMINDER = "reminder"
    const val WAKE = "wakeup"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel(PRAYER, "Prayer times", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "An alert at the exact time each prayer begins."
        })
        nm.createNotificationChannel(NotificationChannel(REMINDER, "Early reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "A few minutes before each prayer."
        })
        nm.createNotificationChannel(NotificationChannel(WAKE, "Subuh wake-up", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Rings like an alarm before Subuh ends."
            setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            enableVibration(true)
        })
    }

    fun canPost(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun post(context: Context, id: String, title: String, body: String, kind: AlarmScheduler.Kind) {
        if (!canPost(context)) return
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val channel = when (kind) {
            AlarmScheduler.Kind.EARLY -> REMINDER
            AlarmScheduler.Kind.WAKE -> WAKE
            else -> PRAYER
        }
        val n = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(if (kind == AlarmScheduler.Kind.WAKE) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
            .setPriority(if (kind == AlarmScheduler.Kind.EARLY) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_HIGH)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(id.hashCode(), n)
        } catch (_: SecurityException) {
        }
    }
}

/** Rings an alert, then plans the next ones and moves the widgets on. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val kind = runCatching { AlarmScheduler.Kind.valueOf(intent.getStringExtra("kind") ?: "") }.getOrNull()
        if (kind != null && kind != AlarmScheduler.Kind.REFRESH) {
            Notifications.post(context, intent.getStringExtra("id") ?: "alert", intent.getStringExtra("title") ?: "",
                intent.getStringExtra("body") ?: "", kind)
        }
        refresh(context, goAsync())
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
