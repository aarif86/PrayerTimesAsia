package com.prayertimesasia.app.ui.today

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.outlined.NotificationsOff
import androidx.compose.material3.Icon
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.app.alarms.Azan
import com.prayertimesasia.app.ui.components.HadithView
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.settings.PickerRow
import com.prayertimesasia.app.ui.settings.Section
import com.prayertimesasia.app.ui.settings.SwitchRow
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.AlertMode
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerAlarmTiming
import com.prayertimesasia.core.SahurDay
import com.prayertimesasia.core.SahurTiming
import com.prayertimesasia.core.WakeUpTiming
import com.prayertimesasia.core.alertMode
import com.prayertimesasia.core.fridayMode
import com.prayertimesasia.core.notifies
import com.prayertimesasia.core.withNotify

/**
 * Alerts and alarms: every alert, alarm and notification in one place.
 * Each prayer is Off, Notify or Alarm. Tap a prayer's name for its own page.
 * Same as web ui/WakeUp.tsx and iOS WakeUpView.swift.
 */
@Composable
fun WakeUpSheetContent(state: AppState) {
    var page by remember { mutableStateOf(state.alertsPage) }
    val go: (String?) -> Unit = { page = it; state.alertsPage = it }
    BackHandler(enabled = page != null) { go(null) }
    when (val now = page) {
        null -> AlertsMainList(state, go)
        "check" -> SubPage(tr(R.string.alerts_checkPhone), go) { CheckPhonePage(state) }
        "friday" -> SubPage(tr(R.string.jumuah_leaveFor, "friday" to Prayer.DHUHR.name(state.resolver.naming, true)), go) { FridayAlertPage(state) }
        else -> {
            val prayer = Prayer.entries.firstOrNull { it.raw == now }
            if (prayer == null) AlertsMainList(state, go)
            else SubPage(prayer.name(state.resolver.naming), go) { PrayerAlertPage(state, prayer) }
        }
    }
}

/** A page inside the sheet, with a way back to the list. */
@Composable
private fun SubPage(title: String, go: (String?) -> Unit, content: @Composable () -> Unit) {
    val back = tr(R.string.phone_alerts_back)
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(48.dp).clip(CircleShape).clickable { go(null) }
                    .semantics { contentDescription = back },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Palette.primary) }
            Text(title, style = Txt.title3, color = Palette.primary, modifier = Modifier.padding(start = 4.dp))
        }
        content()
    }
}

// MARK: - The main list

@Composable
private fun AlertsMainList(state: AppState, go: (String?) -> Unit) {
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        Text(tr(R.string.alerts_title), style = Txt.title3, color = Palette.primary, modifier = Modifier.padding(horizontal = 32.dp, vertical = 4.dp))
        CheckCard { go("check") }
        EachPrayerSection(state, go)
        NextAlarmSection(state)
        ExtrasSection(state)
        SoundSection(state)
        AlarmSoundSection(state)
        WakeHadith()
    }
}

@Composable
private fun CheckCard(open: () -> Unit) {
    Column(
        Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth()
            .clip(RoundedCornerShape(14.dp)).background(Palette.sunArc.copy(alpha = 0.14f))
            .clickable(onClick = open).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.NotificationsActive, null, Modifier.size(18.dp), tint = Palette.primary)
            Text(tr(R.string.phone_alerts_silentTitle), style = Txt.subheadlineSemibold, color = Palette.primary)
        }
        Text(tr(R.string.phone_alerts_silentSub), style = Txt.footnote, color = Palette.secondary)
        Text(tr(R.string.alerts_checkPhone), style = Txt.footnoteSemibold, color = Color.Black,
            modifier = Modifier.clip(CircleShape).background(Palette.sunArc).padding(horizontal = 12.dp, vertical = 6.dp))
    }
}

