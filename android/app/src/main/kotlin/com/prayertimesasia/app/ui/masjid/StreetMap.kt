package com.prayertimesasia.app.ui.masjid

import com.prayertimesasia.app.BuildConfig
import android.content.Context
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.animation.core.Animatable
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.Star
import androidx.compose.runtime.Stable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import com.prayertimesasia.core.MasjidLink
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.MasjidExtras
import com.prayertimesasia.core.PrayerSpace
import com.prayertimesasia.core.TripMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.log2
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sinh

/**
 * Web Mercator in "world dp": at zoom z the whole world is 256 * 2^z dp wide,
 * the same numbers Leaflet uses on the website.
 */
internal object Mercator {
    fun worldSize(z: Double) = 256.0 * 2.0.pow(z)
    fun x(lng: Double, z: Double) = (lng + 180.0) / 360.0 * worldSize(z)
    fun y(lat: Double, z: Double): Double {
        val s = sin(lat.coerceIn(-85.0, 85.0) * PI / 180.0)
        return (0.5 - ln((1 + s) / (1 - s)) / (4 * PI)) * worldSize(z)
    }
    fun lng(x: Double, z: Double) = x / worldSize(z) * 360.0 - 180.0
    fun lat(y: Double, z: Double) = atan(sinh(PI - 2 * PI * y / worldSize(z))) * 180.0 / PI
    /** Metres covered by one dp at this latitude and zoom. */
    fun metresPerDp(lat: Double, z: Double) = 40_075_016.686 * cos(lat * PI / 180.0) / worldSize(z)
}

/**
 * OpenStreetMap's standard tiles, as on the website. Kept in memory and in the
 * app's cache folder for a week, fetched at most two at a time with our own
 * name, as the OpenStreetMap tile policy asks.
 */
object OsmTiles {
    private const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000
    private val memory = LruCache<String, ImageBitmap>(80)
    private val loading = HashSet<String>()
    private val failed = HashMap<String, Long>()
    private const val RETRY_MS = 30_000L
    @OptIn(ExperimentalCoroutinesApi::class)
    private val io = Dispatchers.IO.limitedParallelism(2)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var folder: File? = null

    /** Bumped whenever a tile arrives, so the map draws again. */
    val arrived = mutableIntStateOf(0)

    /** Screenshot tests set this so tiles load before the picture is taken. */
    @Volatile var blocking = false

    /**
     * The tile zoom the map is drawing now. Tiles queued for another zoom are
     * dropped before they download, so a quick pinch doesn't leave the map
     * waiting behind tiles nobody can see.
     */
    @Volatile private var wantedZ = -1

    /** Where tiles come from; tests can point this somewhere else. */
    var fetch: (z: Int, x: Int, y: Int) -> ByteArray? = { z, x, y -> download(z, x, y) }

    fun attach(context: Context) {
        if (folder == null) folder = File(context.cacheDir, "osm-tiles")
    }

    fun get(z: Int, x: Int, y: Int): ImageBitmap? {
        val key = "$z/$x/$y"
        memory.get(key)?.let { return it }
        wantedZ = z
        if (blocking) return load(key, z, x, y)?.also { memory.put(key, it) }
        synchronized(loading) {
            if (key in loading) return null
            val lastFail = failed[key]
            if (lastFail != null && System.currentTimeMillis() - lastFail < RETRY_MS) return null
            loading += key
        }
        scope.launch {
            val bmp = withContext(io) { if (z == wantedZ) load(key, z, x, y) else null }
            synchronized(loading) {
                loading -= key
                // A tile skipped for another zoom isn't a failure; it is asked for again if needed.
                if (bmp == null && z == wantedZ) failed[key] = System.currentTimeMillis()
            }
            if (bmp != null) {
                memory.put(key, bmp)
                arrived.intValue++
            }
        }
        return null
    }

    /** Lets a failed tile try again, for example after the phone comes back online. */
    fun retryFailed() = synchronized(loading) { failed.clear() }

