package com.prayertimesasia.app.ui.theme

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.dp
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.epochSeconds
import java.time.Instant
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * The signature of the app: the background is the sky outside, right now.
 * prayertime.sg gave each prayer a colour band; here those colours flow into
 * each other through the day, keyed to the real prayer times at your location.
 */
data class RGB(val r: Double, val g: Double, val b: Double) {
    constructor(hex: Long) : this(((hex shr 16) and 0xFF) / 255.0, ((hex shr 8) and 0xFF) / 255.0, (hex and 0xFF) / 255.0)

    fun mix(other: RGB, t: Double) = RGB(r + (other.r - r) * t, g + (other.g - g) * t, b + (other.b - b) * t)
    val color: Color get() = Color(r.toFloat(), g.toFloat(), b.toFloat())
    val argb: Int get() = color.let { android.graphics.Color.argb(255, (r * 255).toInt(), (g * 255).toInt(), (b * 255).toInt()) }
}

data class SkyColors(val top: RGB, val bottom: RGB, /** The "now" highlight and the sun. */ val glow: RGB) {
    /** Light appearance: the same sky, washed bright so dark text reads on it. */
    val daylight: SkyColors get() = SkyColors(top.mix(WHITE, 0.62), bottom.mix(WHITE, 0.8), glow)

    /** Automatic appearance after dark: the night sky lifted towards twilight - dim and restful. */
    val softNight: SkyColors get() = SkyColors(top.mix(RGB(0x5C6190), 0.42), bottom.mix(RGB(0x8483B0), 0.4), glow)

    /** 0 in daylight → 1 in full night, from how dark the top of the sky is. */
    val darkness: Double
        get() {
            val luminance = 0.2126 * top.r + 0.7152 * top.g + 0.0722 * top.b
            return min(1.0, max(0.0, (0.22 - luminance) / 0.16))
        }

    /** The sky as drawn for a scheme: daylight wash, soft night or full dark. */
    fun forScheme(scheme: SkyScheme): SkyColors = when {
        !scheme.dark -> daylight
        scheme.softNight -> softNight
        else -> this
    }

    companion object {
        private val WHITE = RGB(0xFFFFFF)
        fun mix(a: SkyColors, b: SkyColors, t: Double) = SkyColors(a.top.mix(b.top, t), a.bottom.mix(b.bottom, t), a.glow.mix(b.glow, t))

        val night = SkyColors(RGB(0x060A1C), RGB(0x1A1E48), RGB(0x9AA6FF))
        val preDawn = SkyColors(RGB(0x0C1A3A), RGB(0x3D4E80), RGB(0x8FB4FF))
        val dawn = SkyColors(RGB(0x2F5E99), RGB(0xF0A07E), RGB(0xFFC59A))
        val morning = SkyColors(RGB(0x2D7FC4), RGB(0x9CD2EE), RGB(0xFFE7A6))
        val noon = SkyColors(RGB(0x166FC2), RGB(0x6FBDE8), RGB(0xFFF1B8))
        val afternoon = SkyColors(RGB(0x3D78B8), RGB(0xE9C27A), RGB(0xFFD27A))
        val goldenHour = SkyColors(RGB(0x5E4A93), RGB(0xF2955A), RGB(0xFFB36B))
        val dusk = SkyColors(RGB(0x2E2260), RGB(0xD9573F), RGB(0xFF8A65))
        val evening = SkyColors(RGB(0x10153A), RGB(0x302C6E), RGB(0xB4A6FF))

        /** Keyframes pinned to the day's real times, interpolated in between. */
        fun at(now: Instant, day: PrayerDay): SkyColors {
            fun t(p: Prayer) = day.time(p).epochSeconds()
            val x = now.epochSeconds()
            val frames = listOf(
                t(Prayer.FAJR) - 3 * 3600 to night,
                t(Prayer.FAJR) to preDawn,
                t(Prayer.SUNRISE) to dawn,
                t(Prayer.SUNRISE) + 5400 to morning,
                t(Prayer.DHUHR) to noon,
                t(Prayer.ASR) to afternoon,
                t(Prayer.MAGHRIB) - 2400 to goldenHour,
                t(Prayer.MAGHRIB) to dusk,
                t(Prayer.ISHA) to evening,
                t(Prayer.ISHA) + 3 * 3600 to night,
            )
            if (x <= frames.first().first || x >= frames.last().first) return night
            for (i in 0 until frames.size - 1) {
                if (x >= frames[i].first && x < frames[i + 1].first) {
                    val span = frames[i + 1].first - frames[i].first
                    val f = if (span > 0) (x - frames[i].first) / span else 0.0
                    // Ease so transitions linger at each keyframe, like real light.
                    val eased = f * f * (3 - 2 * f)
                    return mix(frames[i].second, frames[i + 1].second, eased)
                }
            }
            return night
        }
    }
}

