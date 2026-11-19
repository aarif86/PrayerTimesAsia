package com.prayertimesasia.app.ui.masjid

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Star
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import com.prayertimesasia.app.ui.components.CapsuleButton
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.core.EidEvent
import com.prayertimesasia.core.EidMosque
import com.prayertimesasia.core.FridayMosque
import com.prayertimesasia.core.MasjidExtras
import com.prayertimesasia.core.MasjidLink
import com.prayertimesasia.core.OpeningHours
import com.prayertimesasia.core.TripMode
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.data.Http
import com.prayertimesasia.app.data.MasjidListStore
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.MasjidLists
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerSpace
import com.prayertimesasia.core.PrayerSpaces
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
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

    /**
     * The search reaches 12 km around, so while driving the list is kept and
     * only measured again from where you are, until you are this far on.
     */
    const val REFRESH_KM = 6.0

    /** Same places, distances from [here], nearest first, within 15 km. */
    fun measuredFrom(here: Coordinates): List<PrayerSpace> = spaces
        .map { it.copy(distanceKm = Geo.distanceKm(here, it.coordinates)) }
        .filter { it.distanceKm <= 15.0 }
        .sortedBy { it.distanceKm }
}

/**
 * Asks every OpenStreetMap server at once and takes the first good answer, so
 * one busy server can't hold up the list. Gives up after 12 seconds.
 */
private suspend fun searchOpenStreetMap(c: Coordinates): List<PrayerSpace>? {
    val query = PrayerSpaces.overpassQuery(c)
    val first = CompletableDeferred<List<PrayerSpace>?>()
    val left = AtomicInteger(PrayerSpaces.OVERPASS_URLS.size)
    // Not tied to the screen: a slow server finishes in the background instead
    // of holding the list, and its late answer is simply ignored.
    PrayerSpaces.OVERPASS_URLS.forEach { url ->
        CoroutineScope(Dispatchers.IO).launch {
            val found = runCatching { PrayerSpaces.parseOverpass(Http.postForm(url, mapOf("data" to query), timeoutMs = 12_000), c) }.getOrNull()
            if (found != null) first.complete(found)
            else if (left.decrementAndGet() == 0) first.complete(null)
        }
    }
    return withTimeoutOrNull(12_000) { first.await() }
}

/** Walk or Drive on the Masjid tab, remembered on this phone. */
private const val MODE_PREFS = "masjid_tab"

private fun loadMode(context: Context): TripMode =
    if (context.getSharedPreferences(MODE_PREFS, Context.MODE_PRIVATE).getString("mode", "walk") == "drive") TripMode.DRIVE else TripMode.WALK

private fun saveMode(context: Context, mode: TripMode) =
    context.getSharedPreferences(MODE_PREFS, Context.MODE_PRIVATE).edit().putString("mode", if (mode == TripMode.DRIVE) "drive" else "walk").apply()

