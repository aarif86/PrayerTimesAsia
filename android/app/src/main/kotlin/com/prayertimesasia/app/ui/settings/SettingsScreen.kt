package com.prayertimesasia.app.ui.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.app.CalendarFile
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.AppWords
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.LineIcons
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.components.trCount
import com.prayertimesasia.app.ui.makers.MakersCard
import com.prayertimesasia.app.ui.makers.PICKS_NAME
import com.prayertimesasia.app.ui.theme.AppCard
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Look
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.CalculationMethod
import com.prayertimesasia.core.CommunityCard
import com.prayertimesasia.core.JakimZones
import com.prayertimesasia.core.NamingStyle
import com.prayertimesasia.core.Official
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.SeasonPreview
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.alertMode
import java.time.LocalDate

/**
 * Inside Settings the form parts (Section and the rows) take the look's colours and shapes,
 * as the web's `.v12st` does. Elsewhere (the Alerts sheet) they keep their own.
 */
private val LocalLookForm = staticCompositionLocalOf { false }

/** Colour Bands main page: rows straight on the page, icons in the six band colours. */
private val LocalBandsMain = staticCompositionLocalOf { false }

/** Colour Bands main page icon colours, by group (odd or even, from 1) and row (from 0), as the web's nth-of-type rules. */
private val BAND_ICONS_ODD = listOf(0xFF3A6F63, 0xFF8A9A52, 0xFFAB8D3A, 0xFFCD7D38, 0xFFD3705C, 0xFFC9565D).map { Color(it) }
private val BAND_ICONS_EVEN = listOf(0xFFCD7D38, 0xFFD3705C, 0xFFC9565D, 0xFF3A6F63, 0xFF8A9A52, 0xFFAB8D3A).map { Color(it) }
private fun bandIcon(group: Int, row: Int) = (if (group % 2 == 1) BAND_ICONS_ODD else BAND_ICONS_EVEN)[row % 6]

/** The six Colour Bands stripe colours, left to right. */
private val STRIPE = listOf(0xFF3A6F63, 0xFF8A9A52, 0xFFAB8D3A, 0xFFCD7D38, 0xFFD3705C, 0xFFC9565D).map { Color(it) }

@Composable
fun SettingsScreen(
    state: AppState,
    openPlaces: () -> Unit,
    openWidgetPreview: () -> Unit,
    openCredits: () -> Unit,
    listState: LazyListState = rememberLazyListState(),
    openMoveOut: () -> Unit = {},
    openMoveIn: () -> Unit = {},
    openGuide: () -> Unit = {},
    openReview: () -> Unit = {},
    openNote: () -> Unit = {},
) {
    // Apple style: a short main page of rows that show the current choice, and every
    // detail one tap deeper. Same groups as iOS SettingsView.swift and web ui/Settings.tsx.
    // The page behind (Living Sky, or the flat Bands and Gold page) comes from the root.
    var page by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(enabled = page != null) { page = if (page == "accuracy") "times" else null }
    val settingsWord = tr(R.string.settings_title)
    CompositionLocalProvider(LocalLookForm provides true) {
        Box(Modifier.fillMaxSize()) {
            when (page) {
                "location" -> SettingsPage(tr(R.string.settings_location), settingsWord, { page = null }) { LocationPage(state, openPlaces) }
                "times" -> SettingsPage(tr(R.string.settings_prayerTimes), settingsWord, { page = null }) { PrayerTimesPage(state) { page = "accuracy" } }
                "accuracy" -> SettingsPage(tr(R.string.settings_howAccurate), tr(R.string.settings_prayerTimes), { page = "times" }) { AccuracyPage() }
                "look" -> SettingsPage(tr(R.string.settings_lookFeel), settingsWord, { page = null }) { LookPage(state) }
                "language" -> SettingsPage(tr(R.string.settings_language), settingsWord, { page = null }) { LanguagePage(state) }
                "home" -> SettingsPage(tr(R.string.settings_homeScreen), settingsWord, { page = null }) { HomeScreenPage(openWidgetPreview) }
                "ramadan" -> SettingsPage(tr(R.string.settings_ramadan), settingsWord, { page = null }) { RamadanPage(state) }
                "tracker" -> SettingsPage(tr(R.string.settings_trackerOn), settingsWord, { page = null }) { TrackerPage(state) }
                "hadith" -> SettingsPage(tr(R.string.settings_hadith), settingsWord, { page = null }) { HadithPage(state) }
                "move" -> SettingsPage(tr(R.string.settings_movePhone), settingsWord, { page = null }) { MovePage(openMoveOut, openMoveIn) }
                "privacy" -> SettingsPage(tr(R.string.settings_privacy), settingsWord, { page = null }) { PrivacyPage(state) }
                "help" -> SettingsPage(tr(R.string.settings_help), settingsWord, { page = null }) { HelpPage(openGuide) }
                "picks" -> SettingsPage(PICKS_NAME, settingsWord, { page = null }) { PicksPage(state) }
                "about" -> SettingsPage(tr(R.string.settings_aboutCredits), settingsWord, { page = null }) { AboutPage(openCredits) }
                else -> SettingsMain(state, listState, { page = it }, openReview, openNote)
            }
        }
    }
}

