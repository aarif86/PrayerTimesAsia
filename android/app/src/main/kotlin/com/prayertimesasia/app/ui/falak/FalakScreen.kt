package com.prayertimesasia.app.ui.falak

import android.app.TimePickerDialog
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Brightness2
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Stars
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material.icons.filled.WbTwilight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.heading as markHeading
import androidx.compose.ui.semantics.semantics
import com.prayertimesasia.app.ui.components.LookIcons
import com.prayertimesasia.app.ui.components.lookCard
import com.prayertimesasia.app.ui.components.lookText
import com.prayertimesasia.app.ui.theme.LocalLook
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.Chip
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.Astro
import com.prayertimesasia.core.Falak
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.fmt
import com.prayertimesasia.core.secondsSince
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.R

/** The four parts of the Falak home. */
private enum class FalakPart { SKY, THEN, NOW, WHY }

/** What the Falak home can open. */
enum class FalakTool { STEPS, SHADOW_CAMERA, EXPERT, CAMERA, LEVEL }

/**
 * Falak for everyone (Nov 2026). A calm home that tells the story in four
 * parts: the Sky (slide the sun), Then (how Muslims read the sky), Now (try it
 * yourself) and Why it helps. The detailed tools stay under Expert tools.
 * Everything here is Grade F, for learning, never in place of the authority's times.
 * Drawn in the five looks as on the web app (web/src/ui/Falak.tsx, `.v12f`).
 */
@Composable
fun FalakScreen(state: AppState, open: (FalakTool) -> Unit) {
    val place = state.resolver.activePlace
    val look = LocalLook.current
    var part by remember { mutableStateOf(FalakPart.SKY) }
    // The root draws the page behind (Living Sky, or the flat Colour Bands and Calm Gold page).
    Box(Modifier.fillMaxSize()) {
        if (place == null) {
            Text(tr(R.string.falak_choosePlace), style = lookText(17.sp, FontWeight.SemiBold), color = look.c.tx,
                modifier = Modifier.align(Alignment.Center))
            return@Box
        }
        val now = state.now
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.padding(top = 6.dp)) {
                Text(tr(R.string.tab_falak), style = lookText(if (look.simple) 38.sp else 34.sp, FontWeight.Bold, 1.1f), color = look.c.tx,
                    modifier = Modifier.semantics { markHeading() })
                Text(tr(R.string.falak_lede), style = lookText(15.sp), color = look.c.tx2, modifier = Modifier.padding(top = 4.dp))
            }
            PartPicker(part) { part = it }
            when (part) {
                FalakPart.SKY -> {
                    SkySliderCard(state, place, now)
                    ToolRows(state, place, now, full = false, open = open)
                }
                FalakPart.THEN -> ThenStory(state)
                FalakPart.NOW -> {
                    ToolRows(state, place, now, full = true, open = open)
                    SunSafetyCard()
                }
                FalakPart.WHY -> WhyItHelps()
            }
            Text(tr(R.string.falak_footer), style = lookText(12.sp), color = look.c.tx2, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp))
        }
    }
}

/** The segmented control, in the look's colours (square in Colour Bands). */
@Composable
private fun PartPicker(selected: FalakPart, onPick: (FalakPart) -> Unit) {
    val look = LocalLook.current
    val labels = listOf(FalakPart.SKY to tr(R.string.falak_tabSky), FalakPart.THEN to tr(R.string.falak_tabThen),
        FalakPart.NOW to tr(R.string.falak_tabNow), FalakPart.WHY to tr(R.string.falak_tabWhy))
    val outer = RoundedCornerShape(if (look.bands) 0.dp else 10.dp)
    val inner = RoundedCornerShape(if (look.bands) 0.dp else 8.dp)
    val on = if (look.dark) look.c.card else Color.White
    Row(Modifier.fillMaxWidth().clip(outer).background(look.c.sep).padding(2.dp)) {
        labels.forEach { (p, label) ->
            val isOn = p == selected
            Box(
                // 48 dp tall for touch (Android's rule); the web's is 36 px.
                Modifier.weight(1f).heightIn(min = 48.dp)
                    .then(if (isOn) Modifier.shadow(2.dp, inner).clip(inner).background(on) else Modifier.clip(inner))
                    .selectable(selected = isOn, role = Role.Tab) { onPick(p) },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = lookText(14.sp, FontWeight.SemiBold), color = if (isOn) look.c.tx else look.c.tx2)
            }
        }
    }
}