/**
 * Masjids and musollahs (surau, prayer rooms) near you from OpenStreetMap.
 * Only the nearest five are listed; the rest are on the radar. Singapore adds
 * the MUIS second Friday prayer list and, before Raya, the Hari Raya sessions.
 * Kept in step with the web app's Masjid tab.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun MasjidScreen(state: AppState, openAbout: () -> Unit, preset: List<PrayerSpace>? = null) {
    val place = state.resolver.activePlace
    val context = LocalContext.current
    var nearMe by remember { mutableStateOf<Coordinates?>(null) }
    var locating by remember { mutableStateOf(false) }
    val here = nearMe ?: place?.coordinates
    var spaces by remember { mutableStateOf(preset ?: here?.let { NearbyCache.measuredFrom(it) } ?: NearbyCache.spaces) }
    var loading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var kind by remember { mutableStateOf(Kind.ALL) }
    var selected by remember { mutableStateOf<String?>(null) }
    var openOnly by remember { mutableStateOf(false) }
    var mode by remember { mutableStateOf(if (state.sideEffects) loadMode(context) else TripMode.WALK) }
    var attempt by remember { mutableIntStateOf(0) }
    var handled by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(here, attempt) {
        val c = here ?: return@LaunchedEffect
        if (preset != null || !state.sideEffects) return@LaunchedEffect
        // Refresh or Try again pressed (not just a move).
        val forced = attempt != handled
        handled = attempt
        // The weekly ready-made list (squares around you), no live search.
        val country = if (nearMe != null && MasjidExtras.inSingapore(c, null)) "SG" else place?.countryCode
        val app = context.applicationContext
        if (withContext(Dispatchers.IO) { MasjidListStore.mayCover(app, country) }) {
            val ready = if (forced) null else withContext(Dispatchers.IO) { MasjidListStore.places(app, c, country) }
            if (ready != null) {
                spaces = ready
                failed = false
                if (!MasjidListStore.isFresh(app, c)) {
                    // Weekly refresh in the background; the next move picks it up.
                    CoroutineScope(Dispatchers.IO).launch { MasjidListStore.download(app, c, country) }
                }
                return@LaunchedEffect
            }
            loading = true
            failed = false
            val fetched = withContext(Dispatchers.IO) {
                if (forced) MasjidListStore.forget(app, c)
                MasjidListStore.download(app, c, country)
                MasjidListStore.places(app, c, country)
            }
            loading = false
            if (fetched != null) {
                spaces = fetched
                return@LaunchedEffect
            }
            // No list here and none from before: fall back to the live search.
        }
        val last = NearbyCache.around
        if (last != null && NearbyCache.spaces.isNotEmpty()) {
            // Show distances from here straight away.
            spaces = NearbyCache.measuredFrom(c)
            if (!forced && Geo.distanceKm(last, c) < NearbyCache.REFRESH_KM) return@LaunchedEffect
        }
        loading = true
        failed = false
        val found = searchOpenStreetMap(c)
        loading = false
        if (found == null) failed = spaces.isEmpty() else {
            NearbyCache.around = c
            NearbyCache.spaces = found
            spaces = found
        }
    }
    val zone = place?.zone ?: ZoneId.systemDefault()
    val local = state.now.atZone(zone)
    val weekday = local.dayOfWeek.value - 1
    val minute = local.hour * 60 + local.minute
    fun hoursOf(s: PrayerSpace) = s.hours?.let { OpeningHours.at(it, weekday, minute) }
    val singapore = here != null && MasjidExtras.inSingapore(here, if (nearMe != null) null else place?.countryCode)
    val sgNow = state.now.atZone(ZoneId.of("Asia/Singapore"))
    val friday = singapore && sgNow.dayOfWeek == DayOfWeek.FRIDAY && sgNow.hour < 15
    val eid = if (singapore) MasjidExtras.currentEid(sgNow.toLocalDate().toString(), demoEid ?: MasjidExtras.eidEvents) else null
    val h24 = state.prefs.use24Hour
    val visible = spaces
        .filter { kind == Kind.ALL || (kind == Kind.MUSOLLAH) == it.isMusollah }
        .filter { !openOnly || hoursOf(it)?.open == true }
    val anyHours = spaces.any { hoursOf(it) != null }
    val top = visible.take(MasjidExtras.SHOW)
    val more = visible.size - top.size
    val mine = state.prefs.myMasjid
    fun isMine(c: Coordinates) = mine != null && abs(mine.lat - c.latitude) < 0.003 && abs(mine.lng - c.longitude) < 0.003

    val findNearMe: () -> Unit = {
        scope.launch {
            val granted = state.location.hasPermission || (state.permissions?.location() ?: false)
            if (granted) {
                locating = true
                state.location.refresh { loc ->
                    nearMe = Coordinates(loc.latitude, loc.longitude)
                    locating = false
                }
                // The listener keeps the phone's location going for the Prayer tab too; stop waiting after a while.
                kotlinx.coroutines.delay(20_000)
                locating = false
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(state.skyNow)
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text("Masjid & Musollah", style = Txt.headline, color = Palette.primary, modifier = Modifier.align(Alignment.Center))
                    Box(Modifier.align(Alignment.CenterEnd).size(40.dp).clip(CircleShape).clickable(onClickLabel = "About this app", onClick = openAbout),
                        contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Info, "About this app", Modifier.size(26.dp), tint = Palette.primary)
                    }
                }
            }
            if (here != null) item {
                Radar(here, visible, selected, mode, Modifier.fillMaxWidth().height(260.dp).padding(horizontal = Dims.gutter)) { selected = it }
            }
            item {
                Column(Modifier.padding(horizontal = Dims.gutter, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (mine != null && here != null) YourMasjid(state, mine, here, mode, h24, singapore, eid)
                    NearMeButton(locating, nearMe != null, findNearMe)
                    if (eid != null && here != null) EidCard(eid, here, spaces, h24)
                    if (friday && here != null) FridayCard(here, true, mode, h24)
                }
            }
            item {
                Column(Modifier.padding(horizontal = Dims.gutter), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (nearMe != null || place?.name == null) "Nearest to you" else "Nearest to ${place.name}",
                            style = Txt.title3, color = Palette.primary, modifier = Modifier.weight(1f))
                        ModeSwitch(mode) { mode = it; if (state.sideEffects) saveMode(context, it) }
                    }
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                        Kind.entries.forEachIndexed { i, k ->
                            SegmentedButton(kind == k, { kind = k }, SegmentedButtonDefaults.itemShape(i, Kind.entries.size),
                                colors = SegmentedButtonDefaults.colors(
                                    activeContainerColor = Palette.primary.copy(alpha = 0.18f), activeContentColor = Palette.primary,
                                    inactiveContainerColor = Color.Transparent, inactiveContentColor = Palette.primary,
                                    activeBorderColor = Palette.primary.copy(alpha = 0.2f), inactiveBorderColor = Palette.primary.copy(alpha = 0.2f)),
                                icon = {}) { Text(k.label) }
                        }
                    }
                    if (anyHours) {
                        CapsuleButton("Open now only", style = Txt.footnoteSemibold,
                            background = if (openOnly) Color(0xFF34C759).copy(alpha = 0.3f) else Palette.primary.copy(alpha = 0.1f)) { openOnly = !openOnly }
                    }
                    if (mode == TripMode.DRIVE) {
                        Text("Drive times are a rough guide. Your maps app shows the traffic, so a masjid a little further away may be quicker.",
                            style = Txt.caption, color = Palette.secondary)
                    }
                }
            }
            when {
                here == null -> item { Empty("Choose a place", "Tap Find prayer places near me, or pick a city on the Prayer tab.") }
                loading && spaces.isEmpty() -> item {
                    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        CircularProgressIndicator(color = Palette.accent)
                        Text("Searching nearby…", style = Txt.subheadline, color = Palette.primary)
                    }
                }
                visible.isEmpty() -> item {
                    Empty(
                        if (failed) "Couldn't search" else if (openOnly) "Nothing open right now" else "Nothing listed nearby",
                        if (failed) "Searching needs an internet connection."
                        else if (openOnly) "Only places with opening hours on the map count here. Turn off Open now only to see the rest."
                        else "OpenStreetMap has no ${if (kind == Kind.MUSOLLAH) "musollah" else "masjid"} listed within 15 km. Use the Qibla tab to pray where you are.",
                        onRetry = if (failed) ({ attempt += 1 }) else null,
                    )
                }
                else -> {
                    items(top, key = { it.id }) { space ->
                        SpaceRow(state, space, space.id == selected, mode, h24, hoursOf(space),
                            if (singapore) MasjidExtras.fridayAt(space.coordinates) else null,
                            eid?.let { MasjidExtras.eidAt(it, space.name, space.coordinates) }, eid, isMine(space.coordinates)) {
                            selected = if (selected == space.id) null else space.id
                        }
                        HorizontalDivider(Modifier.padding(start = 56.dp), color = Palette.primary.copy(alpha = 0.1f))
                    }
                    item {
                        Column(Modifier.padding(horizontal = Dims.gutter, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (more > 0) Text("$more more within 15 km are on the radar above. Tap a dot to see its name.", style = Txt.footnote, color = Palette.secondary)
                            if (mine == null) Text("Tap a place and choose Make it my masjid to keep it at the top.", style = Txt.footnote, color = Palette.secondary)
                        }
                    }
                }
            }
            if (singapore && !friday && here != null) item {
                Box(Modifier.padding(horizontal = Dims.gutter, vertical = 8.dp)) { FridayCard(here, false, mode, h24) }
            }
            item {
                Column(Modifier.padding(Dims.gutter), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Places from OpenStreetMap (© OpenStreetMap contributors), kept by volunteers and kept on your phone, updated weekly. Only the area is sent.",
                        style = Txt.caption, color = Palette.secondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (here != null) CapsuleButton("Missing a place? Tell the map", style = Txt.footnoteSemibold) { open(context, MasjidExtras.reportUrl(here)) }
                        CapsuleButton("Refresh list", style = Txt.footnoteSemibold) { attempt += 1 }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

/** For screenshots: a few masjids with last Aidiladha's layout. */
internal var demoEid: List<EidEvent>? = null

