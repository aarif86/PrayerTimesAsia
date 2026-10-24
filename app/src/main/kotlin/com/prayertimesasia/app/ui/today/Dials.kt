package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.app.ui.theme.rgb
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.secondsSince
import java.time.Instant
import java.time.ZoneId
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

private val dialNight = rgb(0.13, 0.15, 0.36)

/** Local midnight of the day the dial shows. */
private fun midnight(day: PrayerDay, zone: ZoneId): Instant = day.date.atStartOfDay(zone).toInstant()

/** Degrees clockwise from the top, with noon at the top and midnight at the bottom. */
internal fun dialAngle(date: Instant, midnight: Instant): Double = date.secondsSince(midnight) / 3600 / 24 * 360 + 180

/** The sky through the day as one gradient round the ring: night, dawn, morning, the hot noon, afternoon, sunset, night. */
private fun skyBrush(day: PrayerDay, midnight: Instant, center: Offset): Brush {
    fun f(p: Prayer): Float = (day.time(p).secondsSince(midnight) / 86_400).toFloat().coerceIn(0f, 1f)
    val raw = listOf(
        0f to dialNight,
        (f(Prayer.FAJR) - 0.06f).coerceAtLeast(0f) to Prayer.ISHA.tint,
        f(Prayer.FAJR) to Prayer.FAJR.tint,
        f(Prayer.SUNRISE) to rgb(0.96, 0.70, 0.58),
        (f(Prayer.SUNRISE) + f(Prayer.DHUHR)) / 2 to Prayer.SUNRISE.tint,
        f(Prayer.DHUHR) to Prayer.DHUHR.tint,
        f(Prayer.ASR) to Prayer.ASR.tint,
        f(Prayer.MAGHRIB) to Prayer.MAGHRIB.tint,
        f(Prayer.ISHA) to Prayer.ISHA.tint,
        1f to dialNight,
    )
    // Stops must not go backwards.
    var last = 0f
    val stops = raw.map { (p, c) -> val q = maxOf(p, last); last = q; q to c }.toTypedArray()
    return Brush.sweepGradient(colorStops = stops, center = center)
}

/**
 * Draws each prayer's period as a segment of the sky ring. With noon at the top, the
 * canvas is turned a quarter so the sweep gradient starts (midnight) at the bottom.
 */
private fun DrawScope.skySegments(
    day: PrayerDay, nextFajr: Instant, midnight: Instant, radius: Float, ring: Float,
    current: Prayer?, gapDegrees: Float,
) {
    val c = center
    val brush = skyBrush(day, midnight, c)
    val order = Prayer.all
    rotate(90f, pivot = c) {
        order.forEachIndexed { i, prayer ->
            // Isyak ends at tomorrow's Subuh: past 540° the gradient wraps by itself.
            val start = dialAngle(day.time(prayer), midnight).toFloat()
            val end = (if (i + 1 < order.size) dialAngle(day.time(order[i + 1]), midnight) else dialAngle(nextFajr, midnight)).toFloat()
            val sweep = (end - start) - 2 * gapDegrees
            if (sweep > 0) {
                val w = if (prayer == current) ring * 1.3f else ring
                drawArc(brush, startAngle = start + gapDegrees - 180f, sweepAngle = sweep, useCenter = false,
                    topLeft = Offset(c.x - radius, c.y - radius), size = Size(radius * 2, radius * 2), style = Stroke(w))
            }
        }
    }
}

private fun point(c: Offset, angleDeg: Double, radius: Float) =
    Offset((c.x + sin(angleDeg * PI / 180) * radius).toFloat(), (c.y - cos(angleDeg * PI / 180) * radius).toFloat())

private fun DrawScope.nowDot(c: Offset, ring: Float, accent: Color, glow: Color) {
    drawCircle(glow.copy(alpha = 0.35f), radius = ring * 1.0f, center = c)
    drawCircle(Color.White, radius = ring * 0.62f, center = c)
    drawCircle(accent, radius = ring * 0.62f, center = c, style = Stroke(3.dp.toPx()))
}

