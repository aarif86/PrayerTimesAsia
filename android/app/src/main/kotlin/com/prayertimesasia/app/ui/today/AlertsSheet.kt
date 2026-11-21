package com.prayertimesasia.app.ui.today

import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontWeight
import com.prayertimesasia.core.BlessedTime
import com.prayertimesasia.core.PrayerDay
import java.time.Instant
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
import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.app.alarms.Azan
import com.prayertimesasia.app.ui.components.HadithView
import com.prayertimesasia.app.ui.settings.PickerRow
import com.prayertimesasia.app.ui.settings.Section
import com.prayertimesasia.app.ui.settings.SwitchRow
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.AlertMode
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.core.JumuahLeave
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
        "check" -> SubPage("Check my phone", go) { CheckPhonePage(state) }
        "friday" -> SubPage("Leave for ${Prayer.DHUHR.name(state.resolver.naming, true)}", go) { FridayAlertPage(state) }
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
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(48.dp).clip(CircleShape).clickable { go(null) }
                    .semantics { contentDescription = "Back to Alerts and alarms" },
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
    // A prayer just switched to Alarm here: a short line says when it rings, with Change time.
    var justSet by remember { mutableStateOf<Prayer?>(null) }
    Box(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
            Text("Alerts and alarms", style = Txt.title3, color = Palette.primary, modifier = Modifier.padding(horizontal = 32.dp, vertical = 4.dp))
            CheckCard { go("check") }
            EachPrayerSection(state, go) { justSet = it }
            NextAlarmSection(state)
            ExtrasSection(state)
            SoundSection(state)
            AlarmSoundSection(state)
            WakeHadith()
        }
        val prayer = justSet
        val at = prayer?.let { alertNext(state, it) }
        if (prayer != null && at != null) {
            LaunchedEffect(prayer) { kotlinx.coroutines.delay(6000); justSet = null }
            Row(
                Modifier.align(Alignment.BottomCenter).padding(16.dp).fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp)).background(Palette.materialStrong).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(Icons.Filled.Alarm, null, Modifier.size(18.dp), tint = Palette.sunArc)
                Text("${prayer.name(state.resolver.naming)} alarm set for ${state.resolver.formatted(at)}",
                    style = Txt.subheadlineSemibold, color = Palette.primary, modifier = Modifier.weight(1f))
                Text("Change time", style = Txt.footnoteSemibold, color = Palette.sunArc,
                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { justSet = null; go(prayer.raw) }.padding(8.dp))
            }
        }
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
            Text("On silent or Do Not Disturb, only alarms ring", style = Txt.subheadlineSemibold, color = Palette.primary)
        }
        Text("Notifications stay quiet then. Set a prayer to Alarm if you need to hear it.", style = Txt.footnote, color = Palette.secondary)
        Text("Check my phone", style = Txt.footnoteSemibold, color = Color.Black,
            modifier = Modifier.clip(CircleShape).background(Palette.sunArc).padding(horizontal = 12.dp, vertical = 6.dp))
    }
}

/** When a prayer's alert next comes: the alarm's own time, or the prayer's start for Notify. */
private fun alertNext(state: AppState, prayer: Prayer): Instant? {
    val p = state.prefs
    return when (p.alertMode(prayer)) {
        AlertMode.OFF -> null
        AlertMode.NOTIFY -> nextSoon(state) { it.time(prayer) }
        AlertMode.ALARM -> if (prayer == Prayer.FAJR) p.wakeUp?.let { w -> nextSoon(state) { w.date(it) } }
            else p.alarm(prayer)?.let { t -> nextSoon(state) { t.date(it.time(prayer), PrayerAlarmTiming.end(prayer, it)) } }
    }
}