@Composable
private fun NearMeButton(locating: Boolean, found: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Palette.accent).clickable(enabled = !locating, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        if (locating) CircularProgressIndicator(Modifier.size(18.dp), color = Color.Black.copy(alpha = 0.82f), strokeWidth = 2.dp)
        else Icon(Icons.Filled.MyLocation, null, Modifier.size(20.dp), tint = Color.Black.copy(alpha = 0.82f))
        Spacer(Modifier.size(10.dp))
        Text(if (locating) "Finding where you are…" else if (found) "Search again from here" else "Find prayer places near me",
            style = Txt.bodySemibold, color = Color.Black.copy(alpha = 0.82f))
    }
}

@Composable
private fun ModeSwitch(mode: TripMode, onChange: (TripMode) -> Unit) {
    Row(Modifier.clip(CircleShape).background(Palette.primary.copy(alpha = 0.1f)).padding(3.dp)) {
        listOf(TripMode.WALK to "Walk", TripMode.DRIVE to "Drive").forEach { (m, label) ->
            val on = m == mode
            Row(
                Modifier.clip(CircleShape).background(if (on) Palette.accent else Color.Transparent)
                    .clickable(onClickLabel = label) { onChange(m) }.padding(horizontal = 12.dp, vertical = 6.dp)
                    .semantics { selected = on },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(if (m == TripMode.WALK) Icons.AutoMirrored.Filled.DirectionsWalk else Icons.Filled.DirectionsCar, null, Modifier.size(16.dp),
                    tint = if (on) Color.Black.copy(alpha = 0.82f) else Palette.secondary)
                Text(label, style = Txt.footnoteSemibold, color = if (on) Color.Black.copy(alpha = 0.82f) else Palette.secondary)
            }
        }
    }
}