private object SettingsLinks {
    /** One link for iPhone and Android; the site sends each phone to its store. */
    const val APP_PAGE = "https://prayertimes.asia"
    const val FAQ = "https://prayertimes.asia/#faq"
    const val PRIVACY = "https://prayertimes.asia/privacy.html"
    const val TERMS = "https://prayertimes.asia/terms.html"
    const val JOIN = "https://prayertimes.asia/join"
    const val INSTAGRAM = "https://www.instagram.com/prayertimesasia"
    const val FACEBOOK = "https://www.facebook.com/prayertimesasia"
    const val VERIFY = "https://prayertimes.asia/verify.html"
    const val NEW_LOOK = "https://prayertimes.asia/new-look.html"
    const val PICKS_RULES = "https://prayertimes.asia/barakah-picks.html"
}

/** The look's name in the app's language (Side Dial and Day Dial show as Centre Dial, as on the web). */
@Composable
private fun lookName(style: TodayStyle): String = when (style.look) {
    TodayStyle.SUN_PATH -> tr(R.string.style_sunPath)
    TodayStyle.BANDS -> tr(R.string.style_bands)
    TodayStyle.SIMPLE -> tr(R.string.style_simple)
    TodayStyle.GOLD -> tr(R.string.style_gold)
    else -> tr(R.string.style_centre)
}

private val versionText get() = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"

@Composable
private fun SettingsMain(state: AppState, listState: LazyListState, go: (String) -> Unit, openReview: () -> Unit, openNote: () -> Unit) {
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    val look = LocalLook.current
    val notify = Prayer.all.count { p.alertMode(it) == com.prayertimesasia.core.AlertMode.NOTIFY }
    val alarm = Prayer.all.count { p.alertMode(it) == com.prayertimesasia.core.AlertMode.ALARM }
    val alerts = if (notify + alarm == 0) tr(R.string.settings_nothingOn) else listOfNotNull(
        if (notify > 0) tr(R.string.settings_nNotify, "n" to notify) else null,
        if (alarm > 0) trCount(R.string.settings_nAlarms, R.string.settings_nAlarms_one, alarm) else null,
    ).joinToString(", ")
    val language = AppWords.LANGUAGES.firstOrNull { it.first == AppWords.picked(context) }?.second ?: tr(R.string.common_automatic)
    val onOff = @Composable { on: Boolean -> if (on) tr(R.string.common_on) else tr(R.string.common_off) }
    CompositionLocalProvider(LocalBandsMain provides look.bands) {
        LazyColumn(Modifier.fillMaxSize(), state = listState) {
            item {
                Text(tr(R.string.settings_title), style = display(if (look.simple) 38.sp else 34.sp, FontWeight.Bold), color = look.c.tx,
                    modifier = Modifier.padding(start = Dims.gutter, top = 24.dp, bottom = 4.dp).semantics { heading() })
            }
            item { SettingsAppCard(versionText) { go("about") } }
            item {
                Section(null) {
                    NavRow(tr(R.string.settings_location), "map-pin", bandIcon(1, 0), r.activePlace?.name ?: tr(R.string.settings_notSet)) { go("location") }
                    NavRow(tr(R.string.settings_prayerTimes), "clock", bandIcon(1, 1), r.method.shortName) { go("times") }
                    NavRow(tr(R.string.settings_alertsAlarms), "alarm-clock", bandIcon(1, 2), alerts) { state.openAlerts() }
                }
            }
            item {
                Section(null) {
                    NavRow(tr(R.string.settings_lookFeel), "palette", bandIcon(2, 0), lookName(p.todayStyle)) { go("look") }
                    NavRow(tr(R.string.settings_language), "globe", bandIcon(2, 1), language) { go("language") }
                    NavRow(tr(R.string.settings_homeScreen), "tablet-smartphone", bandIcon(2, 2), tr(R.string.settings_widgets)) { go("home") }
                }
            }
            item {
                Section(null) {
                    NavRow(tr(R.string.settings_ramadan), "moon-star", bandIcon(3, 0),
                        if (p.seasonPreview == SeasonPreview.OFF) tr(R.string.settings_ramadanStarts) else tr(R.string.settings_pretendOn)) { go("ramadan") }
                    NavRow(tr(R.string.settings_trackerOn), "circle-check", bandIcon(3, 1), onOff(p.trackerEnabled)) { go("tracker") }
                    NavRow(tr(R.string.settings_hadith), "book-open", bandIcon(3, 2), onOff(p.showHadith || p.hadithInAlerts)) { go("hadith") }
                }
            }
            item {
                Section(null) {
                    NavRow(tr(R.string.settings_movePhone), "arrow-right-left", bandIcon(4, 0)) { go("move") }
                    NavRow(tr(R.string.settings_privacy), "hand", bandIcon(4, 1)) { go("privacy") }
                    NavRow(tr(R.string.settings_help), "circle-question-mark", bandIcon(4, 2)) { go("help") }
                }
            }
            item {
                val shareText = tr(R.string.settings_shareText)
                Section(null) {
                    NavRow(tr(R.string.settings_share), "share-2", bandIcon(5, 0)) { shareApp(context, shareText) }
                    NavRow(tr(R.string.settings_rateApp), "star", bandIcon(5, 1), onClick = openReview)
                    NavRow(tr(R.string.settings_sendUsNote), "mail", bandIcon(5, 2), onClick = openNote)
                    NavRow(PICKS_NAME, "gift", bandIcon(5, 3), onOff(p.showOffers)) { go("picks") }
                    NavRow(tr(R.string.settings_aboutCredits), "info", bandIcon(5, 4)) { go("about") }
                }
            }
            item {
                Text(tr(R.string.settings_versionN, "v" to versionText), fontSize = 13.sp, color = look.c.tx2,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 32.dp))
            }
        }
    }
}

