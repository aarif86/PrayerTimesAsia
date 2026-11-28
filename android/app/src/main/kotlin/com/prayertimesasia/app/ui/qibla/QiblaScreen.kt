package com.prayertimesasia.app.ui.qibla

import android.os.Build
import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.prayertimesasia.app.ui.falak.wideBy
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading as markHeading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.Tab
import com.prayertimesasia.app.ui.components.BandColors
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.LookButton
import com.prayertimesasia.app.ui.components.LookIcons
import com.prayertimesasia.app.ui.components.green
import com.prayertimesasia.app.ui.components.lookCard
import com.prayertimesasia.app.ui.components.lookText
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.core.Astro
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.Place
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Qibla compass, in the five looks as on the web app (web/src/ui/Qibla.tsx). The dial turns
 * with the phone so the Ka'bah always sits at the true qibla; line it up with the top marker
 * and the dial shows a green tick and the phone taps.
 */
@Composable
fun QiblaScreen(state: AppState) {
    val place = state.resolver.activePlace
    val look = LocalLook.current
    // The root draws the page behind (Living Sky, or the flat Colour Bands and Calm Gold page).
    Box(Modifier.fillMaxSize()) {
        if (place == null) {
            Text(tr(R.string.qibla_choosePlace), style = lookText(17.sp, FontWeight.SemiBold), color = look.c.tx,
                textAlign = TextAlign.Center, modifier = Modifier.align(Alignment.Center).padding(horizontal = Dims.gutter))
        } else {
            QiblaContent(state, place)
        }
    }
}

