@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.core.app.NotificationManagerCompat
import androidx.compose.ui.platform.LocalContext
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.R
import com.prayertimesasia.app.alarms.AlarmScheduler
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.app.ui.components.HadithView
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.ui.components.trCount
import androidx.lifecycle.compose.currentStateAsState
import com.prayertimesasia.app.ui.theme.AppIcons
import com.prayertimesasia.app.ui.theme.Body
import com.prayertimesasia.app.ui.theme.cappedSp
import com.prayertimesasia.app.ui.theme.LocalLook
import com.prayertimesasia.app.ui.theme.Look
import com.prayertimesasia.app.ui.theme.Lucide
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.AlertMode
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.BlessedTime
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.SourceGrade
import com.prayertimesasia.core.TimeFormat
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.alertMode
import com.prayertimesasia.core.allFiveNotify
import com.prayertimesasia.core.nextAlertMode
import com.prayertimesasia.core.secondsSince
import java.time.Instant
import kotlin.math.max
import kotlin.math.min

/*
 * The Prayer screen as on the web app (web/src/ui/Today.tsx and the `.v12` blocks of
 * web/src/ui/screens.css): one top bar, the look's signature, the date, one compact
 * list card, the source line. Every feature of the old pages stays: alerts on the bell
 * (tap to change, hold for the prayer's page), the tracker tick on a row, Show more,
 * the hadith, arrival and long day notes, Ramadan, Musafir, and the community card.
 */

// MARK: Colours of the Prayer page

/** The web's page tokens for the Prayer screen (--fg, --fg2, --fg3, --card, --stroke, --hair, --accent). */
internal class PageColors(
    val fg: Color, val fg2: Color, val fg3: Color, val card: Color, val stroke: Color, val hair: Color, val accent: Color,
    val onAccent: Color,
)

@Composable
internal fun pageColors(): PageColors {
    val look = LocalLook.current
    val c = look.c
    val dark = look.dark
    // The web's global --stroke, used by the Centre, Sun Path and Simple cards.
    val stroke = when {
        look.bands || look.gold -> c.stroke
        dark -> Color.White.copy(alpha = 0.12f)
        else -> Color.Black.copy(alpha = 0.08f)
    }
    val accent = if (look.bands) c.accentText else look.appAccent
    val onAccent = if (look.bands) c.onButton else look.onAppAccent
    return PageColors(c.tx, c.tx2, c.tx3, c.card, stroke, c.sep, accent, onAccent)
}

/** All five on Notify and the phone lets us show them: only then is it true to say so. */
@Composable
internal fun allFiveOn(state: AppState): Boolean {
    val context = LocalContext.current
    // Read again whenever the app comes back, as the phone's settings can change while away.
    val resumed = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycle.currentStateAsState().value.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED)
    val allowed = remember(state.prefs.notificationsEnabled, resumed) {
        runCatching { NotificationManagerCompat.from(context).areNotificationsEnabled() }.getOrDefault(true)
    }
    return state.prefs.notificationsEnabled && state.prefs.allFiveNotify() && allowed
}

// MARK: The pages

@Composable
internal fun V12Page(f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    when (f.state.prefs.todayStyle.look) {
        TodayStyle.BANDS -> BandsV12(f, setOffset, openPlaces, openCalendar, openSanad)
        TodayStyle.SIMPLE -> ListPageV12(f, setOffset, openPlaces, openCalendar, openSanad, simple = true)
        else -> ListPageV12(f, setOffset, openPlaces, openCalendar, openSanad)
    }
}

/** Centre Dial, Calm Gold, Sun Path and Big and Simple: the same column, a different signature at the top. */
@Composable
private fun ListPageV12(
    f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit,
    simple: Boolean = false,
) {
    val look = LocalLook.current
    val col = pageColors()
    val density = LocalDensity.current
    var topH by remember { mutableStateOf(0.dp) }
    var bottomH by remember { mutableStateOf(0.dp) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val width = maxWidth - 40.dp
        val screenW = maxWidth
        // Big and Simple: the list grows to fill the screen, rows 62 to 76 tall (web .simple-page.v12).
        val rows = entries(f.state, f.shown, f.state.prefs.showMore).size
        val simpleRow = if (simple) {
            val avail = maxHeight - topH - bottomH - 8.dp - 48.dp - 10.dp * 2
            (avail / rows).coerceIn(62.dp, 76.dp)
        } else null
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(top = 4.dp, bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(if (simple) 8.dp else 10.dp),
        ) {
            Column(Modifier.onSizeChanged { topH = with(density) { it.height.toDp() } },
                verticalArrangement = Arrangement.spacedBy(if (simple) 8.dp else 10.dp)) {
                TopBarV12(f, openPlaces)
                when {
                    simple -> SimpleNow(f, col)
                    look.sunPath -> SunStatus(f, col, width)
                    else -> Box(Modifier.fillMaxWidth().padding(top = 2.dp), contentAlignment = Alignment.Center) {
                        // The web sizes the dial from the screen width (clamp with vw), not the padded column.
                        val size = if (look.gold) (screenW.value * 0.52f).coerceIn(160f, 204f) else (screenW.value * 0.485f).coerceIn(150f, 190f)
                        SmallDial(f, size.dp, gold = look.gold, col = col)
                    }
                }
                Prompts(f, hadith = !simple)
                if (f.state.prefs.musafirEnabled && !f.state.prefs.musafirChipDismissed && f.state.resolver.musafirStatus(f.now)?.isTraveller == true) MusafirChip(f.state)
                DayNavigatorV12(f, setOffset, openCalendar, col)
            }
            PrayerCard(f, setOffset, col, simpleRow)
            Column(Modifier.onSizeChanged { bottomH = with(density) { it.height.toDp() } },
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                AllFiveLine(f.state, col)
                if (!simple) SourceLine(f, col, Modifier.align(Alignment.CenterHorizontally).offset(y = (-8).dp)) { openSanad(f.shown) }
                Makers(f)
            }
        }
    }
}

// MARK: Top bar

@Composable
private fun TopBarV12(f: TodayFrame, openPlaces: () -> Unit) {
    val state = f.state
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        // The chip takes the room the buttons leave, and shrinks only when the name is long.
        Box(Modifier.weight(1f)) { PlaceChipV12(state, openPlaces) }
        if (state.prefs.musafirEnabled && state.prefs.musafirChipDismissed && state.resolver.musafirStatus(f.now)?.isTraveller == true) {
            RoundButton(AppIcons.journey, tr(R.string.today_musafirButton), iconSize = 18.dp,
                background = pageColors().accent.copy(alpha = 0.25f)) { state.showJourney = true }
        }
        WakeChipV12(state)
        MenuButtonV12(f)
    }
}

