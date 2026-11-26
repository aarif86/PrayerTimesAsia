package com.prayertimesasia.app.ui.masjid

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.data.Http
import com.prayertimesasia.app.data.MasjidListStore
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.LineIcons
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.components.trCount
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.app.ui.theme.Look
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.app.ui.today.AppSheet
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.EidEvent
import com.prayertimesasia.core.EidMosque
import com.prayertimesasia.core.FridayMosque
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.MasjidExtras
import com.prayertimesasia.core.MasjidLink
import com.prayertimesasia.core.OpeningHours
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerSpace
import com.prayertimesasia.core.PrayerSpaces
import com.prayertimesasia.core.RoomDetails
import com.prayertimesasia.core.TripMode
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

private enum class Kind(val label: String) { ALL("All"), MASJID("Masjid"), MUSOLLAH("Prayer room") }

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
 * Only the nearest five are listed; the rest are on the street map. Singapore adds
 * the MUIS second Friday prayer list and, before Raya, the Hari Raya sessions.
 * Kept in step with the web app's Masjid tab.
 */
/** The sheet over the map: the web's glass (no blur on Android, so a little firmer), or Colour Bands' flat page. */
private val Look.sheet: Color
    get() = when {
        bands -> if (dark) Color(0xFF232326) else Color(0xFFF2F0EB)
        dark -> Color(0xFF181A34).copy(alpha = 0.86f)
        else -> Color.White.copy(alpha = 0.82f)
    }

/** Colour Bands list rows, in turn (deeper band tones so white words read), and prayer rooms in blue. */
private val BAND_ROWS = listOf(0xFF3A6F63, 0xFFA3632C, 0xFFBC5057, 0xFF6D7940, 0xFF88702E).map { Color(it) }
private val BAND_ROOM = Color(0xFF4A63B8)
private val STRIPE = listOf(0xFF3A6F63, 0xFF8A9A52, 0xFFAB8D3A, 0xFFCD7D38, 0xFFD3705C, 0xFFC9565D).map { Color(it) }

/** Big corners for the look's cards (0 in Colour Bands). */
private val Look.r: Dp get() = c.radius
private val Look.shape get() = RoundedCornerShape(c.radius)

@Composable
private fun tripText(km: Double, mode: TripMode): String? = when (mode) {
    TripMode.WALK -> if (km > 2) null else tr(R.string.masjid_walkMin, "n" to max(1, (km / 0.08).roundToInt()))
    TripMode.DRIVE -> tr(R.string.masjid_driveMin, "n" to max(2, (km * 2 + 2).roundToInt()))
}

@Composable
private fun hoursText(n: OpeningHours.Now, h24: Boolean): String = when {
    n.open && n.until != null -> tr(R.string.masjid_openUntil, "time" to MasjidExtras.clock(n.until!!, h24))
    n.open -> tr(R.string.masjid_openAllDay)
    n.opensAt != null -> tr(R.string.masjid_closedOpens, "time" to MasjidExtras.clock(n.opensAt!!, h24))
    else -> tr(R.string.masjid_closedToday)
}

@Composable
private fun secondFriday(f: FridayMosque, h24: Boolean): String {
    val time = MasjidExtras.clock(MasjidExtras.FRIDAY_SECOND_FROM, h24)
    return if (f.womenSession2) tr(R.string.masjid_secondFridayWomen, "time" to time) else tr(R.string.masjid_secondFriday, "time" to time)
}

@Composable
private fun eidName(e: EidEvent): String = if (e.name.contains("adha", ignoreCase = true)) tr(R.string.masjid_eidAdha) else tr(R.string.masjid_eidFitr)

/**
 * Masjids and musollahs (surau, prayer rooms) near you from OpenStreetMap.
 * Only the nearest five are listed; the rest are on the street map. Singapore adds
 * the MUIS second Friday prayer list and, before Raya, the Hari Raya sessions.
 * Laid out as the web app's Masjid tab in each look: a tall map, the list as a sheet over it.
 */
