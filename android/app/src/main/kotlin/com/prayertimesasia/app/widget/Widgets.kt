package com.prayertimesasia.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.prayertimesasia.app.MainActivity
import com.prayertimesasia.app.PrayerApp
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.theme.BandsPalette
import com.prayertimesasia.app.ui.theme.SkyColors
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.secondsSince
import java.time.Instant

object WidgetUpdater {
    suspend fun updateAll(context: Context) {
        runCatching { NextPrayerWidget().updateAll(context) }
        runCatching { TimetableWidget().updateAll(context) }
        runCatching { NowNextWidget().updateAll(context) }
        runCatching { CurrentPrayerWidget().updateAll(context) }
        runCatching { DayBarWidget().updateAll(context) }
        runCatching { HijriCalendarWidget().updateAll(context) }
    }
}

internal fun st(size: Int, weight: FontWeight = FontWeight.Normal, color: Color = Color.White) =
    TextStyle(color = ColorProvider(color), fontSize = size.sp, fontWeight = weight)

/** Tests only: draw the widgets from this demo state (and its fixed clock) instead of the app's. */
internal var widgetTestState: com.prayertimesasia.app.AppState? = null

internal fun model(context: Context, style: TodayStyle? = null): WidgetModel? {
    val state = widgetTestState ?: (context.applicationContext as? PrayerApp)?.state ?: return null
    // widgetResolver() still finds a place when the process was just started (a resize, a reboot)
    // and GPS has not answered yet, so the widget never flashes "set your location" by mistake.
    val r = state.widgetResolver()
    val dark = when (r.prefs.appearance) {
        com.prayertimesasia.core.Appearance.DARK -> true
        com.prayertimesasia.core.Appearance.LIGHT -> false
        else -> (context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES
    }
    return runCatching { WidgetModel.from(r, state.fixedNow ?: Instant.now(), style ?: r.prefs.todayStyle, dark) }.getOrNull()
}

/** The look's backdrop as a small bitmap the launcher stretches (a smooth gradient, or one flat colour for Colour Bands). */
internal fun skyBitmap(m: WidgetModel): Bitmap {
    val (top, bottom) = backdropColors(m)
    val w = 96
    val h = 160
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), top.toArgb(), bottom.toArgb(), Shader.TileMode.CLAMP)
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
    if (m.style != TodayStyle.BANDS && m.style != TodayStyle.GOLD) {
        val sky = SkyColors.at(m.now, m.day)
        p.shader = RadialGradient(w / 2f, h * 1.1f, h * 0.75f, sky.glow.color.copy(alpha = if (m.dark) 0.2f else 0.12f).toArgb(), 0, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
    }
    return bmp
}

/** The ring: each prayer's period in its colour and a dot for now (Centre Dial), or Calm Gold's one thin gold line. */
internal fun dialBitmap(m: WidgetModel, px: Int): Bitmap {
    val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val pal = widgetPal(m.style, m.dark)
    val midnight = m.day.date.atStartOfDay(m.zone).toInstant()
    fun angle(t: Instant) = (t.secondsSince(midnight) / 86_400 * 360 + 180).toFloat()
    val gold = m.style == TodayStyle.GOLD
    val ring = if (gold) px * 0.02f else px * 0.09f
    val r = px / 2f - (if (gold) px * 0.04f else ring * 0.7f)
    val oval = RectF(px / 2f - r, px / 2f - r, px / 2f + r, px / 2f + r)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = ring }
    val a = Math.toRadians((angle(m.now) - 90).toDouble())
    val x = px / 2f + (Math.cos(a) * r).toFloat()
    val y = px / 2f + (Math.sin(a) * r).toFloat()
    if (gold) {
        paint.color = pal.acc.copy(alpha = 0.35f).toArgb()
        c.drawArc(oval, 0f, 360f, false, paint)
        paint.color = pal.acc.toArgb()
        c.drawArc(oval, 90f, angle(m.now) - 180f, false, paint)
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = pal.acc.toArgb() }
        c.drawCircle(x, y, px * 0.035f, fill)
        return bmp
    }
    paint.color = pal.fg.copy(alpha = 0.12f).toArgb()
    c.drawArc(oval, 0f, 360f, false, paint)
    Prayer.all.forEachIndexed { i, p ->
        val start = angle(m.day.time(p))
        val end = if (i + 1 < Prayer.all.size) angle(m.day.time(Prayer.all[i + 1])) else angle(m.day.time(Prayer.FAJR)) + 360
        paint.color = p.tint.toArgb()
        c.drawArc(oval, start + 1.2f - 90f, end - start - 2.4f, false, paint)
    }
    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE }
    c.drawCircle(x, y, ring * 0.62f, fill)
    fill.style = Paint.Style.STROKE
    fill.strokeWidth = ring * 0.25f
    fill.color = pal.acc.toArgb()
    c.drawCircle(x, y, ring * 0.62f, fill)
    return bmp
}

