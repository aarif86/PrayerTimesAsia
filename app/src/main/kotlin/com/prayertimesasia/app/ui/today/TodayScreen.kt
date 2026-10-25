package com.prayertimesasia.app.ui.today

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.layout
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.Brightness2
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.CapsuleButton
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.quietClick
import com.prayertimesasia.app.ui.makers.MakersCard
import com.prayertimesasia.app.ui.makers.MakersOffer
import com.prayertimesasia.app.ui.theme.BandsPalette
import com.prayertimesasia.app.ui.theme.LivingSkyBackground
import com.prayertimesasia.app.ui.theme.LocalSkyScheme
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.SkyColors
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.TimeFormat
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.secondsSince
import kotlinx.coroutines.delay
import java.time.Instant

/** Everything one frame of the Prayer screen needs. */
class TodayFrame(
    val state: AppState,
    val now: Instant,
    val day: PrayerDay,
    val shown: PrayerDay,
    val offset: Int,
    val current: Pair<Prayer, Instant>?,
    val next: Pair<Prayer, Instant>?,
    val tomorrowFajr: Instant,
    val shownNextFajr: Instant,
) {
    val isToday get() = offset == 0
    val currentPrayer get() = if (isToday) current?.first else null
    val nextForList get() = if (isToday) next else null
    fun name(p: Prayer, t: Instant) = state.resolver.prayerName(p, t)
}

/**
 * The prayer times are the product: a small "where we are now" line, the day's
 * times large and colour-coded, AM/PM never wrapping. Five styles share it.
 */
@Composable
fun TodayScreen(state: AppState, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    val now = state.now
    val r = state.resolver
    val day = r.day(now)
    var offset by rememberSaveable { mutableIntStateOf(0) }
    if (day == null) {
        NoPlace(state, openPlaces)
        return
    }
    val shown = if (offset == 0) day else r.day(now, offset) ?: day
    val f = TodayFrame(
        state, now, day, shown, offset, r.current(now), r.next(now),
        tomorrowFajr = r.day(now, 1)?.time(Prayer.FAJR) ?: day.time(Prayer.FAJR).plusSeconds(86_400),
        shownNextFajr = r.day(shown.time(Prayer.DHUHR).plusSeconds(86_400))?.time(Prayer.FAJR) ?: shown.time(Prayer.FAJR).plusSeconds(86_400),
    )
    val setOffset: (Int) -> Unit = { offset = it }
    val style = state.prefs.todayStyle

    Box(Modifier.fillMaxSize()) {
        if (style == TodayStyle.BANDS) {
            Box(Modifier.fillMaxSize().background(BandsPalette.header))
        } else {
            LivingSkyBackground(SkyColors.at(now, day))
        }
        when (style) {
            TodayStyle.LIST -> ClassicPage(f, setOffset, openPlaces, openCalendar, openSanad)
            TodayStyle.CENTRE -> CentrePage(f, setOffset, openPlaces, openCalendar, openSanad)
            TodayStyle.DIAL -> DialPage(f, setOffset, openPlaces, openCalendar, openSanad)
            TodayStyle.SUN_PATH -> SunPathPage(f, setOffset, openPlaces, openCalendar, openSanad)
            TodayStyle.BANDS -> BandsPage(f, setOffset, openPlaces, openCalendar, openSanad)
        }
        StyleToast(state)
    }
}

/** The new style's (or appearance's) name, shown for a moment after switching. */
@Composable
private fun StyleToast(state: AppState) {
    var toast by remember { mutableStateOf<String?>(null) }
    var first by remember { mutableStateOf(true) }
    val style = state.prefs.todayStyle
    val appearance = state.prefs.appearance
    LaunchedEffect(style) {
        if (first) return@LaunchedEffect
        toast = style.label
        delay(1400)
        if (toast == style.label) toast = null
    }
    LaunchedEffect(appearance) {
        if (first) { first = false; return@LaunchedEffect }
        val label = if (appearance == Appearance.SYSTEM) "Automatic: follows the sky" else appearance.label
        toast = label
        delay(1400)
        if (toast == label) toast = null
    }
    Box(Modifier.fillMaxWidth().padding(top = 52.dp), contentAlignment = Alignment.TopCenter) {
        AnimatedVisibility(toast != null, enter = fadeIn(), exit = fadeOut()) {
            Text(toast ?: "", style = Txt.subheadlineSemibold, color = Palette.primary,
                modifier = Modifier.clip(CircleShape).background(Palette.materialStrong).padding(horizontal = 16.dp, vertical = 8.dp))
        }
    }
}

