package com.prayertimesasia.app.ui.falak

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.TextButton
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.HadithView
import com.prayertimesasia.app.ui.components.LookIcons
import com.prayertimesasia.app.ui.components.lookCard
import com.prayertimesasia.app.ui.components.lookText
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.app.ui.theme.Look
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.Falak
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.secondsSince
import java.time.Instant
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

// Falak for everyone (Nov 2026): the sky slider, the "Then" story and "Why it helps",
// in the five looks as on the web app (web/src/ui/Falak.tsx, the `.v12f` blocks).

/** A picture of today's sky you can slide. East is on the left, so the sun moves the same way as the finger. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SkySliderCard(state: AppState, place: Place, now: Instant) {
    val look = LocalLook.current
    val r = state.resolver
    val day = r.day(now) ?: return
    val (start, end) = skyRange(day.time(Prayer.FAJR), day.time(Prayer.ISHA), now)
    val span = end.secondsSince(start).toFloat() / 60f
    val clock = (now.secondsSince(start).toFloat() / 60f).coerceIn(0f, span)
    var picked by remember { mutableStateOf<Float?>(null) }
    val t = start.plusSeconds(((picked ?: clock) * 60).toLong())
    val stage = Falak.skyStage(t, day.times)
    val d = t.atZone(r.zone).toLocalDate()
    val plan = remember(d, place.coordinates) { Falak.shadowDay(d.year, d.monthValue, d.dayOfMonth, place.coordinates) }
    val haptic = LocalHapticFeedback.current
    LaunchedEffect(stage) { if (picked != null) haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
    val n = { p: Prayer -> p.name(r.naming) }
    val (title, say) = when (stage) {
        Falak.SkyStage.NIGHT -> tr(R.string.falak_stageNight) to tr(R.string.falak_stageNightSay, "name" to n(Prayer.FAJR))
        Falak.SkyStage.FAJR -> n(Prayer.FAJR) to tr(R.string.falak_stageFajrSay, "name" to n(Prayer.FAJR))
        Falak.SkyStage.SUNRISE -> tr(R.string.falak_stageSunrise) to tr(R.string.falak_stageSunriseSay, "name" to n(Prayer.FAJR))
        Falak.SkyStage.MORNING -> tr(R.string.falak_stageMorning) to tr(R.string.falak_stageMorningSay)
        Falak.SkyStage.DHUHR -> n(Prayer.DHUHR) to tr(R.string.falak_stageDhuhrSay)
        Falak.SkyStage.ASR -> n(Prayer.ASR) to tr(R.string.falak_stageAsrSay)
        Falak.SkyStage.MAGHRIB -> n(Prayer.MAGHRIB) to tr(R.string.falak_stageMaghribSay)
        Falak.SkyStage.ISHA -> n(Prayer.ISHA) to tr(R.string.falak_stageIshaSay)
    }
    val words = SkyWords(tr(R.string.falak_east).uppercase(), tr(R.string.falak_west).uppercase(), tr(R.string.falak_shadowLabel), n(Prayer.ASR))
    // Colour Bands: the sky runs edge to edge, square, with hairlines top and bottom only.
    val card = if (look.bands) Modifier.wideBy(Dims.gutter).background(look.c.card)
    else Modifier.fillMaxWidth().lookCard(look)
    Column(card) {
        if (look.bands) Box(Modifier.fillMaxWidth().height(1.dp).background(look.c.sep))
        SkyPicture(look, day, plan, t, place, r.asrSchool, words,
            Modifier.fillMaxWidth().aspectRatio(SKY_W / SKY_H).semantics { contentDescription = "$title. $say" })
        Column(Modifier.padding(start = if (look.bands) 24.dp else 18.dp, end = if (look.bands) 24.dp else 18.dp, top = 12.dp, bottom = 8.dp)) {
            Text(r.formatted(t), style = lookText(13.sp, FontWeight.Medium), color = look.c.tx2)
            Text(title, style = display(if (look.simple) 34.sp else 28.sp, FontWeight.Bold), color = look.c.tx)
            Text(say, style = lookText(15.sp), color = look.c.tx2, modifier = Modifier.padding(top = 2.dp))
            val label = tr(R.string.falak_slideSun)
            Slider(
                value = picked ?: clock, onValueChange = { picked = it }, valueRange = 0f..span,
                colors = SliderDefaults.colors(thumbColor = Color.White, activeTrackColor = look.c.sep, inactiveTrackColor = look.c.sep),
                thumb = { Box(Modifier.size(24.dp).shadow(3.dp, CircleShape).clip(CircleShape).background(Color.White)) },
                track = { Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(look.c.sep)) },
                modifier = Modifier.semantics { contentDescription = label },
            )
            // After sliding, one tap brings the sun back to the time now.
            if (picked != null) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    TextButton(onClick = { picked = null }, modifier = Modifier.heightIn(min = 48.dp)) {
                        Text(tr(R.string.common_now), style = lookText(15.sp, FontWeight.SemiBold), color = look.c.accentText)
                    }
                }
            }
        }
        if (look.bands) Box(Modifier.fillMaxWidth().height(1.dp).background(look.c.sep))
    }
}

/**
 * The slider's day: 45 minutes before Fajr to 45 minutes after Isha, stretched to
 * include the time now, so the slider always opens on now (late at night too).
 */