@Composable
private fun Chip(text: String, background: Color, color: Color) {
    Text(text, style = Txt.caption2Heavy.copy(letterSpacing = 0.sp), color = color,
        modifier = Modifier.clip(CircleShape).background(background).padding(horizontal = 8.dp, vertical = 3.dp))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SpaceRow(
    state: AppState, space: PrayerSpace, open: Boolean, mode: TripMode, h24: Boolean, hours: OpeningHours.Now?,
    friday: FridayMosque?, raya: EidMosque?, eid: EidEvent?, mine: Boolean, onToggle: () -> Unit,
) {
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().background(if (open) Palette.primary.copy(alpha = 0.06f) else Color.Transparent)) {
        Row(
            Modifier.fillMaxWidth().clickable(onClickLabel = if (open) "Close" else "More about ${space.name}", onClick = onToggle)
                .padding(start = Dims.gutter, end = 6.dp, top = 12.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(if (space.isMusollah) Icons.Filled.Home else Icons.Filled.Brightness2, null, Modifier.size(22.dp),
                tint = if (space.isMusollah) Prayer.FAJR.tint else Palette.accent)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (mine) Icon(Icons.Filled.Star, null, Modifier.size(14.dp).padding(end = 2.dp), tint = Palette.accent)
                    Text(space.name, style = Txt.bodySemibold, color = Palette.primary, maxLines = 2)
                }
                if (space.address.isNotEmpty()) Text(space.address, style = Txt.caption, color = Palette.secondary, maxLines = 1)
                if (friday != null || hours != null) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 3.dp)) {
                    if (friday != null) Chip("2 Friday prayers", Palette.accent.copy(alpha = 0.2f), Palette.accentText)
                    if (hours != null) Chip(if (hours.open) "Open now" else "Closed now",
                        if (hours.open) Color(0xFF34C759).copy(alpha = 0.22f) else Palette.primary.copy(alpha = 0.1f), Palette.primary)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(MasjidExtras.distanceText(space.distanceKm), style = Txt.subheadline.copy(fontFeatureSettings = "tnum"), color = Palette.secondary)
                MasjidExtras.tripText(space.distanceKm, mode)?.let { Text(it, style = Txt.caption, color = Palette.secondary) }
            }
            Box(Modifier.size(40.dp).clip(CircleShape).clickable(onClickLabel = "Directions to ${space.name}") { directions(context, space.coordinates, space.name, mode) },
                contentAlignment = Alignment.Center) {
                Icon(if (mode == TripMode.WALK) Icons.AutoMirrored.Filled.DirectionsWalk else Icons.Filled.DirectionsCar, "Directions", Modifier.size(20.dp), tint = Palette.secondary)
            }
        }
        if (open) {
            Column(Modifier.padding(start = 56.dp, end = Dims.gutter, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                val have = MasjidExtras.facilityLabels.filter { space.facilities.contains(it.first) }
                if (have.isEmpty()) Text("The map doesn't list this place's facilities yet.", style = Txt.footnote, color = Palette.secondary)
                else FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    have.forEach { Chip(it.second, Palette.primary.copy(alpha = 0.1f), Palette.primary) }
                }
                hours?.let { Text(OpeningHours.text(it, h24), style = Txt.footnote, color = Palette.primary) }
                friday?.let {
                    Text("Second Friday prayer from ${MasjidExtras.clock(MasjidExtras.FRIDAY_SECOND_FROM, h24)}${if (it.womenSession2) ", with space for women" else ""}.",
                        style = Txt.footnoteSemibold, color = Palette.accentText)
                }
                if (raya != null && eid != null) {
                    Text("${eid.shortName} prayer at ${raya.sessions.joinToString(", ") { MasjidExtras.clock(it.time, h24) }}.",
                        style = Txt.footnoteSemibold, color = Palette.accentText)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CapsuleButton("Directions", style = Txt.footnoteSemibold) { directions(context, space.coordinates, space.name, mode) }
                    if (mine) CapsuleButton(if (space.isMusollah) "Kept at the top" else "Your masjid", style = Txt.footnoteSemibold, contentColor = Palette.accentText) {}
                    else CapsuleButton(if (space.isMusollah) "Keep it at the top" else "Make it my masjid", style = Txt.footnoteSemibold) {
                        state.chooseMasjid(space.name, space.coordinates)
                    }
                    CapsuleButton("Report a problem", style = Txt.footnoteSemibold, background = Color.Transparent, contentColor = Palette.secondary) {
                        open(context, MasjidExtras.reportUrl(space.coordinates))
                    }
                }
            }
        }
    }
}

