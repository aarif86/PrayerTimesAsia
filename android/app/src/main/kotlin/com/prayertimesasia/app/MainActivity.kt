package com.prayertimesasia.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import com.prayertimesasia.app.ui.PrayerTimesRoot
import kotlinx.coroutines.CompletableDeferred

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
        setContent { PrayerTimesRoot(state) }
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
}