/** The look's button shape: round, or a square-cornered box in Colour Bands. */
@Composable
private fun buttonShape(): Shape = if (LocalLook.current.bands) RoundedCornerShape(10.dp) else CircleShape

@Composable
private fun RoundButton(icon: ImageVector, label: String, iconSize: Dp = 22.dp, background: Color? = null, onClick: () -> Unit) {
    val col = pageColors()
    val shape = buttonShape()
    Box(
        Modifier.size(44.dp).clip(shape).background(background ?: col.card, shape).border(1.dp, col.stroke, shape)
            .clickable(onClickLabel = label, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, Modifier.size(iconSize), tint = col.fg) }
}

@Composable
private fun PlaceChipV12(state: AppState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val col = pageColors()
    val look = LocalLook.current
    val shape = if (look.bands) RoundedCornerShape(6.dp) else CircleShape
    val place = state.resolver.activePlace
    val name = place?.name ?: tr(R.string.masjid_choosePlace)
    Row(
        modifier.sizeIn(minHeight = 44.dp).padding(vertical = 4.dp).clip(shape).background(col.card, shape).border(1.dp, col.stroke, shape)
            .clickable(onClickLabel = tr(R.string.today_changeLocation), onClick = onClick)
            .heightIn(min = 36.dp).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (state.prefs.useGPS) Icon(Lucide.navigationFilled, null, Modifier.size(11.dp), tint = col.accent)
        else Icon(Lucide.mapPin(), null, Modifier.size(12.dp), tint = col.accent)
        Text(name, fontFamily = Body, fontSize = cappedSp(if (name.length > 11) 13f else 15f, 1.4f), fontWeight = FontWeight.SemiBold,
            color = col.fg, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
        if (place != null && place.isInAsia) Text(place.profile.flag, fontSize = 14.sp)
        Icon(Lucide.chevronDown(3f), null, Modifier.size(12.dp), tint = col.fg.copy(alpha = 0.6f))
    }
}

/** The alarm clock: shows the next alarm's time when one is set. Opens Alerts and alarms. */
@Composable
private fun WakeChipV12(state: AppState) {
    val col = pageColors()
    val next = AlarmScheduler.nextWakeUp(state.resolver, state.now)
    if (next == null) {
        RoundButton(Lucide.alarmClock(), tr(R.string.alerts_title)) { state.openAlerts() }
        return
    }
    val label = tr(R.string.alerts_chipNext, "time" to state.resolver.formatted(next.at))
    val shape = buttonShape().let { if (it == CircleShape) RoundedCornerShape(999.dp) else it }
    Row(
        Modifier.height(44.dp).clip(shape).background(col.accent.copy(alpha = 0.3f), shape)
            .clickable(onClickLabel = label) { state.openAlerts() }.semantics(mergeDescendants = true) { contentDescription = label }
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(Lucide.alarmClock(), null, Modifier.size(16.dp), tint = col.fg)
        Text(state.resolver.formatted(next.at).removeSuffix(" AM").removeSuffix(" PM").removeSuffix(" am").removeSuffix(" pm"),
            fontFamily = Body, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = col.fg,
            style = TextStyle(fontFeatureSettings = "tnum"), modifier = Modifier.clearAndSetSemantics {})
    }
}

/** The menu: light or dark, the look, the prayer streak (web MenuButton). */
@Composable
private fun MenuButtonV12(f: TodayFrame) {
    val state = f.state
    val look = LocalLook.current
    val col = pageColors()
    var open by remember { mutableStateOf(false) }
    var looks by remember { mutableStateOf(false) }
    Box {
        RoundButton(Lucide.ellipsis(), tr(R.string.today_menuButton), iconSize = 18.dp) { open = true }
        if (open) {
            val close = { open = false; looks = false }
            Popup(
                alignment = Alignment.TopEnd, offset = with(LocalDensity.current) { IntOffset(0, 52.dp.roundToPx()) },
                onDismissRequest = close, properties = PopupProperties(focusable = true),
            ) {
                val shape = if (look.bands) RoundedCornerShape(4.dp) else RoundedCornerShape(20.dp)
                val bg = if (look.dark) Color(28, 28, 38).copy(alpha = 0.97f) else Color(246, 246, 250).copy(alpha = 0.98f)
                val line = if (look.dark) Color.White.copy(alpha = 0.12f) else Color.Black.copy(alpha = 0.08f)
                Column(Modifier.width(262.dp).clip(shape).background(bg, shape).border(1.dp, line, shape)) {
                    if (looks) {
                        MenuItem(Lucide.chevronLeft(), tr(R.string.menu_back), null, line) { looks = false }
                        TodayStyle.looks.forEachIndexed { i, st ->
                            val on = st == state.prefs.todayStyle.look
                            MenuItem(if (on) Lucide.circleCheck() else null, st.label, null, if (i < TodayStyle.looks.lastIndex) line else null,
                                selected = on) { close(); state.update { it.copy(todayStyle = st) } }
                        }
                    } else {
                        Column(Modifier.fillMaxWidth().drawBehind { drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }
                            .padding(horizontal = 16.dp, vertical = 12.dp)) {
                            Text(tr(R.string.menu_appearance).uppercase(), fontFamily = Body, fontSize = 12.sp, letterSpacing = 0.72.sp, color = col.fg2,
                                modifier = Modifier.padding(bottom = 8.dp))
                            Segmented(
                                listOf(Appearance.SYSTEM to tr(R.string.menu_auto), Appearance.LIGHT to tr(R.string.menu_light), Appearance.DARK to tr(R.string.menu_dark)),
                                state.prefs.appearance,
                            ) { a -> state.update { it.copy(appearance = a) } }
                        }
                        MenuItem(Lucide.palette(), tr(R.string.menu_lookAndFeel), state.prefs.todayStyle.look.label, line) { looks = true }
                        val r = state.resolver
                        val streak = when {
                            !state.prefs.trackerEnabled -> tr(R.string.common_off)
                            state.prefs.trackerPausedSince != null -> tr(R.string.today_trackerPaused).removePrefix(",").trim()
                            r.isExcused(f.now) -> tr(R.string.today_trackerExcused).removePrefix(",").trim()
                            else -> r.streak(f.now).let { n -> trCount(R.string.menu_days, R.string.menu_days_one, n, "n" to n) }
                        }
                        MenuItem(Lucide.circleCheck(), tr(R.string.menu_streak), streak, null) { close(); state.showTracker = true }
                    }
                }
            }
        }
    }
}

@Composable
private fun MenuItem(icon: ImageVector?, text: String, detail: String?, line: Color?, selected: Boolean = false, onClick: () -> Unit) {
    val col = pageColors()
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp)
            .then(if (line != null) Modifier.drawBehind { drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) } else Modifier)
            .clickable(onClick = onClick).semantics { if (selected) stateDescription = "Selected" }
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(20.dp), tint = col.accent) else Spacer(Modifier.size(20.dp))
        Text(text, fontFamily = Body, fontSize = 16.sp, color = col.fg, modifier = Modifier.weight(1f))
        if (detail != null) Text(detail, fontFamily = Body, fontSize = 14.sp, color = col.fg2, maxLines = 1)
    }
}