internal fun skyRange(fajr: Instant, isha: Instant, now: Instant): Pair<Instant, Instant> {
    val start = fajr.minusSeconds(2700L).let { if (now < it) now else it }
    val end = isha.plusSeconds(2700L).let { if (now > it) now else it }
    return start to end
}

private const val SKY_W = 343f
private const val SKY_H = 170f
private const val GY = 132f
private const val STICK_X = 172f
private const val STICK = 44f

private class SkyWords(val east: String, val west: String, val shadow: String, val asr: String)

private fun mix(a: IntArray, b: IntArray, k: Double): Color {
    val f = k.coerceIn(0.0, 1.0)
    val c = IntArray(3) { (a[it] + (b[it] - a[it]) * f).roundToInt() }
    return Color(c[0], c[1], c[2])
}

/** Sky colours for a sun `alt` degrees up, at a given stage (the web's skyColours). */
private fun skyColours(alt: Double, stage: Falak.SkyStage, k: Double): Pair<Color, Color> {
    val night = intArrayOf(10, 18, 42)
    val dusk = intArrayOf(30, 40, 90)
    if (stage == Falak.SkyStage.FAJR) return mix(night, intArrayOf(40, 80, 150), k) to mix(intArrayOf(110, 130, 175), intArrayOf(235, 240, 248), k)
    if (alt > 0) {
        val d = min(1.0, alt / 25)
        return mix(intArrayOf(62, 100, 170), intArrayOf(31, 95, 191), d) to mix(intArrayOf(240, 170, 110), intArrayOf(143, 195, 240), d)
    }
    if (stage == Falak.SkyStage.MAGHRIB) return mix(dusk, night, k) to mix(intArrayOf(226, 104, 60), intArrayOf(30, 45, 85), k)
    return Color(10, 18, 42) to Color(24, 36, 74)
}

private fun DrawScope.label(tm: TextMeasurer, t: String, x: Float, baseline: Float, size: Float, weight: FontWeight, color: Color,
                            align: TextAlign = TextAlign.Center) {
    val m = tm.measure(t, TextStyle(fontFamily = Rounded, fontSize = size.toSp(), fontWeight = weight, color = color))
    val left = when (align) { TextAlign.Start -> x; TextAlign.End -> x - m.size.width; else -> x - m.size.width / 2f }
    drawText(m, topLeft = Offset(left, baseline - m.firstBaseline))
}