/** The bar under a prayer that is on: "Alarm 6:20 AM" in bold, then what it is. */
private fun alertChip(state: AppState, prayer: Prayer, azanOn: Boolean): Pair<String, String> {
    val p = state.prefs
    val r = state.resolver
    val at = alertNext(state, prayer)?.let { " ${r.formatted(it)}" } ?: ""
    return when (p.alertMode(prayer)) {
        AlertMode.OFF -> "Off" to ""
        AlertMode.NOTIFY -> {
            if (prayer == Prayer.SUNRISE) "Notification$at" to "when ${Prayer.FAJR.name(r.naming)} ends"
            else {
                val parts = buildList {
                    if (azanOn && p.azanSound) add("with the azan")
                    if (p.reminderMinutesBefore > 0) add("early reminder ${p.reminderMinutesBefore} min before")
                }
                "Notification$at" to (if (parts.isEmpty()) "when it begins" else parts.joinToString(", "))
            }
        }
        AlertMode.ALARM -> {
            val label = (if (prayer == Prayer.FAJR) p.wakeUp?.label(r.naming) else p.alarm(prayer)?.label) ?: ""
            var rest = label.replaceFirstChar { it.lowercase() }
            if (p.notifies(prayer) && !p.alarmAtStart(prayer)) rest += ", notification at the time"
            "Alarm$at" to rest
        }
    }
}

@Composable
private fun EachPrayerSection(state: AppState, go: (String?) -> Unit, alarmSet: (Prayer?) -> Unit) {
    val r = state.resolver
    val p = state.prefs
    val azanOn = Azan.isAvailable(LocalContext.current)
    Section("Each prayer", "Pick Off, Notify or Alarm. Tap Change to choose the exact time. Notify is a notification, quiet when your phone is on silent or Do Not Disturb. Alarm rings until you stop it, even on silent.") {
        Prayer.all.forEach { prayer ->
            val (lead, rest) = alertChip(state, prayer, azanOn)
            ModeRow(prayer.name(r.naming), lead, rest, AlertMode.modes(prayer), p.alertMode(prayer),
                open = { go(prayer.raw) }) { new ->
                val was = state.prefs.alertMode(prayer)
                state.setAlertMode(prayer, new)
                alarmSet(if (new == AlertMode.ALARM && was != AlertMode.ALARM) prayer else null)
            }
        }
        val friday = p.fridayMode
        ModeRow("Leave for ${Prayer.DHUHR.name(r.naming, true)}",
            when (friday) { AlertMode.OFF -> "Off"; AlertMode.ALARM -> "Alarm"; AlertMode.NOTIFY -> "Notification" },
            "${JumuahLeave.label(p.jumuahReminderMinutes).lowercase()} it starts", AlertMode.entries, friday,
            open = { go("friday") }) { state.setFridayMode(it) }
        PickerRow("Early reminder", if (p.reminderMinutesBefore > 0) "${p.reminderMinutesBefore} min" else "Off",
            listOf("Off" to 0) + AlarmScheduler.REMINDER_CHOICES.map { "$it min before" to it }, p.reminderMinutesBefore) { m ->
            if (m > 0) state.enableReminder(m) else state.update { it.copy(reminderMinutesBefore = 0) }
        }
    }
}