@Composable
private fun ToolRows(state: AppState, place: Place, now: Instant, full: Boolean, open: (FalakTool) -> Unit) {
    val look = LocalLook.current
    val r = state.resolver
    val d = now.atZone(r.zone).toLocalDate()
    val plan = remember(d, place.coordinates) { Falak.shadowDay(d.year, d.monthValue, d.dayOfMonth, place.coordinates) }
    val today = remember(d, place.coordinates) { Falak.rashdulQiblat(d.year, d.monthValue, d.dayOfMonth, r.zone, place.coordinates) }
    val asr = Prayer.ASR.name(r.naming)
    val next = today.firstOrNull { it.time > now }
    val later = if (next == null) remember(d, place.coordinates) { nextAlignment(state, place, d) } else null
    val qiblaLine = when {
        next != null -> tr(R.string.falak_qiblaSunToday, "time" to r.formatted(next.time))
        later != null -> tr(R.string.falak_qiblaSunNext, "date" to DateTimeFormatter.ofPattern("d MMMM", Locale.ENGLISH).format(later.time.atZone(r.zone)))
        else -> tr(R.string.falak_qiblaSunNone)
    }
    val rows = mutableListOf<ToolRowData>()
    rows += ToolRowData("footprints", tr(R.string.falak_stepsTitle), tr(R.string.falak_stepsSub, "name" to asr),
        Falak.stepsText(Falak.asrSteps(plan, r.asrSchool))) { open(FalakTool.STEPS) }
    rows += ToolRowData("camera", tr(R.string.falak_cameraTitle), tr(R.string.falak_cameraTitleSub)) { open(FalakTool.SHADOW_CAMERA) }
    rows += ToolRowData("compass", tr(R.string.falak_qiblaSunTitle), qiblaLine) { open(FalakTool.EXPERT) }
    if (full) {
        val qd = Falak.nextQiblaDay(now)
        rows += ToolRowData("sun", tr(R.string.falak_sunOverKaaba),
            "${DateTimeFormatter.ofPattern("d MMMM", Locale.ENGLISH).format(qd.atZone(r.zone))} · ${r.formatted(qd)}") { open(FalakTool.EXPERT) }
        r.day(now)?.let { official ->
            rows += ToolRowData("moonStar", tr(R.string.falak_skyTonight),
                tr(R.string.falak_skyTonightSub, "name" to Prayer.MAGHRIB.name(r.naming), "time" to r.formatted(official.time(Prayer.MAGHRIB)))) { open(FalakTool.EXPERT) }
        }
        rows += ToolRowData("scanEye", tr(R.string.falak_camera), tr(R.string.falak_cameraSub)) { open(FalakTool.CAMERA) }
        rows += ToolRowData("level", tr(R.string.falak_level), tr(R.string.falak_levelSub)) { open(FalakTool.LEVEL) }
        rows += ToolRowData("ruler", tr(R.string.falak_expert), tr(R.string.falak_expertSub)) { open(FalakTool.EXPERT) }
    }
    // Colour Bands: each tool a full width band (deeper band tones, so white words pass 4.5:1).
    val group = if (look.bands) Modifier.wideBy(Dims.gutter) else Modifier.fillMaxWidth().lookCard(look)
    Column(group) {
        rows.forEachIndexed { i, row ->
            if (i > 0 && !look.bands) Box(Modifier.fillMaxWidth().height(1.dp).background(look.c.sep))
            ToolRow(row, if (look.bands) ToolBands[i % ToolBands.size] else null)
        }
    }
}

/** Colour Bands tool rows: the web's band order, in deeper tones so white words read clearly. */
private val ToolBands = listOf(Color(0xFF3A6F63), Color(0xFFA3632C), Color(0xFFBC5057), Color(0xFF6D7940), Color(0xFF88702E), Color(0xFFB0584A))

