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
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Add
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
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.makers.MakersCard
import com.prayertimesasia.app.ui.makers.MakersOffer
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
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.WakeUpTiming
import java.time.LocalDate

@Composable
fun SettingsScreen(
    state: AppState,
    openPlaces: () -> Unit,
    openWidgetPreview: () -> Unit,
    openCredits: () -> Unit,
    listState: LazyListState = rememberLazyListState(),
) {
    val r = state.resolver
    val p = state.prefs
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(state.skyNow)
        LazyColumn(Modifier.fillMaxSize(), state = listState) {
            item {
                Text("Settings", style = display(34.sp, FontWeight.Bold), color = Palette.primary,
                    modifier = Modifier.padding(start = Dims.gutter, top = 16.dp, bottom = 4.dp))
            }
            item {
                Section("Location") {
                    ValueRow("Place", r.activePlace?.name ?: "Not set", onClick = openPlaces)
                    ValueRow("Country rules", if (r.profile.code.isEmpty()) "Outside Asia" else "${r.profile.flag} ${r.profile.name}")
                }
            }
            item {
                Section("Travel", "Jamak and qasar guidance, combined prayer windows and a log of where you've prayed. We'll ask when you land in another country.") {
                    SwitchRow("Musafir features", p.musafirEnabled) { on -> state.update { it.copy(musafirEnabled = on) } }
                    if (p.musafirEnabled) LinkRow("Journey", AppIcons.journey) { state.showJourney = true }
                }
            }
            item {
                Section("Calculation", "Automatic follows the country you're in, so landing in a new country switches it for you. ${r.method.note}") {
                    PickerRow("Method", if (p.methodOverrideId == null) "Automatic · ${r.profile.method.shortName}" else r.method.name,
                        listOf<Pair<String, String?>>("Automatic · ${r.profile.method.shortName}" to null) + CalculationMethod.all.map { it.name to it.id },
                        p.methodOverrideId) { id -> state.update { it.copy(methodOverrideId = id) } }
                    PickerRow("Asr", p.asrOverride?.label ?: "Automatic · ${if (r.profile.asr == AsrSchool.HANAFI) "Hanafi" else "Shafi'i"}",
                        listOf<Pair<String, AsrSchool?>>("Automatic · ${if (r.profile.asr == AsrSchool.HANAFI) "Hanafi" else "Shafi'i"}" to null) +
                            AsrSchool.entries.map { it.label to it },
                        p.asrOverride) { a -> state.update { it.copy(asrOverride = a) } }
                    val place = r.activePlace
                    if (r.method.id == "jakim" && place != null) {
                        val nearest = Official.nearestJakimZone(place.coordinates)
                        PickerRow("JAKIM zone", p.jakimZoneOverride ?: "Automatic · $nearest",
                            listOf<Pair<String, String?>>("Automatic · $nearest" to null) + JakimZones.zones.map { "${it.id} · ${it.areas}" to it.id },
                            p.jakimZoneOverride) { z -> state.update { it.copy(jakimZoneOverride = z) } }
                    }
                    val source = r.officialSource
                    ValueRow("Timetable", when {
                        source == null -> "Calculated on device"
                        state.official.hasTable(source, LocalDate.now(r.zone).year) -> "Official · downloaded"
                        else -> "Official · will download when online"
                    })
                    source?.calendarFeed?.let { feed ->
                        LinkRow("Subscribe in a calendar app", Icons.Filled.Event) { openFeed(context, feed) }
                    }
                }
            }
            item {
                Section("Prayer names", "Your names stay the same wherever you are: Automatic uses your home country's words, or your phone's language. When you travel somewhere that uses different words, the local name appears small beside it - \"Fajr\" with \"Subuh\" in Kuala Lumpur - so the masjid's signs make sense. Spellings follow each authority's own timetable.") {
                    PickerRow("Prayer names", p.namingOverride?.language ?: "Automatic · ${r.personalNaming.language}",
                        listOf<Pair<String, NamingStyle?>>("Automatic · ${r.personalNaming.language}" to null) + NamingStyle.entries.map { it.label to it },
                        p.namingOverride) { n -> state.update { it.copy(namingOverride = n) } }
                    SwitchRow("Show local names when travelling", p.showLocalNames) { on -> state.update { it.copy(showLocalNames = on) } }
                }
            }
            item {
                val fajr = Prayer.FAJR.name(r.naming)
                Section("Wake-up", "An alarm-style alert that sounds even when the phone is on silent (where your phone allows it). Moves with $fajr every day and wherever you travel.") {
                    PickerRow("$fajr wake-up", p.wakeUp?.label(r.naming) ?: "Off",
                        listOf<Pair<String, WakeUpTiming?>>("Off" to null) + WakeUpTiming.entries.map { it.label(r.naming) to it },
                        p.wakeUp) { w ->
                        if (w != null) state.enableAlerts()
                        state.update { it.copy(wakeUp = w) }
                    }
                }
            }
            item {
                Section("Tracker", "Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only on this phone.") {
                    SwitchRow("Prayer tracker", p.trackerEnabled) { on -> state.update { it.copy(trackerEnabled = on) } }
                }
            }
            item {
                Section("Home screen", "Add widgets from your home screen: touch and hold an empty space, tap Widgets, then find Prayer Times Asia. The big timetable follows your Prayer screen style.") {
                    LinkRow("See the big timetable widget", null, openWidgetPreview)
                }
            }
            item {
                Section("Display") {
                    PickerRow("Appearance", p.appearance.label, Appearance.entries.map { it.label to it }, p.appearance) { a ->
                        state.update { it.copy(appearance = a) }
                    }
                    PickerRow("Prayer screen", p.todayStyle.label, TodayStyle.entries.map { it.label to it }, p.todayStyle) { s ->
                        state.update { it.copy(todayStyle = s) }
                    }
                    SwitchRow("24-hour time", p.use24Hour) { on -> state.update { it.copy(use24Hour = on) } }
                    StepperRow("Hijri date adjustment", if (p.hijriAdjustment == 0) "None" else String.format(java.util.Locale.ROOT, "%+d day", p.hijriAdjustment),
                        canDown = p.hijriAdjustment > -2, canUp = p.hijriAdjustment < 2,
                        onDown = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment - 1) } },
                        onUp = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment + 1) } })
                }
            }
            item {
                Section("Alerts", "An alert at the exact time of each prayer you choose, plus an early reminder if you like. Worked out on your phone and topped up every time you open the app and when the phone restarts - nothing comes from a server.") {
                    SwitchRow("Prayer time alerts", p.notificationsEnabled) { on ->
                        if (on) state.enableAlerts() else state.update { it.copy(notificationsEnabled = false) }
                    }
                    if (p.notificationsEnabled) {
                        Prayer.all.forEach { prayer ->
                            SwitchRow(if (prayer == Prayer.SUNRISE) "${prayer.name(r.naming)} (${Prayer.FAJR.name(r.naming)} ends)" else prayer.name(r.naming),
                                prayer in p.notifyPrayers) { on ->
                                state.update { it.copy(notifyPrayers = if (on) it.notifyPrayers + prayer else it.notifyPrayers - prayer) }
                            }
                        }
                        PickerRow("Early reminder", if (p.reminderMinutesBefore == 0) "Off" else "${p.reminderMinutesBefore} min before",
                            listOf("Off" to 0, "5 min before" to 5, "10 min before" to 10, "15 min before" to 15), p.reminderMinutesBefore) { m ->
                            state.update { it.copy(reminderMinutesBefore = m) }
                        }
                        ExactAlarmRow(context)
                    }
                }
            }
            item {
                Section("Accuracy") {
                    Text("Every day shows its source grade: A official, B masjid-confirmed, C community-verified, D calculated. F (falak) marks a reading from your own shadow stick, which only checks the times. In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year (only the year, zone code or regency name is sent) and keeps it for offline use. Everywhere else, and before that download, times are calculated on your phone with the country's own method. That calculation is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia and Indonesia it is within about 2 minutes.",
                        style = Txt.footnote, color = Palette.primary, modifier = Modifier.padding(16.dp))
                }
            }
            item {
                Section("Privacy") {
                    LabelRow(Icons.Filled.PanTool, "No third-party ads, no accounts, no tracking.")
                    LabelRow(Icons.Filled.LocationOff, "Your location never leaves your phone.")
                    LabelRow(Icons.Filled.Map, "Nearby masjid search sends only the search area to OpenStreetMap.")
                }
            }
            item {
                Section("From the makers", "Prayer Times Asia is free and built fisabilillah by Nasar Pte Ltd. The only offers you will see are our own - no ad networks, nothing tracked.") {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        MakersOffer.entries.forEach { MakersCard(it, "settings") }
                    }
                    SwitchRow("Show offers on Prayer and Masjid", p.showOffers) { on -> state.update { it.copy(showOffers = on) } }
                }
            }
            item {
                Section(null, "Prayer Times Asia - made for Muslims living and travelling across Asia.") {
                    LinkRow("Sources & credits", null, openCredits)
                    LinkRow("Help verify times where you are", null) {
                        runCatching { uri.openUri("https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md") }
                    }
                    ValueRow("Version", "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
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
@Composable
private fun ExactAlarmRow(context: Context) {
    if (Build.VERSION.SDK_INT < 31) return
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    var allowed by remember { mutableStateOf(am.canScheduleExactAlarms()) }
    LaunchedEffect(Unit) { allowed = am.canScheduleExactAlarms() }
    if (allowed) return
    LinkRow("Allow alerts at the exact minute", null) {
        runCatching {
            context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}

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
fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) = RowShell({ onChange(!checked) }) {
    Text(label, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
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
            confirmButton = { TextButton({ open = false }) { Text("Close") } },
        )
    }
}
