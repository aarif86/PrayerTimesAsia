@file:OptIn(ExperimentalFoundationApi::class)

package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.BrightnessMedium
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Opacity
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.CapsuleButton
import com.prayertimesasia.app.ui.components.CircleIconButton
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.app.ui.components.outlinedCapsule
import com.prayertimesasia.app.ui.components.quietClick
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.TodayStyle
import java.time.format.DateTimeFormatter
import java.util.Locale

internal fun dayLabel(offset: Int): String = when (offset) {
    0 -> "TODAY"
    1 -> "TOMORROW"
    -1 -> "YESTERDAY"
    else -> if (offset > 0) "IN $offset DAYS" else "${-offset} DAYS AGO"
}

internal fun dateText(state: AppState, day: PrayerDay, pattern: String): String =
    DateTimeFormatter.ofPattern(pattern, Locale.ENGLISH).format(day.date)

/** Automatic (follows the sky) → Light → Dark, one tap each. */
@Composable
fun AppearanceButton(state: AppState, background: Color = Palette.primary.copy(alpha = 0.1f)) {
    val haptics = LocalHapticFeedback.current
    val icon = when (state.prefs.appearance) {
        Appearance.SYSTEM -> Icons.Filled.BrightnessMedium
        Appearance.LIGHT -> Icons.Filled.LightMode
        Appearance.DARK -> Icons.Filled.DarkMode
    }
    CircleIconButton(icon, "Appearance: ${state.prefs.appearance.label}", background = background) {
        val all = Appearance.entries
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        state.update { it.copy(appearance = all[(all.indexOf(it.appearance) + 1) % all.size]) }
    }
}

/** Tap to try the next Prayer screen style; touch and hold to pick one. The choice is kept. */
@Composable
fun StyleButton(state: AppState, background: Color = Palette.primary.copy(alpha = 0.1f)) {
    val haptics = LocalHapticFeedback.current
    var menu by remember { mutableStateOf(false) }
    Box {
        Box(
            Modifier.size(34.dp).clip(CircleShape).background(background, CircleShape)
                .combinedClickable(
                    onClickLabel = "Next style",
                    onLongClickLabel = "Choose a style",
                    onLongClick = { menu = true },
                    onClick = {
                        val all = TodayStyle.entries
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        state.update { it.copy(todayStyle = all[(all.indexOf(it.todayStyle) + 1) % all.size]) }
                    },
                )
                .semantics { contentDescription = "Prayer screen style: ${state.prefs.todayStyle.label}" },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Palette, null, Modifier.size(17.dp), tint = Palette.primary)
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            TodayStyle.entries.forEach { style ->
                DropdownMenuItem(
                    text = { Text(style.label) },
                    trailingIcon = { if (style == state.prefs.todayStyle) Icon(Icons.Filled.Check, null) },
                    onClick = { menu = false; state.update { it.copy(todayStyle = style) } },
                )
            }
        }
    }
}

/** The tracker's streak; tap to mark today as excused (haid, illness) so it carries on. */
@Composable
fun StreakChip(state: AppState, background: Color = Palette.primary.copy(alpha = 0.1f)) {
    val r = state.resolver
    val excused = r.isExcused(state.now)
    var menu by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.clip(CircleShape).background(background, CircleShape).clickable { menu = true }
                .padding(horizontal = 10.dp, vertical = 8.dp)
                .semantics { contentDescription = "Streak ${r.streak(state.now)} days${if (excused) ", excused today" else ""}" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(if (excused) Icons.Filled.Opacity else Icons.Filled.Whatshot, null, Modifier.size(16.dp), tint = Palette.primary)
            Text("${r.streak(state.now)}", style = Txt.subheadlineSemibold.copy(fontFeatureSettings = "tnum"), color = Palette.primary)
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            DropdownMenuItem(text = { Text(if (excused) "Not excused today" else "Excused today") },
                onClick = { menu = false; state.toggleExcused(state.now) })
        }
    }
}

@Composable
fun MusafirButton(state: AppState, background: Color = Palette.accent.copy(alpha = 0.25f)) {
    CircleIconButton(Icons.Filled.Flight, "Musafir: you may shorten and combine prayers", background = background) {
        state.showJourney = true
    }
}

