package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Functions
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.quietClick
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.CalendarAnnouncement
import com.prayertimesasia.core.CalendarSanad
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.SourceGrade
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

val SourceGrade.icon: ImageVector
    get() = when (this) {
        SourceGrade.OFFICIAL -> Icons.Filled.VerifiedUser
        SourceGrade.MASJID -> Icons.Filled.AccountBalance
        SourceGrade.COMMUNITY -> Icons.Filled.People
        SourceGrade.CALCULATED -> Icons.Filled.Functions
        SourceGrade.FALAK -> Icons.Filled.WbSunny
    }

/** "Every time has a source. We show it." - "A · Official · MUIS ⓘ" */
@Composable
fun SourceBadge(state: AppState, day: PrayerDay, compact: Boolean = true, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val r = state.resolver
    val short = when (day.grade) {
        SourceGrade.OFFICIAL -> "${day.grade.title} · ${r.officialSource?.authority ?: r.method.shortName}"
        SourceGrade.MASJID, SourceGrade.COMMUNITY -> day.mosqueName ?: day.grade.title
        else -> "${day.grade.title} · ${r.method.shortName}"
    }
    val full = "${day.grade.title} · ${day.officialSource ?: "${r.method.shortName} method"}"
    Row(
        modifier
            .clip(CircleShape)
            .background(Palette.primary.copy(alpha = if (compact) 0.1f else 0.12f), CircleShape)
            .clickable(onClick = onClick)
            .semantics { contentDescription = "Source: grade ${day.grade.code}, $full" }
            .padding(horizontal = if (compact) 9.dp else 12.dp, vertical = if (compact) 5.dp else 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(if (compact) 18.dp else 20.dp).clip(CircleShape).background(day.grade.tint.copy(alpha = 0.9f)),
            contentAlignment = Alignment.Center) {
            Text(day.grade.code, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color.Black.copy(alpha = 0.8f))
        }
        Text(if (compact) short else full, style = if (compact) Txt.captionSemibold else Txt.footnoteSemibold,
            color = Palette.primary, maxLines = 1, modifier = if (compact) Modifier else Modifier.weight(1f, fill = false))
        Icon(Icons.Outlined.Info, null, Modifier.size(if (compact) 12.dp else 15.dp), tint = Palette.primary.copy(alpha = 0.7f))
    }
}

/** A bottom sheet with the app's own colours. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppSheet(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    val dark = LocalSkyScheme.current.dark
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = if (dark) Color(0xFF15182E) else Color(0xFFF5F5F9),
        contentColor = if (dark) Color.White else Color(0xFF111114),
    ) { content() }
}

@Composable
fun SectionHeader(text: String) {
    Text(text.uppercase(), style = Txt.captionSemibold.copy(letterSpacing = 0.5.sp), color = Palette.secondary,
        modifier = Modifier.padding(top = 18.dp, bottom = 6.dp))
}

/** Where today's times come from, the grades, and how to help verify them. */
@Composable
fun SanadSheetContent(state: AppState, day: PrayerDay) {
    val r = state.resolver
    val uri = LocalUriHandler.current
    val detail = when (day.grade) {
        SourceGrade.OFFICIAL -> if (day.officialSource != null) "Downloaded once a year from the authority and kept on your phone, so it works offline."
        else "${r.method.parameterSummary}. This is the authority's own published method."
        SourceGrade.MASJID, SourceGrade.COMMUNITY -> r.nearbyMosque?.method?.note ?: day.grade.explanation
        else -> "${r.method.parameterSummary} · ${if (r.asrSchool == AsrSchool.HANAFI) "Hanafi" else "Shafi'i"} Asr. ${r.method.note}"
    }
    LazyColumn(Modifier.fillMaxWidth().padding(horizontal = Dims.gutter)) {
        item {
            Text("Source", style = Txt.headline, color = Palette.primary, modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp))
            SectionHeader("Where today's times come from")
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(day.grade.icon, null, Modifier.size(28.dp), tint = day.grade.tint)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Grade ${day.grade.code} · ${day.grade.title}", style = Txt.headline, color = Palette.primary)
                    Text(day.officialSource ?: r.method.name, style = Txt.subheadline, color = Palette.primary)
                    Text(detail, style = Txt.footnote, color = Palette.secondary)
                }
            }
        }
        if (day.alternateSource != null && day.alternate.isNotEmpty()) {
            item {
                SectionHeader("${day.officialSource ?: "Official"} · ${day.alternateSource}")
                Prayer.obligatory.filter { day.alternate[it] != null }.forEach { p ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Text(r.prayerName(p, day.time(Prayer.DHUHR)), style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
                        Text("${r.formatted(day.time(p))} · ${r.formatted(day.alternate.getValue(p))}", style = Txt.body, color = Palette.secondary)
                    }
                }
                Text("These two sources differ by more than 2 minutes. We show both rather than silently pick one; follow your local masjid's practice.",
                    style = Txt.footnote, color = Palette.secondary)
            }
        }
        if (day.mosqueName != null && day.jamaah.isNotEmpty()) {
            item {
                SectionHeader("Jamaah at ${day.mosqueName}")
                Prayer.obligatory.filter { day.jamaah[it] != null }.forEach { p ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Text(r.prayerName(p, day.time(Prayer.DHUHR)), style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
                        Text(r.formatted(day.jamaah.getValue(p)), style = Txt.body, color = Palette.secondary)
                    }
                }
                Text("Prayer time begins at the times on the Prayer screen; these are when the congregation prays.",
                    style = Txt.footnote, color = Palette.secondary)
            }
        }
        item {
            SectionHeader("The grades")
            listOf(SourceGrade.OFFICIAL, SourceGrade.MASJID, SourceGrade.COMMUNITY, SourceGrade.CALCULATED, SourceGrade.FALAK).forEach { g ->
                Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(22.dp).clip(CircleShape).background(g.tint), contentAlignment = Alignment.Center) {
                        Text(g.code, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color.Black.copy(alpha = 0.8f))
                    }
                    Column {
                        Text(g.title, style = Txt.subheadlineSemibold, color = Palette.primary)
                        Text(g.explanation, style = Txt.footnote, color = Palette.secondary)
                    }
                }
            }
        }
        item {
            SectionHeader("Help verify times here")
            Text("Send a mosque timetable photo, tell us which method mosques here use, or report an adhan time you heard.",
                style = Txt.subheadline, color = Palette.primary)
            Text("How to contribute", style = Txt.subheadlineSemibold, color = Palette.accent,
                modifier = Modifier.padding(vertical = 10.dp).clickable {
                    runCatching { uri.openUri("https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md") }
                })
            Text("Submissions are checked by a person before they change anyone's times, and shared openly under CC-BY 4.0.",
                style = Txt.footnote, color = Palette.secondary)
            Spacer(Modifier.height(32.dp))
        }
    }
}

