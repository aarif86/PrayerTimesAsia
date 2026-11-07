package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.HourglassBottom
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.app.ui.theme.textTint
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.TimeFormat
import com.prayertimesasia.core.secondsSince
import java.time.Instant

/**
 * "Zohor is open until 4:08 PM · 2h 33m left". Busy people ask how long they
 * still have, not only when the next prayer starts. Nothing between sunrise
 * and Zohor, when no prayer is due. Same wording as the web and iPhone.
 */
class TimeLeftText(val line: String, val left: String?, val urgent: Boolean, val done: Boolean) {
    companion object {
        fun of(state: AppState, now: Instant): TimeLeftText? {
            val r = state.resolver
            val w = r.window(now) ?: return null
            val name = r.prayerName(w.prayer, w.start)
            val done = state.prefs.trackerEnabled && r.isPrayed(w.prayer, w.start)
            val left = "${TimeFormat.short(w.end.secondsSince(now))} left"
            return when {
                done -> TimeLeftText("$name prayed. Alhamdulillah.", null, false, true)
                w.prayer == Prayer.ISHA ->
                    TimeLeftText("$name is open until ${Prayer.FAJR.name(r.naming)} at ${r.formatted(w.end)}.", left, false, false)
                else -> TimeLeftText("$name is open until ${r.formatted(w.end)}.", left, now >= w.nudgeAt, false)
            }
        }
    }
}

@Composable
fun TimeLeftBar(state: AppState) {
    val t = TimeLeftText.of(state, state.now) ?: return
    val shape = RoundedCornerShape(14.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape)
            .background(if (t.urgent) Palette.accent.copy(alpha = 0.18f) else Palette.primary.copy(alpha = 0.07f), shape)
            .padding(horizontal = 14.dp, vertical = 9.dp)
            .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(if (t.done) Icons.Filled.CheckCircle else Icons.Filled.HourglassBottom, null, Modifier.size(16.dp),
            tint = if (t.urgent) Palette.accent else Palette.secondary)
        Text(t.line, style = Txt.subheadline, color = if (t.done) Palette.secondary else Palette.primary, modifier = Modifier.weight(1f))
        t.left?.let {
            Text(it, style = Txt.subheadlineSemibold.copy(fontWeight = FontWeight.Bold, fontFeatureSettings = "tnum"),
                color = if (t.urgent) Palette.accent else Palette.primary, maxLines = 1)
        }
    }
}

/**
 * Big and Simple: for older eyes and anyone who wants only the times. The
 * prayer now, how long is left, the next prayer, and the five times in big
 * rows. Tap a row to tick it when the tracker is on. Nothing else.
 */
@Composable
fun SimplePage(state: AppState, day: PrayerDay, current: Pair<Prayer, Instant>?, next: Pair<Prayer, Instant>?, openPlaces: () -> Unit) {
    val r = state.resolver
    val now = state.now
    val t = TimeLeftText.of(state, now)
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = Dims.gutter, end = Dims.gutter, top = 4.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PlaceChip(state, openPlaces)
            Spacer(Modifier.weight(1f))
            HeaderButtons(state)
        }
        if (!state.prefs.notificationsEnabled && !state.prefs.alertsPromptDismissed) AlertsPrompt(state)
        Column(Modifier.fillMaxWidth().padding(vertical = 14.dp), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (current != null && current.first != Prayer.SUNRISE && t != null) {
                Text(r.prayerName(current.first, current.second), style = display(52.sp, FontWeight.ExtraBold), color = current.first.textTint,
                    maxLines = 1)
            }
            if (t != null) {
                Text(t.line, style = Txt.title2.copy(fontWeight = FontWeight.SemiBold), textAlign = TextAlign.Center,
                    color = if (t.urgent) Palette.accent else Palette.primary)
                t.left?.let { Text(it, style = Txt.largeTitle.copy(fontFeatureSettings = "tnum"), color = Palette.primary) }
            }
            if (next != null) {
                Text("Next is ${r.prayerName(next.first, next.second)} at ${r.formatted(next.second)}, in ${TimeFormat.short(next.second.secondsSince(now))}",
                    style = Txt.title3.copy(fontWeight = FontWeight.Normal), color = Palette.secondary, textAlign = TextAlign.Center)
            }
        }
        Prayer.all.forEach { prayer ->
            val time = day.time(prayer)
            val trackable = state.prefs.trackerEnabled && prayer != Prayer.SUNRISE && time <= now
            val prayed = trackable && r.isPrayed(prayer, time)
            val isNow = current?.first == prayer && current.second == time
            val shape = RoundedCornerShape(20.dp)
            Row(
                Modifier.fillMaxWidth().heightIn(min = 76.dp).leftBar(prayer.tint, 5.dp, 14.dp).clip(shape)
                    .background(if (isNow) prayer.tint.copy(alpha = 0.22f) else Palette.primary.copy(alpha = 0.07f), shape)
                    .then(if (trackable) Modifier.clickable { state.togglePrayed(prayer, time) } else Modifier)
                    .semantics { contentDescription = "${r.prayerName(prayer, time)} ${r.formatted(time)}${if (prayed) ", prayed" else ""}" },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(Modifier.weight(1f).padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(r.prayerName(prayer, time), fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Palette.primary,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    Text(r.formatted(time), fontSize = 28.sp, fontWeight = FontWeight.SemiBold, color = Palette.primary, maxLines = 1)
                    if (trackable) {
                        Icon(if (prayed) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, null, Modifier.size(30.dp),
                            tint = if (prayed) Palette.accent else Palette.secondary)
                    }
                }
            }
        }
    }
}