/**
 * The app's own card at the top of Settings, in the look (the web's `.app-card` per look).
 * Centre Dial keeps the icon's navy ring, batik and stitching. The logo never changes.
 */
@Composable
private fun SettingsAppCard(version: String, onClick: () -> Unit) {
    val look = LocalLook.current
    val c = look.c
    val aboutLabel = tr(R.string.settings_aboutVersion, "v" to version)
    val a11y = Modifier.semantics(mergeDescendants = true) { contentDescription = aboutLabel; role = Role.Button }
    if (look.centre) {
        AppCard(version, onClick, Modifier.padding(start = Dims.gutter, end = Dims.gutter, top = 10.dp, bottom = 6.dp))
        return
    }
    val shape = RoundedCornerShape(if (look.bands) 0.dp else 22.dp)
    val lightSun = look.sunPath && !look.dark
    val nameColor = when {
        look.bands -> Color.White
        look.sunPath -> if (lightSun) Color(0xFF151A45) else Color.White
        else -> c.tx
    }
    val lineColor = when {
        look.bands -> Color.White.copy(alpha = 0.85f)
        look.sunPath -> if (lightSun) Color(0xFF4A5080) else Color(0xFFEEF0FA).copy(alpha = 0.88f)
        else -> c.tx2
    }
    val box = when {
        look.bands -> Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 6.dp).background(Color(0xFF3A6F63))
        look.sunPath -> Modifier.fillMaxWidth().padding(horizontal = Dims.gutter).padding(top = 10.dp, bottom = 6.dp).clip(shape)
            .background(Brush.linearGradient(if (lightSun) listOf(Color(0xFFBFD9F2), Color(0xFFF6E9D5)) else listOf(Color(0xFF3A3480), Color(0xFF1D1F55))))
        look.simple -> Modifier.fillMaxWidth().padding(horizontal = Dims.gutter).padding(top = 10.dp, bottom = 6.dp).clip(shape)
            .background(c.card).border(2.dp, c.accent, shape)
        else -> Modifier.fillMaxWidth().padding(horizontal = Dims.gutter).padding(top = 10.dp, bottom = 6.dp).clip(shape)
            .background(c.card).border(1.dp, c.accent, shape)
    }
    Box(box.clickable(onClick = onClick).then(a11y)) {
        if (look.sunPath) {
            // The sun's path across the card, with the sun on it (the web's ::after picture).
            val arc = if (look.dark) Color(0xFFF7BD8F) else Color(0xFFC9622A)
            Canvas(Modifier.matchParentSize()) {
                val sx = size.width / 342f
                val sy = size.height / 90f
                val path = Path().apply { moveTo(-10 * sx, 84 * sy); quadraticTo(171 * sx, -40 * sy, 352 * sx, 84 * sy) }
                drawPath(path, arc.copy(alpha = 0.55f * 0.8f), style = Stroke(3.dp.toPx()))
                drawCircle(arc.copy(alpha = 0.8f), 6.dp.toPx(), Offset(250 * sx, 18 * sy))
            }
        }
        if (look.bands) Row(Modifier.fillMaxWidth().height(8.dp)) { STRIPE.forEach { Box(Modifier.weight(1f).fillMaxSize().background(it)) } }
        Row(
            Modifier.fillMaxWidth().padding(
                start = if (look.bands) 24.dp else 18.dp, end = if (look.bands) 24.dp else 18.dp,
                top = if (look.bands) 24.dp else 18.dp, bottom = if (look.bands) 16.dp else 18.dp,
            ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(if (look.simple) 16.dp else 14.dp),
        ) {
            val icon = if (look.simple) 76.dp else 64.dp
            Image(painterResource(R.drawable.app_icon_card), null,
                Modifier.size(icon).shadow(7.dp, RoundedCornerShape(15.dp)).clip(RoundedCornerShape(15.dp)))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Prayer Times Asia", color = nameColor, fontWeight = FontWeight.Bold,
                    style = if (look.simple) display(26.sp, FontWeight.Bold) else display(19.sp, FontWeight.Bold).copy(fontFamily = null))
                if (!look.simple) Text(tr(R.string.settings_builtIn), color = lineColor, fontSize = 14.sp)
                Text(tr(R.string.settings_versionN, "v" to version), color = lineColor, fontSize = if (look.simple) 15.sp else 13.sp)
            }
            Icon(LineIcons.of("chevron-right"), null, Modifier.size(18.dp), tint = lineColor)
        }
    }
}

/** An inner page: Back to the page before, its title, and its groups (the web's settings-back and h-title). */
@Composable
private fun SettingsPage(title: String, backTo: String, back: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val look = LocalLook.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
        Row(
            Modifier.padding(start = Dims.gutter - 6.dp, top = 14.dp).heightIn(min = 48.dp).clip(RoundedCornerShape(10.dp))
                .clickable(onClickLabel = tr(R.string.settings_back), onClick = back).padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Icon(LineIcons.of("chevron-left"), null, Modifier.size(20.dp), tint = look.c.accentText)
            Text(backTo, fontSize = 17.sp, color = look.c.accentText)
        }
        Text(title, style = display(if (look.simple) 38.sp else 34.sp, FontWeight.Bold), color = look.c.tx,
            modifier = Modifier.padding(start = Dims.gutter, end = Dims.gutter, top = 4.dp, bottom = 4.dp).semantics { heading() })
        content()
    }
}

