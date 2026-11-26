package com.prayertimesasia.app

import android.content.Context
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.ExperimentalRoborazziApi
import com.github.takahirom.roborazzi.RoborazziATFAccessibilityCheckOptions
import com.github.takahirom.roborazzi.RoborazziATFAccessibilityChecker
import com.github.takahirom.roborazzi.captureRoboImage
import com.github.takahirom.roborazzi.checkRoboAccessibility
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityCheckPreset
import com.prayertimesasia.app.data.Directories
import com.prayertimesasia.app.data.OfficialRepository
import com.prayertimesasia.app.ui.PrayerTimesRoot
import com.prayertimesasia.app.ui.masjid.NearbyCache
import com.prayertimesasia.app.ui.masjid.OsmTiles
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.PrayerSpace
import com.prayertimesasia.core.TodayStyle
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.Locale

/**
 * The Masjid and Settings tabs in all five looks, Light and Dark, as on the web app
 * (web/src/ui Masjid.tsx and Settings.tsx, the `.v12m` and `.v12st` blocks):
 * a screenshot of each (look-<screen>-<look>-<light|dark>.png) and the accessibility checks.
 */
@OptIn(ExperimentalRoborazziApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class LookMasjidSettingsTest {
    @get:Rule
    val compose = createComposeRule()

    private val looks = listOf(
        "centre" to TodayStyle.CENTRE, "sunPath" to TodayStyle.SUN_PATH, "bands" to TodayStyle.BANDS,
        "simple" to TodayStyle.SIMPLE, "gold" to TodayStyle.GOLD,
    )

    private val options = RoborazziATFAccessibilityCheckOptions(
        checker = RoborazziATFAccessibilityChecker(preset = AccessibilityCheckPreset.LATEST),
        failureLevel = RoborazziATFAccessibilityChecker.CheckLevel.Error,
    )

    /** The same places as the web's screenshots near Pasir Ris: masjids, and a prayer room with opening hours. */
    @Before fun places() {
        OsmTiles.blocking = true
        val home = Coordinates(1.3721, 103.9474)
        fun at(name: String, lat: Double, lng: Double, musollah: Boolean, address: String, f: String = "", h: String? = null) =
            Coordinates(lat, lng).let { PrayerSpace(name, name, address, it, Geo.distanceKm(home, it), musollah, f, h) }
        NearbyCache.around = home
        NearbyCache.spaces = listOf(
            at("Masjid Al-Istighfar", 1.37106, 103.96412, false, "2 Pasir Ris Walk", "wap"),
            at("Masjid Darul Ghufran", 1.3554, 103.93991, false, "503 Tampines Avenue 5"),
            at("Prayer Room, Changi Airport", 1.3575, 103.9886, true, "Terminal 3", "wt", "Mo-Su 00:00-24:00"),
            at("Masjid Al-Ansar", 1.3285, 103.9200, false, "155 Bedok North Avenue 1"),
            at("Masjid Kassim", 1.3093, 103.9128, false, "450 Changi Road"),
            at("Masjid Darul Aman", 1.3253, 103.8889, false, "1 Jalan Eunos"),
        ).sortedBy { it.distanceKm }
    }

    private fun state(style: TodayStyle, dark: Boolean, tab: Tab): AppState {
        val demo = DemoConfig("home", style, if (dark) Appearance.DARK else Appearance.LIGHT, tab,
            if (dark) DemoConfig.night else DemoConfig.morning, false, false)
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val s = AppState(ctx, null, OfficialRepository(ctx), Directories(ctx), demo.preferences(demo.now ?: DemoConfig.night),
            fixedNow = demo.now, sideEffects = false, locale = Locale("en", "AU"))
        Demo.seed(s, demo)
        return s
    }

    private fun shoot(screen: String, tab: Tab, look: String, style: TodayStyle, dark: Boolean) {
        val s = state(style, dark, tab)
        compose.setContent { PrayerTimesRoot(s) }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/look-$screen-$look-${if (dark) "dark" else "light"}.png")
        val roots = compose.onAllNodes(isRoot()).fetchSemanticsNodes().size
        for (i in 0 until roots) compose.onAllNodes(isRoot())[i].checkRoboAccessibility(options)
    }

    private fun each(screen: String, tab: Tab, look: String) {
        val style = looks.first { it.first == look }.second
        shoot(screen, tab, look, style, dark = true)
    }

    private fun eachLight(screen: String, tab: Tab, look: String) {
        val style = looks.first { it.first == look }.second
        shoot(screen, tab, look, style, dark = false)
    }

    @Test fun masjid_centre_dark() = each("masjid", Tab.MASJID, "centre")
    @Test fun masjid_centre_light() = eachLight("masjid", Tab.MASJID, "centre")
    @Test fun masjid_sunPath_dark() = each("masjid", Tab.MASJID, "sunPath")
    @Test fun masjid_sunPath_light() = eachLight("masjid", Tab.MASJID, "sunPath")
    @Test fun masjid_bands_dark() = each("masjid", Tab.MASJID, "bands")
    @Test fun masjid_bands_light() = eachLight("masjid", Tab.MASJID, "bands")
    @Test fun masjid_simple_dark() = each("masjid", Tab.MASJID, "simple")
    @Test fun masjid_simple_light() = eachLight("masjid", Tab.MASJID, "simple")
    @Test fun masjid_gold_dark() = each("masjid", Tab.MASJID, "gold")
    @Test fun masjid_gold_light() = eachLight("masjid", Tab.MASJID, "gold")

    @Test fun settings_centre_dark() = each("settings", Tab.SETTINGS, "centre")
    @Test fun settings_centre_light() = eachLight("settings", Tab.SETTINGS, "centre")
    @Test fun settings_sunPath_dark() = each("settings", Tab.SETTINGS, "sunPath")
    @Test fun settings_sunPath_light() = eachLight("settings", Tab.SETTINGS, "sunPath")
    @Test fun settings_bands_dark() = each("settings", Tab.SETTINGS, "bands")
    @Test fun settings_bands_light() = eachLight("settings", Tab.SETTINGS, "bands")
    @Test fun settings_simple_dark() = each("settings", Tab.SETTINGS, "simple")
    @Test fun settings_simple_light() = eachLight("settings", Tab.SETTINGS, "simple")
    @Test fun settings_gold_dark() = each("settings", Tab.SETTINGS, "gold")
    @Test fun settings_gold_light() = eachLight("settings", Tab.SETTINGS, "gold")
}
