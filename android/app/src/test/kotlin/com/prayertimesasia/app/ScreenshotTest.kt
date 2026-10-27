package com.prayertimesasia.app

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import com.prayertimesasia.app.data.Directories
import com.prayertimesasia.app.data.OfficialRepository
import com.prayertimesasia.app.ui.PrayerTimesRoot
import com.prayertimesasia.app.ui.SkyTheme
import com.prayertimesasia.app.ui.TabBar
import com.prayertimesasia.app.ui.masjid.NearbyCache
import com.prayertimesasia.app.ui.settings.SettingsScreen
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.widget.TimetableCardPreview
import com.prayertimesasia.app.widget.WidgetModel
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.PrayerSpace
import com.prayertimesasia.core.TodayStyle
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.Instant
import java.util.Locale

/**
 * JVM screenshots of every screen (Robolectric native graphics + Roborazzi),
 * in demo mode: Pasir Ris, Singapore, Sunday 25 October 2026, 4:49 am - the moment of the
 * iOS app's own screenshots. Run with `./gradlew :app:recordRoborazziDebug`;
 * the images land in app/build/outputs/roborazzi.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class ScreenshotTest {
    @get:Rule
    val compose = createComposeRule()

    private val night = DemoConfig.night
    private val morning = DemoConfig.morning

    private fun state(demo: DemoConfig): AppState {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val s = AppState(ctx, null, OfficialRepository(ctx), Directories(ctx), demo.preferences(demo.now ?: night),
            fixedNow = demo.now, sideEffects = false, locale = Locale("en", "AU"))
        Demo.seed(s, demo)
        return s
    }

    private fun shoot(name: String, demo: DemoConfig, setup: (AppState) -> Unit = {}) {
        val s = state(demo)
        setup(s)
        compose.setContent { PrayerTimesRoot(s) }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/$name.png")
    }

    /** A screen on the sky with the tab bar, without the root's navigation (for scrolled views). */
    private fun shootScreen(name: String, demo: DemoConfig, content: @Composable (AppState) -> Unit) {
        val s = state(demo)
        compose.setContent {
            SkyTheme(s) {
                Box(Modifier.fillMaxSize()) {
                    LivingSkyBackground(s.skyNow)
                    Box(Modifier.fillMaxSize().padding(bottom = 74.dp)) { content(s) }
                    TabBar(s, Modifier.align(Alignment.BottomCenter))
                }
            }
        }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/$name.png")
    }

    private fun d(style: TodayStyle, appearance: Appearance = Appearance.DARK, now: Instant = night, more: Boolean = false,
                  variant: String = "home", tab: Tab = Tab.PRAYER, aligned: Boolean = false) =
        DemoConfig(variant, style, appearance, tab, now, more, aligned)

    // The Prayer screen in each style, night and day.
    @Test fun today_list_night() = shoot("01-today-list-night", d(TodayStyle.LIST))
    @Test fun today_list_auto_night() = shoot("01b-today-list-auto-night", d(TodayStyle.LIST, Appearance.SYSTEM))
    @Test fun today_list_day() = shoot("01c-today-list-light-day", d(TodayStyle.LIST, Appearance.LIGHT, morning))
    @Test fun today_list_more() = shoot("01d-today-list-show-more", d(TodayStyle.LIST, more = true))
    @Test fun today_centre_night() = shoot("02-today-centre-night", d(TodayStyle.CENTRE))
    @Test fun today_centre_day() = shoot("02b-today-centre-light-day", d(TodayStyle.CENTRE, Appearance.LIGHT, morning))
    @Test fun today_dial_night() = shoot("03-today-dial-night", d(TodayStyle.DIAL))
    @Test fun today_dial_day() = shoot("03b-today-dial-light-day", d(TodayStyle.DIAL, Appearance.LIGHT, morning))
    @Test fun today_dial_more() = shoot("03c-today-dial-show-more", d(TodayStyle.DIAL, more = true))
    @Test fun today_sunpath_night() = shoot("04-today-sunpath-night", d(TodayStyle.SUN_PATH))
    @Test fun today_sunpath_day() = shoot("04b-today-sunpath-light-day", d(TodayStyle.SUN_PATH, Appearance.LIGHT, morning))
    @Test fun today_bands_night() = shoot("05-today-bands-night", d(TodayStyle.BANDS))
    @Test fun today_bands_more() = shoot("05b-today-bands-show-more", d(TodayStyle.BANDS, more = true))
    @Test fun today_bands_day() = shoot("05c-today-bands-day", d(TodayStyle.BANDS, Appearance.LIGHT, morning))
    @Test fun today_travel() = shoot("06-today-travel-hanoi", d(TodayStyle.LIST, variant = "travel"))
    @Test fun today_visitor() = shoot("06b-today-visitor-kl", d(TodayStyle.LIST, variant = "visitor"))

    // The other tabs.
    @Test fun qibla() = shoot("07-qibla", d(TodayStyle.LIST, tab = Tab.QIBLA))
    @Test fun qibla_aligned() = shoot("07b-qibla-aligned", d(TodayStyle.LIST, tab = Tab.QIBLA, aligned = true))
    @Test fun qibla_aligned_light() = shoot("07c-qibla-aligned-light", d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.QIBLA, aligned = true))
    @Test fun falak() = shoot("08-falak", d(TodayStyle.LIST, tab = Tab.FALAK))
    @Test fun falak_day() = shoot("08b-falak-light-day", d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.FALAK))
    @Test fun masjid() {
        val home = Coordinates(1.3721, 103.9474)
        fun at(name: String, lat: Double, lng: Double, musollah: Boolean, address: String) =
            Coordinates(lat, lng).let { PrayerSpace(name, name, address, it, Geo.distanceKm(home, it), musollah) }
        NearbyCache.around = home
        NearbyCache.spaces = listOf(
            at("Musollah@Pasir Ris Mall", 1.3735, 103.9495, true, "Pasir Ris Drive 3"),
            at("Prayer Room", 1.3780, 103.9540, true, "Pasir Ris Close"),
            at("Masjid Al-Istighfar", 1.3742, 103.9300, false, "Pasir Ris Walk"),
            at("Masjid Darul Ghufran", 1.3540, 103.9440, false, "Tampines Avenue 5"),
            at("Musollah @ Century Square", 1.3523, 103.9440, true, "Tampines Central 1"),
            at("Masjid Al-Ansar", 1.3285, 103.9200, false, "Bedok North Avenue 1"),
        ).sortedBy { it.distanceKm }
        shoot("09-masjid", d(TodayStyle.LIST, tab = Tab.MASJID))
    }
    @Test fun settings() = shoot("10-settings", d(TodayStyle.LIST, tab = Tab.SETTINGS))
    @Test fun settings_makers() = shootScreen("10b-settings-makers", d(TodayStyle.LIST, tab = Tab.SETTINGS)) { s ->
        SettingsScreen(s, {}, {}, {}, rememberLazyListState(initialFirstVisibleItemIndex = 12))
    }
    @Test fun journey() = shootScreen("11-journey", d(TodayStyle.LIST, variant = "travel")) { s ->
        com.prayertimesasia.app.ui.journey.JourneyScreen(s) {}
    }

    // The big widget in its styles, as the app previews it.
    private fun widget(name: String, style: TodayStyle, appearance: Appearance = Appearance.DARK) {
        val s = state(d(style, appearance))
        compose.setContent {
            SkyTheme(s) {
                Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color(0xFF5B6E86)), contentAlignment = Alignment.Center) {
                    WidgetModel.from(s.resolver, s.now)?.let { TimetableCardPreview(it) }
                }
            }
        }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/$name.png")
    }

    @Test fun widget_list() = widget("12-widget-list", TodayStyle.LIST)
    @Test fun widget_bands() = widget("12b-widget-bands", TodayStyle.BANDS)
    @Test fun widget_dial() = widget("12c-widget-dial", TodayStyle.DIAL)

    @Test fun onboarding() = shoot("00-onboarding", d(TodayStyle.LIST)) { it.update { p -> p.copy(hasOnboarded = false) } }
}
