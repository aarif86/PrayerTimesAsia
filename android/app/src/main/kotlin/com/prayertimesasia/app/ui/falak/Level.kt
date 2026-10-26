package com.prayertimesasia.app.ui.falak

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.fmt
import kotlin.math.acos
import kotlin.math.sqrt

/**
 * A spirit level for the shadow stick. Lay the phone flat where the stick will
 * stand to check the ground; stand it on its edge against the stick to check the
 * stick is vertical. A tilt of 1° moves a 1 m stick's shadow tip by about 1.7 cm.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun LevelScreen() {
    val context = LocalContext.current
    val view = LocalView.current
    var upright by remember { mutableStateOf(false) }
    var gravity by remember { mutableStateOf<FloatArray?>(null) }
    val sm = remember { context.getSystemService(Context.SENSOR_SERVICE) as SensorManager? }
    val sensor = remember { sm?.getDefaultSensor(Sensor.TYPE_GRAVITY) ?: sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) }
    DisposableEffect(sensor) {
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                val prev = gravity
                // A little smoothing for raw accelerometers.
                gravity = if (prev == null) e.values.copyOf(3) else FloatArray(3) { prev[it] * 0.8f + e.values[it] * 0.2f }
            }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        sensor?.let { sm?.registerListener(l, it, SensorManager.SENSOR_DELAY_UI) }
        onDispose { sm?.unregisterListener(l) }
    }
    val g = gravity
    val n = g?.let { sqrt(it[0] * it[0] + it[1] * it[1] + it[2] * it[2]).coerceAtLeast(0.01f) } ?: 1f
    // Android reports the force opposing gravity: face up flat is (0, 0, +g); standing on its bottom edge, (0, +g, 0).
    val tilt = g?.let { Math.toDegrees(acos(((if (upright) it[1] else it[2]) / n).toDouble().coerceIn(-1.0, 1.0))) } ?: 0.0
    val bx = g?.let { (it[0] / n * 4).coerceIn(-1f, 1f) } ?: 0f
    val by = g?.let { (-(if (upright) it[2] else it[1]) / n * 4).coerceIn(-1f, 1f) } ?: 0f
    val ax by animateFloatAsState(bx, spring(stiffness = 120f, dampingRatio = 0.6f), label = "x")
    val ay by animateFloatAsState(by, spring(stiffness = 120f, dampingRatio = 0.6f), label = "y")
    val available = sensor != null
    val level = available && g != null && tilt < 0.5
    LaunchedEffect(level) {
        if (level) view.performHapticFeedback(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS)
    }
    val green = Palette.success
    val primary = Palette.primary
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Text("Level", style = Txt.headline, color = primary)
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            SegmentedButton(!upright, { upright = false }, SegmentedButtonDefaults.itemShape(0, 2)) { Text("Ground (phone flat)") }
            SegmentedButton(upright, { upright = true }, SegmentedButtonDefaults.itemShape(1, 2)) { Text("Stick (phone upright)") }
        }
        Box(Modifier.size(260.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                drawCircle(primary.copy(alpha = 0.25f), size.minDimension / 2 - 1.dp.toPx(), style = Stroke(2.dp.toPx()))
                drawCircle(primary.copy(alpha = 0.4f), 30.dp.toPx(), style = Stroke(1.dp.toPx()))
                drawCircle(if (level) green else Color(0xFFFF9F0A), 22.dp.toPx(), center + Offset(ax * 110.dp.toPx(), ay * 110.dp.toPx()))
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(if (available) fmt("%.1f°", tilt) else "-", style = display(54.sp, FontWeight.Bold), color = primary)
            Text(
                if (!available) "This device has no motion sensor."
                else if (level) "Level - good for a reading" else "Not level yet - adjust until the bubble turns green",
                style = Txt.headline, color = if (level) green else primary, textAlign = TextAlign.Center,
            )
        }
        Text(if (upright) "Hold the phone's long edge against the stick. Within 0.5° of vertical is good."
            else "Lay the phone flat where the stick will stand. Within 0.5° is good.",
            style = Txt.footnote, color = primary.copy(alpha = 0.75f), textAlign = TextAlign.Center)
    }
}