/** The sun's arc across the day with a dot at each prayer and one for now (the Sun Path look). */
internal fun sunPathBitmap(m: WidgetModel, w: Int, h: Int): Bitmap {
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val pal = widgetPal(m.style, m.dark)
    val sun = Color(0.85f, 0.45f, 0.18f)
    val midnight = m.day.date.atStartOfDay(m.zone).toInstant()
    fun frac(t: Instant) = (t.secondsSince(midnight) / 86_400.0).coerceIn(0.0, 1.0)
    fun yAt(f: Double) = (h * 0.6 - h * 0.5 * -Math.cos(2 * Math.PI * f)).toFloat()
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = h * 0.035f; strokeCap = Paint.Cap.ROUND }
    val nowF = frac(m.now)
    for (pass in 0..1) {
        val path = android.graphics.Path()
        val to = if (pass == 0) 1.0 else nowF
        var f = 0.0
        path.moveTo(0f, yAt(0.0))
        while (f < to) { f = minOf(to, f + 0.005); path.lineTo((f * w).toFloat(), yAt(f)) }
        line.color = if (pass == 0) pal.fg.copy(alpha = 0.3f).toArgb() else sun.toArgb()
        c.drawPath(path, line)
    }
    val dot = Paint(Paint.ANTI_ALIAS_FLAG)
    Prayer.all.forEach { p ->
        val f = frac(m.day.time(p))
        dot.color = pal.fg.toArgb()
        c.drawCircle((f * w).toFloat(), yAt(f), h * 0.05f, dot)
        dot.color = p.tint.toArgb()
        c.drawCircle((f * w).toFloat(), yAt(f), h * 0.03f, dot)
    }
    // Little surprise: at night (before sunrise, from Maghrib) the marker is a crescent, not the sun.
    val night = m.surprises && (m.now < m.day.time(Prayer.SUNRISE) || m.now >= m.day.time(Prayer.MAGHRIB))
    val nx = (nowF * w).toFloat(); val ny = yAt(nowF)
    if (night) {
        val r = h * 0.085f
        val moon = android.graphics.Path().apply { addCircle(nx, ny, r, android.graphics.Path.Direction.CW) }
        val bite = android.graphics.Path().apply { addCircle(nx + r * 0.45f, ny - r * 0.2f, r * 0.85f, android.graphics.Path.Direction.CW) }
        moon.op(bite, android.graphics.Path.Op.DIFFERENCE)
        dot.color = Color(0.97f, 0.86f, 0.55f).toArgb()
        c.drawPath(moon, dot)
    } else {
        dot.color = Color(0.97f, 0.74f, 0.56f).toArgb()
        c.drawCircle(nx, ny, h * 0.085f, dot)
        dot.color = android.graphics.Color.WHITE
        c.drawCircle(nx, ny, h * 0.05f, dot)
    }
    return bmp
}

