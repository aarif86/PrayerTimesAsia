package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Print
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.CalendarSanad
import com.prayertimesasia.core.Hijri
import com.prayertimesasia.core.IslamicDayKind
import com.prayertimesasia.core.IslamicDays
import com.prayertimesasia.core.NamingStyle
import com.prayertimesasia.core.Season
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

private val SundayRed = Color(0xFFE5484D)
private val RamadanBlue = Color(0xFF4C7BD9)

private class Cell(val g: LocalDate, val h: Hijri.HijriDate)

/**
 * A quiet month calendar at the top of the Calendar sheet (tap the date on the
 * Prayer screen): Gregorian month like a wall calendar, the Hijri day under each
 * date and the important days marked. Same as web ui/HijriCalendar.tsx.
 */
@Composable
fun HijriMonthCard(state: AppState, onShowDay: ((Int) -> Unit)?) {
    val r = state.resolver
    val style = r.naming
    val w = IslamicDays.words(style)
    val today = LocalDate.now(r.zone)
    var shownIndex by rememberSaveable { mutableStateOf(today.year * 12 + today.monthValue - 1) }
    var picked by remember { mutableStateOf<LocalDate?>(null) }
    val y = shownIndex / 12
    val m = shownIndex % 12 + 1
    val first = LocalDate.of(y, m, 1)
    val cells = (0 until first.lengthOfMonth()).map { i -> first.plusDays(i.toLong()).let { Cell(it, r.hijriOf(it)) } }
    val lead = first.dayOfWeek.value % 7 // Sunday first, like a wall calendar
    val keyDays = cells.flatMap { c -> IslamicDays.of(c.h).filter { IslamicDays.listed(c.h, it) }.map { c to it } }
    val whiteRuns = if (keyDays.isNotEmpty()) emptyList() else cells.filterIndexed { i, c ->
        (c.h.day == 13 || i == 0) && IslamicDays.of(c.h).any { it.kind == IslamicDayKind.WHITE_DAY }
    }
    val sel = picked?.let { p -> cells.firstOrNull { it.g == p } }
    val authority = r.communityAuthority
    val adj = state.prefs.hijriAdjustment
    val uri = LocalUriHandler.current
    val move = { d: Int -> picked = null; shownIndex += d }

    Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            RoundArrow(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Previous month") { move(-1) }
            Column(Modifier.weight(1f).semantics(mergeDescendants = true) { heading() }, horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${w.months[m - 1]} $y", style = Txt.headline, color = Palette.primary)
                Text(span(cells, style, w.and), style = Txt.footnoteSemibold, color = Palette.accentText, textAlign = TextAlign.Center)
            }
            RoundArrow(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Next month") { move(1) }
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth()) {
            w.week.forEachIndexed { i, d ->
                Text(d, Modifier.weight(1f).padding(bottom = 4.dp), textAlign = TextAlign.Center, style = Txt.captionSemibold,
                    color = when (i) { 0 -> SundayRed; 5 -> Palette.gold; else -> Palette.secondary })
            }
        }
        val slots: List<Cell?> = List(lead) { null } + cells
        slots.chunked(7).forEach { week ->
            Row(Modifier.fillMaxWidth().padding(bottom = 3.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                (0 until 7).forEach { i ->
                    val c = week.getOrNull(i)
                    Box(Modifier.weight(1f)) {
                        if (c != null) DayCell(c, first = c.g.dayOfMonth == 1, isToday = c.g == today, isPicked = sel?.g == c.g, style = style) {
                            picked = if (sel?.g == c.g) null else c.g
                        }
                    }
                }
            }
        }
        HorizontalDivider(Modifier.padding(vertical = 10.dp), color = Palette.secondary.copy(alpha = 0.25f))
        if (sel != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("${sel.h.day} ${style.hijriMonths[sel.h.month - 1]} ${sel.h.year}", style = Txt.subheadlineSemibold, color = Palette.primary)
                    Text(longDate(sel.g), style = Txt.caption, color = Palette.secondary)
                    IslamicDays.of(sel.h).forEach { Text(IslamicDays.name(it.kind, style), style = Txt.captionSemibold, color = Palette.accentText) }
                }
                if (onShowDay != null) {
                    Text(w.prayerTimes, style = Txt.subheadlineSemibold, color = Palette.accentText,
                        modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(Palette.accent.copy(alpha = 0.15f))
                            .clickable { onShowDay(ChronoUnit.DAYS.between(today, sel.g).toInt()) }
                            .padding(horizontal = 14.dp, vertical = 12.dp))
                }
            }
        } else {
            if (shownIndex != today.year * 12 + today.monthValue - 1) {
                Text(w.today, style = Txt.footnoteSemibold, color = Palette.accentText,
                    modifier = Modifier.align(Alignment.End).clickable { picked = null; shownIndex = today.year * 12 + today.monthValue - 1 }.padding(8.dp))
            }
            when {
                keyDays.isNotEmpty() -> keyDays.forEach { (c, k) ->
                    KeyRow(c.g.dayOfMonth, IslamicDays.name(k.kind, style), "${c.h.day} ${style.hijriMonths[c.h.month - 1]}") { picked = c.g }
                }
                whiteRuns.isNotEmpty() -> whiteRuns.forEach { c ->
                    KeyRow(c.g.dayOfMonth, IslamicDays.name(IslamicDayKind.WHITE_DAY, style), "13, 14, 15 ${IslamicDays.monthShort(c.h.month, style)}") { picked = c.g }
                }
                else -> Text(w.none, style = Txt.footnote, color = Palette.secondary)
            }
            if (whiteRuns.isEmpty()) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                    Box(Modifier.size(5.dp).clip(CircleShape).background(Palette.secondary))
                    Spacer(Modifier.width(6.dp))
                    Text("${IslamicDays.name(IslamicDayKind.WHITE_DAY, style)} 13, 14, 15", style = Txt.footnote, color = Palette.secondary)
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)
            .clickable { runCatching { uri.openUri("https://prayertimes.asia/app/print/#sheet=year&m=$y-01") } }.padding(vertical = 8.dp)) {
            Icon(Icons.Filled.Print, null, tint = Palette.accentText, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("${w.print} $y", style = Txt.subheadlineSemibold, color = Palette.accentText)
        }
        val short = authority?.let { CalendarSanad.authorityName(it).replace(Regex("""\s*\(.*\)\s*$"""), "") }
        val published = authority != null && Season.publishedHijri(first, state.directories.calendar.monthStarts, authority) != null
        Text(if (published && short != null) w.notePublished(short) else w.note(short), style = Txt.footnote, color = Palette.secondary,
            modifier = Modifier.padding(vertical = 8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(w.adjust, style = Txt.subheadline, color = Palette.primary, modifier = Modifier.weight(1f))
            Text(if (adj == 0) w.adjustNone else "${if (adj > 0) "+" else ""}$adj ${w.dayOff}", style = Txt.footnote, color = Palette.secondary)
            Spacer(Modifier.width(10.dp))
            StepButton("−", w.earlier, adj > -2) { state.update { it.copy(hijriAdjustment = (it.hijriAdjustment - 1).coerceAtLeast(-2)) } }
            Spacer(Modifier.width(6.dp))
            StepButton("+", w.later, adj < 2) { state.update { it.copy(hijriAdjustment = (it.hijriAdjustment + 1).coerceAtMost(2)) } }
        }
    }
}