/** A main-page row: a small tinted icon, the name, and the current choice on the right. */
@Composable
private fun NavRow(label: String, icon: String, bandColor: Color, value: String = "", onClick: () -> Unit) {
    val look = LocalLook.current
    val bandsMain = LocalBandsMain.current
    val simple = look.simple
    RowShell(onClick, if (value.isEmpty()) label else "$label, $value") {
        val box = if (simple) 36.dp else 30.dp
        Box(Modifier.size(box).clip(RoundedCornerShape(if (look.bands) 0.dp else 8.dp)).background(if (bandsMain) bandColor else look.c.tint),
            contentAlignment = Alignment.Center) {
            Icon(LineIcons.of(icon), null, Modifier.size(if (simple) 20.dp else 17.dp), tint = if (bandsMain) Color.White else look.c.accentText)
        }
        Text(label, fontSize = if (simple) 21.sp else 17.sp, color = look.c.tx, modifier = Modifier.weight(1f))
        if (value.isNotEmpty()) Text(value, fontSize = if (simple) 17.sp else 15.sp, color = look.c.tx2, textAlign = TextAlign.End,
            maxLines = 2, modifier = Modifier.widthIn(max = 170.dp))
        Icon(LineIcons.of("chevron-right"), null, Modifier.size(16.dp), tint = look.c.tx3)
    }
}

@Composable
private fun LocationPage(state: AppState, openPlaces: () -> Unit) {
    val p = state.prefs
    Section(null, tr(R.string.settings_placeFoot)) {
        ValueRow(tr(R.string.settings_place), state.resolver.activePlace?.name ?: tr(R.string.settings_notSet), onClick = openPlaces, chevron = true)
    }
    Section(tr(R.string.settings_travel), tr(R.string.settings_travelAsk)) {
        SwitchRow(tr(R.string.settings_musafirMode), p.musafirEnabled, tr(R.string.settings_musafirModeSub)) { on -> state.update { it.copy(musafirEnabled = on) } }
        if (p.musafirEnabled) LinkRow(tr(R.string.settings_myJourneys), AppIcons.journey) { state.showJourney = true }
    }
}

@Composable
private fun PrayerTimesPage(state: AppState, openAccuracy: () -> Unit) {
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    val source = r.officialSource
    Section(null, "${r.sourceShort} ${tr(R.string.settings_followAuthority)}") {
        ValueRow(tr(R.string.settings_countryRules), if (r.profile.code.isEmpty()) r.profile.name else "${r.profile.flag} ${r.profile.name}")
        ValueRow(tr(R.string.settings_timesFrom), r.method.shortName)
        ValueRow(tr(R.string.settings_timetable), when {
            source == null -> tr(R.string.settings_calculated)
            state.official.hasTable(source, LocalDate.now(r.zone).year) -> tr(R.string.settings_officialDownloaded)
            else -> tr(R.string.settings_officialLater)
        })
        if (source != null) LinkRow(tr(R.string.settings_downloadAgain), LineIcons.of("download"), chevron = false) { state.refreshOfficialTimetable() }
        LinkRow(tr(R.string.settings_howAccurate), null, onClick = openAccuracy)
    }
    val automatic = @Composable { name: String -> tr(R.string.common_automaticWith, "name" to name) }
    Section(tr(R.string.settings_calculation), tr(R.string.settings_calcFootShort)) {
        val autoMethod = automatic(r.profile.method.shortName)
        PickerRow(tr(R.string.settings_method), if (p.methodOverrideId == null) autoMethod else r.method.name,
            listOf<Pair<String, String?>>(autoMethod to null) + CalculationMethod.all.map { it.name to it.id },
            p.methodOverrideId) { id -> state.update { it.copy(methodOverrideId = id) } }
        val school = if (r.profile.asr == AsrSchool.HANAFI) tr(R.string.settings_hanafi) else tr(R.string.settings_shafii)
        val autoAsr = automatic(school)
        val asrName = @Composable { a: AsrSchool -> if (a == AsrSchool.HANAFI) tr(R.string.settings_hanafi) else tr(R.string.settings_shafiiStandard) }
        PickerRow(tr(R.string.settings_asr), p.asrOverride?.let { asrName(it) } ?: autoAsr,
            listOf<Pair<String, AsrSchool?>>(autoAsr to null) + AsrSchool.entries.map { asrName(it) to it },
            p.asrOverride) { a -> state.update { it.copy(asrOverride = a) } }
        val place = r.activePlace
        if (r.method.id == "jakim" && place != null) {
            val autoZone = automatic(Official.nearestJakimZone(place.coordinates))
            PickerRow(tr(R.string.settings_jakimZone), p.jakimZoneOverride ?: autoZone,
                listOf<Pair<String, String?>>(autoZone to null) + JakimZones.zones.map { "${it.id} · ${it.areas}" to it.id },
                p.jakimZoneOverride) { z -> state.update { it.copy(jakimZoneOverride = z) } }
        }
    }
    Section(tr(R.string.settings_dates), tr(R.string.settings_hijriFoot)) {
        val n = p.hijriAdjustment
        val days = trCount(R.string.settings_days, R.string.settings_days_one, kotlin.math.abs(n))
        StepperRow(tr(R.string.settings_hijriDate), if (n == 0) tr(R.string.settings_sameDay) else (if (n > 0) "+" else "−") + days,
            canDown = n > -2, canUp = n < 2,
            onDown = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment - 1) } },
            onUp = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment + 1) } })
    }
    Section(tr(R.string.settings_addToCalendar)) {
        val feed = source?.calendarFeed
        if (source != null && feed != null) {
            LinkRow(tr(R.string.settings_subscribe), LineIcons.of("calendar-plus"), chevron = false,
                sub = tr(R.string.settings_subscribeSub, "name" to source.authority)) { openFeed(context, feed) }
        }
        LinkRow(tr(R.string.settings_add30), LineIcons.of("download"), chevron = false,
            sub = tr(R.string.settings_add30Sub, "place" to (r.activePlace?.name ?: tr(R.string.settings_yourPlace)))) {
            CalendarFile.share(context, state, Prayer.obligatory)
        }
        LinkRow(tr(R.string.settings_workCalendar, "names" to "${Prayer.DHUHR.name(r.naming)} ${tr(R.string.common_and)} ${Prayer.ASR.name(r.naming)}"),
            LineIcons.of("briefcase"), chevron = false, sub = tr(R.string.settings_workCalendarSub)) {
            CalendarFile.share(context, state, listOf(Prayer.DHUHR, Prayer.ASR))
        }
    }
}

