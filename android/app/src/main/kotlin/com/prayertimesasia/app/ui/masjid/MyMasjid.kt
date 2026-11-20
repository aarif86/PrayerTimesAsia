package com.prayertimesasia.app.ui.masjid

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Brightness2
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.components.CapsuleButton
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.app.ui.today.SectionHeader
import com.prayertimesasia.core.MasjidLink
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.app.ui.components.tr
import com.prayertimesasia.app.R

/** "13:15" as the user reads times: 1:15 PM, or 13:15. */
private fun clock(hhmm: String, h24: Boolean): String {
    if (h24) return hhmm
    val (h, m) = hhmm.split(':').map { it.toInt() }
    return "${(h + 11) % 12 + 1}:${m.toString().padStart(2, '0')} ${if (h < 12) "AM" else "PM"}"
}

private fun rules(state: AppState, m: MasjidLink): List<Pair<String, String>> {
    val h24 = state.prefs.use24Hour
    val naming = state.resolver.naming
    val rows = Prayer.obligatory.mapNotNull { p ->
        val r = m.jamaah[p.raw] ?: return@mapNotNull null
        p.name(naming) to (r.fixed?.let { clock(it, h24) } ?: if (r.after == 0) "At the azan" else "${r.after} min after azan")
    }.toMutableList()
    m.jumuah?.let { rows += "Jumu'ah" to clock(it, h24) }
    return rows
}

/** Opened from a masjid screen's QR code: ask before making it "your masjid". */
@Composable
fun MasjidLinkSheetContent(state: AppState, link: MasjidLink) {
    Column(Modifier.fillMaxWidth().padding(horizontal = Dims.gutter).navigationBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Filled.Brightness2, null, Modifier.size(30.dp), tint = Palette.accent)
        Spacer(Modifier.height(6.dp))
        Text(link.name, style = Txt.headline, color = Palette.primary, textAlign = TextAlign.Center)
        Text(tr(R.string.myMasjid_addExplain),
            style = Txt.subheadline, color = Palette.secondary, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
        Column(Modifier.fillMaxWidth()) {
            SectionHeader("Iqamah")
            val rows = rules(state, link)
            if (rows.isEmpty()) Text(tr(R.string.myMasjid_noTimes), style = Txt.body, color = Palette.secondary)
            rows.forEach { (label, value) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Text(label, style = Txt.body, color = Palette.primary, modifier = Modifier.weight(1f))
                    Text(value, style = Txt.body, color = Palette.secondary)
                }
            }
            state.prefs.myMasjid?.takeIf { it.name != link.name }?.let {
                Text("This replaces ${it.name}.", style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(top = 6.dp))
            }
        }
        Row(Modifier.padding(vertical = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CapsuleButton("Add my masjid", style = Txt.subheadlineSemibold, background = Palette.accent,
                contentColor = Color.Black.copy(alpha = 0.82f)) { state.followPendingMasjid() }
            CapsuleButton("Not now", style = Txt.subheadlineSemibold) { state.pendingMasjid = null }
        }
    }
}
