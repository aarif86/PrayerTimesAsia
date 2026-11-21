package com.prayertimesasia.app.ui.today

import com.prayertimesasia.core.HadithId
import com.prayertimesasia.app.ui.components.HadithView
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.AlarmOn
import androidx.compose.material.icons.filled.Check
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.PlayCircleOutline
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.app.ui.settings.Section
import com.prayertimesasia.app.ui.settings.SwitchRow
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.alarms.Notifications
import com.prayertimesasia.core.AlarmSound
import com.prayertimesasia.core.JumuahLeave
import com.prayertimesasia.core.JumuahSession
import com.prayertimesasia.core.MasjidExtras
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerAlarmTiming
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.SahurDay
import com.prayertimesasia.core.SahurTiming
import com.prayertimesasia.core.WakeUpTiming
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.R

/** The alarm clock on the Prayer screen: shows the next alarm's time when one is set. */
@Composable
fun WakeChip(state: AppState, background: Color = Palette.primary.copy(alpha = 0.1f)) {
    val next = AlarmScheduler.nextWakeUp(state.resolver, state.now)
    // A 48 dp touch area around the smaller chip.
    Box(
        Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).clip(CircleShape)
            .clickable { state.openAlerts() }
            .semantics(mergeDescendants = true) { contentDescription = next?.let { "Alerts and alarms, next alarm at ${state.resolver.formatted(it.at)}" } ?: "Alerts and alarms" },
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier.sizeIn(minWidth = 34.dp, minHeight = 34.dp)
                .background(if (next == null) background else Palette.sunArc.copy(alpha = 0.3f), CircleShape)
                .padding(horizontal = if (next == null) 0.dp else 10.dp)
                .clearAndSetSemantics {},
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
        ) {
            Icon(if (next == null) Icons.Filled.Alarm else Icons.Filled.AlarmOn, null, Modifier.size(17.dp), tint = Palette.primary)
            if (next != null) {
                Text(state.resolver.formatted(next.at).removeSuffix(" AM").removeSuffix(" PM"),
                    style = Txt.subheadlineSemibold.copy(fontFeatureSettings = "tnum"), color = Palette.primary)
            }
        }
    }
}

/**
 * "Leave for Jumaat", its one home. Singapore also gets the first or second session.
 * Same as web ui/JumuahLeave.tsx and iOS JumuahLeaveSection.
 */
@Composable
internal fun JumuahLeaveSection(state: AppState) {
    val r = state.resolver
    val p = state.prefs
    val friday = Prayer.DHUHR.name(r.naming, true)
    val zohor = Prayer.DHUHR.name(r.naming)
    val sg = r.activePlace?.let { MasjidExtras.inSingapore(it.coordinates, it.countryCode) } == true
    val twoPM = JumuahLeave.SECOND_SESSION_FROM.split(":").mapNotNull { it.toIntOrNull() }
        .let { if (it.size == 2) r.clock(it[0] * 60 + it[1]) else JumuahLeave.SECOND_SESSION_FROM }
    val from = when {
        sg && p.jumuahSession == JumuahSession.SECOND -> twoPM
        r.myMasjidHere?.jumuah != null -> "your masjid's own $friday time"
        else -> "the start of $zohor"
    }
    val foot = "A reminder on Fridays to get ready and leave in time. It counts back from $from." +
        (if (sg) " Only some masjids in Singapore hold a second session. The Masjid tab shows which ones." else "") +
        " $friday is not required of women, travellers or the sick, who pray $zohor instead."
    val next = r.nextJumuahLeave(state.now)?.let { (leave, j) ->
        val day = if (r.dayKey(leave) == r.dayKey(state.now)) "Today" else "Friday"
        "$day ${r.formatted(leave)}, for $friday at ${r.formatted(j.at)}"
    }
    if (p.jumuahReminderMinutes <= 0) {
        Text(foot, style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(horizontal = 32.dp, vertical = 12.dp))
        return
    }
    Section("When", foot) {
        MenuRow("Remind me", next, JumuahLeave.label(p.jumuahReminderMinutes), true,
            JumuahLeave.CHOICES.filter { it > 0 }.map { JumuahLeave.label(it) to it }) { m -> state.update { it.copy(jumuahReminderMinutes = m) } }
        if (sg) {
            val label = { s: JumuahSession -> if (s == JumuahSession.FIRST) "First" else "Second" }
            MenuRow("Which session", "First at $zohor, second from $twoPM", label(p.jumuahSession), true,
                JumuahSession.entries.map { label(it) to it }) { v -> state.update { it.copy(jumuahSession = v) } }
        }
    }
}