@Composable
private fun AccuracyPage() {
    Section(null) {
        Text(tr(R.string.settings_accuracyPhone), fontSize = 13.sp, lineHeight = 18.sp, color = LocalLook.current.c.tx,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp))
    }
}

@Composable
private fun LookPage(state: AppState) {
    val p = state.prefs
    val look = LocalLook.current
    Section(tr(R.string.settings_prayerScreen)) {
        TodayStyle.looks.forEach { s ->
            val on = p.todayStyle.look == s
            RowShell({ state.update { it.copy(todayStyle = s) } }, modifier = Modifier.semantics { selected = on; role = Role.RadioButton }) {
                Text(lookName(s), fontSize = rowText(), color = look.c.tx, modifier = Modifier.weight(1f))
                if (on) Icon(LineIcons.of("check"), null, Modifier.size(18.dp), tint = look.c.accentText)
            }
        }
    }
    val appearanceName = @Composable { a: Appearance ->
        when (a) { Appearance.SYSTEM -> tr(R.string.appearance_system); Appearance.LIGHT -> tr(R.string.appearance_light); Appearance.DARK -> tr(R.string.appearance_dark) }
    }
    Section(tr(R.string.settings_appearance), tr(R.string.settings_appearanceFoot)) {
        PickerRow(tr(R.string.settings_appearance), appearanceName(p.appearance), Appearance.entries.map { appearanceName(it) to it }, p.appearance) { a ->
            state.update { it.copy(appearance = a) }
        }
    }
    Section(tr(R.string.settings_textTime), tr(R.string.settings_lookTip)) {
        SwitchRow(tr(R.string.settings_biggerText), p.largeText, tr(R.string.settings_biggerTextSub)) { on -> state.update { it.copy(largeText = on) } }
        SwitchRow(tr(R.string.settings_hour24), p.use24Hour) { on -> state.update { it.copy(use24Hour = on) } }
        SwitchRow(tr(R.string.settings_openingDial), p.showOpening, tr(R.string.settings_openingDialSub)) { on ->
            state.update { it.copy(showOpening = on) }
        }
    }
}

@Composable
private fun LanguagePage(state: AppState) {
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Section(null, tr(R.string.settings_languageFoot)) {
            val picked = remember { mutableStateOf(AppWords.picked(context)) }
            val automatic = tr(R.string.common_automatic)
            PickerRow(tr(R.string.settings_language), AppWords.LANGUAGES.firstOrNull { it.first == picked.value }?.second ?: automatic,
                listOf<Pair<String, String?>>(automatic to null) + AppWords.LANGUAGES.map { it.second to it.first },
                picked.value) { lang -> picked.value = lang; AppWords.pick(context, lang) }
        }
    } else {
        Section(null, tr(R.string.settings_followsPhone)) { ValueRow(tr(R.string.settings_language), tr(R.string.settings_samePhone)) }
    }
    Section(tr(R.string.settings_names), tr(R.string.settings_namesFootPhone)) {
        val auto = tr(R.string.common_automaticWith, "name" to r.personalNaming.language)
        PickerRow(tr(R.string.settings_names), p.namingOverride?.language ?: auto,
            listOf<Pair<String, NamingStyle?>>(auto to null) + NamingStyle.entries.map { it.label to it },
            p.namingOverride) { n -> state.update { it.copy(namingOverride = n) } }
        SwitchRow(tr(R.string.settings_localNames), p.showLocalNames) { on -> state.update { it.copy(showLocalNames = on) } }
    }
}

@Composable
private fun HomeScreenPage(openWidgetPreview: () -> Unit) {
    Section(null, tr(R.string.settings_widgetsFoot)) {
        LinkRow(tr(R.string.settings_seeWidgets), LineIcons.of("tablet-smartphone"), onClick = openWidgetPreview)
    }
}

@Composable
private fun previewName(v: SeasonPreview): String = when (v) {
    SeasonPreview.OFF -> tr(R.string.preview_off)
    SeasonPreview.SIGHTING -> tr(R.string.preview_sighting)
    SeasonPreview.RAMADAN -> tr(R.string.preview_ramadan)
    SeasonPreview.LAST_TEN -> tr(R.string.preview_lastTen)
    SeasonPreview.RAYA -> tr(R.string.preview_raya)
    SeasonPreview.SYAWAL -> tr(R.string.preview_syawal)
}

