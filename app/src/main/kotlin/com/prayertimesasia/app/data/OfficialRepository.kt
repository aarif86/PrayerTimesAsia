package com.prayertimesasia.app.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import com.prayertimesasia.core.CoreJson
import com.prayertimesasia.core.Official
import com.prayertimesasia.core.OfficialSource
import com.prayertimesasia.core.OfficialTable
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.fmt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Exact official timetables when online: MUIS (data.gov.sg), JAKIM e-Solat by
 * zone and Kemenag (api.myquran.com). Requests carry only a year, a zone code or a
 * regency name, never coordinates. A downloaded year is kept on disk, so it keeps
 * working offline; without a table the app falls back to its own calculation.
 */
class OfficialRepository(context: Context) {
    private val dir = File(context.filesDir, "official").apply { mkdirs() }
    private val tables = ConcurrentHashMap<String, OfficialTable>()
    private val missing = ConcurrentHashMap.newKeySet<String>()
    private val inFlight = ConcurrentHashMap.newKeySet<String>()
    private val failedAt = ConcurrentHashMap<String, Long>()
    private var kemenagCities: List<Pair<String, String>>? = null

    /** Bumped whenever a new table arrives, so the UI re-reads. */
    var revision by mutableIntStateOf(0)
        private set

    private val serializer = MapSerializer(String.serializer(), MapSerializer(String.serializer(), String.serializer()))

    fun times(source: OfficialSource, year: Int, month: Int, day: Int): Map<Prayer, String>? {
        @Suppress("UNUSED_VARIABLE") val r = revision
        val table = table(source.cacheKey(year)) ?: return null
        val row = table[fmt("%04d-%02d-%02d", year, month, day)] ?: return null
        val out = Prayer.all.associateWith { row[it.raw] ?: return null }
        return out
    }

    fun hasTable(source: OfficialSource, year: Int): Boolean = table(source.cacheKey(year)) != null

    private fun table(key: String): OfficialTable? {
        tables[key]?.let { return it }
        if (key in missing) return null
        val f = File(dir, "$key.json")
        val loaded = if (f.isFile) runCatching { CoreJson.decodeFromString(serializer, f.readText()) }.getOrNull() else null
        if (loaded != null) tables[key] = loaded else missing += key
        return loaded
    }

    /** For demos and tests: a table as if it had been downloaded. */
    fun seed(source: OfficialSource, year: Int, table: OfficialTable) {
        val key = source.cacheKey(year)
        tables[key] = table
        missing -= key
        revision++
    }

    /** Downloads the year's table if it isn't cached. Returns true if new data arrived. */
    suspend fun ensure(source: OfficialSource, year: Int): Boolean = withContext(Dispatchers.IO) {
        val key = source.cacheKey(year)
        if (table(key) != null || !inFlight.add(key)) return@withContext false
        try {
            val failed = failedAt[key]
            if (failed != null && System.currentTimeMillis() - failed < 30 * 60_000L) return@withContext false
            val table: OfficialTable = when (source) {
                OfficialSource.Muis -> {
                    val dataset = muisDataset(year) ?: error("No MUIS dataset for $year")
                    Official.parseMuis(Http.get(Official.muisUrl(dataset)))
                }
                is OfficialSource.Jakim -> Official.parseJakim(Http.get(Official.jakimUrl(source.zone)), year)
                is OfficialSource.Kemenag -> fetchKemenag(source.regency, year)
            }
            // A year is ~365 rows; Kemenag comes month by month, so accept a partial year.
            check(table.size > 25) { "Only ${table.size} rows" }
            File(dir, "$key.json").writeText(CoreJson.encodeToString(serializer, table))
            tables[key] = table
            missing -= key
            withContext(Dispatchers.Main) { revision++ }
            true
        } catch (e: Exception) {
            failedAt[key] = System.currentTimeMillis()
            false
        } finally {
            inFlight -= key
        }
    }

    private fun muisDataset(year: Int): String? {
        Official.muisDatasets[year]?.let { return it }
        return runCatching {
            val root = CoreJson.parseToJsonElement(Http.get(Official.REMOTE_CONFIG)).jsonObject
            root["muisDatasets"]?.jsonObject?.get(year.toString())?.jsonPrimitive?.content
        }.getOrNull()
    }

    private fun fetchKemenag(regency: String, year: Int): OfficialTable {
        val cities = kemenagCities ?: run {
            val f = File(dir, "kemenag-cities.json")
            val text = if (f.isFile) f.readText() else Http.get(Official.KEMENAG_CITIES_URL).also { f.writeText(it) }
            Official.parseKemenagCities(text).also { kemenagCities = it }
        }
        val id = Official.matchKemenagCity(listOf(regency), cities) ?: error("No Kemenag city for $regency")
        val out = mutableMapOf<String, Map<String, String>>()
        for (month in 1..12) {
            runCatching { Official.parseKemenag(Http.get(Official.kemenagUrl(id, year, month))) }
                .getOrNull()?.forEach { (k, v) -> out.putIfAbsent(k, v) }
        }
        return out
    }
}