/** A live countdown the launcher ticks by itself (a RemoteViews Chronometer). */
@Composable
internal fun Countdown(context: Context, to: Instant, color: Color, big: Boolean = false) {
    val rv = RemoteViews(context.packageName, if (big) R.layout.widget_countdown_big else R.layout.widget_countdown)
    val millis = (to.toEpochMilli() - System.currentTimeMillis()).coerceAtLeast(0)
    rv.setChronometer(R.id.countdown, SystemClock.elapsedRealtime() + millis, null, true)
    rv.setChronometerCountDown(R.id.countdown, true)
    rv.setTextColor(R.id.countdown, color.toArgb())
    AndroidRemoteViews(rv)
}

/** "in 1:23:45" (or "Subuh in 7:12:03") beside a row's name. */
@Composable
private fun RowCountdown(context: Context, m: WidgetModel, label: String, color: Color) {
    val next = m.next ?: return
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = st(12, FontWeight.Medium, color), maxLines = 1)
        Countdown(context, next.second, color)
    }
}

/** Only when the phone truly knows no place yet. Still a proper card, and a tap opens the app. */
@Composable
internal fun Empty() {
    val night = SkyColors.night.readable
    Box(
        GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(22.dp)
            .background(ImageProvider(Bitmap.createBitmap(intArrayOf(night.top.color.toArgb(), night.bottom.color.toArgb()), 1, 2, Bitmap.Config.ARGB_8888)), ContentScale.FillBounds)
            .padding(14.dp).clickable(actionStartActivity<MainActivity>()),
        contentAlignment = Alignment.Center,
    ) {
        Text("Tap to open Prayer Times Asia and choose where you are.", style = st(13, FontWeight.Medium))
    }
}

// MARK: Next prayer (small and medium)

class NextPrayerWidget : GlanceAppWidget() {
    // Small, medium (wide) and large. Responsive means the launcher swaps between these layouts by itself
    // while the widget is dragged bigger or smaller, so a resize never waits on the app.
    override val sizeMode = SizeMode.Responsive(setOf(DpSize(110.dp, 110.dp), DpSize(250.dp, 110.dp), DpSize(250.dp, 250.dp)))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { NextPrayerContent(context) }
    }
}

@Composable
internal fun NextPrayerContent(context: Context) {
    val m = model(context) ?: return Empty()
    val next = m.next ?: return Empty()
    val size = LocalSize.current
    // Large is the whole day in the Prayer screen's own look, as on the iPhone.
    if (size.width >= 240.dp && size.height >= 240.dp) return TimetableBody(context, m, size)
    val wide = size.width >= 240.dp
    val pal = widgetPal(m.style, m.dark)
    val bands = m.style == TodayStyle.BANDS
    val base = GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(22.dp).clickable(actionStartActivity<MainActivity>())
    // Colour Bands paints the small card in the colour of the prayer that is coming; every other look has its own backdrop.
    val back = if (bands && !wide) base.background(BandsPalette.color(next.first))
    else base.background(ImageProvider(skyBitmap(m)), ContentScale.FillBounds)
    Box(back) {
        if (wide) {
            Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                Box(GlanceModifier.width(112.dp).fillMaxHeight().let { if (bands) it.background(BandsPalette.color(next.first)) else it }) {
                    HeadlineFace(context, m, pal, next, size, medium = true)
                }
                PrayerRows(context, m, pal, { it }, GlanceModifier.defaultWeight().fillMaxHeight().padding(if (bands) 0.dp else 8.dp), compact = true)
            }
        } else {
            HeadlineFace(context, m, pal, next, size, medium = false)
        }
    }
}

/**
 * The prayer, when, and how long until, in the look: a ring (Centre Dial, Calm Gold), a coloured block
 * (Colour Bands), a big violet name (Big and Simple) or the sun's arc (Sun Path). Ramadan counts down
 * to Berbuka by day and Imsak at night, with the next prayer as a small line when it is a different moment.
 */