/** A row with a drop down menu of choices, like the prayer alarm rows. */
@Composable
internal fun <T> MenuRow(label: String, sub: String?, value: String, on: Boolean, options: List<Pair<String, T>>, onPick: (T) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 52.dp).clickable { open = true }.padding(horizontal = 16.dp, vertical = 10.dp)
                .semantics { contentDescription = "$label, $value" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(label, style = Txt.body, color = Palette.primary)
                if (sub != null) Text(sub, style = Txt.footnote.copy(fontFeatureSettings = "tnum"), color = Palette.secondary)
            }
            Text(value, style = Txt.body, color = if (on) Palette.sunArc else Palette.secondary)
            Icon(Icons.Filled.ArrowDropDown, null, Modifier.size(20.dp), tint = Palette.secondary)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (name, v) -> DropdownMenuItem(text = { Text(name) }, onClick = { open = false; onPick(v) }) }
        }
    }
}

/** One prayer's alarm as a menu: Off, on time, minutes after, or before it ends. */
@Composable
internal fun PrayerAlarmRow(state: AppState, prayer: Prayer) {
    val r = state.resolver
    val name = prayer.name(r.naming)
    val current = state.prefs.alarm(prayer)
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 52.dp).clickable { open = true }.padding(horizontal = 16.dp, vertical = 10.dp)
                .semantics { contentDescription = "$name alarm, ${current?.label ?: "Off"}" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(name, style = Txt.body, color = Palette.primary)
                if (current != null) {
                    timeSoon(state) { current.date(it.time(prayer), PrayerAlarmTiming.end(prayer, it)) }?.let {
                        Text(it, style = Txt.footnote.copy(fontFeatureSettings = "tnum"), color = Palette.secondary)
                    }
                }
            }
            Text(current?.label ?: "Off", style = Txt.body, color = if (current != null) Palette.sunArc else Palette.secondary)
            Icon(Icons.Filled.ArrowDropDown, null, Modifier.size(20.dp), tint = Palette.secondary)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text(tr(R.string.common_off)) }, onClick = { open = false; state.setPrayerAlarm(prayer, null) })
            PrayerAlarmTiming.choices(prayer).forEach { t ->
                DropdownMenuItem(text = { Text(t.label) }, onClick = { open = false; state.setPrayerAlarm(prayer, t) })
            }
        }
    }
}