@Composable
fun MasjidScreen(state: AppState, openAbout: () -> Unit, preset: List<PrayerSpace>? = null) {
    val place = state.resolver.activePlace
    val context = LocalContext.current
    val look = LocalLook.current
    val c = look.c
    var nearMe by remember { mutableStateOf<Coordinates?>(null) }
    var locating by remember { mutableStateOf(false) }
    var suggesting by remember { mutableStateOf(false) }
    // When Near me last found the person, so Suggest a prayer room only offers a recent spot as the room's pin.
    var nearMeAt by remember { mutableLongStateOf(0L) }
    val here = nearMe ?: place?.coordinates
    var spaces by remember { mutableStateOf(preset ?: here?.let { NearbyCache.measuredFrom(it) } ?: NearbyCache.spaces) }
    var loading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var kind by remember { mutableStateOf(Kind.ALL) }
    var selected by remember { mutableStateOf<String?>(null) }
    var pinned by remember { mutableStateOf<PrayerSpace?>(null) }
    val camera = remember { MapCamera() }
    var openOnly by remember { mutableStateOf(false) }
    var mode by remember { mutableStateOf(if (state.sideEffects) loadMode(context) else TripMode.WALK) }
    var attempt by remember { mutableIntStateOf(0) }
    var handled by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(here, attempt) {
        val c0 = here ?: return@LaunchedEffect
        if (preset != null || !state.sideEffects) return@LaunchedEffect
        // Refresh or Try again pressed (not just a move).
        val forced = attempt != handled
        handled = attempt
        // The weekly ready-made list (squares around you), no live search.
        val country = if (nearMe != null && MasjidExtras.inSingapore(c0, null)) "SG" else place?.countryCode
        val app = context.applicationContext
        if (withContext(Dispatchers.IO) { MasjidListStore.mayCover(app, country) }) {
            val ready = if (forced) null else withContext(Dispatchers.IO) { MasjidListStore.places(app, c0, country) }
            if (ready != null) {
                spaces = ready
                failed = false
                if (!MasjidListStore.isFresh(app, c0)) {
                    // Weekly refresh in the background; the next move picks it up.
                    CoroutineScope(Dispatchers.IO).launch { MasjidListStore.download(app, c0, country) }
                }
                return@LaunchedEffect
            }
            loading = true
            failed = false
            val fetched = withContext(Dispatchers.IO) {
                if (forced) MasjidListStore.forget(app, c0)
                MasjidListStore.download(app, c0, country)
                MasjidListStore.places(app, c0, country)
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
            spaces = NearbyCache.measuredFrom(c0)
            if (!forced && Geo.distanceKm(last, c0) < NearbyCache.REFRESH_KM) return@LaunchedEffect
        }
        loading = true
        failed = false
        val found = searchOpenStreetMap(c0)
        loading = false
        if (found == null) failed = spaces.isEmpty() else {
            NearbyCache.around = c0
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
    // A tapped pin's card closes when a filter hides that place.
    if (pinned != null && pinned !in visible) pinned = null
    val top = visible.take(MasjidExtras.SHOW)
    // Big and Simple: the nearest masjid is one big card, then only two rows (as on the web).
    val nearest = if (look.simple) visible.firstOrNull { !it.isMusollah } ?: visible.firstOrNull() else null
    val rows = if (look.simple) top.filter { it != nearest }.take(2) else top
    val more = visible.size - rows.size - (if (nearest != null) 1 else 0)
    val mine = state.prefs.myMasjid
    fun isMine(c: Coordinates) = mine != null && abs(mine.lat - c.latitude) < 0.003 && abs(mine.lng - c.longitude) < 0.003
    val focus: (Coordinates) -> Unit = { camera.show(it, 1_000.0, animate = true) }
    val toggle: (PrayerSpace) -> Unit = { space ->
        selected = if (selected == space.id) null else space.id
        focus(space.coordinates)
    }

    val findNearMe: () -> Unit = {
        scope.launch {
            val granted = state.location.hasPermission || (state.permissions?.location() ?: false)
            if (granted) {
                locating = true
                state.location.refresh { loc ->
                    nearMe = Coordinates(loc.latitude, loc.longitude); nearMeAt = System.currentTimeMillis()
                    locating = false
                }
                // The listener keeps the phone's location going for the Prayer tab too; stop waiting after a while.
                kotlinx.coroutines.delay(20_000)
                locating = false
            }
        }
    }
    val dhuhr = Prayer.DHUHR.name(state.resolver.naming)
    val youLabel = if (nearMe != null || place?.name == null) "you" else place.name
    val mapHeight = if (look.simple) 340.dp else 400.dp
    // The sheet rides 28 dp up over the map, except in Colour Bands (flat, square, below the map).
    val overlap = if (look.bands) 0.dp else 28.dp

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        // The map, with the title, Refresh and About floating on it.
        Box(Modifier.fillMaxWidth().height(mapHeight)) {
            if (here != null) {
                StreetMap(here, visible, mine, ::isMine, pinned, mode, camera, youLabel, Modifier.fillMaxSize(),
                    bottomInset = overlap, onSelect = { pinned = it }) { s ->
                    PinCard(s, mode, h24, hoursOf(s), singapore, { pinned = null }) { directions(context, s.coordinates, s.name, mode) }
                }
            } else {
                Box(Modifier.fillMaxSize().background(c.tx.copy(alpha = 0.06f)))
            }
            TitleBar(look, canRefresh = here != null, onRefresh = { attempt += 1; OsmTiles.retryFailed() }, openAbout = openAbout)
        }
        // The list, as a sheet pulled up over the map.
        Column(
            Modifier.fillMaxWidth()
                .layout { m, k ->
                    val p = m.measure(k)
                    val up = overlap.roundToPx()
                    layout(p.width, p.height - up) { p.place(0, -up) }
                }
                .then(if (look.bands) Modifier.background(look.sheet)
                else Modifier.shadow(20.dp, RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp), ambientColor = Color.Black.copy(alpha = 0.25f), spotColor = Color.Black.copy(alpha = 0.25f))
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)).background(look.sheet))
                .padding(bottom = 24.dp),
        ) {
            if (!look.bands) Box(Modifier.padding(vertical = 8.dp).size(38.dp, 5.dp).clip(CircleShape).background(c.tx3.copy(alpha = 0.5f)).align(Alignment.CenterHorizontally))
            LookStrip(look)
            Column(Modifier.padding(horizontal = Dims.gutter)) {
                if (mine != null && here != null) YourMasjid(state, look, mine, here, mode, h24, singapore, eid) { focus(it) }
                NearMeButton(look, locating, nearMe != null, findNearMe)
                if (eid != null && here != null) EidCard(look, eid, here, spaces, h24)
                if (friday && here != null) FridayCard(look, here, true, mode, h24, dhuhr, focus)
                if (nearest != null) {
                    Text(tr(R.string.masjid_nearestMasjid), style = display(27.sp, FontWeight.Bold), color = c.tx,
                        modifier = Modifier.padding(top = 16.dp, bottom = 10.dp).semantics { heading() })
                    NearestCard(state, look, nearest, nearest.id == selected, mode, h24, hoursOf(nearest),
                        if (singapore) MasjidExtras.fridayAt(nearest.coordinates) else null,
                        eid?.let { MasjidExtras.eidAt(it, nearest.name, nearest.coordinates) }, eid, isMine(nearest.coordinates)) { toggle(nearest) }
                }
                // Nearest to you or your place, how you are going, and what to show.
                if (!look.simple) {
                    Text(if (nearMe != null || place?.name == null) tr(R.string.masjid_nearestYou) else tr(R.string.masjid_nearestTo, "place" to place.name),
                        style = display(22.sp, FontWeight.Bold), color = c.tx, modifier = Modifier.padding(top = 16.dp).semantics { heading() })
                }
                Spacer(Modifier.height(if (look.simple) 12.dp else 8.dp))
                Segmented(look, listOf(
                    Seg(tr(R.string.masjid_walk), LineIcons.of("footprints")) to (mode == TripMode.WALK),
                    Seg(tr(R.string.masjid_drive), LineIcons.of("car")) to (mode == TripMode.DRIVE),
                )) { i -> val m = if (i == 0) TripMode.WALK else TripMode.DRIVE; mode = m; if (state.sideEffects) saveMode(context, m) }
                Spacer(Modifier.height(8.dp))
                Segmented(look, listOf(
                    Seg(tr(R.string.masjid_all)) to (kind == Kind.ALL),
                    Seg(tr(R.string.masjid_masjid)) to (kind == Kind.MASJID),
                    Seg(tr(R.string.masjid_musollah)) to (kind == Kind.MUSOLLAH),
                )) { i -> kind = Kind.entries[i] }
                if (anyHours) {
                    val chipShape = if (look.bands) RoundedCornerShape(0.dp) else CircleShape
                    Row(Modifier.padding(top = 8.dp).clip(chipShape)
                        .background(if (openOnly) c.accent.copy(alpha = 0.28f) else c.sep)
                        .clickable(onClickLabel = tr(R.string.masjid_openOnly)) { openOnly = !openOnly }
                        .semantics { this.selected = openOnly }
                        .heightIn(min = 36.dp).padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(LineIcons.of("clock"), null, Modifier.size(14.dp), tint = c.tx)
                        Text(tr(R.string.masjid_openOnly), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = c.tx)
                    }
                }
                if (mode == TripMode.DRIVE) Note(look, tr(R.string.masjid_driveNote))
            }
            when {
                here == null -> Empty(look, tr(R.string.masjid_choosePlace), tr(R.string.masjid_choosePlaceBody))
                loading && spaces.isEmpty() -> Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    CircularProgressIndicator(color = c.accent)
                    Text(tr(R.string.masjid_searching), fontSize = 15.sp, color = c.tx)
                }
                visible.isEmpty() -> Empty(look,
                    if (failed) tr(R.string.masjid_failed) else if (openOnly) tr(R.string.masjid_nothingOpen) else tr(R.string.masjid_nothing),
                    if (failed) tr(R.string.masjid_failedHelp)
                    else if (openOnly) tr(R.string.masjid_nothingOpenBody)
                    else tr(R.string.masjid_nothingHelp, "kind" to if (kind == Kind.MUSOLLAH) tr(R.string.masjid_prayerRooms) else tr(R.string.masjid_masjidWord)),
                    onRetry = if (failed) ({ attempt += 1 }) else null)
                else -> {
                    if (rows.isNotEmpty()) SpaceList(look) {
                        rows.forEachIndexed { i, space ->
                            SpaceRow(state, look, space, i, space.id == selected, mode, h24, hoursOf(space),
                                if (singapore) MasjidExtras.fridayAt(space.coordinates) else null,
                                eid?.let { MasjidExtras.eidAt(it, space.name, space.coordinates) }, eid, isMine(space.coordinates)) { toggle(space) }
                        }
                    }
                    Column(Modifier.padding(horizontal = Dims.gutter)) {
                        if (more > 0) Text(trCount(R.string.masjid_moreOnMap, R.string.masjid_moreOnMap_one, more), fontSize = 14.sp, color = c.tx2,
                            modifier = Modifier.padding(top = 12.dp, start = 2.dp, end = 2.dp).clickable {
                                pinned = null
                                camera.fit(visible.map { it.coordinates } + listOfNotNull(here))
                            })
                        if (mine == null) Text(tr(R.string.masjid_keepHint), fontSize = 14.sp, color = c.tx2, modifier = Modifier.padding(top = 12.dp, start = 2.dp, end = 2.dp))
                    }
                }
            }
            Column(Modifier.padding(horizontal = Dims.gutter)) {
                if (singapore && !friday && here != null) FridayCard(look, here, false, mode, h24, dhuhr, focus)
                if (here != null) {
                    val tell = tr(R.string.masjid_tellMap)
                    val credit = tr(R.string.masjid_mapCredit, "link" to "\u0000")
                    val (before, after) = credit.split("\u0000").let { it[0] to it.getOrElse(1) { "" } }
                    Text(buildAnnotatedString {
                        append(before)
                        withStyle(SpanStyle(color = c.accentText, fontWeight = FontWeight.SemiBold)) { append(tell) }
                        append(after)
                    }, fontSize = 13.sp, lineHeight = 18.sp, color = c.tx2,
                        modifier = Modifier.padding(top = 14.dp).clickable(onClickLabel = tell) { open(context, MasjidExtras.reportUrl(here)) })
                    SuggestButton(look) { suggesting = true }
                }
                if (mine == null) Text(tr(R.string.myMasjid_scanHelp), fontSize = 13.sp, color = c.tx2, modifier = Modifier.padding(top = 14.dp))
            }
        }
    }
    if (suggesting) AppSheet({ suggesting = false }) { SuggestRoomContent(near = here, live = nearMe.takeIf { System.currentTimeMillis() - nearMeAt < 300_000 }) }
}