    private fun load(key: String, z: Int, x: Int, y: Int): ImageBitmap? {
        val file = folder?.let { File(it, "$key.png") }
        if (file != null && file.exists() && System.currentTimeMillis() - file.lastModified() < MAX_AGE_MS) {
            decode(file.readBytes())?.let { return it }
        }
        val bytes = try { fetch(z, x, y) } catch (_: Exception) { null }
        if (bytes == null) return file?.takeIf { it.exists() }?.let { decode(it.readBytes()) }
        if (file != null) try {
            file.parentFile?.mkdirs()
            file.writeBytes(bytes)
        } catch (_: Exception) {
        }
        return decode(bytes)
    }

    private fun decode(bytes: ByteArray) =
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()

    private fun download(z: Int, x: Int, y: Int): ByteArray? {
        val conn = URL("https://tile.openstreetmap.org/$z/$x/$y.png").openConnection() as HttpURLConnection
        return try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("User-Agent", "PrayerTimesAsia/${BuildConfig.VERSION_NAME} (Android; https://prayertimes.asia)")
            if (conn.responseCode == 200) conn.inputStream.use { it.readBytes() } else null
        } finally {
            conn.disconnect()
        }
    }
}

/** The website's night look for map tiles: inverted, turned back to blue water, a little dimmer. */
private val nightTiles: ColorFilter by lazy {
    val invert = ColorMatrix(floatArrayOf(
        -1f, 0f, 0f, 0f, 255f,
        0f, -1f, 0f, 0f, 255f,
        0f, 0f, -1f, 0f, 255f,
        0f, 0f, 0f, 1f, 0f))
    // Hue turned 180 degrees (the CSS hue-rotate matrix), so water stays blue after inverting.
    val hue = ColorMatrix(floatArrayOf(
        -0.574f, 1.43f, 0.144f, 0f, 0f,
        0.426f, 0.43f, 0.144f, 0f, 0f,
        0.426f, 1.43f, -0.856f, 0f, 0f,
        0f, 0f, 0f, 1f, 0f))
    val dim = ColorMatrix().apply { setToScale(0.85f, 0.85f, 0.88f, 1f) }
    hue.timesAssign(invert)
    dim.timesAssign(hue)
    ColorFilter.colorMatrix(dim)
}

/**
 * Where the map looks and how close, shared by the map and the list under it, so tapping
 * a place in the list moves the map there (as on iPhone).
 */
@Stable
internal class MapCamera {
    var lat by mutableDoubleStateOf(0.0)
    var lng by mutableDoubleStateOf(0.0)
    var zoom by mutableDoubleStateOf(14.0)
    /** Where an animated move is heading; the map runs the animation. */
    var target by mutableStateOf<Triple<Double, Double, Double>?>(null)
    /** The map's size in dp, known once it is laid out. */
    var widthDp = 0.0
    var heightDp = 0.0
    var ready by mutableStateOf(false)

    private fun zoomFor(metres: Double, lat: Double, dp: Double) =
        log2(40_075_016.686 * cos(lat * PI / 180) * dp / metres / 256.0).coerceIn(3.0, 18.5)

    /** Centre on [c] showing about [metres] across the map's shorter side. */
    fun show(c: Coordinates, metres: Double, animate: Boolean) {
        val z = zoomFor(metres, c.latitude, max(1.0, minOf(widthDp, heightDp)))
        if (animate && ready) target = Triple(c.latitude, c.longitude, z) else { lat = c.latitude; lng = c.longitude; zoom = z; target = null }
    }

