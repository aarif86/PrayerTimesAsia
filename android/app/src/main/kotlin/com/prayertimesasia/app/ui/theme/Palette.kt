package com.prayertimesasia.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.prayertimesasia.core.BlessedTime
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.SourceGrade

/** Dark or light, and whether night is the soft Automatic night. Set once at the root. */
data class SkyScheme(val dark: Boolean, val softNight: Boolean = false, val reduceMotion: Boolean = false)

val LocalSkyScheme = staticCompositionLocalOf { SkyScheme(dark = true) }

fun rgb(r: Double, g: Double, b: Double, a: Float = 1f) = Color(r.toFloat(), g.toFloat(), b.toFloat(), a)

/**
 * One set of colours for the whole app (as on iOS):
 * accent - the brand peach (buttons, Falak tools, highlights); gold - anything qibla;
 * north - the compass N; success - aligned / done; warning - safety notes.
 * Prayer colours are only for prayer rows and markers.
 */
object Palette {
    val north = rgb(0.88, 0.39, 0.31)
    val warning = rgb(0.93, 0.66, 0.24)
    private val sunArcDark = rgb(0.97, 0.74, 0.56)
    private val sunArcLight = rgb(0.91, 0.55, 0.34)
    private val goldDark = rgb(1.0, 0.84, 0.5)
    private val goldLight = rgb(0.72, 0.5, 0.04)
    val successDark = Color(0xFF30D158)
    val successLight = Color(0xFF34C759)

    fun sunArc(dark: Boolean) = if (dark) sunArcDark else sunArcLight
    fun gold(dark: Boolean) = if (dark) goldDark else goldLight

    /** The day arc and the place chip outline: a soft peach. */
    val sunArc: Color @Composable @ReadOnlyComposable get() = sunArc(LocalSkyScheme.current.dark)
    val accent: Color @Composable @ReadOnlyComposable get() = sunArc
    /** Qibla gold: bright on dark skies, deeper on light ones so it stays readable. */
    val gold: Color @Composable @ReadOnlyComposable get() = gold(LocalSkyScheme.current.dark)
    val success: Color @Composable @ReadOnlyComposable get() = if (LocalSkyScheme.current.dark) successDark else successLight

    /** SwiftUI's `.primary`: white on dark skies, near-black on light ones. */
    val primary: Color @Composable @ReadOnlyComposable get() = if (LocalSkyScheme.current.dark) Color.White else Color(0xFF111114)
    val secondary: Color @Composable @ReadOnlyComposable get() = primary.copy(alpha = 0.6f)

    /** Frosted card fill on the sky (stands in for iOS's ultra-thin material). */
    val material: Color @Composable @ReadOnlyComposable
        get() = if (LocalSkyScheme.current.dark) Color.White.copy(alpha = 0.09f) else Color.White.copy(alpha = 0.5f)
    val materialStrong: Color @Composable @ReadOnlyComposable
        get() = if (LocalSkyScheme.current.dark) Color(0xFF1C1F3A).copy(alpha = 0.92f) else Color(0xFFF4F4F8).copy(alpha = 0.96f)
}

/**
 * Each prayer's colour is the sky at that time of day: dawn blue for Subuh,
 * morning gold, the hot noon sun, warm afternoon amber, sunset red, and the
 * indigo of night. Used by the Day Dial, the prayer rows and the widget.
 */
val Prayer.tint: Color
    get() = when (this) {
        Prayer.FAJR -> rgb(0.50, 0.61, 0.88)
        Prayer.SUNRISE -> rgb(0.95, 0.77, 0.42)
        Prayer.DHUHR -> rgb(0.95, 0.60, 0.20)
        Prayer.ASR -> rgb(0.91, 0.50, 0.25)
        Prayer.MAGHRIB -> rgb(0.87, 0.36, 0.33)
        Prayer.ISHA -> rgb(0.42, 0.37, 0.76)
    }

/** The colours of the classic Singapore timetable, a shade calmer. */
object BandsPalette {
    val header = Color(0.17f, 0.17f, 0.17f)
    val dateBar = Color(0.24f, 0.24f, 0.24f)
    val blessed = Color(0.3f, 0.3f, 0.3f)
    fun color(prayer: Prayer): Color = when (prayer) {
        Prayer.FAJR -> rgb(0.13, 0.43, 0.36)
        Prayer.SUNRISE -> rgb(0.56, 0.66, 0.32)
        Prayer.DHUHR -> rgb(0.85, 0.67, 0.13)
        Prayer.ASR -> rgb(0.89, 0.58, 0.32)
        Prayer.MAGHRIB -> rgb(0.88, 0.43, 0.33)
        Prayer.ISHA -> rgb(0.86, 0.31, 0.35)
    }
}

val SourceGrade.tint: Color
    @Composable @ReadOnlyComposable get() = when (this) {
        SourceGrade.OFFICIAL -> rgb(0.45, 0.86, 0.62)
        SourceGrade.MASJID -> rgb(0.55, 0.78, 1.0)
        SourceGrade.COMMUNITY -> rgb(1.0, 0.82, 0.45)
        SourceGrade.CALCULATED -> Palette.primary.copy(alpha = 0.75f)
        SourceGrade.FALAK -> Palette.accent
    }

val BlessedTime.tint: Color @Composable @ReadOnlyComposable get() = Palette.primary.copy(alpha = 0.45f)
