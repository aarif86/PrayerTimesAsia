package com.prayertimesasia.app.widget

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.ui.theme.BandsPalette
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.TimeFormat
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.secondsSince

/**
 * The big "Today's timetable" widget as the app shows it (Settings preview and
 * screenshots), in the look and the Light or Dark of the model. The home-screen widget
 * itself is drawn by Glance with the same layout (Widgets.kt).
 */
@Composable
fun TimetableCardPreview(m: WidgetModel, size: Dp = 340.dp) {
    val shape = RoundedCornerShape(24.dp)
    val (top, bottom) = backdropColors(m)
    val pal = widgetPal(m.style, m.dark)
    Box(Modifier.size(size).clip(shape).background(Brush.verticalGradient(listOf(top, bottom)))) {
        when (m.style) {
            TodayStyle.BANDS -> Bands(m, pal)
            TodayStyle.SUN_PATH -> SunPath(m, pal)
            TodayStyle.SIMPLE -> Simple(m, pal)
            else -> Dial(m, pal)
        }
    }
}

private fun countdownText(m: WidgetModel): String? {
    val next = m.next ?: return null
    return TimeFormat.countdown(next.second.secondsSince(m.now))
}

/** The six rows on the look's card, the next prayer lit with its live countdown. */
@Composable
private fun Rows(m: WidgetModel, pal: WPal, modifier: Modifier, name: TextUnit = 16.sp, time: TextUnit = 20.sp) {
    val gold = m.style == TodayStyle.GOLD
    val countdown = m.countdownRow()
    val next = m.next
    Column(modifier.clip(RoundedCornerShape(16.dp)).background(pal.card)) {
        Prayer.all.forEach { p ->
            val hit = countdown?.first == p
            val passed = m.day.time(p) <= m.now && !hit
            Row(
                Modifier.fillMaxWidth().weight(1f).alpha(if (passed) 0.6f else 1f).background(if (hit) pal.cur else Color.Transparent).padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (gold) Box(Modifier.size(7.dp).clip(CircleShape).background(if (hit) pal.acc else Color.Transparent))
                else Box(Modifier.width(3.dp).height(name.value.dp + 3.dp).clip(CircleShape).background(p.tint))
                Spacer(Modifier.width(8.dp))
                Text(m.names.getValue(p), fontSize = name, fontWeight = if (hit) FontWeight.Bold else FontWeight.Medium, color = pal.fg, maxLines = 1)
                if (hit && next != null) Text(" " + (countdown?.second ?: "") + TimeFormat.countdown(next.second.secondsSince(m.now)),
                    fontSize = (name.value * 0.72f).sp, fontWeight = FontWeight.Bold, color = pal.acc, maxLines = 1)
                Spacer(Modifier.weight(1f))
                val t = m.times.getValue(p)
                Text(t.first, fontSize = time, fontWeight = FontWeight.Medium, color = pal.fg, fontFamily = Rounded)
                t.second?.let { Text(" $it", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = pal.fg2) }
            }
        }
    }
}

