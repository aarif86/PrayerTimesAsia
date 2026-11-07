package com.prayertimesasia.app.data

import android.content.Context
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.MasjidLists
import com.prayertimesasia.core.PrayerSpace
import java.io.File

/**
 * Keeps the weekly ready-made masjid lists (see [MasjidLists]) on the phone.
 * Only the country's list is downloaded; nothing about you is sent.
 * Blocking calls: use from Dispatchers.IO.
 */
object MasjidListStore {
    private val loaded = mutableMapOf<String, List<PrayerSpace>>()
    private val failedAt = mutableMapOf<String, Long>()

    private fun file(context: Context, cc: String) = File(context.filesDir, "masjids/${cc.lowercase()}.json")

    /** Places within 15 km of [here]; null when a list this area needs isn't on the phone. */
    @Synchronized
    fun places(context: Context, here: Coordinates): List<PrayerSpace>? {
        val needed = MasjidLists.countries(here)
        if (needed.isEmpty()) return null
        val all = mutableListOf<PrayerSpace>()
        for (cc in needed) {
            if (loaded[cc] == null) {
                val f = file(context, cc)
                if (f.exists()) {
                    val parsed = MasjidLists.parse(f.readText())
                    if (parsed == null) f.delete() else loaded[cc] = parsed
                }
            }
            all += loaded[cc] ?: return null
        }
        return MasjidLists.near(all, here)
    }

    /** Every list this area needs is on the phone and under a week old. */
    fun isFresh(context: Context, here: Coordinates): Boolean = MasjidLists.countries(here).all {
        val f = file(context, it)
        f.exists() && System.currentTimeMillis() - f.lastModified() < MasjidLists.MAX_AGE_MS
    }

    /** Fetches lists that are missing or a week old. True when every list this area needs is on the phone. */
    fun download(context: Context, here: Coordinates): Boolean {
        var ok = true
        for (cc in MasjidLists.countries(here)) {
            val f = file(context, cc)
            val have = f.exists()
            if (have && System.currentTimeMillis() - f.lastModified() < MasjidLists.MAX_AGE_MS) continue
            val failed = synchronized(this) { failedAt[cc] }
            if (failed != null && System.currentTimeMillis() - failed < 5 * 60_000) { ok = ok && have; continue }
            val text = runCatching { Http.get(MasjidLists.BASE_URL + cc.lowercase() + ".json", timeoutMs = 15_000) }.getOrNull()
            val parsed = text?.let { MasjidLists.parse(it) }
            if (text != null && !parsed.isNullOrEmpty()) {
                f.parentFile?.mkdirs()
                val tmp = File(f.path + ".tmp")
                tmp.writeText(text)
                tmp.renameTo(f)
                synchronized(this) { loaded[cc] = parsed; failedAt.remove(cc) }
            } else {
                synchronized(this) { failedAt[cc] = System.currentTimeMillis() }
                ok = ok && have
            }
        }
        return ok
    }
}