/**
 * The day as a 24-hour dial - the app's signature, echoing the watch icon. Noon
 * at the top, midnight at the bottom; each prayer's period is a coloured segment,
 * a glowing dot marks now, and the centre says where we are in the day.
 */
@Composable
fun DayDial(
    now: Instant, day: PrayerDay, nextFajr: Instant, zone: ZoneId,
    currentName: String, currentPrayer: Prayer, countdown: String, nextName: String,
    size: Dp, modifier: Modifier = Modifier,
) {
    val primary = Palette.primary
    val accent = Palette.accent
    val sunArc = Palette.sunArc
    val mid = midnight(day, zone)
    Box(modifier.size(size).semantics { contentDescription = "Now $currentName. $countdown until $nextName." },
        contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val ring = this.size.width * 0.085f
            val r = this.size.width / 2 - ring / 2 - 2.dp.toPx()
            val c = center
            drawCircle(primary.copy(alpha = 0.1f), radius = r, center = c, style = Stroke(ring))
            skySegments(day, nextFajr, mid, r, ring, currentPrayer, 1f)
            // Quarter ticks: midnight, 6, noon, 18.
            for (q in 0 until 4) {
                val a = q * 90.0
                drawLine(primary.copy(alpha = 0.35f), point(c, a, r - ring / 2 - 6.dp.toPx()), point(c, a, r - ring / 2 - 13.dp.toPx()),
                    strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
            }
            nowDot(point(c, dialAngle(now, mid), r), ring, accent, sunArc)
        }
        // Sun at noon, moon at midnight, as quiet markers inside the ring.
        Icon(Icons.Filled.WbSunny, null, Modifier.size(size * 0.08f).offset(y = -size * 0.3f), tint = sunArc)
        Icon(Icons.Filled.DarkMode, null, Modifier.size(size * 0.07f).offset(y = size * 0.3f), tint = primary.copy(alpha = 0.35f))
        Column(Modifier.padding(horizontal = size * 0.18f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(currentName, style = display((size.value * 0.14f).sp, FontWeight.Bold), color = primary, maxLines = 1, softWrap = false)
            Text(countdown, style = display((size.value * 0.1f).sp, FontWeight.SemiBold), color = accent, maxLines = 1)
            Text("until $nextName", fontFamily = Rounded, fontSize = (size.value * 0.065f).sp, fontWeight = FontWeight.Medium,
                color = Palette.secondary, maxLines = 1, textAlign = TextAlign.Center)
        }
    }
}

/** A time shown on the hero dial. */
data class DialMark(
    val id: String,
    val date: Instant,
    /** Blessed times are smaller and quieter than the five prayers. */
    val minor: Boolean = false,
    /** An extra line under the time (jamaah, a second source). */
    val extraLine: Boolean = false,
    val tint: Color = Color.Unspecified,
)

/**
 * The Day Dial as the hero of the Prayer screen (the "Day Dial" style): each
 * prayer's time sits just inside the ring at its hour like a watch's indices,
 * a glowing dot marks now, and the centre says where we are in the day.
 */
@Composable
fun HeroDial(
    now: Instant, day: PrayerDay, nextFajr: Instant, zone: ZoneId,
    /** Highlighted segment and the now-dot; null when showing another day. */
    currentPrayer: Prayer?,
    marks: List<DialMark>,
    modifier: Modifier = Modifier,
    label: @Composable (DialMark, Dp) -> Unit,
    centre: @Composable (Dp) -> Unit,
) {
    val primary = Palette.primary
    val accent = Palette.accent
    val sunArc = Palette.sunArc
    val mid = midnight(day, zone)
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val size = minOf(maxWidth, maxHeight)
        Box(Modifier.size(size).aspectRatio(1f), contentAlignment = Alignment.Center) {
            val ringDp = size * 0.042f
            val rDp = size / 2 - ringDp * 0.65f - 1.dp
            val innerDp = rDp - ringDp * 0.65f - size * 0.015f
            Box(Modifier.size(size - ringDp * 2.6f).background(primary.copy(alpha = 0.04f), CircleShape))
            Canvas(Modifier.fillMaxSize()) {
                val ring = ringDp.toPx()
                val r = rDp.toPx()
                val c = center
                drawCircle(primary.copy(alpha = 0.08f), radius = r, center = c, style = Stroke(ring))
                skySegments(day, nextFajr, mid, r, ring, currentPrayer, 0.8f)
                // An index inside the ring at each mark's true time (its label may be nudged aside).
                for (m in marks) {
                    val a = dialAngle(m.date, mid)
                    val inner = r - ring * 0.65f - 2.dp.toPx()
                    drawLine(if (m.minor) primary.copy(alpha = 0.35f) else m.tint,
                        point(c, a, inner), point(c, a, inner - (if (m.minor) 3 else 6).dp.toPx()),
                        strokeWidth = (if (m.minor) 1.5f else 2.5f).dp.toPx(), cap = StrokeCap.Round)
                }
                if (currentPrayer != null) nowDot(point(c, dialAngle(now, mid), r), ring * 1.05f / 1.0f, accent, sunArc)
            }
            val spots = layoutMarks(marks, mid, size, innerDp)
            for (m in marks) {
                val spot = spots[m.id] ?: continue
                val box = labelSize(m, size)
                Box(
                    Modifier
                        .size(box.first, box.second)
                        .offset { IntOffset((spot.first - box.first / 2).roundToPx(), (spot.second - box.second / 2).roundToPx()) }
                        .align(Alignment.TopStart),
                    contentAlignment = Alignment.Center,
                ) { label(m, size) }
            }
            Box(Modifier.width(size * 0.34f), contentAlignment = Alignment.Center) { centre(size) }
        }
    }
}