/** Your masjid, pinned at the top with how far it is and its iqamah times. */
@Composable
private fun YourMasjid(state: AppState, m: MasjidLink, from: Coordinates, mode: TripMode, h24: Boolean, singapore: Boolean, eid: EidEvent?) {
    val context = LocalContext.current
    val c = Coordinates(m.lat, m.lng)
    val km = Geo.distanceKm(from, c)
    val naming = state.resolver.naming
    val parts = Prayer.obligatory.mapNotNull { p ->
        m.jamaah[p.raw]?.let { r -> "${p.name(naming)} ${r.fixed?.let { MasjidExtras.clock(it, h24) } ?: "+${r.after} min"}" }
    } + listOfNotNull(m.jumuah?.let { "Jumaat ${MasjidExtras.clock(it, h24)}" })
    val friday = if (singapore) MasjidExtras.fridayAt(c) else null
    val raya = eid?.let { MasjidExtras.eidAt(it, m.name, c) }
    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Filled.Star, null, Modifier.size(22.dp), tint = Palette.accent)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("YOUR MASJID", style = Txt.caption2Heavy, color = Palette.secondary)
                Text(m.name, style = Txt.bodySemibold, color = Palette.primary)
                Text("${MasjidExtras.distanceText(km)} away${MasjidExtras.tripText(km, mode)?.let { ", $it" } ?: ""}", style = Txt.caption, color = Palette.secondary)
                Text(if (parts.isEmpty()) "Iqamah times show here when your masjid puts up a Prayer Times Asia screen. Scan its QR code once."
                    else "Iqamah " + parts.joinToString(", "), style = Txt.footnote, color = Palette.primary)
                friday?.let {
                    Text("Second Friday prayer from ${MasjidExtras.clock(MasjidExtras.FRIDAY_SECOND_FROM, h24)}${if (it.womenSession2) ", with space for women" else ""}.",
                        style = Txt.footnoteSemibold, color = Palette.accentText)
                }
                if (raya != null && eid != null) Text("${eid.shortName} prayer at ${raya.sessions.joinToString(", ") { MasjidExtras.clock(it.time, h24) }}.",
                    style = Txt.footnoteSemibold, color = Palette.accentText)
                else m.eid?.let { Text("Hari Raya prayer at ${MasjidExtras.clock(it, h24)}.", style = Txt.footnoteSemibold, color = Palette.accentText) }
                Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CapsuleButton("Directions", style = Txt.footnoteSemibold) { directions(context, c, m.name, mode) }
                    CapsuleButton("Remove", style = Txt.footnoteSemibold, background = Color.Transparent, contentColor = Palette.secondary) { state.forgetMasjid() }
                }
            }
        }
    }
}

