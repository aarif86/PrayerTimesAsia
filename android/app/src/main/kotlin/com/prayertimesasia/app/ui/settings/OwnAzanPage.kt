package com.prayertimesasia.app.ui.settings

import android.media.AudioAttributes
import android.media.MediaPlayer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.prayertimesasia.app.AppState
import com.prayertimesasia.app.alarms.OwnAzan
import com.prayertimesasia.app.ui.theme.Palette
import com.prayertimesasia.app.ui.theme.Txt
import com.prayertimesasia.core.AudioClip
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

/**
 * Settings, Your own azan: pick an audio file on this phone and prayer time alerts
 * play it. Same page as iOS OwnAzanView.swift. The file never leaves the phone.
 */
@Composable
fun ColumnScope.OwnAzanPage(state: AppState) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isSet by remember { mutableStateOf(OwnAzan.isSet(context)) }
    var busy by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<String?>(null) }
    var player by remember { mutableStateOf<MediaPlayer?>(null) }

    fun stop() { player?.let { mp -> runCatching { mp.stop() }; mp.release() }; player = null }
    DisposableEffect(Unit) { onDispose { stop() } }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        stop()
        busy = true
        note = null
        scope.launch {
            val result = withContext(Dispatchers.IO) { OwnAzan.import(context, uri) }
            busy = false
            note = when (result) {
                is OwnAzan.Result.Saved -> {
                    // Picking a file means they want to hear it.
                    state.update { it.copy(azanSound = true) }
                    state.rescheduleAlerts()
                    if (result.wasCut) "Saved. Your phone plays the first ${secs(result.seconds)} seconds, with a soft fade at the end."
                    else "Saved. It is ${secs(result.seconds)} seconds long."
                }
                OwnAzan.Result.NoSound -> "That file has no sound we could use. Try another one."
                OwnAzan.Result.Unreadable -> "This phone could not open that file. Try an MP3, M4A or WAV."
            }
            isSet = OwnAzan.isSet(context)
        }
    }

    Section(null, "Pick an azan recording saved on this phone. We use the start of it, up to ${AudioClip.MAX_SECONDS.toInt()} seconds, " +
        "with a soft fade at the end, and even out the volume. The file stays on this phone. We never upload it or share it.") {
        if (isSet) {
            ValueRow("Your azan", OwnAzan.sourceName(context) ?: "Chosen file")
            ValueRow("Length", "${secs(OwnAzan.seconds(context))} seconds")
        }
        LinkRow(when {
            busy -> "Preparing your azan…"
            isSet -> "Choose a different file"
            else -> "Choose an audio file"
        }, Icons.Filled.FolderOpen) { if (!busy) pick.launch(arrayOf("audio/*")) }
        if (isSet) {
            LinkRow(if (player != null) "Stop" else "Play", if (player != null) Icons.Filled.Stop else Icons.Filled.PlayArrow) {
                if (player != null) stop() else OwnAzan.uri(context)?.let { uri ->
                    val mp = MediaPlayer()
                    runCatching {
                        mp.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                        mp.setDataSource(context, uri)
                        mp.setOnCompletionListener { stop() }
                        mp.prepare()
                        mp.start()
                    }.onSuccess { player = mp }.onFailure { mp.release() }
                }
            }
            LinkRow("Go back to the app's azan", Icons.Filled.Delete) {
                stop()
                OwnAzan.remove(context)
                isSet = false
                note = "Removed. Alerts use the app's azan again."
                state.rescheduleAlerts()
            }
        }
    }
    note?.let {
        Text(it, style = Txt.footnote, color = Palette.primary, modifier = Modifier.padding(start = 32.dp, end = 32.dp, top = 12.dp))
    }
    Text("Only use a recording you have the right to use, such as one you or your masjid recorded. " +
        "It plays for every prayer, Fajr too, when \"Play the azan\" is on in Alerts and alarms.",
        style = Txt.footnote, color = Palette.secondary, modifier = Modifier.padding(start = 32.dp, end = 32.dp, top = 12.dp))
}

private fun secs(s: Double): String = String.format(Locale.ROOT, "%.0f", s)
