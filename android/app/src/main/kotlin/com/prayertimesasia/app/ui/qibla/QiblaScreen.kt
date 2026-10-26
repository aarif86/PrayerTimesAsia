package com.prayertimesasia.app.ui.qibla

import android.os.Build
import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.Tab
import com.prayertimesasia.app.ui.components.Chip
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.app.ui.makers.KaabaGlyph
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.Astro
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.Place
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Qibla compass. The dial turns with the phone so the Kaaba marker always sits
 * at the true qibla; line it up with the top marker and the whole dial turns
 * green, with a tick, a ripple and a tap.
 */
@Composable
fun QiblaScreen(state: AppState) {
    val place = state.resolver.activePlace
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(state.skyNow)
        if (place == null) {
            Text("Choose a place to find the qibla.", style = Txt.headline, color = Palette.primary, modifier = Modifier.align(Alignment.Center))
        } else {
            QiblaContent(state, place)
        }
    }
}

@Composable
private fun QiblaContent(state: AppState, place: Place) {
    val context = LocalContext.current
    val view = LocalView.current
    val compass = remember { hasCompass(context) }
    val bearing = Geo.qiblaBearing(place.coordinates)
    val live by rememberHeading(place.coordinates, enabled = !state.demoAligned)
    val heading: Double? = if (state.demoAligned) bearing else live?.degrees
    val delta = heading?.let { Geo.angleDelta(bearing, it) }
    var aligned by remember { mutableStateOf(state.demoAligned) }
    aligned = nextAligned(aligned, delta)
    // Heading accumulated without wrapping, so crossing north turns the dial a few degrees, not the long way round.
    var dialHeading by remember { mutableDoubleStateOf(heading ?: 0.0) }
    var last by remember { mutableStateOf<Double?>(null) }
    LaunchedEffect(heading) {
        val h = heading ?: return@LaunchedEffect
        val l = last
        dialHeading = if (l == null) h else dialHeading + Geo.angleDelta(h, l)
        last = h
    }
    LaunchedEffect(aligned) {
        if (aligned && !state.demoAligned) {
            view.performHapticFeedback(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS)
        }
    }
    val green = Palette.success
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter).padding(bottom = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Column(Modifier.padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Qibla", style = display(34.sp, FontWeight.Bold), color = Palette.primary)
            val instruction = when {
                delta == null -> "Face ${bearing.roundToInt()}° from north"
                aligned -> "You're facing the Qibla"
                delta > 0 -> "Turn right ${abs(delta).roundToInt()}°"
                else -> "Turn left ${abs(delta).roundToInt()}°"
            }
            Text(instruction, style = Txt.title3, color = if (aligned) green else Palette.primary.copy(alpha = 0.9f))
            Chip("Check with the sun", Icons.Filled.WbSunny) { state.selectedTab = Tab.FALAK }
        }
        BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
            val size = minOf(maxWidth, 320.dp)
            QiblaDial(bearing, dialHeading, delta, aligned, size)
        }
        Stats(place, bearing, heading)
        Steps(compass || state.demoAligned, live)
    }
}

@Composable
private fun QiblaDial(bearing: Double, heading: Double, delta: Double?, aligned: Boolean, size: Dp) {
    val green = Palette.success
    val primary = Palette.primary
    val gold = Palette.gold
    val reduce = LocalSkyScheme.current.reduceMotion
    Box(Modifier.size(size).semantics { contentDescription = if (aligned) "Facing the qibla" else "Qibla compass" },
        contentAlignment = Alignment.Center) {
        // Fixed "you are pointing here" marker at the top.
        Box(Modifier.offset(y = -size / 2 - 8.dp).size(4.dp, 22.dp).clip(CircleShape).background(if (aligned) green else primary))
        Canvas(Modifier.fillMaxSize()) {
            val r = this.size.minDimension / 2
            if (aligned) {
                drawCircle(Brush.radialGradient(listOf(green.copy(alpha = 0.28f), green.copy(alpha = 0.08f)), center, r), r)
                drawCircle(green.copy(alpha = 0.7f), r - 2.5.dp.toPx(), style = Stroke(5.dp.toPx() + 8.dp.toPx()), alpha = 0.18f)
                drawCircle(green, r - 2.5.dp.toPx(), style = Stroke(5.dp.toPx()))
            } else {
                drawCircle(primary.copy(alpha = 0.07f), r)
                drawCircle(primary.copy(alpha = 0.25f), r - 0.5.dp.toPx(), style = Stroke(1.dp.toPx()))
            }
        }
        if (aligned && !reduce) Ripple(green, size)
        // The face turns with the phone.
        Box(Modifier.fillMaxSize().graphicsLayer { rotationZ = (-heading).toFloat() }, contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val r = this.size.minDimension / 2
                for (i in 0 until 72) {
                    val major = i % 6 == 0
                    val alpha = if (i % 18 == 0) 0.9f else if (major) 0.55f else 0.25f
                    val len = (if (major) 12 else 6).dp.toPx()
                    val outer = r - 14.dp.toPx() + len / 2
                    rotate(i * 5f, center) {
                        drawLine(primary.copy(alpha = alpha), Offset(center.x, center.y - outer), Offset(center.x, center.y - outer + len),
                            strokeWidth = (if (major) 2 else 1).dp.toPx(), cap = StrokeCap.Round)
                    }
                }
                // Qibla pointer, from the centre ring out towards the Kaaba.
                rotate(bearing.toFloat(), center) {
                    val w = 4.dp.toPx()
                    val h = r * 2 * 0.14f
                    val top = center.y - r * 2 * 0.29f - h / 2
                    val brush = if (aligned) Brush.verticalGradient(listOf(green.copy(alpha = 0.8f), green.copy(alpha = 0.8f)), top, top + h)
                    else Brush.verticalGradient(listOf(gold, primary.copy(alpha = 0.1f)), top, top + h)
                    drawRoundRect(brush, topLeft = Offset(center.x - w / 2, top), size = Size(w, h),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(w / 2, w / 2))
                }
            }
            listOf("N", "E", "S", "W").forEachIndexed { i, letter ->
                val a = Math.toRadians(i * 90.0)
                val rr = size / 2 - 38.dp
                Text(letter, fontSize = 17.sp, fontWeight = if (i == 0) FontWeight.ExtraBold else FontWeight.SemiBold,
                    color = if (i == 0) Palette.north else primary.copy(alpha = 0.8f),
                    modifier = Modifier.offset(x = rr * sin(a).toFloat(), y = -rr * cos(a).toFloat()).rotate(heading.toFloat()))
            }
            val b = Math.toRadians(bearing)
            val kr = size * 0.40f
            Box(
                Modifier.offset(x = kr * sin(b).toFloat(), y = -kr * cos(b).toFloat()).rotate(heading.toFloat()).size(52.dp)
                    .then(if (aligned) Modifier.clip(CircleShape).background(green.copy(alpha = 0.25f)).border(2.5.dp, green, CircleShape) else Modifier),
                contentAlignment = Alignment.Center,
            ) { KaabaGlyph(Modifier.size(30.dp)) }
        }
        // Centre: a tick when aligned, otherwise an arrow pointing at the qibla.
        Box(
            Modifier.size(size * 0.42f).clip(CircleShape).background(Palette.material)
                .border(1.dp, if (aligned) green.copy(alpha = 0.5f) else primary.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            when {
                aligned -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Filled.Check, null, Modifier.size(size * 0.14f), tint = green)
                    Text("Aligned", style = Txt.subheadlineSemibold, color = primary)
                }
                delta != null -> Icon(Icons.Filled.Navigation, "Points to the qibla", Modifier.size(size * 0.16f).rotate(delta.toFloat()), tint = gold)
                else -> Icon(Icons.Filled.Navigation, null, Modifier.size(size * 0.09f), tint = primary.copy(alpha = 0.6f))
            }
        }
    }
}