/** The title on the map, as on the web: words in the middle, round glass buttons each side. */
@Composable
private fun TitleBar(look: Look, canRefresh: Boolean, onRefresh: () -> Unit, openAbout: () -> Unit) {
    val dark = look.dark
    val ink = if (dark) Color.White else Color(0xFF111111)
    val fill = if (dark) Color.Black.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.7f)
    Box(Modifier.fillMaxWidth()
        .background(Brush.verticalGradient(listOf(if (dark) Color.Black.copy(alpha = 0.45f) else Color.White.copy(alpha = 0.85f), Color.Transparent)))
        .padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 26.dp)) {
        val refresh = tr(R.string.masjid_refresh)
        Box(Modifier.align(Alignment.CenterStart).size(48.dp).clip(CircleShape)
            .clickable(enabled = canRefresh, onClickLabel = refresh, onClick = onRefresh).semantics { contentDescription = refresh; role = Role.Button },
            contentAlignment = Alignment.Center) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(fill), contentAlignment = Alignment.Center) {
                Icon(LineIcons.of("refresh-cw"), null, Modifier.size(18.dp), tint = ink)
            }
        }
        Text(tr(R.string.masjid_title), fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = ink, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.Center).padding(horizontal = 56.dp).semantics { heading() })
        val about = tr(R.string.masjid_about)
        Box(Modifier.align(Alignment.CenterEnd).size(48.dp).clip(CircleShape).clickable(onClickLabel = about, onClick = openAbout)
            .semantics { contentDescription = about; role = Role.Button },
            contentAlignment = Alignment.Center) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(fill), contentAlignment = Alignment.Center) {
                Icon(LineIcons.of("info"), null, Modifier.size(20.dp), tint = ink)
            }
        }
    }
}