@Composable
private fun RamadanPage(state: AppState) {
    val p = state.prefs
    Section(null, tr(R.string.settings_ramadanFootShort)) {
        LinkRow(tr(R.string.settings_ramadanPage), LineIcons.of("moon-star"), sub = tr(R.string.settings_ramadanPageSub)) { state.showRamadan = true }
    }
    // Test builds only, or if it is somehow still on, so it can be turned off. Play testers get
    // the same release build as everyone, so tapping the version in About 7 times shows it too.
    if (BuildConfig.DEBUG || TesterUnlock.on || p.seasonPreview != SeasonPreview.OFF) {
        Section(tr(R.string.settings_forTesters),
            if (p.seasonPreview == SeasonPreview.OFF) tr(R.string.settings_pretendFoot) else tr(R.string.settings_pretendOnFoot)) {
            PickerRow(tr(R.string.settings_tryRamadan), previewName(p.seasonPreview),
                SeasonPreview.entries.map { previewName(it) to it }, p.seasonPreview) { v -> state.update { it.copy(seasonPreview = v) } }
        }
    }
}

@Composable
private fun TrackerPage(state: AppState) {
    val p = state.prefs
    Section(null, tr(R.string.settings_trackerFootPhone) + if (p.trackerEnabled) " " + tr(R.string.settings_trackerNudgeNote) else "") {
        SwitchRow(tr(R.string.settings_trackerOn), p.trackerEnabled) { on -> state.update { it.copy(trackerEnabled = on) } }
    }
}

@Composable
private fun HadithPage(state: AppState) {
    val p = state.prefs
    Section(null, tr(R.string.settings_hadithFoot)) {
        SwitchRow(tr(R.string.settings_showHadith), p.showHadith, tr(R.string.settings_showHadithSub)) { on ->
            state.update { it.copy(showHadith = on, hiddenHadith = if (on) emptyList() else it.hiddenHadith) }
        }
        SwitchRow(tr(R.string.settings_wakeHadith), p.hadithInAlerts, tr(R.string.settings_wakeHadithSub)) { on -> state.update { it.copy(hadithInAlerts = on) } }
    }
}

@Composable
private fun MovePage(openMoveOut: () -> Unit, openMoveIn: () -> Unit) {
    Section(null, tr(R.string.settings_movingFootPhone)) {
        LinkRow(tr(R.string.move_title), LineIcons.of("arrow-right-left"), onClick = openMoveOut)
        LinkRow(tr(R.string.move_bringIn), LineIcons.of("download"), onClick = openMoveIn)
    }
}

@Composable
private fun PrivacyPage(state: AppState) {
    val p = state.prefs
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val notificationsOn = remember { androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled() }
    Section(tr(R.string.settings_promise)) {
        LabelRow(LineIcons.of("hand"), tr(R.string.settings_privacy1))
        LabelRow(LineIcons.of("map-pin-off"), tr(R.string.settings_privacyPhone))
        LabelRow(LineIcons.of("map"), tr(R.string.settings_privacyMasjid))
    }
    Section(null) {
        SwitchRow(tr(R.string.settings_usage), p.shareUsage, tr(R.string.settings_usageSub)) { on -> state.update { it.copy(shareUsage = on) } }
    }
    Section(tr(R.string.settings_phonePermissions), tr(R.string.settings_phonePermissionsFoot)) {
        ValueRow(tr(R.string.settings_location), if (state.location.hasPermission) tr(R.string.settings_allowed) else if (p.useGPS) tr(R.string.settings_notAllowed) else tr(R.string.settings_pickedPlace))
        ValueRow(tr(R.string.settings_notificationsWord), if (notificationsOn) tr(R.string.settings_allowed) else tr(R.string.common_off))
        LinkRow(tr(R.string.settings_openPhoneSettings), null) {
            runCatching {
                context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
    }
    Section(null) {
        LinkRow(tr(R.string.settings_privacyPolicy), null) { runCatching { uri.openUri(SettingsLinks.PRIVACY) } }
    }
}

@Composable
private fun HelpPage(openGuide: () -> Unit) {
    val uri = LocalUriHandler.current
    Section(null, tr(R.string.settings_helpFoot)) {
        LinkRow(tr(R.string.settings_showGuide), LineIcons.of("lightbulb"), onClick = openGuide)
        LinkRow(tr(R.string.settings_faq), null) { runCatching { uri.openUri(SettingsLinks.FAQ) } }
        LinkRow(tr(R.string.settings_helpVerify), null) { runCatching { uri.openUri(SettingsLinks.VERIFY) } }
    }
}

@Composable
private fun PicksPage(state: AppState) {
    val p = state.prefs
    val uri = LocalUriHandler.current
    Section(null) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            CommunityCard.ours(state.offerCountry).forEach { MakersCard(it, "settings", state = state) }
        }
    }
    Section(null, tr(R.string.settings_picksFoot)) {
        SwitchRow(tr(R.string.settings_showPicks), p.showOffers) { on -> state.update { it.copy(showOffers = on) } }
        LinkRow(tr(R.string.settings_picksRules), null) { runCatching { uri.openUri(SettingsLinks.PICKS_RULES) } }
    }
}

