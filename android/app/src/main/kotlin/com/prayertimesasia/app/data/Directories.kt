package com.prayertimesasia.app.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.prayertimesasia.core.CalendarDataset
import com.prayertimesasia.core.MosqueDataset
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Masjid-confirmed (Grade B) timetables from data/mosques.json and Ramadan/Eid
 * announcements from data/calendar.json in the public repo. The whole files are
 * downloaded - nothing about where you are is sent - and cached on disk.
 */
class Directories(context: Context) {
    private val dir = context.filesDir
    private val sp = context.getSharedPreferences("directories", Context.MODE_PRIVATE)

    var mosques by mutableStateOf(load("mosques.json") { MosqueDataset.decode(it) } ?: MosqueDataset.empty)
        private set
    var calendar by mutableStateOf(load("calendar.json") { CalendarDataset.decode(it) } ?: CalendarDataset.empty)
        private set

    private fun <T> load(name: String, decode: (String) -> T): T? {
        val f = File(dir, name)
        return if (f.isFile) runCatching { decode(f.readText()) }.getOrNull() else null
    }

    suspend fun refreshIfStale(): Unit = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (now - sp.getLong("mosques", 0) > 86_400_000L) {
            runCatching {
                val text = Http.get(MOSQUES_URL, 20_000)
                val fresh = MosqueDataset.decode(text)
                File(dir, "mosques.json").writeText(text)
                sp.edit().putLong("mosques", now).apply()
                withContext(Dispatchers.Main) { mosques = fresh }
            }
        }
        // Announcements come the night before, so check every three hours.
        if (now - sp.getLong("calendar", 0) > 3 * 3_600_000L) {
            runCatching {
                val text = Http.get(CALENDAR_URL, 20_000)
                val fresh = CalendarDataset.decode(text)
                File(dir, "calendar.json").writeText(text)
                sp.edit().putLong("calendar", now).apply()
                withContext(Dispatchers.Main) { calendar = fresh }
            }
        }
    }

    companion object {
        const val MOSQUES_URL = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/data/mosques.json"
        const val CALENDAR_URL = "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/data/calendar.json"
    }
}
