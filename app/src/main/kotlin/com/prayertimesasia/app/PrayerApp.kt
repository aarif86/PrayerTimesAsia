package com.prayertimesasia.app

import android.app.Application
import com.prayertimesasia.app.alarms.Notifications
import com.prayertimesasia.app.data.Directories
import com.prayertimesasia.app.data.OfficialRepository
import com.prayertimesasia.app.data.PrefsStore

class PrayerApp : Application() {
    /** The one app state, shared by the activity, the alarms and the widgets. */
    val state: AppState by lazy {
        AppState(this, PrefsStore(this), OfficialRepository(this), Directories(this))
    }

    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
    }

    /** A throwaway state for demo mode: nothing is saved, nothing is scheduled. */
    fun demoState(demo: DemoConfig): AppState {
        val s = AppState(this, null, OfficialRepository(this), Directories(this), demo.preferences(),
            fixedNow = demo.now, sideEffects = false)
        Demo.seed(s, demo)
        return s
    }
}

object Demo {
    fun seed(state: AppState, demo: DemoConfig) {
        DemoConfig.seedOfficial(state)
        state.selectedTab = demo.tab
        state.demoAligned = demo.aligned
    }
}
