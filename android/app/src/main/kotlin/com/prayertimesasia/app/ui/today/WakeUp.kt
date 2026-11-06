package com.prayertimesasia.app.ui.today

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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.SahurDay
import com.prayertimesasia.core.SahurTiming
import com.prayertimesasia.core.WakeUpTiming
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

/** The alarm clock on the Prayer screen: shows the next alarm's time when one is set. */
@Composable
fun WakeChip(state: AppState, background: Color = Palette.primary.copy(alpha = 0.1f)) {
    val next = AlarmScheduler.nextWakeUp(state.resolver, state.now)
    val fajr = Prayer.FAJR.name(state.resolver.naming)
    Row(
        Modifier.sizeIn(minWidth = 34.dp, minHeight = 34.dp).clip(CircleShape)
            .background(if (next == null) background else Palette.sunArc.copy(alpha = 0.3f), CircleShape)
            .clickable { state.showWakeUp = true }
            .padding(horizontal = if (next == null) 0.dp else 10.dp)
            .semantics { contentDescription = next?.let { "Wake up alarm at ${state.resolver.formatted(it.at)}" } ?: "Wake up for $fajr: set an alarm" },
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

/** Wake up for Subuh: the Subuh alarm and the earlier sahur alarm. "Allahumma barik li ummati fi bukuriha" (Abu Dawud, Tirmidhi). */
@Composable
fun WakeUpSheetContent(state: AppState) {
    val r = state.resolver
    val p = state.prefs
    val fajr = Prayer.FAJR.name(r.naming)
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        Column(Modifier.padding(horizontal = 32.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Wake up for $fajr", style = Txt.title3, color = Palette.primary)
            Text("اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا", style = Txt.title3.copy(textDirection = TextDirection.Rtl),
                color = Palette.primary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth())
            Text("“O Allah, bless my ummah in their early mornings.”", style = Txt.body.copy(fontStyle = FontStyle.Italic), color = Palette.primary)
            Text("The Prophet ﷺ, narrated by Abu Dawud and Tirmidhi", style = Txt.footnote, color = Palette.secondary)
            AlarmScheduler.nextWakeUp(r, state.now)?.let { next ->
                Text("Next alarm ${whenText(state, next.at)} ${r.formatted(next.at)}${if (next.id.endsWith("sahur")) " for sahur" else ""}",
                    style = Txt.subheadlineSemibold, color = Palette.sunArc, modifier = Modifier.padding(top = 4.dp))
            }
        }

        Section("$fajr alarm", "Rings every morning and moves with $fajr wherever you are.") {
            ChoiceRow("Off", null, p.wakeUp == null) { state.update { it.copy(wakeUp = null) } }
            WakeUpTiming.entries.forEach { t ->
                ChoiceRow(t.label(r.naming), timeSoon(state) { t.date(it) }, p.wakeUp == t) { state.setWakeUp(t) }
            }
        }

        Section("Sahur alarm", "An earlier alarm to eat sahur before a fast, or for a longer night prayer.") {
            ChoiceRow("Off", null, p.sahurAlarm == null) { state.update { it.copy(sahurAlarm = null) } }
            SahurTiming.entries.forEach { t ->
                ChoiceRow(t.label(r.naming), timeSoon(state) { t.date(it) }, p.sahurAlarm == t) { state.setSahurAlarm(t) }
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
        }

        Text("Rings like an alarm, even when the phone is on silent, and keeps ringing until you tap I'm up. " +
            "If it stays quiet, allow Alarms and reminders for this app in your phone's settings.",
            style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(horizontal = 32.dp, vertical = 16.dp))
    }
}

@Composable
private fun ChoiceRow(label: String, detail: String?, selected: Boolean, onClick: () -> Unit) {
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
private fun timeSoon(state: AppState, at: (PrayerDay) -> Instant): String? {
    for (offset in 0..1) {
        val day = state.resolver.day(state.now, offset) ?: continue
        val t = at(day)
        if (t > state.now) return state.resolver.formatted(t)
    }
    return null
}

private fun whenText(state: AppState, at: Instant): String {
    val zone = state.resolver.zone
    val day = at.atZone(zone).toLocalDate()
    val today = state.now.atZone(zone).toLocalDate()
    return when (day) {
        today -> "today"
        today.plusDays(1) -> "tomorrow"
        else -> day.format(DateTimeFormatter.ofPattern("EEEE", Locale.ENGLISH))
    }
}