/** Singapore only: masjids with a second Friday prayer, nearest first (MUIS). */
@Composable
private fun FridayCard(from: Coordinates, today: Boolean, mode: TripMode, h24: Boolean) {
    val context = LocalContext.current
    var all by remember { mutableStateOf(false) }
    val list = MasjidExtras.fridayNearest(from)
    val updated = runCatching { LocalDate.parse(MasjidExtras.FRIDAY_SOURCE_UPDATED).format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK)) }.getOrDefault("")
    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Filled.Event, null, Modifier.size(22.dp), tint = Palette.accent)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (today) "Friday prayer today" else "Friday prayer in Singapore", style = Txt.headline, color = Palette.primary)
                Text("${list.size} masjids hold a second Friday prayer from ${MasjidExtras.clock(MasjidExtras.FRIDAY_SECOND_FROM, h24)}, for those who can't make the first one at Zohor.",
                    style = Txt.footnote, color = Palette.secondary)
            }
        }
        (if (all) list else list.take(3)).forEach { (m, km) ->
            Row(Modifier.fillMaxWidth().clickable { directions(context, m.coordinates, m.name, mode) }.padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Filled.Brightness2, null, Modifier.size(20.dp), tint = Palette.accent)
                Column(Modifier.weight(1f)) {
                    Text(m.name, style = Txt.bodySemibold, color = Palette.primary)
                    Text(m.district + if (m.womenSession2) ". Space for women in the 2nd prayer" else "", style = Txt.caption, color = Palette.secondary)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(MasjidExtras.distanceText(km), style = Txt.subheadline.copy(fontFeatureSettings = "tnum"), color = Palette.secondary)
                    MasjidExtras.tripText(km, mode)?.let { Text(it, style = Txt.caption, color = Palette.secondary) }
                }
            }
        }
        CapsuleButton(if (all) "Show the nearest 3" else "See all ${list.size}", style = Txt.footnoteSemibold) { all = !all }
        Text("From the Islamic Religious Council of Singapore (MUIS), updated $updated. No booking needed, except on public holidays.",
            style = Txt.caption, color = Palette.secondary, modifier = Modifier.padding(top = 8.dp))
        Text("See the MUIS list", style = Txt.captionSemibold, color = Palette.accentText,
            modifier = Modifier.clickable { open(context, MasjidExtras.FRIDAY_SOURCE_URL) }.padding(vertical = 4.dp))
    }
}