@Composable
private fun QiblaContent(state: AppState, place: Place) {
    val context = LocalContext.current
    val view = LocalView.current
    val look = LocalLook.current
    val compass = remember { hasCompass(context) }
    val bearing = Geo.qiblaBearing(place.coordinates)
    val fixedHeading = state.demoHeading
    val live by rememberHeading(place.coordinates, enabled = !state.demoAligned && fixedHeading == null)
    val heading: Double? = when {
        state.demoAligned -> bearing
        fixedHeading != null -> fixedHeading
        else -> live?.degrees
    }
    val delta = heading?.let { Geo.angleDelta(bearing, it) }
    var aligned by remember { mutableStateOf(state.demoAligned) }
    aligned = state.demoAligned || nextAligned(aligned, delta)
    // Heading accumulated without wrapping, so crossing north turns the dial a few degrees, not the long way round.
    val acc = remember { HeadingSum() }
    if (heading != null) {
        val l = acc.last
        acc.heading = if (l == null) heading else acc.heading + Geo.angleDelta(heading, l)
        acc.last = heading
    }
    val dialHeading = acc.heading
    LaunchedEffect(heading != null) { if (heading != null && !state.demoAligned) state.usageAction("qiblaCompass") }
    LaunchedEffect(aligned) {
        if (aligned && !state.demoAligned) state.usageAction("qiblaFaced")
        if (aligned && !state.demoAligned) {
            view.performHapticFeedback(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS)
        }
    }

    val instruction = when {
        delta == null -> tr(R.string.qibla_faceFromNorth, "deg" to bearing.roundToInt())
        aligned -> tr(R.string.qibla_youAreFacing)
        delta > 0 -> tr(R.string.qibla_turnRight, "deg" to abs(delta).roundToInt())
        else -> tr(R.string.qibla_turnLeft, "deg" to abs(delta).roundToInt())
    }
    // Spoken in steps of 10 degrees, so a screen reader is not interrupted at every degree.
    val step = if (delta == null) 0 else max(10, (abs(delta) / 10).roundToInt() * 10)
    val spoken = when {
        delta == null || aligned -> instruction
        delta > 0 -> tr(R.string.qibla_turnRightAbout, "deg" to step)
        else -> tr(R.string.qibla_turnLeftAbout, "deg" to step)
    }
    val km = NumberFormat.getIntegerInstance(Locale.US).format(Geo.distanceKm(place.coordinates, Geo.kaaba).roundToInt())
    val statQibla = "${bearing.roundToInt()}° ${Geo.compassPoint(bearing)}"
    val statFacing = heading?.let { "${Astro.fix(it, 360.0).roundToInt() % 360}°" } ?: "…"
    val statKm = tr(R.string.common_km, "n" to km)
    val dial = DialInput(heading = dialHeading.toFloat(), rel = (bearing - (if (heading != null) dialHeading else 0.0)).toFloat(), aligned = aligned)
    val toSun = { state.selectedTab = Tab.FALAK }
    val sayColor = if (aligned) look.green else look.c.tx
    val title = tr(R.string.qibla_title)
    val sunLabel = tr(R.string.qibla_falakMode)

    @Composable
    fun Title(size: Int = 34) = Text(title, style = lookText(size.sp, FontWeight.Bold, 1.1f), color = look.c.tx, textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp).semantics { markHeading() })

    @Composable
    fun Say(size: Int, weight: FontWeight, color: Color = sayColor, modifier: Modifier = Modifier, align: TextAlign = TextAlign.Center, lineHeight: Float = 1.25f) =
        Text(instruction, style = lookText(size.sp, weight, lineHeight), color = color, textAlign = align,
            modifier = modifier.clearAndSetSemantics { contentDescription = spoken; liveRegion = LiveRegionMode.Polite })

    @Composable
    fun Stats() = Row(Modifier.fillMaxWidth().padding(top = 12.dp).lookCard(look).padding(horizontal = 4.dp, vertical = 12.dp)) {
        listOf(tr(R.string.qibla_title) to statQibla, tr(R.string.qibla_facingShort) to statFacing, tr(R.string.qibla_toMakkah) to statKm).forEach { (a, b) ->
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(a.uppercase(), style = lookText(11.sp, FontWeight.Medium).copy(letterSpacing = 0.9.sp), color = look.c.tx2, maxLines = 1)
                Text(b, style = lookText(17.sp, FontWeight.Bold).copy(fontFeatureSettings = "tnum"), color = look.c.tx, maxLines = 1)
            }
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(horizontal = if (look.bands) 0.dp else Dims.gutter).padding(bottom = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when {
            look.bands -> {
                Box(Modifier.fillMaxWidth().heightIn(min = 80.dp).background(BandColors[0]).padding(horizontal = 24.dp), contentAlignment = Alignment.CenterStart) {
                    Text(title, style = lookText(34.sp, FontWeight.Bold, 1f), color = Color.White, modifier = Modifier.semantics { markHeading() })
                }
                Say(20, FontWeight.Bold, align = TextAlign.Start, modifier = Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 14.dp, bottom = 4.dp))
                Box(Modifier.padding(top = 18.dp)) { BandsCompass(dial) }
                Column(Modifier.fillMaxWidth().padding(top = 14.dp)) {
                    listOf(tr(R.string.qibla_title) to statQibla, tr(R.string.qibla_facingShort) to statFacing, tr(R.string.qibla_toMakkah) to statKm)
                        .forEachIndexed { i, (a, b) ->
                            Row(Modifier.fillMaxWidth().heightIn(min = 54.dp).background(BandColors[i + 1]).padding(horizontal = 24.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Text(a, style = lookText(19.sp, FontWeight.Bold), color = Color.White, modifier = Modifier.weight(1f))
                                Text(b, style = lookText(19.sp, FontWeight.Bold).copy(fontFeatureSettings = "tnum"), color = Color.White)
                            }
                        }
                }
            }
            look.simple -> {
                Title(38)
                if (delta != null && !aligned) {
                    Column(Modifier.clearAndSetSemantics { contentDescription = spoken; liveRegion = LiveRegionMode.Polite },
                        horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(tr(if (delta > 0) R.string.qibla_turnRightWord else R.string.qibla_turnLeftWord), style = lookText(26.sp, FontWeight.Bold, 1f), color = look.c.tx)
                        Text("${abs(delta).roundToInt()}°", style = lookText(60.sp, FontWeight.ExtraBold, 1f).copy(fontFeatureSettings = "tnum"), color = look.c.tx,
                            modifier = Modifier.padding(top = 2.dp))
                    }
                } else {
                    Say(28, FontWeight.Bold, lineHeight = 1.15f, modifier = Modifier.padding(bottom = 8.dp))
                }
                Box(Modifier.padding(top = 28.dp)) { SimpleCompass(dial) }
                Text(tr(R.string.qibla_kmToMakkah, "km" to km), style = lookText(23.sp, FontWeight.SemiBold), color = look.c.tx2,
                    textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp))
                LookButton(tr(R.string.qibla_checkSun), LookIcons.get("sun"), Modifier.padding(top = 14.dp), big = true, onClickLabel = sunLabel, onClick = toSun)
            }
            look.sunPath -> {
                Title()
                SunCurve(if (delta != null) delta.toFloat() else Geo.angleDelta(bearing, 0.0).toFloat(), aligned, heading != null,
                    Modifier.padding(top = 18.dp, bottom = 6.dp).fillMaxWidth().wideBy(Dims.gutter))
                Column(Modifier.padding(top = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Say(if (heading == null || aligned) 28 else 38, FontWeight.Bold, lineHeight = 1.05f)
                    if (heading != null && !aligned) {
                        Text(tr(R.string.qibla_sunHint), style = lookText(15.sp), color = look.c.tx2, textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 6.dp, bottom = 4.dp))
                    }
                }
                Stats()
                LookButton(tr(R.string.qibla_checkSun), LookIcons.get("sun"), Modifier.padding(top = 12.dp), onClickLabel = sunLabel, onClick = toSun)
            }
            else -> {
                Title()
                if (look.gold) Say(17, FontWeight.SemiBold, color = if (aligned) look.green else look.c.accentText, modifier = Modifier.padding(bottom = 6.dp))
                else Say(19, FontWeight.SemiBold, modifier = Modifier.padding(bottom = 8.dp))
                Box(Modifier.padding(top = 18.dp)) { if (look.gold) GoldCompass(dial) else BezelCompass(dial) }
                Stats()
                LookButton(tr(R.string.qibla_checkSun), LookIcons.get("sun"), Modifier.padding(top = 12.dp), onClickLabel = sunLabel, onClick = toSun)
            }
        }
        Steps(compass || state.demoAligned || fixedHeading != null, live, sunPath = look.sunPath, bearing = bearing,
            modifier = Modifier.padding(top = 22.dp).padding(horizontal = if (look.bands) 24.dp else 0.dp))
    }
}

