package com.prayertimesasia.app.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Stars
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Brightness2
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material.icons.outlined.NotificationsOff
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.components.TimeText
import com.prayertimesasia.app.ui.components.quietClick
import com.prayertimesasia.app.ui.theme.BandsPalette
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Rounded
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.theme.display
import com.prayertimesasia.app.ui.theme.tint
import com.prayertimesasia.core.BlessedTime
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.PrayerDay
import com.prayertimesasia.core.SourceGrade
import com.prayertimesasia.core.TimeFormat
import com.prayertimesasia.core.secondsSince
import java.time.Instant

/** "Jamaah 1:20 PM", with a countdown between the azan and the iqamah. */
internal fun jamaahLine(r: com.prayertimesasia.core.Resolver, day: PrayerDay, prayer: Prayer, jamaah: Instant, now: Instant): String {
    val text = "Jamaah ${r.formatted(jamaah)}"
    return if (day.time(prayer) <= now && now < jamaah) "$text · in ${TimeFormat.short(jamaah.secondsSince(now))}" else text
}

val BlessedTime.icon: ImageVector
    get() = when (this) {
        BlessedTime.IMSAK -> Icons.Filled.Restaurant
        BlessedTime.DHUHA -> Icons.Filled.WbSunny
        BlessedTime.MIDNIGHT -> Icons.Filled.Brightness2
        BlessedTime.LAST_THIRD -> Icons.Filled.Stars
    }

/** One entry in the day: a prayer or a blessed time, in time order. */
sealed class Entry(val time: Instant) {
    class P(val prayer: Prayer, time: Instant) : Entry(time)
    class B(val blessed: BlessedTime, time: Instant) : Entry(time)
}

fun entries(state: AppState, day: PrayerDay, showMore: Boolean): List<Entry> {
    val list = mutableListOf<Entry>()
    Prayer.all.forEach { list += Entry.P(it, day.time(it)) }
    if (showMore) state.resolver.blessedTimes(day).forEach { list += Entry.B(it.first, it.second) }
    return list.sortedBy { it.time }
}

/**
 * The times in a frosted card. With [rowHeight] the rows stretch to fill the
 * screen (when everything fits); without, they take their natural height and the page scrolls.
 */
@Composable
fun PrayerList(
    state: AppState, day: PrayerDay, now: Instant,
    current: Prayer?, next: Pair<Prayer, Instant>?, showMore: Boolean,
    rowHeight: Dp? = null, modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Dims.corner)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Palette.material, shape)
            .border(1.dp, Palette.primary.copy(alpha = 0.08f), shape)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (e in entries(state, day, showMore)) {
            when (e) {
                is Entry.P -> PrayerRow(state, day, e.prayer, e.time, now, current, next, rowHeight)
                is Entry.B -> BlessedRow(state, e.blessed, e.time, now, rowHeight?.let { it * 0.8f })
            }
        }
    }
}