/** Singapore, in the two weeks before Hari Raya: sessions at the nearest masjids (MUIS). */
@Composable
private fun EidCard(e: EidEvent, from: Coordinates, spaces: List<PrayerSpace>, h24: Boolean) {
    val context = LocalContext.current
    var all by remember { mutableStateOf(false) }
    val rows = e.mosques.map { m ->
        val c = if (m.lat != null && m.lng != null) Coordinates(m.lat!!, m.lng!!)
        else spaces.firstOrNull { MasjidExtras.eidAt(e.copy(mosques = listOf(m)), it.name, it.coordinates) != null }?.coordinates
        m to c?.let { Geo.distanceKm(from, it) }
    }.sortedBy { it.second ?: 1e9 }
    val date = runCatching { LocalDate.parse(e.date).format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.UK)) }.getOrDefault(e.date)
    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Filled.Brightness2, null, Modifier.size(22.dp), tint = Palette.accent)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${e.shortName} prayer", style = Txt.headline, color = Palette.primary)
                Text("$date. Prayer times at the masjids nearest you.", style = Txt.footnote, color = Palette.secondary)
            }
        }
        (if (all) rows else rows.take(3)).forEach { (m, km) ->
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Filled.Brightness2, null, Modifier.size(20.dp), tint = Palette.accent)
                Column(Modifier.weight(1f)) {
                    Text(m.name, style = Txt.bodySemibold, color = Palette.primary)
                    Text(m.sessions.joinToString(", ") { s -> MasjidExtras.clock(s.time, h24) + (s.khutbah?.let { " ($it)" } ?: "") },
                        style = Txt.caption, color = Palette.secondary)
                    val extra = listOfNotNull(if (m.sessions.any { it.women }) "Space for women" else null, m.note).joinToString(". ")
                    if (extra.isNotEmpty()) Text(extra, style = Txt.caption, color = Palette.secondary)
                }
                km?.let { Text(MasjidExtras.distanceText(it), style = Txt.subheadline.copy(fontFeatureSettings = "tnum"), color = Palette.secondary) }
            }
        }
        if (rows.size > 3) CapsuleButton(if (all) "Show the nearest 3" else "See all ${rows.size}", style = Txt.footnoteSemibold) { all = !all }
        Text("From the Islamic Religious Council of Singapore (MUIS). See the MUIS list", style = Txt.caption, color = Palette.secondary,
            modifier = Modifier.padding(top = 8.dp).clickable { open(context, e.sourceUrl) })
    }
}

private fun open(context: Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
    }
}

/** Hands the place to whatever maps app the phone has (geo: works without Google services). */
private fun directions(context: Context, c: Coordinates, name: String, mode: TripMode) {
    val label = Uri.encode(name)
    val nav = Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=${c.latitude},${c.longitude}&mode=${if (mode == TripMode.WALK) "w" else "d"}"))
    val geo = Intent(Intent.ACTION_VIEW, Uri.parse("geo:${c.latitude},${c.longitude}?q=${c.latitude},${c.longitude}($label)"))
    val web = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}"))
    for (intent in listOf(nav, geo, web)) {
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        } catch (_: ActivityNotFoundException) {
        }
    }
}

@Composable
private fun Empty(title: String, body: String, onRetry: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Filled.Brightness2, null, Modifier.size(36.dp), tint = Palette.secondary)
        Text(title, style = Txt.headline, color = Palette.primary)
        Text(body, style = Txt.subheadline, color = Palette.secondary, textAlign = TextAlign.Center)
        if (onRetry != null) OutlinedButton(onClick = onRetry) { Text("Try again") }
    }
}

/**
 * You in the middle with soft waves beaming out, each place at its bearing and
 * distance, and rings at 1, 2 and 5 km (labelled with the walk or drive time)
 * so a place reads as near or far at a glance.
 */