/** The sound every alarm plays, each heard for a few seconds when tapped, or a ringtone from the phone. */
@Composable
internal fun AlarmSoundSection(state: AppState) {
    val context = LocalContext.current
    val p = state.prefs
    val preview = remember { AlarmPreview() }
    DisposableEffect(Unit) { onDispose { preview.stop() } }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        @Suppress("DEPRECATION")
        val uri = result.data?.getParcelableExtra<android.net.Uri>(android.media.RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
        if (uri != null) state.update { it.copy(alarmSound = AlarmSound.PHONE, alarmRingtone = uri.toString()) }
    }
    val ringtoneName = p.alarmRingtone?.let { raw ->
        runCatching { android.media.RingtoneManager.getRingtone(context, android.net.Uri.parse(raw))?.getTitle(context) }.getOrNull()
    }
    Section(tr(R.string.wake_sound), tr(R.string.wake_soundHelp)) {
        listOf(AlarmSound.CLASSIC, AlarmSound.CHIME, AlarmSound.BELLS, AlarmSound.BEEPS).forEach { sound ->
            SoundRow(sound.label, null, p.alarmSound == sound) {
                state.update { it.copy(alarmSound = sound) }
                preview.play(context, Notifications.alarmUri(context, sound, null))
            }
        }
        SoundRow(AlarmSound.PHONE.label, ringtoneName ?: "Pick a ringtone", p.alarmSound == AlarmSound.PHONE) {
            val intent = android.content.Intent(android.media.RingtoneManager.ACTION_RINGTONE_PICKER)
                .putExtra(android.media.RingtoneManager.EXTRA_RINGTONE_TYPE, android.media.RingtoneManager.TYPE_ALARM or android.media.RingtoneManager.TYPE_RINGTONE)
                .putExtra(android.media.RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                .putExtra(android.media.RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                .putExtra(android.media.RingtoneManager.EXTRA_RINGTONE_TITLE, "Alarm sound")
            p.alarmRingtone?.let { intent.putExtra(android.media.RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, android.net.Uri.parse(it)) }
            preview.stop()
            runCatching { picker.launch(intent) }
        }
    }
}

@Composable
internal fun SoundRow(label: String, detail: String?, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp)
            .semantics { contentDescription = "$label${if (selected) ", selected" else ""}, tap to hear it" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Filled.PlayCircleOutline, null, Modifier.size(20.dp), tint = Palette.secondary)
        Column(Modifier.weight(1f)) {
            Text(label, style = Txt.body, color = Palette.primary)
            if (detail != null) Text(detail, style = Txt.footnote, color = Palette.secondary)
        }
        Icon(Icons.Filled.Check, null, Modifier.size(20.dp), tint = if (selected) Palette.sunArc else Color.Transparent)
    }
}

/** A few seconds of an alarm sound, played as an alarm so it is heard on silent too. */
internal class AlarmPreview {
    private var ringtone: android.media.Ringtone? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    fun play(context: android.content.Context, uri: android.net.Uri?) {
        stop()
        uri ?: return
        val r = runCatching { android.media.RingtoneManager.getRingtone(context, uri) }.getOrNull() ?: return
        r.audioAttributes = android.media.AudioAttributes.Builder()
            .setUsage(android.media.AudioAttributes.USAGE_ALARM)
            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        runCatching { r.play() }
        ringtone = r
        handler.postDelayed({ if (ringtone === r) stop() }, 5000)
    }

    fun stop() {
        handler.removeCallbacksAndMessages(null)
        runCatching { ringtone?.stop() }
        ringtone = null
    }
}

@Composable
internal fun ChoiceRow(label: String, detail: String?, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp)
            .semantics { if (selected) contentDescription = "$label, selected" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(label, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
        if (detail != null) Text(detail, style = Txt.body.copy(fontFeatureSettings = "tnum"), color = Palette.secondary)
        Icon(Icons.Filled.Check, null, Modifier.size(20.dp), tint = if (selected) Palette.sunArc else Color.Transparent)
    }
}

/** When this choice would next ring (this morning if it is still ahead, else tomorrow). */
internal fun timeSoon(state: AppState, at: (PrayerDay) -> Instant): String? =
    nextSoon(state, at)?.let { state.resolver.formatted(it) }

/** The same, as an instant: today if it is still ahead, else tomorrow. */
internal fun nextSoon(state: AppState, at: (PrayerDay) -> Instant): Instant? {
    for (offset in 0..1) {
        val day = state.resolver.day(state.now, offset) ?: continue
        val t = at(day)
        if (t > state.now) return t
    }
    return null
}

internal fun whenText(state: AppState, at: Instant): String {
    val zone = state.resolver.zone
    val day = at.atZone(zone).toLocalDate()
    val today = state.now.atZone(zone).toLocalDate()
    return when (day) {
        today -> "today"
        today.plusDays(1) -> "tomorrow"
        else -> day.format(DateTimeFormatter.ofPattern("EEEE", Locale.ENGLISH))
    }
}