@Composable
private fun HeadlineFace(context: Context, m: WidgetModel, pal: WPal, next: Pair<Prayer, Instant>, size: DpSize, medium: Boolean) {
    val fast = m.fast
    val title = fast?.label ?: (m.nextName ?: "")
    val time = fast?.time ?: (m.nextTime ?: "")
    val target = fast?.at ?: next.second
    val nextLine = if (fast != null && kotlin.math.abs(next.second.epochSecond - fast.at.epochSecond) >= 60) "${m.nextName ?: ""} ${m.nextTime ?: ""}" else null
    val short = size.height < 150.dp
    val pad = if (short) 9.dp else 14.dp
    when (m.style) {
        TodayStyle.BANDS -> Column(GlanceModifier.fillMaxSize().padding(pad)) {
            Text("${m.placeName} ${m.flag}", style = st(11, FontWeight.Medium, Color.White.copy(alpha = 0.9f)), maxLines = 1)
            Spacer(GlanceModifier.defaultWeight())
            Text(title, style = st(if (medium || short) 18 else 22, FontWeight.Bold), maxLines = 1)
            Text(time, style = st(if (medium || short) 20 else 24, FontWeight.Medium), maxLines = 1)
            Countdown(context, target, Color.White)
            if (nextLine != null) Text(nextLine, style = st(11, FontWeight.Medium, Color.White.copy(alpha = 0.85f)), maxLines = 1)
        }
        TodayStyle.SIMPLE -> Column(GlanceModifier.fillMaxSize().padding(pad), horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically) {
            Text("Next prayer", style = st(11, FontWeight.Medium, pal.fg2))
            Text(title, style = st(if (short) 24 else 30, FontWeight.Bold, pal.hero), maxLines = 1)
            Countdown(context, target, pal.fg, big = !short)
            Text(time, style = st(13, FontWeight.Normal, pal.fg2), maxLines = 1)
            if (nextLine != null) Text(nextLine, style = st(11, FontWeight.Medium, pal.fg2), maxLines = 1)
        }
        TodayStyle.SUN_PATH -> Column(GlanceModifier.fillMaxSize().padding(pad)) {
            Text("${m.placeName} ${m.flag}", style = st(11, FontWeight.Medium, pal.fg2), maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(GlanceModifier.size(8.dp).cornerRadius(4.dp).background(next.first.tint)) {}
                Spacer(GlanceModifier.width(6.dp))
                Text(title, style = st(if (short) 20 else 24, FontWeight.Bold, pal.fg), maxLines = 1)
            }
            Row(GlanceModifier.cornerRadius(12.dp).background(pal.card).padding(horizontal = 9.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("in ", style = st(12, FontWeight.Medium, pal.fg), maxLines = 1)
                Countdown(context, target, pal.fg)
            }
            Spacer(GlanceModifier.defaultWeight())
            if (nextLine != null) Text(nextLine, style = st(11, FontWeight.Medium, pal.fg2), maxLines = 1)
            else Image(ImageProvider(sunPathBitmap(m, 400, 110)), "Sun path", GlanceModifier.fillMaxWidth().height(if (short) 28.dp else 38.dp), contentScale = ContentScale.FillBounds)
        }
        else -> Box(GlanceModifier.fillMaxSize().padding(if (short) 4.dp else 8.dp), contentAlignment = Alignment.Center) {
            val side = (minOf(size.width.value / (if (medium) 2.2f else 1f), size.height.value) - (if (short) 8f else 16f)).coerceIn(70f, 150f)
            val px = (side * context.resources.displayMetrics.density).toInt().coerceAtMost(480)
            Image(ImageProvider(dialBitmap(m, px)), "Day dial", GlanceModifier.size(side.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(title, style = st(if (side < 100f) 10 else 12, FontWeight.Medium, pal.fg2), maxLines = 1)
                Countdown(context, target, pal.fg)
                Text(time, style = st(if (side < 100f) 10 else 12, FontWeight.Medium, pal.fg2), maxLines = 1)
                if (nextLine != null && !short) Text(nextLine, style = st(10, FontWeight.Medium, pal.fg2), maxLines = 1)
            }
        }
    }
}

class NextPrayerWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NextPrayerWidget()
}

// MARK: Today's timetable (large), in the Prayer screen's look

class TimetableWidget : GlanceAppWidget() {
    // Not Exact: Exact redraws from scratch at every step of a resize. These breakpoints let the
    // launcher switch layouts on its own, smoothly.
    override val sizeMode = SizeMode.Responsive(setOf(DpSize(180.dp, 180.dp), DpSize(250.dp, 250.dp), DpSize(250.dp, 330.dp)))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { TimetableContent(context) }
    }
}

