package com.prayertimesasia.app.ui.masjid

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Brightness2
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.data.Http
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerSpace
import com.prayertimesasia.core.PrayerSpaces
import com.prayertimesasia.core.fmt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

private enum class Kind(val label: String) { ALL("All"), MASJID("Masjid"), MUSOLLAH("Musollah") }

/** What the Masjid tab last found, kept while the app runs so switching tabs doesn't search again. */
object NearbyCache {
    var around: Coordinates? = null
    var spaces: List<PrayerSpace> = emptyList()
}

/**
 * Masjids and musollahs (surau, prayer rooms) near you from OpenStreetMap,
 * on a small radar around where you are, with directions in your maps app.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun MasjidScreen(state: AppState, openAbout: () -> Unit, preset: List<PrayerSpace>? = null) {
    val place = state.resolver.activePlace
    var spaces by remember { mutableStateOf(preset ?: NearbyCache.spaces) }
    var loading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var kind by remember { mutableStateOf(Kind.ALL) }
    var selected by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(place?.coordinates) {
        val c = place?.coordinates ?: return@LaunchedEffect
        if (preset != null || !state.sideEffects) return@LaunchedEffect
        val last = NearbyCache.around
        if (last != null && Geo.distanceKm(last, c) < 0.5 && NearbyCache.spaces.isNotEmpty()) return@LaunchedEffect
        loading = true
        failed = false
        val found = withContext(Dispatchers.IO) {
            runCatching {
                PrayerSpaces.parseOverpass(Http.postForm(PrayerSpaces.OVERPASS_URL, mapOf("data" to PrayerSpaces.overpassQuery(c))), c)
            }.getOrNull()
        }
        loading = false
        if (found == null) failed = true else {
            spaces = found
            NearbyCache.around = c
            NearbyCache.spaces = found
        }
    }
    val visible = when (kind) {
        Kind.ALL -> spaces
        Kind.MASJID -> spaces.filter { !it.isMusollah }
        Kind.MUSOLLAH -> spaces.filter { it.isMusollah }
    }
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(state.skyNow)
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text("Masjid & Musollah", style = Txt.headline, color = Palette.primary, modifier = Modifier.align(Alignment.Center))
                Box(Modifier.align(Alignment.CenterEnd).size(40.dp).clip(CircleShape).clickable(onClickLabel = "About this app", onClick = openAbout),
                    contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.Info, "About this app", Modifier.size(26.dp), tint = Palette.primary)
                }
            }
            if (place != null) {
                Radar(place.coordinates, visible, selected, Modifier.fillMaxWidth().height(280.dp).padding(horizontal = Dims.gutter)) { selected = it }
            }
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                Kind.entries.forEachIndexed { i, k ->
                    SegmentedButton(kind == k, { kind = k }, SegmentedButtonDefaults.itemShape(i, Kind.entries.size),
                        colors = SegmentedButtonDefaults.colors(
                            activeContainerColor = Palette.primary.copy(alpha = 0.18f), activeContentColor = Palette.primary,
                            inactiveContainerColor = Color.Transparent, inactiveContentColor = Palette.primary,
                            activeBorderColor = Palette.primary.copy(alpha = 0.2f), inactiveBorderColor = Palette.primary.copy(alpha = 0.2f)),
                        icon = {}) { Text(k.label) }
                }
            }
            MyMasjidCard(state)
            Spacer(Modifier.height(10.dp))
            when {
                place == null -> Empty("Choose a place", "Allow location or pick a city on the Prayer tab.")
                loading && spaces.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        CircularProgressIndicator(color = Palette.accent)
                        Text("Searching nearby…", style = Txt.subheadline, color = Palette.primary)
                    }
                }
                visible.isEmpty() -> Empty(
                    if (failed) "Couldn't search" else "Nothing listed nearby",
                    if (failed) "Searching needs an internet connection."
                    else "OpenStreetMap has no ${if (kind == Kind.MUSOLLAH) "musollah" else "masjid"} listed within 15 km. Use the Qibla tab to pray where you are.",
                )
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    items(visible, key = { it.id }) { space ->
                        SpaceRow(space, space.id == selected) { selected = space.id }
                        HorizontalDivider(Modifier.padding(start = 56.dp), color = Palette.primary.copy(alpha = 0.1f))
                    }
                    item {
                        Text("Places from OpenStreetMap (© OpenStreetMap contributors). Only the search area is sent.",
                            style = Txt.caption, color = Palette.secondary, modifier = Modifier.padding(Dims.gutter))
                        Spacer(Modifier.height(24.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun Empty(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Filled.Brightness2, null, Modifier.size(36.dp), tint = Palette.secondary)
        Text(title, style = Txt.headline, color = Palette.primary)
        Text(body, style = Txt.subheadline, color = Palette.secondary, textAlign = TextAlign.Center)
    }
}

@Composable
private fun SpaceRow(space: PrayerSpace, selected: Boolean, onSelect: () -> Unit) {
    val context = LocalContext.current
    var menu by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.fillMaxWidth().background(if (selected) Palette.primary.copy(alpha = 0.08f) else Color.Transparent)
                .pointerInput(space.id) {
                    detectTapGestures(onTap = { onSelect(); menu = true }, onLongPress = { menu = true })
                }
                .padding(horizontal = Dims.gutter, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(if (space.isMusollah) Icons.Filled.Home else Icons.Filled.Brightness2, null, Modifier.size(22.dp),
                tint = if (space.isMusollah) Prayer.FAJR.tint else Palette.accent)
            Column(Modifier.weight(1f)) {
                Text(space.name, style = Txt.bodySemibold, color = Palette.primary, maxLines = 2)
                if (space.address.isNotEmpty()) Text(space.address, style = Txt.caption, color = Palette.secondary, maxLines = 1)
            }
            Text(if (space.distanceKm < 1) "${(space.distanceKm * 1000).roundToInt()} m" else fmt("%.1f km", space.distanceKm),
                style = Txt.subheadline.copy(fontFeatureSettings = "tnum"), color = Palette.secondary)
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            DropdownMenuItem(text = { Text("Walking directions") }, onClick = { menu = false; directions(context, space, "w") })
            DropdownMenuItem(text = { Text("Driving directions") }, onClick = { menu = false; directions(context, space, "d") })
            DropdownMenuItem(text = { Text("Show on map") }, onClick = { menu = false; directions(context, space, null) })
        }
    }
}

/** Hands the place to whatever maps app the phone has (geo: works without Google services). */
private fun directions(context: Context, space: PrayerSpace, mode: String?) {
    val c = space.coordinates
    val label = Uri.encode(space.name)
    val nav = mode?.let { Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=${c.latitude},${c.longitude}&mode=$it")) }
    val geo = Intent(Intent.ACTION_VIEW, Uri.parse("geo:${c.latitude},${c.longitude}?q=${c.latitude},${c.longitude}($label)"))
    val web = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}"))
    for (intent in listOfNotNull(nav, geo, web)) {
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        } catch (_: ActivityNotFoundException) {
        }
    }
}