/** The web's segmented control: a soft track, the chosen part raised. */
@Composable
internal fun <T> Segmented(options: List<Pair<T, String>>, value: T, onChange: (T) -> Unit) {
    val look = LocalLook.current
    val col = pageColors()
    val track = if (look.dark) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.07f)
    val raised = if (look.dark) Color.White.copy(alpha = 0.2f) else Color.White
    val outer = if (look.bands) RoundedCornerShape(6.dp) else RoundedCornerShape(10.dp)
    val inner = if (look.bands) RoundedCornerShape(4.dp) else RoundedCornerShape(8.dp)
    Row(Modifier.fillMaxWidth().clip(outer).background(track, outer).padding(2.dp)) {
        options.forEach { (v, label) ->
            val on = v == value
            Box(
                Modifier.weight(1f).heightIn(min = 36.dp).clip(inner).background(if (on) raised else Color.Transparent, inner)
                    .clickable(role = Role.RadioButton) { onChange(v) }.semantics { if (on) stateDescription = "Selected" },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, fontFamily = Body, fontSize = 14.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium, color = col.fg, maxLines = 1)
            }
        }
    }
}

// MARK: Dials and the signature of each look

@Composable
private fun SmallDial(f: TodayFrame, size: Dp, gold: Boolean, col: PageColors) {
    val lead = f.lead
    val next = f.next
    if (lead == null || next == null) {
        Spacer(Modifier.size(size)); return
    }
    val t = Countdown.of(f.state, f.now, next)
    val name = f.name(lead.prayer, lead.time)
    val inPrayer = !t.toNext
    val kicker = if (inPrayer) name else tr(R.string.today_nextPrayer)
    val count = if (inPrayer) t.count else t.bare
    val label = if (inPrayer) t.label else tr(R.string.today_untilName, "name" to f.name(next.first, next.second))
    val spoken = if (inPrayer) "Now $name. $count $label." else "Next ${f.name(next.first, next.second)}, in $count."
    val look = LocalLook.current
    val zone = f.state.resolver.zone
    val mid = midnight(f.day, zone)
    Box(Modifier.size(size).semantics { contentDescription = spoken }, contentAlignment = Alignment.Center) {
        if (gold) {
            val k = size.value / 214f
            val goldFill = Color(0xFFE2B65A)
            val track = if (look.dark) Color.White.copy(alpha = 0.08f) else Color(0xFF151A45).copy(alpha = 0.1f)
            Canvas(Modifier.fillMaxSize()) {
                val px = this.size.width / size.value
                val r = 98 * k * px
                val w = 3 * k * px
                drawCircle(track, r, center, style = Stroke(w))
                val sweep = ((f.now.secondsSince(mid) / 86_400.0) * 360).toFloat().coerceIn(0.5f, 359.5f)
                // From midnight at the bottom, clockwise.
                drawArc(goldFill, 90f, sweep, false, Offset(center.x - r, center.y - r), Size(r * 2, r * 2), style = Stroke(w, cap = StrokeCap.Round))
                val dot = point(center, 180.0 + sweep, r)
                drawCircle(Color.White, 7 * k * px, dot)
                drawCircle(goldFill, 7 * k * px, dot, style = Stroke(w))
            }
            val glyph = (16 * k).dp
            Icon(Lucide.sun(), null, Modifier.align(Alignment.TopCenter).offset(y = (20 * k).dp - glyph / 2).size(glyph), tint = col.accent)
            Icon(Lucide.moon(), null, Modifier.align(Alignment.BottomCenter).offset(y = -(20 * k).dp + glyph / 2).size(glyph), tint = col.accent)
            DialCentreV12(kicker, count, label, t.urgent, 14 * k, 40 * k, 14 * k, col)
        } else {
            val k = size.value / 190f
            val fg = col.fg
            val accent = col.accent
            Canvas(Modifier.fillMaxSize()) {
                val px = this.size.width / size.value
                val ring = 10 * k * px
                val r = this.size.width / 2 - ring / 2
                drawCircle(fg.copy(alpha = 0.1f), r, center, style = Stroke(ring))
                skySegments(f.day, f.tomorrowFajr, mid, r, ring, null, 0.9f)
                val dot = point(center, dialAngle(f.now, mid), r)
                drawCircle(accent.copy(alpha = 0.5f), 13 * k * px, dot)
                drawCircle(Color.White, 9 * k * px, dot)
            }
            val ring = 10 * k
            val glyphY = (ring + 5 * k + 7.5f * k)
            val glyph = (15 * k).dp
            Icon(Lucide.sun(), null, Modifier.align(Alignment.TopCenter).offset(y = glyphY.dp - glyph / 2).size(glyph), tint = col.accent)
            Icon(Lucide.moon(), null, Modifier.align(Alignment.BottomCenter).offset(y = -glyphY.dp + glyph / 2).size(glyph), tint = col.accent)
            DialCentreV12(kicker, count, label, t.urgent, 13 * k, 32 * k, 14 * k, col)
        }
    }
}

