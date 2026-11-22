package com.prayertimesasia.app.ui.settings

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material.icons.filled.NightsStay
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material.icons.filled.Work
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
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.app.alarms.Azan
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.app.R
import com.prayertimesasia.app.ui.components.AppWords
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.makers.MakersCard
import com.prayertimesasia.app.ui.makers.PICKS_NAME
import com.prayertimesasia.core.CommunityCard
import com.prayertimesasia.app.ui.theme.AppCard
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.CalculationMethod
import com.prayertimesasia.core.JakimZones
import com.prayertimesasia.core.NamingStyle
import com.prayertimesasia.core.Official
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.alertMode
import com.prayertimesasia.app.CalendarFile
import com.prayertimesasia.core.TodayStyle
import java.time.LocalDate

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
    var page by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(enabled = page != null) { page = if (page == "accuracy") "times" else null }
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(state.skyNow)
        when (page) {
            null -> SettingsMain(state, listState, { page = it }, openCredits, openReview, openNote)
            "location" -> SettingsPage(tr(R.string.settings_location), { page = null }) { LocationPage(state, openPlaces) }
            "times" -> SettingsPage(tr(R.string.settings_prayerTimes), { page = null }) { PrayerTimesPage(state) { page = "accuracy" } }
            "accuracy" -> SettingsPage(tr(R.string.settings_howAccurate), { page = "times" }) { AccuracyPage() }
            "look" -> SettingsPage(tr(R.string.settings_lookFeel), { page = null }) { LookPage(state) }
            "language" -> SettingsPage(tr(R.string.settings_language), { page = null }) { LanguagePage(state) }
            "home" -> SettingsPage("Home screen", { page = null }) { HomeScreenPage(openWidgetPreview) }
            "ramadan" -> SettingsPage(tr(R.string.alerts_dayRamadan), { page = null }) { RamadanPage(state) }
            "tracker" -> SettingsPage(tr(R.string.settings_tracker), { page = null }) { TrackerPage(state) }
            "hadith" -> SettingsPage(tr(R.string.settings_hadith), { page = null }) { HadithPage(state) }
            "move" -> SettingsPage(tr(R.string.settings_movePhone), { page = null }) { MovePage(openMoveOut, openMoveIn) }
            "privacy" -> SettingsPage(tr(R.string.settings_privacy), { page = null }) { PrivacyPage(state) }
            "help" -> SettingsPage(tr(R.string.settings_help), { page = null }) { HelpPage(openGuide) }
            "picks" -> SettingsPage(PICKS_NAME, { page = null }) { PicksPage(state) }
            "about" -> SettingsPage(tr(R.string.settings_aboutCredits), { page = null }) { AboutPage(openCredits) }
            else -> SettingsMain(state, listState, { page = it }, openCredits, openReview, openNote)
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

@Composable
private fun SettingsMain(
    state: AppState, listState: LazyListState, go: (String) -> Unit,
    openCredits: () -> Unit, openReview: () -> Unit, openNote: () -> Unit,
) {
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    val notify = Prayer.all.count { p.alertMode(it) == com.prayertimesasia.core.AlertMode.NOTIFY }
    val alarm = Prayer.all.count { p.alertMode(it) == com.prayertimesasia.core.AlertMode.ALARM }
    val alerts = if (notify + alarm == 0) tr(R.string.settings_nothingOn) else listOfNotNull(
        if (notify > 0) "$notify notify" else null,
        if (alarm > 0) "$alarm alarm${if (alarm > 1) "s" else ""}" else null,
    ).joinToString(", ")
    val language = AppWords.LANGUAGES.firstOrNull { it.first == AppWords.picked(context) }?.second ?: tr(R.string.common_automatic)
    LazyColumn(Modifier.fillMaxSize(), state = listState) {
        item {
            Text(tr(R.string.settings_title), style = display(34.sp, FontWeight.Bold), color = Palette.primary,
                modifier = Modifier.padding(start = Dims.gutter, top = 16.dp, bottom = 4.dp))
        }
        item {
            // The app's own card: the icon on the navy compass-ring colour. Opens About and credits.
            AppCard("${BuildConfig.VERSION_NAME}", { go("about") }, Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
        }
        item {
            Section(null) {
                NavRow(tr(R.string.settings_location), Icons.Filled.LocationOn, Color(0xFF0A84FF), r.activePlace?.name ?: tr(R.string.settings_notSet)) { go("location") }
                NavRow(tr(R.string.settings_prayerTimes), Icons.Filled.Schedule, Color(0xFF2F9E8F), r.method.shortName) { go("times") }
                NavRow(tr(R.string.settings_alertsAlarms), Icons.Filled.Alarm, Color(0xFFFF453A), alerts) { state.openAlerts() }
            }
        }
        item {
            Section(null) {
                NavRow(tr(R.string.settings_lookFeel), Icons.Filled.Palette, Color(0xFFBF5AF2), p.todayStyle.label) { go("look") }
                NavRow(tr(R.string.settings_language), Icons.Filled.Language, Color(0xFF0A84FF), language) { go("language") }
                NavRow("Home screen", Icons.Filled.PhoneAndroid, Color(0xFF5E5CE6), "Widgets") { go("home") }
            }
        }
        item {
            Section(null) {
                NavRow(tr(R.string.alerts_dayRamadan), Icons.Filled.NightsStay, Color(0xFF3A3480),
                    if (p.seasonPreview == com.prayertimesasia.core.SeasonPreview.OFF) tr(R.string.settings_ramadanStarts) else tr(R.string.settings_pretendOn)) { go("ramadan") }
                NavRow(tr(R.string.settings_tracker), Icons.Filled.CheckCircle, Color(0xFF30D158), if (p.trackerEnabled) tr(R.string.common_on) else tr(R.string.common_off)) { go("tracker") }
                NavRow(tr(R.string.settings_hadith), Icons.AutoMirrored.Filled.MenuBook, Color(0xFFA2845E),
                    if (p.showHadith || p.hadithInAlerts) tr(R.string.common_on) else tr(R.string.common_off)) { go("hadith") }
            }
        }
        item {
            Section(null) {
                NavRow(tr(R.string.settings_movePhone), Icons.Filled.SwapHoriz, Color(0xFF32ADE6)) { go("move") }
                NavRow(tr(R.string.settings_privacy), Icons.Filled.PanTool, Color(0xFF0A84FF)) { go("privacy") }
                NavRow(tr(R.string.settings_help), Icons.AutoMirrored.Filled.HelpOutline, Color(0xFFFF9F0A)) { go("help") }
            }
        }
        item {
            Section(null) {
                NavRow(tr(R.string.settings_share), Icons.Filled.Share, Color(0xFF30D158)) { shareApp(context) }
                NavRow(tr(R.string.settings_rateApp), Icons.Filled.Star, Color(0xFFFFB800), onClick = openReview)
                NavRow(tr(R.string.settings_sendUsNote), Icons.Filled.Email, Color(0xFF0A84FF), onClick = openNote)
                NavRow(PICKS_NAME, Icons.Filled.CardGiftcard, Color(0xFFE0634F), if (p.showOffers) tr(R.string.common_on) else tr(R.string.common_off)) { go("picks") }
                NavRow(tr(R.string.settings_aboutCredits), Icons.Filled.Info, Color(0xFF8E8E93)) { go("about") }
            }
        }
        item {
            Text("Version ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", style = Txt.footnote, color = Palette.secondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 32.dp))
        }
    }
}

/** An inner page: a back arrow, its title, and its sections. */
@Composable
private fun SettingsPage(title: String, back: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClick = back).semantics { contentDescription = "Back" },
                contentAlignment = Alignment.Center) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Palette.primary) }
            Text(title, style = display(24.sp, FontWeight.Bold), color = Palette.primary, modifier = Modifier.padding(start = 4.dp))
        }
        content()
    }
}