/** Ramadan, Eid and the new year with a source for every date. */
@Composable
fun CalendarSheetContent(state: AppState) {
    val r = state.resolver
    val uri = LocalUriHandler.current
    val mine = r.communityAuthority
    var picking by remember { mutableStateOf(false) }
    val fmt = DateTimeFormatter.ofPattern("EEE d MMM yyyy", Locale.ENGLISH)
    LaunchedEffect(Unit) { if (state.sideEffects) state.directories.refreshIfStale() }
    LazyColumn(Modifier.fillMaxWidth().padding(horizontal = Dims.gutter)) {
        item {
            Text("Calendar", style = Txt.headline, color = Palette.primary)
            SectionHeader("My community follows")
            Row(Modifier.fillMaxWidth().clickable { picking = !picking }.padding(vertical = 8.dp)) {
                Text(if (state.prefs.communityAuthority == null) "Automatic · ${mine?.let(CalendarSanad::authorityName) ?: "none"}"
                    else CalendarSanad.authorityName(state.prefs.communityAuthority!!),
                    style = Txt.body, color = Palette.accent)
            }
            if (picking) {
                (listOf<String?>(null) + CalendarSanad.authorities.map { it.id }).forEach { id ->
                    Row(Modifier.fillMaxWidth().clickable { state.update { it.copy(communityAuthority = id) }; picking = false }.padding(vertical = 8.dp)) {
                        Text(id?.let(CalendarSanad::authorityName) ?: "Automatic", style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
                        if (state.prefs.communityAuthority == id) Icon(Icons.Filled.Check, null, tint = Palette.accent)
                    }
                }
            }
            Text("Countries can start Ramadan and celebrate Eid on different days, because of local moon sighting and different methods. Pick whose announcement your masjid follows.",
                style = Txt.footnote, color = Palette.secondary)
        }
        items(CalendarSanad.upcoming(state.now, r.zone)) { item ->
            SectionHeader("${item.event.title(r.naming)} ${item.hijriYear} AH")
            CalendarSanad.expected(item.event, item.hijriYear)?.let {
                CalendarRow("Expected", it.format(fmt), "Astronomical estimate (Umm al-Qura calendar). Local dates may differ by a day.", null, false)
            }
            val entries = state.directories.calendar.announcements(item.event, item.hijriYear)
                .sortedWith(compareBy({ if (it.authority == mine) 0 else 1 }, { it.authority }))
            entries.forEach { a ->
                a.gregorian?.let { d ->
                    CalendarRow(CalendarSanad.authorityName(a.authority), d.format(fmt), a.basisLabel, a.status, a.authority == mine,
                        a.sourceUrl?.let { url -> { runCatching { uri.openUri(url) }; Unit } })
                }
            }
            if (mine != null && entries.none { it.authority == mine && it.status == CalendarAnnouncement.Status.ANNOUNCED }) {
                Text("${CalendarSanad.authorityName(mine)} hasn't announced yet. It usually does the evening before; this page updates within a few hours.",
                    style = Txt.footnote, color = Palette.secondary)
            }
        }
        item {
            Text("Every date shows who set it and how: moon sighting, calculation, or following another authority. Dates are shared openly under CC-BY 4.0.",
                style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(top = 18.dp))
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun CalendarRow(title: String, date: String, detail: String, status: CalendarAnnouncement.Status?, highlight: Boolean, link: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Column(Modifier.weight(1f)) {
            Text(title, style = if (highlight) Txt.subheadlineSemibold.copy(fontWeight = FontWeight.Bold) else Txt.subheadlineSemibold, color = Palette.primary)
            Text(detail, style = Txt.caption, color = Palette.secondary)
            if (link != null) Text("Source", style = Txt.caption, color = Palette.accent, modifier = Modifier.clickable { link() })
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(date, style = Txt.subheadlineSemibold, color = Palette.primary)
            Text(
                when (status) { CalendarAnnouncement.Status.ANNOUNCED -> "Announced"; CalendarAnnouncement.Status.EXPECTED -> "Expected"; null -> "Estimate" },
                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                color = if (status == CalendarAnnouncement.Status.ANNOUNCED) SourceGrade.OFFICIAL.tint else Palette.secondary,
            )
        }
    }
}

/** Current location, saved places and search (built-in Asian cities, then the phone's geocoder). */
@Composable
fun PlacesSheetContent(state: AppState, onDone: () -> Unit) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Place>>(emptyList()) }
    LaunchedEffect(query) {
        if (query.isBlank()) { results = emptyList(); return@LaunchedEffect }
        delay(250)
        results = state.location.search(query)
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = Dims.gutter)) {
        Text("Location", style = Txt.headline, color = Palette.primary)
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = query, onValueChange = { query = it }, singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Search, null) },
            placeholder = { Text("City or place") },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Palette.primary, unfocusedTextColor = Palette.primary,
                focusedBorderColor = Palette.accent, cursorColor = Palette.accent),
            modifier = Modifier.fillMaxWidth(),
        )
        LazyColumn(Modifier.fillMaxWidth()) {
            if (query.isBlank()) {
                item {
                    Row(Modifier.fillMaxWidth().clickable { state.useGPS(); onDone() }.padding(vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(Icons.Filled.MyLocation, null, tint = Palette.accent)
                        Column(Modifier.weight(1f)) {
                            Text("Current location", style = Txt.body, color = Palette.primary)
                            state.gpsPlace?.let { Text(it.name, style = Txt.caption, color = Palette.secondary) }
                        }
                        if (state.prefs.useGPS) Text("On", style = Txt.subheadline, color = Palette.secondary)
                    }
                    HorizontalDivider(color = Palette.primary.copy(alpha = 0.1f))
                }
                if (state.prefs.savedPlaces.isNotEmpty()) {
                    item { SectionHeader("Saved places") }
                    items(state.prefs.savedPlaces, key = { it.id }) { place ->
                        PlaceRow(place, selected = !state.prefs.useGPS && state.prefs.manualPlace?.isNear(place) == true,
                            onRemove = { state.update { p -> p.copy(savedPlaces = p.savedPlaces.filter { it.id != place.id }) } }) {
                            state.choose(place); onDone()
                        }
                    }
                }
                item {
                    Text("Search any city in Asia - Hanoi, Osaka, Seoul, Istanbul. Times are calculated on your phone, so they keep working offline.",
                        style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(vertical = 16.dp))
                }
            } else {
                items(results, key = { it.id }) { place -> PlaceRow(place, false, null) { state.choose(place); onDone() } }
            }
            item { Spacer(Modifier.height(40.dp)) }
        }
    }
}

@Composable
private fun PlaceRow(place: Place, selected: Boolean, onRemove: (() -> Unit)?, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(if (place.isInAsia) place.profile.flag else "🌏", fontSize = 22.sp)
        Column(Modifier.weight(1f)) {
            Text(place.name, style = Txt.body, color = Palette.primary)
            if (place.subtitle.isNotEmpty()) Text(place.subtitle, style = Txt.caption, color = Palette.secondary)
        }
        if (selected) Icon(Icons.Filled.Check, null, tint = Palette.accent)
        if (onRemove != null) {
            Text("Remove", style = Txt.caption, color = Palette.secondary, modifier = Modifier.quietClick(onRemove).padding(6.dp))
        }
    }
}

/** For the Hijri line: "14 Jamadilawal 1448". */
fun LocalDate.isToday(other: LocalDate) = this == other

