package com.prayertimesasia.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import com.prayertimesasia.app.MainActivity
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.word
import com.prayertimesasia.app.ui.theme.BandsPalette
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerLead
import com.prayertimesasia.core.TodayStyle
import java.time.Instant
import java.time.format.TextStyle
import java.util.Locale

// The newer Home Screen widgets: Now and Next, Current Prayer, Day bar and the Hijri Calendar.
// Each follows the look chosen on the Prayer screen, in Light and Dark, like the iPhone's.

// MARK: Shared helpers

/** Today's times in order, then tomorrow's Subuh (where Isyak ends). */
internal fun WidgetModel.timeline(): List<Pair<Prayer, Instant>> =
    day.ordered + listOfNotNull(tomorrowFajr?.let { Prayer.FAJR to it })

/** When the prayer that starts at [start] ends: the next time on the list. Subuh ends at Syuruk. */
internal fun WidgetModel.endAfter(start: Instant): Instant? = timeline().firstOrNull { it.second > start }?.second

/** An obligatory prayer whose time has closed (never Syuruk, never the one open now). */
internal fun WidgetModel.isDone(p: Prayer): Boolean {
    if (p == Prayer.SUNRISE) return false
    val end = endAfter(day.time(p)) ?: return false
    return end <= now
}

private fun Context.range(m: WidgetModel, from: Instant, to: Instant) =
    word(R.string.widget_range, "from" to m.format(from), "to" to m.format(to))

/** A line with a live timer inside it: "in 1:34:12", "1:34:12 left". */
@Composable
internal fun TimedLine(context: Context, @StringRes id: Int, until: Instant, color: Color, size: Int = 11) {
    val line = context.word(id, "time" to "\u0001")
    val before = line.substringBefore('\u0001')
    val after = line.substringAfter('\u0001', "")
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (before.isNotEmpty()) Text(before, style = st(size, FontWeight.Medium, color), maxLines = 1)
        Countdown(context, until, color)
        if (after.isNotEmpty()) Text(after, style = st(size, FontWeight.Medium, color), maxLines = 1)
    }
}

private fun baseModifier(): GlanceModifier =
    GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(22.dp).clickable(actionStartActivity<MainActivity>())

/** The widget's backdrop: the prayer's colour in Colour Bands (when asked), else the look's own sky. */
private fun backdrop(m: WidgetModel, bandsPrayer: Prayer?): GlanceModifier =
    if (m.style == TodayStyle.BANDS && bandsPrayer != null) baseModifier().background(BandsPalette.color(bandsPrayer))
    else baseModifier().background(ImageProvider(skyBitmap(m)), ContentScale.FillBounds)

private fun accentFor(m: WidgetModel, p: Prayer, pal: WPal): Color = if (m.style == TodayStyle.GOLD) pal.acc else p.tint

/** A progress line: a faint track and the filled part. */
internal fun progressBitmap(done: Float, fill: Color, track: Color, w: Int = 400, h: Int = 20): Bitmap {
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = track.toArgb()
    c.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), h / 2f, h / 2f, p)
    p.color = fill.toArgb()
    c.drawRoundRect(RectF(0f, 0f, (w * done.coerceIn(0.02f, 1f)), h.toFloat()), h / 2f, h / 2f, p)
    return bmp
}

// MARK: Now and Next

class NowNextWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Single
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { NowNextContent(context) }
    }
}

class NowNextWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NowNextWidget()
}

private data class Half(val label: String, val prayer: Prayer, val name: String, val detail: @Composable () -> Unit)