@Composable
private fun SkyPicture(look: Look, day: PrayerDay, plan: Falak.ShadowDay, t: Instant, place: Place,
                       school: AsrSchool, words: SkyWords, modifier: Modifier) {
    val tm = rememberTextMeasurer()
    Canvas(modifier) {
        val k0 = size.width / SKY_W
        withTransform({ scale(k0, k0, Offset.Zero) }) {
            val times = day.times
            val stage = Falak.skyStage(t, times)
            val sun = Falak.sunPosition(t, place.coordinates)
            val fajr = day.time(Prayer.FAJR)
            val rise = day.time(Prayer.SUNRISE)
            val maghrib = day.time(Prayer.MAGHRIB)
            val isha = day.time(Prayer.ISHA)
            val k = when (stage) {
                Falak.SkyStage.FAJR -> t.secondsSince(fajr) / max(rise.secondsSince(fajr), 1.0)
                Falak.SkyStage.MAGHRIB -> t.secondsSince(maghrib) / max(isha.secondsSince(maghrib), 1.0)
                else -> 0.0
            }
            val (top, bottom) = skyColours(sun.altitude, stage, k)
            val p = t.secondsSince(rise) / max(maghrib.secondsSince(rise), 1.0)
            val sx = 16f + (SKY_W - 32f) * p.toFloat()
            val sy = GY - (GY - 22f) * max(0.0, sin(min(90.0, sun.altitude) * PI / 180)).toFloat()
            val morning = t < plan.noon
            val shadow = if (sun.altitude > 2) min(150f, STICK * Falak.shadowLength(1.0, sun.altitude).toFloat()) else 0f
            val asrX = STICK_X - STICK * plan.asrShadow(1.0, school).toFloat()
            val dark = sun.altitude <= 0 && stage != Falak.SkyStage.FAJR
            // In daylight the sky takes the look's own colours, as in the mockup. Dawn, dusk and night keep their real colours.
            val lit = sun.altitude > 0 && stage != Falak.SkyStage.FAJR && stage != Falak.SkyStage.MAGHRIB
            val ink = if (lit) look.c.stick else Color.White
            val groundInk = if (look.bands) Color(0xFF1D1D20) else look.c.stick
            val shadowInk = when {
                look.bands -> Color.White
                look.gold && !look.dark -> look.c.accentText
                else -> look.c.accent
            }
            drawRect(Brush.verticalGradient(listOf(if (lit) look.c.sky1 else top, if (lit) look.c.sky2 else bottom), 0f, SKY_H), size = Size(SKY_W, SKY_H))
            if (dark) for (i in 0 until 14) drawCircle(Color.White.copy(alpha = 0.7f), 1.2f, Offset(((i * 73) % SKY_W.toInt()).toFloat(), ((i * 37) % 100 + 8).toFloat()))
            if (stage == Falak.SkyStage.FAJR) {
                val rx = (110 + 60 * k).toFloat()
                val ry = (8 + 8 * k).toFloat()
                drawOval(Color.White.copy(alpha = (0.5 + 0.35 * k).toFloat().coerceIn(0f, 1f)), Offset(50 - rx, GY - ry), Size(2 * rx, 2 * ry))
            }
            if (stage == Falak.SkyStage.MAGHRIB) {
                val ry = (22 * (1 - k)).toFloat().coerceAtLeast(0f)
                drawOval(Color(0xFFFF5A2A).copy(alpha = (0.75 * (1 - k)).toFloat().coerceIn(0f, 1f)), Offset(SKY_W - 50 - 150, GY - ry), Size(300f, 2 * ry))
            }
            val arc = Path().apply { moveTo(16f, GY); quadraticBezierTo(SKY_W / 2, -20f, SKY_W - 16, GY) }
            drawPath(arc, ink.copy(alpha = if (lit) 0.6f else 0.3f), style = Stroke(1.2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f, 5f))))
            if (lit) {
                drawCircle(look.c.accent.copy(alpha = 0.28f), 26f, Offset(sx, sy))
                drawCircle(look.c.accent, 15f, Offset(sx, sy))
            } else if (sun.altitude > -1) {
                drawCircle(Brush.radialGradient(0f to Color(0xFFFFF7D6), 0.45f to Color(0xFFFFD66B), 1f to Color(0x00FFD66B), center = Offset(sx, sy), radius = 26f), 26f, Offset(sx, sy))
                drawCircle(Color(0xFFFFF4C4), 10f, Offset(sx, sy))
            }
            drawRect(if (lit) look.c.ground else if (dark) Color(0xFF2B281F) else Color(0xFFE8D6AE), Offset(0f, GY), Size(SKY_W, SKY_H - GY))
            val shadowEnd = STICK_X + (if (morning) 1 else -1) * shadow
            if (shadow > 0) {
                if (lit) {
                    drawLine(shadowInk, Offset(STICK_X, GY), Offset(shadowEnd, GY), 3f)
                    // The word steps aside for the Asr mark late in the day, so the two never cross.
                    if (morning || abs((STICK_X + shadowEnd) / 2 - asrX) > 34) label(tm, words.shadow, (STICK_X + shadowEnd) / 2, GY + 15, 11f, FontWeight.Bold, groundInk)
                } else {
                    val sp = Path().apply { moveTo(STICK_X, GY); lineTo(shadowEnd, GY + 3); lineTo(shadowEnd, GY + 5); lineTo(STICK_X, GY + 3); close() }
                    drawPath(sp, Color.Black.copy(alpha = 0.38f))
                }
            }
            if (!morning && sun.altitude > 0) {
                drawLine(if (lit) ink else Color.White, Offset(asrX, GY - 4), Offset(asrX, GY + 12), 2f)
                label(tm, words.asr, asrX, GY + 31, 10f, FontWeight.SemiBold, if (lit) groundInk else Color(0xFF3A3A3C))
            }
            drawRoundRect(if (lit) look.c.stick else if (dark) Color(0xFFBBBBBB) else Color(0xFF3A3A3C), Offset(STICK_X - 1.5f, GY - STICK), Size(3f, STICK),
                androidx.compose.ui.geometry.CornerRadius(1.5f))
            val sideInk = ink.copy(alpha = if (lit) 1f else 0.8f)
            label(tm, words.east, 12f, GY - 7, 10f, FontWeight.Bold, sideInk, TextAlign.Start)
            label(tm, words.west, SKY_W - 12, GY - 7, 10f, FontWeight.Bold, sideInk, TextAlign.End)
        }
    }
}

