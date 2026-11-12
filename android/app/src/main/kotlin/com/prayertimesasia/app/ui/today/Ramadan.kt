package com.prayertimesasia.app.ui.today

import com.prayertimesasia.core.HadithId
import com.prayertimesasia.app.ui.components.HadithView
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.NightsStay
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.GlassCard
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.CalendarSanad
import com.prayertimesasia.core.DoaId
import com.prayertimesasia.core.FastMark
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.RamadanContent
import com.prayertimesasia.core.RamadanWordKey
import com.prayertimesasia.core.RamadanWords
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.Season
import com.prayertimesasia.core.Tarawih
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/*
 * Ramadan, Raya and Syawal: the card at the top of the Prayer screen and the
 * Ramadan page. Same features as web/src/ui/Ramadan.tsx and the iPhone's
 * RamadanView.swift. Dates follow the user's religious authority (core Season.kt).
 */

private val RamadanPink = Color(0xFFE06C8A)
private val Purple = Color(0xFF8E6BD8)
private val oddNights = listOf(21, 23, 25, 27, 29)

private fun dateText(d: LocalDate, pattern: String = "EEEE d MMMM", lang: RamadanContent.Lang = RamadanContent.Lang.EN): String =
    d.format(DateTimeFormatter.ofPattern(pattern, RamadanWords.locale(lang)))

private fun whenWords(from: LocalDate, d: LocalDate, t: RamadanWords.In): String = when (ChronoUnit.DAYS.between(from, d)) {
    0L -> t(RamadanWordKey.today)
    1L -> t(RamadanWordKey.tomorrow, "d" to dateText(d, "EEEE d MMM", t.lang))
    2L -> t(RamadanWordKey.dayAfterTomorrow, "d" to dateText(d, "EEEE d MMM", t.lang))
    else -> dateText(d, lang = t.lang)
}

/** The Ramadan words in the language of the prayer names. */
private fun words(state: AppState): RamadanWords.In = RamadanWords.In(RamadanContent.lang(state.resolver.naming))

private fun countdown(from: Instant, to: Instant): String {
    val s = Duration.between(from, to).seconds.coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    return if (h > 0) "${h}h ${m}m" else if (m > 0) "${m}m ${s % 60}s" else "${s}s"
}

/** The countdown for TalkBack in the page's language, "2 hours 4 minutes", cut the same way as [countdown]. */
private fun spokenCountdown(from: Instant, to: Instant, t: RamadanWords.In): String {
    val s = Duration.between(from, to).seconds.coerceAtLeast(0)
    if (s < 60) return t(RamadanWordKey.spokenUnderMinute)
    val h = s / 3600
    val m = (s % 3600) / 60
    return listOfNotNull(
        if (h > 0) t(RamadanWordKey.spokenHours, "n" to h) else null,
        if (m > 0) t(RamadanWordKey.spokenMinutes, "n" to m) else null,
    ).joinToString(" ")
}

/** At the largest text sizes, boxes stack instead of sitting side by side. */
@Composable private fun bigText(): Boolean = LocalDensity.current.fontScale >= 1.5f

private fun authorityName(r: Resolver): String? = r.communityAuthority?.let(CalendarSanad::authorityName)

@Composable
private fun SeasonChip(label: String, icon: ImageVector, on: Boolean, tint: Color = Palette.success, onClick: () -> Unit) {
    Row(
        Modifier.clip(CircleShape).background(if (on) tint.copy(alpha = 0.85f) else Palette.primary.copy(alpha = 0.09f))
            .clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, Modifier.size(16.dp), tint = if (on) Color.White else Palette.primary)
        Text(label, style = Txt.subheadlineSemibold, color = if (on) Color.White else Palette.primary, maxLines = 1)
    }
}

@Composable
private fun PreviewTag(t: RamadanWords.In) {
    Text(t(RamadanWordKey.preview), style = Txt.caption2Heavy, color = Color.Black,
        modifier = Modifier.clip(CircleShape).background(Palette.gold).padding(horizontal = 7.dp, vertical = 2.dp))
}

// MARK: The card on the Prayer screen

