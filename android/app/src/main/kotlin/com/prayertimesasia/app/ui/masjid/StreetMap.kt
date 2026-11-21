package com.prayertimesasia.app.ui.masjid

import android.content.Context
import android.graphics.BitmapFactory
import android.util.LruCache
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
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Remove
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
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
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
 * A real street map (OpenStreetMap, as on the website): you in the middle with soft
 * waves beaming out, each place as a dot where it really is, and rings at 1, 2 and 5 km
 * labelled with the walk or drive time. Drag to move, pinch or the buttons to zoom,
 * tap a dot to see its name.
 */
@Composable
internal fun StreetMap(center: Coordinates, spaces: List<PrayerSpace>, selected: String?, mode: TripMode, modifier: Modifier, onSelect: (String) -> Unit) {
    val context = LocalContext.current
    LaunchedEffect(Unit) { OsmTiles.attach(context); OsmTiles.retryFailed() }
    val density = LocalDensity.current.density
    val dark = LocalSkyScheme.current.dark
    val accent = Palette.accent
    val musollah = Prayer.FAJR.tint
    val you = Color(0xFF0A84FF)
    val material = Palette.materialStrong
    val primary = Palette.primary
    var box by remember { mutableStateOf(IntSize.Zero) }

    // Start so the nearest dozen places fit, at least 1 km around you.
    val far = spaces.take(12).maxOfOrNull { it.distanceKm } ?: 2.0
    val fitKm = max(1.2, far * 1.15).coerceAtMost(16.0)
    fun fitZoom(): Double {
        if (box == IntSize.Zero) return 14.0
        val halfDp = minOf(box.width, box.height) / density / 2.0 - 14
        return log2(40_075_016.686 * cos(center.latitude * PI / 180) * halfDp / (fitKm * 1000) / 256.0).coerceIn(3.0, 18.0)
    }
    var zoom by remember(center, box, fitKm) { mutableDoubleStateOf(fitZoom()) }
    var lat by remember(center) { mutableDoubleStateOf(center.latitude) }
    var lng by remember(center) { mutableDoubleStateOf(center.longitude) }
    val moved = hypot(lat - center.latitude, lng - center.longitude) > 1e-5 || kotlin.math.abs(zoom - fitZoom()) > 0.05

    val placed = remember { mutableListOf<Pair<String, Offset>>() }
    val measurer = rememberTextMeasurer()
    val labelStyle = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = you)
    val attributionStyle = TextStyle(fontSize = 9.sp, color = Color(0xFF333333))
    val reduceMotion = LocalSkyScheme.current.reduceMotion
    val beam by rememberInfiniteTransition(label = "beam").animateFloat(
        0f, 1f, infiniteRepeatable(tween(2600, easing = LinearOutSlowInEasing)), label = "beam")
    val tilesVersion by OsmTiles.arrived

    Box(modifier.clip(RoundedCornerShape(Dims.corner)).background(if (dark) Color(0xFF1C2230) else Color(0xFFE9E5DC))
        .onSizeChanged { box = it }
        .semantics { contentDescription = "Street map of masjids and prayer rooms near you. ${spaces.size} places shown." }) {
        Canvas(Modifier.fillMaxSize()
            .pointerInput(center) {
                detectTransformGestures { _, pan, gestureZoom, _ ->
                    val z = zoom
                    val cx = Mercator.x(lng, z) - pan.x / density
                    val cy = Mercator.y(lat, z) - pan.y / density
                    lng = Mercator.lng(cx, z)
                    lat = Mercator.lat(cy, z)
                    zoom = (z + log2(gestureZoom.toDouble())).coerceIn(3.0, 18.5)
                }
            }
            .pointerInput(spaces) {
                detectTapGestures(onDoubleTap = { zoom = (zoom + 1).coerceAtMost(18.5) }) { tap ->
                    placed.minByOrNull { hypot((it.second.x - tap.x).toDouble(), (it.second.y - tap.y).toDouble()) }
                        ?.takeIf { hypot((it.second.x - tap.x).toDouble(), (it.second.y - tap.y).toDouble()) < 28.dp.toPx() }
                        ?.let { onSelect(it.first) }
                }
            }) {
            if (tilesVersion < 0) return@Canvas
            val z = zoom
            val mid = this.center
            val cx = Mercator.x(lng, z)
            val cy = Mercator.y(lat, z)
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
                    val wx = ((tx % n) + n) % n
                    val img = OsmTiles.get(tz, wx, ty) ?: continue
                    val left = ((tx * tileDp - leftWorld) * density)
                    val top = ((ty * tileDp - topWorld) * density)
                    val sizePx = IntSize(tilePx.roundToInt() + 1, tilePx.roundToInt() + 1)
                    drawImage(img, srcOffset = IntOffset.Zero, srcSize = IntSize(img.width, img.height),
                        dstOffset = IntOffset(left.roundToInt(), top.roundToInt()), dstSize = sizePx, colorFilter = filter)
                }
            }

            val me = toScreen(center.latitude, center.longitude)
            val pxPerKm = (1000 / Mercator.metresPerDp(center.latitude, z) * density).toFloat()
            val rings = listOf(1.0, 2.0, 5.0, 10.0).filter { it * pxPerKm < size.maxDimension * 1.2f }
            rings.forEachIndexed { i, km ->
                if (i == 0) drawCircle(you.copy(alpha = 0.08f), (km * pxPerKm).toFloat(), me)
                drawCircle(you.copy(alpha = 0.6f), (km * pxPerKm).toFloat(), me, style = Stroke(1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 7.dp.toPx()))))
            }
            if (!reduceMotion) for (k in 0..1) {
                val p = (beam + k * 0.5f) % 1f
                drawCircle(you.copy(alpha = 0.35f * (1 - p)), 9.dp.toPx() + p * pxPerKm * 0.6f, me)
            }

            val now = mutableListOf<Pair<String, Offset>>()
            // Selected place last, so it sits on top.
            for (s in spaces.sortedBy { it.id == selected }) {
                val p = toScreen(s.coordinates.latitude, s.coordinates.longitude)
                if (p.x < -20 || p.y < -20 || p.x > size.width + 20 || p.y > size.height + 20) continue
                now += s.id to p
                val color = if (s.isMusollah) musollah else accent
                val r = (if (s.id == selected) 9 else 6).dp.toPx()
                drawCircle(Color.Black.copy(alpha = 0.25f), r + 3.dp.toPx(), p + Offset(0f, 1.dp.toPx()))
                drawCircle(Color.White, r + 2.dp.toPx(), p)
                drawCircle(color, r, p)
            }
            placed.clear()
            placed.addAll(now)

            for (km in rings) {
                val trip = MasjidExtras.tripText(km, mode)?.removeSuffix(" walk")?.removeSuffix(" drive")
                val text = "${km.roundToInt()} km" + (trip?.let { ", $it" } ?: "")
                val m = measurer.measure(text, labelStyle)
                val w = m.size.width + 12.dp.toPx()
                val h = m.size.height + 2.dp.toPx()
                val y = me.y + (km * pxPerKm).toFloat()
                if (y + h / 2 > size.height - 18.dp.toPx() || y < 0) continue
                drawRoundRect(material, Offset(me.x - w / 2, y - h / 2), Size(w, h), CornerRadius(h / 2))
                drawText(m, topLeft = Offset(me.x - m.size.width / 2f, y - m.size.height / 2f))
            }
            drawCircle(Color.Black.copy(alpha = 0.25f), 12.dp.toPx(), me + Offset(0f, 1.dp.toPx()))
            drawCircle(Color.White, 10.dp.toPx(), me)
            drawCircle(you, 7.dp.toPx(), me)

            // OpenStreetMap credit, which its licence asks for.
            val credit = measurer.measure("© OpenStreetMap", attributionStyle)
            val cw = credit.size.width + 8.dp.toPx()
            val ch = credit.size.height + 2.dp.toPx()
            drawRect(Color.White.copy(alpha = 0.75f), Offset(size.width - cw, size.height - ch), Size(cw, ch))
            drawText(credit, topLeft = Offset(size.width - cw + 4.dp.toPx(), size.height - ch + 1.dp.toPx()))
        }

        Column(Modifier.align(Alignment.TopEnd).padding(2.dp)) {
            MapButton(Icons.Filled.Add, "Zoom in") { zoom = (zoom + 1).coerceAtMost(18.5) }
            MapButton(Icons.Filled.Remove, "Zoom out") { zoom = (zoom - 1).coerceAtLeast(3.0) }
            if (moved) MapButton(Icons.Filled.MyLocation, "Back to where you are") {
                lat = center.latitude; lng = center.longitude; zoom = fitZoom()
            }
        }
        spaces.firstOrNull { it.id == selected }?.let {
            Text(it.name, style = Txt.captionSemibold, color = primary, maxLines = 1,
                modifier = Modifier.align(Alignment.TopStart).padding(10.dp).clip(CircleShape).background(material).padding(horizontal = 10.dp, vertical = 4.dp))
        }
    }
}

@Composable
private fun MapButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    // 48 dp to tap, 38 dp to see.
    Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClickLabel = label, onClick = onClick), contentAlignment = Alignment.Center) {
        Box(Modifier.size(38.dp).clip(CircleShape).background(Palette.materialStrong), contentAlignment = Alignment.Center) {
            Icon(icon, label, Modifier.size(20.dp), tint = Palette.primary)
        }
    }
}