// MARK: Then

@Composable
fun ThenStory(state: AppState) {
    val n = { p: Prayer -> p.name(state.resolver.naming) }
    StoryCard(1, tr(R.string.falak_then1Title), tr(R.string.falak_then1)) {
        HadithView(state, HadithId.FALAK_JIBRIL, line = true)
    }
    StoryCard(2, tr(R.string.falak_then2Title), tr(R.string.falak_then2, "dhuhr" to n(Prayer.DHUHR), "asr" to n(Prayer.ASR)), tr(R.string.falak_then2Word)) {
        HadithView(state, HadithId.FALAK_FEET, line = true)
    }
    StoryCard(3, tr(R.string.falak_then3Title), tr(R.string.falak_then3, "isha" to n(Prayer.ISHA), "fajr" to n(Prayer.FAJR)), tr(R.string.falak_then3Word)) {
        HadithView(state, HadithId.FALAK_DAWN, line = true)
    }
    StoryCard(4, tr(R.string.falak_then4Title), tr(R.string.falak_then4), tr(R.string.falak_then4Word))
    StoryCard(5, tr(R.string.falak_then5Title), tr(R.string.falak_then5))
}

@Composable
private fun StoryCard(pic: Int, title: String, text: String, word: String? = null, extra: @Composable () -> Unit = {}) {
    val look = LocalLook.current
    Column(Modifier.fillMaxWidth().lookCard(look).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        StoryPic(pic, Modifier.fillMaxWidth().aspectRatio(300f / 96f).clip(RoundedCornerShape(14.dp)))
        Text(title, style = lookText(17.sp, FontWeight.SemiBold), color = look.c.tx, modifier = Modifier.padding(top = 8.dp))
        Text(text, style = lookText(15.sp), color = look.c.tx2)
        if (word != null) Text(word, style = lookText(13.sp), color = look.c.accentText, modifier = Modifier.padding(top = 4.dp))
        extra()
    }
}