@Composable
private fun Dial(m: WidgetModel, pal: WPal) {
    val lead = m.lead
    val gold = m.style == TodayStyle.GOLD
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.padding(horizontal = 6.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(132.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.fillMaxSize()) { drawDialRing(m, pal, gold) }
                if (lead != null) {
                    val count = countdownText(m) ?: ""
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(if (lead.isNext) "Next prayer" else "Now ${m.names.getValue(lead.prayer)}", fontSize = 10.sp, color = pal.fg2, maxLines = 1)
                        Text(count, style = display(24.sp), color = pal.fg, maxLines = 1)
                        Text(if (lead.isNext) "until ${m.names.getValue(lead.prayer)}" else "left", fontSize = 10.sp, color = pal.fg2, maxLines = 1)
                    }
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${m.placeName} ${m.flag}", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = pal.fg, maxLines = 1)
                Text("${m.dateLine.substringAfter(' ')} · ${m.hijri}", fontSize = 12.sp, color = pal.fg2, maxLines = 2)
                if (m.nextName != null) Text("Next: ${m.nextName} ${m.nextTime}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = pal.fg, maxLines = 1)
            }
        }
        Rows(m, pal, Modifier.fillMaxWidth().weight(1f))
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDialRing(m: WidgetModel, pal: WPal, gold: Boolean) {
    val midnight = m.day.date.atStartOfDay(m.zone).toInstant()
    fun angle(t: java.time.Instant) = (t.secondsSince(midnight) / 86_400 * 360 + 180).toFloat()
    val ring = if (gold) size.width * 0.02f else size.width * 0.09f
    val r = size.width / 2 - (if (gold) size.width * 0.04f else ring * 0.7f)
    val tl = Offset(center.x - r, center.y - r)
    val sz = Size(r * 2, r * 2)
    val a = Math.toRadians((angle(m.now) - 90).toDouble())
    val dot = Offset(center.x + (kotlin.math.cos(a) * r).toFloat(), center.y + (kotlin.math.sin(a) * r).toFloat())
    if (gold) {
        drawArc(pal.acc.copy(alpha = 0.35f), 0f, 360f, false, tl, sz, style = Stroke(ring))
        drawArc(pal.acc, 90f, angle(m.now) - 180f, false, tl, sz, style = Stroke(ring))
        drawCircle(pal.acc, size.width * 0.035f, dot)
        return
    }
    drawArc(pal.fg.copy(alpha = 0.12f), 0f, 360f, false, tl, sz, style = Stroke(ring))
    val order = Prayer.all
    order.forEachIndexed { i, p ->
        val start = angle(m.day.time(p))
        val end = if (i + 1 < order.size) angle(m.day.time(order[i + 1])) else angle(m.day.time(Prayer.FAJR)) + 360
        drawArc(p.tint, start + 1.2f - 90f, end - start - 2.4f, false, tl, sz, style = Stroke(ring))
    }
    drawCircle(Color.White, ring * 0.62f, dot)
    drawCircle(pal.acc, ring * 0.62f, dot, style = Stroke(2.5f * density))
}

@Composable
private fun SunPath(m: WidgetModel, pal: WPal) {
    val lead = m.lead
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp)) {
            Text("${m.placeName} ${m.flag}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = pal.fg2, maxLines = 1, modifier = Modifier.weight(1f))
            Text("${m.dateLine.substringAfter(' ')} · ${m.hijri}", fontSize = 11.sp, color = pal.fg2, maxLines = 1)
        }
        if (lead != null) Row(Modifier.padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(lead.prayer.tint))
            Spacer(Modifier.width(7.dp))
            Text(m.names.getValue(lead.prayer), fontSize = 30.sp, fontWeight = FontWeight.Bold, color = pal.fg, maxLines = 1)
            Spacer(Modifier.width(8.dp))
            Text((if (lead.isNext) "in " else "${m.nextName} in ") + (countdownText(m) ?: ""), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = pal.fg,
                modifier = Modifier.clip(CircleShape).background(pal.card).padding(horizontal = 10.dp, vertical = 3.dp), maxLines = 1)
        }
        androidx.compose.foundation.Image(
            bitmap = sunPathBitmap(m, 400, 110).let { androidx.compose.ui.graphics.asImageBitmap(it) }, contentDescription = "Sun path",
            modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 6.dp), contentScale = androidx.compose.ui.layout.ContentScale.FillBounds,
        )
        Rows(m, pal, Modifier.fillMaxWidth().weight(1f))
    }
}

@Composable
private fun Simple(m: WidgetModel, pal: WPal) {
    val lead = m.lead
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("${m.placeName} ${m.flag}  ·  ${m.hijri}", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = pal.fg2, maxLines = 1)
        if (lead != null) {
            Text(m.names.getValue(lead.prayer), fontFamily = Rounded, fontSize = 38.sp, fontWeight = FontWeight.Bold, color = pal.hero, maxLines = 1)
            Text((if (lead.isNext) "in " else "left ") + (countdownText(m) ?: ""), fontFamily = Rounded, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = pal.fg, maxLines = 1)
        }
        Rows(m, pal, Modifier.fillMaxWidth().weight(1f), name = 18.sp, time = 22.sp)
    }
}

@Composable
private fun Bands(m: WidgetModel, pal: WPal) {
    val lead = m.lead
    val countdown = m.countdownRow()
    val next = m.next
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 14.dp, bottom = 8.dp), verticalAlignment = Alignment.Bottom) {
            if (lead != null) Text(m.names.getValue(lead.prayer), fontFamily = Rounded, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = pal.fg, maxLines = 1)
            if (next != null) Text("  " + (if (lead?.isNext == true) "in " else "${m.nextName} in ") + TimeFormat.countdown(next.second.secondsSince(m.now)),
                fontSize = 14.sp, fontWeight = FontWeight.Medium, color = pal.fg2, maxLines = 1)
        }
        Box(Modifier.fillMaxWidth().background(pal.bar).padding(vertical = 5.dp), contentAlignment = Alignment.Center) {
            Text("${m.dateLine.substringAfter(' ')} · ${m.hijri}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = pal.fg, maxLines = 1)
        }
        Prayer.all.forEach { p ->
            Row(Modifier.fillMaxWidth().weight(1f).background(BandsPalette.color(p)).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(m.names.getValue(p), fontFamily = Rounded, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Color.White)
                if (countdown?.first == p && next != null) Text("  " + countdown.second + TimeFormat.countdown(next.second.secondsSince(m.now)),
                    fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.9f), maxLines = 1)
                Spacer(Modifier.weight(1f))
                val t = m.times.getValue(p)
                Text(t.first, style = display(23.sp, FontWeight.Light), color = Color.White)
                t.second?.let { Text(" $it", style = display(14.sp, FontWeight.Light), color = Color.White) }
            }
        }
    }
}