/** A main-page row: a small coloured icon, the name, and the current choice on the right. */
@Composable
private fun NavRow(label: String, icon: ImageVector, color: Color, value: String = "", onClick: () -> Unit) =
    RowShell(onClick, if (value.isEmpty()) label else "$label, $value") {
    Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).background(color), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size(18.dp), tint = Color.White)
    }
    Text(label, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
    if (value.isNotEmpty()) Text(value, style = Txt.body, color = Palette.secondary, maxLines = 1)
    Icon(Icons.Filled.ChevronRight, null, Modifier.size(20.dp), tint = Palette.secondary)
}

@Composable
private fun LocationPage(state: AppState, openPlaces: () -> Unit) {
    val p = state.prefs
    Section(null, tr(R.string.settings_placeFoot)) {
        ValueRow(tr(R.string.settings_place), state.resolver.activePlace?.name ?: tr(R.string.settings_notSet), onClick = openPlaces)
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
    Section(null, "${r.sourceShort} Always follow your local religious authority.") {
        ValueRow(tr(R.string.settings_countryRules), if (r.profile.code.isEmpty()) r.profile.name else "${r.profile.flag} ${r.profile.name}")
        ValueRow(tr(R.string.settings_timesFrom), r.method.shortName)
        ValueRow(tr(R.string.settings_timetable), when {
            source == null -> "Worked out on your phone"
            state.official.hasTable(source, LocalDate.now(r.zone).year) -> "Saved for offline"
            else -> "Downloads when online"
        })
        if (source != null) LinkRow(tr(R.string.settings_downloadAgain), Icons.Filled.Download) { state.refreshOfficialTimetable() }
        LinkRow(tr(R.string.settings_howAccurate), null, openAccuracy)
    }
    Section(tr(R.string.settings_calculation), tr(R.string.settings_calcFootShort)) {
        PickerRow(tr(R.string.settings_method), if (p.methodOverrideId == null) "Automatic · ${r.profile.method.shortName}" else r.method.name,
            listOf<Pair<String, String?>>("Automatic · ${r.profile.method.shortName}" to null) + CalculationMethod.all.map { it.name to it.id },
            p.methodOverrideId) { id -> state.update { it.copy(methodOverrideId = id) } }
        PickerRow(tr(R.string.settings_asr), p.asrOverride?.label ?: "Automatic · ${if (r.profile.asr == AsrSchool.HANAFI) tr(R.string.settings_hanafi) else tr(R.string.settings_shafii)}",
            listOf<Pair<String, AsrSchool?>>("Automatic · ${if (r.profile.asr == AsrSchool.HANAFI) tr(R.string.settings_hanafi) else tr(R.string.settings_shafii)}" to null) +
                AsrSchool.entries.map { it.label to it },
            p.asrOverride) { a -> state.update { it.copy(asrOverride = a) } }
        val place = r.activePlace
        if (r.method.id == "jakim" && place != null) {
            val nearest = Official.nearestJakimZone(place.coordinates)
            PickerRow(tr(R.string.settings_jakimZone), p.jakimZoneOverride ?: "Automatic · $nearest",
                listOf<Pair<String, String?>>("Automatic · $nearest" to null) + JakimZones.zones.map { "${it.id} · ${it.areas}" to it.id },
                p.jakimZoneOverride) { z -> state.update { it.copy(jakimZoneOverride = z) } }
        }
    }
    Section(tr(R.string.settings_dates), tr(R.string.settings_hijriFoot)) {
        StepperRow(tr(R.string.settings_hijriDate), if (p.hijriAdjustment == 0) tr(R.string.settings_sameDay) else String.format(java.util.Locale.ROOT, "%+d day", p.hijriAdjustment),
            canDown = p.hijriAdjustment > -2, canUp = p.hijriAdjustment < 2,
            onDown = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment - 1) } },
            onUp = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment + 1) } })
    }
    Section(tr(R.string.settings_addToCalendar)) {
        source?.calendarFeed?.let { feed ->
            LinkRow("Subscribe in a calendar app", Icons.Filled.Event) { openFeed(context, feed) }
        }
        LinkRow("Add the next 30 days", Icons.Filled.Event) { CalendarFile.share(context, state, Prayer.obligatory) }
        LinkRow("${Prayer.DHUHR.name(r.naming)} and ${Prayer.ASR.name(r.naming)} only, for work", Icons.Filled.Work) {
            CalendarFile.share(context, state, listOf(Prayer.DHUHR, Prayer.ASR))
        }
    }
}