@Composable
private fun DialCentreV12(kicker: String, count: String, label: String, urgent: Boolean, kSize: Float, cSize: Float, lSize: Float, col: PageColors) {
    Column(Modifier.clearAndSetSemantics {}.widthIn(max = 200.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(kicker, fontFamily = Body, fontSize = cappedSp(kSize), lineHeight = cappedSp(kSize * 1.3f), color = col.fg2, maxLines = 1)
        Text(count, fontFamily = Rounded, fontSize = cappedSp(cSize), lineHeight = cappedSp(cSize * 1.15f), fontWeight = FontWeight.Bold,
            color = if (urgent) col.accent else col.fg, maxLines = 1, softWrap = false, style = TextStyle(fontFeatureSettings = "tnum"))
        if (label.isNotEmpty()) Text(label, fontFamily = Body, fontSize = cappedSp(lSize), lineHeight = cappedSp(lSize * 1.3f), color = col.fg2, maxLines = 1,
            textAlign = TextAlign.Center)
    }
}

/** Sun Path: a dot and the prayer's big name, the time in a pill, then the day's arc. */
@Composable
private fun SunStatus(f: TodayFrame, col: PageColors, width: Dp) {
    val lead = f.lead
    val next = f.next
    if (lead != null && next != null) {
        val t = Countdown.of(f.state, f.now, next)
        Column(Modifier.padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(10.dp).background(lead.prayer.tint, CircleShape))
                Text(f.name(lead.prayer, lead.time), fontFamily = Rounded, fontSize = 44.sp, lineHeight = 44.sp, fontWeight = FontWeight.Bold,
                    color = col.fg, maxLines = 1)
            }
            Text(t.text, fontFamily = Body, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = if (t.urgent) col.accent else col.fg,
                style = TextStyle(fontFeatureSettings = "tnum"),
                modifier = Modifier.clip(CircleShape).background(col.card, CircleShape).border(1.dp, col.stroke, CircleShape)
                    .padding(horizontal = 16.dp, vertical = 8.dp))
        }
    }
    SunPathV12(f, col, Modifier.bleed(20.dp).fillMaxWidth().height(120.dp).offset(y = (-4).dp))
}

/** The day as one arc, midnight to midnight, as the web's v12 Sun Path. */
@Composable
private fun SunPathV12(f: TodayFrame, col: PageColors, modifier: Modifier) {
    val day = f.day
    val zone = f.state.resolver.zone
    val start = midnight(day, zone)
    fun fraction(t: Instant) = (t.secondsSince(start) / 86_400).coerceIn(0.0, 1.0)
    val fg = col.fg
    val fg3 = col.fg3
    val accent = col.accent
    val isDay = f.now >= day.time(Prayer.SUNRISE) && f.now < day.time(Prayer.MAGHRIB)
    val nowF = fraction(f.now)
    var sunAt by remember { mutableStateOf(Offset.Zero) }
    Box(modifier) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val noon = fraction(day.time(Prayer.DHUHR))
            val half = (fraction(day.time(Prayer.MAGHRIB)) - fraction(day.time(Prayer.SUNRISE))) / 2
            val horizonV = kotlin.math.cos(2 * Math.PI * half)
            val top = 22.dp.toPx()
            val bottom = h - 14.dp.toPx()
            fun y(v: Double) = (bottom - ((v + 1) / 2) * (bottom - top)).toFloat()
            val horizon = y(horizonV)
            fun pt(fr: Double) = Offset((fr * w).toFloat(), y(kotlin.math.cos(2 * Math.PI * (fr - noon))))
            val path = Path()
            for (i in 0..240) { val p = pt(i / 240.0); if (i == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y) }
            drawLine(fg3.copy(alpha = fg3.alpha * 0.5f), Offset(0f, horizon), Offset(w, horizon), 1.dp.toPx())
            drawPath(path, fg3.copy(alpha = fg3.alpha * 0.7f), style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
            clipRect(0f, -20.dp.toPx(), w, horizon) { drawPath(path, accent, style = Stroke(3.5.dp.toPx(), cap = StrokeCap.Round)) }
            Prayer.all.forEach { p -> drawCircle(fg, 5.5.dp.toPx(), pt(fraction(day.time(p))), style = Stroke(2.dp.toPx())) }
            val s = pt(nowF)
            sunAt = s
            // A soft glow (the web blurs it), then the sun or the moon.
            val glowR = (if (isDay) 24 else 15).dp.toPx()
            drawCircle(androidx.compose.ui.graphics.Brush.radialGradient(
                listOf(Color(0xFFF7BD8F).copy(alpha = if (isDay) 0.55f else 0.45f), Color(0xFFF7BD8F).copy(alpha = 0f)), center = s, radius = glowR), glowR, s)
            if (isDay) drawCircle(Color(0xFFFFD98A), 9.dp.toPx(), s)
        }
        if (!isDay) {
            val d = LocalDensity.current
            Icon(Lucide.moon(), null, Modifier.offset(x = with(d) { sunAt.x.toDp() } - 7.dp, y = with(d) { sunAt.y.toDp() } - 7.dp).size(14.dp), tint = accent)
        }
    }
}

/** Big and Simple: the prayer in big words and how long to go. */
@Composable
private fun SimpleNow(f: TodayFrame, col: PageColors) {
    val lead = f.lead ?: return
    val next = f.next ?: return
    val t = Countdown.of(f.state, f.now, next)
    val look = LocalLook.current
    val nameColor = if (look.dark) Color(0xFFB2A8FF) else Color(0xFF4B3CBF)
    Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = 2.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(f.name(lead.prayer, lead.time), fontFamily = Rounded, fontSize = 46.sp, lineHeight = 48.sp, fontWeight = FontWeight.Bold, color = nameColor, maxLines = 1)
            if (t.done) Icon(Lucide.circleCheck(), "Prayed", Modifier.padding(start = 8.dp).size(30.dp), tint = col.accent)
        }
        if (t.text.isNotEmpty()) Text(t.text, fontFamily = Rounded, fontSize = 24.sp, fontWeight = FontWeight.SemiBold,
            color = if (t.urgent) col.accent else col.fg, maxLines = 1, style = TextStyle(fontFeatureSettings = "tnum"))
    }
}

// MARK: Date

