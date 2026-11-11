package com.prayertimesasia.app.ui

import android.content.Context
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import com.prayertimesasia.app.BuildConfig
import com.prayertimesasia.app.data.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Test builds shared by link (before Google Play) can't update themselves, so on opening
 * the app asks the download page for the newest build number and offers the new one.
 * Only builds made by CI carry a number; Play and local builds have 0 and never ask.
 */
object TestUpdate {
    private const val BASE = "https://github.com/aarif86/PrayerTimesAsia/releases/download/android-test/"
    const val APK_URL = BASE + "prayer-times-asia.apk"
    private const val LATEST_URL = BASE + "latest.json"
    private const val PREFS = "test-update"
    private const val CHECK_EVERY_MS = 6 * 60 * 60 * 1000L

    val enabled: Boolean get() = BuildConfig.TEST_BUILD > 0

    /** The newer build to offer, or null: nothing newer, already declined, checked recently, or offline. */
    fun newerBuild(context: Context, nowMs: Long = System.currentTimeMillis()): Int? {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (nowMs - sp.getLong("checkedAt", 0) < CHECK_EVERY_MS) return null
        val latest = runCatching {
            Json.parseToJsonElement(Http.get(LATEST_URL, 15_000)).jsonObject["build"]!!.jsonPrimitive.int
        }.getOrNull() ?: return null
        sp.edit().putLong("checkedAt", nowMs).apply()
        return latest.takeIf { it > BuildConfig.TEST_BUILD && it != sp.getInt("declined", 0) }
    }

    fun decline(context: Context, build: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("declined", build).apply()
    }
}

@Composable
fun TestUpdatePrompt() {
    if (!TestUpdate.enabled) return
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    var offer by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(Unit) {
        offer = withContext(Dispatchers.IO) { TestUpdate.newerBuild(context.applicationContext) }
    }
    val build = offer ?: return
    AlertDialog(
        onDismissRequest = { offer = null },
        title = { Text("New version available") },
        text = { Text("A newer test version of Prayer Times Asia is ready. Tap Update to download it, then open the file and tap Install. Your settings stay as they are.") },
        confirmButton = { TextButton({ offer = null; runCatching { uri.openUri(TestUpdate.APK_URL) } }) { Text("Update") } },
        dismissButton = { TextButton({ TestUpdate.decline(context, build); offer = null }) { Text("Not now") } },
    )
}