@Composable
internal fun NowNextContent(context: Context) {
    val m = model(context) ?: return Empty()
    val next = m.next ?: return Empty()
    val pal = widgetPal(m.style, m.dark)
    val open = PrayerLead.open(m.current)
    val after = m.timeline().firstOrNull { it.second > next.second }
    val top: Half
    val bottom: Half
    if (open != null) {
        top = Half(context.word(R.string.today_now), open.first, m.names.getValue(open.first)) {
            Text(context.word(R.string.widget_untilTime, "time" to m.format(next.second)), style = st(11, FontWeight.Medium, if (m.style == TodayStyle.BANDS) Color.White else pal.fg2), maxLines = 1)
        }
        bottom = Half(context.word(R.string.today_next), next.first, m.names.getValue(next.first)) {
            TimedLine(context, R.string.today_in, next.second, if (m.style == TodayStyle.BANDS) Color.White else pal.fg2)
        }
    } else {
        if (after == null) return Empty()
        top = Half(context.word(R.string.today_next), next.first, m.names.getValue(next.first)) {
            TimedLine(context, R.string.today_in, next.second, if (m.style == TodayStyle.BANDS) Color.White else pal.fg2)
        }
        bottom = Half(context.word(R.string.widget_then), after.first, m.names.getValue(after.first)) {
            Text(m.format(after.second), style = st(11, FontWeight.Medium, if (m.style == TodayStyle.BANDS) Color.White else pal.fg2), maxLines = 1)
        }
    }
    val bands = m.style == TodayStyle.BANDS
    val simple = m.style == TodayStyle.SIMPLE
    Column(backdrop(m, null)) {
        listOf(top, bottom).forEachIndexed { i, h ->
            if (i == 1 && !bands) Box(GlanceModifier.fillMaxWidth().height(1.dp).padding(horizontal = 14.dp).background(pal.fg2.copy(alpha = 0.35f))) {}
            Column(
                GlanceModifier.fillMaxWidth().defaultWeight().padding(horizontal = 14.dp)
                    .let { if (bands) it.background(BandsPalette.color(h.prayer)) else it },
                horizontalAlignment = if (simple) Alignment.CenterHorizontally else Alignment.Start,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(h.label, style = st(10, FontWeight.Medium, if (bands) Color.White.copy(alpha = 0.9f) else pal.fg2), maxLines = 1)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (!bands && m.style != TodayStyle.GOLD) {
                        Box(GlanceModifier.width(3.dp).height(20.dp).cornerRadius(2.dp).background(h.prayer.tint)) {}
                        Spacer(GlanceModifier.width(7.dp))
                    }
                    Text(
                        h.name,
                        style = st(if (simple) 26 else 22, FontWeight.Bold,
                            if (bands) Color.White else if (simple) pal.hero else if (m.style == TodayStyle.GOLD && i == 1) pal.acc else pal.fg),
                        maxLines = 1,
                    )
                }
                h.detail()
            }
        }
    }
}

// MARK: Current Prayer

class CurrentPrayerWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Single
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { CurrentPrayerContent(context) }
    }
}

class CurrentPrayerWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CurrentPrayerWidget()
}

/** The prayer you are in with its time range, a progress line and what is left. From Syuruk to Zohor, the coming prayer. */
@Composable
internal fun CurrentPrayerContent(context: Context) {
    val m = model(context) ?: return Empty()
    val lead = m.lead ?: return Empty()
    val end = m.endAfter(lead.time) ?: return Empty()
    val pal = widgetPal(m.style, m.dark)
    val bands = m.style == TodayStyle.BANDS
    val simple = m.style == TodayStyle.SIMPLE
    val ink = if (bands) Color.White else pal.fg
    val soft = if (bands) Color.White.copy(alpha = 0.9f) else pal.fg2
    val span = (end.epochSecond - lead.time.epochSecond).coerceAtLeast(1)
    val done = if (lead.isNext) 0f else ((m.now.epochSecond - lead.time.epochSecond).toFloat() / span).coerceIn(0f, 1f)
    Column(
        backdrop(m, lead.prayer).padding(14.dp),
        horizontalAlignment = if (simple) Alignment.CenterHorizontally else Alignment.Start,
    ) {
        Text(context.word(if (lead.isNext) R.string.today_next else R.string.today_now), style = st(10, FontWeight.Medium, soft), maxLines = 1)
        Spacer(GlanceModifier.defaultWeight())
        Text(m.names.getValue(lead.prayer), style = st(if (simple) 36 else 30, FontWeight.Bold, if (simple) pal.hero else ink), maxLines = 1)
        Text(context.range(m, lead.time, end), style = st(12, FontWeight.Medium, soft), maxLines = 1)
        Spacer(GlanceModifier.defaultWeight())
        Image(
            ImageProvider(progressBitmap(done, if (bands) Color.White else accentFor(m, lead.prayer, pal), soft.copy(alpha = 0.35f))),
            null, GlanceModifier.fillMaxWidth().height(if (m.style == TodayStyle.GOLD) 3.dp else 5.dp), contentScale = ContentScale.FillBounds,
        )
        Spacer(GlanceModifier.height(5.dp))
        if (lead.isNext) TimedLine(context, R.string.today_in, lead.time, soft) else TimedLine(context, R.string.widget_timeLeft, end, soft)
    }
}

// MARK: Day bar

class DayBarWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Single
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { DayBarContent(context) }
    }
}

class DayBarWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = DayBarWidget()
}