/** What a prayer is set to, in a few words, under its name. */
@Composable
private fun alertSummary(state: AppState, prayer: Prayer): String {
    val p = state.prefs
    return when (p.alertMode(prayer)) {
        AlertMode.OFF -> tr(R.string.alerts_modeOff)
        AlertMode.NOTIFY -> if (p.reminderMinutesBefore > 0 && prayer != Prayer.SUNRISE)
            tr(R.string.phone_alerts_notifyBefore, "n" to p.reminderMinutesBefore) else tr(R.string.phone_alerts_notifyAtTime)
        AlertMode.ALARM -> {
            val label = if (prayer == Prayer.FAJR) p.wakeUp?.labelTr(state.resolver.naming) else p.alarm(prayer)?.labelTr()
            val text = label?.let { tr(R.string.alerts_alarmWhen, "when" to it.replaceFirstChar { c -> c.lowercase() }) } ?: tr(R.string.alerts_modeAlarm)
            if (p.notifies(prayer) && !p.alarmAtStart(prayer)) tr(R.string.phone_alerts_notifyToo, "text" to text) else text
        }
    }
}

@Composable
private fun fridaySummary(state: AppState): String {
    val p = state.prefs
    return when (p.fridayMode) {
        AlertMode.OFF -> tr(R.string.alerts_modeOff)
        AlertMode.NOTIFY -> tr(R.string.alerts_fridayNotify, "when" to jumuahLeaveLabel(p.jumuahReminderMinutes))
        AlertMode.ALARM -> tr(R.string.alerts_fridayAlarm, "when" to jumuahLeaveLabel(p.jumuahReminderMinutes))
    }
}

@Composable
private fun EachPrayerSection(state: AppState, go: (String?) -> Unit) {
    val r = state.resolver
    val p = state.prefs
    val offWord = tr(R.string.common_off)
    val minBefore = AlarmScheduler.REMINDER_CHOICES.map { tr(R.string.common_minBefore, "n" to it) to it }
    Section(tr(R.string.alerts_eachPrayer), tr(R.string.phone_alerts_eachFoot)) {
        Prayer.all.forEach { prayer ->
            ModeRow(prayer.name(r.naming), alertSummary(state, prayer), AlertMode.modes(prayer), p.alertMode(prayer),
                open = { go(prayer.raw) }) { state.setAlertMode(prayer, it) }
        }
        ModeRow(tr(R.string.jumuah_leaveFor, "friday" to Prayer.DHUHR.name(r.naming, true)), fridaySummary(state), AlertMode.entries, p.fridayMode,
            open = { go("friday") }) { state.setFridayMode(it) }
        PickerRow(tr(R.string.alerts_headsUp), if (p.reminderMinutesBefore > 0) tr(R.string.phone_alerts_minShort, "n" to p.reminderMinutesBefore) else offWord,
            listOf(offWord to 0) + minBefore, p.reminderMinutesBefore) { m ->
            if (m > 0) state.enableReminder(m) else state.update { it.copy(reminderMinutesBefore = 0) }
        }
    }
}

/** One prayer: its name and summary (opens its page), then Off, Notify, Alarm. */
@Composable
private fun ModeRow(name: String, summary: String, modes: List<AlertMode>, value: AlertMode, open: () -> Unit, pick: (AlertMode) -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(start = 16.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val opens = tr(R.string.alerts_openPage, "name" to name, "summary" to summary)
        Column(
            Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).clickable(onClick = open)
                .semantics { contentDescription = opens },
        ) {
            Text(name, style = Txt.body, color = Palette.primary)
            Text(summary, style = Txt.footnote, color = Palette.secondary)
        }
        SingleChoiceSegmentedButtonRow(Modifier.width(if (modes.size == 3) 210.dp else 140.dp)) {
            modes.forEachIndexed { i, mode ->
                val on = mode == value
                val word = mode.wordTr()
                SegmentedButton(on, { pick(mode) }, SegmentedButtonDefaults.itemShape(i, modes.size),
                    modifier = Modifier.semantics { contentDescription = "$name, $word" },
                    colors = SegmentedButtonDefaults.colors(
                        activeContainerColor = if (mode == AlertMode.ALARM) Palette.sunArc.copy(alpha = 0.45f) else Palette.primary.copy(alpha = 0.18f),
                        activeContentColor = Palette.primary,
                        inactiveContainerColor = Color.Transparent, inactiveContentColor = Palette.primary,
                        activeBorderColor = Palette.primary.copy(alpha = 0.2f), inactiveBorderColor = Palette.primary.copy(alpha = 0.2f)),
                    icon = {}) { Text(word, style = Txt.footnoteSemibold, maxLines = 1) }
            }
        }
    }
}