/** Ramadan, Raya and Syawal at the top of the Prayer screen. Nothing outside the season. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SeasonCard(state: AppState, now: Instant) {
    val r = state.resolver
    val s = r.season(now)
    if (s.phase == Season.Phase.NONE) return
    val today = r.civil(now)
    val t = words(state)
    GlassCard(Modifier.clickable { state.showRamadan = true }) {
        if (r.isSeasonPreview) PreviewTag(t)
        when (s.phase) {
            Season.Phase.RAMADAN -> {
                val key = today.toString()
                val mark = state.prefs.fastLog[key]
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Column(Modifier.clip(RoundedCornerShape(14.dp)).background(Palette.gold.copy(alpha = 0.18f)).padding(horizontal = 10.dp, vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(t(RamadanWordKey.ramadan).uppercase(), style = Txt.caption2Heavy, color = Palette.goldText)
                        Text("${s.ramadanDay ?: 0}", style = Txt.largeTitle, color = Palette.primary)
                    }
                    Column(Modifier.weight(1f)) {
                        val m = r.fastingMoment(now)
                        if (m != null) {
                            val imsak = m.first == Resolver.FastingKind.IMSAK
                            Text((if (imsak) t(RamadanWordKey.imsakIn) else t(RamadanWordKey.berbukaIn)).uppercase(), style = Txt.caption2Heavy, color = Palette.primary)
                            val spoken = spokenCountdown(now, m.second, t)
                            Text(countdown(now, m.second), style = Txt.title2.copy(fontSize = 28.sp), color = Palette.goldText,
                                modifier = Modifier.semantics { contentDescription = spoken })
                            Text("${if (imsak) t(RamadanWordKey.finishSahurBy) else t(RamadanWordKey.maghribAt)} ${r.formatted(m.second)}", style = Txt.footnote, color = Palette.secondary)
                        } else {
                            Text(t(RamadanWordKey.tonight).uppercase(), style = Txt.caption2Heavy, color = Palette.primary)
                            Text(if (s.sightingTonight != null) t(RamadanWordKey.sightingForRaya) else t(RamadanWordKey.tarawihAfterIsyak), style = Txt.headline, color = Palette.primary)
                        }
                    }
                    Icon(Icons.Filled.ChevronRight, null, Modifier.size(18.dp), tint = Palette.secondary)
                }
                val authority = authorityName(r) ?: t(RamadanWordKey.yourAuthority)
                val next = s.nextStart
                if (s.sightingTonight != null) {
                    Note(if (next != null && next.announced) t(RamadanWordKey.rayaAnnounced, "w" to whenWords(today, next.day, t), "a" to authority)
                    else t(RamadanWordKey.rayaSighting, "a" to authority))
                } else if (s.hijri.day == 30) Note(t(RamadanWordKey.lastFast))
                val night = s.nightTonight
                if (s.lastTen && night != null) {
                    Note(if (s.oddNight) t(RamadanWordKey.oddNight, "n" to night) else t(RamadanWordKey.lastTenNight, "n" to night))
                }
                if (s.nuzulQuran) Note(t(RamadanWordKey.nuzulQuran))
                FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    SeasonChip(if (mark == null || mark == FastMark.FASTED) t(RamadanWordKey.fastingToday) else t.mark(mark),
                        if (mark == FastMark.FASTED) Icons.Filled.Check else Icons.Filled.Restaurant, mark == FastMark.FASTED) {
                        state.setFast(key, if (mark == FastMark.FASTED) null else FastMark.FASTED)
                    }
                    val tarawih = key in state.prefs.tarawihLog
                    SeasonChip(t(RamadanWordKey.tarawih), if (tarawih) Icons.Filled.Check else Icons.Filled.NightsStay, tarawih) { state.toggleTarawih(key) }
                    val juz = s.ramadanDay
                    if (state.prefs.khatamPlan && juz != null) {
                        val read = key in state.prefs.quranLog
                        SeasonChip(t(RamadanWordKey.juz, "n" to juz), if (read) Icons.Filled.Check else Icons.Filled.AutoAwesome, read) { state.toggleJuz(key) }
                    }
                }
            }
            Season.Phase.SYAABAN -> {
                val authority = authorityName(r)
                val next = s.nextStart
                if (s.sightingTonight != null) {
                    Title(t(RamadanWordKey.sightingTonightTitle))
                    Note(authority?.let { t(RamadanWordKey.sightingAnnounces, "a" to it) } ?: t(RamadanWordKey.sightingMaybe))
                } else if (next != null && next.announced) {
                    Title(t(RamadanWordKey.ramadanBegins, "w" to whenWords(today, next.day, t)))
                    Note(t(RamadanWordKey.announcedBy, "a" to (authority ?: t(RamadanWordKey.yourAuthorityLower))))
                } else {
                    val first = r.monthDays(s.hijri.year, 9).firstOrNull()
                    val days = first?.let { ChronoUnit.DAYS.between(today, it) }
                    Title(when { days == null -> t(RamadanWordKey.ramadanNear); days <= 0 -> t(RamadanWordKey.beginsToday); days == 1L -> t(RamadanWordKey.beginsTomorrow); else -> t(RamadanWordKey.beginsInDays, "n" to days) })
                    Note(if (days != null && days <= 1) t(RamadanWordKey.firstTarawihTonight) else t(RamadanWordKey.getReady))
                }
            }
            else -> {
                val sum = r.fastSummary(s.hijri.year, today)
                if (s.phase == Season.Phase.RAYA) {
                    Title(t(RamadanWordKey.selamatHariRaya))
                    val eid = state.prefs.myMasjid?.eid?.let { t(RamadanWordKey.rayaPrayerAt, "p" to (state.prefs.myMasjid?.name ?: t(RamadanWordKey.yourMasjid)), "t" to it) }
                        ?: t(RamadanWordKey.takbirUntilPrayer)
                    Note(eid + " " + if (s.hijri.year in state.prefs.zakatPaid) t(RamadanWordKey.maafZahirBatin) else t(RamadanWordKey.payZakatBefore))
                } else {
                    Title(t(RamadanWordKey.syawalCardTitle, "d" to (s.syawalDay ?: 0), "n" to minOf(6, sum.syawal)))
                    Note((if (sum.owed > 0) t(RamadanWordKey.fastsToReplace, "n" to sum.owed) + " " else "") + t(RamadanWordKey.tapToMarkSyawal))
                }
            }
        }
    }
}

@Composable private fun Title(text: String) = Text(text, style = Txt.headline, color = Palette.primary)

@Composable private fun Note(text: String) = Text(text, style = Txt.footnote, color = Palette.primary.copy(alpha = 0.85f), modifier = Modifier.padding(top = 4.dp))

// MARK: The Ramadan page

@Composable
fun RamadanSheetContent(state: AppState) {
    val r = state.resolver
    val now = state.now
    val s = r.season(now)
    val syawal = s.phase == Season.Phase.RAYA || s.phase == Season.Phase.SYAWAL
    val t = words(state)
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(if (syawal) t(RamadanWordKey.syawal) else t(RamadanWordKey.ramadan), style = Txt.title2, color = Palette.primary)
        if (r.isSeasonPreview) {
            Text(t(RamadanWordKey.previewBanner),
                style = Txt.footnote, color = Palette.primary,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Palette.gold.copy(alpha = 0.22f)).padding(10.dp))
        }
        if (syawal) {
            RayaToday(state, s)
            SyawalFasts(state, s)
            DoaList(state, listOf(DoaId.TAKBIR, DoaId.NIAT_SYAWAL, DoaId.NIAT_QADHA))
            Zakat(state, s.hijri.year)
        } else {
            RamadanToday(state, s)
            if (s.phase == Season.Phase.RAMADAN) TarawihCounter(state)
            RamadanMonth(state, s.hijri.year)
            LastTen(state, s.hijri.year)
            DoaList(state, listOf(DoaId.NIAT_PUASA, DoaId.BERBUKA, DoaId.BERBUKA_HADITH, DoaId.QADR))
            Zakat(state, s.hijri.year)
            SectionHeader(t(RamadanWordKey.travelTitle))
            Text(t(RamadanWordKey.travelNote, "km" to r.prefs.musafirThresholdKm.toInt()),
                style = Txt.footnote, color = Palette.primary)
            ShareAndPrint(state, s)
            RamadanSwitches(state)
        }
        Text(t(RamadanWordKey.footer, "a" to (authorityName(r) ?: t(RamadanWordKey.yourAuthorityLower))),
            style = Txt.caption, color = Palette.secondary, modifier = Modifier.padding(top = 12.dp))
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun TimeBox(title: String, time: String, sub: String, highlight: Boolean, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(if (highlight) Palette.gold.copy(alpha = 0.2f) else Palette.primary.copy(alpha = 0.06f))
        .padding(vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = Txt.caption2Heavy, color = if (highlight) Palette.goldText else Palette.secondary)
        Text(time, style = Txt.title3, color = Palette.primary)
        Text(sub, style = Txt.caption2, color = Palette.secondary)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RamadanToday(state: AppState, s: Season.Info) {
    val r = state.resolver
    val inRamadan = s.phase == Season.Phase.RAMADAN
    val first = if (inRamadan) null else r.monthDays(s.hijri.year, 9).firstOrNull()
    val t = words(state)
    val shown = first?.let { r.dayOf(it) } ?: r.day(state.now) ?: return
    SectionHeader(if (inRamadan) t(RamadanWordKey.ramadanDay, "n" to (s.ramadanDay ?: 0)) else first?.let { t(RamadanWordKey.firstOfRamadan, "d" to dateText(it, lang = t.lang)) } ?: t(RamadanWordKey.ramadan))
    val boxes = @Composable { mod: Modifier ->
        TimeBox(t(RamadanWordKey.imsak).uppercase(), r.formatted(r.imsak(shown)), t(RamadanWordKey.stopEating), false, mod)
        TimeBox(t(RamadanWordKey.subuh).uppercase(), r.formatted(shown.time(Prayer.FAJR)), t(RamadanWordKey.fastBegins), false, mod)
        TimeBox(t(RamadanWordKey.berbuka).uppercase(), r.formatted(shown.time(Prayer.MAGHRIB)), t(RamadanWordKey.maghrib), true, mod)
    }
    if (bigText()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { boxes(Modifier.fillMaxWidth()) }
    } else {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { boxes(Modifier.weight(1f)) }
    }
    if (!inRamadan) return
    r.fastingMoment(state.now)?.let { (kind, at) ->
        val label = if (kind == Resolver.FastingKind.IMSAK) t(RamadanWordKey.imsak) else t(RamadanWordKey.berbuka)
        val spoken = t(RamadanWordKey.countIn, "w" to label, "l" to spokenCountdown(state.now, at, t))
        Text(t(RamadanWordKey.countIn, "w" to label, "l" to countdown(state.now, at)), style = Txt.headline,
            color = Palette.goldText, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = spoken })
    }
    val key = r.civil(state.now).toString()
    val mark = state.prefs.fastLog[key]
    var showMissed by remember { mutableStateOf(false) }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        SeasonChip(t(RamadanWordKey.imFastingToday), if (mark == FastMark.FASTED) Icons.Filled.Check else Icons.Filled.Restaurant, mark == FastMark.FASTED) {
            state.setFast(key, if (mark == FastMark.FASTED) null else FastMark.FASTED)
        }
        SeasonChip(if (mark?.isMissed == true) t(RamadanWordKey.missedBecause, "r" to t.mark(mark)) else t(RamadanWordKey.notFastingToday), Icons.Filled.ChevronRight,
            mark?.isMissed == true, RamadanPink) { showMissed = !showMissed }
    }
    if (showMissed) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            FastMark.MISSED.forEach { m ->
                SeasonChip(t.mark(m), Icons.Filled.Check, mark == m, RamadanPink) { state.setFast(key, if (mark == m) null else m); showMissed = false }
            }
        }
    }
    if (mark == FastMark.PERIOD) Text(t(RamadanWordKey.pauseTrackerToo), style = Txt.footnote, color = Palette.secondary)
    val beforeBerbuka = r.fastingMoment(state.now)?.first == Resolver.FastingKind.BERBUKA
    HadithView(state, HadithId.IFTAR, Modifier.padding(top = 8.dp), tag = if (beforeBerbuka) t(RamadanWordKey.beforeBerbuka) else null)
}

@Composable
private fun DayGrid(days: List<LocalDate>, today: LocalDate, cell: @Composable (Int, LocalDate, Modifier) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        days.withIndex().chunked(6).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { (i, d) -> cell(i, d, Modifier.weight(1f)) }
                repeat(6 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

private val ramadanCycle = listOf(null, FastMark.FASTED, FastMark.PERIOD, FastMark.SICK, FastMark.TRAVEL, FastMark.OTHER)
private val syawalCycle = listOf(null, FastMark.SYAWAL, FastMark.QADHA)

@Composable
private fun RamadanMonth(state: AppState, year: Int) {
    val r = state.resolver
    val days = r.monthDays(year, 9)
    val today = r.civil(state.now)
    if (days.isEmpty() || days.first() > today) return
    val sum = r.fastSummary(year, today)
    val t = words(state)
    SectionHeader(t(RamadanWordKey.yourFastsThisMonth))
    DayGrid(days, today) { i, d, modifier ->
        val m = state.prefs.fastLog[d.toString()]
        val future = d > today
        Box(
            modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(10.dp))
                .background(when { m == FastMark.FASTED -> Palette.success; m?.isMissed == true -> RamadanPink.copy(alpha = 0.3f); else -> Palette.primary.copy(alpha = 0.07f) })
                .border(1.5.dp, when { d == today -> Palette.accent; (i + 1) in oddNights -> Palette.gold.copy(alpha = 0.7f); else -> Color.Transparent }, RoundedCornerShape(10.dp))
                .clickable(enabled = !future) { state.setFast(d.toString(), ramadanCycle[(ramadanCycle.indexOf(m) + 1) % ramadanCycle.size]) }
                .semantics { contentDescription = t(RamadanWordKey.ramadanDayAria, "n" to i + 1, "d" to dateText(d, "d MMM", t.lang), "s" to (m?.let(t::mark) ?: t(RamadanWordKey.notMarked))) },
            contentAlignment = Alignment.Center,
        ) {
            Text("${i + 1}", style = Txt.subheadlineSemibold, color = (if (m == FastMark.FASTED) Color.White else Palette.primary).copy(alpha = if (future) 0.4f else 1f))
            if (m != null && t.letter(m).isNotEmpty()) Text(t.letter(m), style = Txt.caption2Heavy, color = Palette.primary, modifier = Modifier.align(Alignment.BottomEnd).padding(3.dp))
        }
    }
    Text("${sum.fasted} ${t(RamadanWordKey.fastedCount)}" + (if (sum.missed > 0) " · ${sum.missed} ${t(RamadanWordKey.missedCount)}" else "") +
        (if (sum.owed > 0) " · ${t(RamadanWordKey.toReplace, "n" to sum.owed)}" else ""),
        style = Txt.subheadline, color = Palette.primary)
    Text(t(RamadanWordKey.monthHelp),
        style = Txt.caption, color = Palette.secondary)
}

/**
 * Tarawih: the user picks 8 or 20 rakaat the first time (the app never says which
 * is right), then taps the big button after each salam. Reaching the total ticks
 * tonight's Tarawih. The count itself lives only on this screen.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TarawihCounter(state: AppState) {
    val r = state.resolver
    val t = words(state)
    val key = r.civil(state.now).toString()
    val total = state.prefs.tarawihRakaat
    var done by remember { mutableStateOf(0) }
    var choosing by remember { mutableStateOf(false) }
    val haptic = LocalHapticFeedback.current
    SectionHeader(t(RamadanWordKey.tarawihCounter))
    if (total == null || choosing) {
        Text(t(RamadanWordKey.tarawihHowMany), style = Txt.subheadline, color = Palette.primary)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tarawih.CHOICES.forEach { n ->
                val on = total == n
                Box(Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(24.dp))
                    .background(if (on) Palette.success.copy(alpha = 0.35f) else Palette.primary.copy(alpha = 0.08f))
                    .clickable { state.setTarawihRakaat(n); done = 0; choosing = false }
                    .semantics { selected = on },
                    contentAlignment = Alignment.Center) {
                    Text(t(RamadanWordKey.rakaatN, "n" to n), style = Txt.headline, color = Palette.primary)
                }
            }
        }
        Text(t(RamadanWordKey.tarawihChangeLater), style = Txt.caption, color = Palette.secondary)
        return
    }
    val complete = done >= total
    val spoken = t(RamadanWordKey.tarawihProgress, "d" to minOf(done, total), "n" to total) + ". " +
        (if (complete) t(RamadanWordKey.tarawihDone) else t(RamadanWordKey.tarawihTapHint))
    Column(Modifier.fillMaxWidth().heightIn(min = 180.dp).clip(RoundedCornerShape(22.dp))
        .background(if (complete) Palette.success.copy(alpha = 0.3f) else Purple.copy(alpha = 0.18f))
        .clickable {
            done = Tarawih.tap(done, total)
            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            if (done == total) state.markTarawih(key)
        }
        .clearAndSetSemantics { contentDescription = spoken }
        .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterVertically)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text("${minOf(done, total)}", style = Txt.largeTitle.copy(fontSize = 56.sp), color = Palette.primary)
            Text(" / $total", style = Txt.title2, color = Palette.secondary)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            repeat(Tarawih.sets(total)) { i ->
                Box(Modifier.size(12.dp).clip(CircleShape).border(2.dp, Palette.primary, CircleShape)
                    .background(if (i < done / 2) Palette.primary else Color.Transparent))
            }
        }
        Text(if (complete) t(RamadanWordKey.tarawihDone) else t(RamadanWordKey.tarawihTapHint), style = Txt.subheadline, color = Palette.primary)
    }
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        SeasonChip(t(RamadanWordKey.tarawihUndo), Icons.Filled.Undo, false) { done = Tarawih.undo(done) }
        SeasonChip(t(RamadanWordKey.tarawihRestart), Icons.Filled.Refresh, false) { done = 0 }
        SeasonChip("${t(RamadanWordKey.rakaatN, "n" to total)} · ${t(RamadanWordKey.tarawihChange)}", Icons.Filled.NightsStay, false) { choosing = true }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LastTen(state: AppState, year: Int) {
    val r = state.resolver
    val days = r.monthDays(year, 9)
    if (days.size < 20) return
    val today = r.civil(state.now)
    val t = words(state)
    SectionHeader(t(RamadanWordKey.lastTenTitle))
    Text(t(RamadanWordKey.lailatulQadr), style = Txt.subheadline, color = Palette.primary)
    val big = bigText()
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), maxItemsInEachRow = if (big) 2 else 5) {
        oddNights.filter { it - 2 < days.size }.forEach { n ->
            val eve = days[n - 2]
            Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (eve == today) Palette.gold.copy(alpha = 0.35f) else Purple.copy(alpha = 0.18f))
                .padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("$n", style = Txt.title3, color = Palette.primary)
                Text(if (eve == today) t(RamadanWordKey.tonight) else dateText(eve, "d MMM", t.lang), style = Txt.caption2, color = Palette.primary)
            }
        }
    }
    AlertSwitch(t(RamadanWordKey.qiyamReminder), t(RamadanWordKey.qiyamReminderSub), state.prefs.qiyamAlert) { on ->
        state.setRamadanAlert(on) { p, v -> p.copy(qiyamAlert = v) }
    }
    Text(t(RamadanWordKey.eachNightBegins), style = Txt.caption, color = Palette.secondary)
}

@Composable
private fun DoaList(state: AppState, ids: List<DoaId>) {
    val lang = RamadanContent.lang(state.resolver.naming)
    var open by remember { mutableStateOf<DoaId?>(null) }
    SectionHeader(RamadanWords.text(RamadanWordKey.doaAndNiat, lang))
    ids.forEach { id ->
        val d = RamadanContent.doa(id)
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Palette.primary.copy(alpha = 0.06f))
            .clickable { open = if (open == id) null else id }.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(d.title(lang), style = Txt.bodySemibold, color = Palette.primary, modifier = Modifier.weight(1f))
                Icon(Icons.Filled.ChevronRight, null, Modifier.size(18.dp), tint = Palette.secondary)
            }
            if (open == id) {
                Text(d.arabic, style = Txt.title2.copy(textDirection = TextDirection.Rtl, fontSize = 24.sp, lineHeight = 40.sp),
                    color = Palette.primary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth())
                Text(d.rumi, style = Txt.subheadline.copy(fontStyle = FontStyle.Italic), color = Palette.primary)
                Text(d.meaning(lang), style = Txt.subheadline, color = Palette.primary)
                Text(d.note(lang), style = Txt.footnote, color = Palette.secondary)
            }
        }
    }
}

@Composable
private fun Zakat(state: AppState, year: Int) {
    val r = state.resolver
    val uri = LocalUriHandler.current
    val lang = RamadanContent.lang(r.naming)
    val code = state.prefs.home?.countryCode ?: r.profile.code
    val bodies = RamadanContent.zakat[code].orEmpty()
    val t = RamadanWords.In(lang)
    SectionHeader(t(RamadanWordKey.zakatFitrah))
    Text(RamadanContent.zakatNote(lang), style = Txt.footnote, color = Palette.primary)
    bodies.forEach { b ->
        LinkLine(b.name, t(RamadanWordKey.zakatOfficial)) { uri.openUri(b.url) }
    }
    if (bodies.isEmpty()) Text(t(RamadanWordKey.zakatThroughMasjid), style = Txt.footnote, color = Palette.primary)
    AlertSwitch(t(RamadanWordKey.zakatPaid, "y" to year), null, year in state.prefs.zakatPaid) { on ->
        state.update { p -> p.copy(zakatPaid = if (on) p.zakatPaid + year else p.zakatPaid - year) }
    }
    Text(t(RamadanWordKey.zakatNoMoney), style = Txt.caption, color = Palette.secondary)
}

@Composable
private fun ShareAndPrint(state: AppState, s: Season.Info) {
    val r = state.resolver
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val t = words(state)
    SectionHeader(t(RamadanWordKey.shareAndPrint))
    LinkLine(t(RamadanWordKey.shareWeek), t(RamadanWordKey.shareWeekSubText, "p" to (r.activePlace?.name ?: t(RamadanWordKey.yourPlace))), Icons.Filled.Share) {
        val today = r.civil(state.now)
        val start = r.monthDays(s.hijri.year, 9).firstOrNull()?.let { if (it > today) it else today } ?: today
        val lines = (0 until 7).mapNotNull { i ->
            val g = start.plusDays(i.toLong())
            val h = r.hijriOf(g)
            val day = r.dayOf(g)
            if (h.month != 9 || day == null) null
            else "${dateText(g, "EEE d MMM")} (${h.day} Ramadan)  Imsak ${r.formatted(r.imsak(day))}  Berbuka ${r.formatted(day.time(Prayer.MAGHRIB))}"
        }
        if (lines.isNotEmpty()) {
            val text = "Ramadan Kareem. Imsak and Berbuka this week in ${r.activePlace?.name ?: ""}\n\n" + lines.joinToString("\n") +
                "\n\nFollow your local religious authority for the start of Ramadan and Raya.\nPrayer Times Asia · prayertimes.asia"
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share"))
        }
    }
    LinkLine(t(RamadanWordKey.printTimetable), null, Icons.Filled.Print) { uri.openUri("https://prayertimes.asia/app/print/#sheet=ramadan") }
    LinkLine(t(RamadanWordKey.printKidsChart), null, Icons.Filled.Print) { uri.openUri("https://prayertimes.asia/app/print/#sheet=fasting") }
}

@Composable
private fun RamadanSwitches(state: AppState) {
    val p = state.prefs
    val uri = LocalUriHandler.current
    val t = words(state)
    SectionHeader(t(RamadanWordKey.alertsTitle))
    AlertSwitch(t(RamadanWordKey.imsakAlert), t(RamadanWordKey.imsakAlertSub), p.imsakAlert) { on -> state.setRamadanAlert(on) { q, v -> q.copy(imsakAlert = v) } }
    AlertSwitch(t(RamadanWordKey.berbukaAlert), t(RamadanWordKey.berbukaAlertSub), p.berbukaAlert) { on -> state.setRamadanAlert(on) { q, v -> q.copy(berbukaAlert = v) } }
    AlertSwitch(t(RamadanWordKey.juzADay), t(RamadanWordKey.juzADaySub), p.khatamPlan) { on -> state.update { it.copy(khatamPlan = on) } }
    val day = state.resolver.season(state.now).ramadanDay
    if (p.khatamPlan) LinkLine(t(RamadanWordKey.readTodaysJuz), null, Icons.Filled.AutoAwesome) { uri.openUri(RamadanContent.juzLink(day ?: 1)) }
}

// MARK: Raya and Syawal

@Composable
private fun RayaToday(state: AppState, s: Season.Info) {
    val r = state.resolver
    val t = words(state)
    SectionHeader(if (s.phase == Season.Phase.RAYA) t(RamadanWordKey.firstSyawal) else t(RamadanWordKey.syawalDay, "n" to (s.syawalDay ?: 0)))
    Text(if (s.phase == Season.Phase.RAYA) t(RamadanWordKey.selamatHariRaya) else t(RamadanWordKey.syawal), style = Txt.title3, color = Palette.primary)
    if (s.phase != Season.Phase.RAYA) return
    val eid = state.prefs.myMasjid?.eid
    val day = r.day(state.now)
    if (eid != null) Text(t(RamadanWordKey.rayaPrayerAtPlace, "p" to (state.prefs.myMasjid?.name ?: t(RamadanWordKey.yourMasjid))) + " " + eid, style = Txt.bodySemibold, color = Palette.primary)
    else if (day != null) Text(t(RamadanWordKey.masjidSetsRayaTimeAfterSyuruk, "s" to r.formatted(day.time(Prayer.SUNRISE))),
        style = Txt.subheadline, color = Palette.primary)
    Text(t(RamadanWordKey.rayaSunnah), style = Txt.footnote, color = Palette.secondary)
    val context = LocalContext.current
    LinkLine(t(RamadanWordKey.sendRayaGreeting), null, Icons.Filled.Share) {
        val text = "Selamat Hari Raya Aidilfitri. Maaf zahir dan batin. Taqabbalallahu minna wa minkum."
        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share"))
    }
}

@Composable
private fun SyawalFasts(state: AppState, s: Season.Info) {
    val r = state.resolver
    val days = r.monthDays(s.hijri.year, 10)
    val today = r.civil(state.now)
    val sum = r.fastSummary(s.hijri.year, today)
    val t = words(state)
    SectionHeader(t(RamadanWordKey.syawalFastsTitle))
    Text("${minOf(6, sum.syawal)} ${t(RamadanWordKey.ofSixSyawal)} · ${t(RamadanWordKey.toReplace, "n" to sum.owed)}", style = Txt.bodySemibold, color = Palette.primary)
    DayGrid(days, today) { i, d, modifier ->
        val m = state.prefs.fastLog[d.toString()]
        val off = i == 0 || d > today
        Box(
            modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(10.dp))
                .background(when (m) { FastMark.SYAWAL -> Palette.success; FastMark.QADHA -> Palette.accent.copy(alpha = 0.45f); else -> Palette.primary.copy(alpha = 0.07f) })
                .border(1.5.dp, if (d == today) Palette.accent else Color.Transparent, RoundedCornerShape(10.dp))
                .clickable(enabled = !off) { state.setFast(d.toString(), syawalCycle[(syawalCycle.indexOf(m) + 1) % syawalCycle.size]) }
                .semantics { contentDescription = t(RamadanWordKey.syawalDayAria, "n" to i + 1, "s" to (if (i == 0) t(RamadanWordKey.rayaNoFasting) else m?.let(t::mark) ?: t(RamadanWordKey.notMarked))) },
            contentAlignment = Alignment.Center,
        ) {
            Text("${i + 1}", style = Txt.subheadlineSemibold, color = (if (m == FastMark.SYAWAL) Color.White else Palette.primary).copy(alpha = if (off) 0.4f else 1f))
            if (m == FastMark.QADHA) Text(t.letter(FastMark.QADHA), style = Txt.caption2Heavy, color = Palette.primary, modifier = Modifier.align(Alignment.BottomEnd).padding(3.dp))
        }
    }
    if (sum.owed > 0 && s.phase != Season.Phase.RAYA) {
        val key = today.toString()
        val done = state.prefs.fastLog[key] == FastMark.QADHA
        SeasonChip(if (done) t(RamadanWordKey.replacedToday) else t(RamadanWordKey.iReplacedToday), Icons.Filled.Check, done) {
            state.setFast(key, if (done) null else FastMark.QADHA)
        }
    }
    Text(t(RamadanWordKey.syawalHelp, "d" to dateText(today.plusDays(1), "EEEE d MMM", t.lang)) + " " + t(RamadanWordKey.replaceRule),
        style = Txt.caption, color = Palette.secondary)
}

// MARK: Small parts

@Composable
private fun LinkLine(title: String, detail: String?, icon: ImageVector? = null, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (icon != null) Icon(icon, null, Modifier.size(20.dp), tint = Palette.primary)
        Column(Modifier.weight(1f)) {
            Text(title, style = Txt.body, color = Palette.accentText)
            if (detail != null) Text(detail, style = Txt.caption, color = Palette.secondary)
        }
        Icon(Icons.Filled.ChevronRight, null, Modifier.size(18.dp), tint = Palette.secondary)
    }
}

@Composable
fun AlertSwitch(title: String, detail: String?, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = Txt.body, color = Palette.primary)
            if (detail != null) Text(detail, style = Txt.caption, color = Palette.secondary)
        }
        Switch(checked, onChange, colors = SwitchDefaults.colors(checkedTrackColor = Palette.success, checkedThumbColor = Color.White,
            uncheckedTrackColor = Palette.primary.copy(alpha = 0.16f), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent))
    }
}