@Composable
private fun PrayerRow(
    state: AppState, day: PrayerDay, prayer: Prayer, time: Instant, now: Instant,
    current: Prayer?, next: Pair<Prayer, Instant>?, rowHeight: Dp?,
) {
    val r = state.resolver
    val p = state.prefs
    val isCurrent = prayer == current && time <= now
    val isNext = next != null && prayer == next.first && next.second == time
    val passed = time <= now && !isCurrent
    val notifying = p.notificationsEnabled && prayer in p.notifyPrayers
    val trackable = p.trackerEnabled && prayer.isObligatory && time <= now
    val prayed = trackable && r.isPrayed(prayer, time)
    val rowShape = RoundedCornerShape(16.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .then(if (rowHeight != null) Modifier.height(rowHeight) else Modifier)
            .alpha(if (passed && !prayed) 0.55f else 1f)
            // The prayer's colour as a thin bar at the left edge.
            .leftBar(prayer.tint.copy(alpha = if (isCurrent) 1f else 0.55f), 3.dp, 14.dp)
            .then(
                if (isCurrent) Modifier.clip(rowShape).background(prayer.tint.copy(alpha = 0.16f), rowShape)
                    .border(1.dp, prayer.tint.copy(alpha = 0.45f), rowShape) else Modifier,
            )
            .quietClick { if (trackable) state.togglePrayed(prayer, time) },
    ) {
        Row(
            Modifier.fillMaxWidth().align(Alignment.Center)
                .padding(start = 14.dp, end = 6.dp, top = if (rowHeight != null) 8.dp else 12.dp, bottom = if (rowHeight != null) 8.dp else 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(r.prayerName(prayer, time), style = Txt.title3, color = Palette.primary, maxLines = 1,
                        modifier = Modifier.alignByBaseline())
                    r.localName(prayer, time)?.let {
                        Text(it, style = Txt.caption.copy(fontWeight = FontWeight.Medium), color = Palette.secondary, maxLines = 1,
                            modifier = Modifier.alignByBaseline())
                    }
                    if (prayed) Icon(Icons.Filled.CheckCircle, "Prayed", Modifier.size(16.dp), tint = Palette.success)
                }
                if (isCurrent) {
                    Text("NOW", style = Txt.caption2Heavy, color = prayer.tint)
                } else if (isNext && next != null) {
                    Text("in ${TimeFormat.short(next.second.secondsSince(now))}", style = Txt.captionSemibold.copy(fontFeatureSettings = "tnum"),
                        color = prayer.tint)
                }
                day.jamaah[prayer]?.let {
                    Text(jamaahLine(r, day, prayer, it, now), style = Txt.caption.copy(fontWeight = FontWeight.Medium), color = Palette.primary.copy(alpha = 0.75f))
                }
                val other = day.alternate[prayer]
                val name = day.alternateSource
                if (other != null && name != null) {
                    Text("$name ${r.formatted(other)}", style = Txt.caption.copy(fontWeight = FontWeight.Medium), color = SourceGrade.MASJID.tint)
                }
            }
            TimeText(r.timeParts(time), size = 27.sp)
            Box(Modifier.size(30.dp, 34.dp).clip(CircleShape).quietClick { state.toggleNotify(prayer) }, contentAlignment = Alignment.Center) {
                Icon(
                    if (notifying) Icons.Filled.Notifications else Icons.Outlined.NotificationsOff,
                    if (notifying) "Turn off alert" else "Turn on alert",
                    Modifier.size(18.dp), tint = Palette.primary.copy(alpha = if (notifying) 0.95f else 0.4f),
                )
            }
        }
    }
}

@Composable
private fun BlessedRow(state: AppState, blessed: BlessedTime, time: Instant, now: Instant, rowHeight: Dp?) {
    val r = state.resolver
    Box(
        Modifier.fillMaxWidth().then(if (rowHeight != null) Modifier.heightIn(min = rowHeight) else Modifier)
            .alpha(if (time <= now) 0.55f else 0.9f)
            .leftBar(blessed.tint.copy(alpha = 0.35f), 2.dp, 12.dp),
    ) {
        Row(
            Modifier.fillMaxWidth().align(Alignment.Center).padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(blessed.name(r.naming), style = Txt.bodySemibold, color = Palette.primary, maxLines = 1)
                Text(blessed.note, style = Txt.caption, color = Palette.primary.copy(alpha = 0.7f), maxLines = 2)
            }
            TimeText(r.timeParts(time), size = 22.sp, weight = FontWeight.Medium)
            Spacer(Modifier.width(30.dp))
        }
    }
}

/** A slim rounded bar just outside the left edge, inset [inset] top and bottom. */
fun Modifier.leftBar(color: Color, width: Dp, inset: Dp): Modifier = drawBehind {
    val w = width.toPx()
    val h = size.height - 2 * inset.toPx()
    if (h > 0) {
        drawRoundRect(color, topLeft = Offset(-5.dp.toPx() - w / 2, inset.toPx()), size = Size(w, h), cornerRadius = CornerRadius(w / 2, w / 2))
    }
}

// MARK: Colour Bands

