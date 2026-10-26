package com.prayertimesasia.app.ui.falak

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.quietClick
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.core.Astro
import com.prayertimesasia.core.Falak
import com.prayertimesasia.core.Geo
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Falak through the camera: hold the phone up and the view is marked with the
 * qibla (gold), the sun's direction and where shadows point right now. If real
 * shadows around you run the way the shadow marker says, the compass - and so the
 * qibla marker - is right too: the sun checks the phone's compass.
 */
@Composable
fun FalakCameraScreen(state: AppState, onClose: () -> Unit) {
    val context = LocalContext.current
    val place = state.resolver.activePlace
    var granted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    LaunchedEffect(Unit) { if (!granted) granted = state.permissions?.camera() ?: false }
    val heading = rememberCameraHeading(context, place?.coordinates?.latitude, place?.coordinates?.longitude)
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (granted && place != null) {
            CameraPreview()
            val qibla = Geo.qiblaBearing(place.coordinates)
            val sun = Falak.sunPosition(state.now, place.coordinates)
            CompassOverlay(heading, qibla, sun.azimuth, sun.altitude)
        } else {
            Column(Modifier.align(Alignment.Center).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Filled.CameraAlt, null, Modifier.size(44.dp), tint = Color.White)
                Text(if (place == null) "Choose a place first" else "Needs the camera", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text("This view uses the camera to mark the qibla and the shadow direction around you. Nothing is recorded.",
                    fontSize = 13.sp, color = Color.White.copy(alpha = 0.8f), textAlign = TextAlign.Center)
            }
        }
        Legend(Modifier.align(Alignment.BottomCenter))
        Box(Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(16.dp).size(40.dp).clip(RoundedCornerShape(20.dp))
            .background(Color.Black.copy(alpha = 0.45f)).quietClick(onClose), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Close, "Close", Modifier.size(20.dp), tint = Color.White)
        }
    }
}

@Composable
private fun CameraPreview() {
    val lifecycleOwner = LocalLifecycleOwner.current
    val context = LocalContext.current
    val view = remember { PreviewView(context) }
    DisposableEffect(lifecycleOwner) {
        val future = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        future.addListener({
            runCatching {
                val p = future.get()
                provider = p
                val preview = Preview.Builder().build().also { it.setSurfaceProvider(view.surfaceProvider) }
                p.unbindAll()
                p.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview)
            }
        }, ContextCompat.getMainExecutor(context))
        onDispose { runCatching { provider?.unbindAll() } }
    }
    AndroidView({ view }, Modifier.fillMaxSize())
}

/** Where the back camera looks, degrees from true north (phone held upright). */
@Composable
private fun rememberCameraHeading(context: Context, lat: Double?, lng: Double?): Double? {
    var heading by remember { mutableStateOf<Double?>(null) }
    DisposableEffect(lat, lng) {
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager?
        val sensor = sm?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        val declination = if (lat != null && lng != null)
            GeomagneticField(lat.toFloat(), lng.toFloat(), 0f, System.currentTimeMillis()).declination.toDouble() else 0.0
        val r = FloatArray(9)
        val remapped = FloatArray(9)
        val o = FloatArray(3)
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                SensorManager.getRotationMatrixFromVector(r, e.values)
                // Upright: the camera looks along the device's -z axis.
                SensorManager.remapCoordinateSystem(r, SensorManager.AXIS_X, SensorManager.AXIS_Z, remapped)
                SensorManager.getOrientation(remapped, o)
                val raw = Math.toDegrees(o[0].toDouble()) + declination
                val prev = heading
                heading = Astro.fix(if (prev == null) raw else prev + Geo.angleDelta(raw, prev) * 0.2, 360.0)
            }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        sensor?.let { sm.registerListener(l, it, SensorManager.SENSOR_DELAY_UI) }
        onDispose { sm?.unregisterListener(l) }
    }
    return heading
}