/** The look's mark at the top of the sheet: kawung band, the sun's path, the six stripes, a gold line (none in Big and Simple). */
@Composable
private fun LookStrip(look: Look) {
    when {
        look.centre -> Canvas(Modifier.padding(horizontal = Dims.gutter).padding(bottom = 10.dp).fillMaxWidth().height(10.dp)) {
            val r = CornerRadius(5.dp.toPx())
            drawRoundRect(Color(0xFF262B5E), cornerRadius = r)
            val gold = Color(0xFFE2B65A)
            // Rings in a row, like the web's repeating radial gradient.
            var x = 11.dp.toPx()
            while (x < size.width) { drawCircle(gold.copy(alpha = 0.16f), 10.dp.toPx(), Offset(x, size.height / 2), style = Stroke(1.dp.toPx())); x += 22.dp.toPx() }
            drawRoundRect(gold.copy(alpha = 0.4f), cornerRadius = r, style = Stroke(1.dp.toPx()))
        }
        look.sunPath -> {
            val arc = if (look.dark) Color(0xFFF7BD8F) else Color(0xFFC9622A)
            Canvas(Modifier.fillMaxWidth().height(34.dp).offset(y = (-6).dp)) {
                val sx = size.width / 390f
                val sy = size.height / 34f
                val path = Path().apply { moveTo(-10 * sx, 32 * sy); quadraticTo(195 * sx, -18 * sy, 400 * sx, 32 * sy) }
                drawPath(path, arc.copy(alpha = 0.6f), style = Stroke(2.5.dp.toPx()))
                drawCircle(arc, 6.dp.toPx(), Offset(195 * sx, 7 * sy))
            }
        }
        look.bands -> Row(Modifier.fillMaxWidth().height(8.dp)) { STRIPE.forEach { Box(Modifier.weight(1f).fillMaxSize().background(it)) } }
        look.gold -> Box(Modifier.padding(horizontal = Dims.gutter).padding(top = 2.dp, bottom = 12.dp).fillMaxWidth().height(1.dp).background(look.c.accent.copy(alpha = 0.7f)))
        else -> {}
    }
    if (look.bands) Spacer(Modifier.height(12.dp))
}

@Composable
private fun NearMeButton(look: Look, locating: Boolean, found: Boolean, onClick: () -> Unit) {
    val c = look.c
    val shape = RoundedCornerShape(if (look.bands) 0.dp else look.r + 8.dp)
    val ink = c.accentText
    val label = if (locating) tr(R.string.today_finding) else if (found) tr(R.string.masjid_searchAgain) else tr(R.string.masjid_findNear)
    Row(
        Modifier.fillMaxWidth().heightIn(min = if (look.simple) 52.dp else 48.dp).clip(shape).background(if (look.bands) c.card else c.tint)
            .clickable(enabled = !locating, onClick = onClick).semantics { contentDescription = label; role = Role.Button }
            .padding(horizontal = 18.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        if (locating) CircularProgressIndicator(Modifier.size(18.dp), color = ink, strokeWidth = 2.dp)
        else Icon(LineIcons.of("locate-fixed"), null, Modifier.size(20.dp), tint = ink)
        Spacer(Modifier.width(10.dp))
        Text(label,
            fontSize = if (look.simple) 19.sp else 16.sp, fontWeight = FontWeight.SemiBold, color = ink)
    }
}

private data class Seg(val label: String, val icon: ImageVector? = null)

/** The web's segmented switch on the Masjid tab: a soft track, the chosen part raised. */
@Composable
private fun Segmented(look: Look, items: List<Pair<Seg, Boolean>>, onPick: (Int) -> Unit) {
    val c = look.c
    val outer = RoundedCornerShape(if (look.bands) 0.dp else 10.dp)
    val inner = RoundedCornerShape(if (look.bands) 0.dp else 8.dp)
    val raised = if (look.dark) c.card.copy(alpha = maxOf(c.card.alpha, 0.16f)) else Color.White
    Row(Modifier.fillMaxWidth().clip(outer).background(c.sep).padding(2.dp)) {
        items.forEachIndexed { i, (seg, on) ->
            Row(
                Modifier.weight(1f).heightIn(min = 36.dp)
                    .then(if (on) Modifier.shadow(1.5.dp, inner).clip(inner).background(if (look.bands && look.dark) Color(0xFF3A3A3F) else raised) else Modifier.clip(inner))
                    .clickable(onClickLabel = seg.label) { onPick(i) }
                    .semantics { selected = on; role = Role.Tab },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                seg.icon?.let { Icon(it, null, Modifier.size(15.dp), tint = if (on) c.tx else c.tx2); Spacer(Modifier.width(5.dp)) }
                Text(seg.label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = if (on) c.tx else c.tx2, maxLines = 1)
            }
        }
    }
}

@Composable
private fun Note(look: Look, text: String) = Text(text, fontSize = 13.sp, color = look.c.tx2, modifier = Modifier.padding(start = 4.dp, end = 4.dp, top = 8.dp))

/** The list's card (edge to edge, one band per row, in Colour Bands). */
@Composable
private fun SpaceList(look: Look, content: @Composable ColumnScope.() -> Unit) {
    val c = look.c
    Column(
        Modifier.padding(top = 8.dp).padding(horizontal = if (look.bands) 0.dp else Dims.gutter).fillMaxWidth()
            .then(if (look.bands) Modifier else Modifier.clip(look.shape).background(c.card).border(1.dp, c.stroke, look.shape)),
        content = content,
    )
}

@Composable
private fun Chip(text: String, background: Color, color: Color, square: Boolean, icon: ImageVector? = null, plain: Boolean = false) {
    Row(Modifier.clip(if (square) RoundedCornerShape(0.dp) else CircleShape).background(background)
        .padding(horizontal = if (plain) 10.dp else 8.dp, vertical = if (plain) 4.dp else 2.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        icon?.let { Icon(it, null, Modifier.size(13.dp), tint = color) }
        Text(text, fontSize = 12.sp, fontWeight = if (plain) FontWeight.Medium else FontWeight.SemiBold, color = color)
    }
}

/** One place in the list: icon, name, address and chips, distance and time; tap to open its details. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SpaceRow(
    state: AppState, look: Look, space: PrayerSpace, index: Int, open: Boolean, mode: TripMode, h24: Boolean, hours: OpeningHours.Now?,
    friday: FridayMosque?, raya: EidMosque?, eid: EidEvent?, mine: Boolean, onToggle: () -> Unit,
) {
    val c = look.c
    val bands = look.bands
    val ink = if (bands) Color.White else c.tx
    val ink2 = if (bands) Color.White else c.tx2
    val bg = when {
        bands -> if (space.isMusollah) BAND_ROOM else BAND_ROWS[index % BAND_ROWS.size]
        open -> c.tint
        else -> Color.Transparent
    }
    val pad = if (bands) 24.dp else 14.dp
    val rowLabel = listOf(space.name, space.address, MasjidExtras.distanceText(space.distanceKm)).filter { it.isNotEmpty() }.joinToString(", ")
    Column(Modifier.fillMaxWidth().background(bg)) {
        if (index > 0 && !bands) Box(Modifier.fillMaxWidth().height(1.dp).background(c.sep))
        Row(
            Modifier.fillMaxWidth().heightIn(min = if (look.simple) 64.dp else if (bands) 62.dp else 58.dp)
                .clickable(onClickLabel = if (open) tr(R.string.common_close) else space.name, onClick = onToggle)
                .semantics { contentDescription = rowLabel }
                .padding(horizontal = pad, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (!bands) SpaceIcon(look, space.isMusollah)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (mine) Icon(LineIcons.of("star", filled = true), null, Modifier.size(14.dp).padding(end = 2.dp), tint = if (bands) Color.White else c.accentText)
                    Text(space.name, fontSize = if (look.simple) 21.sp else 17.sp, fontWeight = if (bands) FontWeight.Bold else FontWeight.SemiBold, color = ink,
                        maxLines = if (look.simple) 3 else 1, overflow = TextOverflow.Ellipsis)
                }
                if (space.address.isNotEmpty()) Text(space.address, fontSize = if (look.simple) 15.sp else 13.sp, color = ink2, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (friday != null || hours != null) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 3.dp)) {
                    if (friday != null) Chip(tr(R.string.masjid_twoFridayChip), if (bands) Color.White.copy(alpha = 0.22f) else c.tint, if (bands) Color.White else c.accentText, bands)
                    if (hours != null) Chip(if (hours.open) tr(R.string.masjid_openNow) else tr(R.string.masjid_closedNow),
                        if (bands) Color.White.copy(alpha = 0.22f) else if (hours.open) Color(0xFF34C759).copy(alpha = 0.2f) else c.sep,
                        if (bands) Color.White else if (hours.open) c.tx else c.tx2, bands)
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(MasjidExtras.distanceText(space.distanceKm), fontSize = if (look.simple) 19.sp else 15.sp, color = ink2,
                    style = androidx.compose.ui.text.TextStyle(fontFeatureSettings = "tnum"))
                tripText(space.distanceKm, mode)?.let { Text(it, fontSize = 12.sp, color = ink2) }
            }
        }
        if (open) SpaceMore(state, look, space, mode, h24, hours, friday, raya, eid, mine, startPad = if (bands) pad else pad + 36.dp, endPad = pad)
    }
}

/** The masjid or prayer room mark in a soft tile, as on the web. */
@Composable
private fun SpaceIcon(look: Look, musollah: Boolean) {
    val room = Color(0xFF6E82E6)
    Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).background(if (musollah) room.copy(alpha = 0.2f) else look.c.tint), contentAlignment = Alignment.Center) {
        if (musollah) Icon(LineIcons.of("house", filled = true), null, Modifier.size(18.dp), tint = room)
        else Icon(AppIcons.tab("masjid", false), null, Modifier.size(18.dp), tint = look.c.accentText)
    }
}

