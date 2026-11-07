package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Opacity
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.Prayer
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val Pink = Color(0xFFE06C8A)

/** The prayer tracker: the streak, a pause for haid, nifas or illness, and a month at a glance. Kept only on this phone. */
@Composable
fun TrackerSheetContent(state: AppState) {
    val r = state.resolver
    val todayKey = r.dayKey(state.now)
    val today = LocalDate.parse(todayKey)
    var monthsBack by remember { mutableIntStateOf(0) }
    val first = today.withDayOfMonth(1).minusMonths(monthsBack.toLong())
    val since = state.prefs.trackerPausedSince
    val five = Prayer.obligatory.size

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Prayer tracker", style = Txt.headline, color = Palette.primary)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(if (since != null) Icons.Filled.Pause else Icons.Filled.Whatshot, null, Modifier.size(24.dp), tint = Palette.accent)
            Text("${r.streak(state.now)}", style = Txt.largeTitle, color = Palette.primary)
            Text("day streak", style = Txt.body, color = Palette.secondary)
        }
        Text(
            if (since != null) "Paused since ${LocalDate.parse(since).format(DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH))}. These days count as excused, so your streak waits for you."
            else "For haid, nifas or illness: pause the tracker and every day until you end it counts as excused.",
            style = Txt.subheadline, color = Palette.secondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (since != null) {
                Pill("End pause", Icons.Filled.PlayArrow, Palette.accent, Color(0xFF1B1410)) { state.endTrackerPause(state.now) }
            } else {
                Pill("Pause tracker", Icons.Filled.Pause, Palette.accent, Color(0xFF1B1410)) { state.pauseTracker(state.now) }
                val excused = r.isExcused(state.now)
                Pill(if (excused) "Excused today" else "Just today", Icons.Filled.Opacity,
                    if (excused) Pink.copy(alpha = 0.3f) else Palette.primary.copy(alpha = 0.1f), Palette.primary) { state.toggleExcused(state.now) }
            }
        }

        // The month
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(Palette.primary.copy(alpha = 0.1f)).clickable(onClickLabel = "Previous month") { monthsBack++ },
                contentAlignment = Alignment.Center) { Icon(Icons.Filled.ChevronLeft, "Previous month", tint = Palette.primary) }
            Text(first.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH)), style = Txt.headline, color = Palette.primary,
                textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
            Box(Modifier.size(34.dp).clip(CircleShape).background(Palette.primary.copy(alpha = if (monthsBack > 0) 0.1f else 0.04f))
                .clickable(enabled = monthsBack > 0, onClickLabel = "Next month") { monthsBack-- },
                contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.ChevronRight, "Next month", tint = Palette.primary.copy(alpha = if (monthsBack > 0) 1f else 0.35f))
            }
        }
        val lead = first.dayOfWeek.value - 1 // Monday first
        val keys: List<String?> = List(lead) { null } + (1..first.lengthOfMonth()).map { first.withDayOfMonth(it).toString() }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth()) {
                listOf("M", "T", "W", "T", "F", "S", "S").forEach {
                    Text(it, style = Txt.caption, color = Palette.secondary, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                }
            }
            keys.chunked(7).forEach { week ->
                Row(Modifier.fillMaxWidth()) {
                    (0 until 7).forEach { i ->
                        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                            week.getOrNull(i)?.let { DayCell(state, it, todayKey) }
                        }
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally)) {
            Legend(Palette.success, "All five")
            Legend(Palette.success.copy(alpha = 0.5f), "Some")
            Legend(Pink, "Excused")
        }
        val past = keys.filterNotNull().filter { it <= todayKey }.map { r.trackerDay(it, todayKey) }
        val excusedDays = past.count { it.second }
        val prayed = past.filter { !it.second }.sumOf { it.first }
        val counted = (past.size - excusedDays) * five
        Text(
            (if (counted > 0) "$prayed of $counted prayers ticked" else "Nothing to count yet") +
                if (excusedDays > 0) " · $excusedDays excused day${if (excusedDays == 1) "" else "s"}" else "",
            style = Txt.subheadline, color = Palette.primary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
        )
        Text("Tap a prayer on the Prayer screen once its time has come to tick it off. Your tracker is kept only on this phone - never uploaded, and it moves to a new phone only through Move my settings.",
            style = Txt.footnote, color = Palette.secondary)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun DayCell(state: AppState, key: String, todayKey: String) {
    val (prayed, excused) = state.resolver.trackerDay(key, todayKey)
    val n = key.takeLast(2).toInt()
    val future = key > todayKey
    val full = prayed >= Prayer.obligatory.size
    val success = Palette.success
    val track = Palette.primary.copy(alpha = 0.14f)
    val ring = if (key == todayKey) Modifier.border(2.dp, Palette.accent, CircleShape).padding(3.dp) else Modifier
    Box(
        Modifier.size(42.dp).then(ring).clip(CircleShape).background(
            when {
                future -> Color.Transparent
                full -> success
                excused -> Pink.copy(alpha = 0.28f)
                else -> Color.Transparent
            },
        ).clearAndSetSemantics { contentDescription = "$n: ${if (future) "not yet" else if (excused) "excused" else "$prayed of 5 prayers"}" },
        contentAlignment = Alignment.Center,
    ) {
        if (!future && !full && !excused) {
            Canvas(Modifier.fillMaxSize().padding(2.dp)) {
                drawArc(track, 0f, 360f, false, style = Stroke(3.dp.toPx()))
                drawArc(success, -90f, 360f * prayed / Prayer.obligatory.size, false, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round))
            }
        }
        when {
            excused && !full && !future -> Icon(Icons.Filled.Opacity, null, Modifier.size(14.dp), tint = Pink)
            else -> Text("$n", style = Txt.footnote.copy(fontWeight = if (full) FontWeight.SemiBold else FontWeight.Normal),
                color = when { future -> Palette.primary.copy(alpha = 0.35f); full -> Color.White; else -> Palette.primary })
        }
    }
}

@Composable
private fun Pill(label: String, icon: ImageVector, background: Color, content: Color, onClick: () -> Unit) {
    Row(
        Modifier.clip(CircleShape).background(background).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, Modifier.size(16.dp), tint = content)
        Text(label, style = Txt.subheadlineSemibold, color = content)
    }
}

@Composable
private fun Legend(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Text(label, style = Txt.caption, color = Palette.secondary)
    }
}