/** The five little pictures of the Then story, drawn as on the web. */
@Composable
private fun StoryPic(kind: Int, modifier: Modifier) {
    Canvas(modifier) {
        val k = size.width / 300f
        withTransform({ scale(k, k, Offset.Zero) }) {
            val sand = Color(0xFFD8C39A)
            val gold = Color(0xFFE8B64A)
            fun bg(c: Long) = drawRect(Color(c), size = Size(300f, 96f))
            when (kind) {
                1 -> {
                    bg(0xFF1D3A6E)
                    drawCircle(Color(0xFFFFD66B), 13f, Offset(244f, 26f))
                    drawRect(sand, Offset(0f, 72f), Size(300f, 24f))
                    drawRect(Color(0xFF111111), Offset(121f, 36f), Size(58f, 38f))
                    drawRect(gold, Offset(121f, 44f), Size(58f, 4f))
                    listOf(72f, 94f, 214f).forEach { x ->
                        val c = Color(0xFFF4F1EA).copy(alpha = 0.9f)
                        drawCircle(c, 5.5f, Offset(x, 56f))
                        drawRoundRect(c, Offset(x - 4.5f, 62f), Size(9f, 11f), androidx.compose.ui.geometry.CornerRadius(3f))
                    }
                }
                2 -> {
                    bg(0xFF3F7AC0)
                    drawCircle(Color(0xFFFFE08A), 12f, Offset(252f, 22f))
                    drawRect(sand, Offset(0f, 70f), Size(300f, 26f))
                    drawRoundRect(Color(0xFF3A3A3C), Offset(148f, 26f), Size(4f, 46f), androidx.compose.ui.geometry.CornerRadius(2f))
                    drawPath(Path().apply { moveTo(150f, 71f); lineTo(72f, 77f); lineTo(72f, 80f); lineTo(150f, 73f); close() }, Color.Black.copy(alpha = 0.4f))
                    listOf(78f, 98f, 118f).forEach { x -> drawOval(Color(0xFF5A3B1C), Offset(x - 8, 84.5f), Size(16f, 7f)) }
                }
                3 -> {
                    drawRect(Brush.verticalGradient(0f to Color(0xFF0B1530), 0.7f to Color(0xFF5A2A50), 1f to Color(0xFFE2683C), startY = 0f, endY = 96f), size = Size(150f, 96f))
                    drawRect(Brush.verticalGradient(0f to Color(0xFF0B1530), 0.75f to Color(0xFF3B5A8A), 1f to Color(0xFFE9EEF7), startY = 0f, endY = 96f), Offset(150f, 0f), Size(150f, 96f))
                    drawRect(Color(0xFF0A0F1E), Offset(0f, 82f), Size(300f, 14f))
                }
                4 -> {
                    bg(0xFF2B4A7E)
                    drawCircle(gold, 30f, Offset(150f, 48f), style = Stroke(3f))
                    drawCircle(gold, 20f, Offset(150f, 48f), style = Stroke(1f))
                    drawLine(gold, Offset(150f, 18f), Offset(150f, 78f), 1f)
                    drawLine(gold, Offset(120f, 48f), Offset(180f, 48f), 1f)
                    drawLine(Color.White, Offset(150f, 48f), Offset(171f, 28f), 2f)
                }
                else -> {
                    bg(0xFF3F7AC0)
                    drawCircle(Color(0xFFFFD66B), 10f, Offset(150f, 16f))
                    drawRect(sand, Offset(0f, 70f), Size(300f, 26f))
                    drawRect(Color(0xFF111111), Offset(132f, 42f), Size(36f, 30f))
                    drawRect(gold, Offset(132f, 48f), Size(36f, 3f))
                    drawRect(Color(0xFF3A3A3C), Offset(60f, 48f), Size(3f, 24f))
                    drawPath(Path().apply { moveTo(61f, 71f); lineTo(20f, 74f); lineTo(20f, 76f); lineTo(61f, 73f); close() }, Color.Black.copy(alpha = 0.4f))
                    drawRect(Color(0xFF3A3A3C), Offset(238f, 48f), Size(3f, 24f))
                    drawPath(Path().apply { moveTo(240f, 71f); lineTo(282f, 74f); lineTo(282f, 76f); lineTo(240f, 73f); close() }, Color.Black.copy(alpha = 0.4f))
                }
            }
        }
    }
}