/** Musafir, streak, appearance and style: the Prayer screen's buttons. */
@Composable
fun HeaderButtons(state: AppState, showMusafir: Boolean = true, background: Color = Palette.primary.copy(alpha = 0.1f)) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (showMusafir && state.prefs.musafirEnabled && state.resolver.musafirStatus(state.now)?.isTraveller == true) {
            MusafirButton(state, if (background == Palette.primary.copy(alpha = 0.1f)) Palette.accent.copy(alpha = 0.25f) else background)
        }
        if (state.prefs.trackerEnabled) StreakChip(state, background)
        AppearanceButton(state, background)
        StyleButton(state, background)
    }
}

/** "➤ Pasir Ris 🇸🇬 ⌄" - where we are; tap to change. */
@Composable
fun PlaceChip(state: AppState, onClick: () -> Unit, big: Boolean = false, outlined: Boolean = true) {
    val place = state.resolver.activePlace
    Row(
        Modifier
            .then(if (outlined) Modifier.outlinedCapsule(Palette.accent.copy(alpha = 0.7f)) else Modifier.clip(CircleShape))
            .clickable(onClickLabel = "Change location", onClick = onClick)
            .padding(horizontal = if (big) 0.dp else 10.dp, vertical = if (big) 0.dp else 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(if (state.prefs.useGPS) Icons.Filled.NearMe else Icons.Filled.Place, null, Modifier.size(if (big) 15.dp else 12.dp), tint = Palette.primary)
        Text(place?.name ?: "Choose a place", style = if (big) Txt.title3.copy(fontWeight = FontWeight.Bold) else Txt.subheadlineSemibold,
            color = Palette.primary, maxLines = 1)
        if (place != null && place.isInAsia) Text(place.profile.flag, fontSize = if (big) 18.sp else 14.sp)
        Icon(Icons.Filled.KeyboardArrowDown, null, Modifier.size(16.dp), tint = Palette.primary.copy(alpha = 0.6f))
    }
}

/** "TODAY | ➤ Pasir Ris 🇸🇬" - which day and where, in one centred chip. */
@Composable
fun DayPlaceChip(state: AppState, offset: Int, onClick: () -> Unit) {
    val place = state.resolver.activePlace
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Row(
            Modifier.outlinedCapsule(Palette.sunArc.copy(alpha = 0.7f), Palette.primary.copy(alpha = 0.06f))
                .clickable(onClickLabel = "Change location", onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(dayLabel(offset), style = Txt.captionSemibold.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = 0.5.sp), color = Palette.primary)
            Box(Modifier.width(1.dp).height(12.dp).background(Palette.primary.copy(alpha = 0.3f)))
            Icon(if (state.prefs.useGPS) Icons.Filled.NearMe else Icons.Filled.Place, null, Modifier.size(12.dp), tint = Palette.primary)
            Text(place?.name ?: "Choose a place", style = Txt.subheadlineSemibold, color = Palette.primary, maxLines = 1)
            if (place != null && place.isInAsia) Text(place.profile.flag, fontSize = 14.sp)
            Icon(Icons.Filled.KeyboardArrowDown, null, Modifier.size(16.dp), tint = Palette.primary.copy(alpha = 0.6f))
        }
    }
}

/** One tap to be told when each prayer begins (all five, at the exact time). */
@Composable
fun AlertsPrompt(state: AppState) {
    Row(
        Modifier.fillMaxWidth().clip(CircleShape).background(Palette.primary.copy(alpha = 0.08f), CircleShape)
            .border(1.dp, Palette.primary.copy(alpha = 0.1f), CircleShape)
            .padding(start = 14.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Filled.NotificationsActive, null, Modifier.size(20.dp), tint = Palette.sunArc)
        Text("Get an alert when each prayer begins", style = Txt.subheadlineSemibold, color = Palette.primary,
            maxLines = 2, modifier = Modifier.weight(1f))
        Text("Turn on", style = Txt.subheadline.copy(fontWeight = FontWeight.Bold), color = Color.Black.copy(alpha = 0.8f),
            modifier = Modifier.clip(CircleShape).background(Palette.sunArc).clickable {
                state.enableAlerts(com.prayertimesasia.core.Prayer.obligatory.toSet())
            }.padding(horizontal = 14.dp, vertical = 8.dp))
        Box(Modifier.size(24.dp).clip(CircleShape).clickable(onClickLabel = "Not now") {
            state.update { it.copy(alertsPromptDismissed = true) }
        }, contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Close, "Not now", Modifier.size(14.dp), tint = Palette.primary.copy(alpha = 0.6f))
        }
    }
}