@Composable
private fun AboutPage(openCredits: () -> Unit) {
    val uri = LocalUriHandler.current
    Section(null, tr(R.string.settings_motto)) {
        LinkRow(tr(R.string.settings_sources), null, onClick = openCredits)
        LinkRow(tr(R.string.settings_designLook), null) { runCatching { uri.openUri(SettingsLinks.NEW_LOOK) } }
    }
    Section(tr(R.string.settings_community)) {
        LinkRow(tr(R.string.settings_joinTimekeepers), null) { runCatching { uri.openUri(SettingsLinks.JOIN) } }
        LinkRow(tr(R.string.settings_instagram), null) { runCatching { uri.openUri(SettingsLinks.INSTAGRAM) } }
        LinkRow(tr(R.string.settings_facebook), null) { runCatching { uri.openUri(SettingsLinks.FACEBOOK) } }
    }
    Section(null, tr(R.string.settings_freeLine)) {
        LinkRow(tr(R.string.settings_privacyPolicy), null) { runCatching { uri.openUri(SettingsLinks.PRIVACY) } }
        LinkRow(tr(R.string.settings_terms), null) { runCatching { uri.openUri(SettingsLinks.TERMS) } }
        ValueRow(tr(R.string.settings_version), versionText,
            onClick = { TesterUnlock.taps += 1; if (TesterUnlock.taps >= 7) TesterUnlock.on = true })
    }
}

private fun shareApp(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain")
        .putExtra(Intent.EXTRA_TEXT, "$text ${SettingsLinks.APP_PAGE}")
    runCatching { context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

private fun openFeed(context: Context, https: String) {
    val webcal = https.replaceFirst("https://", "webcal://")
    for (u in listOf(webcal, https)) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        } catch (_: Exception) {
        }
    }
}

// MARK: Form building blocks

/** Words in a row: the look's text colour inside Settings, the sky's elsewhere. */
@Composable private fun fg(): Color = if (LocalLookForm.current) LocalLook.current.c.tx else Palette.primary
@Composable private fun fg2(): Color = if (LocalLookForm.current) LocalLook.current.c.tx2 else Palette.secondary
@Composable private fun fg3(): Color = if (LocalLookForm.current) LocalLook.current.c.tx3 else Palette.secondary
@Composable private fun rowText(): TextUnit = if (LocalLookForm.current && LocalLook.current.simple) 21.sp else 17.sp
@Composable private fun valueText(): TextUnit = if (LocalLookForm.current) (if (LocalLook.current.simple) 17.sp else 15.sp) else 17.sp
@Composable private fun subText(): TextUnit = if (LocalLookForm.current && LocalLook.current.simple) 15.sp else 13.sp

@Composable
fun Section(title: String?, footer: String? = null, content: @Composable ColumnScope.() -> Unit) {
    if (LocalLookForm.current) {
        LookSection(title, footer, LocalLook.current, LocalBandsMain.current, content)
        return
    }
    val dark = LocalSkyScheme.current.dark
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        if (title != null) {
            Text(title, style = Txt.subheadlineSemibold.copy(fontSize = 17.sp), color = Palette.primary.copy(alpha = 0.85f),
                modifier = Modifier.padding(start = 16.dp, top = 22.dp, bottom = 8.dp))
        } else {
            Spacer(Modifier.height(22.dp))
        }
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp))
                .background(if (dark) Color(0xFF1C1C24).copy(alpha = 0.82f) else Color.White.copy(alpha = 0.78f)),
            content = content,
        )
        if (footer != null) {
            Text(footer, style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp))
        }
    }
}

/**
 * A group in the look (the web's `.v12st .group`): the look's card, hairline border and corner.
 * Colour Bands runs edge to edge with square corners, and on the main page has no card at all.
 */
@Composable
private fun LookSection(title: String?, footer: String?, look: Look, bandsMain: Boolean, content: @Composable ColumnScope.() -> Unit) {
    val c = look.c
    val edge = if (look.bands) 0.dp else Dims.gutter
    val inset: Dp = if (look.bands) 24.dp else 16.dp
    Column(Modifier.fillMaxWidth().padding(horizontal = edge)) {
        if (title != null) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = c.tx2,
                modifier = Modifier.padding(start = inset, end = inset, top = 22.dp, bottom = 8.dp).semantics { heading() })
        } else {
            Spacer(Modifier.height(22.dp))
        }
        val shape = RoundedCornerShape(c.radius)
        val card = when {
            bandsMain -> Modifier
            look.bands -> Modifier.background(c.card)
            else -> Modifier.clip(shape).background(c.card).border(1.dp, c.stroke, shape)
        }
        // Each row draws its hairline below; the last one is trimmed off, so lines sit only between rows.
        Column(
            Modifier.fillMaxWidth().then(card).clipToBounds().layout { m, k ->
                val p = m.measure(k)
                val cut = 1.dp.roundToPx()
                layout(p.width, (p.height - cut).coerceAtLeast(0)) { p.place(0, 0) }
            },
            content = content,
        )
        if (footer != null) {
            Text(footer, fontSize = 13.sp, lineHeight = 17.5.sp, color = c.tx2, modifier = Modifier.padding(start = inset, end = inset, top = 8.dp))
        }
    }
}

