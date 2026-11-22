package com.prayertimesasia.app.ui.falak

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.SignalCellularConnectedNoInternet0Bar
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.WbTwilight
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.app.ui.components.HadithView
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.Falak
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.secondsSince
import java.time.Instant
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Falak for everyone (Nov 2026): the sky slider, the "Then" story and
// "Why it helps". Same words and pictures as the web app and iPhone.

/** A picture of today's sky you can slide. East is on the left, so the sun moves the same way as the finger. */
@Composable
fun SkySliderCard(state: AppState, place: Place, now: Instant) {
    val r = state.resolver
    val day = r.day(now) ?: return
    val start = day.time(Prayer.FAJR).minusSeconds(2700L)
    val end = day.time(Prayer.ISHA).plusSeconds(2700L)
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
    GlassCard(padding = 14.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SkyPicture(day, plan, t, place, r.asrSchool, n(Prayer.ASR),
                Modifier.fillMaxWidth().height(170.dp).clip(RoundedCornerShape(18.dp)))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = Txt.title3, color = Palette.primary, modifier = Modifier.weight(1f))
                Text(r.formatted(t), style = Txt.title3, color = Palette.primary.copy(alpha = 0.8f))
            }
            Text(say, style = Txt.subheadline, color = Palette.primary.copy(alpha = 0.85f))
            val label = tr(R.string.falak_slideSun)
            Slider(
                value = picked ?: clock, onValueChange = { picked = it }, valueRange = 0f..span,
                colors = SliderDefaults.colors(thumbColor = Palette.gold, activeTrackColor = Palette.gold),
                modifier = Modifier.semantics { contentDescription = label },
            )
            Row {
                Text(tr(R.string.falak_east), style = Txt.caption2, color = Palette.secondary)
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(label, style = Txt.captionSemibold, color = Palette.secondary)
                }
                Text(tr(R.string.falak_west), style = Txt.caption2, color = Palette.secondary)
            }
        }
    }
}

@Composable
private fun SkyPicture(day: PrayerDay, plan: Falak.ShadowDay, t: Instant, place: Place,
                       school: com.prayertimesasia.core.AsrSchool, asrWord: String, modifier: Modifier) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val px = density
        val ground = h * 0.78f
        val stickX = w / 2
        val stick = 44 * px
        val sun = Falak.sunPosition(t, place.coordinates)
        drawRect(Brush.verticalGradient(skyColors(sun.altitude), 0f, ground), size = Size(w, ground))
        if (sun.altitude < 4 && sun.altitude > -18) {
            val gx = if (t < plan.noon) 0f else w
            val glow = if (sun.altitude > -6) Color(1f, 0.45f, 0.3f) else Color.White
            drawCircle(Brush.radialGradient(listOf(glow.copy(alpha = 0.55f), Color.Transparent), Offset(gx, ground), w * 0.45f),
                radius = w * 0.45f, center = Offset(gx, ground))
        }
        drawRect(if (sun.altitude > 0) Color(0.36f, 0.55f, 0.33f) else Color(0.12f, 0.2f, 0.16f),
            topLeft = Offset(0f, ground), size = Size(w, h - ground))
        val rise = day.time(Prayer.SUNRISE)
        val set = day.time(Prayer.MAGHRIB)
        val f = (t.secondsSince(rise) / max(set.secondsSince(rise), 1.0)).coerceIn(0.0, 1.0)
        if (sun.altitude > -2) {
            val x = w * (0.06f + 0.88f * f.toFloat())
            val lift = max(sin(sun.altitude * PI / 180), 0.0) / max(sin(plan.noonAltitude * PI / 180), 0.2)
            val y = ground - (ground - 22 * px) * min(lift, 1.0).toFloat()
            val rr = 13 * px
            drawCircle(Brush.radialGradient(listOf(Color.Yellow.copy(alpha = 0.5f), Color.Transparent), Offset(x, y), rr * 2), rr * 2, Offset(x, y))
            drawCircle(Color(1f, 0.86f, 0.35f), rr, Offset(x, y))
        } else {
            drawCircle(Color.White.copy(alpha = 0.85f), 9 * px, Offset(w * 0.8f, 30 * px))
        }
        // Asr mark: the afternoon shadow points east, to the left.
        val asrX = stickX - stick * plan.asrShadow(1.0, school).toFloat()
        val markColor = Color(1f, 0.8f, 0.25f)
        drawLine(markColor, Offset(asrX, ground - 7 * px), Offset(asrX, ground + 9 * px), 3 * px, StrokeCap.Round)
        drawContext.canvas.nativeCanvas.drawText(asrWord, asrX, ground + 24 * px, android.graphics.Paint().apply {
            color = android.graphics.Color.rgb(255, 217, 102); textSize = 11 * px; textAlign = android.graphics.Paint.Align.CENTER
            isFakeBoldText = true; isAntiAlias = true
        })
        if (sun.altitude > 0.5) {
            val len = min(Falak.shadowLength(1.0, sun.altitude).toFloat() * stick, w)
            val endX = if (t >= plan.noon) stickX - len else stickX + len
            drawLine(Color.Black.copy(alpha = 0.55f), Offset(stickX, ground + 1), Offset(endX, ground + 1), 5 * px, StrokeCap.Round)
        }
        drawLine(Color(0.42f, 0.28f, 0.16f), Offset(stickX, ground), Offset(stickX, ground - stick), 4 * px, StrokeCap.Round)
    }
}