@Composable
private fun AccuracyPage() {
    Section(null) {
        Text("In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year and keeps it for offline use. Only the year, zone code or area name is sent.\n\n" +
            "Everywhere else, and before that download, times are worked out on your phone with the country's own method.\n\n" +
            "That working is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables. For Singapore it is never earlier than the official time, and at most 2 minutes later. For Malaysia and Indonesia it is within about 2 minutes.",
            style = Txt.subheadline, color = Palette.primary, modifier = Modifier.padding(16.dp))
    }
    Section("The letter beside each day", "A falak reading from your own shadow stick only checks the times.") {
        ValueRow("A", "Official")
        ValueRow("B", "Confirmed by a masjid")
        ValueRow("C", "Checked by the community")
        ValueRow("D", "Worked out on your phone")
        ValueRow("F", "Your own shadow reading")
    }
}

@Composable
private fun LookPage(state: AppState) {
    val p = state.prefs
    Section(tr(R.string.settings_prayerScreen)) {
        TodayStyle.entries.forEach { s ->
            RowShell({ state.update { it.copy(todayStyle = s) } }) {
                Text(s.label, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
                RadioButton(p.todayStyle == s, { state.update { it.copy(todayStyle = s) } }, colors = RadioButtonDefaults.colors(selectedColor = Palette.accent))
            }
        }
    }
    Section(tr(R.string.settings_appearance), tr(R.string.settings_appearanceFoot)) {
        PickerRow(tr(R.string.settings_appearance), p.appearance.label, Appearance.entries.map { it.label to it }, p.appearance) { a ->
            state.update { it.copy(appearance = a) }
        }
    }
    Section(tr(R.string.settings_textTime), tr(R.string.settings_lookTip)) {
        SwitchRow(tr(R.string.settings_biggerText), p.largeText) { on -> state.update { it.copy(largeText = on) } }
        SwitchRow("24 hour time", p.use24Hour) { on -> state.update { it.copy(use24Hour = on) } }
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
            PickerRow("App words", AppWords.LANGUAGES.firstOrNull { it.first == picked.value }?.second ?: automatic,
                listOf<Pair<String, String?>>(automatic to null) + AppWords.LANGUAGES.map { it.second to it.first },
                picked.value) { lang -> picked.value = lang; AppWords.pick(context, lang) }
        }
    } else {
        Section(null, "The app follows your phone's language.") { ValueRow("App words", "Same as your phone") }
    }
    Section(tr(R.string.settings_names), "Pick Malay for Subuh and Isyak. When you travel, the local name shows small beside it, so the masjid's signs make sense.") {
        PickerRow(tr(R.string.settings_names), p.namingOverride?.language ?: "Automatic · ${r.personalNaming.language}",
            listOf<Pair<String, NamingStyle?>>("Automatic · ${r.personalNaming.language}" to null) + NamingStyle.entries.map { it.label to it },
            p.namingOverride) { n -> state.update { it.copy(namingOverride = n) } }
        SwitchRow(tr(R.string.settings_localNames), p.showLocalNames) { on -> state.update { it.copy(showLocalNames = on) } }
    }
}

