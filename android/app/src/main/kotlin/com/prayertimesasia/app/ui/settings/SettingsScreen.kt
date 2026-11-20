package com.prayertimesasia.app.ui.settings

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.background
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
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(state.skyNow)
        LazyColumn(Modifier.fillMaxSize(), state = listState) {
            item {
                Text(tr(R.string.settings_title), style = display(34.sp, FontWeight.Bold), color = Palette.primary,
                    modifier = Modifier.padding(start = Dims.gutter, top = 16.dp, bottom = 4.dp))
            }
            item {
                // The app's own card: the icon on the navy compass-ring colour. Opens Sources & credits.
                AppCard("${BuildConfig.VERSION_NAME}", openCredits, Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            }
            item {
                Section(tr(R.string.settings_location)) {
                    ValueRow(tr(R.string.settings_place), r.activePlace?.name ?: "Not set", onClick = openPlaces)
                    ValueRow(tr(R.string.settings_countryRules), if (r.profile.code.isEmpty()) r.profile.name else "${r.profile.flag} ${r.profile.name}")
                }
            }
            item {
                val next = com.prayertimesasia.app.alarms.AlarmScheduler.nextWakeUp(r, state.now)
                val notify = Prayer.all.count { p.alertMode(it) == com.prayertimesasia.core.AlertMode.NOTIFY }
                val alarm = Prayer.all.count { p.alertMode(it) == com.prayertimesasia.core.AlertMode.ALARM }
                Section("Alerts and alarms", "Each prayer Off, Notify or Alarm, the ${Prayer.DHUHR.name(r.naming, true)} reminder, sahur, Ramadan, sound and quiet hours, all in one place. Also on the Prayer screen. Tap the alarm clock at the top, or a prayer's bell.") {
                    ValueRow("Alerts and alarms", when {
                        notify + alarm == 0 && next == null -> "Off"
                        else -> listOfNotNull(
                            if (notify > 0) "$notify notify" else null,
                            if (alarm > 0) "$alarm alarm${if (alarm > 1) "s" else ""}" else null,
                            next?.let { "next ${r.formatted(it.at)}" },
                        ).joinToString(", ")
                    }) { state.openAlerts() }
                }
            }
            item {
                Section(tr(R.string.settings_ramadan),
                    if (p.seasonPreview == com.prayertimesasia.core.SeasonPreview.OFF)
                        "Ramadan mode turns on by itself on the day your local religious authority announces. Testers can pretend it's Ramadan or Raya with the switch above."
                    else "Pretend mode is on. The app shows a pretend date, not today's. Turn it off before you rely on the times.") {
                    LinkRow(tr(R.string.settings_ramadanPage), Icons.Filled.NightsStay) { state.showRamadan = true }
                    PickerRow(tr(R.string.settings_tryRamadan), p.seasonPreview.label,
                        com.prayertimesasia.core.SeasonPreview.entries.map { it.label to it }, p.seasonPreview) { v -> state.update { it.copy(seasonPreview = v) } }
                }
            }
            item {
                Section(tr(R.string.settings_travel), tr(R.string.settings_travelFoot)) {
                    SwitchRow(tr(R.string.settings_musafir), p.musafirEnabled) { on -> state.update { it.copy(musafirEnabled = on) } }
                    if (p.musafirEnabled) LinkRow(tr(R.string.settings_journey), AppIcons.journey) { state.showJourney = true }
                }
            }
            item {
                Section(tr(R.string.settings_calculation), "${r.sourceSummary} Automatic follows the country you're in, so landing in a new country switches it for you. ${r.method.note}") {
                    PickerRow(tr(R.string.settings_method), if (p.methodOverrideId == null) "Automatic · ${r.profile.method.shortName}" else r.method.name,
                        listOf<Pair<String, String?>>("Automatic · ${r.profile.method.shortName}" to null) + CalculationMethod.all.map { it.name to it.id },
                        p.methodOverrideId) { id -> state.update { it.copy(methodOverrideId = id) } }
                    PickerRow(tr(R.string.settings_asr), p.asrOverride?.label ?: "Automatic · ${if (r.profile.asr == AsrSchool.HANAFI) "Hanafi" else "Shafi'i"}",
                        listOf<Pair<String, AsrSchool?>>("Automatic · ${if (r.profile.asr == AsrSchool.HANAFI) "Hanafi" else "Shafi'i"}" to null) +
                            AsrSchool.entries.map { it.label to it },
                        p.asrOverride) { a -> state.update { it.copy(asrOverride = a) } }
                    val place = r.activePlace
                    if (r.method.id == "jakim" && place != null) {
                        val nearest = Official.nearestJakimZone(place.coordinates)
                        PickerRow(tr(R.string.settings_jakimZone), p.jakimZoneOverride ?: "Automatic · $nearest",
                            listOf<Pair<String, String?>>("Automatic · $nearest" to null) + JakimZones.zones.map { "${it.id} · ${it.areas}" to it.id },
                            p.jakimZoneOverride) { z -> state.update { it.copy(jakimZoneOverride = z) } }
                    }
                    val source = r.officialSource
                    ValueRow(tr(R.string.settings_timetable), when {
                        source == null -> "Calculated on device"
                        state.official.hasTable(source, LocalDate.now(r.zone).year) -> "Official · downloaded"
                        else -> "Official · will download when online"
                    })
                    source?.calendarFeed?.let { feed ->
                        LinkRow("Subscribe in a calendar app", Icons.Filled.Event) { openFeed(context, feed) }
                    }
                    LinkRow(tr(R.string.settings_add30), Icons.Filled.Event) {
                        CalendarFile.share(context, state, Prayer.obligatory)
                    }
                    LinkRow("Only ${Prayer.DHUHR.name(r.naming)} and ${Prayer.ASR.name(r.naming)}, for a work calendar", Icons.Filled.Work) {
                        CalendarFile.share(context, state, listOf(Prayer.DHUHR, Prayer.ASR))
                    }
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                item {
                    Section(tr(R.string.settings_language), tr(R.string.settings_languageFoot)) {
                        val picked = remember { mutableStateOf(AppWords.picked(context)) }
                        val automatic = tr(R.string.common_automatic)
                        PickerRow(tr(R.string.settings_language), AppWords.LANGUAGES.firstOrNull { it.first == picked.value }?.second ?: automatic,
                            listOf<Pair<String, String?>>(automatic to null) + AppWords.LANGUAGES.map { it.second to it.first },
                            picked.value) { lang -> picked.value = lang; AppWords.pick(context, lang) }
                    }
                }
            }
            item {
                Section(tr(R.string.settings_names), "Automatic shows English names like Fajr and Isha, or your phone's language if we have it. Pick Malay for Subuh and Isyak. Your names stay the same wherever you go. When you travel somewhere that uses other words, the local name shows small beside it, like Subuh in Kuala Lumpur, so the masjid's signs make sense. Spellings follow each authority's own timetable.") {
                    PickerRow(tr(R.string.settings_names), p.namingOverride?.language ?: "Automatic · ${r.personalNaming.language}",
                        listOf<Pair<String, NamingStyle?>>("Automatic · ${r.personalNaming.language}" to null) + NamingStyle.entries.map { it.label to it },
                        p.namingOverride) { n -> state.update { it.copy(namingOverride = n) } }
                    SwitchRow(tr(R.string.settings_localNames), p.showLocalNames) { on -> state.update { it.copy(showLocalNames = on) } }
                }
            }
            item {
                Section(tr(R.string.settings_hadith), "A short hadith or ayah on some screens, and one line under each prayer alert. Tap ✕ on any hadith to hide just that one. Turn both off for a clean app with times only.") {
                    SwitchRow(tr(R.string.settings_showHadith), p.showHadith) { on ->
                        state.update { it.copy(showHadith = on, hiddenHadith = if (on) emptyList() else it.hiddenHadith) }
                    }
                    SwitchRow("Add a hadith to wake-up alerts", p.hadithInAlerts) { on -> state.update { it.copy(hadithInAlerts = on) } }
                }
            }
            item {
                Section(tr(R.string.settings_tracker), "Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only on this phone. The nudge before time runs out is in Alerts and alarms.") {
                    SwitchRow(tr(R.string.settings_trackerOn), p.trackerEnabled) { on -> state.update { it.copy(trackerEnabled = on) } }
                }
            }
            item {
                Section("Home screen", "Add widgets from your home screen: touch and hold an empty space, tap Widgets, then find Prayer Times Asia. The big timetable follows your Prayer screen style.") {
                    LinkRow("See the big timetable widget", null, openWidgetPreview)
                }
            }
            item {
                Section(tr(R.string.settings_display)) {
                    PickerRow(tr(R.string.settings_appearance), p.appearance.label, Appearance.entries.map { it.label to it }, p.appearance) { a ->
                        state.update { it.copy(appearance = a) }
                    }
                    PickerRow(tr(R.string.settings_prayerScreen), p.todayStyle.label, TodayStyle.entries.map { it.label to it }, p.todayStyle) { s ->
                        state.update { it.copy(todayStyle = s) }
                    }
                    SwitchRow(tr(R.string.settings_biggerText), p.largeText) { on -> state.update { it.copy(largeText = on) } }
                    SwitchRow(tr(R.string.settings_opening), p.showOpening,
                        "The moving dial you see as the app opens. Turn it off to go straight to your prayer times. It always shows the first time.") { on ->
                        state.update { it.copy(showOpening = on) }
                    }
                    SwitchRow("24-hour time", p.use24Hour) { on -> state.update { it.copy(use24Hour = on) } }
                    StepperRow("Hijri date adjustment", if (p.hijriAdjustment == 0) "None" else String.format(java.util.Locale.ROOT, "%+d day", p.hijriAdjustment),
                        canDown = p.hijriAdjustment > -2, canUp = p.hijriAdjustment < 2,
                        onDown = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment - 1) } },
                        onUp = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment + 1) } })
                }
            }
            item {
                Section(tr(R.string.settings_moving), "Your places, choices and tracker history travel inside a QR code or link - no account, nothing uploaded. Works between Android, iPhone and the web. Setting up a new Android phone from your Google backup brings them too.") {
                    LinkRow(tr(R.string.move_title), Icons.Filled.SwapHoriz, openMoveOut)
                    LinkRow(tr(R.string.move_bringIn), Icons.Filled.Download, openMoveIn)
                }
            }
            item {
                Section("Help", "A short tour that taps the real buttons, so you know where everything is.") {
                    LinkRow("Show the quick guide", Icons.Filled.Lightbulb, openGuide)
                }
            }
            item {
                Section(tr(R.string.settings_accuracy)) {
                    Text("Every day shows its source grade: A official, B masjid-confirmed, C community-verified, D calculated. F (falak) marks a reading from your own shadow stick, which only checks the times. In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year (only the year, zone code or regency name is sent) and keeps it for offline use. Everywhere else, and before that download, times are calculated on your phone with the country's own method. That calculation is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia and Indonesia it is within about 2 minutes.",
                        style = Txt.footnote, color = Palette.primary, modifier = Modifier.padding(16.dp))
                }
            }
            item {
                Section(tr(R.string.settings_privacy), "Usage counts tell us how many people use the app and in which city and country, so we know where to add official timetables. A random number stands in for you: no name, no exact location, no IP address kept.") {
                    LabelRow(Icons.Filled.PanTool, "No outside ads, no accounts, no tracking across other apps.")
                    LabelRow(Icons.Filled.LocationOff, "Your exact location never leaves your phone.")
                    LabelRow(Icons.Filled.Map, "Nearby masjid search sends only the search area to OpenStreetMap.")
                    SwitchRow(tr(R.string.settings_usage), p.shareUsage) { on -> state.update { it.copy(shareUsage = on) } }
                }
            }
            item {
                Section(PICKS_NAME, "Barakah Picks is not a normal ad. It is one small space we check by hand for halal Muslim businesses and causes, safe for the whole family. No gambling, alcohol, riba or anything immodest, and never Google, Facebook or Instagram ads. Most picks are our own services, and paid ones are marked Sponsored. We keep only simple counts of how often each card is seen and tapped, never who you are.") {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CommunityCard.ours(state.offerCountry).forEach { MakersCard(it, "settings", state = state) }
                    }
                    SwitchRow("Show $PICKS_NAME", p.showOffers) { on -> state.update { it.copy(showOffers = on) } }
                }
            }
            item {
                Section(null, "Prayer Times Asia. Built in Asia, made for Muslims everywhere.") {
                    LinkRow("Rate and review", Icons.Outlined.StarOutline, openReview)
                    LinkRow("Send a note to the makers", Icons.Outlined.Email, openNote)
                    LinkRow("Sources & credits", null, openCredits)
                    LinkRow(tr(R.string.settings_helpVerify), null) {
                        runCatching { uri.openUri("https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md") }
                    }
                    LinkRow(tr(R.string.settings_designLook), null) {
                        runCatching { uri.openUri("https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md") }
                    }
                    ValueRow(tr(R.string.settings_version), "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
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
private fun RowShell(onClick: (() -> Unit)?, content: @Composable RowScope.() -> Unit) {
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 52.dp).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
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