/** A place's opened details: room info, facilities, hours, second Friday, Eid, and the actions. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SpaceMore(
    state: AppState, look: Look, space: PrayerSpace, mode: TripMode, h24: Boolean, hours: OpeningHours.Now?,
    friday: FridayMosque?, raya: EidMosque?, eid: EidEvent?, mine: Boolean, startPad: Dp, endPad: Dp, big: Boolean = false,
) {
    val context = LocalContext.current
    val c = look.c
    val bands = look.bands
    val ink = if (bands) Color.White else c.tx
    val ink2 = if (bands) Color.White else c.tx2
    val accent = if (bands) Color.White else c.accentText
    val fs: TextUnit = if (big) 17.sp else 14.sp
    Column(Modifier.padding(start = startPad, end = endPad, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        space.details?.let { RoomInfo(look, it) }
        val have = MasjidExtras.facilityLabels.filter { space.facilities.contains(it.first) }
        val facilityWord = @Composable { k: Char -> when (k) { 'w' -> tr(R.string.masjid_women); 'a' -> tr(R.string.masjid_wheelchair); 'p' -> tr(R.string.masjid_parking); else -> tr(R.string.masjid_toilets) } }
        val facilityIcon = { k: Char -> when (k) { 'w' -> "users"; 'a' -> "accessibility"; 'p' -> "circle-parking"; else -> "droplets" } }
        if (have.isEmpty()) { if (space.details == null) Text(tr(R.string.masjid_noFacilities), fontSize = fs, color = ink2) }
        else FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            have.forEach { Chip(facilityWord(it.first), if (bands) Color.White.copy(alpha = 0.22f) else c.sep, ink, bands, LineIcons.of(facilityIcon(it.first)), plain = true) }
        }
        hours?.let {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(LineIcons.of("clock"), null, Modifier.size(14.dp), tint = ink)
                Text(hoursText(it, h24), fontSize = fs, color = ink)
            }
        }
        friday?.let { Text(secondFriday(it, h24), fontSize = fs, fontWeight = FontWeight.SemiBold, color = accent) }
        if (raya != null && eid != null) {
            Text(tr(R.string.masjid_eidAt, "name" to eidName(eid), "times" to raya.sessions.joinToString(", ") { MasjidExtras.clock(it.time, h24) }),
                fontSize = fs, fontWeight = FontWeight.SemiBold, color = accent)
        }
        FlowRow(Modifier.padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val btn = if (bands) Color.White.copy(alpha = 0.22f) else c.sep
            ActionButton(look, tr(R.string.masjid_directions), LineIcons.of(if (mode == TripMode.WALK) "footprints" else "car"), btn, ink) {
                directions(context, space.coordinates, space.name, mode)
            }
            if (mine) ActionButton(look, if (space.isMusollah) tr(R.string.masjid_keptTop) else tr(R.string.myMasjid_title), LineIcons.of("star", filled = true), btn, accent, onClick = null)
            else ActionButton(look, if (space.isMusollah) tr(R.string.masjid_keepTop) else tr(R.string.masjid_makeMine), LineIcons.of("star"), btn, ink) {
                state.chooseMasjid(space.name, space.coordinates)
            }
            ActionButton(look, tr(R.string.masjid_report), LineIcons.of("flag"), Color.Transparent, ink2, weight = FontWeight.Medium) {
                open(context, MasjidExtras.reportUrl(space.coordinates))
            }
        }
    }
}

/** The web's plain button: a soft pill with a small icon. */
@Composable
private fun ActionButton(look: Look, label: String, icon: ImageVector?, background: Color, color: Color, weight: FontWeight = FontWeight.SemiBold, onClick: (() -> Unit)?) {
    Row(
        Modifier.heightIn(min = 36.dp).clip(if (look.bands) RoundedCornerShape(0.dp) else CircleShape).background(background)
            .then(if (onClick != null) Modifier.clickable(onClickLabel = label, onClick = onClick) else Modifier)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        icon?.let { Icon(it, null, Modifier.size(15.dp), tint = color) }
        Text(label, fontSize = 14.sp, fontWeight = weight, color = color)
    }
}

