package com.prayertimesasia.app.ui.journey

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.CapsuleButton
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.core.AsiaRegions
import com.prayertimesasia.core.AsrSchool
import com.prayertimesasia.core.Musafir
import com.prayertimesasia.core.Prayer
import java.text.NumberFormat
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Travel mode: where home is, how far you are, whether the traveller's
 * concessions (jamak & qasar) apply, and the trail of countries you've prayed in.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun JourneyScreen(state: AppState, onDone: () -> Unit) {
    val r = state.resolver
    val now = state.now
    val status = r.musafirStatus(now)
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(state.skyNow)
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = Dims.gutter).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                CapsuleButton("Done", Modifier.align(Alignment.CenterEnd), style = Txt.headline, onClick = onDone)
            }
            Text("Journey", style = display(34.sp, FontWeight.Bold), color = Palette.primary)
            GlassCard(padding = 20.dp) {
                if (status != null) {
                    val (title, body) = Musafir.guidance(status, r.musafirRules, r.naming)
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Icon(if (status.isTraveller) AppIcons.journey else Icons.Filled.Home, null, Modifier.size(30.dp), tint = Palette.primary)
                            Text(title, style = Txt.title2, color = Palette.primary)
                        }
                        status.distance?.let { km ->
                            Row(verticalAlignment = Alignment.Bottom) {
                                Text(NumberFormat.getIntegerInstance(Locale.US).format(km.roundToInt()) + " km", style = display(48.sp),
                                    color = Palette.primary, modifier = Modifier.alignByBaseline())
                                Text("  from home", style = Txt.headline, color = Palette.primary, modifier = Modifier.alignByBaseline())
                            }
                        }
                        Text(body, style = Txt.body, color = Palette.primary.copy(alpha = 0.9f))
                        if (state.prefs.arrivedAt != null && (status.isTraveller || status is Musafir.Status.Settled)) {
                            Text("Day ${r.daysHere(now) + 1} in ${r.profile.name.ifEmpty { "this place" }}", style = Txt.subheadlineSemibold,
                                color = Palette.primary.copy(alpha = 0.8f))
                        }
                    }
                } else {
                    Text("Set your home", style = Txt.title2, color = Palette.primary)
                    Text("Tell us where home is and we'll work out when you count as a traveller.", style = Txt.body,
                        color = Palette.primary.copy(alpha = 0.85f))
                }
            }
            val today = r.day(now)
            val tomorrow = r.day(now, 1)
            if (status?.isTraveller == true && r.asrSchool != AsrSchool.HANAFI && today != null && tomorrow != null) {
                GlassCard {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row {
                            Text("COMBINED WINDOWS TODAY", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Palette.primary.copy(alpha = 0.7f),
                                modifier = Modifier.weight(1f))
                            Text("Pending shariah review", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Palette.primary.copy(alpha = 0.6f))
                        }
                        Window(state, Prayer.DHUHR, Prayer.ASR, today.time(Prayer.DHUHR), today.time(Prayer.MAGHRIB))
                        Window(state, Prayer.MAGHRIB, Prayer.ISHA, today.time(Prayer.MAGHRIB), tomorrow.time(Prayer.FAJR))
                        Text("Jamak taqdim prays both in the first prayer's time; jamak ta'khir prays both in the second's. ${Prayer.FAJR.name(r.naming)} is never combined.",
                            style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f))
                    }
                }
            }
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("HOME", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Palette.primary.copy(alpha = 0.7f))
                        Text(state.prefs.home?.let { "${it.profile.flag} ${it.name}" } ?: "Not set", style = Txt.headline, color = Palette.primary)
                        state.prefs.home?.subtitle?.takeIf { it.isNotEmpty() }?.let { Text(it, style = Txt.subheadline, color = Palette.primary.copy(alpha = 0.75f)) }
                    }
                    val place = r.activePlace
                    if (place != null && state.prefs.home?.isNear(place) != true) {
                        CapsuleButton("Set to here", style = Txt.subheadlineSemibold, background = Palette.primary.copy(alpha = 0.12f)) { state.setHome(place) }
                    }
                }
            }
            GlassCard {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("TRAVEL DISTANCE", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Palette.primary.copy(alpha = 0.7f))
                    if (r.asrSchool == AsrSchool.HANAFI) {
                        Text("Hanafi: about 78 km, stays up to 15 days. Prayers are shortened but not combined.", style = Txt.subheadline, color = Palette.primary)
                    } else {
                        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                            listOf(81.0 to "81 km (2 marhalah)", 89.0 to "89 km").forEachIndexed { i, (km, label) ->
                                SegmentedButton(state.prefs.musafirThresholdKm == km, { state.update { it.copy(musafirThresholdKm = km) } },
                                    SegmentedButtonDefaults.itemShape(i, 2),
                                    colors = SegmentedButtonDefaults.colors(activeContainerColor = Palette.primary.copy(alpha = 0.18f),
                                        activeContentColor = Palette.primary, inactiveContainerColor = Color.Transparent, inactiveContentColor = Palette.primary),
                                    icon = {}) { Text(label) }
                            }
                        }
                        Text("Shafi'i: stays of up to 3 days, not counting the days you arrive and leave.", style = Txt.subheadline,
                            color = Palette.primary.copy(alpha = 0.85f))
                    }
                }
            }
            if (state.prefs.trip.isNotEmpty()) {
                GlassCard {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("WHERE YOU'VE PRAYED", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Palette.primary.copy(alpha = 0.7f))
                        state.prefs.trip.take(12).forEach { stop ->
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(AsiaRegions.profile(stop.countryCode)?.flag ?: "🌏", fontSize = 18.sp)
                                Column(Modifier.weight(1f)) {
                                    Text(stop.countryName, style = Txt.subheadlineSemibold, color = Palette.primary)
                                    Text(stop.placeName, style = Txt.caption, color = Palette.primary.copy(alpha = 0.7f))
                                }
                                Text(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH).format(Instant.ofEpochMilli(stop.arrived).atZone(r.zone)),
                                    style = Txt.caption, color = Palette.primary.copy(alpha = 0.75f))
                            }
                        }
                    }
                }
            }
            Text("This is general guidance on the traveller's concessions (rukhsah), not a fatwa. When unsure, follow your local religious authority.",
                style = Txt.caption, color = Palette.primary.copy(alpha = 0.7f))
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun Window(state: AppState, a: Prayer, b: Prayer, from: Instant, to: Instant) {
    val r = state.resolver
    Row {
        Text("${a.name(r.naming)} + ${b.name(r.naming)}", style = Txt.headline, color = Palette.primary, modifier = Modifier.weight(1f))
        Text("${r.formatted(from)} – ${r.formatted(to)}", style = Txt.headline.copy(fontFeatureSettings = "tnum"), color = Palette.primary)
    }
}