/** A label's footprint, as a fraction of the dial. */
internal fun labelSize(mark: DialMark, size: Dp): Pair<Dp, Dp> =
    if (mark.minor) size * 0.22f to size * 0.095f else size * 0.23f to size * (if (mark.extraLine) 0.155f else 0.12f)

/**
 * Where each label goes: just inside the ring at its time, its outer edge touching
 * the inner circle, then nudged apart along the circle when two would overlap
 * (Maghrib and Isyak are only ~20° apart).
 */
private fun layoutMarks(marks: List<DialMark>, midnight: Instant, size: Dp, inner: Dp): Map<String, Pair<Dp, Dp>> {
    val sorted = marks.sortedBy { dialAngle(it.date, midnight) % 360 }
    if (sorted.isEmpty()) return emptyMap()
    val angles = sorted.map { dialAngle(it.date, midnight) % 360 }.toMutableList()
    val s = size.value
    val inr = inner.value
    fun spot(i: Int): Pair<Float, Float> {
        val (bw, bh) = labelSize(sorted[i], size)
        val rad = angles[i] * PI / 180
        val inset = abs(sin(rad)) * bw.value / 2 + abs(cos(rad)) * bh.value / 2
        return (s / 2 + sin(rad) * (inr - inset)).toFloat() to (s / 2 - cos(rad) * (inr - inset)).toFloat()
    }
    val n = sorted.size
    if (n > 1) {
        repeat(120) {
            var moved = false
            for (i in 0 until n) {
                val j = (i + 1) % n
                val p = spot(i)
                val q = spot(j)
                val a = labelSize(sorted[i], size)
                val b = labelSize(sorted[j], size)
                if (abs(p.first - q.first) < (a.first.value + b.first.value) / 2 + 2 &&
                    abs(p.second - q.second) < (a.second.value + b.second.value) / 2 + 2) {
                    angles[i] -= 0.5
                    angles[j] += 0.5
                    moved = true
                }
            }
            if (!moved) return@repeat
        }
    }
    return sorted.indices.associate { i -> sorted[i].id to spot(i).let { it.first.dp to it.second.dp } }
}