private class ToolRowData(val icon: String, val title: String, val subtitle: String, val trailing: String? = null, val onClick: () -> Unit)

/** The web's level icon: a bar with a bubble. */
private val LevelIcon by lazy {
    androidx.compose.ui.graphics.vector.ImageVector.Builder("level", 24.dp, 24.dp, 24f, 24f).apply {
        addPath(androidx.compose.ui.graphics.vector.addPathNodes("M4.5 7.5h15a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 14v-4a2.5 2.5 0 0 1 2.5-2.5z"),
            stroke = androidx.compose.ui.graphics.SolidColor(Color.Black), strokeLineWidth = 2.4f)
        addPath(androidx.compose.ui.graphics.vector.addPathNodes("M11 10h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 0-4z"), fill = androidx.compose.ui.graphics.SolidColor(Color.Black))
    }.build()
}

@Composable
private fun ToolRow(row: ToolRowData, band: Color?) {
    val look = LocalLook.current
    val big = look.simple
    val words = if (band != null) Color.White else look.c.tx
    val soft = if (band != null) Color.White else look.c.tx2
    val icon = if (row.icon == "level") LevelIcon else LookIcons.get(row.icon, 2.4f)
    Row(
        Modifier.fillMaxWidth().then(if (band != null) Modifier.background(band) else Modifier)
            .heightIn(min = if (band != null) 64.dp else if (big) 72.dp else 58.dp)
            .clickable(onClick = row.onClick).padding(horizontal = if (band != null) 24.dp else 18.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        FalakIco(icon, onBand = band != null)
        Column(Modifier.weight(1f)) {
            Text(row.title, style = lookText(if (band != null) 19.sp else if (big) 21.sp else 17.sp, if (band != null) FontWeight.Bold else FontWeight.SemiBold), color = words)
            Text(row.subtitle, style = lookText(if (band != null) 15.sp else 13.sp, if (band != null) FontWeight.SemiBold else FontWeight.Normal),
                color = soft, maxLines = 2, modifier = Modifier.padding(top = 2.dp))
        }
        if (row.trailing != null) Text(row.trailing, style = lookText(15.sp, if (band != null) FontWeight.SemiBold else FontWeight.Normal), color = soft)
        Icon(LookIcons.get("chevron"), null, Modifier.size(16.dp), tint = if (band != null) Color.White else look.c.tx3)
    }
}

/** The detailed F1 tools, unchanged, for people who want the numbers. */
@Composable
fun FalakExpertContent(state: AppState) {
    val place = state.resolver.activePlace ?: return
    val now = state.now
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter).padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(tr(R.string.falak_expert), style = Txt.headline, color = Palette.primary)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip(tr(R.string.falak_grade), Icons.Filled.WbSunny)
            Chip(tr(R.string.falak_pendingReview), Icons.Filled.HourglassEmpty)
        }
        SunSafetyCard()
        ShadowCompassCard(place, now)
        QiblaDayCard(state, place, now)
        RashdulCard(state, place, now)
        ShadowStickCard(state, place)
        SkySignsCard(state, now)
        Text(Falak.REVIEW_NOTE, style = Txt.footnote, color = Palette.primary.copy(alpha = 0.75f))
    }
}

@Composable
private fun CardTitle(title: String, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, Modifier.size(20.dp), tint = Palette.primary)
        Text(title, style = Txt.headline, color = Palette.primary)
    }
}

@Composable
fun SunSafetyCard() {
    val look = LocalLook.current
    val shape = RoundedCornerShape(look.c.radius)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(Palette.warning.copy(alpha = 0.22f), shape).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(LookIcons.get("warn"), null, Modifier.size(26.dp), tint = Palette.warning)
        Text(tr(R.string.falak_neverLook), style = lookText(13.sp, FontWeight.SemiBold), color = look.c.tx)
    }
}