    /**
     * As on the web app: frame the nearest places with at least the 1 km ring round you, in the part
     * of the map the sheet does not cover ([bottomDp] at its foot), no closer in than zoom 16.
     */
    fun frame(c: Coordinates, near: List<Coordinates>, bottomDp: Double) {
        if (!ready) return
        val d = 1 / 111.2
        val dl = d / max(0.2, cos(c.latitude * PI / 180))
        val pts = near + listOf(Coordinates(c.latitude - d, c.longitude - dl), Coordinates(c.latitude + d, c.longitude + dl))
        val minLat = pts.minOf { it.latitude }; val maxLat = pts.maxOf { it.latitude }
        val minLng = pts.minOf { it.longitude }; val maxLng = pts.maxOf { it.longitude }
        val usableH = max(80.0, heightDp - bottomDp)
        var z = 16.0
        while (z > 3) {
            val w = Mercator.x(maxLng, z) - Mercator.x(minLng, z)
            val h = Mercator.y(minLat, z) - Mercator.y(maxLat, z)
            if (w <= widthDp - 72 && h <= usableH - 72) break
            z -= 0.125
        }
        // Centre the framed area in the open part of the map, above the sheet.
        val cy = (Mercator.y(minLat, z) + Mercator.y(maxLat, z)) / 2 + bottomDp / 2
        val cx = (Mercator.x(minLng, z) + Mercator.x(maxLng, z)) / 2
        lat = Mercator.lat(cy, z); lng = Mercator.lng(cx, z); zoom = z; target = null
    }

    /** Fit every point, with room for the pins. */
    fun fit(points: List<Coordinates>) {
        if (points.isEmpty() || !ready) return
        val minLat = points.minOf { it.latitude }; val maxLat = points.maxOf { it.latitude }
        val minLng = points.minOf { it.longitude }; val maxLng = points.maxOf { it.longitude }
        var z = 18.0
        while (z > 3) {
            val w = Mercator.x(maxLng, z) - Mercator.x(minLng, z)
            val h = Mercator.y(minLat, z) - Mercator.y(maxLat, z)
            if (w <= widthDp - 60 && h <= heightDp - 80) break
            z -= 0.25
        }
        val cy = (Mercator.y(minLat, z) + Mercator.y(maxLat, z)) / 2
        target = Triple(Mercator.lat(cy - 12, z), (minLng + maxLng) / 2, z)
    }
}

/** iPhone's camera: about 3 km across on foot, about 11 km by car. */
internal fun spanFor(mode: TripMode) = if (mode == TripMode.WALK) 3_000.0 else 11_000.0

/**
 * A real street map (OpenStreetMap, as on the website), laid out like the iPhone's Apple Maps one:
 * a pin for each place (moon for a masjid, house for a prayer room, star for your masjid),
 * three dashed rings in 1 2 5 steps that follow the zoom (500 m, 1 and 2 km on foot, 1, 2 and
 * 5 km by car) labelled with the walk or drive time, you as a blue dot with a glow and a ring beaming out, a button to come back to you, and a card for the tapped pin with
 * its distance, hours, Friday prayers and Directions. Drag to move, pinch or double tap to zoom.
 */