@Composable
private fun DayCell(c: Cell, first: Boolean, isToday: Boolean, isPicked: Boolean, style: NamingStyle, onClick: () -> Unit) {
    val marks = IslamicDays.of(c.h)
    val major = marks.firstOrNull { it.major }
    val quiet = major == null && marks.any { it.kind == IslamicDayKind.LAST_TEN || it.kind == IslamicDayKind.TASYRIK || it.kind == IslamicDayKind.ZULHIJJAH_TEN }
    val white = marks.any { it.kind == IslamicDayKind.WHITE_DAY }
    val ramadan = c.h.month == 9
    val sunday = c.g.dayOfWeek.value == 7
    val newMonth = c.h.day == 1
    val accent = Palette.accent
    val gold = Palette.gold
    val bg = when {
        isPicked -> accent
        ramadan -> RamadanBlue.copy(alpha = if (quiet) 0.30f else 0.16f)
        major != null -> accent.copy(alpha = 0.22f)
        quiet -> accent.copy(alpha = 0.10f)
        else -> Palette.primary.copy(alpha = 0.06f)
    }
    val fg: Color? = if (isPicked) Color.Black else null
    val small = major?.let { IslamicDays.shortName(it.kind, style) } ?: if (newMonth || first) IslamicDays.monthShort(c.h.month, style) else null
    val label = "${longDate(c.g)}, ${c.h.day} ${style.hijriMonths[c.h.month - 1]} ${c.h.year}" +
        if (marks.isEmpty()) "" else ", " + marks.joinToString(", ") { IslamicDays.name(it.kind, style) }
    val shape = RoundedCornerShape(10.dp)
    Column(
        Modifier.fillMaxWidth().heightIn(min = 62.dp).clip(shape).background(bg)
            .then(if (major != null && !isPicked) Modifier.drawBehind { drawLine(gold, Offset(0f, 1f), Offset(size.width, 1f), strokeWidth = 2.dp.toPx()) } else Modifier)
            .then(if (isToday) Modifier.border(2.dp, accent, shape) else Modifier)
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) { contentDescription = label }
            .padding(top = 6.dp, start = 1.dp, end = 1.dp, bottom = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("${c.g.dayOfMonth}", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = fg ?: if (sunday) SundayRed else Palette.primary)
        Row(verticalAlignment = Alignment.CenterVertically) {
            val hc = fg ?: if (newMonth) Palette.accentText else Palette.secondary
            Text("${c.h.day}", fontSize = 11.sp, color = hc)
            if (white) { Spacer(Modifier.width(2.dp)); Box(Modifier.size(4.dp).clip(CircleShape).background(hc)) }
        }
        if (small != null) {
            Text(small, fontSize = 9.sp, lineHeight = 10.sp, textAlign = TextAlign.Center, maxLines = 2,
                fontWeight = if (major != null || newMonth) FontWeight.Bold else FontWeight.Normal,
                color = fg ?: if (major != null || newMonth) Palette.accentText else Palette.secondary)
        }
    }
}