/** A compass strip across the view: the qibla, the sun and the shadow direction, placed by bearing. */
@Composable
private fun CompassOverlay(heading: Double?, qibla: Double, sunAzimuth: Double, sunAltitude: Double) {
    val gold = Palette.gold(true)
    val fov = 60.0 // A typical phone camera's horizontal field of view, in degrees.
    Box(Modifier.fillMaxSize()) {
        if (heading == null) {
            Text("Hold the phone upright and turn slowly.", color = Color.White, fontSize = 15.sp,
                modifier = Modifier.align(Alignment.Center))
            return@Box
        }
        Canvas(Modifier.fillMaxSize()) {
            val y = size.height * 0.42f
            fun xFor(bearing: Double): Float? {
                val d = Geo.angleDelta(bearing, heading)
                if (abs(d) > fov / 2 + 5) return null
                return (size.width / 2 + d / (fov / 2) * size.width / 2).toFloat()
            }
            // Horizon line with a tick every 10°.
            drawLine(Color.White.copy(alpha = 0.5f), Offset(0f, y), Offset(size.width, y), 1.5.dp.toPx())
            for (b in 0 until 360 step 10) {
                xFor(b.toDouble())?.let { x ->
                    val len = (if (b % 90 == 0) 16 else 8).dp.toPx()
                    drawLine(Color.White.copy(alpha = 0.7f), Offset(x, y - len), Offset(x, y), 1.5.dp.toPx())
                }
            }
            // Centre marker: where you face.
            drawLine(Color.White, Offset(size.width / 2, y - 28.dp.toPx()), Offset(size.width / 2, y + 28.dp.toPx()), 2.dp.toPx(), StrokeCap.Round)
            xFor(qibla)?.let { x ->
                drawLine(gold, Offset(x, y - 120.dp.toPx()), Offset(x, y + 120.dp.toPx()), 4.dp.toPx(), StrokeCap.Round)
                drawRect(Color.Black, Offset(x - 14.dp.toPx(), y - 150.dp.toPx()), androidx.compose.ui.geometry.Size(28.dp.toPx(), 28.dp.toPx()))
                drawRect(gold, Offset(x - 14.dp.toPx(), y - 145.dp.toPx()), androidx.compose.ui.geometry.Size(28.dp.toPx(), 4.dp.toPx()))
            }
            if (sunAltitude > 1) {
                xFor(sunAzimuth)?.let { x -> drawCircle(Color(1f, 0.85f, 0.5f), 12.dp.toPx(), Offset(x, y - 60.dp.toPx())) }
                xFor(Astro.fix(sunAzimuth + 180, 360.0))?.let { x ->
                    drawLine(Color.Black.copy(alpha = 0.65f), Offset(x, y + 10.dp.toPx()), Offset(x, y + 140.dp.toPx()), 10.dp.toPx(), StrokeCap.Round)
                }
            }
            drawCircle(Color.White.copy(alpha = 0.6f), 6.dp.toPx(), Offset(size.width / 2, y), style = Stroke(2.dp.toPx()))
        }
        val d = Geo.angleDelta(qibla, heading)
        Text(
            if (abs(d) < 4) "Facing the qibla" else if (d > 0) "Qibla: turn right ${abs(d).roundToInt()}°" else "Qibla: turn left ${abs(d).roundToInt()}°",
            color = if (abs(d) < 4) Palette.successDark else Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 24.dp)
                .clip(RoundedCornerShape(20.dp)).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 14.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun Legend(modifier: Modifier) {
    val gold = Palette.gold(true)
    Column(
        modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp).clip(RoundedCornerShape(22.dp))
            .background(Color.Black.copy(alpha = 0.55f)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Hold the phone upright and turn slowly.", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(14.dp, 4.dp).background(gold)); Text("Gold line: the qibla", color = gold, fontSize = 13.sp)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(14.dp, 6.dp).background(Color.Black)); Text("Dark bar: where shadows point right now", color = Color.White, fontSize = 13.sp)
        }
        Text("Outdoors in sunshine, real shadows should run the way the dark bar says. If they don't, move away from metal and wave the phone in a figure-8 to recalibrate the compass. Never look at the sun.",
            color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp)
    }
}
