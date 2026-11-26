package com.prayertimesasia.app.ui

import com.prayertimesasia.app.ui.makers.NoteContent
import com.prayertimesasia.app.ui.makers.ReviewContent
import android.app.Activity
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Density
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.view.WindowCompat
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.Tab
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.falak.FalakCameraScreen
import com.prayertimesasia.app.ui.falak.FalakScreen
import com.prayertimesasia.app.ui.falak.FalakExpertContent
import com.prayertimesasia.app.ui.falak.FalakTool
import com.prayertimesasia.app.ui.falak.ShadowCameraScreen
import com.prayertimesasia.app.ui.falak.ShadowStepsContent
import com.prayertimesasia.app.ui.guide.GuideDialog
import com.prayertimesasia.app.ui.falak.LevelScreen
import com.prayertimesasia.app.ui.journey.JourneyScreen
import com.prayertimesasia.app.ui.makers.MakersSheetContent
import com.prayertimesasia.app.ui.masjid.MasjidLinkSheetContent
import com.prayertimesasia.app.ui.masjid.MasjidScreen
import com.prayertimesasia.app.ui.onboarding.OnboardingScreen
import com.prayertimesasia.app.ui.qibla.QiblaScreen
import com.prayertimesasia.app.ui.settings.MoveInContent
import com.prayertimesasia.app.ui.settings.MoveOutContent
import com.prayertimesasia.app.ui.settings.SettingsScreen
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.BandsPalette
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.app.ui.theme.Look
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.lerp
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.SkyScheme
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.today.AppSheet
import com.prayertimesasia.app.ui.today.TrackerSheetContent
import com.prayertimesasia.app.ui.today.WakeUpSheetContent
import com.prayertimesasia.app.ui.today.CalendarSheetContent
import com.prayertimesasia.app.ui.today.PlacesSheetContent
import com.prayertimesasia.app.ui.today.SanadSheetContent
import com.prayertimesasia.app.ui.today.TodayScreen
import com.prayertimesasia.app.widget.TimetableCardPreview
import com.prayertimesasia.app.widget.WidgetModel
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.TodayStyle
import kotlinx.coroutines.delay
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.R

/** Which sheet or full-screen view is open over the tabs. */
sealed class Overlay {
    data object Places : Overlay()
    data object Calendar : Overlay()
    data class Sanad(val day: PrayerDay) : Overlay()
    data object About : Overlay()
    data object WidgetPreview : Overlay()
    data object Credits : Overlay()
    data object Level : Overlay()
    data object Camera : Overlay()
    data object ShadowCamera : Overlay()
    data object ShadowSteps : Overlay()
    data object FalakExpert : Overlay()
    data object MoveOut : Overlay()
    data object MoveIn : Overlay()
    data object Guide : Overlay()
    data object Review : Overlay()
    data object Note : Overlay()
}

/** The app's theme: dark or light from the sky (Automatic) or as chosen, and the soft night. */
@Composable
fun SkyTheme(state: AppState, forceDark: Boolean = false, content: @Composable () -> Unit) {
    val systemDark = isSystemInDarkTheme()
    val dark = forceDark || (state.darkTheme ?: systemDark)
    val soft = !forceDark && state.prefs.appearance == Appearance.SYSTEM && dark
    val context = LocalContext.current
    val animationsOff = remember {
        runCatching { Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }.getOrDefault(false)
    }
    val accent = Palette.sunArc(dark)
    val scheme = if (dark) darkColorScheme(primary = accent, secondary = accent, surface = Color(0xFF15182E), background = Color(0xFF060A1C))
    else lightColorScheme(primary = Palette.sunArc(false), secondary = Palette.sunArc(false))
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            (view.context as? Activity)?.window?.let { w ->
                WindowCompat.getInsetsController(w, view).apply {
                    isAppearanceLightStatusBars = !dark
                    isAppearanceLightNavigationBars = !dark
                }
            }
        }
    }
    MaterialTheme(colorScheme = scheme) {
        CompositionLocalProvider(
            LocalSkyScheme provides SkyScheme(dark, soft, reduceMotion = state.fixedNow != null || animationsOff),
            LocalLook provides Look.of(state.prefs.todayStyle, dark),
        ) {
            content()
        }
    }
}