@Composable
private fun NextAlarmSection(state: AppState) {
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    val snoozed = remember(state.snoozeTick, state.now) { AlarmScheduler.hasSnooze(context) }
    val next = AlarmScheduler.nextWakeUp(r, state.now)
    Section(null, tr(R.string.phone_alerts_alarmFoot)) {
        if (snoozed) ChoiceRow(tr(R.string.phone_stopSnoozed), null, false) { state.stopRinging() }
        if (next != null) {
            val forPrayer = Prayer.entries.firstOrNull { next.id.endsWith("-${it.raw}-alarm") }
            val day = whenWords(state, next.at).replaceFirstChar { it.uppercase() }
            val time = r.formatted(next.at)
            val value = when {
                next.id.endsWith("sahur") -> tr(R.string.phone_alerts_nextAtSahur, "when" to day, "time" to time)
                forPrayer != null -> tr(R.string.phone_alerts_nextAtFor, "when" to day, "time" to time, "name" to r.prayerName(forPrayer, next.at))
                else -> tr(R.string.phone_alerts_nextAt, "when" to day, "time" to time)
            }
            com.prayertimesasia.app.ui.settings.ValueRow(tr(R.string.wake_next), value)
        } else {
            com.prayertimesasia.app.ui.settings.ValueRow(tr(R.string.wake_next), tr(R.string.wake_noneOn))
        }
        if (p.anyAlarm) ChoiceRow(tr(R.string.wake_allOff), null, false) { state.turnOffAllAlarms() }
    }
}

@Composable
private fun ExtrasSection(state: AppState) {
    val r = state.resolver
    val p = state.prefs
    Section(tr(R.string.alerts_extras)) {
        SwitchRow(tr(R.string.wake_sahur), p.sahurAlarm != null, sub = tr(R.string.wake_sahurSub)) { on ->
            if (on) state.setSahurAlarm(SahurTiming.entries.first()) else state.turnOffSahurAlarm()
        }
        if (p.sahurAlarm != null) {
            SahurTiming.entries.forEach { t ->
                ChoiceRow(t.labelTr(r.naming), timeSoon(state) { t.date(it) }, p.sahurAlarm == t) { state.setSahurAlarm(t) }
            }
        }
    }
    if (p.sahurAlarm != null) {
        Section(tr(R.string.wake_sahurOn), tr(R.string.wake_hijriNote)) {
            SahurDay.entries.forEach { d ->
                val everyDay = SahurDay.EVERY_DAY in p.sahurDays && d != SahurDay.EVERY_DAY
                SwitchRow(d.labelTr(), d in p.sahurDays || everyDay) { on ->
                    if (everyDay) return@SwitchRow
                    state.update {
                        val days = if (on) it.sahurDays + d else it.sahurDays - d
                        it.copy(sahurDays = days.ifEmpty { setOf(SahurDay.EVERY_DAY) })
                    }
                }
            }
        }
        Column(Modifier.padding(horizontal = 16.dp)) {
            HadithView(state, HadithId.MON_THU, line = true)
            HadithView(state, HadithId.WHITE_DAYS, line = true)
        }
    }
    Section(null) {
        SwitchRow(tr(R.string.settings_imsakAlert), p.imsakAlert, sub = tr(R.string.settings_imsakAlertSub)) { on -> state.setRamadanAlert(on) { q, v -> q.copy(imsakAlert = v) } }
        SwitchRow(tr(R.string.settings_berbukaAlert), p.berbukaAlert, sub = tr(R.string.phone_alerts_iftarSub, "name" to Prayer.MAGHRIB.name(r.naming))) { on -> state.setRamadanAlert(on) { q, v -> q.copy(berbukaAlert = v) } }
        SwitchRow(tr(R.string.phone_alerts_qiyam), p.qiyamAlert, sub = tr(R.string.phone_alerts_qiyamSub)) { on -> state.setRamadanAlert(on) { q, v -> q.copy(qiyamAlert = v) } }
        if (p.trackerEnabled) {
            SwitchRow(tr(R.string.settings_nudge), p.windowNudge, sub = tr(R.string.phone_alerts_nudgeSub)) { on ->
                state.update { it.copy(windowNudge = on) }
            }
        }
    }
}