@Composable
private fun DayNavigatorV12(f: TodayFrame, setOffset: (Int) -> Unit, openCalendar: () -> Unit, col: PageColors) {
    val state = f.state
    val prevL = tr(R.string.today_prevDay)
    val nextL = tr(R.string.today_nextDay)
    val midL = if (f.offset == 0) tr(R.string.today_datesSources) else tr(R.string.today_backToToday)
    Row(Modifier.fillMaxWidth().padding(start = 2.dp, end = 6.dp, top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClickLabel = tr(R.string.today_prevDay)) { setOffset(f.offset - 1) }
            .semantics { contentDescription = prevL }, contentAlignment = Alignment.Center) {
            Icon(Lucide.chevronLeft(), null, Modifier.size(26.dp), tint = col.fg2)
        }
        Column(
            Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).clickable(onClickLabel = midL) { if (f.offset == 0) openCalendar() else setOffset(0) },
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(dateText(state, f.shown, "EEE d MMM"), fontFamily = Body, fontSize = 18.sp, lineHeight = 21.6.sp, fontWeight = FontWeight.Bold,
                color = col.fg, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(state.resolver.hijri(f.shown.time(Prayer.DHUHR)), fontFamily = Body, fontSize = 14.sp, color = col.fg2, maxLines = 1)
                if (f.offset == 0) Icon(Lucide.calendar(), null, Modifier.size(20.dp), tint = col.fg2)
                else Icon(Lucide.undo2(), null, Modifier.size(18.dp), tint = col.fg2)
            }
        }
        Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClickLabel = tr(R.string.today_nextDay)) { setOffset(f.offset + 1) }
            .semantics { contentDescription = nextL }, contentAlignment = Alignment.Center) {
            Icon(Lucide.chevronRight(), null, Modifier.size(26.dp), tint = col.fg2)
        }
    }
}

// MARK: The list card