/** Swipe left or right to move a day. */
fun Modifier.daySwipe(offset: Int, onOffset: (Int) -> Unit): Modifier = pointerInput(offset) {
    var total = 0f
    detectHorizontalDragGestures(
        onDragStart = { total = 0f },
        onDragEnd = { if (kotlin.math.abs(total) > 30.dp.toPx()) onOffset(if (total < 0) offset + 1 else offset - 1) },
    ) { _, dx -> total += dx }
}

@Composable
private fun ColumnScope.Prompts(f: TodayFrame) {
    val p = f.state.prefs
    if (!p.notificationsEnabled && !p.alertsPromptDismissed) AlertsPrompt(f.state)
    if (!p.arrivalBannerDismissed) ArrivalCard(f.state)
}

@Composable
private fun Makers(f: TodayFrame) {
    if (f.state.prefs.showOffers && f.state.prefs.showMore) {
        MakersCard(MakersOffer.featured(f.state.offerCountry), "prayer", compact = true)
    }
}

/**
 * Lays out [top], the list and [bottom] to fill the screen when they fit - the
 * rows stretch so the day breathes - and scrolls when they don't (small phones,
 * Show more open), like the iOS ViewThatFits.
 */
@Composable
private fun FillOrScroll(
    f: TodayFrame,
    setOffset: (Int) -> Unit,
    spacing: Dp,
    top: @Composable ColumnScope.() -> Unit,
    bottom: @Composable ColumnScope.() -> Unit,
    contentPadding: PaddingValues = PaddingValues(start = Dims.gutter, end = Dims.gutter, top = 4.dp, bottom = 8.dp),
) {
    val density = LocalDensity.current
    var topH by remember { mutableStateOf(0.dp) }
    var bottomH by remember { mutableStateOf(0.dp) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val extra = contentPadding.calculateTopPadding() + contentPadding.calculateBottomPadding() + spacing * 2
        val avail = maxHeight - topH - bottomH - extra
        val blessed = if (f.state.prefs.showMore) f.state.resolver.blessedTimes(f.shown).size else 0
        // Six rows share what's left (the list's own padding and gaps come off first).
        val perRow = (avail - 16.dp - 6.dp * (5 + blessed) - 58.dp * blessed) / 6
        val rowHeight = if (perRow >= 60.dp) minOf(perRow, 92.dp) else null
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(contentPadding),
            verticalArrangement = Arrangement.spacedBy(spacing),
        ) {
            Column(Modifier.onSizeChanged { topH = with(density) { it.height.toDp() } }, verticalArrangement = Arrangement.spacedBy(spacing)) { top() }
            PrayerList(f.state, f.shown, f.now, f.currentPrayer, f.nextForList, f.state.prefs.showMore, rowHeight,
                Modifier.daySwipe(f.offset, setOffset))
            Column(Modifier.onSizeChanged { bottomH = with(density) { it.height.toDp() } }, verticalArrangement = Arrangement.spacedBy(spacing)) { bottom() }
        }
    }
}

/** Lets a child be wider than its padded parent by [h] on each side (full-bleed). */
fun Modifier.bleed(h: Dp): Modifier = layout { measurable, constraints ->
    val extra = h.roundToPx() * 2
    val w = constraints.maxWidth + extra
    val placeable = measurable.measure(constraints.copy(minWidth = w, maxWidth = w))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
}

// MARK: Side Dial