@Composable
fun PrayerTimesRoot(state: AppState) {
    // "Bigger text" in Settings: everything a fifth larger, on top of the phone's own text size.
    val density = LocalDensity.current
    val scale = if (state.prefs.largeText) 1.2f else 1f
    CompositionLocalProvider(LocalDensity provides Density(density.density, density.fontScale * scale)) {
        RootContent(state)
    }
}

@Composable
private fun RootContent(state: AppState) {
    LaunchedEffect(state.fixedNow) {
        if (state.fixedNow != null) return@LaunchedEffect
        while (true) {
            delay(1000)
            state.tick()
        }
    }
    var overlay by remember { mutableStateOf<Overlay?>(null) }
    if (!state.prefs.hasOnboarded) {
        SkyTheme(state, forceDark = true) {
            Box(Modifier.fillMaxSize()) {
                OnboardingScreen(state, bringIn = { overlay = Overlay.MoveIn }) { overlay = Overlay.Places }
                Overlays(state, overlay) { overlay = it }
            }
        }
        return
    }
    SkyTheme(state) {
        Box(Modifier.fillMaxSize()) {
            // Colour Bands and Calm Gold: a flat page on every tab, as on the web. The others: the Living Sky.
            val backdrop = LocalLook.current.backdrop
            if (backdrop != null) Box(Modifier.fillMaxSize().background(backdrop)) else LivingSkyBackground(state.skyNow)
            Box(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(bottom = 78.dp)) {
                TabContent(state) { overlay = it }
            }
            TabBar(state, Modifier.align(Alignment.BottomCenter))
            if (state.showJourney) {
                Dialog(onDismissRequest = { state.showJourney = false },
                    properties = DialogProperties(usePlatformDefaultWidth = false)) {
                    SkyTheme(state) { JourneyScreen(state) { state.showJourney = false } }
                }
            }
            if (state.showRamadan) {
                AppSheet({ state.showRamadan = false }) { com.prayertimesasia.app.ui.today.RamadanSheetContent(state) }
            }
            Overlays(state, overlay) { overlay = it }
            if (state.showTracker) {
                AppSheet({ state.showTracker = false }) { TrackerSheetContent(state) }
            }
            if (state.showWakeUp) {
                AppSheet({ state.showWakeUp = false }) { WakeUpSheetContent(state) }
            }
            state.pendingMasjid?.let { link ->
                AppSheet({ state.pendingMasjid = null }) { MasjidLinkSheetContent(state, link) }
            }
            // New users see the quick guide once, right after choosing their place.
            if (state.prefs.guideShown != true && overlay == null && state.pendingMasjid == null) GuideDialog(state) {}
        }
    }
}

@Composable
fun TabContent(state: AppState, open: (Overlay) -> Unit) {
    when (state.selectedTab) {
        Tab.PRAYER -> TodayScreen(state, openPlaces = { open(Overlay.Places) }, openCalendar = { open(Overlay.Calendar) },
            openSanad = { open(Overlay.Sanad(it)) })
        Tab.QIBLA -> QiblaScreen(state)
        Tab.FALAK -> FalakScreen(state) { tool ->
            open(when (tool) {
                FalakTool.STEPS -> Overlay.ShadowSteps
                FalakTool.SHADOW_CAMERA -> Overlay.ShadowCamera
                FalakTool.EXPERT -> Overlay.FalakExpert
                FalakTool.CAMERA -> Overlay.Camera
                FalakTool.LEVEL -> Overlay.Level
            })
        }
        Tab.MASJID -> MasjidScreen(state, openAbout = { open(Overlay.About) })
        Tab.SETTINGS -> SettingsScreen(state, openPlaces = { open(Overlay.Places) }, openWidgetPreview = { open(Overlay.WidgetPreview) },
            openCredits = { open(Overlay.Credits) }, openMoveOut = { open(Overlay.MoveOut) }, openMoveIn = { open(Overlay.MoveIn) },
            openGuide = { open(Overlay.Guide) },
            openReview = { open(Overlay.Review) }, openNote = { open(Overlay.Note) })
    }
}