@Composable
private fun RowShell(onClick: (() -> Unit)?, description: String? = null, modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    val lookForm = LocalLookForm.current
    val look = LocalLook.current
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = if (lookForm && look.simple) 64.dp else 52.dp)
                // A spoken name for the whole row, so a row cut off at the screen's edge still has one.
                .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier)
                .then(modifier)
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = if (lookForm && look.bands) 24.dp else 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(if (lookForm) 12.dp else 10.dp),
        ) { content() }
        if (lookForm) HorizontalDivider(thickness = 1.dp, color = look.c.sep)
        else HorizontalDivider(Modifier.padding(start = 16.dp), color = Palette.primary.copy(alpha = 0.08f))
    }
}

@Composable
fun ValueRow(label: String, value: String, onClick: (() -> Unit)? = null) = ValueRow(label, value, onClick, chevron = false)

@Composable
private fun ValueRow(label: String, value: String, onClick: (() -> Unit)?, chevron: Boolean) = RowShell(onClick) {
    Text(label, fontSize = rowText(), color = fg(), modifier = Modifier.weight(1f))
    Text(value, fontSize = valueText(), color = fg2(), maxLines = 2, textAlign = TextAlign.End, modifier = Modifier.widthIn(max = 200.dp))
    if (chevron) Icon(LineIcons.of("chevron-right"), null, Modifier.size(16.dp), tint = fg3())
}

@Composable
fun SwitchRow(label: String, checked: Boolean, sub: String? = null, onChange: (Boolean) -> Unit) = RowShell({ onChange(!checked) }) {
    Column(Modifier.weight(1f)) {
        Text(label, fontSize = rowText(), color = fg())
        if (sub != null) Text(sub, fontSize = subText(), color = fg2(), modifier = Modifier.padding(top = 2.dp))
    }
    // The web's switch: the app's accent when on (peach, or gold in Calm Gold).
    val on = if (LocalLookForm.current) LocalLook.current.appAccent else Palette.success
    Switch(checked, onChange, colors = SwitchDefaults.colors(checkedTrackColor = on, checkedThumbColor = Color.White, checkedBorderColor = Color.Transparent,
        uncheckedTrackColor = fg().copy(alpha = 0.16f), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent))
}

@Composable
fun LinkRow(label: String, icon: ImageVector?, onClick: () -> Unit) = LinkRow(label, icon, chevron = true, sub = null, onClick = onClick)

@Composable
private fun LinkRow(label: String, icon: ImageVector?, chevron: Boolean = true, sub: String? = null, onClick: () -> Unit) = RowShell(onClick) {
    if (icon != null) Icon(icon, null, Modifier.size(20.dp), tint = fg())
    Column(Modifier.weight(1f)) {
        Text(label, fontSize = rowText(), color = fg())
        if (sub != null) Text(sub, fontSize = subText(), color = fg2(), modifier = Modifier.padding(top = 2.dp))
    }
    if (chevron) Icon(LineIcons.of("chevron-right"), null, Modifier.size(16.dp), tint = fg3())
}

@Composable
private fun LabelRow(icon: ImageVector, label: String) = RowShell(null) {
    Icon(icon, null, Modifier.size(18.dp), tint = fg().copy(alpha = 0.85f))
    Text(label, fontSize = 13.sp, color = fg(), modifier = Modifier.weight(1f).padding(start = 2.dp))
}

@Composable
private fun StepperRow(label: String, value: String, canDown: Boolean, canUp: Boolean, onDown: () -> Unit, onUp: () -> Unit) = RowShell(null) {
    Text(label, fontSize = rowText(), color = fg(), modifier = Modifier.weight(1f))
    Text(value, fontSize = valueText(), color = fg2())
    Row(Modifier.clip(if (LocalLookForm.current && LocalLook.current.bands) RoundedCornerShape(0.dp) else CircleShape).background(fg().copy(alpha = 0.1f))) {
        Box(Modifier.size(44.dp, 32.dp).clickable(enabled = canDown, onClick = onDown), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Remove, tr(R.string.settings_dayEarlier), tint = fg().copy(alpha = if (canDown) 1f else 0.3f))
        }
        Box(Modifier.size(44.dp, 32.dp).clickable(enabled = canUp, onClick = onUp), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Add, tr(R.string.settings_dayLater), tint = fg().copy(alpha = if (canUp) 1f else 0.3f))
        }
    }
}

/** A row that shows its value and opens a single-choice list. */
@Composable
fun <T> PickerRow(label: String, value: String, options: List<Pair<String, T>>, selected: T, onPick: (T) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val accent = if (LocalLookForm.current) LocalLook.current.c.accentText else Palette.accent
    RowShell({ open = true }) {
        Text(label, fontSize = rowText(), color = fg())
        Text(value, fontSize = valueText(), color = fg2(), maxLines = 1, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
        Icon(Icons.Filled.UnfoldMore, null, Modifier.size(18.dp), tint = fg3())
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(label) },
            text = {
                LazyColumn {
                    items(options) { (name, v) ->
                        Row(Modifier.fillMaxWidth().clickable { onPick(v); open = false }.padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(v == selected, { onPick(v); open = false }, colors = RadioButtonDefaults.colors(selectedColor = accent))
                            Text(name, style = Txt.subheadline)
                        }
                    }
                }
            },
            confirmButton = { TextButton({ open = false }) { Text(tr(R.string.common_close)) } },
        )
    }
}

/** Hidden switch for testers on a store build: 7 taps on the version in About, until the app closes. */
private object TesterUnlock {
    var taps = 0
    var on by mutableStateOf(false)
}