/** Where an upright stick's shadow points right now, against the qibla line. */
@Composable
private fun ShadowCompassCard(place: Place, now: Instant) {
    val sun = Falak.sunPosition(now, place.coordinates)
    val qibla = Geo.qiblaBearing(place.coordinates)
    val shadowBearing = Astro.fix(sun.azimuth + 180, 360.0)
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CardTitle("The shadow right now", Icons.Filled.WbSunny)
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                ShadowDial(qibla, shadowBearing, sun.altitude, Modifier.size(140.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (sun.altitude > 0) {
                        Text("Sun ${sun.altitude.roundToInt()}° up, in the ${Geo.compassPoint(sun.azimuth)}", style = Txt.subheadlineSemibold, color = Palette.primary)
                        Text("A stick's shadow points ${shadowBearing.roundToInt()}° ${Geo.compassPoint(shadowBearing)} and is ${fmt("%.1f", Falak.shadowLength(1.0, max(sun.altitude, 0.5)))}× its height.",
                            style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f))
                    } else {
                        Text(tr(R.string.falak_sunBelow), style = Txt.subheadlineSemibold, color = Palette.primary)
                        Text(tr(R.string.falak_afterSunrise), style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f))
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Filled.Navigation, null, Modifier.size(14.dp), tint = Palette.gold)
                        Text("Qibla ${qibla.roundToInt()}° ${Geo.compassPoint(qibla)}", style = Txt.footnoteSemibold, color = Palette.gold)
                    }
                }
            }
        }
    }
}

@Composable
private fun ShadowDial(qibla: Double, shadowBearing: Double, altitude: Double, modifier: Modifier) {
    val primary = Palette.primary
    val gold = Palette.gold
    val north = Palette.north
    Box(modifier) {
        Canvas(Modifier.fillMaxSize()) {
            val r = size.minDimension / 2
            val c = center
            fun point(bearing: Double, len: Float) =
                Offset((c.x + cos((bearing - 90) * PI / 180) * len).toFloat(), (c.y + sin((bearing - 90) * PI / 180) * len).toFloat())
            drawCircle(primary.copy(alpha = 0.08f), r)
            drawCircle(primary.copy(alpha = 0.3f), r - 0.5f, style = Stroke(1f))
            for (i in 0 until 4) drawLine(primary.copy(alpha = 0.6f), point(i * 90.0, r - 8.dp.toPx()), point(i * 90.0, r - 1.dp.toPx()), 1.5.dp.toPx())
            // Qibla line, dashed, through the stick.
            drawLine(gold.copy(alpha = 0.9f), point(qibla + 180, r - 6.dp.toPx()), point(qibla, r - 6.dp.toPx()), 2.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())))
            drawCircle(gold, 5.dp.toPx(), point(qibla, r - 6.dp.toPx()))
            // The shadow: longer when the sun is low.
            if (altitude > 0) {
                val len = min(r - 10.dp.toPx(), max(r * 0.3f, (r - 10.dp.toPx()) * 0.25f * Falak.shadowLength(1.0, altitude).toFloat()))
                drawLine(Color.Black.copy(alpha = 0.75f), c, point(shadowBearing, len), 8.dp.toPx(), cap = StrokeCap.Round)
            }
            drawCircle(primary, 5.dp.toPx(), c)
        }
        Text("N", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = north, modifier = Modifier.align(Alignment.TopCenter).padding(top = 9.dp))
    }
}

private fun longDate(state: AppState, d: Instant): String =
    DateTimeFormatter.ofPattern("EEEE d MMMM yyyy", Locale.ENGLISH).format(d.atZone(state.resolver.zone))

@Composable
private fun QiblaDayCard(state: AppState, place: Place, now: Instant) {
    val r = state.resolver
    val day = Falak.nextQiblaDay(now)
    val sun = Falak.sunPosition(day, place.coordinates)
    val days = ChronoUnit.DAYS.between(now.atZone(r.zone).toLocalDate(), day.atZone(r.zone).toLocalDate())
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            CardTitle("Qibla Day", Icons.Filled.WbSunny)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (days <= 0) "Today" else "$days", style = display(44.sp, FontWeight.Bold), color = Palette.primary,
                    modifier = Modifier.alignByBaseline())
                if (days > 0) Text(if (days == 1L) "day to go" else "days to go", style = Txt.headline, color = Palette.primary.copy(alpha = 0.85f),
                    modifier = Modifier.alignByBaseline())
            }
            Text("${longDate(state, day)} at ${r.formatted(day)} your time", style = Txt.subheadlineSemibold, color = Palette.primary)
            Text("Twice a year the sun stands directly over the Ka'bah at Makkah noon (istiwa' a'zam). At that minute, every upright shadow wherever the sun is up points straight away from the Ka'bah - the most exact qibla check there is, with nothing but a stick.",
                style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f))
            if (sun.altitude > 3) {
                IconLine(Icons.Filled.CheckCircle, "Visible from here: the sun will be ${sun.altitude.roundToInt()}° up. Stand a straight stick upright on level ground and face from the shadow's tip to its base. The day before and after also work within about half a degree.")
            } else {
                IconLine(Icons.Filled.Brightness2, "The sun is down here at that moment. Use the daily rashdul qiblat below, or the next Qibla Day.")
            }
        }
    }
}