@Composable
private fun Overlays(state: AppState, overlay: Overlay?, set: (Overlay?) -> Unit) {
    val close = { set(null) }
    when (overlay) {
        null -> {}
        Overlay.Places -> AppSheet(close) { PlacesSheetContent(state, onDone = close) }
        Overlay.Calendar -> AppSheet(close) { CalendarSheetContent(state, onShowDay = { state.showDayRequest = it; close() }) }
        is Overlay.Sanad -> AppSheet(close) { SanadSheetContent(state, overlay.day) }
        Overlay.About -> AppSheet(close) { MakersSheetContent("masjid", state) }
        Overlay.Credits -> AppSheet(close) { CreditsContent() }
        Overlay.Level -> AppSheet(close) { LevelScreen() }
        Overlay.WidgetPreview -> AppSheet(close) { WidgetPreviewContent(state) }
        Overlay.MoveOut -> AppSheet(close) { MoveOutContent(state) }
        Overlay.MoveIn -> AppSheet(close) { MoveInContent(state, close) }
        Overlay.Review -> AppSheet(close) { ReviewContent(state) { set(Overlay.Note) } }
        Overlay.Note -> AppSheet(close) { NoteContent(state) }
        Overlay.Camera -> Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            FalakCameraScreen(state, close)
        }
        Overlay.ShadowCamera -> Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            ShadowCameraScreen(state, close)
        }
        Overlay.ShadowSteps -> AppSheet(close) { ShadowStepsContent(state) }
        Overlay.FalakExpert -> AppSheet(close) { FalakExpertContent(state) }
        Overlay.Guide -> GuideDialog(state, close)
    }
}

/**
 * The floating tab bar, as on the web app: line icons, the current tab in the accent colour
 * with a soft fill, no pill. Colour Bands has square corners and its own glass.
 */
