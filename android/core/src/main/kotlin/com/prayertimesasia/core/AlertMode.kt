package com.prayertimesasia.core

/**
 * One choice per prayer in "Alerts and alarms": Off, Notify or Alarm.
 * Same rules in web core/alertMode.ts and ios Services/AlertMode.swift.
 *
 * Nothing new is saved. The choice is read from the settings the app already had:
 * Notify is a prayer in notifyPrayers (with notificationsEnabled), Alarm is that
 * prayer's alarm (wakeUp for Subuh). A prayer can have an alarm and a notification
 * when it begins, which the Alarm page shows as "Notification too".
 */
enum class AlertMode(val word: String, val help: String) {
    OFF("Off", "Nothing for this prayer"),
    NOTIFY("Notify", "A notification with sound. Quiet when your phone is on silent or Do Not Disturb."),
    ALARM("Alarm", "Rings until you stop it, even on silent and Do Not Disturb. Snooze 5 min.");

    companion object {
        /** Syuruk is only a note that Subuh has ended: no alarm for it. */
        fun modes(prayer: Prayer): List<AlertMode> = if (prayer == Prayer.SUNRISE) listOf(OFF, NOTIFY) else entries
        const val DEFAULT_FRIDAY_MINUTES = 30
    }
}

fun Preferences.hasAlarm(prayer: Prayer): Boolean = if (prayer == Prayer.FAJR) wakeUp != null else alarm(prayer) != null

/** A notification when the prayer begins. */
fun Preferences.notifies(prayer: Prayer): Boolean = notificationsEnabled && prayer in notifyPrayers

fun Preferences.alertMode(prayer: Prayer): AlertMode = when {
    hasAlarm(prayer) -> AlertMode.ALARM
    notifies(prayer) -> AlertMode.NOTIFY
    else -> AlertMode.OFF
}

private fun Preferences.withHasAlarm(on: Boolean, prayer: Prayer): Preferences = when {
    prayer == Prayer.FAJR -> copy(wakeUp = if (on) wakeUp ?: WakeUpTiming.AT_FAJR else null)
    prayer in PrayerAlarmTiming.prayers -> withAlarm(prayer, if (on) alarm(prayer) ?: PrayerAlarmTiming.AT_START else null)
    else -> this
}

/** Turn the notification when a prayer begins on or off, leaving its alarm alone. */
fun Preferences.withNotify(on: Boolean, prayer: Prayer): Preferences =
    if (on) {
        // Alerts were never turned on: the old list (all five) was only a default, so start from this one prayer.
        if (!notificationsEnabled) copy(notificationsEnabled = true, notifyPrayers = setOf(prayer))
        else copy(notifyPrayers = notifyPrayers + prayer)
    } else copy(notifyPrayers = notifyPrayers - prayer)

/**
 * Off clears both. Notify clears the alarm. Alarm keeps a notification the prayer
 * already had, so a 30 min tahajjud alarm still leaves the Subuh notification at
 * Subuh. An alarm at the very start takes its place anyway.
 */
fun Preferences.withAlertMode(mode: AlertMode, prayer: Prayer): Preferences = when (mode) {
    AlertMode.OFF -> withHasAlarm(false, prayer).withNotify(false, prayer)
    AlertMode.NOTIFY -> withHasAlarm(false, prayer).withNotify(true, prayer)
    AlertMode.ALARM -> if (prayer == Prayer.SUNRISE) withNotify(true, prayer) else withHasAlarm(true, prayer)
}

/** All five main prayers are on Notify (no Off, no Alarm). Sunrise does not count. */
fun Preferences.allFiveNotify(): Boolean = Prayer.obligatory.all { alertMode(it) == AlertMode.NOTIFY }

/**
 * "Notify me for all 5 prayers": every main prayer that is Off goes to Notify.
 * A prayer on Alarm stays on Alarm. Sunrise is not touched.
 */
fun Preferences.withNotifyAllFive(): Preferences = copy(notificationsEnabled = true, notifyPrayers = notifyPrayers + Prayer.obligatory)

/** The bell on the Prayer screen: Off, then Notify, then Alarm, then Off again. */
fun Preferences.nextAlertMode(prayer: Prayer): AlertMode {
    val modes = AlertMode.modes(prayer)
    return modes[(modes.indexOf(alertMode(prayer)) + 1) % modes.size]
}

/** Leave for Jumaat, the Friday row. */
val Preferences.fridayMode: AlertMode
    get() = when {
        jumuahReminderMinutes <= 0 -> AlertMode.OFF
        jumuahLeaveAlarm -> AlertMode.ALARM
        else -> AlertMode.NOTIFY
    }

/** Off, Notify or Alarm for the Friday reminder, 30 min before unless already set. */
fun Preferences.withFridayMode(mode: AlertMode): Preferences =
    if (mode == AlertMode.OFF) copy(jumuahReminderMinutes = 0, jumuahLeaveAlarm = false)
    else copy(
        jumuahReminderMinutes = if (jumuahReminderMinutes > 0) jumuahReminderMinutes else AlertMode.DEFAULT_FRIDAY_MINUTES,
        jumuahLeaveAlarm = mode == AlertMode.ALARM,
    )

/**
 * The one case the single screen could not show truthfully: "Reminder before
 * prayer" on while "Prayer time alerts" was off. Those prayers now show as Notify
 * and also get the notification at the time. Does nothing a second time.
 */
fun Preferences.unifyAlerts(): Preferences =
    if (!notificationsEnabled && reminderMinutesBefore > 0 && notifyPrayers.isNotEmpty()) copy(notificationsEnabled = true) else this
