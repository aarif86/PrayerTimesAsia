package com.prayertimesasia.app.ui.qibla

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Geo
import kotlin.math.abs

/** Where the top of the phone points, degrees clockwise from true north, and how sure we are. */
data class Heading(
    val degrees: Double,
    /** Estimated error in degrees; negative when unknown. Large values mean calibrate. */
    val accuracy: Double,
    /** The magnetometer reports it needs calibrating. */
    val unreliable: Boolean,
)

/** Whether this phone has the sensors for a compass at all. */
fun hasCompass(context: Context): Boolean {
    val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager? ?: return false
    return sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null ||
        (sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null && sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null)
}

/**
 * The compass heading from the rotation-vector sensor (the phone's fused
 * magnetometer, accelerometer and gyro), corrected from magnetic to true north
 * for where you are. Falls back to accelerometer + magnetometer.
 */
@Composable
fun rememberHeading(at: Coordinates?, enabled: Boolean = true): State<Heading?> {
    val context = LocalContext.current
    val state = remember { mutableStateOf<Heading?>(null) }
    DisposableEffect(enabled, at?.latitude, at?.longitude) {
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager?
        if (!enabled || sm == null) return@DisposableEffect onDispose { }
        val declination = at?.let {
            GeomagneticField(it.latitude.toFloat(), it.longitude.toFloat(), 0f, System.currentTimeMillis()).declination.toDouble()
        } ?: 0.0
        val rotation = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        val accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val magnet = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
        val matrix = FloatArray(9)
        val orientation = FloatArray(3)
        var gravity: FloatArray? = null
        var geomagnetic: FloatArray? = null
        var smoothed: Double? = null
        var unreliable = false

        fun publish(azimuthRad: Float, accuracyDeg: Double) {
            val raw = Math.toDegrees(azimuthRad.toDouble()) + declination
            // Low-pass on the circle so the dial glides rather than jitters.
            val s = smoothed?.let { prev -> prev + Geo.angleDelta(raw, prev) * 0.25 } ?: raw
            smoothed = s
            state.value = Heading((s % 360 + 360) % 360, accuracyDeg, unreliable)
        }

        val listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                when (e.sensor.type) {
                    Sensor.TYPE_ROTATION_VECTOR -> {
                        SensorManager.getRotationMatrixFromVector(matrix, e.values)
                        SensorManager.getOrientation(matrix, orientation)
                        val acc = if (e.values.size > 4 && e.values[4] >= 0) Math.toDegrees(e.values[4].toDouble()) else -1.0
                        publish(orientation[0], acc)
                    }
                    Sensor.TYPE_ACCELEROMETER -> gravity = e.values.clone()
                    Sensor.TYPE_MAGNETIC_FIELD -> {
                        geomagnetic = e.values.clone()
                        val g = gravity
                        val m = geomagnetic
                        if (rotation == null && g != null && m != null && SensorManager.getRotationMatrix(matrix, null, g, m)) {
                            SensorManager.getOrientation(matrix, orientation)
                            publish(orientation[0], if (unreliable) 30.0 else 10.0)
                        }
                    }
                }
            }

            override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {
                if (sensor.type == Sensor.TYPE_MAGNETIC_FIELD || sensor.type == Sensor.TYPE_ROTATION_VECTOR) {
                    unreliable = accuracy == SensorManager.SENSOR_STATUS_UNRELIABLE || accuracy == SensorManager.SENSOR_STATUS_ACCURACY_LOW
                }
            }
        }
        if (rotation != null) {
            sm.registerListener(listener, rotation, SensorManager.SENSOR_DELAY_UI)
            // The magnetometer's own accuracy tells us when to suggest a figure-8.
            magnet?.let { sm.registerListener(listener, it, SensorManager.SENSOR_DELAY_NORMAL) }
        } else if (accel != null && magnet != null) {
            sm.registerListener(listener, accel, SensorManager.SENSOR_DELAY_UI)
            sm.registerListener(listener, magnet, SensorManager.SENSOR_DELAY_UI)
        }
        onDispose { sm.unregisterListener(listener) }
    }
    return state
}

/** Lights up inside 4°, goes out past 6°, so it doesn't flicker at the edge. */
fun nextAligned(wasAligned: Boolean, delta: Double?): Boolean = when {
    delta == null -> false
    wasAligned -> abs(delta) <= 6
    else -> abs(delta) < 4
}