@Composable
private fun ClassicPage(f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    FillOrScroll(f, setOffset, 12.dp, top = {
        // The Day Dial on the left; where, when and the source on the right.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            val cur = f.current
            val nxt = f.next
            if (cur != null && nxt != null) {
                DayDial(f.now, f.day, f.tomorrowFajr, f.state.resolver.zone, f.name(cur.first, cur.second), cur.first,
                    TimeFormat.short(nxt.second.secondsSince(f.now)), f.name(nxt.first, nxt.second), 172.dp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) { HeaderButtons(f.state) }
                PlaceChip(f.state, openPlaces)
                DateBlock(f.state, f.shown, f.offset, setOffset, openCalendar)
                SourceBadge(f.state, f.shown, onClick = { openSanad(f.shown) })
            }
        }
        Prompts(f)
    }, bottom = {
        ShowMoreButton(f.state, Modifier.fillMaxWidth())
        Makers(f)
    })
}

// MARK: Centre Dial

@Composable
private fun CentrePage(f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    FillOrScroll(f, setOffset, 8.dp, top = {
        Box(Modifier.fillMaxWidth().padding(bottom = 10.dp)) {
            val cur = f.current
            val nxt = f.next
            if (cur != null && nxt != null) {
                DayDial(f.now, f.day, f.tomorrowFajr, f.state.resolver.zone, f.name(cur.first, cur.second), cur.first,
                    TimeFormat.short(nxt.second.secondsSince(f.now)), f.name(nxt.first, nxt.second), 148.dp,
                    Modifier.align(Alignment.Center))
            }
            Column(Modifier.align(Alignment.TopEnd).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                StyleButton(f.state)
                AppearanceButton(f.state)
                if (f.state.prefs.trackerEnabled) StreakChip(f.state)
            }
        }
        DayPlaceChip(f.state, f.offset, openPlaces)
        Prompts(f)
        if (f.state.prefs.musafirEnabled && f.state.resolver.musafirStatus(f.now)?.isTraveller == true) MusafirChip(f.state)
        DayNavigator(f.state, f.shown, f.offset, setOffset, openCalendar)
    }, bottom = {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SourceBadge(f.state, f.shown, onClick = { openSanad(f.shown) })
            Spacer(Modifier.weight(1f))
            ShowMoreButton(f.state)
        }
        Makers(f)
    })
}

// MARK: Day Dial

@Composable
private fun DialPage(f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    val state = f.state
    val density = LocalDensity.current
    var topH by remember { mutableStateOf(0.dp) }
    var bottomH by remember { mutableStateOf(0.dp) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val dialHeight = (maxHeight - topH - bottomH - 14.dp * 2 - 12.dp).coerceAtLeast(300.dp)
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = Dims.gutter, end = Dims.gutter, top = 4.dp, bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Column(Modifier.onSizeChanged { topH = with(density) { it.height.toDp() } }, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PlaceChip(state, openPlaces)
                    Spacer(Modifier.weight(1f))
                    HeaderButtons(state)
                }
                Prompts(f)
                DateHeader(state, f.shown, f.offset, setOffset, openCalendar)
            }
            HeroDialFor(f, Modifier.bleed(Dims.gutter - 8.dp).height(dialHeight).daySwipe(f.offset, setOffset))
            Column(Modifier.onSizeChanged { bottomH = with(density) { it.height.toDp() } }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                DayRow(state, f.shown, f.offset, setOffset) { openSanad(f.shown) }
                ShowMoreButton(state, Modifier.fillMaxWidth())
                Makers(f)
            }
        }
    }
}

/** The Day Dial with every time of the day inside it, and the day in its centre. */
@Composable
private fun HeroDialFor(f: TodayFrame, modifier: Modifier) {
    val state = f.state
    val r = state.resolver
    val blessed = if (state.prefs.showMore) r.blessedTimes(f.shown) else emptyList()
    val marks = Prayer.all.map { p ->
        DialMark(p.raw, f.shown.time(p), extraLine = f.shown.jamaah[p] != null || f.shown.alternate[p] != null, tint = p.tint)
    } + blessed.map { DialMark(it.first.raw, it.second, minor = true) }
    HeroDial(
        f.now, f.shown, f.shownNextFajr, r.zone, f.currentPrayer, marks, modifier,
        label = { mark, size ->
            val prayer = Prayer.fromRaw(mark.id)
            if (prayer != null) {
                PrayerMark(state, f.shown, prayer, mark.date, f.now, size, f.isToday && prayer == f.current?.first)
            } else {
                blessed.firstOrNull { it.first.raw == mark.id }?.let { BlessedMark(state, it.first, it.second, f.now, size) }
            }
        },
        centre = { size -> DialCentre(f, size) },
    )
}