@Composable
private fun SoundSection(state: AppState) {
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    Section(tr(R.string.alerts_sound), tr(R.string.phone_alerts_soundFoot)) {
        if (Azan.isAvailable(context)) {
            SwitchRow(tr(R.string.settings_azan), p.azanSound) { on -> state.update { it.copy(azanSound = on) } }
        }
        SwitchRow(tr(R.string.settings_buzzOnly), p.buzzOnly, sub = tr(R.string.alerts_buzzSub, "name" to Prayer.FAJR.name(r.naming))) { on -> state.update { it.copy(buzzOnly = on) } }
        SwitchRow(tr(R.string.settings_quietHours), p.quietHours) { on -> state.update { it.copy(quietHours = on) } }
        if (p.quietHours) {
            val halfHours = (0 until 1440 step 30).toList()
            PickerRow(tr(R.string.settings_from), r.clock(p.quietFrom), halfHours.map { r.clock(it) to it }, p.quietFrom) { m -> state.update { it.copy(quietFrom = m) } }
            PickerRow(tr(R.string.settings_until), r.clock(p.quietTo), halfHours.map { r.clock(it) to it }, p.quietTo) { m -> state.update { it.copy(quietTo = m) } }
        }
    }
}

@Composable
private fun WakeHadith() {
    Column(Modifier.padding(horizontal = 32.dp).padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا", style = Txt.title3.copy(textDirection = TextDirection.Rtl),
            color = Palette.primary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth())
        Text("“${tr(R.string.alerts_morningsHadith)}”", style = Txt.body.copy(fontStyle = FontStyle.Italic), color = Palette.primary)
        Text(tr(R.string.alerts_morningsSource), style = Txt.footnote, color = Palette.secondary)
    }
}

// MARK: - The big cards on a page

private fun AlertMode.icon(): ImageVector = when (this) {
    AlertMode.OFF -> Icons.Outlined.NotificationsOff
    AlertMode.NOTIFY -> Icons.Filled.Notifications
    AlertMode.ALARM -> Icons.Filled.Alarm
}

@Composable
private fun ModeCards(modes: List<AlertMode>, value: AlertMode, alarmHelp: String? = null, pick: (AlertMode) -> Unit) {
    modes.forEach { mode ->
        val on = mode == value
        Row(
            Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable { pick(mode) }.padding(horizontal = 16.dp, vertical = 12.dp)
                .semantics { role = Role.RadioButton; selected = on },
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(mode.icon(), null, Modifier.size(22.dp), tint = if (mode == AlertMode.ALARM) Palette.sunArc else Palette.primary)
            Column(Modifier.weight(1f)) {
                Text(mode.wordTr(), style = Txt.bodySemibold, color = Palette.primary)
                Text(if (mode == AlertMode.ALARM) alarmHelp ?: mode.helpTr() else mode.helpTr(), style = Txt.footnote, color = Palette.secondary)
            }
            Icon(Icons.Filled.CheckCircle, null, Modifier.size(22.dp), tint = if (on) Palette.sunArc else Color.Transparent)
        }
    }
}

// MARK: - One prayer's page

