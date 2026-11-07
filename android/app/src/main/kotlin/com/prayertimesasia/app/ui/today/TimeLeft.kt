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
 * The one countdown on the Prayer screen. While a prayer is open (and not yet
 * ticked) it says how long is left to pray it: "19m left to pray". Every
 * prayer's time ends when the next one starts (Subuh at Syuruk), so this is
 * the same moment as the next prayer, said the way busy people ask it.
 * Between Syuruk and Zohor, or once ticked, it counts to the next prayer.
 * Same wording as the web and iPhone.
 */
class Countdown(val count: String, val label: String, val urgent: Boolean, val done: Boolean) {
    val text: String get() = "$count $label"

    companion object {
        fun of(state: AppState, now: Instant, next: Pair<Prayer, Instant>): Countdown {
            val r = state.resolver
            val w = r.window(now)
            val done = w != null && state.prefs.trackerEnabled && r.isPrayed(w.prayer, w.start)
            return if (w != null && !done) {
                Countdown(TimeFormat.short(w.end.secondsSince(now)), "left to pray", w.prayer != Prayer.ISHA && now >= w.nudgeAt, false)
            } else {
                Countdown(TimeFormat.short(next.second.secondsSince(now)), "until ${r.prayerName(next.first, next.second)}", false, done)
            }
        }
    }
}

/**
 * Big and Simple: for older eyes and anyone who wants only the times. The
 * prayer now, how long is left to pray it, and the five times in big
 * rows. Tap a row to tick it when the tracker is on. Nothing else.
 */
@Composable
fun SimplePage(state: AppState, day: PrayerDay, current: Pair<Prayer, Instant>?, next: Pair<Prayer, Instant>?, openPlaces: () -> Unit) {
    val r = state.resolver
    val now = state.now
    val t = next?.let { Countdown.of(state, now, it) }
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
            if (current != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(r.prayerName(current.first, current.second), style = display(52.sp, FontWeight.ExtraBold), color = current.first.textTint,
                        maxLines = 1)
                    if (t?.done == true) Icon(Icons.Filled.CheckCircle, "Prayed", Modifier.size(34.dp), tint = Palette.accent)
                }
            }
            if (t != null) {
                Text(t.text, style = Txt.largeTitle.copy(fontFeatureSettings = "tnum"), textAlign = TextAlign.Center,
                    color = if (t.urgent) Palette.accent else Palette.primary)
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
