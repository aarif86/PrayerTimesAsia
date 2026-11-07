package com.prayertimesasia.app.data

import android.content.Context
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.MasjidLists
import com.prayertimesasia.core.PrayerSpace
import java.io.File

/**
 * Keeps the weekly ready-made masjid squares (see [MasjidLists]) on the phone.
 * Only which square is wanted leaves the phone. Blocking: use from Dispatchers.IO.
 */
object MasjidListStore {
    private var index: MasjidLists.Index? = null
    private val loaded = mutableMapOf<String, List<PrayerSpace>>()
    private val failedAt = mutableMapOf<String, Long>()

    private fun file(context: Context, path: String) = File(context.filesDir, "masjids/$path")

    private fun fresh(f: File) = f.exists() && System.currentTimeMillis() - f.lastModified() < MasjidLists.MAX_AGE_MS

    @Synchronized
    private fun currentIndex(context: Context): MasjidLists.Index? {
        if (index == null) {
            val f = file(context, "index.json")
            if (f.exists()) index = MasjidLists.parseIndex(f.readText())
        }
        return index
    }

    /** False only when this week's list is known not to cover the country. */
    fun mayCover(context: Context, country: String?): Boolean {
        if (country == null) return false
        val idx = currentIndex(context) ?: return true
        return country.uppercase() in idx.countries
    }

    /** Places within 15 km of [here], nearest first; null when a square this area needs isn't on the phone. */
    @Synchronized
    fun places(context: Context, here: Coordinates, country: String?): List<PrayerSpace>? {
        val idx = currentIndex(context) ?: return null
        if (country == null || country.uppercase() !in idx.countries) return null
        val all = mutableListOf<PrayerSpace>()
        for (key in MasjidLists.tiles(here).filter { it in idx.tiles }) {
            if (loaded[key] == null) {
                val f = file(context, "tiles/$key.json")
                if (f.exists()) {
                    val parsed = MasjidLists.parse(f.readText())
                    if (parsed == null) f.delete() else loaded[key] = parsed
                }
            }
            all += loaded[key] ?: return null
        }
        return MasjidLists.near(all, here)
    }

    /** The index and this area's squares are on the phone and under a week old. */
    fun isFresh(context: Context, here: Coordinates): Boolean {
        if (!fresh(file(context, "index.json"))) return false
        val idx = currentIndex(context) ?: return false
        return MasjidLists.tiles(here).filter { it in idx.tiles }.all { fresh(file(context, "tiles/$it.json")) }
    }

    /** Refresh: mark the index and this area's squares as old, so the next download fetches them again. */
    @Synchronized
    fun forget(context: Context, here: Coordinates) {
        val idx = currentIndex(context)
        (listOf("index.json") + MasjidLists.tiles(here).filter { idx == null || it in idx.tiles }.map { "tiles/$it.json" })
            .map { file(context, it) }.filter { it.exists() }.forEach { it.setLastModified(0) }
        failedAt.clear()
    }

    /** Fetches the index and this area's squares when missing or a week old. True when all are on the phone. */
    fun download(context: Context, here: Coordinates, country: String?): Boolean {
        if (!fetch(context, "index.json") { MasjidLists.parseIndex(it) != null }) return false
        val idx = currentIndex(context) ?: return false
        if (country == null || country.uppercase() !in idx.countries) return false
        var ok = true
        for (key in MasjidLists.tiles(here).filter { it in idx.tiles }) {
            ok = fetch(context, "tiles/$key.json") { MasjidLists.parse(it) != null } && ok
        }
        return ok
    }

    /** Downloads one file unless a fresh copy is on the phone. True when a usable copy is there afterwards. */
    private fun fetch(context: Context, path: String, valid: (String) -> Boolean): Boolean {
        val f = file(context, path)
        val have = f.exists()
        if (fresh(f)) return true
        val failed = synchronized(this) { failedAt[path] }
        if (failed != null && System.currentTimeMillis() - failed < 5 * 60_000) return have
        val text = runCatching { Http.get(MasjidLists.BASE_URL + path, timeoutMs = 12_000) }.getOrNull()
        if (text != null && valid(text)) {
            f.parentFile?.mkdirs()
            val tmp = File(f.path + ".tmp")
            tmp.writeText(text)
            tmp.renameTo(f)
            synchronized(this) {
                failedAt.remove(path)
                if (path == "index.json") index = null else loaded.remove(path.removePrefix("tiles/").removeSuffix(".json"))
            }
            return true
        }
        synchronized(this) { failedAt[path] = System.currentTimeMillis() }
        return have
    }
}