@Composable
fun ShowMoreButton(state: AppState, modifier: Modifier = Modifier) {
    val more = state.prefs.showMore
    Box(modifier, contentAlignment = Alignment.Center) {
        CapsuleButton(
            if (more) "SHOW LESS" else "SHOW MORE",
            trailing = if (more) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
        ) { state.update { it.copy(showMore = !it.showMore) } }
    }
}

/** "‹ TODAY / Sun 25 Oct / 14 Jamadilawal 1448 ›" with ‹ › to move between days (Classic list). */
@Composable
fun DateBlock(state: AppState, shown: PrayerDay, offset: Int, onOffset: (Int) -> Unit, onCalendar: () -> Unit) {
    val r = state.resolver
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.ChevronLeft, "Previous day", Modifier.size(22.dp, 40.dp).quietClick { onOffset(offset - 1) },
            tint = Palette.primary.copy(alpha = 0.6f))
        Column(Modifier.weight(1f).quietClick { if (offset == 0) onCalendar() else onOffset(0) }) {
            Text(dayLabel(offset), style = Txt.caption2Heavy.copy(letterSpacing = 0.5.sp), color = Palette.accent)
            Text(dateText(state, shown, "EEE d MMM"), style = Txt.headline, color = Palette.primary, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(r.hijri(shown.time(com.prayertimesasia.core.Prayer.DHUHR)), style = Txt.caption, color = Palette.secondary, maxLines = 1)
                Icon(Icons.Filled.Event, null, Modifier.size(11.dp), tint = Palette.secondary)
            }
        }
        Icon(Icons.Filled.ChevronRight, "Next day", Modifier.size(22.dp, 40.dp).quietClick { onOffset(offset + 1) },
            tint = Palette.primary.copy(alpha = 0.6f))
    }
}

/** "TODAY / Sunday 25 October / 14 Jamadilawal 1448" above the hero dial. */
@Composable
fun DateHeader(state: AppState, shown: PrayerDay, offset: Int, onOffset: (Int) -> Unit, onCalendar: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().quietClick { if (offset == 0) onCalendar() else onOffset(0) },
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(dayLabel(offset), style = Txt.captionSemibold.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp), color = Palette.accent)
        Text(dateText(state, shown, "EEEE d MMMM"), style = display(26.sp, FontWeight.Bold), color = Palette.primary, maxLines = 1)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(state.resolver.hijri(shown.time(com.prayertimesasia.core.Prayer.DHUHR)), style = Txt.subheadline, color = Palette.secondary)
            Icon(if (offset == 0) Icons.Filled.Event else Icons.Filled.Undo, null, Modifier.size(14.dp), tint = Palette.secondary)
        }
    }
}

/** ‹ the source of these times › (Day Dial). */
@Composable
fun DayRow(state: AppState, shown: PrayerDay, offset: Int, onOffset: (Int) -> Unit, onSource: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        CircleIconButton(Icons.Filled.ChevronLeft, "Previous day", size = 36.dp, background = Palette.primary.copy(alpha = 0.08f)) { onOffset(offset - 1) }
        Spacer(Modifier.weight(1f))
        SourceBadge(state, shown, onClick = onSource)
        Spacer(Modifier.weight(1f))
        CircleIconButton(Icons.Filled.ChevronRight, "Next day", size = 36.dp, background = Palette.primary.copy(alpha = 0.08f)) { onOffset(offset + 1) }
    }
}

