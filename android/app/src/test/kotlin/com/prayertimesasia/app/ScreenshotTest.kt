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
import com.prayertimesasia.app.ui.masjid.OsmTiles
import com.prayertimesasia.app.ui.settings.SettingsScreen
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.widget.TimetableCardPreview
import com.prayertimesasia.app.widget.WidgetModel
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.MasjidLink
import com.prayertimesasia.core.PrayerSpace
import com.prayertimesasia.core.SahurTiming
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.WakeUpTiming
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

    // The Prayer screen in each of the five looks, night and day (as the web app's v12 looks).
    @Test fun today_centre_night() = shoot("02-today-centre-night", d(TodayStyle.CENTRE))
    @Test fun today_centre_day() = shoot("02b-today-centre-light-day", d(TodayStyle.CENTRE, Appearance.LIGHT, morning))
    @Test fun today_centre_more() = shoot("02d-today-centre-show-more", d(TodayStyle.CENTRE, more = true))
    @Test fun today_centre_auto_night() = shoot("02e-today-centre-auto-night", d(TodayStyle.CENTRE, Appearance.SYSTEM))
    @Test fun today_gold_night() = shoot("03-today-dial-night", d(TodayStyle.GOLD))
    @Test fun today_gold_day() = shoot("03b-today-gold-light-day", d(TodayStyle.GOLD, Appearance.LIGHT, morning))
    @Test fun today_sunpath_night() = shoot("04-today-sunpath-night", d(TodayStyle.SUN_PATH))
    @Test fun today_sunpath_day() = shoot("04b-today-sunpath-light-day", d(TodayStyle.SUN_PATH, Appearance.LIGHT, morning))
    @Test fun today_bands_night() = shoot("05-today-bands-night", d(TodayStyle.BANDS))
    @Test fun today_bands_more() = shoot("05b-today-bands-show-more", d(TodayStyle.BANDS, more = true))
    @Test fun today_bands_day() = shoot("05c-today-bands-day", d(TodayStyle.BANDS, Appearance.LIGHT, morning))
    @Test fun today_simple_night() = shoot("05d-today-simple-night", d(TodayStyle.SIMPLE))
    @Test fun today_simple_day() = shoot("05e-today-simple-light-day", d(TodayStyle.SIMPLE, Appearance.LIGHT, morning))
    @Test fun today_old_side_dial() = shoot("05f-today-old-side-dial-opens-centre", d(TodayStyle.LIST, Appearance.LIGHT, morning))
    @Test fun today_alerts_off() = shoot("05g-today-alerts-mixed", d(TodayStyle.CENTRE, Appearance.LIGHT, morning)) { s ->
        s.setAlertMode(com.prayertimesasia.core.Prayer.ASR, com.prayertimesasia.core.AlertMode.ALARM)
    }
    @Test fun today_travel() = shoot("06-today-travel-hanoi", d(TodayStyle.CENTRE, variant = "travel"))
    @Test fun today_visitor() = shoot("06b-today-visitor-kl", d(TodayStyle.CENTRE, variant = "visitor"))

    // The other tabs.
    @Test fun qibla() = shoot("07-qibla", d(TodayStyle.LIST, tab = Tab.QIBLA))
    @Test fun qibla_aligned() = shoot("07b-qibla-aligned", d(TodayStyle.LIST, tab = Tab.QIBLA, aligned = true))
    @Test fun qibla_aligned_light() = shoot("07c-qibla-aligned-light", d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.QIBLA, aligned = true))
    @Test fun falak() = shoot("08-falak", d(TodayStyle.LIST, tab = Tab.FALAK))
    @Test fun falak_day() = shoot("08b-falak-light-day", d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.FALAK))

    // Qibla and Falak in the five looks, light and dark, as on the web app's demo pictures
    // (25 October 2026, 9:01 am, phone facing 118°), so the two can be laid side by side.
    private val nineAm: Instant = java.time.ZonedDateTime.of(2026, 10, 25, 9, 1, 0, 0, java.time.ZoneId.of("Asia/Singapore")).toInstant()
    private fun look(tab: Tab, style: TodayStyle, appearance: Appearance, tag: String) =
        shoot("20-${tab.name.lowercase()}-$tag-${appearance.name.lowercase()}", d(style, appearance, nineAm, tab = tab)) { it.demoHeading = 118.0 }
    @Test fun qibla_centre_light() = look(Tab.QIBLA, TodayStyle.CENTRE, Appearance.LIGHT, "centre")
    @Test fun qibla_centre_dark() = look(Tab.QIBLA, TodayStyle.CENTRE, Appearance.DARK, "centre")
    @Test fun qibla_sunpath_light() = look(Tab.QIBLA, TodayStyle.SUN_PATH, Appearance.LIGHT, "sunpath")
    @Test fun qibla_sunpath_dark() = look(Tab.QIBLA, TodayStyle.SUN_PATH, Appearance.DARK, "sunpath")
    @Test fun qibla_bands_light() = look(Tab.QIBLA, TodayStyle.BANDS, Appearance.LIGHT, "bands")
    @Test fun qibla_bands_dark() = look(Tab.QIBLA, TodayStyle.BANDS, Appearance.DARK, "bands")
    @Test fun qibla_simple_light() = look(Tab.QIBLA, TodayStyle.SIMPLE, Appearance.LIGHT, "simple")
    @Test fun qibla_simple_dark() = look(Tab.QIBLA, TodayStyle.SIMPLE, Appearance.DARK, "simple")
    @Test fun qibla_gold_light() = look(Tab.QIBLA, TodayStyle.GOLD, Appearance.LIGHT, "gold")
    @Test fun qibla_gold_dark() = look(Tab.QIBLA, TodayStyle.GOLD, Appearance.DARK, "gold")
    @Test fun qibla_sunpath_aligned() = shoot("20-qibla-sunpath-aligned", d(TodayStyle.SUN_PATH, Appearance.LIGHT, nineAm, tab = Tab.QIBLA, aligned = true))
    @Test fun qibla_simple_aligned() = shoot("20-qibla-simple-aligned", d(TodayStyle.SIMPLE, Appearance.DARK, nineAm, tab = Tab.QIBLA, aligned = true))
    @Test fun falak_centre_light() = look(Tab.FALAK, TodayStyle.CENTRE, Appearance.LIGHT, "centre")
    @Test fun falak_centre_dark() = look(Tab.FALAK, TodayStyle.CENTRE, Appearance.DARK, "centre")
    @Test fun falak_sunpath_light() = look(Tab.FALAK, TodayStyle.SUN_PATH, Appearance.LIGHT, "sunpath")
    @Test fun falak_sunpath_dark() = look(Tab.FALAK, TodayStyle.SUN_PATH, Appearance.DARK, "sunpath")
    @Test fun falak_bands_light() = look(Tab.FALAK, TodayStyle.BANDS, Appearance.LIGHT, "bands")
    @Test fun falak_bands_dark() = look(Tab.FALAK, TodayStyle.BANDS, Appearance.DARK, "bands")
    @Test fun falak_simple_light() = look(Tab.FALAK, TodayStyle.SIMPLE, Appearance.LIGHT, "simple")
    @Test fun falak_simple_dark() = look(Tab.FALAK, TodayStyle.SIMPLE, Appearance.DARK, "simple")
    @Test fun falak_gold_light() = look(Tab.FALAK, TodayStyle.GOLD, Appearance.LIGHT, "gold")
    @Test fun falak_gold_dark() = look(Tab.FALAK, TodayStyle.GOLD, Appearance.DARK, "gold")
    @Test fun masjid() {
        OsmTiles.blocking = true
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
    @Test fun masjid_day() {
        OsmTiles.blocking = true
        masjid_places()
        shoot("09c-masjid-light-day", d(TodayStyle.LIST, Appearance.LIGHT, morning, tab = Tab.MASJID))
    }
    @Test fun masjid_yours() {
        OsmTiles.blocking = true
        masjid_places()
        shoot("09b-masjid-yours", d(TodayStyle.LIST, tab = Tab.MASJID)) { it.pendingMasjid = masjidLink; it.followPendingMasjid() }
    }
    private fun masjid_places() {
        val home = Coordinates(1.3721, 103.9474)
        fun at(name: String, lat: Double, lng: Double, musollah: Boolean, address: String, f: String = "", h: String? = null) =
            Coordinates(lat, lng).let { PrayerSpace(name, name, address, it, Geo.distanceKm(home, it), musollah, f, h) }
        NearbyCache.around = home
        NearbyCache.spaces = listOf(
            at("Musollah@Pasir Ris Mall", 1.3735, 103.9495, true, "Pasir Ris Drive 3", "wt", "Mo-Su 10:00-22:00"),
            at("Masjid Al-Istighfar", 1.37106, 103.96412, false, "Pasir Ris Walk", "wap"),
            at("Masjid Darul Ghufran", 1.3554, 103.93991, false, "Tampines Avenue 5"),
            at("Masjid Al-Ansar", 1.3285, 103.9200, false, "Bedok North Avenue 1"),
        ).sortedBy { it.distanceKm }
    }
    private val masjidLink = MasjidLink.parse(
        "prayertimesasia://masjid?n=Example+Masjid,+Pasir+Ris&ll=1.3735,103.9490&tz=Asia/Singapore&cc=SG&i=15,10,10,5,10&j=13:00")!!

    @Test fun your_masjid_sheet() = shoot("13-your-masjid-sheet", d(TodayStyle.LIST)) { it.pendingMasjid = masjidLink }
    @Test fun your_masjid_jamaah() = shoot("13b-your-masjid-jamaah-countdown",
        d(TodayStyle.LIST, Appearance.LIGHT, java.time.ZonedDateTime.parse("2026-10-25T12:57:00+08:00").toInstant())) {
        it.update { p -> p.copy(myMasjid = masjidLink) }
    }

    @Test fun settings() = shoot("10-settings", d(TodayStyle.LIST, tab = Tab.SETTINGS))
    @Test fun wake_up() = shoot("10c-wake-up", d(TodayStyle.CENTRE)) { s ->
        s.update { it.copy(wakeUp = WakeUpTiming.FAJR_MINUS_30, sahurAlarm = SahurTiming.FAJR_MINUS_90, asrAlarm = com.prayertimesasia.core.PrayerAlarmTiming.PLUS_10) }
        s.showWakeUp = true
    }
    @Test fun alerts_prayer_page() = shoot("10d-alerts-prayer-page", d(TodayStyle.CENTRE)) { s ->
        s.update { it.copy(asrAlarm = com.prayertimesasia.core.PrayerAlarmTiming.PLUS_10) }
        s.openAlerts("asr")
    }
    @Test fun alerts_friday_page() = shoot("10e-alerts-friday-page", d(TodayStyle.CENTRE)) { s ->
        s.update { it.copy(jumuahReminderMinutes = 90, jumuahLeaveAlarm = true) }
        s.openAlerts("friday")
    }
    @Test fun wake_chip() = shoot("02c-today-centre-wake-chip", d(TodayStyle.CENTRE)) { s ->
        s.update { it.copy(wakeUp = WakeUpTiming.AT_FAJR) }
    }
    @Test fun settings_makers() = shootScreen("10b-settings-makers", d(TodayStyle.LIST, tab = Tab.SETTINGS)) { s ->
        SettingsScreen(s, {}, {}, {}, rememberLazyListState(initialFirstVisibleItemIndex = 5))
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
                    WidgetModel.from(s.resolver, s.now, style, appearance == Appearance.DARK)?.let { TimetableCardPreview(it) }
                }
            }
        }
        compose.waitForIdle()
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/$name.png")
    }

    @Test fun widget_list() = widget("12-widget-list", TodayStyle.CENTRE)
    @Test fun widget_bands() = widget("12b-widget-bands", TodayStyle.BANDS)
    @Test fun widget_dial() = widget("12c-widget-dial", TodayStyle.GOLD)
    @Test fun widget_sunpath() = widget("12d-widget-sunpath", TodayStyle.SUN_PATH)
    @Test fun widget_simple() = widget("12e-widget-simple", TodayStyle.SIMPLE)
    @Test fun widget_centre_light() = widget("12f-widget-centre-light", TodayStyle.CENTRE, Appearance.LIGHT)
    @Test fun widget_bands_light() = widget("12g-widget-bands-light", TodayStyle.BANDS, Appearance.LIGHT)
    @Test fun widget_gold_light() = widget("12h-widget-gold-light", TodayStyle.GOLD, Appearance.LIGHT)

    // Ramadan day 12, half an hour before Maghrib: the Berbuka countdown (store screenshot).
    @Test fun ramadan() = shoot("14-ramadan-berbuka", DemoConfig(style = TodayStyle.CENTRE,
        now = java.time.Instant.parse("2026-10-25T10:20:00Z"), season = com.prayertimesasia.core.SeasonPreview.RAMADAN))

    @Test fun onboarding() = shoot("00-onboarding", d(TodayStyle.LIST)) { it.update { p -> p.copy(hasOnboarded = false) } }
}
