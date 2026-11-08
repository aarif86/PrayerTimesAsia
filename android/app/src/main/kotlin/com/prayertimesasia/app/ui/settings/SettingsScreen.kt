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
import androidx.compose.material.icons.filled.NightsStay
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.LocationOff
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
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.makers.MakersCard
import com.prayertimesasia.app.ui.makers.MakersOffer
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
import com.prayertimesasia.core.PrayerWindow
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
                // The app's own card: the icon on the navy compass-ring colour. Opens Sources & credits.
                AppCard("${BuildConfig.VERSION_NAME}", openCredits, Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            }
            item {
                Section("Location") {
                    ValueRow("Place", r.activePlace?.name ?: "Not set", onClick = openPlaces)
                    ValueRow("Country rules", if (r.profile.code.isEmpty()) r.profile.name else "${r.profile.flag} ${r.profile.name}")
                }
            }
            item {
                Section("Ramadan and Syawal",
                    if (p.seasonPreview == com.prayertimesasia.core.SeasonPreview.OFF)
                        "Ramadan mode turns on by itself on the day your local religious authority announces. Testers can pretend it's Ramadan or Raya with the switch above."
                    else "Pretend mode is on. The app shows a pretend date, not today's. Turn it off before you rely on the times.") {
                    LinkRow("Ramadan page", Icons.Filled.NightsStay) { state.showRamadan = true }
                    PickerRow("Try Ramadan (for testers)", p.seasonPreview.label,
                        com.prayertimesasia.core.SeasonPreview.entries.map { it.label to it }, p.seasonPreview) { v -> state.update { it.copy(seasonPreview = v) } }
                    SwitchRow("Imsak alert", p.imsakAlert) { on -> state.setRamadanAlert(on) { q, v -> q.copy(imsakAlert = v) } }
                    SwitchRow("Berbuka alert", p.berbukaAlert) { on -> state.setRamadanAlert(on) { q, v -> q.copy(berbukaAlert = v) } }
                    SwitchRow("Qiyam in the last ten nights", p.qiyamAlert) { on -> state.setRamadanAlert(on) { q, v -> q.copy(qiyamAlert = v) } }
                }
            }
            item {
                val next = com.prayertimesasia.app.alarms.AlarmScheduler.nextWakeUp(r, state.now)
                Section("Alarms", "Also on the Prayer screen. Tap the alarm clock at the top.") {
                    ValueRow("Prayer alarms", when {
                        next != null -> "Next ${r.formatted(next.at)}"
                        p.anyAlarm -> "On"
                        else -> "Off"
                    }) { state.showWakeUp = true }
                }
            }
            item {
                Section("Travel", "Jamak and qasar guidance, combined prayer windows and a log of where you've prayed. We'll ask when you land in another country.") {
                    SwitchRow("Musafir features", p.musafirEnabled) { on -> state.update { it.copy(musafirEnabled = on) } }
                    if (p.musafirEnabled) LinkRow("Journey", AppIcons.journey) { state.showJourney = true }
                }
            }
            item {
                Section("Calculation", "${r.sourceSummary} Automatic follows the country you're in, so landing in a new country switches it for you. ${r.method.note}") {
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
                    LinkRow("Add the next 30 days to a calendar", Icons.Filled.Event) {
                        CalendarFile.share(context, state, Prayer.obligatory)
                    }
                    LinkRow("Only ${Prayer.DHUHR.name(r.naming)} and ${Prayer.ASR.name(r.naming)}, for a work calendar", Icons.Filled.Work) {
                        CalendarFile.share(context, state, listOf(Prayer.DHUHR, Prayer.ASR))
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
                Section("Hadith", "A short hadith or ayah on some screens, and one line under each prayer alert. Tap ✕ on any hadith to hide just that one. Turn both off for a clean app with times only.") {
                    SwitchRow("Show hadith in the app", p.showHadith) { on ->
                        state.update { it.copy(showHadith = on, hiddenHadith = if (on) emptyList() else it.hiddenHadith) }
                    }
                    SwitchRow("Add a hadith to alerts", p.hadithInAlerts) { on -> state.update { it.copy(hadithInAlerts = on) } }
                }
            }
            item {
                val nudgeNote = if (p.trackerEnabled) " Nudge before time runs out sends one gentle alert about 30 minutes before a prayer's time ends, only if you haven't ticked it. Not for ${Prayer.ISHA.name(r.naming)}, which stays open until ${Prayer.FAJR.name(r.naming)}. Never while paused." else ""
                Section("Tracker", "Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only on this phone.$nudgeNote") {
                    SwitchRow("Prayer tracker", p.trackerEnabled) { on -> state.update { it.copy(trackerEnabled = on) } }
                    if (p.trackerEnabled) {
                        SwitchRow("Nudge before time runs out", p.windowNudge) { on -> state.update { it.copy(windowNudge = on) } }
                    }
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
                    SwitchRow("Bigger text", p.largeText) { on -> state.update { it.copy(largeText = on) } }
                    SwitchRow("24-hour time", p.use24Hour) { on -> state.update { it.copy(use24Hour = on) } }
                    StepperRow("Hijri date adjustment", if (p.hijriAdjustment == 0) "None" else String.format(java.util.Locale.ROOT, "%+d day", p.hijriAdjustment),
                        canDown = p.hijriAdjustment > -2, canUp = p.hijriAdjustment < 2,
                        onDown = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment - 1) } },
                        onUp = { state.update { it.copy(hijriAdjustment = it.hijriAdjustment + 1) } })
                }
            }
            item {
                Section("Alerts", "Prayer time alerts ring at the exact time of each prayer you choose. Reminder before prayer gives you a heads-up a few minutes earlier (15 by default), so a meeting or work doesn't run past it - turn on either or both. With Play the azan on (when available), prayer time alerts play the azan, and a Subuh azan at Subuh. To let them through Do Not Disturb, allow reminders there. Worked out on your phone and topped up every time you open the app and when the phone restarts - nothing comes from a server.") {
                    SwitchRow("Prayer time alerts", p.notificationsEnabled) { on ->
                        if (on) state.enableAlerts() else state.update { it.copy(notificationsEnabled = false) }
                    }
                    if (p.notificationsEnabled && Azan.isAvailable(context)) {
                        SwitchRow("Play the azan", p.azanSound) { on -> state.update { it.copy(azanSound = on) } }
                    }
                    SwitchRow("Reminder before prayer", p.reminderMinutesBefore > 0) { on ->
                        if (on) state.enableReminder() else state.update { it.copy(reminderMinutesBefore = 0) }
                    }
                    if (p.reminderMinutesBefore > 0) {
                        PickerRow("Remind me", "${p.reminderMinutesBefore} min before",
                            AlarmScheduler.REMINDER_CHOICES.map { "$it min before" to it }, p.reminderMinutesBefore) { m ->
                            state.update { it.copy(reminderMinutesBefore = m) }
                        }
                    }
                    if (p.notificationsEnabled || p.reminderMinutesBefore > 0) {
                        Prayer.all.forEach { prayer ->
                            SwitchRow(if (prayer == Prayer.SUNRISE) "${prayer.name(r.naming)} (${Prayer.FAJR.name(r.naming)} ends)" else prayer.name(r.naming),
                                prayer in p.notifyPrayers) { on ->
                                state.update { it.copy(notifyPrayers = if (on) it.notifyPrayers + prayer else it.notifyPrayers - prayer) }
                            }
                        }
                        ExactAlarmRow(context)
                    }
                }
            }
            item {
                Section("Quiet alerts", "For shift workers sleeping in the day, a baby asleep in the room, or simply a calm night. Alerts still come, but they only buzz. ${Prayer.FAJR.name(r.naming)} keeps its sound so it can wake you.") {
                    SwitchRow("Buzz only, no sound", p.buzzOnly) { on -> state.update { it.copy(buzzOnly = on) } }
                    SwitchRow("Quiet hours", p.quietHours) { on -> state.update { it.copy(quietHours = on) } }
                    if (p.quietHours) {
                        val halfHours = (0 until 1440 step 30).toList()
                        PickerRow("From", r.clock(p.quietFrom), halfHours.map { r.clock(it) to it }, p.quietFrom) { m ->
                            state.update { it.copy(quietFrom = m) }
                        }
                        PickerRow("Until", r.clock(p.quietTo), halfHours.map { r.clock(it) to it }, p.quietTo) { m ->
                            state.update { it.copy(quietTo = m) }
                        }
                    }
                }
            }
            item {
                val friday = Prayer.DHUHR.name(r.naming, true)
                val zohor = Prayer.DHUHR.name(r.naming)
                Section(friday, "A reminder on Fridays to get ready and leave in time. It uses your masjid's own $friday time when you have set one in the Masjid tab, otherwise the start of $zohor. $friday is not required of women, travellers or the sick, who pray $zohor instead.") {
                    PickerRow("Remind me to leave", if (p.jumuahReminderMinutes == 0) "Off" else "${p.jumuahReminderMinutes} min before",
                        PrayerWindow.JUMUAH_REMINDER_CHOICES.map { (if (it == 0) "Off" else "$it min before") to it }, p.jumuahReminderMinutes) { m ->
                        if (m > 0) state.enableJumuahReminder(m) else state.update { it.copy(jumuahReminderMinutes = 0) }
                    }
                }
            }
            item {
                Section("Moving to another phone", "Your places, choices and tracker history travel inside a QR code or link - no account, nothing uploaded. Works between Android, iPhone and the web. Setting up a new Android phone from your Google backup brings them too.") {
                    LinkRow("Move my settings", Icons.Filled.SwapHoriz, openMoveOut)
                    LinkRow("Bring in settings", Icons.Filled.Download, openMoveIn)
                }
            }
            item {
                Section("Accuracy") {
                    Text("Every day shows its source grade: A official, B masjid-confirmed, C community-verified, D calculated. F (falak) marks a reading from your own shadow stick, which only checks the times. In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year (only the year, zone code or regency name is sent) and keeps it for offline use. Everywhere else, and before that download, times are calculated on your phone with the country's own method. That calculation is checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia and Indonesia it is within about 2 minutes.",
                        style = Txt.footnote, color = Palette.primary, modifier = Modifier.padding(16.dp))
                }
            }
            item {
                Section("Privacy", "Usage counts tell us how many people use the app and in which city and country, so we know where to add official timetables. A random number stands in for you: no name, no exact location, no IP address kept.") {
                    LabelRow(Icons.Filled.PanTool, "No third-party ads, no accounts, no tracking across other apps.")
                    LabelRow(Icons.Filled.LocationOff, "Your exact location never leaves your phone.")
                    LabelRow(Icons.Filled.Map, "Nearby masjid search sends only the search area to OpenStreetMap.")
                    SwitchRow("Share anonymous usage counts", p.shareUsage) { on -> state.update { it.copy(shareUsage = on) } }
                }
            }
            item {
                Section("From the makers", "Prayer Times Asia is free and built fisabilillah in Singapore by Ustaz Aarif Raziff and Nasar Digital (Nasar Pte Ltd). The only offers you will see are our own - no ad networks, nothing tracked.") {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        MakersOffer.entries.forEach { MakersCard(it, "settings") }
                    }
                    SwitchRow("Show offers on Prayer and Masjid", p.showOffers) { on -> state.update { it.copy(showOffers = on) } }
                }
            }
            item {
                Section(null, "Prayer Times Asia. Built in Asia, made for Muslims everywhere.") {
                    LinkRow("Sources & credits", null, openCredits)
                    LinkRow("Help verify times where you are", null) {
                        runCatching { uri.openUri("https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md") }
                    }
                    LinkRow("Design a new look", null) {
                        runCatching { uri.openUri("https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md") }
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
