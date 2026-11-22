package com.prayertimesasia.app.ui.falak

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.speech.tts.TextToSpeech
import android.view.HapticFeedbackConstants
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.app.ui.components.HadithView
import com.prayertimesasia.app.ui.components.quietClick
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.Falak
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.secondsSince
import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.roundToInt
import kotlin.math.sqrt
import kotlin.math.tan

// Falak for everyone (Nov 2026): your own body is the shadow stick.
// Shadow steps (count heel to toe, nothing to type) and the shadow camera
// (point the phone at your shadow and tap its head). Works with no signal.
// Same maths as web core/falak.ts and the iPhone FalakShadow.swift.

/** Shadow steps, in a sheet. */
@Composable
fun ShadowStepsContent(state: AppState) {
    val r = state.resolver
    val place = r.activePlace ?: return
    val d = state.now.atZone(r.zone).toLocalDate()
    val plan = remember(d, place.coordinates) { Falak.shadowDay(d.year, d.monthValue, d.dayOfMonth, place.coordinates) }
    val target = Falak.asrSteps(plan, r.asrSchool)
    val asr = Prayer.ASR.name(r.naming)
    val n = Falak.stepsText(target)
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter).padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp), horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(tr(R.string.falak_stepsTitle), style = Txt.headline, color = Palette.primary)
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(tr(R.string.falak_stepsLead, "name" to asr), style = Txt.subheadline, color = Palette.secondary, textAlign = TextAlign.Center)
            Text(n, style = display(96.sp, FontWeight.Bold), color = Palette.gold)
            Text(tr(R.string.falak_stepsUnit), style = Txt.title3, color = Palette.primary)
            Text(tr(R.string.falak_stepsToday, "place" to place.name), style = Txt.footnote, color = Palette.secondary)
        }
        StepsPicture(Modifier.fillMaxWidth().height(120.dp))
        GlassCard(padding = 0.dp) {
            StepRow(1, tr(R.string.falak_step1), tr(R.string.falak_step1Sub))
            HorizontalDivider(Modifier.padding(start = 58.dp), color = Palette.primary.copy(alpha = 0.12f))
            StepRow(2, tr(R.string.falak_step2), tr(R.string.falak_step2Sub))
            HorizontalDivider(Modifier.padding(start = 58.dp), color = Palette.primary.copy(alpha = 0.12f))
            StepRow(3, tr(R.string.falak_step3), tr(R.string.falak_step3Sub))
            HorizontalDivider(Modifier.padding(start = 58.dp), color = Palette.primary.copy(alpha = 0.12f))
            StepRow(4, tr(R.string.falak_step4, "n" to n), tr(R.string.falak_step4Sub, "name" to asr))
        }
        Text(tr(R.string.falak_stepsWhy), style = Txt.footnote, color = Palette.secondary, modifier = Modifier.fillMaxWidth())
        HadithView(state, HadithId.FALAK_FEET, line = true)
        Text(tr(R.string.falak_lookGround), style = Txt.footnoteSemibold, color = Palette.warning, modifier = Modifier.fillMaxWidth())
        Text(tr(R.string.falak_footer), style = Txt.footnote, color = Palette.secondary, textAlign = TextAlign.Center)
    }
}

@Composable
private fun StepRow(n: Int, title: String, sub: String) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(Modifier.size(30.dp).clip(CircleShape).background(Palette.gold.copy(alpha = 0.22f)), contentAlignment = Alignment.Center) {
            Text("$n", style = Txt.headline, color = Palette.primary)
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = Txt.bodySemibold, color = Palette.primary)
            Text(sub, style = Txt.footnote, color = Palette.secondary)
        }
    }
}

@Composable
private fun StepsPicture(modifier: Modifier) {
    val ink = Palette.primary
    val gold = Palette.gold
    Canvas(modifier) {
        val px = density
        val w = size.width
        val ground = size.height - 18 * px
        val personX = w * 0.2f
        val bodyH = 70 * px
        drawCircle(Color(1f, 0.8f, 0.3f), 13 * px, Offset(19 * px, 17 * px))
        drawLine(ink.copy(alpha = 0.25f), Offset(0f, ground), Offset(w, ground), 1 * px)
        val len = w * 0.62f
        drawRoundRect(ink.copy(alpha = 0.35f), Offset(personX, ground - 3 * px), Size(len, 6 * px), CornerRadius(3 * px))
        for (i in 0 until 8) {
            val x = personX + 10 * px + i * (len - 14 * px) / 8
            drawOval(gold, Offset(x, ground + (6 + (i % 2) * 5) * px), Size(10 * px, 5 * px))
        }
        drawCircle(gold, 7 * px, Offset(personX + len, ground), style = Stroke(2.5f * px))
        drawCircle(ink, 7 * px, Offset(personX, ground - bodyH + 5 * px))
        drawRoundRect(ink, Offset(personX - 6 * px, ground - bodyH + 12 * px), Size(12 * px, bodyH - 12 * px), CornerRadius(5 * px))
    }
}