/** One prayer: its name, then Off, Notify, Alarm. When it is on, a bar under it shows the time and Change. */
@Composable
private fun ModeRow(name: String, lead: String, rest: String, modes: List<AlertMode>, value: AlertMode, open: () -> Unit, pick: (AlertMode) -> Unit) {
  Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 6.dp, bottom = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 44.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(name, style = Txt.body, color = Palette.primary)
            if (value == AlertMode.OFF) Text("Off", style = Txt.footnote, color = Palette.secondary)
        }
        SingleChoiceSegmentedButtonRow(Modifier.width(if (modes.size == 3) 210.dp else 140.dp)) {
            modes.forEachIndexed { i, mode ->
                val on = mode == value
                SegmentedButton(on, { pick(mode) }, SegmentedButtonDefaults.itemShape(i, modes.size),
                    modifier = Modifier.semantics { contentDescription = "$name, ${mode.word}" },
                    colors = SegmentedButtonDefaults.colors(
                        activeContainerColor = if (mode == AlertMode.ALARM) Palette.sunArc.copy(alpha = 0.45f) else Palette.primary.copy(alpha = 0.18f),
                        activeContentColor = Palette.primary,
                        inactiveContainerColor = Color.Transparent, inactiveContentColor = Palette.primary,
                        activeBorderColor = Palette.primary.copy(alpha = 0.2f), inactiveBorderColor = Palette.primary.copy(alpha = 0.2f)),
                    icon = {}) { Text(mode.word, style = Txt.footnoteSemibold, maxLines = 1) }
            }
        }
    }
    if (value != AlertMode.OFF) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp))
                .background(Palette.primary.copy(alpha = 0.08f)).clickable(onClick = open)
                .padding(horizontal = 10.dp, vertical = 8.dp)
                .semantics(mergeDescendants = true) { contentDescription = "$name, $lead, $rest. Change the time" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(value.icon(), null, Modifier.size(16.dp), tint = if (value == AlertMode.ALARM) Palette.sunArc else Palette.primary)
            Text(buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(lead) }
                if (rest.isNotEmpty()) append(", $rest")
            }, style = Txt.footnote, color = Palette.primary, modifier = Modifier.weight(1f))
            Text("Change ›", style = Txt.footnoteSemibold, color = Palette.sunArc)
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
    Section(null, "An alarm rings like the Clock app, even when the phone is on silent, until you tap I'm up. Snooze 5 min rings it once more in 5 minutes.") {
        if (snoozed) ChoiceRow("Stop the snoozed alarm", null, false) { state.stopRinging() }
        if (next != null) {
            val forPrayer = Prayer.entries.firstOrNull { next.id.endsWith("-${it.raw}-alarm") }
            val what = when {
                next.id.endsWith("sahur") -> " for sahur"
                forPrayer != null -> " for ${r.prayerName(forPrayer, next.at)}"
                else -> ""
            }
            val day = whenText(state, next.at).replaceFirstChar { it.uppercase() }
            com.prayertimesasia.app.ui.settings.ValueRow("Next alarm", "$day ${r.formatted(next.at)}$what")
        } else {
            com.prayertimesasia.app.ui.settings.ValueRow("Next alarm", "No alarms are on")
        }
        if (p.anyAlarm) ChoiceRow("Turn off all alarms", null, false) { state.turnOffAllAlarms() }
    }
}