@Composable
private fun Radar(center: Coordinates, spaces: List<PrayerSpace>, selected: String?, mode: TripMode, modifier: Modifier, onSelect: (String) -> Unit) {
    val primary = Palette.primary
    val accent = Palette.accent
    val musollah = Prayer.FAJR.tint
    val north = Palette.north
    val you = Color(0xFF0A84FF)
    val material = Palette.materialStrong
    val far = spaces.take(12).maxOfOrNull { it.distanceKm } ?: 2.0
    val maxKm = max(5.5, far * 1.1)
    val rings = listOf(1.0, 2.0, 5.0) + if (maxKm > 11) listOf(10.0) else emptyList()
    val layout = remember { mutableListOf<Pair<String, Offset>>() }
    val measurer = rememberTextMeasurer()
    val labelStyle = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = you)
    val beam by rememberInfiniteTransition(label = "beam").animateFloat(
        0f, 1f, infiniteRepeatable(tween(2600, easing = LinearOutSlowInEasing)), label = "beam")
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
            // Square-root scale keeps the nearest places from piling onto you; rings use the same scale.
            fun at(km: Double) = (sqrt(km / maxKm).coerceAtMost(1.0) * radius).toFloat()
            rings.forEachIndexed { i, km ->
                if (i == 0) drawCircle(you.copy(alpha = 0.07f), at(km), c)
                drawCircle(you.copy(alpha = 0.5f), at(km), c, style = Stroke(1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 7.dp.toPx()))))
            }
            // Waves beaming out from you.
            for (k in 0..1) {
                val p = (beam + k * 0.5f) % 1f
                drawCircle(you.copy(alpha = 0.4f * (1 - p)), 9.dp.toPx() + p * at(1.0) * 1.2f, c)
            }
            drawLine(north.copy(alpha = 0.7f), Offset(c.x, c.y - radius - 6.dp.toPx()), Offset(c.x, c.y - radius + 6.dp.toPx()), 2.dp.toPx())
            val placed = mutableListOf<Pair<String, Offset>>()
            for (s in spaces) {
                val b = Math.toRadians(Geo.bearing(center, s.coordinates))
                val d = at(s.distanceKm)
                val p = Offset((c.x + sin(b) * d).toFloat(), (c.y - cos(b) * d).toFloat())
                placed += s.id to p
                val color = if (s.isMusollah) musollah else accent
                val r = (if (s.id == selected) 9 else 6).dp.toPx()
                drawCircle(Color.White, r + 2.dp.toPx(), p)
                drawCircle(color, r, p)
            }
            layout.clear()
            layout.addAll(placed)
            // Ring labels at the bottom of each ring.
            for (km in rings) {
                val trip = MasjidExtras.tripText(km, mode)?.removeSuffix(" walk")?.removeSuffix(" drive")
                val text = "${km.roundToInt()} km" + (trip?.let { ", $it" } ?: "")
                val m = measurer.measure(text, labelStyle)
                val w = m.size.width + 12.dp.toPx()
                val h = m.size.height + 2.dp.toPx()
                val y = c.y + at(km)
                if (y + h / 2 > size.height) continue
                drawRoundRect(material, Offset(c.x - w / 2, y - h / 2), Size(w, h), CornerRadius(h / 2))
                drawText(m, topLeft = Offset(c.x - m.size.width / 2f, y - m.size.height / 2f))
            }
            drawCircle(Color.White, 10.dp.toPx(), c)
            drawCircle(you, 7.dp.toPx(), c)
        }
        Text("N", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = north, modifier = Modifier.align(Alignment.TopCenter).padding(top = 2.dp))
        Text("You, rings at 1, 2 and 5 km", style = Txt.caption, color = Palette.secondary, modifier = Modifier.align(Alignment.BottomStart).padding(10.dp))
        spaces.firstOrNull { it.id == selected }?.let {
            Text(it.name, style = Txt.captionSemibold, color = primary, maxLines = 1,
                modifier = Modifier.align(Alignment.BottomEnd).padding(10.dp).clip(CircleShape).background(Palette.materialStrong).padding(horizontal = 10.dp, vertical = 4.dp))
        }
    }
}