/**
 * Hold the phone at your chest with the sun behind you, point it at your shadow
 * and tap the head. The phone's tilt turns that tap into steps, so your height
 * never needs to be typed. A white line glows where the shadow's head will be
 * at Asr, and turns green once it has begun.
 */
@Composable
fun ShadowCameraScreen(state: AppState, onClose: () -> Unit) {
    val context = LocalContext.current
    val view = LocalView.current
    val r = state.resolver
    val place = r.activePlace
    var granted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    LaunchedEffect(Unit) { if (!granted) granted = state.permissions?.camera() ?: false }
    val pitch = rememberCameraPitch(context)
    var tap by remember { mutableStateOf<Pair<Float, Double>?>(null) }
    val tts = remember { mutableStateOf<TextToSpeech?>(null) }
    DisposableEffect(Unit) {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context) { status -> if (status == TextToSpeech.SUCCESS) tts.value = engine }
        onDispose { engine?.shutdown() }
    }
    val green = Color(0xFF33F273)
    val asr = Prayer.ASR.name(r.naming)

    BoxWithConstraints(Modifier.fillMaxSize().background(Color.Black)) {
        val hPx = with(LocalDensity.current) { maxHeight.toPx() }
        val focal = (hPx / 2) / tan(30.0 * PI / 180)
        val dep: (Float, Double) -> Double = { y, p -> p + atan((y * hPx - hPx / 2) / focal) * 180 / PI }
        // The tap handler lives on across frames, so it reads the newest values.
        val latestPitch = rememberUpdatedState(pitch)
        val latestDep = rememberUpdatedState(dep)
        if (granted) CameraPreview()
        if (place != null) {
            val now = state.now
            val d = now.atZone(r.zone).toLocalDate()
            val plan = remember(d, place.coordinates) { Falak.shadowDay(d.year, d.monthValue, d.dayOfMonth, place.coordinates) }
            val school = r.asrSchool
            val target = Falak.asrSteps(plan, school)
            val sun = Falak.sunPosition(now, place.coordinates)
            val reading = tap?.let { (y, p) -> Falak.cameraReading(dep(y, p), now, place.coordinates, r.zone, school) }
            val begun = reading?.asrBegun == true
            val asrDep = Falak.depressionTo(Falak.CHEST_HEIGHT, target / Falak.FEET_PER_BODY)
            val p = pitch
            val lineY = if (p != null) (hPx / 2 + focal * tan((asrDep - p) * PI / 180)).toFloat() else -1f
            val lineColor = if (begun) green else Color.White

            Canvas(Modifier.fillMaxSize().pointerInput(Unit) {
                detectTapGestures { o ->
                    val pp = latestPitch.value ?: return@detectTapGestures
                    val y = o.y / size.height
                    // A tap on the info card, or at or above the horizon, isn't the shadow's head.
                    if (y > 0.72f || latestDep.value(y, pp) <= 1) return@detectTapGestures
                    tap = y to pp
                    val rd = Falak.cameraReading(latestDep.value(y, pp), state.now, place.coordinates, r.zone, school)
                    if (rd.asrBegun == true) {
                        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                        view.postDelayed({ view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS) }, 300)
                        tts.value?.speak(context.getString(R.string.falak_camSayBegun).replace("{name}", asr), TextToSpeech.QUEUE_FLUSH, null, "falak")
                    } else {
                        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                        if (rd.asrBegun == false) tts.value?.speak(context.getString(R.string.falak_camSayNotYet), TextToSpeech.QUEUE_FLUSH, null, "falak")
                    }
                }
            }) {
                if (sun.altitude > 2 && lineY > 0 && lineY < size.height) {
                    val x0 = 24 * density
                    val x1 = size.width - 24 * density
                    // A soft glow under a bright line, so it shows in strong sunlight.
                    drawLine(lineColor.copy(alpha = 0.25f), Offset(x0, lineY), Offset(x1, lineY), 22 * density, StrokeCap.Round)
                    drawLine(lineColor.copy(alpha = 0.45f), Offset(x0, lineY), Offset(x1, lineY), 11 * density, StrokeCap.Round)
                    drawLine(Color.Black.copy(alpha = 0.5f), Offset(x0, lineY + 2 * density), Offset(x1, lineY + 2 * density), 5 * density, StrokeCap.Round)
                    drawLine(lineColor, Offset(x0, lineY), Offset(x1, lineY), 5 * density, StrokeCap.Round)
                }
                tap?.let { (y, _) ->
                    val c = Offset(size.width / 2, y * size.height)
                    drawCircle(Color.Black.copy(alpha = 0.5f), 25 * density, c, style = Stroke(6 * density))
                    drawCircle(lineColor, 23 * density, c, style = Stroke(4 * density))
                }
            }

            if (reading != null) {
                val text = when (reading.asrBegun) {
                    null -> tr(R.string.falak_camMorning)
                    true -> "✓ " + tr(R.string.falak_camBegun, "name" to asr)
                    false -> tr(R.string.falak_camNotYet)
                }
                Box(Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 16.dp).shadow(6.dp, RoundedCornerShape(50))
                    .clip(RoundedCornerShape(50)).background(if (begun) green else Color.Black.copy(alpha = 0.55f))
                    .padding(horizontal = 18.dp, vertical = 10.dp)) {
                    Text(text, style = Txt.headline, color = if (begun) Color.Black else Color.White)
                }
            }

            Column(
                Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(12.dp).fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp)).background(Color(0xE61C1C22)).padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val white = Color.White
                when {
                    sun.altitude <= 2 -> Text(tr(R.string.falak_camAfterSunrise), style = Txt.subheadlineSemibold, color = white)
                    pitch == null -> Text(tr(R.string.falak_camNoMotion), style = Txt.subheadlineSemibold, color = white)
                    reading == null -> {
                        HowRow(1, tr(R.string.falak_camHow1))
                        HowRow(2, tr(R.string.falak_camHow2))
                        HowRow(3, tr(R.string.falak_camHow3))
                    }
                    reading.asrBegun == null -> {
                        Text(tr(R.string.falak_camMorning), style = Txt.headline, color = white)
                        Text(tr(R.string.falak_camMorningSub, "time" to r.formatted(plan.noon)), style = Txt.subheadline, color = white.copy(alpha = 0.8f))
                    }
                    else -> {
                        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(tr(R.string.falak_camYourShadow), style = Txt.subheadline, color = white.copy(alpha = 0.75f), modifier = Modifier.weight(1f))
                            Text(if (reading.steps.isFinite()) Falak.stepsText(reading.steps) else "–", style = display(28.sp, FontWeight.Bold), color = white)
                            Text(tr(R.string.falak_camOf, "n" to Falak.stepsText(target)), style = Txt.subheadline, color = white.copy(alpha = 0.75f))
                        }
                        val progress = if (reading.steps.isFinite()) (reading.steps / target).toFloat().coerceIn(0f, 1f) else 1f
                        LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                            color = if (begun) green else white, trackColor = white.copy(alpha = 0.2f))
                        val asrTime = if (school == AsrSchool.HANAFI) plan.asrHanafi else plan.asrShafii
                        if (!begun && asrTime != null) {
                            val mins = (asrTime.secondsSince(now) / 60).roundToInt()
                            if (mins > 0) Text(tr(R.string.falak_camInAbout, "name" to asr, "n" to mins), style = Txt.subheadlineSemibold, color = white)
                        }
                        r.day(now)?.let { Text(tr(R.string.falak_camTimetable, "time" to r.formatted(it.time(Prayer.ASR))), style = Txt.footnote, color = white.copy(alpha = 0.75f)) }
                        Text(if (begun) tr(R.string.falak_camDoneHint) else tr(R.string.falak_camWaitHint, "name" to asr), style = Txt.footnote, color = white.copy(alpha = 0.7f))
                        Text(tr(R.string.falak_camRetap), style = Txt.caption, color = white.copy(alpha = 0.55f))
                    }
                }
                Text(tr(R.string.falak_camEstimate) + " " + tr(R.string.falak_footer), style = Txt.caption2, color = white.copy(alpha = 0.55f))
            }
        }
        Box(Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(16.dp).size(40.dp).clip(CircleShape)
            .background(Color.Black.copy(alpha = 0.45f)).quietClick(onClose), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Close, "Close", Modifier.size(20.dp), tint = Color.White)
        }
    }
}

@Composable
private fun HowRow(n: Int, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(26.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
            Text("$n", style = Txt.subheadlineSemibold, color = Color.White)
        }
        Text(text, style = Txt.subheadlineSemibold, color = Color.White)
    }
}

/** How far the back camera points below the horizon, in degrees; null when the phone can't tell. */
@Composable
private fun rememberCameraPitch(context: Context): Double? {
    var pitch by remember { mutableDoubleStateOf(Double.NaN) }
    DisposableEffect(Unit) {
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val sensor = sm?.getDefaultSensor(Sensor.TYPE_GRAVITY) ?: sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                val (x, y, z) = Triple(e.values[0].toDouble(), e.values[1].toDouble(), e.values[2].toDouble())
                val g = sqrt(x * x + y * y + z * z)
                if (g < 1) return
                // The back camera looks along -z. Flat and face up (straight down) is 90°, upright is 0°.
                val next = asin((z / g).coerceIn(-1.0, 1.0)) * 180 / PI
                pitch = if (pitch.isNaN()) next else pitch * 0.8 + next * 0.2
            }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        if (sensor != null) sm?.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
        onDispose { sm?.unregisterListener(listener) }
    }
    return if (pitch.isNaN()) null else pitch
}