/** Big and Simple: the nearest masjid as one big card with a big Show me the way button. */
@Composable
private fun NearestCard(
    state: AppState, look: Look, space: PrayerSpace, open: Boolean, mode: TripMode, h24: Boolean, hours: OpeningHours.Now?,
    friday: FridayMosque?, raya: EidMosque?, eid: EidEvent?, mine: Boolean, onToggle: () -> Unit,
) {
    val context = LocalContext.current
    val c = look.c
    Column(Modifier.fillMaxWidth().clip(look.shape).background(c.card).border(2.dp, c.accent, look.shape).padding(horizontal = 18.dp, vertical = 14.dp)) {
        Column(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable(onClickLabel = if (open) tr(R.string.common_close) else space.name, onClick = onToggle)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (mine) Icon(LineIcons.of("star", filled = true), null, Modifier.size(18.dp).padding(end = 6.dp), tint = c.accentText)
                Text(space.name, style = display(24.sp, FontWeight.Bold), color = c.tx)
            }
            Text(MasjidExtras.distanceText(space.distanceKm) + (tripText(space.distanceKm, mode)?.let { ", $it" } ?: ""), fontSize = 19.sp, color = c.tx2,
                modifier = Modifier.padding(top = 4.dp))
        }
        if (open) Box(Modifier.padding(top = 10.dp)) { SpaceMore(state, look, space, mode, h24, hours, friday, raya, eid, mine, 0.dp, 0.dp, big = true) }
        Box(Modifier.padding(top = 12.dp).fillMaxWidth().heightIn(min = 56.dp).clip(RoundedCornerShape(look.r + 8.dp)).background(c.button)
            .clickable(onClickLabel = tr(R.string.masjid_directionsTo, "name" to space.name)) { directions(context, space.coordinates, space.name, mode) },
            contentAlignment = Alignment.Center) {
            Text(tr(R.string.masjid_showWay), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = c.onButton)
        }
    }
}

/** The prayer room details from the community list, only the parts we have. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RoomInfo(look: Look, d: RoomDetails) {
    var more by remember { mutableStateOf(false) }
    val c = look.c
    val bands = look.bands
    val ink = if (bands) Color.White else c.tx
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (d.howToFind.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(if (bands) 0.dp else 12.dp)).background(if (bands) Color.White.copy(alpha = 0.18f) else c.tint)
                .padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(tr(R.string.masjid_findIt), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ink)
                Text(d.howToFind, fontSize = 13.sp, color = ink)
            }
        }
        val chips = d.chips
        if (chips.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            chips.forEach { Chip(it, if (bands) Color.White.copy(alpha = 0.22f) else c.sep, ink, bands, plain = true) }
        }
        if (d.notes.isNotEmpty() || d.toiletLevel.isNotEmpty()) {
            Text(if (more) tr(R.string.masjid_lessDetails) else tr(R.string.masjid_moreDetails), fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                color = if (bands) Color.White else c.accentText, modifier = Modifier.heightIn(min = 32.dp).clickable { more = !more }.padding(vertical = 6.dp))
            if (more) {
                if (d.toiletLevel.isNotEmpty()) Text(tr(R.string.masjid_toiletOn, "level" to d.toiletLevelText), fontSize = 13.sp, color = ink)
                if (d.notes.isNotEmpty()) Text(d.notes, fontSize = 13.sp, color = ink)
                Text(tr(R.string.masjid_communityNote), fontSize = 12.sp, color = if (bands) Color.White else c.tx2)
            }
        }
    }
}

/** A tapped pin on the map: its name, how far, opening hours, Friday prayers, Directions (as on iPhone). */
@Composable
private fun PinCard(s: PrayerSpace, mode: TripMode, h24: Boolean, hours: OpeningHours.Now?, singapore: Boolean, onClose: () -> Unit, onDirections: () -> Unit) {
    val look = LocalLook.current
    val c = look.c
    val fri = if (singapore) MasjidExtras.fridayAt(s.coordinates) else null
    val card = if (look.dark) Color(0xFF1E2140).copy(alpha = 0.96f) else Color.White.copy(alpha = 0.97f)
    val shape = RoundedCornerShape(if (look.bands) 0.dp else 16.dp)
    Row(Modifier.fillMaxWidth().shadow(8.dp, shape).clip(shape).background(card).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(s.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = c.tx, maxLines = 2)
            Text(tr(R.string.masjid_away, "distance" to MasjidExtras.distanceText(s.distanceKm)) + (tripText(s.distanceKm, mode)?.let { ", $it" } ?: ""),
                fontSize = 12.sp, color = c.tx2)
            hours?.let { Text(hoursText(it, h24), fontSize = 12.sp, color = if (it.open) Color(0xFF1F8A3B).takeIf { !look.dark } ?: Color(0xFF34C759) else c.tx2) }
            if (fri != null) Text(tr(R.string.masjid_twoFriday, "time" to MasjidExtras.clock(MasjidExtras.FRIDAY_SECOND_FROM, h24)), fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold, color = c.accentText)
        }
        val directionsTo = tr(R.string.masjid_directionsTo, "name" to s.name)
        Row(Modifier.heightIn(min = 40.dp).clip(if (look.bands) RoundedCornerShape(0.dp) else CircleShape).background(c.button)
            .clickable(onClickLabel = directionsTo, onClick = onDirections)
            .padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(LineIcons.of(if (mode == TripMode.WALK) "footprints" else "car"), null, Modifier.size(16.dp), tint = c.onButton)
            Text(tr(R.string.masjid_directions), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = c.onButton)
        }
        val close = tr(R.string.common_close)
        Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClickLabel = close, onClick = onClose).semantics { contentDescription = close },
            contentAlignment = Alignment.Center) {
            Icon(LineIcons.of("x"), null, Modifier.size(18.dp), tint = c.tx2)
        }
    }
}