@Composable
internal fun TimetableContent(context: Context) {
    val m = model(context) ?: return Empty()
    TimetableBody(context, m, LocalSize.current)
}

/** The whole day in the look picked on the Prayer screen (all six). Shared by "Today's timetable" and the large Next prayer. */
@Composable
private fun TimetableBody(context: Context, m: WidgetModel, size: DpSize) {
    val pal = widgetPal(m.style, m.dark)
    val base = GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(24.dp).clickable(actionStartActivity<MainActivity>())
        .background(ImageProvider(skyBitmap(m)), ContentScale.FillBounds)
    val compact = size.height < 240.dp
    val tall = size.height >= 320.dp
    val k = if (compact) 0.78f else 1f
    fun sz(x: Int) = (x * k).toInt()
    // Short widgets cannot fit a dial or an arc, so they use the rows (Colour Bands and Big and Simple still work).
    val look: TodayStyle = if (compact && m.style != TodayStyle.BANDS && m.style != TodayStyle.SIMPLE) TodayStyle.LIST else m.style
    val lead = m.lead
    val next = m.next
    when (look) {
        TodayStyle.BANDS -> BandsBody(context, m, pal, base, ::sz)
        // Centre Dial and Calm Gold: the ring at the top beside the day, then the list.
        TodayStyle.CENTRE, TodayStyle.GOLD -> Column(base.padding(12.dp)) {
            Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                DialBadge(context, m, pal, if (tall) 130 else 112)
                Spacer(GlanceModifier.width(12.dp))
                PlaceBlock(m, pal)
            }
            Spacer(GlanceModifier.height(8.dp))
            PrayerRows(context, m, pal, ::sz, GlanceModifier.fillMaxWidth().defaultWeight())
        }
        // The sun's arc under the prayer and its countdown pill, then the list.
        TodayStyle.SUN_PATH -> Column(base.padding(12.dp)) {
            Row(GlanceModifier.fillMaxWidth()) {
                Text("${m.placeName} ${m.flag}", style = st(11, FontWeight.Medium, pal.fg2), maxLines = 1, modifier = GlanceModifier.defaultWeight())
                Text("${m.dateLine.substringAfter(' ')} · ${m.hijri}", style = st(11, FontWeight.Normal, pal.fg2), maxLines = 1)
            }
            if (lead != null && next != null) Row(verticalAlignment = Alignment.CenterVertically) {
                Box(GlanceModifier.size(9.dp).cornerRadius(5.dp).background(lead.prayer.tint)) {}
                Spacer(GlanceModifier.width(7.dp))
                Text(m.names.getValue(lead.prayer), style = st(26, FontWeight.Bold, pal.fg), maxLines = 1)
                Spacer(GlanceModifier.width(8.dp))
                Row(GlanceModifier.cornerRadius(12.dp).background(pal.card).padding(horizontal = 9.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (lead.isNext) "in " else "${m.nextName} in ", style = st(12, FontWeight.Medium, pal.fg), maxLines = 1)
                    Countdown(context, next.second, pal.fg)
                }
            }
            Image(ImageProvider(sunPathBitmap(m, 400, 110)), "Sun path", GlanceModifier.fillMaxWidth().height(if (tall) 70.dp else 54.dp), contentScale = ContentScale.FillBounds)
            Spacer(GlanceModifier.height(4.dp))
            PrayerRows(context, m, pal, ::sz, GlanceModifier.fillMaxWidth().defaultWeight())
        }
        // Big and Simple: the prayer in big violet, the time left, and big rows. For older eyes.
        TodayStyle.SIMPLE -> Column(base.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (lead != null && next != null) {
                Text(m.names.getValue(lead.prayer), style = st(sz(if (tall) 34 else 26), FontWeight.Bold, pal.hero), maxLines = 1)
                Row(GlanceModifier.height(if (tall) 34.dp else 20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (lead.isNext) "in " else "left ", style = st(sz(15), FontWeight.Medium, pal.fg2))
                    Countdown(context, next.second, pal.fg, big = tall)
                }
            }
            Spacer(GlanceModifier.height(4.dp))
            PrayerRows(context, m, pal, ::sz, GlanceModifier.fillMaxWidth().defaultWeight(), bigger = tall)
        }
        // Short widgets: the plain list.
        else -> Column(base.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${m.placeName} ${m.flag}", style = st(sz(12), FontWeight.Bold, pal.fg), maxLines = 1)
            Text("${m.dateLine} · ${m.hijri}", style = st(sz(11), color = pal.fg2), maxLines = 1)
            Spacer(GlanceModifier.height(6.dp))
            PrayerRows(context, m, pal, ::sz, GlanceModifier.fillMaxWidth().defaultWeight())
        }
    }
}