@Composable
private fun PrayerCard(f: TodayFrame, setOffset: (Int) -> Unit, col: PageColors, simpleRow: Dp?) {
    val state = f.state
    val shape = RoundedCornerShape(20.dp)
    var syurukOpen by remember { mutableStateOf(false) }
    val hideBells = allFiveOn(state)
    val litPrayer = if (f.isToday) (f.currentPrayer ?: f.next?.first) else null
    Column(
        Modifier.fillMaxWidth().clip(shape).background(col.card, shape).border(1.dp, col.stroke, shape).daySwipe(f.offset, setOffset),
    ) {
        for (e in entries(state, f.shown, state.prefs.showMore)) {
            when (e) {
                is Entry.P -> {
                    val onTap = if (e.prayer == Prayer.SUNRISE && state.prefs.showHadith) ({ syurukOpen = !syurukOpen }) else null
                    PrayerRowV12(f, e.prayer, e.time, lit = e.prayer == litPrayer, hideBell = hideBells && e.prayer.isObligatory,
                        col = col, rowHeight = simpleRow, onTap = onTap)
                    if (e.prayer == Prayer.SUNRISE && syurukOpen && state.prefs.showHadith) {
                        HadithView(state, HadithId.SYURUK, Modifier.padding(start = 12.dp, end = 12.dp, bottom = 8.dp), line = true)
                    }
                }
                is Entry.B -> BlessedRowV12(state, e.blessed, e.time, col, simpleRow)
            }
        }
        ShowMoreLink(state, col, simpleRow != null)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PrayerRowV12(
    f: TodayFrame, prayer: Prayer, time: Instant, lit: Boolean, hideBell: Boolean, col: PageColors, rowHeight: Dp?, onTap: (() -> Unit)?,
) {
    val state = f.state
    val look = LocalLook.current
    val r = state.resolver
    val p = state.prefs
    val now = f.now
    val isCurrent = f.isToday && prayer == f.currentPrayer && time <= now
    val next = f.nextForList
    val isNext = next != null && prayer == next.first && next.second == time
    val passed = time <= now && !isCurrent
    val trackable = p.trackerEnabled && prayer.isObligatory && time <= now
    val prayed = trackable && r.isPrayed(prayer, time)
    val mode = p.alertMode(prayer)
    val simple = look.simple
    val noBar = simple || look.gold
    val dotColor = if (look.gold) (if (look.dark) Color(0xFFE2B65A) else Color(0xFFA87A12)) else col.accent
    val highlight = isCurrent || lit
    val rowBg = when {
        !highlight -> Color.Transparent
        look.gold -> look.c.tint
        else -> col.accent.copy(alpha = 0.12f)
    }
    val spoken = listOfNotNull(
        r.prayerName(prayer, time), r.localName(prayer, time), r.formatted(time),
        if (isCurrent) "now" else if (isNext && next != null) "in ${TimeFormat.short(next.second.secondsSince(now))}" else null,
        day(f).jamaah[prayer]?.let { jamaahLine(r, day(f), prayer, it, now) },
        if (prayed) "prayed" else null,
    ).joinToString(", ")
    val tint = prayer.tint
    val hair = col.hair
    Row(
        Modifier.fillMaxWidth()
            .heightIn(min = rowHeight ?: if (simple) 62.dp else 54.dp)
            .background(rowBg)
            .drawBehind {
                drawLine(hair, Offset(0f, size.height - 0.5.dp.toPx()), Offset(size.width, size.height - 0.5.dp.toPx()), 1.dp.toPx())
                if (!noBar) drawRoundRect(tint, Offset(0f, 12.dp.toPx()), Size(4.dp.toPx(), size.height - 24.dp.toPx()), CornerRadius(2.dp.toPx()))
            }
            .then(if (trackable || onTap != null) Modifier.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                if (trackable) state.togglePrayed(prayer, time) else onTap?.invoke()
            } else Modifier)
            .semantics(mergeDescendants = false) { contentDescription = spoken }
            .padding(start = if (noBar) 18.dp else 28.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (noBar && lit && f.isToday) Box(Modifier.offset(x = 2.dp).size(8.dp).background(dotColor, CircleShape))
        Column(Modifier.weight(1f).clearAndSetSemantics {}.padding(vertical = 6.dp)) {
            FlowLine {
                Text(r.prayerName(prayer, time), fontFamily = Body, fontSize = cappedSp(if (simple) 23f else 19f, 1.25f),
                    fontWeight = if (lit) FontWeight.Bold else FontWeight.Medium, color = if (passed) col.fg2 else col.fg, maxLines = 1, modifier = Modifier.align(Alignment.CenterVertically))
                r.localName(prayer, time)?.let { Text(it, fontFamily = Body, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = col.fg2, maxLines = 1, modifier = Modifier.align(Alignment.CenterVertically)) }
                if (prayed) Box(Modifier.align(Alignment.CenterVertically).size(18.dp).background(if (look.gold) Color(0xFFE2B65A) else col.accent, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Lucide.check(3.4f), null, Modifier.size(11.dp), tint = if (look.gold) Color(0xFF151100) else col.onAccent)
                }
                if (!isCurrent && isNext && next != null) {
                    Text(tr(R.string.today_inTime, "time" to TimeFormat.short(next.second.secondsSince(now))), fontFamily = Body,
                        fontSize = if (simple) 15.sp else 13.sp, fontWeight = FontWeight.SemiBold, color = col.accent, maxLines = 1,
                        style = TextStyle(fontFeatureSettings = "tnum"), modifier = Modifier.align(Alignment.CenterVertically))
                }
            }
            day(f).jamaah[prayer]?.let { Text(jamaahLine(r, day(f), prayer, it, now), fontFamily = Body, fontSize = 13.sp, color = col.fg2) }
            val other = day(f).alternate[prayer]
            val src = day(f).alternateSource
            if (other != null && src != null) Text("$src ${r.formatted(other)}", fontFamily = Body, fontSize = 13.sp, color = col.fg2)
        }
        TimeV12(r.timeParts(time), cappedSp(if (simple) 23f else 20f, 1.2f), cappedSp(if (simple) 15f else 13f, 1.2f), FontWeight.SemiBold,
            if (passed) col.fg2 else col.fg, col.fg2, Modifier.clearAndSetSemantics {})
        if (hideBell) Spacer(Modifier.size(48.dp)) else BellV12(state, prayer, mode, col)
    }
}

private fun day(f: TodayFrame) = f.shown

/** A row that wraps its pieces onto a second line when they don't fit (the web's flex-wrap). */
@Composable
private fun FlowLine(content: @Composable androidx.compose.foundation.layout.FlowRowScope.() -> Unit) {
    @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
    androidx.compose.foundation.layout.FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.Center,
    ) { content() }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BellV12(state: AppState, prayer: Prayer, mode: AlertMode, col: PageColors) {
    val look = LocalLook.current
    val name = state.resolver.prayerName(prayer, Instant.now())
    val alarmColor = if (look.gold && !look.dark) Color(0xFFA87A12) else if (look.gold) Color(0xFFE2B65A) else col.accent
    Box(
        Modifier.size(48.dp).clip(CircleShape)
            .combinedClickable(
                interactionSource = remember { MutableInteractionSource() }, indication = null,
                onClickLabel = "Change to ${state.prefs.nextAlertMode(prayer).word}",
                onLongClickLabel = "Open $name in Alerts and alarms",
                onLongClick = { state.openAlerts(prayer.raw) },
                onClick = { state.cycleAlert(prayer) },
            )
            .semantics { contentDescription = "$name alert"; stateDescription = mode.word; role = Role.Button },
        contentAlignment = Alignment.Center,
    ) {
        when (mode) {
            AlertMode.OFF -> Icon(Lucide.bellOff(), null, Modifier.size(22.dp), tint = col.fg3.copy(alpha = col.fg3.alpha * 0.8f * 0.4f))
            AlertMode.NOTIFY -> Icon(AppIcons.line("bell-filled", "M10.268 21a2 2 0 0 0 3.464 0",
                "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
                width = 2f, fill = false), null, Modifier.size(22.dp), tint = col.fg3.copy(alpha = col.fg3.alpha * 0.8f))
            AlertMode.ALARM -> Icon(Lucide.alarmClock(), null, Modifier.size(22.dp), tint = alarmColor)
        }
    }
}

@Composable
private fun BlessedRowV12(state: AppState, blessed: BlessedTime, time: Instant, col: PageColors, rowHeight: Dp?) {
    val look = LocalLook.current
    val r = state.resolver
    val noBar = look.simple || look.gold
    val hair = col.hair
    val bar = col.fg.copy(alpha = 0.16f)
    Row(
        Modifier.fillMaxWidth().heightIn(min = rowHeight ?: if (look.simple) 62.dp else 54.dp)
            .drawBehind {
                drawLine(hair, Offset(0f, size.height - 0.5.dp.toPx()), Offset(size.width, size.height - 0.5.dp.toPx()), 1.dp.toPx())
                if (!noBar) drawRoundRect(bar, Offset(0f, 12.dp.toPx()), Size(4.dp.toPx(), size.height - 24.dp.toPx()), CornerRadius(2.dp.toPx()))
            }
            .padding(start = if (noBar) 18.dp else 28.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(blessed.name(r.naming), fontFamily = Body, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = col.fg2)
            Text(blessed.note, fontFamily = Body, fontSize = 12.sp, lineHeight = 15.sp, color = col.fg2.copy(alpha = col.fg2.alpha * 0.7f))
        }
        TimeV12(r.timeParts(time), cappedSp(if (look.simple) 21f else 20f, 1.4f), cappedSp(13f, 1.4f), FontWeight.Medium, col.fg2, col.fg2)
        Spacer(Modifier.width(30.dp))
    }
}

@Composable
private fun ShowMoreLink(state: AppState, col: PageColors, big: Boolean) {
    val more = state.prefs.showMore
    val label = if (more) tr(R.string.common_showLess) else tr(R.string.common_showMore)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClickLabel = label) { state.update { it.copy(showMore = !it.showMore) } }
            .semantics { stateDescription = if (more) "Expanded" else "Collapsed" },
        horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontFamily = Body, fontSize = if (big) 17.sp else 15.sp, fontWeight = FontWeight.SemiBold, color = col.accent)
        Icon(if (more) Lucide.chevronUp(2.2f) else Lucide.chevronDown(2.2f), null, Modifier.size(22.dp), tint = col.accent)
    }
}

/** Shown instead of five identical bells: every main prayer is on Notify. */
@Composable
private fun ColumnScope.AllFiveLine(state: AppState, col: PageColors) {
    if (!allFiveOn(state)) return
    Row(
        Modifier.align(Alignment.CenterHorizontally).heightIn(min = 48.dp).clip(RoundedCornerShape(12.dp)).clickable { state.openAlerts() }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(Lucide.bellRing(), null, Modifier.size(14.dp), tint = col.fg2)
        Text(tr(R.string.today_allFiveOn), fontFamily = Body, fontSize = 14.sp, color = col.fg2)
        Text(tr(R.string.today_allFiveChange), fontFamily = Body, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = col.accent)
    }
}