/** You in the middle, each place at its bearing and distance; rings every kilometre or so. */
@Composable
private fun Radar(center: Coordinates, spaces: List<PrayerSpace>, selected: String?, modifier: Modifier, onSelect: (String) -> Unit) {
    val primary = Palette.primary
    val accent = Palette.accent
    val musollah = Prayer.FAJR.tint
    val north = Palette.north
    val maxKm = max(1.0, (spaces.take(12).maxOfOrNull { it.distanceKm } ?: 2.0) * 1.1)
    val layout = remember { mutableListOf<Pair<String, Offset>>() }
    Box(modifier.clip(RoundedCornerShape(Dims.corner)).background(Palette.material)) {
        Canvas(Modifier.fillMaxSize().pointerInput(spaces) {
            detectTapGestures { tap ->
                layout.minByOrNull { hypot((it.second.x - tap.x).toDouble(), (it.second.y - tap.y).toDouble()) }
                    ?.takeIf { hypot((it.second.x - tap.x).toDouble(), (it.second.y - tap.y).toDouble()) < 40.dp.toPx() }
                    ?.let { onSelect(it.first) }
            }
        }) {
            val c = this.center
            val radius = size.minDimension / 2 - 18.dp.toPx()
            val step = when { maxKm > 8 -> 5.0; maxKm > 3 -> 2.0; maxKm > 1.2 -> 1.0; else -> 0.5 }
            var ring = step
            while (ring <= maxKm) {
                drawCircle(primary.copy(alpha = 0.15f), (ring / maxKm * radius).toFloat(), c, style = Stroke(1.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))))
                ring += step
            }
            drawLine(north.copy(alpha = 0.7f), Offset(c.x, c.y - radius - 6.dp.toPx()), Offset(c.x, c.y - radius + 6.dp.toPx()), 2.dp.toPx())
            val placed = mutableListOf<Pair<String, Offset>>()
            for (s in spaces) {
                val b = Math.toRadians(Geo.bearing(center, s.coordinates))
                val d = (sqrt(s.distanceKm / maxKm).coerceAtMost(1.0) * radius).toFloat()
                // Square-root scale keeps the nearest places from piling onto you.
                val p = Offset((c.x + sin(b) * d).toFloat(), (c.y - cos(b) * d).toFloat())
                placed += s.id to p
                val color = if (s.isMusollah) musollah else accent
                val r = (if (s.id == selected) 9 else 6).dp.toPx()
                drawCircle(Color.White, r + 2.dp.toPx(), p)
                drawCircle(color, r, p)
            }
            layout.clear()
            layout.addAll(placed)
            drawCircle(Color.White, 9.dp.toPx(), c)
            drawCircle(Color(0xFF0A84FF), 6.dp.toPx(), c)
        }
        Text("N", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = north, modifier = Modifier.align(Alignment.TopCenter).padding(top = 2.dp))
        val scale = if (maxKm >= 1) "${fmt("%.0f", maxKm)} km" else "${(maxKm * 1000).roundToInt()} m"
        Text("You · up to $scale", style = Txt.caption, color = Palette.secondary, modifier = Modifier.align(Alignment.BottomStart).padding(10.dp))
        spaces.firstOrNull { it.id == selected }?.let {
            Text(it.name, style = Txt.captionSemibold, color = Palette.primary, maxLines = 1,
                modifier = Modifier.align(Alignment.BottomEnd).padding(10.dp).clip(CircleShape).background(Palette.materialStrong).padding(horizontal = 10.dp, vertical = 4.dp))
        }
    }
}