@Composable
internal fun StreetMap(
    center: Coordinates, spaces: List<PrayerSpace>, mine: MasjidLink?, isMine: (Coordinates) -> Boolean,
    selected: PrayerSpace?, mode: TripMode, camera: MapCamera, youLabel: String, modifier: Modifier,
    /** How much of the map's foot the Masjid sheet covers, so the buttons, card and credit sit above it. */
    bottomInset: androidx.compose.ui.unit.Dp = 0.dp,
    onSelect: (PrayerSpace?) -> Unit, card: @Composable (PrayerSpace) -> Unit,
) {
    val look = com.prayertimesasia.app.ui.theme.LocalLook.current
    val context = LocalContext.current
    val whereLabel = com.prayertimesasia.app.ui.components.tr(com.prayertimesasia.app.R.string.phone_showWhereIAm)
    LaunchedEffect(Unit) { OsmTiles.attach(context); OsmTiles.retryFailed() }
    val density = LocalDensity.current.density
    val dark = LocalSkyScheme.current.dark
    val reduceMotion = LocalSkyScheme.current.reduceMotion
    // Brighter blue on the dark map, with lighter rings, so both show.
    val you = if (dark) Color(0xFF3D9BFF) else Color(0xFF0A6BFF)
    val glow = if (dark) Color(0xFF5AAFFF).copy(alpha = 0.55f) else you.copy(alpha = 0.30f)
    val beamRing = if (dark) Color(0xFF8CC7FF).copy(alpha = 0.95f) else you.copy(alpha = 0.85f)
    val ringLine = if (dark) Color(0xFF8CC2FF).copy(alpha = 0.85f) else Color(0xFF0A5EDB).copy(alpha = 0.75f)
    val ringFill = if (dark) Color(0xFF78BAFF).copy(alpha = 0.10f) else you.copy(alpha = 0.07f)
    val chip = if (dark) Color(0xFF101C38).copy(alpha = 0.94f) else Color.White.copy(alpha = 0.97f)
    val chipText = if (dark) Color(0xFFCFE4FF) else Color(0xFF0A55C8)
    val material = Palette.materialStrong
    val primary = Palette.primary
    val moon = rememberVectorPainter(com.prayertimesasia.app.ui.theme.AppIcons.masjid)
    val house = rememberVectorPainter(Icons.Filled.Home)
    val star = rememberVectorPainter(Icons.Filled.Star)

    // Centre on you whenever "you" moves or Walk and Drive switch, as on iPhone.
    // Frame you and the nearest five places, as the web app does, whenever "you", Walk and Drive or the list change.
    val nearest = spaces.take(5)
    LaunchedEffect(center, mode, camera.ready, nearest.map { it.id }) {
        if (!camera.ready) return@LaunchedEffect
        if (nearest.isEmpty()) camera.show(center, spanFor(mode), animate = false)
        else camera.frame(center, nearest.map { it.coordinates }, bottomInset.value.toDouble())
    }
    LaunchedEffect(camera.target) {
        val t = camera.target ?: return@LaunchedEffect
        val from = Triple(camera.lat, camera.lng, camera.zoom)
        val a = Animatable(0f)
        a.animateTo(1f, tween(if (reduceMotion) 0 else 450)) {
            val f = value.toDouble()
            camera.lat = from.first + (t.first - from.first) * f
            camera.lng = from.second + (t.second - from.second) * f
            camera.zoom = from.third + (t.third - from.third) * f
        }
        camera.target = null
    }

    val placed = remember { mutableListOf<Pair<PrayerSpace, Offset>>() }
    val measurer = rememberTextMeasurer()
    val labelStyle = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = chipText)
    val nameStyle = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (dark) Color.White else Color(0xFF1C1C1E))
    val attributionStyle = TextStyle(fontSize = 9.sp, color = Color(0xFF333333))
    // One clear ring out every 2.4 seconds, and a glow that breathes in the same rhythm.
    val beams = rememberInfiniteTransition(label = "beam")
    val beam by beams.animateFloat(0f, 1f, infiniteRepeatable(tween(2400, easing = CubicBezierEasing(0.2f, 0.6f, 0.3f, 1f))), label = "beam")
    val breathe by beams.animateFloat(0f, 1f, infiniteRepeatable(tween(1200, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "breathe")
    val tilesVersion by OsmTiles.arrived
    val currentSpaces by rememberUpdatedState(spaces)

    Box(modifier.clipToBounds().background(if (dark) Color(0xFF1C2230) else Color(0xFFE9E5DC))
        .onSizeChanged {
            camera.widthDp = it.width / density.toDouble(); camera.heightDp = it.height / density.toDouble()
            if (it.width > 0) camera.ready = true
        }
        .semantics { contentDescription = "Map of masjids and prayer rooms near $youLabel. ${spaces.size} places." }) {
        Canvas(Modifier.fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { centroid, pan, gestureZoom, _ ->
                    camera.target = null
                    val z = camera.zoom
                    val z2 = (z + log2(gestureZoom.toDouble())).coerceIn(3.0, 18.5)
                    // Zoom around the fingers, as Apple Maps does: the spot between
                    // them stays under them while the map grows or shrinks.
                    val dx = centroid.x / density - camera.widthDp / 2
                    val dy = centroid.y / density - camera.heightDp / 2
                    val scale = 2.0.pow(z2 - z)
                    val cx = (Mercator.x(camera.lng, z) - pan.x / density + dx) * scale - dx
                    val cy = (Mercator.y(camera.lat, z) - pan.y / density + dy) * scale - dy
                    camera.zoom = z2
                    camera.lng = Mercator.lng(cx, z2)
                    camera.lat = Mercator.lat(cy, z2)
                }
            }
            .pointerInput(Unit) {
                detectTapGestures(onDoubleTap = { camera.target = Triple(camera.lat, camera.lng, (camera.zoom + 1).coerceAtMost(18.5)) }) { tap ->
                    // A pin sits on its place, as on the web.
                    val hit = placed.minByOrNull { hypot((it.second.x - tap.x).toDouble(), (it.second.y - tap.y).toDouble()) }
                        ?.takeIf { hypot((it.second.x - tap.x).toDouble(), (it.second.y - tap.y).toDouble()) < 26.dp.toPx() }
                    onSelect(hit?.first?.let { h -> currentSpaces.firstOrNull { it.id == h.id } ?: h })
                }
            }) {
            if (tilesVersion < 0) return@Canvas
            val z = camera.zoom
            val mid = this.center
            val cx = Mercator.x(camera.lng, z)
            val cy = Mercator.y(camera.lat, z)
            fun toScreen(la: Double, lo: Double) =
                Offset(((Mercator.x(lo, z) - cx) * density + mid.x).toFloat(), ((Mercator.y(la, z) - cy) * density + mid.y).toFloat())

            // Tiles one zoom level finer than the map, so streets stay sharp on dense screens.
            val tz = (z + 1).roundToInt().coerceIn(2, 19)
            val tileDp = 256.0 * 2.0.pow(z - tz)
            val tilePx = tileDp * density
            val n = 1 shl tz
            val leftWorld = cx - mid.x / density
            val topWorld = cy - mid.y / density
            val x0 = floor(leftWorld / tileDp).toInt()
            val y0 = floor(topWorld / tileDp).toInt()
            val x1 = floor((leftWorld + size.width / density) / tileDp).toInt()
            val y1 = floor((topWorld + size.height / density) / tileDp).toInt()
            val filter = if (dark) nightTiles else null
            for (ty in y0..y1) {
                if (ty < 0 || ty >= n) continue
                for (tx in x0..x1) {
                    val img = OsmTiles.get(tz, ((tx % n) + n) % n, ty) ?: continue
                    val left = (tx * tileDp - leftWorld) * density
                    val top = (ty * tileDp - topWorld) * density
                    drawImage(img, srcOffset = IntOffset.Zero, srcSize = IntSize(img.width, img.height),
                        dstOffset = IntOffset(left.roundToInt(), top.roundToInt()),
                        dstSize = IntSize(tilePx.roundToInt() + 1, tilePx.roundToInt() + 1), colorFilter = filter)
                }
            }

            // Three rings in 1 2 5 steps that suit the zoom, the first one softly filled.
            val me = toScreen(center.latitude, center.longitude)
            val pxPerKm = (1000 / Mercator.metresPerDp(center.latitude, z) * density).toFloat()
            val rings = MasjidExtras.ringsFor(size.width / 2.0 / pxPerKm, size.height / 2.0 / pxPerKm)
            for (km in rings) {
                if (km == rings.first()) drawCircle(ringFill, (km * pxPerKm).toFloat(), me)
                drawCircle(ringLine, (km * pxPerKm).toFloat(), me, style = Stroke(1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 7.dp.toPx()))))
            }

            // Pins, nearest drawn last so it sits on top; the tapped one last of all.
            val now = mutableListOf<Pair<PrayerSpace, Offset>>()
            val names = mutableListOf<androidx.compose.ui.geometry.Rect>()
            val order = spaces.reversed().sortedBy { it.id == selected?.id }
            // Pins in the look, as the web's .space-pin: a round badge on the place with a white rim.
            // Centre Dial a double rim, Sun Path a glow, Colour Bands a square in the band colours,
            // Big and Simple bigger, Calm Gold navy with a gold rim.
            val bandPins = listOf(0xFF3A6F63, 0xFF8A9A52, 0xFFAB8D3A, 0xFFCD7D38, 0xFFD3705C, 0xFFC9565D).map { Color(it) }
            fun pin(p: Offset, musollah: Boolean, index: Int, icon: androidx.compose.ui.graphics.vector.VectorPainter, big: Boolean) {
                val r = ((if (look.simple) 19f else 15f) + (if (big) 3f else 0f)).dp.toPx()
                val fill = when {
                    look.gold -> if (look.dark) Color(0xFF151A45).copy(alpha = 0.6f) else Color.White.copy(alpha = 0.85f)
                    look.bands -> if (musollah) Color(0xFF4A63B8) else bandPins[index % 6]
                    musollah -> Color(108, 132, 204)
                    else -> Color(232, 140, 87)
                }
                val rim = if (look.gold) Color(0xFFE2B65A) else Color.White.copy(alpha = 0.9f)
                val ink = when { look.gold -> if (look.dark) Color(0xFFE2B65A) else Color(0xFF8A6410); else -> Color.White }
                if (look.sunPath) {
                    drawCircle(Brush.radialGradient(0f to Color(247, 189, 143, 0x99), 1f to Color.Transparent, center = p, radius = r + 16.dp.toPx()), r + 16.dp.toPx(), p)
                    drawCircle(Color(247, 189, 143).copy(alpha = 0.28f), r + 7.dp.toPx(), p)
                }
                if (look.bands) {
                    val half = r
                    val tl = Offset(p.x - half, p.y - half)
                    drawRoundRect(Color.Black.copy(alpha = 0.3f), tl + Offset(0f, 2.dp.toPx()), Size(half * 2, half * 2), CornerRadius(4.dp.toPx()))
                    drawRoundRect(fill, tl, Size(half * 2, half * 2), CornerRadius(4.dp.toPx()))
                    drawRoundRect(rim, tl, Size(half * 2, half * 2), CornerRadius(4.dp.toPx()), style = Stroke(2.dp.toPx()))
                } else {
                    drawCircle(Color.Black.copy(alpha = 0.3f), r, p + Offset(0f, 2.dp.toPx()))
                    drawCircle(fill, r, p)
                    if (look.centre) {
                        // A 3 px double rim: two thin white rings.
                        drawCircle(rim, r - 0.5.dp.toPx(), p, style = Stroke(1.dp.toPx()))
                        drawCircle(rim, r - 2.5.dp.toPx(), p, style = Stroke(1.dp.toPx()))
                    } else {
                        drawCircle(rim, r - 1.dp.toPx(), p, style = Stroke(2.dp.toPx()))
                    }
                }
                val s = if (look.simple) 22.dp.toPx() else 16.dp.toPx()
                translate(p.x - s / 2, p.y - s / 2) { with(icon) { draw(Size(s, s), colorFilter = ColorFilter.tint(ink)) } }
            }
            for (sp in order) {
                val p = toScreen(sp.coordinates.latitude, sp.coordinates.longitude)
                if (p.x < -30 || p.y < -30 || p.x > size.width + 30 || p.y > size.height + 30) continue
                now += sp to p
                val minePin = isMine(sp.coordinates)
                pin(p, sp.isMusollah, spaces.indexOf(sp), if (minePin) star else if (sp.isMusollah) house else moon, sp.id == selected?.id)
            }
            if (mine != null && spaces.none { isMine(it.coordinates) }) pin(toScreen(mine.lat, mine.lng), false, 0, star, false)
            // Names under the pins once close enough to read streets, as Apple Maps does, without overlapping.
            if (z >= 15.0) for ((sp, p) in now.reversed()) {
                val m = measurer.measure(sp.name, nameStyle, maxLines = 1, constraints = androidx.compose.ui.unit.Constraints(maxWidth = 120.dp.roundToPx()))
                val box = androidx.compose.ui.geometry.Rect(p.x - m.size.width / 2f, p.y + 20.dp.toPx(), p.x + m.size.width / 2f, p.y + 20.dp.toPx() + m.size.height)
                if (names.any { it.overlaps(box) }) continue
                names += box
                drawText(m, topLeft = box.topLeft,
                    shadow = androidx.compose.ui.graphics.Shadow(if (dark) Color.Black else Color.White, blurRadius = 4.dp.toPx()))
            }
            placed.clear()
            placed.addAll(now)

            // Ring labels on each ring below its right hand side, lined up like a ruler, drawn over the pins.
            val angle = Math.toRadians(MasjidExtras.RING_LABEL_ANGLE)
            for (km in rings) {
                val trip = MasjidExtras.tripText(km, mode)?.removeSuffix(" walk")?.removeSuffix(" drive")
                val m = measurer.measure(MasjidExtras.ringDistance(km) + (trip?.let { ", $it" } ?: ""), labelStyle)
                val w = m.size.width + 14.dp.toPx()
                val h = m.size.height + 4.dp.toPx()
                val x = me.x + (km * pxPerKm * cos(angle)).toFloat()
                val y = me.y + (km * pxPerKm * sin(angle)).toFloat()
                if (y < 0 || y > size.height || x < 0 || x > size.width) continue
                drawRoundRect(Color.Black.copy(alpha = 0.18f), Offset(x - w / 2, y - h / 2 + 1.dp.toPx()), Size(w, h), CornerRadius(h / 2))
                drawRoundRect(chip, Offset(x - w / 2, y - h / 2), Size(w, h), CornerRadius(h / 2))
                drawRoundRect(ringLine.copy(alpha = 0.5f), Offset(x - w / 2, y - h / 2), Size(w, h), CornerRadius(h / 2), style = Stroke(1.dp.toPx()))
                drawText(m, topLeft = Offset(x - m.size.width / 2f, y - m.size.height / 2f))
            }

            // You: a blue dot with a white rim, a glow that is always there, and one clear ring
            // travelling out. With Reduce motion nothing moves and a still ring stays instead.
            val glowR = 23.dp.toPx() * (if (reduceMotion) 1f else 1f + 0.18f * breathe)
            drawCircle(Brush.radialGradient(0f to glow, 0.6f to glow, 1f to Color.Transparent, center = me, radius = glowR), glowR, me)
            if (reduceMotion) drawCircle(beamRing.copy(alpha = 0.55f), 19.dp.toPx(), me, style = Stroke(2.dp.toPx()))
            else drawCircle(beamRing.copy(alpha = beamRing.alpha * (1 - beam)), (11 + 44 * beam).dp.toPx(), me, style = Stroke(2.dp.toPx()))
            drawCircle(Color.Black.copy(alpha = if (dark) 0.55f else 0.18f), 11.dp.toPx(), me)
            drawCircle(Color.White, 10.dp.toPx(), me)
            drawCircle(you, 7.dp.toPx(), me)

            // OpenStreetMap credit, which its licence asks for.
            val credit = measurer.measure("© OpenStreetMap contributors", attributionStyle)
            val cw = credit.size.width + 8.dp.toPx()
            val ch = credit.size.height + 2.dp.toPx()
            // Bottom right, above the sheet, as Leaflet puts it on the web.
            val foot = size.height - bottomInset.toPx()
            drawRect(Color.White.copy(alpha = 0.75f), Offset(size.width - cw, foot - ch), Size(cw, ch))
            drawText(credit, topLeft = Offset(size.width - cw + 4.dp.toPx(), foot - ch + 1.dp.toPx()))
        }

        if (selected == null) {
            Box(Modifier.align(Alignment.BottomEnd).padding(end = 12.dp, bottom = bottomInset + 22.dp).size(48.dp).clip(CircleShape)
                .clickable(onClickLabel = whereLabel) { camera.show(center, spanFor(mode), animate = true) }
                .semantics { contentDescription = whereLabel },
                contentAlignment = Alignment.Center) {
                Box(Modifier.size(44.dp).clip(CircleShape).background(material), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.NearMe, whereLabel, Modifier.size(22.dp), tint = you)
                }
            }
        }
        selected?.let { Box(Modifier.align(Alignment.BottomCenter).padding(start = 10.dp, end = 10.dp, bottom = bottomInset + 10.dp)) { card(it) } }
    }
}