private val FIVE = listOf(Prayer.FAJR, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

/** Today's five prayers on a line (Colour Bands: coloured stretches), prayers that are over filled in, a marker for now. */
internal fun dayBarBitmap(m: WidgetModel, w: Int, h: Int): Bitmap {
    val pal = widgetPal(m.style, m.dark)
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val first = m.day.time(Prayer.FAJR).epochSecond.toDouble()
    val last = m.day.time(Prayer.ISHA).epochSecond.toDouble()
    fun x(t: Instant) = (((t.epochSecond - first) / (last - first)).coerceIn(0.0, 1.0) * w).toFloat()
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    val mid = h / 2f
    if (m.style == TodayStyle.BANDS) {
        val bar = RectF(0f, mid - h * 0.32f, w.toFloat(), mid + h * 0.32f)
        val clip = android.graphics.Path().apply { addRoundRect(bar, h * 0.12f, h * 0.12f, android.graphics.Path.Direction.CW) }
        c.save()
        c.clipPath(clip)
        val all = Prayer.all
        FIVE.forEach { pr ->
            val a = x(m.day.time(pr))
            val i = all.indexOf(pr)
            val b = if (pr == Prayer.ISHA) w.toFloat() else x(m.day.time(all[i + 1]))
            p.color = BandsPalette.color(pr).let { if (b <= x(m.now)) it.copy(alpha = 0.5f) else it }.toArgb()
            c.drawRect(a, bar.top, b, bar.bottom, p)
        }
        c.restore()
        p.color = pal.fg.toArgb()
        val nx = x(m.now)
        c.drawRect(nx - 3f, mid - h * 0.42f, nx + 3f, mid + h * 0.42f, p)
        return bmp
    }
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = h * 0.12f; strokeCap = Paint.Cap.ROUND }
    line.color = pal.fg2.copy(alpha = 0.3f).toArgb()
    val pad = h * 0.3f
    c.drawLine(pad, mid, w - pad, mid, line)
    line.color = (if (m.style == TodayStyle.GOLD) pal.acc else androidx.compose.ui.graphics.Color(0.91f, 0.50f, 0.25f)).toArgb()
    c.drawLine(pad, mid, maxOf(pad, x(m.now)).coerceAtMost(w - pad), mid, line)
    val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = h * 0.09f }
    FIVE.forEach { pr ->
        val colour = (if (m.style == TodayStyle.GOLD) pal.acc else pr.tint).toArgb()
        val cx = x(m.day.time(pr)).coerceIn(pad, w - pad)
        if (m.day.time(pr) <= m.now) { p.color = colour; c.drawCircle(cx, mid, h * 0.3f, p) }
        ring.color = colour
        c.drawCircle(cx, mid, h * 0.3f, ring)
    }
    return bmp
}

@Composable
internal fun DayBarContent(context: Context) {
    val m = model(context) ?: return Empty()
    val pal = widgetPal(m.style, m.dark)
    val hit = m.lead?.prayer
    Column(backdrop(m, null).padding(horizontal = 16.dp, vertical = 12.dp)) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(context.word(R.string.widget_today), style = st(14, FontWeight.Bold, pal.fg), maxLines = 1, modifier = GlanceModifier.defaultWeight())
            m.next?.let { n ->
                Text(m.names.getValue(n.first) + " ", style = st(12, FontWeight.Medium, pal.fg2), maxLines = 1)
                TimedLine(context, R.string.today_in, n.second, pal.fg2, 12)
            }
        }
        Spacer(GlanceModifier.defaultWeight())
        Image(ImageProvider(dayBarBitmap(m, 640, 56)), null, GlanceModifier.fillMaxWidth().height(28.dp), contentScale = ContentScale.FillBounds)
        Spacer(GlanceModifier.height(6.dp))
        Row(GlanceModifier.fillMaxWidth()) {
            FIVE.forEach { p ->
                val t = m.times.getValue(p).first
                Column(GlanceModifier.defaultWeight(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(m.names.getValue(p), style = st(11, if (hit == p) FontWeight.Bold else FontWeight.Medium, pal.fg), maxLines = 1)
                    Text(t, style = st(11, if (hit == p) FontWeight.Bold else FontWeight.Normal, pal.fg2), maxLines = 1)
                }
            }
        }
        Spacer(GlanceModifier.defaultWeight())
    }
}

// MARK: Hijri Calendar

class HijriCalendarWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(DpSize(250.dp, 250.dp), DpSize(250.dp, 330.dp)))
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { HijriCalendarContent(context) }
    }
}

class HijriCalendarWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = HijriCalendarWidget()
}