/** Colour Bands: the prayer and its countdown, the date bar, then each prayer a full-width band. */
@Composable
private fun BandsBody(context: Context, m: WidgetModel, pal: WPal, base: GlanceModifier, sz: (Int) -> Int) {
    Column(base) {
        val countdown = m.countdownRow()
        val lead = m.lead
        val next = m.next
        Row(GlanceModifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (lead != null) Text(m.names.getValue(lead.prayer), style = st(sz(24), FontWeight.Bold, pal.fg), maxLines = 1)
            if (next != null) {
                Spacer(GlanceModifier.width(8.dp))
                Text(if (lead?.isNext == true) "in " else "${m.nextName} in ", style = st(sz(13), FontWeight.Medium, pal.fg2), maxLines = 1)
                Countdown(context, next.second, pal.fg2)
            }
        }
        Row(GlanceModifier.fillMaxWidth().background(pal.bar).padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${m.dateLine.substringAfter(' ')} · ${m.hijri}", style = st(sz(12), FontWeight.Bold, pal.fg), maxLines = 1)
        }
        Prayer.all.forEach { p ->
            val t = m.times.getValue(p)
            Row(
                GlanceModifier.fillMaxWidth().defaultWeight().background(BandsPalette.color(p)).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Tick(m, p, pal); Spacer(GlanceModifier.width(6.dp))
                    Text(m.names.getValue(p), style = st(sz(20), FontWeight.Bold))
                    if (countdown?.first == p) { Spacer(GlanceModifier.width(6.dp)); RowCountdown(context, m, countdown.second.trim() + " ", Color.White) }
                }
                Spacer(GlanceModifier.defaultWeight())
                Text(t.first, style = st(sz(25)))
                t.second?.let { Text(" $it", style = st(sz(15))) }
            }
        }
    }
}

/** The ring with "Next prayer / 2:47:03 / until Zohor" (or "NOW Asar ... left") inside; the number always has a word. */
@Composable
private fun DialBadge(context: Context, m: WidgetModel, pal: WPal, dp: Int) {
    Box(GlanceModifier.size(dp.dp), contentAlignment = Alignment.Center) {
        val px = (dp * context.resources.displayMetrics.density).toInt().coerceAtMost(480)
        Image(ImageProvider(dialBitmap(m, px)), "Day dial", GlanceModifier.fillMaxSize())
        val lead = m.lead
        val next = m.next
        if (lead != null && next != null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(if (lead.isNext) "Next prayer" else "Now ${m.names.getValue(lead.prayer)}", style = st(10, FontWeight.Medium, pal.fg2), maxLines = 1)
                Countdown(context, next.second, pal.fg)
                Text(if (lead.isNext) "until ${m.names.getValue(lead.prayer)}" else "left", style = st(10, FontWeight.Medium, pal.fg2), maxLines = 1)
            }
        }
    }
}