/** A fixed field of stars that fades in as the sky darkens. Deliberately still. */
@Composable
fun StarField(alpha: Float, modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        if (alpha <= 0.01f) return@Canvas
        var seed: ULong = 0x9E3779B97F4A7C15UL
        fun next(): Double {
            seed = seed * 6364136223846793005UL + 1442695040888963407UL
            return (seed shr 33).toDouble() / (1L shl 31).toDouble()
        }
        repeat(90) {
            val x = next() * size.width
            val y = next().pow(1.6) * size.height * 0.7 // denser near the top
            val r = (0.4 + next() * 1.1) * density
            val a = 0.25 + next() * 0.6
            drawCircle(Color.White.copy(alpha = (a * alpha).toFloat().coerceIn(0f, 1f)), radius = r.toFloat(),
                center = Offset(x.toFloat(), y.toFloat()))
        }
    }
}

/** The Living Sky behind every tab. */
@Composable
fun LivingSkyBackground(colors: SkyColors, modifier: Modifier = Modifier) {
    val scheme = LocalSkyScheme.current
    val c = colors.forScheme(scheme)
    Box(modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize()) {
            drawRect(Brush.verticalGradient(listOf(c.top.color, c.bottom.color)))
        }
        if (scheme.dark) {
            StarField((colors.darkness * if (scheme.softNight) 0.6 else 1.0).toFloat())
        } else {
            BrightSkyLayer(isDay = colors.darkness < 0.5, glow = c.glow.color, still = scheme.reduceMotion)
        }
        // Soft horizon glow - the one atmospheric touch; no particles, no noise.
        Canvas(Modifier.fillMaxSize()) {
            val center = Offset(size.width * 0.5f, size.height * 1.05f)
            drawRect(Brush.radialGradient(listOf(c.glow.color.copy(alpha = 0.35f), Color.Transparent),
                center = center, radius = 420.dp.toPx()))
        }
    }
}

/**
 * Light appearance only: a softly breathing sun (or moon after dark) and a few
 * clouds drifting very slowly. Still when animations are off.
 */
@Composable
fun BrightSkyLayer(isDay: Boolean, glow: Color, still: Boolean) {
    val t: Float = if (still) 0f else {
        val transition = rememberInfiniteTransition(label = "sky")
        val v by transition.animateFloat(0f, 3600f, infiniteRepeatable(tween(3_600_000, easing = LinearEasing), RepeatMode.Restart), label = "t")
        v
    }
    Canvas(Modifier.fillMaxSize()) {
        val w = size.width
        drawOrb(Offset(w * 0.84f, 96.dp.toPx()), isDay, glow, t)
        cloud(220f, t, 7f, 170f, 0f)
        cloud(150f, t, 4.5f, 300f, 0.45f)
        cloud(260f, t, 5.5f, 520f, 0.8f)
    }
}

private fun DrawScope.drawOrb(c: Offset, isDay: Boolean, glow: Color, t: Float) {
    val breathe = 1f + 0.05f * sin(t / 2.6f)
    val core = if (isDay) Color(1f, 0.86f, 0.55f) else Color(0.86f, 0.88f, 1f)
    val halo = 190.dp.toPx() * breathe
    drawCircle(Brush.radialGradient(listOf(core.copy(alpha = if (isDay) 0.55f else 0.4f), glow.copy(alpha = 0.18f), Color.Transparent),
        center = c, radius = halo), radius = halo, center = c)
    if (isDay) {
        // Faint rays, turning about one degree a second.
        rotate(t % 360f, pivot = c) {
            val rays = 150.dp.toPx()
            for (i in 0 until 8) {
                rotate(i * 45f, pivot = c) {
                    drawArc(Brush.radialGradient(listOf(core.copy(alpha = 0.16f), Color.Transparent), center = c, radius = rays),
                        startAngle = -11f, sweepAngle = 22f, useCenter = true,
                        topLeft = Offset(c.x - rays, c.y - rays), size = Size(rays * 2, rays * 2))
                }
            }
        }
    }
    val disc = 32.dp.toPx()
    drawCircle(Brush.radialGradient(listOf(core.copy(alpha = 0.8f), Color.Transparent), center = c, radius = disc * 1.9f), radius = disc * 1.9f, center = c)
    drawCircle(Brush.radialGradient(listOf(Color.White, core), center = c, radius = disc), radius = disc, center = c)
}

private fun DrawScope.cloud(widthDp: Float, t: Float, speed: Float, yDp: Float, phase: Float) {
    val width = widthDp * density
    val w = size.width
    val span = w + width * 2
    val x = ((t * speed * density + phase * span) % span) - width
    val y = yDp * density
    val puff = Color.White.copy(alpha = 0.45f)
    fun puffAt(cx: Float, cy: Float, rx: Float, ry: Float) {
        val r = max(rx, ry)
        drawOval(Brush.radialGradient(listOf(puff, puff.copy(alpha = 0.2f), Color.Transparent), center = Offset(cx, cy), radius = r),
            topLeft = Offset(cx - rx, cy - ry), size = Size(rx * 2, ry * 2))
    }
    puffAt(x + width / 2, y, width / 2, width * 0.16f)
    puffAt(x + width / 2 - width * 0.12f, y - width * 0.12f, width * 0.28f, width * 0.18f)
    puffAt(x + width / 2 + width * 0.18f, y - width * 0.08f, width * 0.22f, width * 0.15f)
}