/** One prayer inside the dial: its name and time, tinted when it is now. Tap for its alert. */
@Composable
private fun PrayerMark(state: AppState, day: PrayerDay, prayer: Prayer, time: Instant, now: Instant, size: Dp, isCurrent: Boolean) {
    val r = state.resolver
    val p = state.prefs
    val passed = time <= now && !isCurrent
    val notifying = p.notificationsEnabled && prayer in p.notifyPrayers
    val trackable = p.trackerEnabled && prayer.isObligatory && time <= now
    val prayed = trackable && r.isPrayed(prayer, time)
    var menu by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(size * 0.035f)
    Box(
        Modifier.fillMaxSize()
            .then(if (isCurrent) Modifier.clip(shape).background(prayer.tint.copy(alpha = 0.16f)).border(1.dp, prayer.tint.copy(alpha = 0.5f), shape) else Modifier)
            .quietClick { menu = true },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 4.dp)
            .alpha(if (passed && !prayed) 0.55f else 1f)) {
            val own = r.prayerName(prayer, time)
            val name = r.localName(prayer, time)?.let { "$own · $it" } ?: own
            Text(name, fontSize = (size.value * 0.034f).sp, lineHeight = (size.value * 0.04f).sp, fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.SemiBold,
                color = if (isCurrent) prayer.tint else Palette.primary.copy(alpha = 0.75f), maxLines = 1, textAlign = TextAlign.Center,
                fontFamily = com.prayertimesasia.app.ui.theme.Rounded)
            com.prayertimesasia.app.ui.components.TimeText(r.timeParts(time), size = (size.value * 0.05f).sp,
                weight = if (isCurrent) FontWeight.Bold else FontWeight.SemiBold)
            val jamaah = day.jamaah[prayer]
            val other = day.alternate[prayer]
            if (jamaah != null) {
                Text("Jamaah ${r.formatted(jamaah)}", fontSize = (size.value * 0.027f).sp, color = Palette.primary.copy(alpha = 0.75f))
            } else if (other != null && day.alternateSource != null) {
                Text("${day.alternateSource} ${r.formatted(other)}", fontSize = (size.value * 0.027f).sp, maxLines = 1,
                    color = com.prayertimesasia.core.SourceGrade.MASJID.tint)
            }
        }
        androidx.compose.material3.DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            androidx.compose.material3.DropdownMenuItem(
                text = { Text(if (notifying) "Turn off alert" else "Alert me at ${prayer.name(r.naming)}") },
                onClick = { menu = false; state.toggleNotify(prayer) })
            if (trackable) {
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(if (prayed) "Mark as not prayed" else "Mark as prayed") },
                    onClick = { menu = false; state.togglePrayed(prayer, time) })
            }
        }
    }
}


/** A blessed time inside the dial, smaller and quieter than the prayers. */
@Composable
private fun BlessedMark(state: AppState, blessed: com.prayertimesasia.core.BlessedTime, time: Instant, now: Instant, size: Dp) {
    val r = state.resolver
    Column(Modifier.fillMaxSize().alpha(if (time <= now) 0.55f else 1f),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Icon(blessed.icon, null, Modifier.size((size.value * 0.03f).dp), tint = Palette.secondary)
            Text(blessed.shortName, fontSize = (size.value * 0.028f).sp, lineHeight = (size.value * 0.034f).sp, fontWeight = FontWeight.SemiBold, color = Palette.secondary, maxLines = 1)
        }
        com.prayertimesasia.app.ui.components.TimeText(r.timeParts(time), size = (size.value * 0.04f).sp, weight = FontWeight.Medium,
            color = Palette.primary.copy(alpha = 0.85f))
    }
}

