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
    }
}

private val white = ColorProvider(Color.White)
private fun white(alpha: Float) = ColorProvider(Color.White.copy(alpha = alpha))
private fun style(size: Int, weight: FontWeight = FontWeight.Normal, color: ColorProvider = white) =
    TextStyle(color = color, fontSize = size.sp, fontWeight = weight)

private fun model(context: Context, style: TodayStyle? = null): WidgetModel? {
    val app = context.applicationContext as? PrayerApp ?: return null
    val r = app.state.resolver
    return WidgetModel.from(r, Instant.now(), style ?: r.prefs.todayStyle)
}

/** The Living Sky behind a widget, as a small bitmap the launcher stretches (it's a smooth gradient). */
internal fun skyBitmap(m: WidgetModel): Bitmap {
    val sky = SkyColors.at(m.now, m.day)
    val w = 96
    val h = 160
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), sky.top.color.toArgb(), sky.bottom.color.toArgb(), Shader.TileMode.CLAMP)
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
    p.shader = RadialGradient(w / 2f, h * 1.1f, h * 0.75f, sky.glow.color.copy(alpha = 0.3f).toArgb(), 0, Shader.TileMode.CLAMP)
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
    return bmp
}

/** The Day Dial's ring: each prayer's period in its colour, a dot for now. */
internal fun dialBitmap(m: WidgetModel, px: Int): Bitmap {
    val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val midnight = m.day.date.atStartOfDay(m.zone).toInstant()
    fun angle(t: Instant) = (t.secondsSince(midnight) / 86_400 * 360 + 180).toFloat()
    val ring = px * 0.09f
    val r = px / 2f - ring * 0.7f
    val oval = RectF(px / 2f - r, px / 2f - r, px / 2f + r, px / 2f + r)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = ring }
    paint.color = Color.White.copy(alpha = 0.12f).toArgb()
    c.drawArc(oval, 0f, 360f, false, paint)
    Prayer.all.forEachIndexed { i, p ->
        val start = angle(m.day.time(p))
        val end = if (i + 1 < Prayer.all.size) angle(m.day.time(Prayer.all[i + 1])) else angle(m.day.time(Prayer.FAJR)) + 360
        paint.color = p.tint.toArgb()
        c.drawArc(oval, start + 1.2f - 90f, end - start - 2.4f, false, paint)
    }
    val a = Math.toRadians((angle(m.now) - 90).toDouble())
    val x = px / 2f + (Math.cos(a) * r).toFloat()
    val y = px / 2f + (Math.sin(a) * r).toFloat()
    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE }
    c.drawCircle(x, y, ring * 0.62f, fill)
    fill.style = Paint.Style.STROKE
    fill.strokeWidth = ring * 0.25f
    fill.color = Color(0.97f, 0.74f, 0.56f).toArgb()
    c.drawCircle(x, y, ring * 0.62f, fill)
    return bmp
}

/** A live countdown the launcher ticks by itself (a RemoteViews Chronometer). */
@Composable
private fun Countdown(context: Context, to: Instant) {
    val rv = RemoteViews(context.packageName, R.layout.widget_countdown)
    val millis = (to.toEpochMilli() - System.currentTimeMillis()).coerceAtLeast(0)
    rv.setChronometer(R.id.countdown, SystemClock.elapsedRealtime() + millis, null, true)
    rv.setChronometerCountDown(R.id.countdown, true)
    AndroidRemoteViews(rv)
}

@Composable
private fun Empty() {
    Box(GlanceModifier.fillMaxSize().background(Color(0xFF0C1A3A)).padding(12.dp), contentAlignment = Alignment.Center) {
        Text("Open Prayer Times Asia to set your location.", style = style(13))
    }
}

// MARK: Next prayer (small and medium)

class NextPrayerWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(DpSize(110.dp, 110.dp), DpSize(250.dp, 110.dp)))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { NextPrayerContent(context) }
    }
}

@Composable
private fun NextPrayerContent(context: Context) {
    val m = model(context) ?: return Empty()
    val next = m.next ?: return Empty()
    val wide = LocalSize.current.width >= 240.dp
    Box(
        GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(22.dp)
            .background(ImageProvider(skyBitmap(m)), ContentScale.FillBounds)
            .clickable(actionStartActivity<MainActivity>()),
    ) {
        Row(GlanceModifier.fillMaxSize().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(GlanceModifier.defaultWeight()) {
                Text("${m.placeName} ${m.flag}", style = style(11, FontWeight.Medium, white(0.85f)), maxLines = 1)
                Spacer(GlanceModifier.defaultWeight())
                Text(m.nextName ?: "", style = style(17, FontWeight.Bold))
                Text(m.nextTime ?: "", style = style(26, FontWeight.Bold), maxLines = 1)
                Countdown(context, next.second)
            }
            if (wide) {
                Spacer(GlanceModifier.width(10.dp))
                Column(GlanceModifier.defaultWeight()) {
                    Prayer.all.forEach { p ->
                        val isCurrent = p == m.current?.first
                        val t = m.times.getValue(p)
                        Row(
                            GlanceModifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp).cornerRadius(10.dp)
                                .background(if (isCurrent) Color.White.copy(alpha = 0.22f) else Color.Transparent),
                        ) {
                            Text(m.names.getValue(p), style = style(12, if (isCurrent) FontWeight.Bold else FontWeight.Medium), modifier = GlanceModifier.defaultWeight())
                            Text(t.first + (t.second?.let { " $it" } ?: ""), style = style(12))
                        }
                    }
                }
            }
        }
    }
}

class NextPrayerWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NextPrayerWidget()
}

// MARK: Today's timetable (large), in the Prayer screen's style

class TimetableWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { TimetableContent(context) }
    }
}

@Composable
private fun TimetableContent(context: Context) {
    val m = model(context) ?: return Empty()
    val base = GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(24.dp).clickable(actionStartActivity<MainActivity>())
    when (m.style) {
        TodayStyle.BANDS -> Column(base.background(BandsPalette.header)) {
            Column(GlanceModifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(m.hijri, style = style(17, FontWeight.Bold), maxLines = 1)
                Text("${m.placeName} ${m.flag}  ·  ${m.sourceLabel}", style = style(11, FontWeight.Medium, white(0.65f)), maxLines = 1)
            }
            Prayer.all.forEach { p ->
                val isCurrent = p == m.current?.first
                val t = m.times.getValue(p)
                Row(
                    GlanceModifier.fillMaxWidth().defaultWeight().background(BandsPalette.color(p)).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(m.names.getValue(p), style = style(21, FontWeight.Bold))
                    if (isCurrent) Text("  NOW", style = style(10, FontWeight.Bold))
                    Spacer(GlanceModifier.defaultWeight())
                    Text(t.first, style = style(25))
                    t.second?.let { Text(" $it", style = style(15)) }
                }
            }
        }
        TodayStyle.DIAL, TodayStyle.CENTRE -> Column(base.background(ImageProvider(skyBitmap(m)), ContentScale.FillBounds).padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(GlanceModifier.size(120.dp), contentAlignment = Alignment.Center) {
                    val px = (120 * context.resources.displayMetrics.density).toInt().coerceAtMost(480)
                    Image(ImageProvider(dialBitmap(m, px)), "Day dial", GlanceModifier.fillMaxSize())
                    m.current?.let { cur ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(m.names.getValue(cur.first), style = style(15, FontWeight.Bold))
                            m.next?.let { Countdown(context, it.second) }
                        }
                    }
                }
                Spacer(GlanceModifier.width(12.dp))
                Column(GlanceModifier.defaultWeight()) {
                    Text("${m.placeName} ${m.flag}", style = style(15, FontWeight.Bold), maxLines = 1)
                    Text(m.hijri, style = style(12, color = white(0.75f)), maxLines = 2)
                    if (m.nextName != null) Text("Next: ${m.nextName} ${m.nextTime}", style = style(12, FontWeight.Medium, white(0.9f)), maxLines = 1)
                }
            }
            Spacer(GlanceModifier.height(8.dp))
            listOf(Prayer.all.take(3), Prayer.all.drop(3)).forEach { row ->
                Row(GlanceModifier.fillMaxWidth().defaultWeight()) {
                    row.forEachIndexed { i, p ->
                        val isCurrent = p == m.current?.first
                        val t = m.times.getValue(p)
                        Column(
                            GlanceModifier.defaultWeight().fillMaxSize().cornerRadius(12.dp)
                                .background(p.tint.copy(alpha = if (isCurrent) 0.4f else 0.16f)),
                            horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(m.names.getValue(p), style = style(12, FontWeight.Medium, white(0.85f)))
                            Text(t.first + (t.second?.let { " $it" } ?: ""), style = style(15, FontWeight.Bold), maxLines = 1)
                        }
                        if (i < row.size - 1) Spacer(GlanceModifier.width(6.dp))
                    }
                }
                Spacer(GlanceModifier.height(6.dp))
            }
        }
        else -> Column(base.background(ImageProvider(skyBitmap(m)), ContentScale.FillBounds).padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally) {
            Text("TODAY · ${m.placeName} ${m.flag}", style = style(11, FontWeight.Bold), maxLines = 1)
            Text("${m.dateLine} · ${m.hijri}", style = style(12, color = white(0.75f)), maxLines = 1)
            Spacer(GlanceModifier.height(6.dp))
            Column(GlanceModifier.fillMaxWidth().defaultWeight().cornerRadius(18.dp).background(Color.Black.copy(alpha = 0.18f)).padding(5.dp)) {
                Prayer.all.forEach { p ->
                    val isCurrent = p == m.current?.first
                    val passed = m.day.time(p) <= m.now && !isCurrent
                    val t = m.times.getValue(p)
                    val alpha = if (passed) 0.6f else 1f
                    Row(
                        GlanceModifier.fillMaxWidth().defaultWeight().cornerRadius(13.dp)
                            .background(if (isCurrent) p.tint.copy(alpha = 0.25f) else Color.Transparent).padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(GlanceModifier.width(3.dp).height(18.dp).cornerRadius(2.dp).background(p.tint)) {}
                        Spacer(GlanceModifier.width(8.dp))
                        Text(m.names.getValue(p) + if (isCurrent) "  · NOW" else "", style = style(16, FontWeight.Medium, white(alpha)),
                            modifier = GlanceModifier.defaultWeight())
                        Text(t.first, style = style(22, FontWeight.Bold, white(alpha)))
                        t.second?.let { Text(" $it", style = style(11, FontWeight.Bold, white(alpha * 0.7f))) }
                    }
                }
            }
        }
    }
}

class TimetableWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TimetableWidget()
}
