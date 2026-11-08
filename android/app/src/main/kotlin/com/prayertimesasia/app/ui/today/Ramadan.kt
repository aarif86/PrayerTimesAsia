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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
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
import com.prayertimesasia.core.Resolver
import com.prayertimesasia.core.Season
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/*
 * Ramadan, Raya and Syawal: the card at the top of the Prayer screen and the
 * Ramadan page. Same features as web/src/ui/Ramadan.tsx and the iPhone's
 * RamadanView.swift. Dates follow the user's religious authority (core Season.kt).
 */

private val RamadanPink = Color(0xFFE06C8A)
private val Purple = Color(0xFF8E6BD8)
private val oddNights = listOf(21, 23, 25, 27, 29)

private fun dateText(d: LocalDate, pattern: String = "EEEE d MMMM"): String = d.format(DateTimeFormatter.ofPattern(pattern, Locale.ENGLISH))

private fun whenWords(from: LocalDate, d: LocalDate): String = when (ChronoUnit.DAYS.between(from, d)) {
    0L -> "today"
    1L -> "tomorrow, ${dateText(d, "EEEE d MMM")}"
    2L -> "the day after tomorrow, ${dateText(d, "EEEE d MMM")}"
    else -> dateText(d)
}

private fun countdown(from: Instant, to: Instant): String {
    val s = Duration.between(from, to).seconds.coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    return if (h > 0) "${h}h ${m}m" else if (m > 0) "${m}m ${s % 60}s" else "${s}s"
}

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
private fun PreviewTag() {
    Text("PREVIEW", style = Txt.caption2Heavy, color = Color.Black,
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
    GlassCard(Modifier.clickable { state.showRamadan = true }) {
        if (r.isSeasonPreview) PreviewTag()
        when (s.phase) {
            Season.Phase.RAMADAN -> {
                val key = today.toString()
                val mark = state.prefs.fastLog[key]
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Column(Modifier.clip(RoundedCornerShape(14.dp)).background(Palette.gold.copy(alpha = 0.18f)).padding(horizontal = 10.dp, vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("RAMADAN", style = Txt.caption2Heavy, color = Palette.gold)
                        Text("${s.ramadanDay ?: 0}", style = Txt.largeTitle, color = Palette.primary)
                    }
                    Column(Modifier.weight(1f)) {
                        val m = r.fastingMoment(now)
                        if (m != null) {
                            val imsak = m.first == Resolver.FastingKind.IMSAK
                            Text(if (imsak) "IMSAK IN" else "BERBUKA IN", style = Txt.caption2Heavy, color = Palette.primary)
                            Text(countdown(now, m.second), style = Txt.title2.copy(fontSize = 28.sp), color = Palette.gold)
                            Text("${if (imsak) "Finish sahur by" else "Maghrib at"} ${r.formatted(m.second)}", style = Txt.footnote, color = Palette.secondary)
                        } else {
                            Text("TONIGHT", style = Txt.caption2Heavy, color = Palette.primary)
                            Text(if (s.sightingTonight != null) "Moon sighting for Raya" else "Tarawih after Isyak", style = Txt.headline, color = Palette.primary)
                        }
                    }
                    Icon(Icons.Filled.ChevronRight, null, Modifier.size(18.dp), tint = Palette.secondary)
                }
                val authority = authorityName(r) ?: "Your authority"
                val next = s.nextStart
                if (s.sightingTonight != null) {
                    Note(if (next != null && next.announced) "Hari Raya is ${whenWords(today, next.day)}, announced by $authority."
                    else "Moon sighting tonight. $authority announces whether tomorrow is Raya.")
                } else if (s.hijri.day == 30) Note("The last fast. Hari Raya is tomorrow.")
                if (s.lastTen && s.nightTonight != null) {
                    Note("Night ${s.nightTonight} tonight" + if (s.oddNight) ", one of the odd nights. Seek Lailatul Qadr." else ", in the last ten nights.")
                }
                if (s.nuzulQuran) Note("17 Ramadan, Nuzul Quran.")
                FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    SeasonChip(if (mark == null || mark == FastMark.FASTED) "Fasting today" else mark.label,
                        if (mark == FastMark.FASTED) Icons.Filled.Check else Icons.Filled.Restaurant, mark == FastMark.FASTED) {
                        state.setFast(key, if (mark == FastMark.FASTED) null else FastMark.FASTED)
                    }
                    val tarawih = key in state.prefs.tarawihLog
                    SeasonChip("Tarawih", if (tarawih) Icons.Filled.Check else Icons.Filled.NightsStay, tarawih) { state.toggleTarawih(key) }
                    val juz = s.ramadanDay
                    if (state.prefs.khatamPlan && juz != null) {
                        val read = key in state.prefs.quranLog
                        SeasonChip("Juz $juz", if (read) Icons.Filled.Check else Icons.Filled.AutoAwesome, read) { state.toggleJuz(key) }
                    }
                }
            }
            Season.Phase.SYAABAN -> {
                val authority = authorityName(r)
                val next = s.nextStart
                if (s.sightingTonight != null) {
                    Title("Moon sighting tonight")
                    Note(authority?.let { "$it announces the start of Ramadan this evening. This screen updates by itself." }
                        ?: "Ramadan may begin tomorrow, after tonight's moon sighting.")
                } else if (next != null && next.announced) {
                    Title("Ramadan begins ${whenWords(today, next.day)}")
                    Note("Announced by ${authority ?: "your authority"}. First Tarawih the night before.")
                } else {
                    val first = r.monthDays(s.hijri.year, 9).firstOrNull()
                    val days = first?.let { ChronoUnit.DAYS.between(today, it) }
                    Title(when { days == null -> "Ramadan is near"; days <= 0 -> "Ramadan begins today"; days == 1L -> "Ramadan begins tomorrow"; else -> "Ramadan in about $days days" })
                    Note(if (days != null && days <= 1) "First Tarawih tonight. Set your sahur alarm." else "Get ready with your alerts, a timetable to print and the doa.")
                }
            }
            else -> {
                val sum = r.fastSummary(s.hijri.year, today)
                if (s.phase == Season.Phase.RAYA) {
                    Title("Selamat Hari Raya Aidilfitri")
                    val eid = state.prefs.myMasjid?.eid?.let { "Raya prayer at ${state.prefs.myMasjid?.name} $it. " } ?: "Takbir until the Raya prayer. "
                    Note(eid + if (s.hijri.year in state.prefs.zakatPaid) "Maaf zahir dan batin." else "Pay zakat fitrah before the prayer if you haven't.")
                } else {
                    Title("Syawal ${s.syawalDay ?: 0} · Puasa enam ${minOf(6, sum.syawal)} of 6")
                    Note((if (sum.owed > 0) "${sum.owed} Ramadan fast${if (sum.owed == 1) "" else "s"} to replace. " else "") + "Tap to mark a Syawal or replaced fast.")
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
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Dims.gutter, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(if (syawal) "Syawal" else "Ramadan", style = Txt.title2, color = Palette.primary)
        if (r.isSeasonPreview) {
            Text("Ramadan preview is on, so dates here are pretend. Turn it off in Settings, Ramadan and Syawal.",
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
            RamadanMonth(state, s.hijri.year)
            LastTen(state, s.hijri.year)
            DoaList(state, listOf(DoaId.NIAT_PUASA, DoaId.BERBUKA, DoaId.BERBUKA_HADITH, DoaId.QADR))
            Zakat(state, s.hijri.year)
            SectionHeader("Travelling in Ramadan")
            Text("A traveller on a journey of about ${r.prefs.musafirThresholdKm.toInt()} km or more may choose not to fast, and replace the day after Ramadan. If fasting is easy, fasting is better. Leave your home area before Subuh for the day to count as travel. Ask your local religious authority when unsure.",
                style = Txt.footnote, color = Palette.primary)
            ShareAndPrint(state, s)
            RamadanSwitches(state)
        }
        Text("Imsak is 10 minutes before Subuh, as MUIS, JAKIM and Kemenag publish it. The first day of Ramadan and Raya follows ${authorityName(r) ?: "your authority"} (change it by tapping the date on the Prayer screen). Follow your local religious authority. Your fasting record stays on this phone.",
            style = Txt.caption, color = Palette.secondary, modifier = Modifier.padding(top = 12.dp))
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun TimeBox(title: String, time: String, sub: String, highlight: Boolean, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(if (highlight) Palette.gold.copy(alpha = 0.2f) else Palette.primary.copy(alpha = 0.06f))
        .padding(vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = Txt.caption2Heavy, color = if (highlight) Palette.gold else Palette.secondary)
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
    val shown = first?.let { r.dayOf(it) } ?: r.day(state.now) ?: return
    SectionHeader(if (inRamadan) "Ramadan day ${s.ramadanDay ?: 0}" else first?.let { "1 Ramadan · ${dateText(it)}" } ?: "Ramadan")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TimeBox("IMSAK", r.formatted(r.imsak(shown)), "Stop eating", false, Modifier.weight(1f))
        TimeBox("SUBUH", r.formatted(shown.time(Prayer.FAJR)), "Fast begins", false, Modifier.weight(1f))
        TimeBox("BERBUKA", r.formatted(shown.time(Prayer.MAGHRIB)), "Maghrib", true, Modifier.weight(1f))
    }
    if (!inRamadan) return
    r.fastingMoment(state.now)?.let { (kind, t) ->
        Text("${if (kind == Resolver.FastingKind.IMSAK) "Imsak" else "Berbuka"} in ${countdown(state.now, t)}", style = Txt.headline,
            color = Palette.gold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
    val key = r.civil(state.now).toString()
    val mark = state.prefs.fastLog[key]
    var showMissed by remember { mutableStateOf(false) }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        SeasonChip("I'm fasting today", if (mark == FastMark.FASTED) Icons.Filled.Check else Icons.Filled.Restaurant, mark == FastMark.FASTED) {
            state.setFast(key, if (mark == FastMark.FASTED) null else FastMark.FASTED)
        }
        SeasonChip(if (mark?.isMissed == true) "Missed · ${mark.label}" else "Not fasting today", Icons.Filled.ChevronRight,
            mark?.isMissed == true, RamadanPink) { showMissed = !showMissed }
    }
    if (showMissed) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            FastMark.MISSED.forEach { m ->
                SeasonChip(m.label, Icons.Filled.Check, mark == m, RamadanPink) { state.setFast(key, if (mark == m) null else m); showMissed = false }
            }
        }
    }
    if (mark == FastMark.PERIOD) Text("You can also pause the prayer tracker for these days.", style = Txt.footnote, color = Palette.secondary)
    val beforeBerbuka = r.fastingMoment(state.now)?.first == Resolver.FastingKind.BERBUKA
    HadithView(state, HadithId.IFTAR, Modifier.padding(top = 8.dp), tag = if (beforeBerbuka) "Before berbuka" else null)
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
    SectionHeader("Your fasts this month")
    DayGrid(days, today) { i, d, modifier ->
        val m = state.prefs.fastLog[d.toString()]
        val future = d > today
        Box(
            modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(10.dp))
                .background(when { m == FastMark.FASTED -> Palette.success; m?.isMissed == true -> RamadanPink.copy(alpha = 0.3f); else -> Palette.primary.copy(alpha = 0.07f) })
                .border(1.5.dp, when { d == today -> Palette.accent; (i + 1) in oddNights -> Palette.gold.copy(alpha = 0.7f); else -> Color.Transparent }, RoundedCornerShape(10.dp))
                .clickable(enabled = !future) { state.setFast(d.toString(), ramadanCycle[(ramadanCycle.indexOf(m) + 1) % ramadanCycle.size]) }
                .semantics { contentDescription = "${i + 1} Ramadan: ${m?.label ?: "not marked"}" },
            contentAlignment = Alignment.Center,
        ) {
            Text("${i + 1}", style = Txt.subheadlineSemibold, color = (if (m == FastMark.FASTED) Color.White else Palette.primary).copy(alpha = if (future) 0.4f else 1f))
            if (m != null && m.letter.isNotEmpty()) Text(m.letter, style = Txt.caption2Heavy, color = Palette.primary, modifier = Modifier.align(Alignment.BottomEnd).padding(3.dp))
        }
    }
    Text("${sum.fasted} fasted" + (if (sum.missed > 0) " · ${sum.missed} missed" else "") + (if (sum.owed > 0) " · ${sum.owed} to replace" else ""),
        style = Txt.subheadline, color = Palette.primary)
    Text("Tap a day to change it. P period, S sick, T travelling, O other reason. Missed days are counted for you to replace after Ramadan.",
        style = Txt.caption, color = Palette.secondary)
}

@Composable
private fun LastTen(state: AppState, year: Int) {
    val r = state.resolver
    val days = r.monthDays(year, 9)
    if (days.size < 20) return
    val today = r.civil(state.now)
    SectionHeader("The last ten nights")
    Text("Lailatul Qadr is better than a thousand months. Seek it in the odd nights of the last ten.", style = Txt.subheadline, color = Palette.primary)
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        oddNights.filter { it - 2 < days.size }.forEach { n ->
            val eve = days[n - 2]
            Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (eve == today) Palette.gold.copy(alpha = 0.35f) else Purple.copy(alpha = 0.18f))
                .padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("$n", style = Txt.title3, color = Palette.primary)
                Text(if (eve == today) "Tonight" else dateText(eve, "d MMM"), style = Txt.caption2, color = Palette.primary)
            }
        }
    }
    AlertSwitch("Remind me for qiyam", "At the last third of each of the last ten nights", state.prefs.qiyamAlert) { on ->
        state.setRamadanAlert(on) { p, v -> p.copy(qiyamAlert = v) }
    }
    Text("Each night begins at Maghrib the evening before. The last third of the night is the best time for qiyam.", style = Txt.caption, color = Palette.secondary)
}