@Composable
fun TabBar(state: AppState, modifier: Modifier = Modifier) {
    val look = LocalLook.current
    val dark = look.dark
    val shape = RoundedCornerShape(if (look.bands) 14.dp else 32.dp)
    val glass = when {
        look.bands -> if (dark) Color(32, 32, 36).copy(alpha = 0.82f) else Color.White.copy(alpha = 0.85f)
        else -> if (dark) Color(30, 32, 60).copy(alpha = 0.72f) else Color.White.copy(alpha = 0.78f)
    }
    val stroke = when {
        look.bands -> if (dark) Color.White.copy(alpha = 0.08f) else Color.Black.copy(alpha = 0.08f)
        else -> if (dark) Color.White.copy(alpha = 0.12f) else Color.Black.copy(alpha = 0.08f)
    }
    // The current tab: the accent, made deeper on light pages so it reads (the web's 68% mix with black).
    val on = if (dark) look.appAccent else lerp(look.appAccent, Color.Black, 0.32f)
    Row(
        modifier.navigationBarsPadding().padding(horizontal = 14.dp).padding(bottom = 8.dp).fillMaxWidth().height(64.dp)
            .shadow(if (dark) 18.dp else 14.dp, shape, ambientColor = Color.Black.copy(alpha = 0.35f), spotColor = Color.Black.copy(alpha = if (dark) 0.35f else 0.15f))
            .clip(shape).background(glass).border(1.dp, stroke, shape)
            .selectableGroup().padding(4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val items: List<Triple<Tab, String, String>> = listOf(
            Triple(Tab.PRAYER, tr(R.string.tab_prayer), "prayer"),
            Triple(Tab.QIBLA, tr(R.string.tab_qibla), "qibla"),
            Triple(Tab.FALAK, tr(R.string.tab_falak), "falak"),
            Triple(Tab.MASJID, tr(R.string.tab_masjid), "masjid"),
            Triple(Tab.SETTINGS, tr(R.string.tab_settings), "settings"),
        )
        items.forEach { (tab, label, key) ->
            val selected = state.selectedTab == tab
            val color = if (selected) on else look.fg2
            Column(
                Modifier.weight(1f).fillMaxSize().clip(RoundedCornerShape(if (look.bands) 10.dp else 28.dp))
                    .selectable(selected = selected, role = Role.Tab, onClick = { state.selectedTab = tab }),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
            ) {
                Icon(AppIcons.tab(key, selected), null, Modifier.size(25.dp), tint = color)
                Text(label, fontSize = 10.5.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                    letterSpacing = 0.1.sp, color = color, maxLines = 1)
            }
        }
    }
}

@Composable
private fun WidgetPreviewContent(state: AppState) {
    Column(Modifier.fillMaxWidth().padding(Dims.gutter), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(tr(R.string.widget_big), style = Txt.headline, color = Palette.primary)
        WidgetModel.from(state.resolver, state.now)?.let { TimetableCardPreview(it) }
        Text("Touch and hold your home screen, tap Widgets and find Prayer Times Asia. Choose \"Today's timetable\". It follows your Prayer screen style.",
            style = Txt.footnote, color = Palette.secondary)
    }
}

@Composable
private fun CreditsContent() {
    val uri = LocalUriHandler.current
    val credits = listOf(
        Triple("MUIS - Singapore", "Contains information from the Muslim Prayer Timetable accessed from data.gov.sg, which is made available under the terms of the Singapore Open Data Licence version 1.0.", "https://data.gov.sg/open-data-licence"),
        Triple("JAKIM e-Solat - Malaysia", "Official prayer times by zone from Jabatan Kemajuan Islam Malaysia (e-solat.gov.my).", "https://www.e-solat.gov.my"),
        Triple("Kemenag - Indonesia", "Kementerian Agama (Bimas Islam) schedules via the myquran.com community API.", "https://api.myquran.com"),
        Triple("KHEU - Brunei", "Official prayer times by zone from the Ministry of Religious Affairs, Brunei (Kementerian Hal Ehwal Ugama), from its printed Taqwim.", "https://www.mora.gov.bn"),
        Triple("Brunei timetable", "The ministry's Taqwim, read and checked by Faruq Rasid's open prayertimes-database (GPL 3.0), with thanks.", "https://github.com/ruqqq/prayertimes-database"),
        Triple("JAKIM zone boundaries", "District-to-zone mapping from mptwaktusolat/malaysia.geojson; one reference point per district is used.", "https://github.com/mptwaktusolat/malaysia.geojson"),
        Triple("Calculation", "On-device solar calculation after praytimes.org; method presets as published by MUIS, JAKIM, Kemenag, the Muslim World League, Karachi, Umm al-Qura, Diyanet and others.", "https://praytimes.org/wiki/Calculation_Methods"),
        Triple("Maps and places", "Nearby masjids from OpenStreetMap (© OpenStreetMap contributors, ODbL) via the Overpass API. Directions open in your own maps app.", "https://www.openstreetmap.org/copyright"),
        Triple("Prayer rooms", "The musolla database on GitHub (LGPL 3.0), started by the KalamApps and PrayerTime.SG teams and kept by volunteers, for prayer rooms in malls, schools and sports centres. Our copy and fixes are shared back in the open.", "https://github.com/aarif86/musolla-database"),
        Triple("Font", "Nunito by the Nunito Project Authors, under the SIL Open Font License 1.1.", "https://github.com/googlefonts/nunito"),
        Triple("Community data", "Masjid timetables and method confirmations from contributors, shared under CC-BY 4.0.", "https://prayertimes.asia/verify.html"),
        Triple("Design", "The Colour Bands look and the prayer colours are inspired by prayertimes.sg & my by Awsam Tech LLP, the Singapore and Malaysia app. It was built by a team at Awsam Tech LLP and redesigned by Ustaz Shahib Amin Syukran, with thanks to them both.", "https://www.awsamtech.com/"),
        Triple("This app", "Open source under the GNU AGPL 3.0 licence. Made by Aarif Raziff.", "https://github.com/aarif86/PrayerTimesAsia"),
    )
    LazyColumn(Modifier.fillMaxWidth().padding(horizontal = Dims.gutter)) {
        item { Text("Sources & credits", style = Txt.headline, color = Palette.primary, modifier = Modifier.padding(bottom = 12.dp)) }
        credits.forEach { (title, detail, url) ->
            item {
                Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(title, style = Txt.subheadlineSemibold, color = Palette.primary)
                    Text(detail, style = Txt.footnote, color = Palette.secondary)
                    Text(url.removePrefix("https://"), style = Txt.footnote, color = Palette.accentText,
                        modifier = Modifier.clickable { runCatching { uri.openUri(url) } })
                }
            }
        }
        item { Box(Modifier.height(32.dp)) }
    }
}