@Composable
private fun PrayerAlertPage(state: AppState, prayer: Prayer) {
    val r = state.resolver
    val p = state.prefs
    val name = prayer.name(r.naming)
    val mode = p.alertMode(prayer)
    val fajrHelp = tr(R.string.alerts_helpAlarmFajr, "name" to name)
    Section(tr(R.string.alerts_howReach, "name" to name)) {
        ModeCards(AlertMode.modes(prayer), mode,
            alarmHelp = if (prayer == Prayer.FAJR) fajrHelp else null) {
            state.setAlertMode(prayer, it)
        }
    }
    if (mode == AlertMode.ALARM && prayer == Prayer.FAJR) {
        Section(tr(R.string.alerts_when)) {
            WakeUpTiming.entries.forEach { t ->
                ChoiceRow(t.labelTr(r.naming), timeSoon(state) { t.date(it) }, p.wakeUp == t) { state.setWakeUp(t) }
            }
        }
    }
    if (mode == AlertMode.ALARM && prayer in PrayerAlarmTiming.prayers) {
        Section(tr(R.string.alerts_when)) {
            PrayerAlarmTiming.choices(prayer).forEach { t ->
                ChoiceRow(t.labelTr(), timeSoon(state) { t.date(it.time(prayer), PrayerAlarmTiming.end(prayer, it)) }, p.alarm(prayer) == t) {
                    state.setPrayerAlarm(prayer, t)
                }
            }
        }
    }
    if (mode == AlertMode.ALARM && !p.alarmAtStart(prayer)) {
        Section(null) {
            SwitchRow(tr(R.string.alerts_notifyToo), p.notifies(prayer), sub = tr(R.string.alerts_notifyTooSub, "name" to name)) { on ->
                state.update { it.withNotify(on, prayer) }
            }
        }
    }
    if (mode == AlertMode.NOTIFY && prayer != Prayer.SUNRISE) {
        val offWord = tr(R.string.common_off)
        val minBefore = AlarmScheduler.REMINDER_CHOICES.map { tr(R.string.common_minBefore, "n" to it) to it }
        Section(null, tr(R.string.alerts_headsUpSame)) {
            PickerRow(tr(R.string.alerts_headsUp), if (p.reminderMinutesBefore > 0) tr(R.string.common_minBefore, "n" to p.reminderMinutesBefore) else offWord,
                listOf(offWord to 0) + minBefore, p.reminderMinutesBefore) { m ->
                if (m > 0) state.enableReminder(m) else state.update { it.copy(reminderMinutesBefore = 0) }
            }
        }
    }
    if (prayer == Prayer.FAJR && p.wakeUp == WakeUpTiming.FAJR_MINUS_30) {
        Column(Modifier.padding(horizontal = 16.dp)) { HadithView(state, HadithId.NIGHT_PRAYER, line = true) }
    }
}

// MARK: - Friday

@Composable
private fun FridayAlertPage(state: AppState) {
    Section(tr(R.string.alerts_howReminder)) {
        ModeCards(AlertMode.entries, state.prefs.fridayMode) { state.setFridayMode(it) }
    }
    JumuahLeaveSection(state)
}

// MARK: - Check my phone