@Composable
private fun DoaList(state: AppState, ids: List<DoaId>) {
    val lang = RamadanContent.lang(state.resolver.naming)
    var open by remember { mutableStateOf<DoaId?>(null) }
    SectionHeader("Doa and niat")
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
    SectionHeader("Zakat fitrah")
    Text(RamadanContent.zakatNote(lang), style = Txt.footnote, color = Palette.primary)
    bodies.forEach { b ->
        LinkLine(b.name, "Official site, amount and how to pay") { uri.openUri(b.url) }
    }
    if (bodies.isEmpty()) Text("Pay through your masjid or your local zakat body.", style = Txt.footnote, color = Palette.primary)
    AlertSwitch("I've paid zakat fitrah for $year", null, year in state.prefs.zakatPaid) { on ->
        state.update { p -> p.copy(zakatPaid = if (on) p.zakatPaid + year else p.zakatPaid - year) }
    }
    Text("Prayer Times Asia takes no money. These links go straight to the official bodies.", style = Txt.caption, color = Palette.secondary)
}

@Composable
private fun ShareAndPrint(state: AppState, s: Season.Info) {
    val r = state.resolver
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    SectionHeader("Share and print")
    LinkLine("Share this week's times", "Imsak and Berbuka for ${r.activePlace?.name ?: "your place"}, for family chats", Icons.Filled.Share) {
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
    LinkLine("Print the Ramadan timetable", null, Icons.Filled.Print) { uri.openUri("https://prayertimes.asia/app/print/#sheet=ramadan") }
    LinkLine("Print a kids' fasting chart", null, Icons.Filled.Print) { uri.openUri("https://prayertimes.asia/app/print/#sheet=fasting") }
}

@Composable
private fun RamadanSwitches(state: AppState) {
    val p = state.prefs
    val uri = LocalUriHandler.current
    SectionHeader("Ramadan alerts and reading")
    AlertSwitch("Imsak alert", "10 minutes before Imsak, to finish sahur", p.imsakAlert) { on -> state.setRamadanAlert(on) { q, v -> q.copy(imsakAlert = v) } }
    AlertSwitch("Berbuka alert", "At Maghrib, with the doa", p.berbukaAlert) { on -> state.setRamadanAlert(on) { q, v -> q.copy(berbukaAlert = v) } }
    AlertSwitch("A juz a day", "Finish the Quran this month. Tick each juz on the Prayer screen", p.khatamPlan) { on -> state.update { it.copy(khatamPlan = on) } }
    val day = state.resolver.season(state.now).ramadanDay
    if (p.khatamPlan) LinkLine("Read today's juz", null, Icons.Filled.AutoAwesome) { uri.openUri(RamadanContent.juzLink(day ?: 1)) }
}

// MARK: Raya and Syawal

@Composable
private fun RayaToday(state: AppState, s: Season.Info) {
    val r = state.resolver
    SectionHeader(if (s.phase == Season.Phase.RAYA) "1 Syawal" else "Syawal ${s.syawalDay ?: 0}")
    Text(if (s.phase == Season.Phase.RAYA) "Selamat Hari Raya Aidilfitri" else "Syawal", style = Txt.title3, color = Palette.primary)
    if (s.phase != Season.Phase.RAYA) return
    val eid = state.prefs.myMasjid?.eid
    val day = r.day(state.now)
    if (eid != null) Text("Raya prayer at ${state.prefs.myMasjid?.name ?: "your masjid"}, $eid", style = Txt.bodySemibold, color = Palette.primary)
    else if (day != null) Text("Your masjid sets the Raya prayer time, usually between 7.30 and 8.30 in the morning, after Syuruk at ${r.formatted(day.time(Prayer.SUNRISE))}.",
        style = Txt.subheadline, color = Palette.primary)
    Text("Eat something before going out, take a different road home, and keep the takbir until the prayer begins.", style = Txt.footnote, color = Palette.secondary)
    val context = LocalContext.current
    LinkLine("Send a Raya greeting", null, Icons.Filled.Share) {
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
    SectionHeader("Puasa enam and ganti")
    Text("${minOf(6, sum.syawal)} of 6 Syawal fasts · ${sum.owed} to replace", style = Txt.bodySemibold, color = Palette.primary)
    DayGrid(days, today) { i, d, modifier ->
        val m = state.prefs.fastLog[d.toString()]
        val off = i == 0 || d > today
        Box(
            modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(10.dp))
                .background(when (m) { FastMark.SYAWAL -> Palette.success; FastMark.QADHA -> Palette.accent.copy(alpha = 0.45f); else -> Palette.primary.copy(alpha = 0.07f) })
                .border(1.5.dp, if (d == today) Palette.accent else Color.Transparent, RoundedCornerShape(10.dp))
                .clickable(enabled = !off) { state.setFast(d.toString(), syawalCycle[(syawalCycle.indexOf(m) + 1) % syawalCycle.size]) }
                .semantics { contentDescription = "${i + 1} Syawal: ${if (i == 0) "Hari Raya, no fasting" else m?.label ?: "not marked"}" },
            contentAlignment = Alignment.Center,
        ) {
            Text("${i + 1}", style = Txt.subheadlineSemibold, color = (if (m == FastMark.SYAWAL) Color.White else Palette.primary).copy(alpha = if (off) 0.4f else 1f))
            if (m == FastMark.QADHA) Text("G", style = Txt.caption2Heavy, color = Palette.primary, modifier = Modifier.align(Alignment.BottomEnd).padding(3.dp))
        }
    }
    if (sum.owed > 0 && s.phase != Season.Phase.RAYA) {
        val key = today.toString()
        val done = state.prefs.fastLog[key] == FastMark.QADHA
        SeasonChip(if (done) "Replaced a fast today" else "I replaced a fast today", Icons.Filled.Check, done) {
            state.setFast(key, if (done) null else FastMark.QADHA)
        }
    }
    Text("Tap a day once for a Syawal fast, twice for a replaced (ganti) fast. No fasting on 1 Syawal. Missed Ramadan fasts can be replaced any day before next Ramadan, except the days of Raya and Tasyrik.",
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