/** The dial's centre: the prayer we are in and the time left until the next. */
@Composable
private fun DialCentre(f: TodayFrame, size: Dp) {
    val cur = if (f.isToday) f.current else null
    val nxt = f.next
    if (cur != null && nxt != null) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy((size.value * 0.006f).dp)) {
            Text("NOW", fontSize = (size.value * 0.028f).sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.6.sp, color = cur.first.tint)
            Text(f.name(cur.first, cur.second), style = display((size.value * 0.085f).sp, FontWeight.Bold), color = Palette.primary, maxLines = 1)
            Text(TimeFormat.short(nxt.second.secondsSince(f.now)), style = display((size.value * 0.066f).sp, FontWeight.SemiBold),
                color = Palette.accent, maxLines = 1)
            Text("until ${f.name(nxt.first, nxt.second)}", fontSize = (size.value * 0.034f).sp, fontWeight = FontWeight.Medium,
                color = Palette.secondary, maxLines = 1)
        }
    } else {
        Icon(Icons.Filled.Brightness2, null, Modifier.size((size.value * 0.08f).dp), tint = Palette.primary.copy(alpha = 0.5f))
    }
}

// MARK: Sun Path

@Composable
private fun SunPathPage(f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    val state = f.state
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = Dims.gutter, end = Dims.gutter, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Left: where we are in the day. Right: streak and buttons. One row.
        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.Top) {
            val cur = f.current
            val nxt = f.next
            if (cur != null && nxt != null) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(9.dp).clip(CircleShape).background(cur.first.tint))
                        Text(f.name(cur.first, cur.second), style = display(30.sp, FontWeight.Bold), color = Palette.primary)
                    }
                    val left = TimeFormat.short(nxt.second.secondsSince(f.now))
                    val nextName = f.name(nxt.first, nxt.second)
                    Text(
                        if (nxt.first == Prayer.SUNRISE) "$left until $nextName - ${Prayer.FAJR.name(state.resolver.naming)} ends" else "$left until $nextName",
                        style = Txt.subheadlineSemibold.copy(fontFeatureSettings = "tnum"), color = Palette.primary,
                        modifier = Modifier.clip(CircleShape).background(Palette.primary.copy(alpha = 0.1f)).padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            } else {
                Spacer(Modifier.weight(1f))
            }
            HeaderButtons(state, showMusafir = false)
        }
        SunPath(f.now, f.day, state.resolver.zone, Palette.sunArc, Modifier.bleed(Dims.gutter).height(96.dp))
        Box(Modifier.offset(y = (-6).dp)) { DayPlaceChip(state, f.offset, openPlaces) }
        Prompts(f)
        if (state.prefs.musafirEnabled && state.resolver.musafirStatus(f.now)?.isTraveller == true) MusafirChip(state)
        DayNavigator(state, f.shown, f.offset, setOffset, openCalendar)
        PrayerList(state, f.shown, f.now, f.currentPrayer, f.nextForList, state.prefs.showMore, null, Modifier.daySwipe(f.offset, setOffset))
        ShowMoreButton(state, Modifier.fillMaxWidth())
        SourceBadge(state, f.shown, compact = false, onClick = { openSanad(f.shown) }, modifier = Modifier.fillMaxWidth())
        Makers(f)
    }
}

// MARK: Colour Bands