@Composable
private fun PlaceBlock(m: WidgetModel, pal: WPal) {
    Column {
        Text("${m.placeName} ${m.flag}", style = st(15, FontWeight.Bold, pal.fg), maxLines = 1)
        Text(m.hijri, style = st(12, color = pal.fg2), maxLines = 2)
        if (m.nextName != null) Text("Next: ${m.nextName} ${m.nextTime}", style = st(12, FontWeight.Medium, pal.fg), maxLines = 2)
    }
}

/** The day's rows on the look's card, the next prayer lit with its live countdown. Calm Gold marks it with a gold dot, the others with a prayer-colour bar. */
@Composable
private fun PrayerRows(
    context: Context, m: WidgetModel, pal: WPal, sz: (Int) -> Int, modifier: GlanceModifier,
    bigger: Boolean = false, compact: Boolean = false,
) {
    val gold = m.style == TodayStyle.GOLD
    val countdown = m.countdownRow()
    val nameSize = if (compact) 10 else if (bigger) 19 else 16
    val timeSize = if (compact) 10 else if (bigger) 22 else 18
    Column(modifier.cornerRadius(16.dp).background(pal.card)) {
        Prayer.all.forEach { p ->
            val hit = countdown?.first == p
            val passed = m.day.time(p) <= m.now && !hit
            val t = m.times.getValue(p)
            val fg = pal.fg.copy(alpha = if (passed) 0.6f else 1f)
            Row(
                GlanceModifier.fillMaxWidth().defaultWeight().background(if (hit) pal.cur else Color.Transparent)
                    .padding(horizontal = if (compact) 8.dp else 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (!compact) { Tick(m, p, pal); Spacer(GlanceModifier.width(6.dp)) }
                if (gold) Box(GlanceModifier.size(7.dp).cornerRadius(4.dp).background(if (hit) pal.acc else Color.Transparent)) {}
                else Box(GlanceModifier.width(3.dp).height(if (compact) 12.dp else 18.dp).cornerRadius(2.dp).background(p.tint)) {}
                Spacer(GlanceModifier.width(8.dp))
                Row(GlanceModifier.defaultWeight(), verticalAlignment = Alignment.CenterVertically) {
                    Text(m.names.getValue(p), style = st(sz(nameSize), if (hit) FontWeight.Bold else FontWeight.Medium, fg), maxLines = 1)
                    if (hit && !compact) { Spacer(GlanceModifier.width(6.dp)); RowCountdown(context, m, countdown!!.second, pal.acc) }
                }
                Text(t.first, style = st(sz(timeSize), FontWeight.Medium, fg))
                t.second?.let { Text(" $it", style = st(sz(if (compact) 9 else 11), FontWeight.Bold, pal.fg2.copy(alpha = if (passed) 0.6f else 1f))) }
            }
        }
    }
}

/** A tick for each prayer whose time has closed, a faint ring for the others, nothing for Syuruk. */
@Composable
private fun Tick(m: WidgetModel, p: Prayer, pal: WPal) {
    when {
        p == Prayer.SUNRISE -> Spacer(GlanceModifier.size(16.dp))
        m.isDone(p) -> Box(GlanceModifier.size(16.dp).cornerRadius(8.dp).background(if (m.style == TodayStyle.BANDS) Color.White else pal.acc), contentAlignment = Alignment.Center) {
            Text("\u2713", style = st(11, FontWeight.Bold, if (m.style == TodayStyle.BANDS) BandsPalette.color(p) else if (m.style == TodayStyle.GOLD && m.dark) Color(0xFF0B0F2A) else Color.White))
        }
        else -> Box(GlanceModifier.size(16.dp).cornerRadius(8.dp).background((if (m.style == TodayStyle.BANDS) Color.White else pal.fg2).copy(alpha = 0.2f))) {}
    }
}

class TimetableWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TimetableWidget()
}