/** One prayer as a full-width band. Tap for its alert and, with the tracker on, to tick it off. */
@Composable
fun ColumnScope.PrayerBand(
    state: AppState, prayer: Prayer, time: Instant, now: Instant,
    isCurrent: Boolean, next: Pair<Prayer, Instant>?, fill: Boolean,
) {
    val r = state.resolver
    val p = state.prefs
    val notifying = p.notificationsEnabled && prayer in p.notifyPrayers
    val trackable = p.trackerEnabled && prayer.isObligatory && time <= now
    val prayed = trackable && r.isPrayed(prayer, time)
    val parts = r.timeParts(time)
    var menu by remember { mutableStateOf(false) }
    Box(
        Modifier.fillMaxWidth()
            .then(if (fill) Modifier.weight(1f).heightIn(min = 64.dp) else Modifier.height(64.dp))
            .background(BandsPalette.color(prayer))
            .quietClick { menu = true },
    ) {
        if (isCurrent) Box(Modifier.align(Alignment.CenterStart).width(5.dp).fillMaxHeight().background(Color.White))
        Row(
            Modifier.fillMaxWidth().align(Alignment.Center).padding(horizontal = Dims.gutter),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(r.prayerName(prayer, time), fontFamily = Rounded, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1)
                    r.localName(prayer, time)?.let { Text(it, style = Txt.captionSemibold, color = Color.White.copy(alpha = 0.8f)) }
                    if (isCurrent) {
                        Text("NOW", fontFamily = Rounded, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color.White,
                            modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.25f)).padding(horizontal = 7.dp, vertical = 2.dp))
                    }
                    if (prayed) Icon(Icons.Filled.CheckCircle, "Prayed", Modifier.size(16.dp), tint = Color.White)
                }
                if (next != null) {
                    Text("in ${TimeFormat.short(next.second.secondsSince(now))}", style = Txt.captionSemibold.copy(fontFeatureSettings = "tnum"),
                        color = Color.White.copy(alpha = 0.85f))
                }
            }
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(parts.first, style = display(34.sp, FontWeight.Light), color = Color.White, maxLines = 1, softWrap = false,
                    modifier = Modifier.alignByBaseline())
                parts.second?.let {
                    Text(it, style = display(22.sp, FontWeight.Light), color = Color.White, modifier = Modifier.alignByBaseline())
                }
            }
            if (p.notificationsEnabled && !notifying && prayer.isObligatory) {
                Icon(Icons.Outlined.NotificationsOff, "Alert off", Modifier.size(14.dp), tint = Color.White.copy(alpha = 0.6f))
            }
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            DropdownMenuItem(
                text = { Text(if (notifying) "Turn off alert" else "Alert me at ${prayer.name(r.naming)}") },
                onClick = { menu = false; state.toggleNotify(prayer) },
            )
            if (trackable) {
                DropdownMenuItem(
                    text = { Text(if (prayed) "Mark as not prayed" else "Mark as prayed") },
                    onClick = { menu = false; state.togglePrayed(prayer, time) },
                )
            }
        }
    }
}

/** A blessed time under Show more: a thinner, quiet grey band. */
@Composable
fun BlessedBand(state: AppState, blessed: BlessedTime, time: Instant, now: Instant) {
    val r = state.resolver
    val parts = r.timeParts(time)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).background(BandsPalette.blessed).alpha(if (time <= now) 0.7f else 1f)
            .padding(horizontal = Dims.gutter),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(blessed.icon, null, Modifier.size(16.dp), tint = Color.White.copy(alpha = 0.8f))
        Column(Modifier.weight(1f)) {
            Text(blessed.name(r.naming), style = Txt.headline, color = Color.White, maxLines = 1)
            Text(blessed.note, style = Txt.caption, color = Color.White.copy(alpha = 0.7f), maxLines = 1)
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(parts.first, style = display(24.sp, FontWeight.Light), color = Color.White, modifier = Modifier.alignByBaseline())
            parts.second?.let { Text(it, style = display(15.sp, FontWeight.Light), color = Color.White, modifier = Modifier.alignByBaseline()) }
        }
    }
}