@Composable
private fun HomeScreenPage(openWidgetPreview: () -> Unit) {
    Section(null, "To add a widget, touch and hold an empty space on your home screen, tap Widgets, then find Prayer Times Asia.") {
        LinkRow("See the widgets", null, openWidgetPreview)
    }
}

@Composable
private fun RamadanPage(state: AppState) {
    val p = state.prefs
    Section(null, tr(R.string.settings_ramadanFootShort)) {
        LinkRow("Open the Ramadan page", Icons.Filled.NightsStay) { state.showRamadan = true }
    }
    // Test builds only, or if it is somehow still on, so it can be turned off. Play testers get
    // the same release build as everyone, so tapping the version in About 7 times shows it too.
    if (BuildConfig.DEBUG || TesterUnlock.on || p.seasonPreview != com.prayertimesasia.core.SeasonPreview.OFF) {
        Section(tr(R.string.settings_forTesters),
            if (p.seasonPreview == com.prayertimesasia.core.SeasonPreview.OFF) "Shows a pretend Ramadan or Eid date so you can try it early."
            else "Pretend mode is on. The app shows a pretend date, not today's. Turn it off before you rely on the times.") {
            PickerRow("Pretend it is", p.seasonPreview.label,
                com.prayertimesasia.core.SeasonPreview.entries.map { it.label to it }, p.seasonPreview) { v -> state.update { it.copy(seasonPreview = v) } }
        }
    }
}

