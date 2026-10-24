package com.prayertimesasia.app.widget

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.ui.theme.BandsPalette
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.SkyColors
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.app.ui.theme.rgb
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.TimeFormat
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.secondsSince

private val peach = rgb(0.97, 0.74, 0.56)

/**
 * The big "Today's timetable" widget as the app shows it (Settings preview and
 * screenshots). The home-screen widget itself is drawn by Glance with the same layout.
 */
@Composable
fun TimetableCardPreview(m: WidgetModel, size: Dp = 340.dp) {
    val shape = RoundedCornerShape(24.dp)
    val sky = SkyColors.at(m.now, m.day)
    Box(
        Modifier.size(size).clip(shape).background(
            if (m.style == TodayStyle.BANDS) Brush.verticalGradient(listOf(BandsPalette.header, BandsPalette.header))
            else Brush.verticalGradient(listOf(sky.top.color, sky.bottom.color)),
        ),
    ) {
        when (m.style) {
            TodayStyle.BANDS -> Bands(m)
            TodayStyle.DIAL, TodayStyle.CENTRE -> Dial(m)
            else -> ClassicList(m)
        }
    }
}

@Composable
private fun ClassicList(m: WidgetModel) {
    val current = m.current?.first
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            Modifier.clip(CircleShape).border(1.dp, peach.copy(alpha = 0.75f), CircleShape).padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("TODAY", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color.White, letterSpacing = 0.4.sp)
            Box(Modifier.width(1.dp).height(9.dp).background(Color.White.copy(alpha = 0.35f)))
            Text("${m.placeName} ${m.flag}", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(m.dateLine, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1)
            Text("·", color = Color.White.copy(alpha = 0.5f))
            Text(m.hijri, fontSize = 12.sp, color = Color.White.copy(alpha = 0.7f), maxLines = 1)
        }
        Column(
            Modifier.fillMaxWidth().weight(1f).clip(RoundedCornerShape(18.dp)).background(Color.Black.copy(alpha = 0.18f))
                .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(18.dp)).padding(5.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Prayer.all.forEach { p ->
                val isCurrent = p == current
                val passed = m.day.time(p) <= m.now && !isCurrent
                Row(
                    Modifier.fillMaxWidth().weight(1f).alpha(if (passed) 0.6f else 1f)
                        .then(if (isCurrent) Modifier.clip(RoundedCornerShape(13.dp)).background(p.tint.copy(alpha = 0.2f))
                            .border(1.dp, p.tint.copy(alpha = 0.5f), RoundedCornerShape(13.dp)) else Modifier)
                        .padding(start = 8.dp, end = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.width(3.dp).height(22.dp).clip(CircleShape).background(p.tint.copy(alpha = if (isCurrent) 1f else 0.6f)))
                    Spacer(Modifier.width(8.dp))
                    Column(Modifier.weight(1f)) {
                        Text(m.names.getValue(p), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color.White, fontFamily = Rounded)
                        if (isCurrent) Text("NOW", fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, color = p.tint)
                    }
                    val t = m.times.getValue(p)
                    Text(t.first, style = display(22.sp), color = Color.White)
                    t.second?.let { Text(" $it", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.7f)) }
                }
            }
        }
    }
}

@Composable
private fun Dial(m: WidgetModel) {
    val current = m.current
    val next = m.next
    Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(136.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.fillMaxSize()) { drawDialRing(m) }
                if (current != null && next != null) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(m.names.getValue(current.first).let { if (current.first == Prayer.ISHA && current.second < m.day.time(Prayer.FAJR)) it else it },
                            fontFamily = Rounded, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(TimeFormat.countdown(next.second.secondsSince(m.now)), style = display(13.sp), color = peach)
                    }
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${m.placeName} ${m.flag}", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1)
                Text(m.hijri, fontSize = 12.sp, color = Color.White.copy(alpha = 0.75f), maxLines = 2)
                if (m.nextName != null) Text("Next: ${m.nextName} ${m.nextTime}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = 0.9f), maxLines = 1)
            }
        }
        listOf(Prayer.all.take(3), Prayer.all.drop(3)).forEach { row ->
            Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { p ->
                    val isCurrent = p == current?.first
                    val passed = m.day.time(p) <= m.now && !isCurrent
                    Column(
                        Modifier.weight(1f).fillMaxSize().alpha(if (passed) 0.6f else 1f).clip(RoundedCornerShape(12.dp))
                            .background(p.tint.copy(alpha = if (isCurrent) 0.35f else 0.14f))
                            .then(if (isCurrent) Modifier.border(1.dp, p.tint.copy(alpha = 0.8f), RoundedCornerShape(12.dp)) else Modifier),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                    ) {
                        Text(m.names.getValue(p), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.85f))
                        val t = m.times.getValue(p)
                        Text(t.first + (t.second?.let { " $it" } ?: ""), style = display(16.sp), color = Color.White, maxLines = 1)
                    }
                }
            }
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDialRing(m: WidgetModel) {
    val midnight = m.day.date.atStartOfDay(m.zone).toInstant()
    fun angle(t: java.time.Instant) = (t.secondsSince(midnight) / 86_400 * 360 + 180).toFloat()
    val ring = size.width * 0.09f
    val r = size.width / 2 - ring * 0.7f
    val tl = Offset(center.x - r, center.y - r)
    val sz = Size(r * 2, r * 2)
    drawArc(Color.White.copy(alpha = 0.12f), 0f, 360f, false, tl, sz, style = Stroke(ring))
    val order = Prayer.all
    order.forEachIndexed { i, p ->
        val start = angle(m.day.time(p))
        val end = if (i + 1 < order.size) angle(m.day.time(order[i + 1])) else angle(m.day.time(Prayer.FAJR)) + 360
        drawArc(p.tint, start + 1.2f - 90f, end - start - 2.4f, false, tl, sz, style = Stroke(ring))
    }
    val a = Math.toRadians((angle(m.now) - 90).toDouble())
    val dot = Offset(center.x + (kotlin.math.cos(a) * r).toFloat(), center.y + (kotlin.math.sin(a) * r).toFloat())
    drawCircle(Color.White, ring * 0.62f, dot)
    drawCircle(peach, ring * 0.62f, dot, style = Stroke(2.5f * density))
}

@Composable
private fun Bands(m: WidgetModel) {
    val current = m.current?.first
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().padding(vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(m.hijri, style = display(17.sp), color = Color.White, maxLines = 1)
            Text("${m.placeName} ${m.flag}  ·  ${m.sourceLabel}", fontSize = 11.sp, fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = 0.65f), maxLines = 1)
        }
        Prayer.all.forEach { p ->
            val isCurrent = p == current
            Box(Modifier.fillMaxWidth().weight(1f).background(BandsPalette.color(p))) {
                if (isCurrent) Box(Modifier.width(4.dp).fillMaxSize().background(Color.White))
                Row(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(m.names.getValue(p), fontFamily = Rounded, fontSize = 21.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    if (isCurrent) {
                        Spacer(Modifier.width(6.dp))
                        Text("NOW", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color.White,
                            modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.25f)).padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                    Spacer(Modifier.weight(1f))
                    val t = m.times.getValue(p)
                    Text(t.first, style = display(25.sp, FontWeight.Light), color = Color.White)
                    t.second?.let { Text(" $it", style = display(15.sp, FontWeight.Light), color = Color.White) }
                }
            }
        }
    }
}