@Composable
private fun IconLine(icon: ImageVector, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, Modifier.size(16.dp), tint = Palette.primary)
        Text(text, style = Txt.footnote, color = Palette.primary)
    }
}

@Composable
private fun RashdulCard(state: AppState, place: Place, now: Instant) {
    val r = state.resolver
    val d = now.atZone(r.zone).toLocalDate()
    val today = remember(d, place.coordinates) { Falak.rashdulQiblat(d.year, d.monthValue, d.dayOfMonth, r.zone, place.coordinates) }
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            CardTitle("Rashdul qiblat today", Icons.Filled.SwapVert)
            Text(tr(R.string.falak_rashdulExplain),
                style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f))
            if (today.isEmpty()) {
                val next = remember(d, place.coordinates) { nextAlignment(state, place, d) }
                Text(if (next != null) "No alignment with the sun high enough today. Next: ${longDate(state, next.time)} at ${r.formatted(next.time)}."
                    else "The sun doesn't line up with the qibla from here in the coming weeks. Use the compass or Qibla Day.",
                    style = Txt.subheadlineSemibold, color = Palette.primary)
            } else {
                today.forEach { a ->
                    Column(Modifier.then(if (a.time < now) Modifier.background(Color.Transparent) else Modifier), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(r.formatted(a.time), style = display(24.sp, FontWeight.Bold), color = Palette.primary.copy(alpha = if (a.time < now) 0.6f else 1f))
                            if (a.time < now) Text("  passed", style = Txt.captionSemibold, color = Palette.secondary)
                            Box(Modifier.weight(1f))
                            Text("sun ${a.altitude.roundToInt()}° up", style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
                        }
                        Text(a.shadowNote, style = Txt.footnote, color = Palette.primary.copy(alpha = if (a.time < now) 0.6f else 1f))
                    }
                }
                Text("Good for about ±2 minutes either side; check that the stick is truly vertical with a plumb line or a hanging string.",
                    style = Txt.caption, color = Palette.primary.copy(alpha = 0.7f))
            }
        }
    }
}

private fun nextAlignment(state: AppState, place: Place, from: LocalDate): Falak.Alignment? {
    for (offset in 1..60) {
        val d = from.plusDays(offset.toLong())
        Falak.rashdulQiblat(d.year, d.monthValue, d.dayOfMonth, state.resolver.zone, place.coordinates).firstOrNull()?.let { return it }
    }
    return null
}

