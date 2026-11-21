package com.prayertimesasia.app

import android.appwidget.AppWidgetManager
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.appwidget.AppWidgetId
import androidx.glance.ExperimentalGlanceApi
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.runComposition
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.prayertimesasia.app.data.Directories
import com.prayertimesasia.app.data.OfficialRepository
import com.prayertimesasia.app.widget.NextPrayerContent
import com.prayertimesasia.app.widget.TimetableContent
import com.prayertimesasia.app.widget.widgetTestState
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.TodayStyle
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.Instant
import java.util.Locale

/**
 * The real home screen widgets (not the in-app preview), drawn by Glance and inflated
 * from their RemoteViews, in each look, by night and by day, at the sizes a phone offers.
 * Images land in app/build/outputs/roborazzi (names start with "w-").
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class WidgetTest {
    private val night = DemoConfig.night
    private val morning = DemoConfig.morning

    @After fun clear() { widgetTestState = null }

    private fun state(demo: DemoConfig): AppState {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        return AppState(ctx, null, OfficialRepository(ctx), Directories(ctx), demo.preferences(demo.now ?: night),
            fixedNow = demo.now, sideEffects = false, locale = Locale("en", "AU"))
    }

    @OptIn(ExperimentalGlanceApi::class)
    private fun shoot(name: String, demo: DemoConfig, w: Int, h: Int, content: @Composable (Context) -> Unit) {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        widgetTestState = state(demo)
        val widget = object : GlanceAppWidget() {
            override val sizeMode = SizeMode.Exact
            override suspend fun provideGlance(context: Context, id: GlanceId) {
                provideContent { content(context) }
            }
        }
        val options = Bundle().apply {
            putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, w)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, w)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, h)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, h)
        }
        val rv = runBlocking { widget.runComposition(ctx, AppWidgetId(1), options).first() }
        val d = ctx.resources.displayMetrics.density
        val pad = (16 * d).toInt()
        val host = FrameLayout(ctx).apply { setBackgroundColor(Color.rgb(0x1F, 0x8A, 0x8F)); setPadding(pad, pad, pad, pad) }
        host.addView(rv.apply(ctx, host))
        host.measure(View.MeasureSpec.makeMeasureSpec((w * d).toInt() + 2 * pad, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec((h * d).toInt() + 2 * pad, View.MeasureSpec.EXACTLY))
        host.layout(0, 0, host.measuredWidth, host.measuredHeight)
        val bmp = android.graphics.Bitmap.createBitmap(host.measuredWidth, host.measuredHeight, android.graphics.Bitmap.Config.ARGB_8888)
        host.draw(android.graphics.Canvas(bmp))
        val file = java.io.File("build/outputs/roborazzi/w-$name.png").also { it.parentFile?.mkdirs() }
        file.outputStream().use { bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun d(style: TodayStyle, now: java.time.Instant, appearance: Appearance = Appearance.DARK) =
        DemoConfig("home", style, appearance, Tab.PRAYER, now)

    // Next prayer: small, wide and large (the large one is the whole day in the app's look).
    @Test fun next_small_night() = shoot("next-small-night", d(TodayStyle.LIST, night), 110, 110) { NextPrayerContent(it) }
    @Test fun next_small_day() = shoot("next-small-day", d(TodayStyle.LIST, morning), 110, 110) { NextPrayerContent(it) }
    @Test fun next_wide_night() = shoot("next-wide-night", d(TodayStyle.LIST, night), 250, 110) { NextPrayerContent(it) }
    @Test fun next_wide_day() = shoot("next-wide-day", d(TodayStyle.LIST, morning), 250, 110) { NextPrayerContent(it) }
    @Test fun next_large_bands_night() = shoot("next-large-bands-night", d(TodayStyle.BANDS, night), 250, 300) { NextPrayerContent(it) }
    @Test fun next_large_bands_day() = shoot("next-large-bands-day", d(TodayStyle.BANDS, morning), 250, 300) { NextPrayerContent(it) }
    @Test fun next_large_dial_night() = shoot("next-large-dial-night", d(TodayStyle.DIAL, night), 250, 300) { NextPrayerContent(it) }
    @Test fun next_wide_bands_night() = shoot("next-wide-bands-night", d(TodayStyle.BANDS, night), 250, 110) { NextPrayerContent(it) }
    @Test fun next_small_bands_day() = shoot("next-small-bands-day", d(TodayStyle.BANDS, morning), 110, 110) { NextPrayerContent(it) }
    @Test fun next_large_list_day() = shoot("next-large-list-day", d(TodayStyle.LIST, morning), 250, 300) { NextPrayerContent(it) }

    // The pictures the launcher's widget picker shows (copied into res/drawable-nodpi).
    @Test fun picker_previews() {
        shoot("preview-next", d(TodayStyle.LIST, night), 160, 160) { NextPrayerContent(it) }
        shoot("preview-timetable", d(TodayStyle.BANDS, night), 300, 300) { TimetableContent(it) }
    }

    // Today's timetable in all six looks, night and day, at a normal, a tall and a short size.
    private fun looks(size: String, w: Int, h: Int) {
        listOf(TodayStyle.CENTRE to "centre", TodayStyle.LIST to "sidedial", TodayStyle.DIAL to "dial",
            TodayStyle.SUN_PATH to "sunpath", TodayStyle.BANDS to "bands", TodayStyle.SIMPLE to "simple").forEach { (st, n) ->
            shoot("timetable-$n-$size-night", d(st, night), w, h) { TimetableContent(it) }
            shoot("timetable-$n-$size-day", d(st, morning, Appearance.LIGHT), w, h) { TimetableContent(it) }
        }
    }
    @Test fun timetable_normal() = looks("normal", 280, 280)
    @Test fun timetable_tall() = looks("tall", 280, 360)
    @Test fun timetable_short() = looks("short", 280, 190)

    // The cause of "Open Prayer Times Asia to set your location" on a resize: a freshly started
    // process has no live GPS place, so the widget must fall back to home instead of giving up.
    @Test fun widgetFindsAPlaceBeforeGpsAnswers() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val demo = DemoConfig()
        val home = demo.pasirRis
        val s = AppState(ctx, null, OfficialRepository(ctx), Directories(ctx), Preferences(useGPS = true, home = home),
            sideEffects = false, locale = Locale("en", "AU"))
        assertEquals(null, s.resolver.activePlace)
        assertEquals("Pasir Ris", s.widgetResolver().activePlace?.name)
    }
}
