package com.prayertimesasia.app.ui.today

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.core.AlarmSound
import com.prayertimesasia.core.AlertMode
import com.prayertimesasia.core.JumuahLeave
import com.prayertimesasia.core.NamingStyle
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerAlarmTiming
import com.prayertimesasia.core.RamadanContent
import com.prayertimesasia.core.SahurDay
import com.prayertimesasia.core.SahurTiming
import com.prayertimesasia.core.WakeUpTiming
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * The words of Alerts and alarms in the app language, from the shared word list
 * (data/app-words). The core keeps its English labels for tests and logs.
 */

/** The app language, for lines the core builds itself (like "1 hour 30 min"). */
@Composable
internal fun appWordsLang(): RamadanContent.Lang = when (LocalConfiguration.current.locales[0].language) {
    "ms" -> RamadanContent.Lang.MS
    "in", "id" -> RamadanContent.Lang.ID
    else -> RamadanContent.Lang.EN
}

@Composable
internal fun AlertMode.wordTr(): String = when (this) {
    AlertMode.OFF -> tr(R.string.alerts_modeOff)
    AlertMode.NOTIFY -> tr(R.string.alerts_modeNotify)
    AlertMode.ALARM -> tr(R.string.alerts_modeAlarm)
}

@Composable
internal fun AlertMode.helpTr(): String = when (this) {
    AlertMode.OFF -> tr(R.string.alerts_helpOff)
    AlertMode.NOTIFY -> tr(R.string.phone_alerts_helpNotify)
    AlertMode.ALARM -> tr(R.string.phone_alerts_helpAlarm)
}

@Composable
internal fun WakeUpTiming.labelTr(naming: NamingStyle): String {
    val fajr = Prayer.FAJR.name(naming)
    val sunrise = Prayer.SUNRISE.name(naming)
    return when (this) {
        WakeUpTiming.FAJR_MINUS_30 -> tr(R.string.alerts_wakeTahajjud, "fajr" to fajr)
        WakeUpTiming.AT_FAJR -> tr(R.string.alerts_wakeAtFajr, "fajr" to fajr)
        WakeUpTiming.FAJR_PLUS_5 -> tr(R.string.alerts_wakeAfterFajr, "n" to 5, "fajr" to fajr)
        WakeUpTiming.FAJR_PLUS_10 -> tr(R.string.alerts_wakeAfterFajr, "n" to 10, "fajr" to fajr)
        WakeUpTiming.FAJR_PLUS_15 -> tr(R.string.alerts_wakeAfterFajr, "n" to 15, "fajr" to fajr)
        WakeUpTiming.FAJR_PLUS_30 -> tr(R.string.alerts_wakeAfterFajr, "n" to 30, "fajr" to fajr)
        WakeUpTiming.SUNRISE_MINUS_60 -> tr(R.string.alerts_wakeHourBefore, "sunrise" to sunrise)
        WakeUpTiming.SUNRISE_MINUS_45 -> tr(R.string.alerts_wakeBeforeSunrise, "n" to 45, "sunrise" to sunrise)
        WakeUpTiming.SUNRISE_MINUS_30 -> tr(R.string.alerts_wakeBeforeSunrise, "n" to 30, "sunrise" to sunrise)
        WakeUpTiming.SUNRISE_MINUS_15 -> tr(R.string.alerts_wakeBeforeSunrise, "n" to 15, "sunrise" to sunrise)
    }
}

@Composable
internal fun SahurTiming.labelTr(naming: NamingStyle): String {
    val fajr = Prayer.FAJR.name(naming)
    return when (this) {
        SahurTiming.FAJR_MINUS_60 -> tr(R.string.alerts_sahur60, "fajr" to fajr)
        SahurTiming.FAJR_MINUS_90 -> tr(R.string.alerts_sahur90, "fajr" to fajr)
        SahurTiming.FAJR_MINUS_120 -> tr(R.string.alerts_sahur120, "fajr" to fajr)
    }
}

@Composable
internal fun PrayerAlarmTiming.labelTr(): String = when (this) {
    PrayerAlarmTiming.AT_START -> tr(R.string.alerts_onTime)
    PrayerAlarmTiming.END_MINUS_30 -> tr(R.string.alerts_beforeEnds)
    PrayerAlarmTiming.PLUS_5 -> tr(R.string.alerts_minAfter, "n" to 5)
    PrayerAlarmTiming.PLUS_10 -> tr(R.string.alerts_minAfter, "n" to 10)
    PrayerAlarmTiming.PLUS_15 -> tr(R.string.alerts_minAfter, "n" to 15)
    PrayerAlarmTiming.PLUS_30 -> tr(R.string.alerts_minAfter, "n" to 30)
}

@Composable
internal fun SahurDay.labelTr(): String = when (this) {
    SahurDay.RAMADAN -> tr(R.string.alerts_dayRamadan)
    SahurDay.MON_THU -> tr(R.string.alerts_dayMonThu)
    SahurDay.WHITE_DAYS -> tr(R.string.alerts_dayWhite)
    SahurDay.EVERY_DAY -> tr(R.string.alerts_dayEvery)
}

@Composable
internal fun AlarmSound.labelTr(): String = when (this) {
    AlarmSound.CLASSIC -> tr(R.string.alerts_soundClassic)
    AlarmSound.CHIME -> tr(R.string.alerts_soundChime)
    AlarmSound.BELLS -> tr(R.string.alerts_soundBells)
    AlarmSound.BEEPS -> tr(R.string.alerts_soundBeeps)
    AlarmSound.PHONE -> tr(R.string.alerts_soundPhone)
}

/** "Off", "15 min before", "1 hour before" for the Friday reminder. */
@Composable
internal fun jumuahLeaveLabel(minutes: Int): String =
    if (minutes == 0) tr(R.string.common_off) else tr(R.string.jumuah_before, "span" to JumuahLeave.span(minutes, appWordsLang()))

/** "today", "tomorrow" or the weekday, in the app language. */
@Composable
internal fun whenWords(state: AppState, at: Instant): String {
    val zone = state.resolver.zone
    val day = at.atZone(zone).toLocalDate()
    val today = state.now.atZone(zone).toLocalDate()
    return when (day) {
        today -> tr(R.string.alerts_today)
        today.plusDays(1) -> tr(R.string.alerts_tomorrow)
        else -> day.format(DateTimeFormatter.ofPattern("EEEE", LocalConfiguration.current.locales[0]))
    }
}