private fun skyColors(alt: Double): List<Color> = when {
    alt >= 8 -> listOf(Color(0.32f, 0.62f, 0.95f), Color(0.66f, 0.84f, 0.98f))
    alt >= 0 -> listOf(Color(0.35f, 0.5f, 0.85f), Color(1f, 0.7f, 0.45f))
    alt >= -6 -> listOf(Color(0.18f, 0.24f, 0.5f), Color(0.95f, 0.5f, 0.4f))
    alt >= -18 -> listOf(Color(0.06f, 0.1f, 0.28f), Color(0.25f, 0.3f, 0.55f))
    else -> listOf(Color(0.02f, 0.04f, 0.14f), Color(0.06f, 0.1f, 0.25f))
}

// MARK: Then

@Composable
fun ThenStory(state: AppState) {
    val n = { p: Prayer -> p.name(state.resolver.naming) }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        StoryCard(Icons.Filled.AutoAwesome, Color(0xFFD4A017), tr(R.string.falak_then1Title), tr(R.string.falak_then1)) {
            HadithView(state, HadithId.FALAK_JIBRIL, line = true)
        }
        StoryCard(Icons.AutoMirrored.Filled.DirectionsWalk, Color(0xFFF08A24), tr(R.string.falak_then2Title),
            tr(R.string.falak_then2, "dhuhr" to n(Prayer.DHUHR), "asr" to n(Prayer.ASR)), tr(R.string.falak_then2Word)) {
            HadithView(state, HadithId.FALAK_FEET, line = true)
        }
        StoryCard(Icons.Filled.WbTwilight, Color(0xFFE0457B), tr(R.string.falak_then3Title),
            tr(R.string.falak_then3, "isha" to n(Prayer.ISHA), "fajr" to n(Prayer.FAJR)), tr(R.string.falak_then3Word)) {
            HadithView(state, HadithId.FALAK_DAWN, line = true)
        }
        StoryCard(Icons.Filled.AccountBalance, Color(0xFF1FA39A), tr(R.string.falak_then4Title), tr(R.string.falak_then4),
            tr(R.string.falak_then4Word))
        StoryCard(Icons.Filled.Navigation, Color(0xFF2EAD5B), tr(R.string.falak_then5Title), tr(R.string.falak_then5))
    }
}

@Composable
private fun StoryCard(icon: ImageVector, tint: Color, title: String, text: String, word: String? = null,
                      extra: @Composable () -> Unit = {}) {
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconTile(icon, tint, 42)
                Text(title, style = Txt.headline, color = Palette.primary)
            }
            Text(text, style = Txt.body, color = Palette.primary)
            if (word != null) Text(word, style = Txt.footnote.copy(fontStyle = FontStyle.Italic), color = Palette.secondary)
            extra()
        }
    }
}

@Composable
fun IconTile(icon: ImageVector, tint: Color, sizeDp: Int = 34) {
    Box(Modifier.size(sizeDp.dp).clip(RoundedCornerShape((sizeDp * 0.27f).dp)).background(tint), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size((sizeDp * 0.52f).dp), tint = Color.White)
    }
}

// MARK: Why it helps

@Composable
fun WhyItHelps() {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        GlassCard(padding = 0.dp) {
            WhyRow(Icons.Filled.Visibility, Color(0xFF2F7DE1), tr(R.string.falak_why1Title), tr(R.string.falak_why1))
            HorizontalDivider(Modifier.padding(start = 62.dp), color = Palette.primary.copy(alpha = 0.12f))
            WhyRow(Icons.Filled.SignalCellularConnectedNoInternet0Bar, Color(0xFF2EAD5B), tr(R.string.falak_why2Title), tr(R.string.falak_why2))
            HorizontalDivider(Modifier.padding(start = 62.dp), color = Palette.primary.copy(alpha = 0.12f))
            WhyRow(Icons.Filled.CalendarMonth, Color(0xFFF08A24), tr(R.string.falak_why3Title), tr(R.string.falak_why3))
            HorizontalDivider(Modifier.padding(start = 62.dp), color = Palette.primary.copy(alpha = 0.12f))
            WhyRow(Icons.Filled.AccountBalance, Color(0xFF1FA39A), tr(R.string.falak_why4Title), tr(R.string.falak_why4))
        }
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(Dims.corner)).background(Palette.gold.copy(alpha = 0.14f)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Verified, null, Modifier.size(20.dp), tint = Palette.gold)
                Text(tr(R.string.falak_authority), style = Txt.headline, color = Palette.gold)
            }
            Text(tr(R.string.falak_authoritySub), style = Txt.subheadline, color = Palette.primary.copy(alpha = 0.85f))
        }
    }
}

@Composable
private fun WhyRow(icon: ImageVector, tint: Color, title: String, text: String) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        IconTile(icon, tint)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = Txt.bodySemibold, color = Palette.primary)
            Text(text, style = Txt.footnote, color = Palette.secondary)
        }
    }
}

/** Big numbers in the tool rows. */
val StepsNumber = display(22.sp, FontWeight.Bold)
