package com.prayertimesasia.app.ui.masjid

import android.content.Context
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.animation.core.Animatable
import androidx.compose.material.icons.filled.Brightness2
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.Star
import androidx.compose.runtime.Stable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import com.prayertimesasia.core.MasjidLink
import androidx.compose.animation.core.LinearOutSlowInEasing
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
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
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.MasjidExtras
import com.prayertimesasia.core.Prayer
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
    private val failed = HashSet<String>()
    @OptIn(ExperimentalCoroutinesApi::class)
    private val io = Dispatchers.IO.limitedParallelism(2)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var folder: File? = null

    /** Bumped whenever a tile arrives, so the map draws again. */
    val arrived = mutableIntStateOf(0)

    /** Screenshot tests set this so tiles load before the picture is taken. */
    @Volatile var blocking = false

    /** Where tiles come from; tests can point this somewhere else. */
    var fetch: (z: Int, x: Int, y: Int) -> ByteArray? = { z, x, y -> download(z, x, y) }

    fun attach(context: Context) {
        if (folder == null) folder = File(context.cacheDir, "osm-tiles")
    }

    fun get(z: Int, x: Int, y: Int): ImageBitmap? {
        val key = "$z/$x/$y"
        memory.get(key)?.let { return it }
        if (blocking) return load(key, z, x, y)?.also { memory.put(key, it) }
        synchronized(loading) {
            if (key in loading || key in failed) return null
            loading += key
        }
        scope.launch {
            val bmp = withContext(io) { load(key, z, x, y) }
            synchronized(loading) {
                loading -= key
                if (bmp == null) failed += key
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
            conn.setRequestProperty("User-Agent", "PrayerTimesAsia/1.0 (Android; https://prayertimes.asia)")
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
 * dashed rings at 1, 2 and 5 km labelled with the walk or drive time, you as a blue dot with
 * soft waves beaming out, a button to come back to you, and a card for the tapped pin with
 * its distance, hours, Friday prayers and Directions. Drag to move, pinch or double tap to zoom.
 */
@Composable
internal fun StreetMap(
    center: Coordinates, spaces: List<PrayerSpace>, mine: MasjidLink?, isMine: (Coordinates) -> Boolean,
    selected: PrayerSpace?, mode: TripMode, camera: MapCamera, youLabel: String, modifier: Modifier,
    onSelect: (PrayerSpace?) -> Unit, card: @Composable (PrayerSpace) -> Unit,
) {
    val context = LocalContext.current
    LaunchedEffect(Unit) { OsmTiles.attach(context); OsmTiles.retryFailed() }
    val density = LocalDensity.current.density
    val dark = LocalSkyScheme.current.dark
    val reduceMotion = LocalSkyScheme.current.reduceMotion
    val accent = Palette.accent
    val musollah = Prayer.FAJR.tint
    val you = Color(0xFF0A84FF)
    val material = Palette.materialStrong
    val primary = Palette.primary
    val moon = rememberVectorPainter(Icons.Filled.Brightness2)
    val house = rememberVectorPainter(Icons.Filled.Home)
    val star = rememberVectorPainter(Icons.Filled.Star)

    // Centre on you whenever "you" moves or Walk and Drive switch, as on iPhone.
    LaunchedEffect(center, mode, camera.ready) { if (camera.ready) camera.show(center, spanFor(mode), animate = false) }
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
    val labelStyle = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = you)
    val nameStyle = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (dark) Color.White else Color(0xFF1C1C1E))
    val attributionStyle = TextStyle(fontSize = 9.sp, color = Color(0xFF333333))
    val beam by rememberInfiniteTransition(label = "beam").animateFloat(
        0f, 1f, infiniteRepeatable(tween(2600, easing = LinearOutSlowInEasing)), label = "beam")
    val tilesVersion by OsmTiles.arrived
    val currentSpaces by rememberUpdatedState(spaces)

    Box(modifier.background(if (dark) Color(0xFF1C2230) else Color(0xFFE9E5DC))
        .onSizeChanged {
            camera.widthDp = it.width / density.toDouble(); camera.heightDp = it.height / density.toDouble()
            if (it.width > 0) camera.ready = true
        }
        .semantics { contentDescription = "Map of masjids and prayer rooms near $youLabel. ${spaces.size} places." }) {
        Canvas(Modifier.fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, gestureZoom, _ ->
                    camera.target = null
                    val z = camera.zoom
                    val cx = Mercator.x(camera.lng, z) - pan.x / density
                    val cy = Mercator.y(camera.lat, z) - pan.y / density
                    camera.lng = Mercator.lng(cx, z)
                    camera.lat = Mercator.lat(cy, z)
                    camera.zoom = (z + log2(gestureZoom.toDouble())).coerceIn(3.0, 18.5)
                }
            }
            .pointerInput(Unit) {
                detectTapGestures(onDoubleTap = { camera.target = Triple(camera.lat, camera.lng, (camera.zoom + 1).coerceAtMost(18.5)) }) { tap ->
                    // A pin's tip is its place; its head sits 24 dp above, which is what people tap.
                    val hit = placed.minByOrNull { hypot((it.second.x - tap.x).toDouble(), (it.second.y - 24.dp.toPx() - tap.y).toDouble()) }
                        ?.takeIf { hypot((it.second.x - tap.x).toDouble(), (it.second.y - 24.dp.toPx() - tap.y).toDouble()) < 26.dp.toPx() }
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

            // Rings at 1, 2 and 5 km, the first one softly filled.
            val me = toScreen(center.latitude, center.longitude)
            val pxPerKm = (1000 / Mercator.metresPerDp(center.latitude, z) * density).toFloat()
            for (km in RINGS_KM) {
                if (km == RINGS_KM.first()) drawCircle(you.copy(alpha = 0.07f), (km * pxPerKm).toFloat(), me)
                drawCircle(you.copy(alpha = 0.55f), (km * pxPerKm).toFloat(), me, style = Stroke(1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 7.dp.toPx()))))
            }

            // Pins, nearest drawn last so it sits on top; the tapped one last of all.
            val now = mutableListOf<Pair<PrayerSpace, Offset>>()
            val names = mutableListOf<androidx.compose.ui.geometry.Rect>()
            val order = spaces.reversed().sortedBy { it.id == selected?.id }
            fun pin(p: Offset, color: Color, icon: androidx.compose.ui.graphics.vector.VectorPainter, big: Boolean) {
                val r = (if (big) 15 else 12).dp.toPx()
                val head = Offset(p.x, p.y - r - 8.dp.toPx())
                drawCircle(Color.Black.copy(alpha = 0.22f), r + 1.dp.toPx(), head + Offset(0f, 1.5.dp.toPx()))
                val tail = Path().apply {
                    moveTo(p.x, p.y); lineTo(p.x - r * 0.55f, head.y + r * 0.6f); lineTo(p.x + r * 0.55f, head.y + r * 0.6f); close()
                }
                drawPath(tail, Color.White)
                drawCircle(Color.White, r + 1.5.dp.toPx(), head)
                drawCircle(color, r, head)
                val s = r * 1.15f
                translate(head.x - s / 2, head.y - s / 2) { with(icon) { draw(Size(s, s), colorFilter = ColorFilter.tint(Color.White)) } }
            }
            for (sp in order) {
                val p = toScreen(sp.coordinates.latitude, sp.coordinates.longitude)
                if (p.x < -30 || p.y < -10 || p.x > size.width + 30 || p.y > size.height + 50) continue
                now += sp to p
                val minePin = isMine(sp.coordinates)
                pin(p, if (sp.isMusollah) musollah else accent, if (minePin) star else if (sp.isMusollah) house else moon, sp.id == selected?.id)
            }
            if (mine != null && spaces.none { isMine(it.coordinates) }) pin(toScreen(mine.lat, mine.lng), accent, star, false)
            // Names under the pins once close enough to read streets, as Apple Maps does, without overlapping.
            if (z >= 15.0) for ((sp, p) in now.reversed()) {
                val m = measurer.measure(sp.name, nameStyle, maxLines = 1, constraints = androidx.compose.ui.unit.Constraints(maxWidth = 120.dp.roundToPx()))
                val box = androidx.compose.ui.geometry.Rect(p.x - m.size.width / 2f, p.y + 2.dp.toPx(), p.x + m.size.width / 2f, p.y + 2.dp.toPx() + m.size.height)
                if (names.any { it.overlaps(box) }) continue
                names += box
                drawText(m, topLeft = box.topLeft,
                    shadow = androidx.compose.ui.graphics.Shadow(if (dark) Color.Black else Color.White, blurRadius = 4.dp.toPx()))
            }
            placed.clear()
            placed.addAll(now)

            // Ring labels at the bottom of each ring.
            for (km in RINGS_KM) {
                val trip = MasjidExtras.tripText(km, mode)?.removeSuffix(" walk")?.removeSuffix(" drive")
                val m = measurer.measure("${km.roundToInt()} km" + (trip?.let { ", $it" } ?: ""), labelStyle)
                val w = m.size.width + 14.dp.toPx()
                val h = m.size.height + 4.dp.toPx()
                val y = me.y + (km * pxPerKm).toFloat()
                if (y < 0 || y > size.height) continue
                drawRoundRect(material, Offset(me.x - w / 2, y - h / 2), Size(w, h), CornerRadius(h / 2))
                drawRoundRect(you.copy(alpha = 0.35f), Offset(me.x - w / 2, y - h / 2), Size(w, h), CornerRadius(h / 2), style = Stroke(1.dp.toPx()))
                drawText(m, topLeft = Offset(me.x - m.size.width / 2f, y - m.size.height / 2f))
            }

            // You: a blue dot with a white ring and soft waves beaming out.
            if (reduceMotion) drawCircle(you.copy(alpha = 0.2f), 24.dp.toPx(), me)
            else for (k in 0..1) {
                val p = (beam + k * 0.5f) % 1f
                drawCircle(you.copy(alpha = 0.4f * (1 - p)), 9.dp.toPx() * (1 + p * 8), me)
            }
            drawCircle(you.copy(alpha = 0.35f), 13.dp.toPx(), me)
            drawCircle(Color.White, 10.5.dp.toPx(), me)
            drawCircle(you, 7.5.dp.toPx(), me)

            // OpenStreetMap credit, which its licence asks for.
            val credit = measurer.measure("© OpenStreetMap", attributionStyle)
            val cw = credit.size.width + 8.dp.toPx()
            val ch = credit.size.height + 2.dp.toPx()
            drawRect(Color.White.copy(alpha = 0.75f), Offset(0f, size.height - ch), Size(cw, ch))
            drawText(credit, topLeft = Offset(4.dp.toPx(), size.height - ch + 1.dp.toPx()))
        }

        if (selected == null) {
            Box(Modifier.align(Alignment.TopEnd).padding(12.dp).size(48.dp).clip(CircleShape)
                .clickable(onClickLabel = "Show where I am") { camera.show(center, spanFor(mode), animate = true) },
                contentAlignment = Alignment.Center) {
                Box(Modifier.size(44.dp).clip(CircleShape).background(material), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.NearMe, "Show where I am", Modifier.size(22.dp), tint = you)
                }
            }
        }
        selected?.let { Box(Modifier.align(Alignment.BottomCenter).padding(10.dp)) { card(it) } }
    }
}

internal val RINGS_KM = listOf(1.0, 2.0, 5.0)