@Composable
private fun TrackerPage(state: AppState) {
    val p = state.prefs
    Section(null, "Tick off each prayer on the Prayer screen once it has passed, and keep a streak. Tap the streak to mark a day as excused, like haid or illness, so it carries on. Kept only on this phone." +
        if (p.trackerEnabled) " The nudge before time runs out is in Alerts and alarms." else "") {
        SwitchRow(tr(R.string.settings_trackerOn), p.trackerEnabled) { on -> state.update { it.copy(trackerEnabled = on) } }
    }
}

@Composable
private fun HadithPage(state: AppState) {
    val p = state.prefs
    Section(null, "Tap ✕ on any hadith to hide just that one.") {
        SwitchRow(tr(R.string.settings_showHadith), p.showHadith, tr(R.string.settings_showHadithSub)) { on ->
            state.update { it.copy(showHadith = on, hiddenHadith = if (on) emptyList() else it.hiddenHadith) }
        }
        SwitchRow(tr(R.string.settings_wakeHadith), p.hadithInAlerts, "One short line under Fajr and tahajjud alerts") { on -> state.update { it.copy(hadithInAlerts = on) } }
    }
}

@Composable
private fun MovePage(openMoveOut: () -> Unit, openMoveIn: () -> Unit) {
    Section(null, "A QR code or link carries your places, choices and tracker. No account and nothing uploaded. Works with Android, iPhone and the web. Setting up a new Android phone from your Google backup brings them too.") {
        LinkRow(tr(R.string.move_title), Icons.Filled.SwapHoriz, openMoveOut)
        LinkRow(tr(R.string.move_bringIn), Icons.Filled.Download, openMoveIn)
    }
}