@Composable
private fun RoundArrow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Box(Modifier.size(48.dp).clip(CircleShape).background(Palette.primary.copy(alpha = 0.08f)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center) {
        Icon(icon, label, tint = Palette.primary)
    }
}

@Composable
private fun StepButton(text: String, label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(Palette.primary.copy(alpha = 0.08f))
        .clickable(enabled = enabled, onClick = onClick).semantics { contentDescription = label },
        contentAlignment = Alignment.Center) {
        Text(text, style = Txt.headline, color = if (enabled) Palette.primary else Palette.secondary.copy(alpha = 0.4f))
    }
}

@Composable
private fun KeyRow(day: Int, name: String, detail: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("$day", style = Txt.bodySemibold, color = Palette.accentText, modifier = Modifier.width(32.dp))
        Text(name, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
        Text(detail, style = Txt.caption, color = Palette.secondary)
    }
}

private fun span(cells: List<Cell>, style: NamingStyle, and: String): String {
    val a = cells.first().h
    val z = cells.last().h
    val n = { mo: Int -> IslamicDays.monthShort(mo, style) }
    return when {
        a.month == z.month -> "${n(a.month)} ${a.year}"
        a.year == z.year -> "${n(a.month)} $and ${n(z.month)} ${z.year}"
        else -> "${n(a.month)} ${a.year} $and ${n(z.month)} ${z.year}"
    }
}

private val longFmt = DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.ENGLISH)
private fun longDate(g: LocalDate): String = g.format(longFmt)
