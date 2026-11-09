package com.prayertimesasia.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.prayertimesasia.app.ui.theme.OpeningScreen
import com.prayertimesasia.core.OpeningMove
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import com.prayertimesasia.app.ui.PrayerTimesRoot
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity(), Permissions {
    private lateinit var state: AppState
    private var pending: CompletableDeferred<Boolean>? = null

    private val single = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        pending?.complete(granted)
        pending = null
    }
    private val multiple = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        pending?.complete(result.values.any { it })
        pending = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as PrayerApp
        val demo = DemoConfig.from(intent)
        state = if (demo != null) app.demoState(demo) else app.state
        state.permissions = this
        if (savedInstanceState == null) state.openLink(intent?.dataString)
        if (savedInstanceState == null && demo == null) welcomeBackIfRestored()
        // The moving opening screen plays over the plain navy system splash, then fades.
        // Always the first time after install, then as Settings > Opening screen says.
        // Not on a rotation or for the demo screenshots.
        val install = getSharedPreferences(INSTALL_PREFS, MODE_PRIVATE)
        val showOpening = savedInstanceState == null && demo == null &&
            (state.prefs.showOpening || !install.getBoolean("openingSeen", false))
        val move = OpeningMove.next(install.getInt("openingLast", -1))
        if (showOpening) install.edit().putBoolean("openingSeen", true).putInt("openingLast", move.ordinal).apply()
        val reduceMotion = android.provider.Settings.Global.getFloat(contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        setContent {
            var opening by remember { mutableStateOf(showOpening) }
            Box(Modifier.fillMaxSize()) {
                PrayerTimesRoot(state)
                if (opening) OpeningScreen(move, reduceMotion) { opening = false }
            }
        }
    }

    /**
     * After a reinstall, Google's app backup brings the settings back, but not
     * the phone's permissions. A flag kept out of the backup tells a restored
     * install apart from this one, so we ask again only once, right after.
     */
    private fun welcomeBackIfRestored() {
        val install = getSharedPreferences(INSTALL_PREFS, MODE_PRIVATE)
        if (install.getBoolean("seen", false)) return
        install.edit().putBoolean("seen", true).apply()
        val p = state.prefs
        if (!p.hasOnboarded) return
        android.widget.Toast.makeText(this, "Welcome back. Your settings are back.", android.widget.Toast.LENGTH_LONG).show()
        lifecycleScope.launch {
            if (p.useGPS && !state.location.hasPermission) { location(); state.useGPS() }
            if (p.notificationsEnabled || p.anyAlarm) { notifications(); state.appBecameActive() }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        state.openLink(intent.dataString)
    }

    override fun onResume() {
        super.onResume()
        state.appBecameActive()
    }

    override fun onDestroy() {
        if (state.permissions === this) state.permissions = null
        super.onDestroy()
    }

    override suspend fun notifications(): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return ask { single.launch(Manifest.permission.POST_NOTIFICATIONS) }
    }

    override suspend fun location(): Boolean =
        ask { multiple.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)) }

    override suspend fun camera(): Boolean = ask { single.launch(Manifest.permission.CAMERA) }

    private suspend fun ask(launch: () -> Unit): Boolean {
        pending?.complete(false)
        val d = CompletableDeferred<Boolean>()
        pending = d
        launch()
        return d.await()
    }

    companion object {
        /** Not in the app backup (res/xml/backup_rules.xml), so it is empty after a reinstall. */
        const val INSTALL_PREFS = "install"
    }
}