/** Tongkat istiwa' (shadow stick). */
@Composable
private fun ShadowStickCard(state: AppState, place: Place) {
    val r = state.resolver
    val context = LocalContext.current
    val height = state.prefs.stickHeight
    var heightText by remember { mutableStateOf(trim(height)) }
    var shadowText by remember { mutableStateOf("") }
    var measuredAt by remember { mutableStateOf(state.now) }
    val d = measuredAt.atZone(r.zone).toLocalDate()
    val plan = Falak.shadowDay(d.year, d.monthValue, d.dayOfMonth, place.coordinates)
    val school = r.asrSchool
    val official = r.day(measuredAt)
    val fieldColors = OutlinedTextFieldDefaults.colors(focusedTextColor = Palette.primary, unfocusedTextColor = Palette.primary,
        focusedBorderColor = Palette.accent, unfocusedBorderColor = Palette.primary.copy(alpha = 0.3f), cursorColor = Palette.accent)
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CardTitle("Tongkat istiwa' (shadow stick)", Icons.Filled.Straighten)
            Text("Stand a straight stick upright on level ground - a pen on a table works. Measure the stick and its shadow in centimetres.",
                style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(tr(R.string.falak_stickHeight), style = Txt.subheadline, color = Palette.primary, modifier = Modifier.weight(1f))
                OutlinedTextField(heightText, { t ->
                    heightText = t
                    t.replace(',', '.').toDoubleOrNull()?.takeIf { it > 0 }?.let { v -> state.update { it.copy(stickHeight = v) } }
                }, singleLine = true, suffix = { Text(tr(R.string.phone_cm)) }, colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.width(120.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(tr(R.string.falak_forStick), style = Txt.subheadlineSemibold, color = Palette.primary)
                PlanRow("Zawal (shortest shadow)", r.formatted(plan.noon), "${cm(plan.noonShadow(height))} pointing ${Geo.compassPoint(plan.noonShadowBearing)}")
                plan.asrShafii?.let { PlanRow("Asr, Shafi'i (+1× stick)", r.formatted(it), cm(plan.asrShadow(height, AsrSchool.STANDARD))) }
                plan.asrHanafi?.let { PlanRow("Asr, Hanafi (+2× stick)", r.formatted(it), cm(plan.asrShadow(height, AsrSchool.HANAFI))) }
                Text("${Prayer.DHUHR.name(r.naming)} begins once the shadow stops shrinking and starts to grow. Asr begins when the shadow is the noon shadow plus the stick's height (twice it, for Hanafi).",
                    style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
                if (official != null) {
                    Text("Your timetable: ${Prayer.DHUHR.name(r.naming)} ${r.formatted(official.time(Prayer.DHUHR))}, Asr ${r.formatted(official.time(Prayer.ASR))}. Timetables add a few minutes of ihtiyat (precaution) on top of the sun's geometry.",
                        style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
                }
            }
            HorizontalDivider(color = Palette.primary.copy(alpha = 0.3f))
            Text(tr(R.string.falak_checkReading), style = Txt.subheadlineSemibold, color = Palette.primary)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(tr(R.string.falak_shadowLength), style = Txt.subheadline, color = Palette.primary, modifier = Modifier.weight(1f))
                OutlinedTextField(shadowText, { shadowText = it }, singleLine = true, suffix = { Text(tr(R.string.phone_cm)) }, colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.width(120.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(tr(R.string.falak_measuredAt), style = Txt.subheadline, color = Palette.primary, modifier = Modifier.weight(1f))
                Text(r.formatted(measuredAt), style = Txt.subheadlineSemibold, color = Palette.accentText, modifier = Modifier.clickable {
                    val z = measuredAt.atZone(r.zone)
                    TimePickerDialog(context, { _, h, m ->
                        measuredAt = z.withHour(h).withMinute(m).withSecond(0).toInstant()
                    }, z.hour, z.minute, state.prefs.use24Hour).show()
                }.padding(6.dp))
                Text(tr(R.string.common_now), style = Txt.subheadlineSemibold, color = Palette.primary,
                    modifier = Modifier.clip(CircleShape).background(Palette.primary.copy(alpha = 0.12f)).clickable { measuredAt = state.now }
                        .padding(horizontal = 12.dp, vertical = 6.dp))
            }
            val shadow = shadowText.replace(',', '.').toDoubleOrNull()
            val reading = shadow?.let { Falak.reading(height, it, measuredAt, place.coordinates, r.zone, school) }
            if (shadow != null && reading != null) ReadingResult(state, reading, height, plan, school)
        }
    }
}

private fun trim(v: Double) = if (v == Math.rint(v)) v.toInt().toString() else fmt("%.1f", v)
private fun cm(v: Double) = if (v.isFinite()) fmt("%.1f cm", v) else "-"

private fun minutesText(m: Double): String {
    val r = m.roundToInt()
    return if (abs(r) == 1) "${abs(r)} minute" else "${abs(r)} minutes"
}

@Composable
private fun PlanRow(label: String, time: String, detail: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, style = Txt.footnote, color = Palette.primary)
            Text(detail, style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
        }
        Text(time, style = Txt.subheadlineSemibold.copy(fontFeatureSettings = "tnum"), color = Palette.primary)
    }
}

@Composable
private fun ReadingResult(state: AppState, r: Falak.Reading, height: Double, plan: Falak.ShadowDay, school: AsrSchool) {
    val res = state.resolver
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Palette.accent.copy(alpha = 0.18f)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Chip("Grade F · your observation", Icons.Filled.WbSunny)
        Text("The sun is ${fmt("%.1f", r.altitude)}° up by your shadow.", style = Txt.subheadlineSemibold, color = Palette.primary)
        val t = r.sunTime
        val off = r.offsetMinutes
        val pm = r.uncertaintyMinutes
        if (t != null && off != null && pm != null) {
            val side = if (abs(off) <= pm) "matches the clock" else if (off > 0) "is ${minutesText(off)} ahead of the clock" else "is ${minutesText(off)} behind the clock"
            Text("That puts the sun's time at ${res.formatted(t)} (±${ceil(pm).toInt()} min), which $side.", style = Txt.footnote, color = Palette.primary)
            if (abs(off) > pm) {
                Text("Usual causes: the stick isn't vertical, the ground isn't level, or the shadow tip was hard to see. Try again with a plumb line.",
                    style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
            }
        } else {
            Text("The sun never gets that low on this side of noon today. Re-measure, or check the time.", style = Txt.footnote, color = Palette.primary)
        }
        val reached = r.asrReached
        val schoolName = if (school == AsrSchool.HANAFI) "Hanafi" else "Shafi'i"
        if (reached != null) {
            val target = plan.asrShadow(height, school)
            Text(if (reached) "Asr ($schoolName) has begun by your shadow: it is past ${cm(target)}."
                else "Asr ($schoolName) hasn't begun by your shadow: it needs to reach ${cm(target)}.",
                style = Txt.footnoteSemibold, color = Palette.primary)
        } else {
            Text("Morning reading - before zawal. ${Prayer.DHUHR.name(res.naming)} has not begun.", style = Txt.footnoteSemibold, color = Palette.primary)
        }
    }
}

@Composable
private fun SkySignsCard(state: AppState, now: Instant) {
    val r = state.resolver
    val day = r.day(now)
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            CardTitle("Signs in the sky", Icons.Filled.Stars)
            Text("What the prayer times describe, so you can see them for yourself. Informational: city lights, haze and buildings hide these signs, and scholars differ on how to read dawn and twilight. Pray by your timetable.",
                style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f))
            Sign(state, Prayer.MAGHRIB, day?.time(Prayer.MAGHRIB), Icons.Filled.WbTwilight,
                "The whole disc of the sun has gone below the horizon - its upper edge has disappeared. Best seen over the sea or open land; behind hills or buildings it vanishes early, so don't pray by that.")
            Sign(state, Prayer.ISHA, day?.time(Prayer.ISHA), Icons.Filled.Brightness2,
                "The red glow (shafaq ahmar) has gone from the western sky - the view of the Shafi'i, Maliki and Hanbali schools. Imam Abu Hanifah held it is the white glow that follows it. Timetables use the sun's depth below the horizon (about 17°-18°) instead.")
            Sign(state, Prayer.FAJR, day?.time(Prayer.FAJR), Icons.Filled.WbTwilight,
                "True dawn (fajr sadiq): a thin whiteness spreading sideways along the eastern horizon, growing steadily. Not the false dawn (fajr kazib) before it: a faint upright column of light that fades again. Researchers still debate the exact depth of the sun at true dawn, so this stays informational.")
        }
    }
}

@Composable
private fun Sign(state: AppState, prayer: Prayer, time: Instant?, icon: ImageVector, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, Modifier.size(24.dp), tint = Palette.primary)
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row {
                Text(prayer.name(state.resolver.naming), style = Txt.subheadlineSemibold, color = Palette.primary, modifier = Modifier.weight(1f))
                if (time != null) Text("today ${state.resolver.formatted(time)}", style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
            }
            Text(text, style = Txt.footnote, color = Palette.primary.copy(alpha = 0.9f))
        }
    }
}

