package com.prayertimesasia.app

import android.content.Context
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.isRoot
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.ExperimentalRoborazziApi
import com.github.takahirom.roborazzi.RoborazziATFAccessibilityCheckOptions
import com.github.takahirom.roborazzi.RoborazziATFAccessibilityChecker
import com.github.takahirom.roborazzi.checkRoboAccessibility
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityCheckPreset
import com.prayertimesasia.app.data.Directories
import com.prayertimesasia.app.data.OfficialRepository
import com.prayertimesasia.app.ui.PrayerTimesRoot
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.WakeUpTiming
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.Instant
import java.util.Locale

/**
 * Android's Accessibility Test Framework (the checks behind Accessibility Scanner) on every
 * main screen, in demo mode, Light and Dark: missing spoken labels, touch targets under 48 dp,
 * text contrast, duplicate labels and more. Any error fails the test.
 */
@OptIn(ExperimentalRoborazziApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class AccessibilityTest {
    @get:Rule
    val compose = createComposeRule()

    @After fun normalFont() = RuntimeEnvironment.setFontScale(1f)

    private val night = DemoConfig.night
    private val morning = DemoConfig.morning

    private val options = RoborazziATFAccessibilityCheckOptions(
        checker = RoborazziATFAccessibilityChecker(preset = AccessibilityCheckPreset.LATEST),
        failureLevel = RoborazziATFAccessibilityChecker.CheckLevel.Error,
    )

    private fun d(style: TodayStyle, appearance: Appearance = Appearance.DARK, now: Instant = night,
                  variant: String = "home", tab: Tab = Tab.PRAYER) =
        DemoConfig(variant, style, appearance, tab, now, false, false)

    private fun check(demo: DemoConfig, fontScale: Float = 1f, setup: (AppState) -> Unit = {}) {
        if (fontScale != 1f) RuntimeEnvironment.setFontScale(fontScale)
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val s = AppState(ctx, null, OfficialRepository(ctx), Directories(ctx), demo.preferences(demo.now ?: night),
            fixedNow = demo.now, sideEffects = false, locale = Locale("en", "AU"))
        Demo.seed(s, demo)
        setup(s)
        compose.setContent { PrayerTimesRoot(s) }
        compose.waitForIdle()
        // A sheet opens in its own window, so check every window on screen.
        val roots = compose.onAllNodes(isRoot()).fetchSemanticsNodes().size
        for (i in 0 until roots) compose.onAllNodes(isRoot())[i].checkRoboAccessibility(options)
    }

    // The Prayer screen in each style, Dark at night and Light by day.
    @Test fun prayer_list_dark() = check(d(TodayStyle.LIST))
    @Test fun prayer_list_light() = check(d(TodayStyle.LIST, Appearance.LIGHT, morning))
    @Test fun prayer_centre_dark() = check(d(TodayStyle.CENTRE))
    @Test fun prayer_centre_light() = check(d(TodayStyle.CENTRE, Appearance.LIGHT, morning))
    @Test fun prayer_dial_dark() = check(d(TodayStyle.DIAL))
    @Test fun prayer_dial_light() = check(d(TodayStyle.DIAL, Appearance.LIGHT, morning))
    @Test fun prayer_sunpath_dark() = check(d(TodayStyle.SUN_PATH))
    @Test fun prayer_sunpath_light() = check(d(TodayStyle.SUN_PATH, Appearance.LIGHT, morning))
    @Test fun prayer_bands_dark() = check(d(TodayStyle.BANDS))
    @Test fun prayer_bands_light() = check(d(TodayStyle.BANDS, Appearance.LIGHT, morning))
    @Test fun prayer_simple_dark() = check(d(TodayStyle.SIMPLE))
    @Test fun prayer_travel() = check(d(TodayStyle.LIST, variant = "travel"))
    @Test fun prayer_wake_chip() = check(d(TodayStyle.CENTRE)) { s -> s.update { it.copy(wakeUp = WakeUpTiming.AT_FAJR) } }

    // The largest font size.
    @Test fun prayer_list_big_font() = check(d(TodayStyle.LIST), fontScale = 2f)
    @Test fun settings_big_font() = check(d(TodayStyle.LIST, tab = Tab.SETTINGS), fontScale = 2f)

    // The other tabs and the first open.
    @Test fun qibla_dark() = check(d(TodayStyle.LIST, tab = Tab.QIBLA))
    @Test fun qibla_light() = check(d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.QIBLA))
    @Test fun falak_dark() = check(d(TodayStyle.LIST, tab = Tab.FALAK))
    @Test fun falak_light() = check(d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.FALAK))

    // Qibla and Falak in every look, Light by day and Dark at night, the phone facing 118°.
    private fun look(tab: Tab, style: TodayStyle, light: Boolean) =
        check(if (light) d(style, Appearance.LIGHT, morning, tab = tab) else d(style, tab = tab)) { it.demoHeading = 118.0 }
    @Test fun qibla_centre_light() = look(Tab.QIBLA, TodayStyle.CENTRE, true)
    @Test fun qibla_centre_dark() = look(Tab.QIBLA, TodayStyle.CENTRE, false)
    @Test fun qibla_sunpath_light() = look(Tab.QIBLA, TodayStyle.SUN_PATH, true)
    @Test fun qibla_sunpath_dark() = look(Tab.QIBLA, TodayStyle.SUN_PATH, false)
    @Test fun qibla_bands_light() = look(Tab.QIBLA, TodayStyle.BANDS, true)
    @Test fun qibla_bands_dark() = look(Tab.QIBLA, TodayStyle.BANDS, false)
    @Test fun qibla_simple_light() = look(Tab.QIBLA, TodayStyle.SIMPLE, true)
    @Test fun qibla_simple_dark() = look(Tab.QIBLA, TodayStyle.SIMPLE, false)
    @Test fun qibla_gold_light() = look(Tab.QIBLA, TodayStyle.GOLD, true)
    @Test fun qibla_gold_dark() = look(Tab.QIBLA, TodayStyle.GOLD, false)
    @Test fun falak_centre_light() = look(Tab.FALAK, TodayStyle.CENTRE, true)
    @Test fun falak_centre_dark() = look(Tab.FALAK, TodayStyle.CENTRE, false)
    @Test fun falak_sunpath_light() = look(Tab.FALAK, TodayStyle.SUN_PATH, true)
    @Test fun falak_sunpath_dark() = look(Tab.FALAK, TodayStyle.SUN_PATH, false)
    @Test fun falak_bands_light() = look(Tab.FALAK, TodayStyle.BANDS, true)
    @Test fun falak_bands_dark() = look(Tab.FALAK, TodayStyle.BANDS, false)
    @Test fun falak_simple_light() = look(Tab.FALAK, TodayStyle.SIMPLE, true)
    @Test fun falak_simple_dark() = look(Tab.FALAK, TodayStyle.SIMPLE, false)
    @Test fun falak_gold_light() = look(Tab.FALAK, TodayStyle.GOLD, true)
    @Test fun falak_gold_dark() = look(Tab.FALAK, TodayStyle.GOLD, false)
    @Test fun masjid_dark() = check(d(TodayStyle.LIST, tab = Tab.MASJID))
    @Test fun settings_dark() = check(d(TodayStyle.LIST, tab = Tab.SETTINGS))
    @Test fun settings_light() = check(d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.SETTINGS))
    @Test fun wake_up_sheet() = check(d(TodayStyle.CENTRE)) { s -> s.showWakeUp = true }
    @Test fun onboarding() = check(d(TodayStyle.LIST)) { it.update { p -> p.copy(hasOnboarded = false) } }
}