// MARK: Why it helps

@Composable
fun WhyItHelps() {
    val look = LocalLook.current
    val group = if (look.bands) Modifier.wideBy(Dims.gutter) else Modifier.fillMaxWidth().lookCard(look)
    Column(group) {
        WhyRow("eye", tr(R.string.falak_why1Title), tr(R.string.falak_why1), first = true)
        WhyRow("compass", tr(R.string.falak_why2Title), tr(R.string.falak_why2))
        WhyRow("calendar", tr(R.string.falak_why3Title), tr(R.string.falak_why3))
        WhyRow("landmark", tr(R.string.falak_why4Title), tr(R.string.falak_why4))
    }
    // The gold card, as on the web (--gold, with dark words).
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(if (look.dark) Color(255, 214, 128) else Color(184, 128, 10)).padding(18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(tr(R.string.falak_authority), style = lookText(17.sp, FontWeight.SemiBold), color = Color(0xFF1A1407), textAlign = TextAlign.Center)
        Text(tr(R.string.falak_authoritySub), style = lookText(14.sp), color = Color(0xFF1A1407).copy(alpha = 0.85f), textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun WhyRow(icon: String, title: String, text: String, first: Boolean = false) {
    val look = LocalLook.current
    if (!first && !look.bands) Box(Modifier.fillMaxWidth().height(1.dp).background(look.c.sep))
    Row(Modifier.fillMaxWidth().padding(horizontal = if (look.bands) 24.dp else 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        FalakIco(LookIcons.get(icon, 2.4f))
        Column(Modifier.weight(1f)) {
            Text(title, style = lookText(17.sp), color = look.c.tx)
            Text(text, style = lookText(15.sp), color = look.c.tx2, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/** The tool icon: the look's soft tint with the icon in its accent (the web's `.falak-ico`). */
@Composable
fun FalakIco(icon: ImageVector, onBand: Boolean = false) {
    val look = LocalLook.current
    if (onBand) {
        Box(Modifier.size(24.dp, 30.dp), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(17.dp), tint = Color.White) }
    } else {
        Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).background(look.c.tint), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(17.dp), tint = look.c.accentText)
        }
    }
}

/** Lets a full width band run past the page's side margins, as the web's Colour Bands does. */
fun Modifier.wideBy(gutter: androidx.compose.ui.unit.Dp): Modifier = this.then(Modifier.layout { measurable, constraints ->
    val extra = (gutter * 2).roundToPx()
    val w = constraints.maxWidth + extra
    val p = measurable.measure(constraints.copy(minWidth = w, maxWidth = w))
    layout(constraints.maxWidth, p.height) { p.place(-extra / 2, 0) }
})

/** Big numbers in the tool rows. */
val StepsNumber = display(22.sp, FontWeight.Bold)