/** For screenshots: a few masjids with last Aidiladha's layout. */
internal var demoEid: List<EidEvent>? = null

/** A card in the look on the Masjid tab (your masjid, Friday, Eid), with an accent edge when it matters today. */
@Composable
private fun LookCard(look: Look, strong: Boolean, top: Dp, content: @Composable ColumnScope.() -> Unit) {
    val c = look.c
    Column(Modifier.padding(top = top).fillMaxWidth().clip(look.shape).background(c.card)
        .border(1.dp, if (strong) c.accent.copy(alpha = 0.55f) else c.stroke, look.shape).padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
}

/** Your masjid, pinned at the top with how far it is and its iqamah times. */
@Composable
private fun YourMasjid(state: AppState, look: Look, m: MasjidLink, from: Coordinates, mode: TripMode, h24: Boolean, singapore: Boolean, eid: EidEvent?, onFocus: (Coordinates) -> Unit) {
    val context = LocalContext.current
    val c = look.c
    val at = Coordinates(m.lat, m.lng)
    val km = Geo.distanceKm(from, at)
    val naming = state.resolver.naming
    val parts = Prayer.obligatory.mapNotNull { p ->
        m.jamaah[p.raw]?.let { r -> "${p.name(naming)} ${r.fixed?.let { MasjidExtras.clock(it, h24) } ?: "+${r.after} min"}" }
    } + listOfNotNull(m.jumuah?.let { "${Prayer.DHUHR.name(naming, true)} ${MasjidExtras.clock(it, h24)}" })
    val friday = if (singapore) MasjidExtras.fridayAt(at) else null
    val raya = eid?.let { MasjidExtras.eidAt(it, m.name, at) }
    Box(Modifier.padding(bottom = 14.dp)) {
        LookCard(look, strong = true, top = 0.dp) {
            Row(Modifier.fillMaxWidth().clickable(onClickLabel = m.name) { onFocus(at) }, horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(LineIcons.of("star", filled = true), null, Modifier.size(20.dp), tint = c.accentText)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(tr(R.string.myMasjid_title).uppercase(Locale.getDefault()), fontSize = 11.sp, letterSpacing = 0.66.sp, color = c.tx2)
                    Text(m.name, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = c.tx)
                    Text(tr(R.string.masjid_away, "distance" to MasjidExtras.distanceText(km)) + (tripText(km, mode)?.let { ", $it" } ?: ""), fontSize = 13.sp, color = c.tx2)
                }
            }
            Column(Modifier.padding(start = 32.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(if (parts.isEmpty()) tr(R.string.masjid_iqamahHow) else tr(R.string.masjid_iqamahLine, "times" to parts.joinToString(", ")),
                    fontSize = 14.sp, lineHeight = 19.6.sp, color = c.tx)
                friday?.let { Text(secondFriday(it, h24), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = c.accentText) }
                if (raya != null && eid != null) Text(tr(R.string.masjid_eidAt, "name" to eidName(eid), "times" to raya.sessions.joinToString(", ") { MasjidExtras.clock(it.time, h24) }),
                    fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = c.accentText)
                else m.eid?.let { Text(tr(R.string.masjid_eidAtTime, "time" to MasjidExtras.clock(it, h24)), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = c.accentText) }
                Row(Modifier.padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionButton(look, tr(R.string.masjid_directions), LineIcons.of(if (mode == TripMode.WALK) "footprints" else "car"), c.sep, c.tx) { directions(context, at, m.name, mode) }
                    ActionButton(look, tr(R.string.common_remove), null, Color.Transparent, c.tx2, FontWeight.Medium) { state.forgetMasjid() }
                }
            }
        }
    }
}

/** A row inside the Friday and Eid cards: the mark, name and line, distance; optional directions button. */
@Composable
private fun CardRow(look: Look, name: String, lines: List<String>, km: Double?, trip: String?, icon: String, onTap: (() -> Unit)?, directionsLabel: String?,
    dirIcon: String = "footprints", onDirections: (() -> Unit)?) {
    val c = look.c
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.weight(1f).heightIn(min = 52.dp).then(if (onTap != null) Modifier.clickable(onClickLabel = name, onClick = onTap).semantics { contentDescription = (listOf(name) + lines).joinToString(", ") } else Modifier).padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(LineIcons.of(icon), null, Modifier.size(20.dp), tint = c.accentText)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(name, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = c.tx)
                lines.forEach { Text(it, fontSize = 12.sp, color = c.tx2) }
            }
            if (km != null) Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(MasjidExtras.distanceText(km), fontSize = 15.sp, color = c.tx2, style = androidx.compose.ui.text.TextStyle(fontFeatureSettings = "tnum"))
                trip?.let { Text(it, fontSize = 12.sp, color = c.tx2) }
            }
        }
        if (onDirections != null && directionsLabel != null) {
            // The words sit on the button itself, so a screen reader has them even when the round icon is half scrolled away.
            Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClickLabel = directionsLabel, onClick = onDirections)
                .semantics { contentDescription = directionsLabel }, contentAlignment = Alignment.Center) {
                Box(Modifier.size(36.dp).clip(if (look.bands) RoundedCornerShape(0.dp) else CircleShape).background(c.tint), contentAlignment = Alignment.Center) {
                    Icon(LineIcons.of(dirIcon), null, Modifier.size(17.dp), tint = c.accentText)
                }
            }
        }
    }
}