@Composable
private fun ExtrasSection(state: AppState) {
    val r = state.resolver
    val p = state.prefs
    Section("Fasting") {
        SwitchRow("Sahur alarm", p.sahurAlarm != null, sub = "An alarm before ${Prayer.FAJR.name(r.naming)} so you can eat before you fast. You choose the time and the days. Rings even on silent.") { on ->
            if (on) state.setSahurAlarm(SahurTiming.entries.first()) else state.turnOffSahurAlarm()
        }
        if (p.sahurAlarm != null) {
            SahurTiming.entries.forEach { t ->
                ChoiceRow(t.label(r.naming), timeSoon(state) { t.date(it) }, p.sahurAlarm == t) { state.setSahurAlarm(t) }
            }
        }
    }
    if (p.sahurAlarm != null) {
        Section("Sahur alarm rings on", "Ramadan and the white days follow the Hijri date in the app. Please follow your local religious authority for the start of Ramadan.") {
            SahurDay.entries.forEach { d ->
                val everyDay = SahurDay.EVERY_DAY in p.sahurDays && d != SahurDay.EVERY_DAY
                SwitchRow(d.label, d in p.sahurDays || everyDay) { on ->
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
    fun about(at: (PrayerDay) -> Instant) = timeSoon(state, at)?.let { " About $it here." } ?: ""
    val lastThird = about { day -> r.blessedTimes(day).firstOrNull { it.first == BlessedTime.LAST_THIRD }?.second ?: Instant.EPOCH }
    Section("Ramadan only", "These are notifications, so they stay quiet on silent. Ramadan follows the date in the app. Please follow your local religious authority.") {
        SwitchRow("Imsak reminder", p.imsakAlert, sub = "A notification 10 minutes before Imsak, so you finish eating in time.${about { r.imsak(it).minusSeconds(600) }}") { on -> state.setRamadanAlert(on) { q, v -> q.copy(imsakAlert = v) } }
        SwitchRow("Iftar reminder", p.berbukaAlert, sub = "A notification at ${Prayer.MAGHRIB.name(r.naming)} when it is time to break your fast.${about { it.time(Prayer.MAGHRIB) }}") { on -> state.setRamadanAlert(on) { q, v -> q.copy(berbukaAlert = v) } }
        SwitchRow("Qiyam reminder, last ten nights", p.qiyamAlert, sub = "On the last ten nights of Ramadan, a notification when the last third of the night begins, the best time for qiyam.$lastThird") { on -> state.setRamadanAlert(on) { q, v -> q.copy(qiyamAlert = v) } }
    }
    if (p.trackerEnabled) {
        Section(null) {
            SwitchRow("Nudge before time runs out", p.windowNudge, sub = "A notification about 30 minutes before a prayer's time ends, only if you have not ticked it in your tracker") { on ->
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
    Section("Sound", "Buzz only and Quiet hours are for shift workers sleeping in the day, a baby asleep in the room, or a calm night. Notifications only buzz then. Alarms keep their sound.") {
        if (Azan.isAvailable(context)) {
            SwitchRow("Play the azan", p.azanSound, sub = "Prayer notifications play the azan instead of a short tone") { on -> state.update { it.copy(azanSound = on) } }
        }
        SwitchRow("Buzz only", p.buzzOnly, sub = "Notifications vibrate without sound, all day. Alarms still ring.") { on -> state.update { it.copy(buzzOnly = on) } }
        SwitchRow("Quiet hours", p.quietHours, sub = "Between the times you pick, notifications only vibrate. ${Prayer.FAJR.name(r.naming)} and alarms keep their sound.") { on -> state.update { it.copy(quietHours = on) } }
        if (p.quietHours) {
            val halfHours = (0 until 1440 step 30).toList()
            PickerRow("From", r.clock(p.quietFrom), halfHours.map { r.clock(it) to it }, p.quietFrom) { m -> state.update { it.copy(quietFrom = m) } }
            PickerRow("Until", r.clock(p.quietTo), halfHours.map { r.clock(it) to it }, p.quietTo) { m -> state.update { it.copy(quietTo = m) } }
        }
    }
}

@Composable
private fun WakeHadith() {
    Column(Modifier.padding(horizontal = 32.dp).padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا", style = Txt.title3.copy(textDirection = TextDirection.Rtl),
            color = Palette.primary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth())
        Text("“O Allah, bless my ummah in their early mornings.”", style = Txt.body.copy(fontStyle = FontStyle.Italic), color = Palette.primary)
        Text("The Prophet ﷺ, narrated by Abu Dawud and Tirmidhi", style = Txt.footnote, color = Palette.secondary)
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
                Text(mode.word, style = Txt.bodySemibold, color = Palette.primary)
                Text(if (mode == AlertMode.ALARM) alarmHelp ?: mode.help else mode.help, style = Txt.footnote, color = Palette.secondary)
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
    val next = alertNext(state, prayer)
    if (mode != AlertMode.OFF && next != null) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp))
                .background(Palette.primary.copy(alpha = 0.08f)).padding(16.dp)
                .semantics(mergeDescendants = true) {},
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(mode.icon(), null, Modifier.size(30.dp), tint = if (mode == AlertMode.ALARM) Palette.sunArc else Palette.primary)
            Column {
                Text(r.formatted(next), style = Txt.title2, color = Palette.primary)
                Text("Your $name ${if (mode == AlertMode.ALARM) "alarm rings" else "notification comes"} ${whenText(state, next)} at this time",
                    style = Txt.footnote, color = Palette.secondary)
            }
        }
    }
    Section("How should $name reach you?") {
        ModeCards(AlertMode.modes(prayer), mode,
            alarmHelp = if (prayer == Prayer.FAJR) "Rings like the Clock app, even on silent, every morning. It follows $name wherever you are. Snooze 5 min." else null) {
            state.setAlertMode(prayer, it)
        }
    }
    if (mode == AlertMode.ALARM && prayer == Prayer.FAJR) {
        Section("When should the alarm ring?", "The time moves a little each day with $name.") {
            WakeUpTiming.entries.forEach { t ->
                ChoiceRow(t.label(r.naming), timeSoon(state) { t.date(it) }, p.wakeUp == t) { state.setWakeUp(t) }
            }
        }
    }
    if (mode == AlertMode.ALARM && prayer in PrayerAlarmTiming.prayers) {
        Section("When should the alarm ring?") {
            PrayerAlarmTiming.choices(prayer).forEach { t ->
                ChoiceRow(t.label, timeSoon(state) { t.date(it.time(prayer), PrayerAlarmTiming.end(prayer, it)) }, p.alarm(prayer) == t) {
                    state.setPrayerAlarm(prayer, t)
                }
            }
        }
    }
    if (mode == AlertMode.ALARM && !p.alarmAtStart(prayer)) {
        Section(null) {
            SwitchRow("Notification too", p.notifies(prayer), sub = "A notification when $name begins, as well as the alarm") { on ->
                state.update { it.withNotify(on, prayer) }
            }
        }
    }
    if (mode == AlertMode.NOTIFY && prayer != Prayer.SUNRISE) {
        Section(null, "The same for every prayer set to Notify.") {
            PickerRow("Early reminder", if (p.reminderMinutesBefore > 0) "${p.reminderMinutesBefore} min before" else "Off",
                listOf("Off" to 0) + AlarmScheduler.REMINDER_CHOICES.map { "$it min before" to it }, p.reminderMinutesBefore) { m ->
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
    Section("How should the reminder reach you?") {
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
    Section("Notifications", "Notify uses these. They follow your phone's sound settings.") {
        CheckRow(
            if (check.notificationsAllowed) "Notifications are allowed" else "Notifications are turned off for this app",
            if (check.notificationsAllowed) null else "Nothing will reach you until they are on.",
            check.notificationsAllowed,
            if (check.notificationsAllowed) null else "Turn on" to { PhoneCheck.openNotificationSettings(context) },
        )
        CheckRow(
            when {
                check.silent -> "Your phone is on silent or vibrate"
                else -> "Your phone's sound is on"
            },
            if (check.silent) "Notifications only buzz now. Alarms still ring." else null,
            !check.silent,
            null,
        )
        CheckRow(
            if (check.doNotDisturb) "Do Not Disturb is on" else "Do Not Disturb is off",
            if (check.doNotDisturb) "Notifications wait until it ends, unless you allow this app in Do Not Disturb. Alarms still ring." else null,
            !check.doNotDisturb,
            if (check.doNotDisturb) "Allow this app" to { PhoneCheck.openNotificationSettings(context) } else null,
        )
    }
    Section("Alarms", "Alarm uses these. An alarm rings like the Clock app, through silent and Do Not Disturb.") {
        CheckRow(
            if (check.exactAlarms) "Alarms ring at the exact minute" else "Alarms and reminders are not allowed",
            if (check.exactAlarms) null else "Without this, alarms and alerts can come a few minutes late.",
            check.exactAlarms,
            if (check.exactAlarms) null else "Allow" to { PhoneCheck.openExactAlarmSettings(context) },
        )
        CheckRow(
            if (check.batteryFree) "Battery saver leaves the app alone" else "Battery saver may hold alerts back",
            if (check.batteryFree) null else "Some phones put apps to sleep. Let this app run in the background so alerts come on time.",
            check.batteryFree,
            if (check.batteryFree) null else "Change" to { PhoneCheck.openBatterySettings(context) },
        )
    }
    if (p.fridayMode == AlertMode.NOTIFY) {
        Section(null, "Your ${Prayer.DHUHR.name(state.resolver.naming, true)} reminder is a notification, so it stays quiet on silent.") {
            ChoiceRow("Make the ${Prayer.DHUHR.name(state.resolver.naming, true)} reminder an alarm", null, false) { state.setFridayMode(AlertMode.ALARM) }
        }
    }
    Text("Tip. If you keep your phone on silent at work or in the masjid, set the prayers you must not miss to Alarm.",
        style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(horizontal = 32.dp, vertical = 12.dp))
}

@Composable
private fun CheckRow(title: String, detail: String?, ok: Boolean, fix: Pair<String, () -> Unit>?) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = 16.dp, vertical = 10.dp)
            .semantics(mergeDescendants = true) { stateDescription = if (ok) "OK" else "Needs a look" },
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