@Composable
internal fun HijriCalendarContent(context: Context) {
    val m = model(context) ?: return Empty()
    val hijriOf = m.hijriOf ?: return Empty()
    val grid = HijriGrid.of(m.now.atZone(m.zone).toLocalDate(), hijriOf)
    val pal = widgetPal(m.style, m.dark)
    val bands = m.style == TodayStyle.BANDS
    val gold = m.style == TodayStyle.GOLD
    val simple = m.style == TodayStyle.SIMPLE
    val accent = if (bands) BandsPalette.color(Prayer.ASR) else if (gold) pal.acc else Prayer.ASR.tint
    val eid = if (bands) BandsPalette.color(Prayer.FAJR) else accent
    val onAccent = if (gold && m.dark) Color(0xFF0B0F2A) else Color.White
    val locale = context.resources.configuration.locales[0] ?: Locale.ENGLISH
    val size = LocalSize.current
    val rows = (grid.lead + grid.cells.size + (if (grid.eidAfter != null) 1 else 0) + 6) / 7
    val cellH = ((size.height.value - 124f) / rows - 3f).coerceIn(24f, 46f)
    val monthName = m.hijriMonths.getOrNull(grid.month - 1) ?: ""
    Column(
        backdrop(m, null).padding(horizontal = 14.dp, vertical = 14.dp),
        horizontalAlignment = if (simple) Alignment.CenterHorizontally else Alignment.Start,
    ) {
        Text(context.word(R.string.widget_hijriExpected), style = st(12, FontWeight.Normal, pal.fg2), maxLines = 1)
        Text("$monthName ${grid.year}", style = st(if (simple) 28 else 24, FontWeight.Bold, pal.fg), maxLines = 1)
        Spacer(GlanceModifier.height(4.dp))
        Row(GlanceModifier.fillMaxWidth()) {
            // Sunday first, like the grid.
            java.time.DayOfWeek.values().let { d -> listOf(d[6]) + d.take(6) }.forEach { dow ->
                Box(GlanceModifier.defaultWeight(), contentAlignment = Alignment.Center) {
                    Text(dow.getDisplayName(TextStyle.SHORT, locale), style = st(10, FontWeight.Normal, pal.fg2), maxLines = 1)
                }
            }
        }
        Spacer(GlanceModifier.height(3.dp))
        val slots: List<Int?> = List(grid.lead) { null } + grid.cells.indices.map { it }
        val total = slots.size + (if (grid.eidAfter != null) 1 else 0)
        (0 until rows).forEach { r ->
            Row(GlanceModifier.fillMaxWidth().padding(bottom = 3.dp)) {
                (0 until 7).forEach { c ->
                    val i = r * 7 + c
                    val cellMod = GlanceModifier.defaultWeight().height(cellH.dp).padding(horizontal = 1.dp)
                    when {
                        i < slots.size && slots[i] != null -> {
                            val cell = grid.cells[slots[i]!!]
                            val filled = cell.isToday || cell.mark == HijriGrid.Mark.EID
                            val text = if (filled) onAccent else pal.fg
                            val fill = if (cell.isToday) accent else if (cell.mark == HijriGrid.Mark.EID) eid else Color.Transparent
                            val mod = cellMod.cornerRadius(8.dp).background(
                                if (!filled && cell.mark == HijriGrid.Mark.LAST_TEN) pal.fg2.copy(alpha = 0.16f) else fill,
                            )
                            Box(mod, contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        "${cell.day}" + if (cell.mark == HijriGrid.Mark.NUZUL) " •" else "",
                                        style = st(if (simple) 16 else 14, if (cell.isToday) FontWeight.Bold else FontWeight.Medium, text), maxLines = 1,
                                    )
                                    Text("${cell.gregorianDay}", style = st(8, FontWeight.Normal, text.copy(alpha = 0.7f)), maxLines = 1)
                                }
                            }
                        }
                        grid.eidAfter != null && i == slots.size && i < total -> Box(cellMod.cornerRadius(8.dp).background(eid), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(context.word(R.string.widget_eid), style = st(10, FontWeight.Bold, Color.White), maxLines = 1)
                                Text("1", style = st(8, FontWeight.Normal, Color.White.copy(alpha = 0.8f)), maxLines = 1)
                            }
                        }
                        else -> Box(cellMod) {}
                    }
                }
            }
        }
        Spacer(GlanceModifier.defaultWeight())
        if (grid.daysToRamadan != null) {
            val n = grid.daysToRamadan
            Text(context.word(if (n == 1) R.string.widget_ramadanIn_one else R.string.widget_ramadanIn, "n" to n), style = st(11, FontWeight.Bold, pal.acc), maxLines = 1)
        } else {
            Text(
                "• ${context.word(R.string.widget_nuzul)}   □ ${context.word(R.string.widget_lastTen)}   ● ${context.word(R.string.widget_eid)}",
                style = st(10, FontWeight.Normal, pal.fg2), maxLines = 1,
            )
        }
    }
}