/** Singapore only: masjids with a second Friday prayer, nearest first (MUIS). */
@Composable
private fun FridayCard(look: Look, from: Coordinates, today: Boolean, mode: TripMode, h24: Boolean, dhuhr: String, onFocus: (Coordinates) -> Unit) {
    val context = LocalContext.current
    val c = look.c
    var all by remember { mutableStateOf(false) }
    val list = MasjidExtras.fridayNearest(from)
    val updated = runCatching { LocalDate.parse(MasjidExtras.FRIDAY_SOURCE_UPDATED).format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK)) }.getOrDefault("")
    val time = MasjidExtras.clock(MasjidExtras.FRIDAY_SECOND_FROM, h24)
    LookCard(look, strong = today, top = if (today) 16.dp else 22.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Icon(LineIcons.of("calendar-days"), null, Modifier.padding(top = 3.dp).size(20.dp), tint = c.accentText)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (today) tr(R.string.masjid_fridayToday) else tr(R.string.masjid_fridaySg), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = c.tx,
                    modifier = Modifier.semantics { heading() })
                Text(tr(R.string.masjid_fridayHold, "n" to list.size, "time" to time, "name" to dhuhr),
                    fontSize = 14.sp, lineHeight = 19.6.sp, color = c.tx2)
            }
        }
        (if (all) list else list.take(3)).forEachIndexed { i, (m, km) ->
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(c.sep))
            CardRow(look, m.name, listOf(m.district + if (m.womenSession2) ". " + tr(R.string.masjid_women2) else ""), km, tripText(km, mode), "moon-star",
                onTap = { onFocus(m.coordinates) }, directionsLabel = tr(R.string.masjid_directionsTo, "name" to m.name),
                dirIcon = if (mode == TripMode.WALK) "footprints" else "car") { directions(context, m.coordinates, m.name, mode) }
        }
        ActionButton(look, if (all) tr(R.string.masjid_showNearest3) else tr(R.string.masjid_seeAll, "n" to list.size), null, c.sep, c.tx) { all = !all }
        MuisLine(look, tr(R.string.masjid_fromMuisUpdated, "date" to updated, "link" to "\u0000")) { open(context, MasjidExtras.FRIDAY_SOURCE_URL) }
    }
}

/** "From MUIS ... See the MUIS list", with the link words in the accent; the whole line opens the list. */
@Composable
private fun MuisLine(look: Look, text: String, onOpen: () -> Unit) {
    val link = tr(R.string.masjid_seeMuis)
    val (before, after) = text.split("\u0000").let { it[0] to it.getOrElse(1) { "" } }
    Text(buildAnnotatedString {
        append(before)
        withStyle(SpanStyle(color = look.c.accentText, fontWeight = FontWeight.SemiBold)) { append(link) }
        append(after)
    }, fontSize = 13.sp, lineHeight = 18.sp, color = look.c.tx2, modifier = Modifier.padding(top = 4.dp).clickable(onClickLabel = link, onClick = onOpen))
}

/** Singapore, in the two weeks before Hari Raya: sessions at the nearest masjids (MUIS). */
@Composable
private fun EidCard(look: Look, e: EidEvent, from: Coordinates, spaces: List<PrayerSpace>, h24: Boolean) {
    val context = LocalContext.current
    val c = look.c
    var all by remember { mutableStateOf(false) }
    val rows = e.mosques.map { m ->
        val at = if (m.lat != null && m.lng != null) Coordinates(m.lat!!, m.lng!!)
        else spaces.firstOrNull { MasjidExtras.eidAt(e.copy(mosques = listOf(m)), it.name, it.coordinates) != null }?.coordinates
        m to at?.let { Geo.distanceKm(from, it) }
    }.sortedBy { it.second ?: 1e9 }
    val date = runCatching { LocalDate.parse(e.date).format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.UK)) }.getOrDefault(e.date)
    val women = tr(R.string.masjid_spaceWomen)
    LookCard(look, strong = true, top = 16.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Icon(LineIcons.of("moon-star"), null, Modifier.padding(top = 3.dp).size(20.dp), tint = c.accentText)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(eidName(e), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = c.tx, modifier = Modifier.semantics { heading() })
                Text(tr(R.string.masjid_eidNearest, "date" to date), fontSize = 14.sp, color = c.tx2)
            }
        }
        (if (all) rows else rows.take(3)).forEachIndexed { i, (m, km) ->
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(c.sep))
            val extra = listOfNotNull(if (m.sessions.any { it.women }) women else null, m.note).joinToString(". ")
            CardRow(look, m.name, listOfNotNull(m.sessions.joinToString(", ") { s -> MasjidExtras.clock(s.time, h24) + (s.khutbah?.let { " ($it)" } ?: "") },
                extra.ifEmpty { null }), km, null, "moon-star", onTap = null, directionsLabel = null, onDirections = null)
        }
        if (rows.size > 3) ActionButton(look, if (all) tr(R.string.masjid_showNearest3) else tr(R.string.masjid_seeAll, "n" to rows.size), null, c.sep, c.tx) { all = !all }
        MuisLine(look, tr(R.string.masjid_fromMuis, "link" to "\u0000")) { open(context, e.sourceUrl) }
    }
}

/** Suggest a prayer room: a full width row in the look. */
@Composable
private fun SuggestButton(look: Look, onClick: () -> Unit) {
    val c = look.c
    val label = tr(R.string.suggestRoom_button)
    Row(
        Modifier.padding(top = 10.dp)
            .then(if (look.bands) Modifier.layout { m, k ->
                // Edge to edge in Colour Bands, out past the page's side margins.
                val g = Dims.gutter.roundToPx()
                val p = m.measure(k.copy(minWidth = k.maxWidth + 2 * g, maxWidth = k.maxWidth + 2 * g))
                layout(k.maxWidth, p.height) { p.place(-g, 0) }
            } else Modifier)
            .fillMaxWidth().heightIn(min = 50.dp)
            .then(if (look.bands) Modifier.background(c.card) else Modifier.clip(look.shape).background(c.card).border(1.dp, c.stroke, look.shape))
            .clickable(onClick = onClick).semantics { contentDescription = label; role = Role.Button }
            .padding(horizontal = if (look.bands) 24.dp else 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(LineIcons.of("plus"), null, Modifier.size(16.dp), tint = c.accentText)
        Text(tr(R.string.suggestRoom_button), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = c.accentText)
    }
}

@Composable
private fun Empty(look: Look, title: String, body: String, onRetry: (() -> Unit)? = null) {
    val c = look.c
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(LineIcons.of("moon-star"), null, Modifier.size(40.dp), tint = c.tx.copy(alpha = 0.6f))
        Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = c.tx, textAlign = TextAlign.Center)
        Text(body, fontSize = 15.sp, color = c.tx2, textAlign = TextAlign.Center)
        if (onRetry != null) {
            val shape = RoundedCornerShape(if (look.bands) 0.dp else 999.dp)
            Box(Modifier.padding(top = 6.dp).heightIn(min = 44.dp).clip(shape).background(c.button).clickable(onClick = onRetry).padding(horizontal = 20.dp),
                contentAlignment = Alignment.Center) {
                Text(tr(R.string.common_tryAgain), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = c.onButton)
            }
        }
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

