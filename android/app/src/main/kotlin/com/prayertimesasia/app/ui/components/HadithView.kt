package com.prayertimesasia.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.Hadith
import com.prayertimesasia.core.HadithId
import com.prayertimesasia.core.RamadanContent
import kotlinx.coroutines.delay

/**
 * A short hadith or ayah, as a card or a softer line (core HadithContent.kt).
 * Hidden when Settings, Hadith is off or the person closed this one with its X.
 * Right after closing, a small "Hidden" note with Undo stays for a few seconds.
 */
@Composable
fun HadithView(state: AppState, id: HadithId, modifier: Modifier = Modifier, tag: String? = null, line: Boolean = false) {
    val p = state.prefs
    var justHidden by remember(id) { mutableStateOf(false) }
    LaunchedEffect(justHidden) { if (justHidden) { delay(6000); justHidden = false } }
    if (!p.showHadith) return
    if (id.key in p.hiddenHadith) {
        AnimatedVisibility(justHidden, modifier) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(16.dp))
                    .background(Palette.primary.copy(alpha = 0.08f)).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Hadith hidden here. Bring them all back in Settings, Hadith.", style = Txt.subheadline, color = Palette.primary,
                    modifier = Modifier.weight(1f))
                Text("Undo", style = Txt.subheadline.copy(fontWeight = FontWeight.Bold), color = Palette.accentText,
                    modifier = Modifier.clickable {
                        state.update { it.copy(hiddenHadith = it.hiddenHadith - id.key) }
                        justHidden = false
                    }.padding(4.dp))
            }
        }
        return
    }
    val h = Hadith.of(id)
    val lang = RamadanContent.lang(state.resolver.naming)
    val close = {
        state.update { if (id.key in it.hiddenHadith) it else it.copy(hiddenHadith = it.hiddenHadith + id.key) }
        justHidden = true
    }
    val closeButton = @Composable {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(Palette.primary.copy(alpha = 0.12f)).clickable { close() }
                .semantics { contentDescription = "Hide this hadith" },
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.Filled.Close, null, Modifier.size(15.dp), tint = Palette.primary) }
    }
    val words = @Composable {
        Text(h.arabic, style = Txt.title3.copy(textDirection = TextDirection.Rtl, fontSize = if (line) 19.sp else 22.sp, lineHeight = if (line) 34.sp else 40.sp),
            color = Palette.primary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth().padding(start = if (line) 30.dp else 0.dp))
        Text("“${h.meaning(lang)}”", style = if (line) Txt.subheadline else Txt.body.copy(fontStyle = FontStyle.Italic), color = Palette.primary)
        Text(h.source(lang), style = Txt.caption, color = Palette.secondary)
    }
    if (line) {
        Box(modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Palette.primary.copy(alpha = 0.06f)).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) { words() }
            Box(Modifier.padding(8.dp)) { closeButton() }
        }
    } else {
        GlassCard(modifier.fillMaxWidth().padding(vertical = 6.dp), padding = 18.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text((tag ?: "Hadith").uppercase(), style = Txt.caption2Heavy.copy(letterSpacing = 1.2.sp), color = Palette.accentText)
                Spacer(Modifier.weight(1f))
                closeButton()
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { words() }
        }
    }
}