/** A soft green ring that keeps spreading out from the dial while aligned. */
@Composable
private fun Ripple(color: Color, size: Dp) {
    val t = rememberInfiniteTransition(label = "ripple")
    val p by t.animateFloat(0f, 1f, infiniteRepeatable(tween(1600, easing = LinearEasing), RepeatMode.Restart), label = "p")
    Canvas(Modifier.size(size)) {
        drawCircle(color.copy(alpha = 0.6f * (1 - p)), radius = this.size.minDimension / 2 * (1 + 0.18f * p), style = Stroke(2.dp.toPx()))
    }
}

@Composable
private fun Stats(place: Place, bearing: Double, heading: Double?) {
    val km = NumberFormat.getIntegerInstance(Locale.US).format(Geo.distanceKm(place.coordinates, Geo.kaaba).roundToInt())
    GlassCard(padding = 14.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Stat("${bearing.roundToInt()}° ${Geo.compassPoint(bearing)}", "Qibla", Modifier.weight(1f))
            Box(Modifier.size(1.dp, 34.dp).background(Palette.primary.copy(alpha = 0.3f)))
            Stat(heading?.let { "${Astro.fix(it, 360.0).roundToInt() % 360}° ${Geo.compassPoint(it)}" } ?: "-", "You're facing", Modifier.weight(1f))
            Box(Modifier.size(1.dp, 34.dp).background(Palette.primary.copy(alpha = 0.3f)))
            Stat("$km km", "To Makkah", Modifier.weight(1f))
        }
    }
}

@Composable
private fun Stat(value: String, label: String, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp, color = Palette.primary.copy(alpha = 0.6f))
        Text(value, style = display(18.sp), color = Palette.primary, maxLines = 1)
    }
}

/** How to use it, step by step - plus a calibration note only when needed. */
@Composable
private fun Steps(hasCompass: Boolean, heading: Heading?) {
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("How to find the qibla", style = Txt.headline, color = Palette.primary)
            if (!hasCompass) {
                Step(null, Icons.Filled.Map, "This phone has no compass. Use the qibla bearing above with a map, or the sun in Falak.")
            } else {
                Step("1", null, "Hold your phone flat in front of you, screen facing up.")
                Step("2", null, "Turn your whole body slowly until the Ka'bah reaches the marker at the top.")
                Step("3", null, "When the dial turns green and your phone taps, you're facing the qibla.")
                if (heading != null && (heading.unreliable || heading.accuracy > 25)) {
                    Step(null, Icons.Filled.Warning,
                        "The compass needs calibrating: wave your phone in a figure-8 a few times, away from cars, laptops and magnetic cases.",
                        Color(0xFFFF9F0A))
                }
            }
        }
    }
}

@Composable
private fun Step(number: String?, icon: androidx.compose.ui.graphics.vector.ImageVector?, text: String, tint: Color = Palette.gold) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(22.dp), contentAlignment = Alignment.Center) {
            if (number != null) {
                Box(Modifier.size(20.dp).clip(CircleShape).background(tint), contentAlignment = Alignment.Center) {
                    Text(number, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Black.copy(alpha = 0.8f), textAlign = TextAlign.Center)
                }
            } else if (icon != null) {
                Icon(icon, null, Modifier.size(20.dp), tint = tint)
            }
        }
        Text(text, style = Txt.subheadline, color = Palette.primary, modifier = Modifier.weight(1f))
    }
}