@Composable
private fun PrivacyPage(state: AppState) {
    val p = state.prefs
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val notificationsOn = remember { androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled() }
    Section(tr(R.string.settings_promise)) {
        LabelRow(Icons.Filled.PanTool, "No outside ads and no accounts")
        LabelRow(Icons.Filled.LocationOff, "Your exact location stays on your phone")
        LabelRow(Icons.Filled.Map, "Masjid search sends only your area")
    }
    Section(null, "Tells us which cities use the app, so we know where to add official timetables. A random number stands in for you. Never your name, exact location or IP address.") {
        SwitchRow("Share anonymous counts", p.shareUsage) { on -> state.update { it.copy(shareUsage = on) } }
    }
    Section("Phone permissions", "If times or alerts look wrong, check these first.") {
        ValueRow(tr(R.string.settings_location), if (state.location.hasPermission) tr(R.string.settings_allowed) else if (p.useGPS) "Not allowed" else tr(R.string.settings_pickedPlace))
        ValueRow(tr(R.string.settings_notificationsWord), if (notificationsOn) tr(R.string.settings_allowed) else tr(R.string.common_off))
        LinkRow("Open phone settings", null) {
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
    Section(null, "The quick guide is a short tour that taps the real buttons for you.") {
        LinkRow(tr(R.string.settings_showGuide), Icons.Filled.Lightbulb, openGuide)
        LinkRow(tr(R.string.settings_faq), null) { runCatching { uri.openUri(SettingsLinks.FAQ) } }
        LinkRow("Help check times where you live", null) { runCatching { uri.openUri(SettingsLinks.VERIFY) } }
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
    Section(null, "Halal Muslim businesses and causes we check by hand, safe for the whole family. Most are our own services, and paid ones are marked Sponsored. We only count how often a card is seen and tapped, never who you are.") {
        SwitchRow("Show $PICKS_NAME", p.showOffers) { on -> state.update { it.copy(showOffers = on) } }
        LinkRow("Our rules for $PICKS_NAME", null) { runCatching { uri.openUri(SettingsLinks.PICKS_RULES) } }
    }
}

@Composable
private fun AboutPage(openCredits: () -> Unit) {
    val uri = LocalUriHandler.current
    Section(null, "Built in Asia, made for Muslims everywhere.") {
        LinkRow(tr(R.string.settings_sources), null, openCredits)
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
        ValueRow(tr(R.string.settings_version), "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            onClick = { TesterUnlock.taps += 1; if (TesterUnlock.taps >= 7) TesterUnlock.on = true })
    }
}

private fun shareApp(context: Context) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain")
        .putExtra(Intent.EXTRA_TEXT, "Prayer Times Asia, free prayer times for iPhone and Android. ${SettingsLinks.APP_PAGE}")
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

/** Android 12+: exact alarms need the user's say-so; without it alerts may be a few minutes late. */

// MARK: Form building blocks

@Composable
fun Section(title: String?, footer: String? = null, content: @Composable ColumnScope.() -> Unit) {
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

@Composable
private fun RowShell(onClick: (() -> Unit)?, description: String? = null, content: @Composable RowScope.() -> Unit) {
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 52.dp)
                // A spoken name for the whole row, so a row cut off at the screen's edge still has one.
                .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier)
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) { content() }
        HorizontalDivider(Modifier.padding(start = 16.dp), color = Palette.primary.copy(alpha = 0.08f))
    }
}

@Composable
fun ValueRow(label: String, value: String, onClick: (() -> Unit)? = null) = RowShell(onClick) {
    Text(label, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
    Text(value, style = Txt.body, color = Palette.secondary, maxLines = 1)
}

@Composable
fun SwitchRow(label: String, checked: Boolean, sub: String? = null, onChange: (Boolean) -> Unit) = RowShell({ onChange(!checked) }) {
    Column(Modifier.weight(1f)) {
        Text(label, style = Txt.body, color = Palette.primary)
        if (sub != null) Text(sub, style = Txt.footnote, color = Palette.secondary)
    }
    Switch(checked, onChange, colors = SwitchDefaults.colors(checkedTrackColor = Palette.success, checkedThumbColor = Color.White,
        uncheckedTrackColor = Palette.primary.copy(alpha = 0.16f), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent))
}

@Composable
fun LinkRow(label: String, icon: ImageVector?, onClick: () -> Unit) = RowShell(onClick) {
    if (icon != null) Icon(icon, null, Modifier.size(22.dp), tint = Palette.primary)
    Text(label, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
    Icon(Icons.Filled.ChevronRight, null, Modifier.size(20.dp), tint = Palette.secondary)
}

@Composable
private fun LabelRow(icon: ImageVector, label: String) = RowShell(null) {
    Icon(icon, null, Modifier.size(20.dp), tint = Palette.primary)
    Text(label, style = Txt.footnote, color = Palette.primary, modifier = Modifier.weight(1f))
}

@Composable
private fun StepperRow(label: String, value: String, canDown: Boolean, canUp: Boolean, onDown: () -> Unit, onUp: () -> Unit) = RowShell(null) {
    Column(Modifier.weight(1f)) {
        Text(label, style = Txt.body, color = Palette.primary)
        Text(value, style = Txt.footnote, color = Palette.secondary)
    }
    Row(Modifier.clip(CircleShape).background(Palette.primary.copy(alpha = 0.1f))) {
        Box(Modifier.size(44.dp, 32.dp).clickable(enabled = canDown, onClick = onDown), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Remove, "Less", tint = Palette.primary.copy(alpha = if (canDown) 1f else 0.3f))
        }
        Box(Modifier.size(44.dp, 32.dp).clickable(enabled = canUp, onClick = onUp), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Add, "More", tint = Palette.primary.copy(alpha = if (canUp) 1f else 0.3f))
        }
    }
}

/** A row that shows its value and opens a single-choice list. */
@Composable
fun <T> PickerRow(label: String, value: String, options: List<Pair<String, T>>, selected: T, onPick: (T) -> Unit) {
    var open by remember { mutableStateOf(false) }
    RowShell({ open = true }) {
        Text(label, style = Txt.body, color = Palette.primary)
        Text(value, style = Txt.body, color = Palette.secondary, maxLines = 1, modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.End)
        Icon(Icons.Filled.UnfoldMore, null, Modifier.size(18.dp), tint = Palette.secondary)
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
                            RadioButton(v == selected, { onPick(v); open = false }, colors = RadioButtonDefaults.colors(selectedColor = Palette.accent))
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