/** "‹  Sunday 25 October / 14 Jamadilawal 1448  ›" (Sun Path and Centre Dial). */
@Composable
fun DayNavigator(state: AppState, shown: PrayerDay, offset: Int, onOffset: (Int) -> Unit, onCalendar: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.ChevronLeft, "Previous day", Modifier.size(40.dp).quietClick { onOffset(offset - 1) }.padding(8.dp),
            tint = Palette.primary.copy(alpha = 0.6f))
        Column(Modifier.weight(1f).quietClick { if (offset == 0) onCalendar() else onOffset(0) }, horizontalAlignment = Alignment.CenterHorizontally) {
            Text(dateText(state, shown, "EEEE d MMMM"), style = Txt.title3, color = Palette.primary, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(state.resolver.hijri(shown.time(com.prayertimesasia.core.Prayer.DHUHR)), style = Txt.subheadline, color = Palette.secondary)
                Icon(Icons.Filled.Event, null, Modifier.size(12.dp), tint = Palette.secondary)
            }
        }
        Icon(Icons.Filled.ChevronRight, "Next day", Modifier.size(40.dp).quietClick { onOffset(offset + 1) }.padding(8.dp),
            tint = Palette.primary.copy(alpha = 0.6f))
    }
}

@Composable
fun MusafirChip(state: AppState) {
    Row(
        Modifier.fillMaxWidth().clip(CircleShape).background(Palette.primary.copy(alpha = 0.12f)).clickable { state.showJourney = true }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.Flight, null, Modifier.size(18.dp), tint = Palette.primary)
        Text("Musafir · you may shorten & combine", style = Txt.subheadlineSemibold, color = Palette.primary, modifier = Modifier.weight(1f), maxLines = 1)
        Icon(Icons.Filled.ChevronRight, null, Modifier.size(16.dp), tint = Palette.primary)
    }
}

/** Welcome to a new country: what switched, and the travel choices. */
@Composable
fun ArrivalCard(state: AppState) {
    val r = state.resolver
    val profile = r.profile
    var asrMenu by remember { mutableStateOf(false) }
    val switchColors = SwitchDefaults.colors(checkedTrackColor = Palette.accent, checkedThumbColor = Color.White)
    GlassCard {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(profile.flag.ifEmpty { "🌏" }, fontSize = 34.sp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(if (profile.code.isEmpty()) "Outside Asia" else "Welcome to ${profile.name}", style = Txt.headline, color = Palette.primary)
                Text(
                    if (r.isMethodAutomatic) "Switched to ${r.method.name} (${r.method.parameterSummary}), local time. Works offline."
                    else "Local time applied. You've pinned ${r.method.shortName} in Settings.",
                    style = Txt.subheadline, color = Palette.primary.copy(alpha = 0.85f),
                )
            }
            Icon(Icons.Filled.Close, "Dismiss", Modifier.size(28.dp).clip(CircleShape)
                .clickable { state.update { it.copy(arrivalBannerDismissed = true) } }.padding(6.dp), tint = Palette.primary)
        }
        HorizontalDivider(Modifier.padding(vertical = 8.dp), color = Palette.primary.copy(alpha = 0.25f))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Switch automatically", style = Txt.subheadlineSemibold, color = Palette.primary)
                Text("Follow each country's method as you travel", style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
            }
            Switch(r.isMethodAutomatic, onCheckedChange = { auto ->
                val id = r.method.id
                state.update { it.copy(methodOverrideId = if (auto) null else id) }
            }, colors = switchColors)
        }
        val home = state.prefs.home?.countryCode
        if (home != null && home != profile.code) {
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Musafir features", style = Txt.subheadlineSemibold, color = Palette.primary)
                    Text("Jamak and qasar guidance while you're away", style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
                }
                Switch(state.prefs.musafirEnabled, onCheckedChange = { on -> state.update { it.copy(musafirEnabled = on) } }, colors = switchColors)
            }
        }
        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Asr", style = Txt.subheadlineSemibold, color = Palette.primary, modifier = Modifier.weight(1f))
            Box {
                Text(
                    (if (r.asrSchool == AsrSchool.HANAFI) "Later Asr (Hanafi)" else "Earlier Asr (Shafi'i)") + "  ⌃⌄",
                    style = Txt.subheadline, color = Palette.primary, textAlign = TextAlign.End,
                    modifier = Modifier.clickable { asrMenu = true },
                )
                DropdownMenu(expanded = asrMenu, onDismissRequest = { asrMenu = false }) {
                    DropdownMenuItem(text = { Text("Automatic (${profile.asr.label})") },
                        onClick = { asrMenu = false; state.update { it.copy(asrOverride = null) } })
                    AsrSchool.entries.forEach { school ->
                        DropdownMenuItem(text = { Text(school.label) }, onClick = { asrMenu = false; state.update { it.copy(asrOverride = school) } })
                    }
                }
            }
        }
    }
}