/** What this phone allows, read from its own settings, with a way to fix each one. Looks again every few seconds. */
@Composable
private fun CheckPhonePage(state: AppState) {
    val context = LocalContext.current
    var tick by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) { kotlinx.coroutines.delay(2000); tick++ }
    }
    val check = remember(tick) { PhoneCheck.read(context) }
    val p = state.prefs
    Section(tr(R.string.phone_check_notifications), tr(R.string.phone_check_notificationsFoot)) {
        CheckRow(
            if (check.notificationsAllowed) tr(R.string.phone_check_notifyOn) else tr(R.string.phone_check_notifyOff),
            if (check.notificationsAllowed) null else tr(R.string.phone_check_notifyOffSub),
            check.notificationsAllowed,
            if (check.notificationsAllowed) null else tr(R.string.common_turnOn) to { PhoneCheck.openNotificationSettings(context) },
        )
        CheckRow(
            if (check.silent) tr(R.string.phone_check_silent) else tr(R.string.phone_check_soundOn),
            if (check.silent) tr(R.string.phone_check_silentSub) else null,
            !check.silent,
            null,
        )
        CheckRow(
            if (check.doNotDisturb) tr(R.string.phone_check_dndOn) else tr(R.string.phone_check_dndOff),
            if (check.doNotDisturb) tr(R.string.phone_check_dndSub) else null,
            !check.doNotDisturb,
            if (check.doNotDisturb) tr(R.string.phone_check_allowApp) to { PhoneCheck.openNotificationSettings(context) } else null,
        )
    }
    Section(tr(R.string.settings_alarmsGroup), tr(R.string.phone_check_alarmsFoot)) {
        CheckRow(
            if (check.exactAlarms) tr(R.string.phone_check_exactOn) else tr(R.string.phone_check_exactOff),
            if (check.exactAlarms) null else tr(R.string.phone_check_exactOffSub),
            check.exactAlarms,
            if (check.exactAlarms) null else tr(R.string.qibla_allow) to { PhoneCheck.openExactAlarmSettings(context) },
        )
        CheckRow(
            if (check.batteryFree) tr(R.string.phone_check_batteryOn) else tr(R.string.phone_check_batteryOff),
            if (check.batteryFree) null else tr(R.string.phone_check_batteryOffSub),
            check.batteryFree,
            if (check.batteryFree) null else tr(R.string.phone_check_change) to { PhoneCheck.openBatterySettings(context) },
        )
    }
    if (p.fridayMode == AlertMode.NOTIFY) {
        val friday = Prayer.DHUHR.name(state.resolver.naming, true)
        Section(null, tr(R.string.phone_check_fridayNotify, "friday" to friday)) {
            ChoiceRow(tr(R.string.phone_check_makeAlarm, "friday" to friday), null, false) { state.setFridayMode(AlertMode.ALARM) }
        }
    }
    Text(tr(R.string.phone_check_tip),
        style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(horizontal = 32.dp, vertical = 12.dp))
}

@Composable
private fun CheckRow(title: String, detail: String?, ok: Boolean, fix: Pair<String, () -> Unit>?) {
    val status = if (ok) tr(R.string.common_ok) else tr(R.string.phone_check_needsLook)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = 16.dp, vertical = 10.dp)
            .semantics(mergeDescendants = true) { stateDescription = status },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(if (ok) Palette.success else Palette.sunArc))
        Column(Modifier.weight(1f)) {
            Text(title, style = Txt.body, color = Palette.primary)
            if (detail != null) Text(detail, style = Txt.footnote, color = Palette.secondary)
        }
        if (fix != null) {
            Text(fix.first, style = Txt.footnoteSemibold, color = Color.Black,
                modifier = Modifier.clip(CircleShape).background(Palette.sunArc).clickable(onClick = fix.second)
                    .padding(horizontal = 12.dp, vertical = 8.dp))
        }
    }
}

/** This phone's own settings that decide whether alerts and alarms are heard. */
private data class PhoneCheck(
    val notificationsAllowed: Boolean,
    val silent: Boolean,
    val doNotDisturb: Boolean,
    val exactAlarms: Boolean,
    val batteryFree: Boolean,
) {
    companion object {
        fun read(context: Context): PhoneCheck {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            return PhoneCheck(
                notificationsAllowed = nm.areNotificationsEnabled(),
                silent = audio.ringerMode != AudioManager.RINGER_MODE_NORMAL,
                doNotDisturb = nm.currentInterruptionFilter > NotificationManager.INTERRUPTION_FILTER_ALL,
                exactAlarms = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms(),
                batteryFree = power.isIgnoringBatteryOptimizations(context.packageName),
            )
        }

        fun openNotificationSettings(context: Context) = open(context,
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))

        fun openExactAlarmSettings(context: Context) {
            if (Build.VERSION.SDK_INT >= 31) open(context, Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")))
        }

        fun openBatterySettings(context: Context) = open(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))

        private fun open(context: Context, intent: Intent) {
            runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }
}