@Composable
private fun BandsPage(f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    val state = f.state
    val density = LocalDensity.current
    var headerH by remember { mutableStateOf(0.dp) }
    var footerH by remember { mutableStateOf(0.dp) }
    val buttonBg = Color.White.copy(alpha = 0.12f)
    androidx.compose.runtime.CompositionLocalProvider(LocalSkyScheme provides LocalSkyScheme.current.copy(dark = true, softNight = false)) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val blessed = if (state.prefs.showMore) state.resolver.blessedTimes(f.shown) else emptyList()
            val bandsNatural = 64.dp * 6 + 52.dp * blessed.size + 44.dp
            val fill = maxHeight - headerH - footerH >= bandsNatural
            Column(Modifier.fillMaxSize().then(if (fill) Modifier else Modifier.verticalScroll(rememberScrollState()))) {
                Column(
                    Modifier.onSizeChanged { headerH = with(density) { it.height.toDp() } }
                        .padding(start = Dims.gutter, end = Dims.gutter, top = 4.dp, bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PlaceChip(state, openPlaces, big = true, outlined = false)
                        Spacer(Modifier.weight(1f))
                        HeaderButtons(state, background = buttonBg)
                    }
                    val cur = f.current
                    val nxt = f.next
                    if (cur != null && nxt != null && f.isToday) {
                        Text("${f.name(cur.first, cur.second)} now · ${TimeFormat.short(nxt.second.secondsSince(f.now))} until ${f.name(nxt.first, nxt.second)}",
                            style = Txt.subheadlineSemibold.copy(fontFeatureSettings = "tnum"), color = Color.White.copy(alpha = 0.75f))
                    }
                    Prompts(f)
                }
                BandsDateBar(f, setOffset, openCalendar)
                Column(Modifier.fillMaxWidth().then(if (fill) Modifier.weight(1f) else Modifier).daySwipe(f.offset, setOffset)) {
                    Prayer.all.forEach { p ->
                        PrayerBand(state, p, f.shown.time(p), f.now, isCurrent = f.isToday && p == f.current?.first,
                            next = if (f.isToday && p == f.next?.first) f.next else null, fill = fill)
                    }
                    blessed.forEach { BlessedBand(state, it.first, it.second, f.now) }
                }
                Column(
                    Modifier.onSizeChanged { footerH = with(density) { it.height.toDp() } }
                        .padding(start = Dims.gutter, end = Dims.gutter, top = 12.dp, bottom = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        SourceBadge(state, f.shown, onClick = { openSanad(f.shown) })
                        Spacer(Modifier.weight(1f))
                        ShowMoreButton(state)
                    }
                    Makers(f)
                }
            }
        }
    }
}

/** "‹  25 Oct 2026 · 14 Jamadilawal 1448  ›" on a darker strip. */
@Composable
private fun BandsDateBar(f: TodayFrame, setOffset: (Int) -> Unit, openCalendar: () -> Unit) {
    val hijri = f.state.resolver.hijri(f.shown.time(Prayer.DHUHR))
    Row(Modifier.fillMaxWidth().background(BandsPalette.dateBar).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.ChevronLeft, "Previous day", Modifier.size(36.dp, 40.dp).quietClick { setOffset(f.offset - 1) }.padding(6.dp), tint = Color.White)
        Row(Modifier.weight(1f).quietClick { if (f.offset == 0) openCalendar() else setOffset(0) },
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            if (f.offset != 0) Icon(Icons.Filled.Undo, null, Modifier.size(14.dp).padding(end = 4.dp), tint = Color.White)
            Text("${dateText(f.state, f.shown, "d MMM yyyy")} · $hijri", style = Txt.headline, color = Color.White, maxLines = 1)
        }
        Icon(Icons.Filled.ChevronRight, "Next day", Modifier.size(36.dp, 40.dp).quietClick { setOffset(f.offset + 1) }.padding(6.dp), tint = Color.White)
    }
}

// MARK: No place yet

@Composable
private fun NoPlace(state: AppState, openPlaces: () -> Unit) {
    Box(Modifier.fillMaxSize()) {
        LivingSkyBackground(SkyColors.preDawn)
        Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Filled.MyLocation, null, Modifier.size(54.dp), tint = Palette.primary)
            Spacer(Modifier.height(16.dp))
            Text(if (state.locationRequested && !state.location.hasPermission) "Location is off" else "Finding where you are…",
                style = Txt.title2, color = Palette.primary)
            Spacer(Modifier.height(16.dp))
            Text("Prayer times are calculated for your exact spot. Allow location, or pick a city.", style = Txt.body,
                color = Palette.primary.copy(alpha = 0.85f), textAlign = TextAlign.Center)
            Spacer(Modifier.height(16.dp))
            CapsuleButton("Choose a city", background = Palette.primary.copy(alpha = 0.25f), onClick = openPlaces)
        }
    }
}