/** The heading added up without wrapping (the web keeps this in a ref, not in state). */
private class HeadingSum { var heading = 0.0; var last: Double? = null }

/** How to use it, step by step, plus a calibration note only when needed. */
@Composable
private fun Steps(hasCompass: Boolean, heading: Heading?, sunPath: Boolean, bearing: Double, modifier: Modifier) {
    val look = LocalLook.current
    Column(modifier.fillMaxWidth().lookCard(look).padding(16.dp)) {
        Text(tr(R.string.qibla_howTo), style = lookText(17.sp, FontWeight.SemiBold), color = look.c.tx,
            modifier = Modifier.padding(bottom = 12.dp).semantics { markHeading() })
        if (!hasCompass) {
            Step(icon = LookIcons.get("map"), tint = look.c.accentText,
                text = tr(R.string.qibla_noCompass) + " " + tr(R.string.qibla_noCompassHelp, "deg" to bearing.roundToInt(), "point" to Geo.compassPoint(bearing)))
        } else {
            Step(1, text = tr(R.string.qibla_step1))
            Step(2, text = tr(if (sunPath) R.string.qibla_sunStep2 else R.string.qibla_step2))
            Step(3, text = tr(if (sunPath) R.string.qibla_sunStep3 else R.string.qibla_step3))
            if (heading != null && (heading.unreliable || heading.accuracy > 25)) {
                Step(icon = LookIcons.get("warn"), tint = Color(0xFFFF9F0A), text = tr(R.string.qibla_calibrate))
            }
        }
    }
}

@Composable
private fun ColumnScope.Step(n: Int? = null, icon: ImageVector? = null, tint: Color = Color.Unspecified, text: String) {
    val look = LocalLook.current
    Row(Modifier.padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(22.dp).padding(top = 1.dp), contentAlignment = Alignment.TopCenter) {
            if (n != null) {
                Box(Modifier.size(19.dp).clip(CircleShape).background(look.c.accent), contentAlignment = Alignment.Center) {
                    Text("$n", style = lookText(12.sp, FontWeight.ExtraBold, 1f), color = look.c.onButton)
                }
            } else if (icon != null) {
                Icon(icon, null, Modifier.size(20.dp), tint = tint)
            }
        }
        Text(text, style = lookText(15.sp), color = look.c.tx2, modifier = Modifier.weight(1f))
    }
}
