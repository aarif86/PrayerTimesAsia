package com.prayertimesasia.app

import android.content.Context
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import com.prayertimesasia.app.data.Directories
import com.prayertimesasia.app.data.OfficialRepository
import com.prayertimesasia.app.ui.PrayerTimesRoot
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.TodayStyle
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.Locale

/**
 * Pictures only (no pass or fail on looks) of the app on many device shapes, so a stretched or
 * cut-off layout shows up in the pull request: small phones, Fold closed and open, Flip, a
 * Surface Duo style dual screen (one screen and spread over both), tablets, a phone on its side,
 * and the biggest text. Each shape is a small subclass with its own screen size; the files are
 * named device-<shape>-<screen>.png and land with the other Roborazzi pictures.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
abstract class DeviceShapesBase(private val shape: String, private val fontScale: Float = 1f) {
    @get:Rule
    val compose = createComposeRule()

    @After fun normalFont() = RuntimeEnvironment.setFontScale(1f)

    private fun shoot(name: String, demo: DemoConfig) {
        if (fontScale != 1f) RuntimeEnvironment.setFontScale(fontScale)
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val s = AppState(ctx, null, OfficialRepository(ctx), Directories(ctx), demo.preferences(demo.now ?: DemoConfig.night),
            fixedNow = demo.now, sideEffects = false, locale = Locale("en", "AU"))
        Demo.seed(s, demo)
        compose.setContent { PrayerTimesRoot(s) }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/device-$shape-$name.png")
    }

    @Test fun prayer_centre_night() =
        shoot("centre-night", DemoConfig(style = TodayStyle.CENTRE, appearance = Appearance.DARK, tab = Tab.PRAYER, now = DemoConfig.night))

    @Test fun prayer_simple_day() =
        shoot("simple-day", DemoConfig(style = TodayStyle.SIMPLE, appearance = Appearance.LIGHT, tab = Tab.PRAYER, now = DemoConfig.morning))

    @Test fun qibla() =
        shoot("qibla", DemoConfig(style = TodayStyle.LIST, appearance = Appearance.DARK, tab = Tab.QIBLA, now = DemoConfig.night))

    @Test fun settings() =
        shoot("settings", DemoConfig(style = TodayStyle.LIST, appearance = Appearance.DARK, tab = Tab.SETTINGS, now = DemoConfig.night))
}

// dp sizes, width x height. The hinge of a dual screen is not drawn; look for content running through the middle.
@Config(sdk = [34], qualifiers = "w320dp-h568dp-xhdpi") class DeviceSmallPhone : DeviceShapesBase("small-phone-320x568")
@Config(sdk = [34], qualifiers = "w344dp-h882dp-xxhdpi") class DeviceFoldClosed : DeviceShapesBase("fold-closed-344x882")
@Config(sdk = [34], qualifiers = "w412dp-h914dp-xxhdpi") class DeviceFlipOpen : DeviceShapesBase("flip-open-412x914")
@Config(sdk = [34], qualifiers = "w412dp-h420dp-xxhdpi") class DeviceFlipHalfFolded : DeviceShapesBase("flip-half-folded-412x420")
@Config(sdk = [34], qualifiers = "w540dp-h720dp-xhdpi") class DeviceDuoOneScreen : DeviceShapesBase("duo-one-screen-540x720")
@Config(sdk = [34], qualifiers = "w1114dp-h720dp-xhdpi") class DeviceDuoSpanned : DeviceShapesBase("duo-spanned-1114x720")
@Config(sdk = [34], qualifiers = "w673dp-h841dp-xxhdpi") class DeviceFoldOpen : DeviceShapesBase("fold-open-673x841")
@Config(sdk = [34], qualifiers = "w841dp-h701dp-xxhdpi") class DevicePixelFoldOpen : DeviceShapesBase("pixel-fold-open-841x701")
@Config(sdk = [34], qualifiers = "w800dp-h1280dp-xhdpi") class DeviceTabletPortrait : DeviceShapesBase("tablet-portrait-800x1280")
@Config(sdk = [34], qualifiers = "w1280dp-h800dp-xhdpi") class DeviceTabletLandscape : DeviceShapesBase("tablet-landscape-1280x800")
@Config(sdk = [34], qualifiers = "w852dp-h393dp-xxhdpi") class DevicePhoneLandscape : DeviceShapesBase("phone-landscape-852x393")
@Config(sdk = [34], qualifiers = "w320dp-h568dp-xhdpi") class DeviceSmallPhoneBiggestText : DeviceShapesBase("small-phone-biggest-text", 2f)