/** "Official · MUIS · Grade A": tap for the source. */
@Composable
private fun SourceLine(f: TodayFrame, col: PageColors, modifier: Modifier = Modifier, size: TextUnit = 15.sp, color: Color = col.fg3, onClick: () -> Unit) {
    val r = f.state.resolver
    val d = f.shown
    val authority = when (d.grade) {
        SourceGrade.OFFICIAL -> r.officialSource?.authority ?: r.method.shortName
        SourceGrade.MASJID, SourceGrade.COMMUNITY -> d.mosqueName
        else -> r.method.shortName
    }
    val text = androidx.compose.ui.text.buildAnnotatedString {
        pushStyle(androidx.compose.ui.text.SpanStyle(color = col.accent, fontWeight = FontWeight.Bold))
        append(d.grade.title)
        pop()
        if (authority != null) append(" · $authority")
        append(" · ${tr(R.string.source_grade)} ${d.grade.code}")
    }
    Box(modifier.heightIn(min = 48.dp).clip(RoundedCornerShape(10.dp)).clickable(onClick = onClick)
        .semantics { contentDescription = "Source: grade ${d.grade.code}, ${d.grade.title}, ${d.officialSource ?: r.method.shortName}" }
        .padding(horizontal = 6.dp), contentAlignment = Alignment.Center) {
        Text(text, fontFamily = Body, fontSize = size, color = color, textAlign = TextAlign.Center, maxLines = 2)
    }
}

/** A time with its AM or PM smaller beside it, on the same baseline, never wrapping. */
@Composable
internal fun TimeV12(parts: Pair<String, String?>, size: TextUnit, sfx: TextUnit, weight: FontWeight, color: Color, sfxColor: Color,
                     modifier: Modifier = Modifier, family: FontFamily = Rounded, gap: Dp = 3.dp, sfxWeight: FontWeight = FontWeight.SemiBold) {
    Row(modifier, verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(gap)) {
        Text(parts.first, fontFamily = family, fontSize = size, fontWeight = weight, color = color, maxLines = 1, softWrap = false,
            style = TextStyle(fontFeatureSettings = "tnum"), modifier = Modifier.alignByBaseline())
        parts.second?.let {
            Text(it, fontFamily = family, fontSize = sfx, fontWeight = sfxWeight, color = sfxColor, maxLines = 1, softWrap = false,
                modifier = Modifier.alignByBaseline())
        }
    }
}

// MARK: Colour Bands

/** The six band colours of the v10 and v12 mockups. */
private fun bandColor(p: Prayer): Color = when (p) {
    Prayer.FAJR -> Color(0xFF3A6F63)
    Prayer.SUNRISE -> Color(0xFF8A9A52)
    Prayer.DHUHR -> Color(0xFFAB8D3A)
    Prayer.ASR -> Color(0xFFCD7D38)
    Prayer.MAGHRIB -> Color(0xFFD3705C)
    Prayer.ISHA -> Color(0xFFC9565D)
}

@Composable
private fun BandsV12(f: TodayFrame, setOffset: (Int) -> Unit, openPlaces: () -> Unit, openCalendar: () -> Unit, openSanad: (PrayerDay) -> Unit) {
    val state = f.state
    val look = LocalLook.current
    val col = pageColors()
    val density = LocalDensity.current
    var topH by remember { mutableStateOf(0.dp) }
    var footH by remember { mutableStateOf(0.dp) }
    val blessed = state.resolver.blessedTimes(f.shown).filter { state.prefs.showMore || it.first == BlessedTime.IMSAK }
    val hideBells = allFiveOn(state)
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val bandsSpace = maxHeight - topH - footH - 48.dp - 52.dp * blessed.size
        val bandH = (bandsSpace / 6).coerceAtLeast(60.dp)
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Column(Modifier.onSizeChanged { topH = with(density) { it.height.toDp() } }.padding(horizontal = 20.dp).padding(top = 4.dp, bottom = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                TopBarV12(f, openPlaces)
                val lead = f.lead
                val next = f.next
                if (lead != null && next != null && f.offset == 0) {
                    val t = Countdown.of(state, f.now, next)
                    FlowRowBaseline {
                        Text(if (lead.isNext) f.name(lead.prayer, lead.time) else tr(R.string.today_nameNow, "name" to f.name(lead.prayer, lead.time)),
                            fontFamily = Rounded, fontSize = 34.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold, color = col.fg,
                            modifier = Modifier.alignByBaseline())
                        Text(t.text, fontFamily = Body, fontSize = 17.sp, color = col.fg2, style = TextStyle(fontFeatureSettings = "tnum"),
                            modifier = Modifier.alignByBaseline())
                    }
                }
                Prompts(f)
            }
            // One line date between two hairlines.
            val hair = col.hair
            val prevL = tr(R.string.today_prevDay)
            val nextL = tr(R.string.today_nextDay)
            val midL = if (f.offset == 0) tr(R.string.today_datesSources) else tr(R.string.today_backToToday)
            Row(
                Modifier.fillMaxWidth().drawBehind {
                    drawLine(hair, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx())
                    drawLine(hair, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
                }.padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(48.dp).clickable(onClickLabel = tr(R.string.today_prevDay)) { setOffset(f.offset - 1) }
                    .semantics { contentDescription = prevL }, contentAlignment = Alignment.Center) {
                    Icon(Lucide.chevronLeft(2.6f), null, Modifier.size(20.dp), tint = col.fg2)
                }
                Row(Modifier.weight(1f).clickable(onClickLabel = midL) { if (f.offset == 0) openCalendar() else setOffset(0) }
                    .heightIn(min = 48.dp).padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                    if (f.offset != 0) Icon(Lucide.undo2(), null, Modifier.size(13.dp), tint = col.fg)
                    Text("${dateText(state, f.shown, "d MMM")} · ${state.resolver.hijri(f.shown.time(Prayer.DHUHR))}", fontFamily = Body, fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold, color = col.fg, textAlign = TextAlign.Center, maxLines = 2)
                }
                Box(Modifier.size(48.dp).clickable(onClickLabel = tr(R.string.today_nextDay)) { setOffset(f.offset + 1) }
                    .semantics { contentDescription = nextL }, contentAlignment = Alignment.Center) {
                    Icon(Lucide.chevronRight(2.6f), null, Modifier.size(20.dp), tint = col.fg2)
                }
            }
            Column(Modifier.fillMaxWidth().daySwipe(f.offset, setOffset)) {
                val current = f.currentPrayer
                Prayer.all.forEach { p ->
                    val t = f.shown.time(p)
                    val next = f.next
                    BandV12(state, p, t, f.now, f.isToday && p == current,
                        if (f.isToday && next != null && next.first == p && next.second == t) next else null, bandH, hideBells && p.isObligatory)
                }
                blessed.forEach { (b, t) -> BlessedBandV12(state, b, t, f.now) }
            }
            Column(Modifier.onSizeChanged { footH = with(density) { it.height.toDp() } }.padding(horizontal = 20.dp).padding(top = 4.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    SourceLine(f, col, size = 13.sp, color = col.fg2) { openSanad(f.shown) }
                    Spacer(Modifier.weight(1f))
                    val more = state.prefs.showMore
                    Row(Modifier.heightIn(min = 48.dp).clickable { state.update { it.copy(showMore = !it.showMore) } }.padding(horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(if (more) tr(R.string.common_showLess) else tr(R.string.common_showMore), fontFamily = Body, fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold, color = col.accent)
                        Icon(if (more) Lucide.chevronUp(2.2f) else Lucide.chevronDown(2.2f), null, Modifier.size(22.dp), tint = col.accent)
                    }
                }
                Makers(f)
                AllFiveLine(state, col)
                Text(tr(R.string.bands_credit), fontFamily = Body, fontSize = 12.sp, lineHeight = 16.sp, color = col.fg2, modifier = Modifier.padding(bottom = 8.dp))
            }
        }
    }
}

