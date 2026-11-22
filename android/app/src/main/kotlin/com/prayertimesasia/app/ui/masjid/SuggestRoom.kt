package com.prayertimesasia.app.ui.masjid

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.app.ui.components.Dims
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Reviews
import com.prayertimesasia.core.RoomSuggestion

/**
 * "Suggest a prayer room": opens the person's own email app with what they typed.
 * [near] is the area the Masjid tab shows. [live] is a fresh fix from Near me, so
 * the person may add it as the room's pin when they are standing there.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SuggestRoomContent(near: Coordinates?, live: Coordinates?) {
    val context = LocalContext.current
    var name by remember { mutableStateOf("") }
    var level by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var directions by remember { mutableStateOf("") }
    var remarks by remember { mutableStateOf("") }
    var has by remember { mutableStateOf(emptySet<RoomSuggestion.Has>()) }
    var usePin by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    val pin = if (usePin) live else null
    val mail = RoomSuggestion.email(name, level, address, directions, remarks, has, pin, near, "Version ${BuildConfig.VERSION_NAME}, Android")
    val ready = RoomSuggestion.ready(name, address, pin)

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Dims.gutter), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Suggest a prayer room", style = Txt.headline, color = Palette.primary)
        Text("Know a musollah or prayer room that is not on our map? Tell us about it. We check every one and then add it for everyone.",
            style = Txt.subheadline, color = Palette.primary)
        Field("Place name", name, "For example Pasir Ris Mall") { name = it; copied = false }
        Field("Floor or level", level, "For example Level 3 or B1") { level = it; copied = false }
        Field("Address", address, null) { address = it; copied = false }
        Field("How to find it", directions, "For example next to the toilets near the car park lift", lines = 3) { directions = it; copied = false }

        Text("Where it is on the map", style = Txt.subheadlineSemibold, color = Palette.primary)
        if (live != null) {
            Chip(if (usePin) "Pin added where you are" else "I am at the prayer room now", usePin) { usePin = !usePin; copied = false }
            Text("Only if you are standing at the room. Your location is added to this email once and is not kept anywhere else.",
                style = Txt.footnote, color = Palette.secondary)
        } else {
            Text("Standing at the room? Close this, tap Near me, then come back to add a pin. Otherwise an address is enough.",
                style = Txt.footnote, color = Palette.secondary)
        }

        Text("What is there", style = Txt.subheadlineSemibold, color = Palette.primary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            RoomSuggestion.Has.entries.forEach { h ->
                Chip(h.label, h in has) { has = if (h in has) has - h else has + h; copied = false }
            }
        }
        Field("Anything else", remarks, "Opening hours, or who may use it", lines = 3) { remarks = it; copied = false }

        Box(Modifier.fillMaxWidth().clip(CircleShape).background(if (ready) Palette.sunArc else Palette.sunArc.copy(alpha = 0.4f)).clickable(enabled = ready) {
            val uri = Reviews.noteUrl("Suggest a prayer room", mail.second, name)
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
            Text("Send your suggestion", style = Txt.bodySemibold, color = Color.Black.copy(alpha = 0.85f))
        }
        if (!ready) Text("Add the place name and either the address or a pin.", style = Txt.footnote, color = Palette.secondary)
        else Box(Modifier.fillMaxWidth().clip(CircleShape).background(Palette.primary.copy(alpha = 0.08f)).clickable {
            context.copyText("To ${Reviews.FEEDBACK_EMAIL}\n${mail.first}\n\n${mail.second}"); copied = true
        }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
            Text(if (copied) "Copied" else "No email app? Copy the note", style = Txt.subheadlineSemibold, color = Palette.primary)
        }
        Text("It opens our note page with your words filled in. Add your email there so we can thank you. JazakAllahu khairan for helping others find a place to pray.",
            style = Txt.footnote, color = Palette.secondary)
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Field(label: String, value: String, hint: String?, lines: Int = 1, onChange: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = Txt.subheadlineSemibold, color = Palette.primary)
        OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), singleLine = lines == 1, minLines = lines,
            placeholder = hint?.let { { Text(it) } })
    }
}

@Composable
private fun Chip(label: String, on: Boolean, onClick: () -> Unit) {
    Text(label, style = Txt.subheadlineSemibold, color = if (on) Color.Black.copy(alpha = 0.85f) else Palette.primary,
        modifier = Modifier.clip(CircleShape).background(if (on) Palette.sunArc else Palette.primary.copy(alpha = 0.06f))
            .border(1.dp, if (on) Palette.sunArc else Palette.primary.copy(alpha = 0.15f), CircleShape)
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp))
}

private fun Context.copyText(text: String) {
    (getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager)?.setPrimaryClip(ClipData.newPlainText("Prayer room", text))
}
