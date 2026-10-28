package com.prayertimesasia.app.ui

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
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.SkyScheme
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.today.AppSheet
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
    data object MoveOut : Overlay()
    data object MoveIn : Overlay()
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
        CompositionLocalProvider(LocalSkyScheme provides SkyScheme(dark, soft, reduceMotion = state.fixedNow != null || animationsOff)) {
            content()
        }
    }
}

@Composable
fun PrayerTimesRoot(state: AppState) {
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
            val bands = state.selectedTab == Tab.PRAYER && state.prefs.todayStyle == TodayStyle.BANDS
            if (bands) Box(Modifier.fillMaxSize().background(BandsPalette.header)) else LivingSkyBackground(state.skyNow)
            Box(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(bottom = 74.dp)) {
                TabContent(state) { overlay = it }
            }
            TabBar(state, Modifier.align(Alignment.BottomCenter))
            if (state.showJourney) {
                Dialog(onDismissRequest = { state.showJourney = false },
                    properties = DialogProperties(usePlatformDefaultWidth = false)) {
                    SkyTheme(state) { JourneyScreen(state) { state.showJourney = false } }
                }
            }
            Overlays(state, overlay) { overlay = it }
            state.pendingMasjid?.let { link ->
                AppSheet({ state.pendingMasjid = null }) { MasjidLinkSheetContent(state, link) }
            }
        }
    }
}

@Composable
fun TabContent(state: AppState, open: (Overlay) -> Unit) {
    when (state.selectedTab) {
        Tab.PRAYER -> TodayScreen(state, openPlaces = { open(Overlay.Places) }, openCalendar = { open(Overlay.Calendar) },
            openSanad = { open(Overlay.Sanad(it)) })
        Tab.QIBLA -> QiblaScreen(state)
        Tab.FALAK -> FalakScreen(state, openCamera = { open(Overlay.Camera) }, openLevel = { open(Overlay.Level) })
        Tab.MASJID -> MasjidScreen(state, openAbout = { open(Overlay.About) })
        Tab.SETTINGS -> SettingsScreen(state, openPlaces = { open(Overlay.Places) }, openWidgetPreview = { open(Overlay.WidgetPreview) },
            openCredits = { open(Overlay.Credits) }, openMoveOut = { open(Overlay.MoveOut) }, openMoveIn = { open(Overlay.MoveIn) })
    }
}

@Composable
private fun Overlays(state: AppState, overlay: Overlay?, set: (Overlay?) -> Unit) {
    val close = { set(null) }
    when (overlay) {
        null -> {}
        Overlay.Places -> AppSheet(close) { PlacesSheetContent(state, close) }
        Overlay.Calendar -> AppSheet(close) { CalendarSheetContent(state) }
        is Overlay.Sanad -> AppSheet(close) { SanadSheetContent(state, overlay.day) }
        Overlay.About -> AppSheet(close) { MakersSheetContent("masjid") }
        Overlay.Credits -> AppSheet(close) { CreditsContent() }
        Overlay.Level -> AppSheet(close) { LevelScreen() }
        Overlay.WidgetPreview -> AppSheet(close) { WidgetPreviewContent(state) }
        Overlay.MoveOut -> AppSheet(close) { MoveOutContent(state) }
        Overlay.MoveIn -> AppSheet(close) { MoveInContent(state, close) }
        Overlay.Camera -> Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            FalakCameraScreen(state, close)
        }
    }
}

/** The floating tab bar: Prayer, Qibla, Falak, Masjid, Settings. */
@Composable
fun TabBar(state: AppState, modifier: Modifier = Modifier) {
    val dark = LocalSkyScheme.current.dark
    val shape = RoundedCornerShape(32.dp)
    Row(
        modifier.navigationBarsPadding().padding(horizontal = 20.dp, vertical = 6.dp).fillMaxWidth().height(62.dp).clip(shape)
            .background(if (dark) Color(0xFF23263F).copy(alpha = 0.88f) else Color.White.copy(alpha = 0.88f))
            .border(1.dp, Palette.primary.copy(alpha = 0.1f), shape).padding(4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        val items: List<Triple<Tab, String, ImageVector>> = listOf(
            Triple(Tab.PRAYER, "Prayer", AppIcons.prayer),
            Triple(Tab.QIBLA, "Qibla", AppIcons.qibla),
            Triple(Tab.FALAK, "Falak", AppIcons.falak),
            Triple(Tab.MASJID, "Masjid", AppIcons.masjid),
            Triple(Tab.SETTINGS, "Settings", Icons.Filled.Settings),
        )
        items.forEach { (tab, label, icon) ->
            val selected = state.selectedTab == tab
            Column(
                Modifier.weight(1f).fillMaxSize().clip(RoundedCornerShape(28.dp))
                    .background(if (selected) Palette.primary.copy(alpha = 0.1f) else Color.Transparent)
                    .clickable(onClickLabel = label) { state.selectedTab = tab },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(icon, label, Modifier.size(24.dp), tint = Palette.primary)
                Text(label, fontFamily = Rounded, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Palette.primary)
            }
        }
    }
}

@Composable
private fun WidgetPreviewContent(state: AppState) {
    Column(Modifier.fillMaxWidth().padding(Dims.gutter), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Big widget", style = Txt.headline, color = Palette.primary)
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
        Triple("JAKIM zone boundaries", "District-to-zone mapping from mptwaktusolat/malaysia.geojson; one reference point per district is used.", "https://github.com/mptwaktusolat/malaysia.geojson"),
        Triple("Calculation", "On-device solar calculation after praytimes.org; method presets as published by MUIS, JAKIM, Kemenag, the Muslim World League, Karachi, Umm al-Qura, Diyanet and others.", "https://praytimes.org/wiki/Calculation_Methods"),
        Triple("Maps and places", "Nearby masjids from OpenStreetMap (© OpenStreetMap contributors, ODbL) via the Overpass API. Directions open in your own maps app.", "https://www.openstreetmap.org/copyright"),
        Triple("Font", "Nunito by the Nunito Project Authors, under the SIL Open Font License 1.1.", "https://github.com/googlefonts/nunito"),
        Triple("Community data", "Masjid timetables and method confirmations from contributors, shared under CC-BY 4.0.", "https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md"),
        Triple("This app", "Open source under the MIT licence. Made by Aarif Raziff.", "https://github.com/aarif86/PrayerTimesAsia"),
    )
    LazyColumn(Modifier.fillMaxWidth().padding(horizontal = Dims.gutter)) {
        item { Text("Sources & credits", style = Txt.headline, color = Palette.primary, modifier = Modifier.padding(bottom = 12.dp)) }
        credits.forEach { (title, detail, url) ->
            item {
                Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(title, style = Txt.subheadlineSemibold, color = Palette.primary)
                    Text(detail, style = Txt.footnote, color = Palette.secondary)
                    Text(url.removePrefix("https://"), style = Txt.footnote, color = Palette.accent,
                        modifier = Modifier.clickable { runCatching { uri.openUri(url) } })
                }
            }
        }
        item { Box(Modifier.height(32.dp)) }
    }
}