@Composable
private fun FlowRowBaseline(content: @Composable androidx.compose.foundation.layout.FlowRowScope.() -> Unit) {
    @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
    androidx.compose.foundation.layout.FlowRow(
        horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp),
    ) { content() }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BandV12(
    state: AppState, prayer: Prayer, time: Instant, now: Instant, isCurrent: Boolean, next: Pair<Prayer, Instant>?, height: Dp, hideBell: Boolean,
) {
    val r = state.resolver
    val p = state.prefs
    val mode = p.alertMode(prayer)
    val trackable = p.trackerEnabled && prayer.isObligatory && time <= now
    val prayed = trackable && r.isPrayed(prayer, time)
    val parts = r.timeParts(time)
    val name = r.prayerName(prayer, time)
    Row(
        Modifier.fillMaxWidth().heightIn(min = height).background(bandColor(prayer))
            .combinedClickable(
                onClickLabel = if (trackable) (if (prayed) "Mark as not prayed" else "Mark as prayed") else if (hideBell) "Open Alerts and alarms" else "Change to ${p.nextAlertMode(prayer).word}",
                onLongClickLabel = "Open $name in Alerts and alarms",
                onLongClick = { state.openAlerts(prayer.raw) },
                onClick = { if (trackable) state.togglePrayed(prayer, time) else if (hideBell) state.openAlerts() else state.cycleAlert(prayer) },
            )
            .semantics(mergeDescendants = true) {
                contentDescription = "$name, ${r.formatted(time)}${if (isCurrent) ", now" else ""}${if (prayed) ", prayed" else ""}, ${mode.word}"
            }
            .padding(start = 24.dp, end = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Column(Modifier.weight(1f).clearAndSetSemantics {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            FlowLine {
                Text(name, fontFamily = Body, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1, modifier = Modifier.align(Alignment.CenterVertically))
                r.localName(prayer, time)?.let { Text(it, fontFamily = Body, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.8f), modifier = Modifier.align(Alignment.CenterVertically)) }
                if (isCurrent) Text(tr(R.string.today_now), fontFamily = Body, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF1D1D20),
                    modifier = Modifier.align(Alignment.CenterVertically).clip(CircleShape).background(Color.White).padding(horizontal = 7.dp, vertical = 3.dp))
                if (prayed) Box(Modifier.align(Alignment.CenterVertically).size(18.dp).background(Color.White, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Lucide.check(3.4f), null, Modifier.size(11.dp), tint = Color(0xFF222222))
                }
                if (next != null) Text(tr(R.string.today_inTime, "time" to TimeFormat.short(next.second.secondsSince(now))), fontFamily = Body,
                    fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.9f), maxLines = 1,
                    style = TextStyle(fontFeatureSettings = "tnum"), modifier = Modifier.align(Alignment.CenterVertically))
            }
            val j = state.resolver.day(now)?.jamaah?.get(prayer)
            if (isCurrent && j != null && time <= now && now < j) {
                Text(tr(R.string.today_jamaahIn, "time" to TimeFormat.short(j.secondsSince(now))), fontFamily = Body, fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.85f))
            }
        }
        TimeV12(parts, 32.sp, 15.sp, FontWeight.Medium, Color.White, Color.White.copy(alpha = 0.9f), gap = 5.dp)
        Box(Modifier.padding(start = 10.dp).size(22.dp).clearAndSetSemantics {}) {
            if (!hideBell) Icon(
                when (mode) { AlertMode.ALARM -> Lucide.alarmClock(); AlertMode.NOTIFY -> Lucide.bellRing(); AlertMode.OFF -> Lucide.bellOff() },
                null, Modifier.size(22.dp), tint = Color.White.copy(alpha = if (mode == AlertMode.OFF) 0.55f else 1f),
            )
        }
    }
}

@Composable
private fun BlessedBandV12(state: AppState, blessed: BlessedTime, time: Instant, now: Instant) {
    val look = LocalLook.current
    val r = state.resolver
    val parts = r.timeParts(time)
    val bg = if (look.dark) Color(77, 77, 77) else Color(224, 219, 207)
    val fg = if (look.dark) Color.White else Color(0xFF17171C)
    val icon = when (blessed) {
        BlessedTime.IMSAK -> Lucide.utensils(); BlessedTime.DHUHA -> Lucide.sun(2f)
        BlessedTime.MIDNIGHT -> Lucide.cloudMoon(); BlessedTime.LAST_THIRD -> Lucide.sparkles()
    }
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).background(bg).padding(horizontal = 20.dp, vertical = 6.dp)
            .then(Modifier),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val a = if (time <= now) 0.7f else 1f
        Icon(icon, null, Modifier.size(17.dp), tint = fg.copy(alpha = 0.8f * a))
        Column(Modifier.weight(1f)) {
            Text(blessed.name(r.naming), fontFamily = Body, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = fg.copy(alpha = a), maxLines = 1)
            Text(blessed.note, fontFamily = Body, fontSize = 12.sp, color = fg.copy(alpha = 0.7f * a), maxLines = 2)
        }
        TimeV12(parts, 22.sp, 13.sp, FontWeight.Medium, fg.copy(alpha = a), fg.copy(alpha = 0.9f * a))
        Spacer(Modifier.width(30.dp))
    }
}
