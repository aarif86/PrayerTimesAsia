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
import com.github.takahirom.roborazzi.captureRoboImage
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
        host.captureRoboImage("build/outputs/roborazzi/w-$name.png")
    }

    private fun d(style: TodayStyle, now: java.time.Instant, appearance: Appearance = Appearance.DARK) =
        DemoConfig("home", style, appearance, Tab.PRAYER, now)

    // Next prayer: small, wide and large (the large one is the whole day in the app's look).
    @Test fun next_small_night() = shoot("next-small-night", d(TodayStyle.BANDS, night), 110, 110) { NextPrayerContent(it) }
    @Test fun next_small_day() = shoot("next-small-day", d(TodayStyle.BANDS, morning), 110, 110) { NextPrayerContent(it) }
    @Test fun next_wide_night() = shoot("next-wide-night", d(TodayStyle.BANDS, night), 250, 110) { NextPrayerContent(it) }
    @Test fun next_wide_day() = shoot("next-wide-day", d(TodayStyle.BANDS, morning), 250, 110) { NextPrayerContent(it) }
    @Test fun next_large_bands_night() = shoot("next-large-bands-night", d(TodayStyle.BANDS, night), 250, 300) { NextPrayerContent(it) }
    @Test fun next_large_bands_day() = shoot("next-large-bands-day", d(TodayStyle.BANDS, morning), 250, 300) { NextPrayerContent(it) }
    @Test fun next_large_dial_night() = shoot("next-large-dial-night", d(TodayStyle.DIAL, night), 250, 300) { NextPrayerContent(it) }
    @Test fun next_large_list_day() = shoot("next-large-list-day", d(TodayStyle.LIST, morning), 250, 300) { NextPrayerContent(it) }

    // Today's timetable in every look, and at the short size a resize can pass through.
    @Test fun timetable_bands_night() = shoot("timetable-bands-night", d(TodayStyle.BANDS, night), 280, 280) { TimetableContent(it) }
    @Test fun timetable_bands_day() = shoot("timetable-bands-day", d(TodayStyle.BANDS, morning), 280, 280) { TimetableContent(it) }
    @Test fun timetable_dial_night() = shoot("timetable-dial-night", d(TodayStyle.DIAL, night), 280, 280) { TimetableContent(it) }
    @Test fun timetable_list_day() = shoot("timetable-list-day", d(TodayStyle.LIST, morning), 280, 280) { TimetableContent(it) }
    @Test fun timetable_bands_short() = shoot("timetable-bands-short", d(TodayStyle.BANDS, night), 280, 190) { TimetableContent(it) }
    @Test fun timetable_dial_short() = shoot("timetable-dial-short", d(TodayStyle.DIAL, night), 280, 190) { TimetableContent(it) }

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
