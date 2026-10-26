package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.unit.dp
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.secondsSince
import java.time.Instant
import java.time.ZoneId
import kotlin.math.PI
import kotlin.math.cos

/**
 * The day as one smooth arc, local midnight to midnight, edge to edge: highest at
 * solar noon, crossing the horizon line at sunrise and sunset, with every prayer
 * marked at its time. Stylised on purpose - the real altitude curve is nearly
 * straight-sided in the tropics and reads as a mountain, not a day.
 */
@Composable
fun SunPath(now: Instant, day: PrayerDay, zone: ZoneId, glow: Color, modifier: Modifier = Modifier) {
    val primary = Palette.primary
    val start = day.date.atStartOfDay(zone).toInstant()
    fun fraction(d: Instant) = (d.secondsSince(start) / 86_400).coerceIn(0.0, 1.0)
    Canvas(modifier.fillMaxWidth()) {
        val w = size.width
        val h = size.height
        val noon = fraction(day.time(Prayer.DHUHR))
        // Half the day length, as a fraction of 24 h, from sunrise and Maghrib.
        val halfDay = (fraction(day.time(Prayer.MAGHRIB)) - fraction(day.time(Prayer.SUNRISE))) / 2
        val horizonValue = cos(2 * PI * halfDay)
        val top = 10.dp.toPx()
        val bottom = h - 6.dp.toPx()
        fun y(v: Double) = (bottom - ((v + 1) / 2) * (bottom - top)).toFloat()
        val horizon = y(horizonValue)
        fun point(f: Double) = Offset((f * w).toFloat(), y(cos(2 * PI * (f - noon))))
        val curve = Path().apply {
            moveTo(point(0.0).x, point(0.0).y)
            for (i in 1..240) point(i / 240.0).let { lineTo(it.x, it.y) }
        }
        drawLine(primary.copy(alpha = 0.14f), Offset(0f, horizon), Offset(w, horizon), strokeWidth = 1.dp.toPx())
        // Night part of the arc: quiet.
        drawPath(curve, primary.copy(alpha = 0.22f), style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
        // Day part: warm, clipped to above the horizon.
        clipRect(0f, 0f, w, horizon) {
            drawPath(curve, glow, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
        }
        for (p in Prayer.all) {
            val t = day.time(p)
            val c = point(fraction(t))
            val r = 4.5.dp.toPx()
            if (t <= now) drawCircle(primary.copy(alpha = 0.9f), r, c)
            drawCircle(primary.copy(alpha = 0.85f), r - 0.75.dp.toPx(), c, style = Stroke(1.5.dp.toPx()))
        }
        val isDay = now >= day.time(Prayer.SUNRISE) && now < day.time(Prayer.MAGHRIB)
        val sun = point(fraction(now))
        drawCircle(Brush.radialGradient(listOf(glow.copy(alpha = 0.45f), Color.Transparent), center = sun, radius = 17.dp.toPx()),
            radius = 17.dp.toPx(), center = sun)
        if (isDay) {
            drawCircle(glow, 7.dp.toPx(), sun)
        } else {
            // A crescent: a disc with a bite out of it.
            val r = 6.5.dp.toPx()
            val crescent = Path().apply {
                addOval(androidx.compose.ui.geometry.Rect(sun, r))
            }
            val bite = Path().apply { addOval(androidx.compose.ui.geometry.Rect(Offset(sun.x + r * 0.55f, sun.y - r * 0.35f), r * 0.85f)) }
            val moon = Path().apply { op(crescent, bite, androidx.compose.ui.graphics.PathOperation.Difference) }
            drawPath(moon, glow)
        }
    }
}

/** Unused-size guard so previews of zero height don't crash the arc maths. */
internal fun Size.isUsable() = width > 1f && height > 1f
