package com.prayertimesasia.core

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.zip.Deflater
import java.util.zip.Inflater

/**
 * "Move my settings": everything a user chose, packed into one short code they
 * carry to another phone themselves (QR code, link or copy-paste). No account
 * and no server - the settings travel inside the code.
 *
 * The format is shared with the iPhone and web apps (docs/move-settings.md,
 * checked by testdata/move-settings.json):
 *
 *     PTA1.<base64url of raw DEFLATE of the JSON below>
 *
 * The JSON holds only what differs from the defaults, so a missing key means
 * "the default". Places carry no id; the receiving app gives them new ones.
 */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class MovedSettings(
    @EncodeDefault val v: Int = VERSION,
    val useGPS: Boolean? = null,
    val home: MovedPlace? = null,
    val manualPlace: MovedPlace? = null,
    val savedPlaces: List<MovedPlace>? = null,
    val methodOverrideID: String? = null,
    val asrOverride: AsrSchool? = null,
    val namingOverride: NamingStyle? = null,
    val use24Hour: Boolean? = null,
    val hijriAdjustment: Int? = null,
    /** Prayer raw values; an unknown one is skipped. */
    val notifyPrayers: List<String>? = null,
    val reminderMinutesBefore: Int? = null,
    val musafirEnabled: Boolean? = null,
    val musafirThresholdKm: Double? = null,
    val jakimZoneOverride: String? = null,
    val communityAuthority: String? = null,
    val appearance: Appearance? = null,
    val todayStyle: TodayStyle? = null,
    val showOffers: Boolean? = null,
    val showLocalNames: Boolean? = null,
    val trackerEnabled: Boolean? = null,
    val prayedLog: Map<String, List<String>>? = null,
    val excusedDays: List<String>? = null,
    val wakeUp: WakeUpTiming? = null,
) {
    @Serializable
    data class MovedPlace(
        val name: String,
        val region: String? = null,
        val countryCode: String? = null,
        val countryName: String? = null,
        val timeZoneID: String,
        val lat: Double,
        val lon: Double,
        val district: String? = null,
    ) {
        fun place(): Place = Place(
            name = name, region = region, countryCode = countryCode, countryName = countryName,
            timeZoneId = timeZoneID, coordinates = Coordinates(lat, lon), district = district,
        )

        companion object {
            fun of(p: Place) = MovedPlace(
                name = p.name, region = p.region, countryCode = p.countryCode, countryName = p.countryName,
                timeZoneID = p.timeZoneId, lat = p.coordinates.latitude, lon = p.coordinates.longitude, district = p.district,
            )
        }
    }

    /**
     * These preferences with the moved settings in place. Every moved setting
     * replaces this phone's (a missing one goes back to its default), except the
     * tracker history, which is added to what this phone already has.
     */
    fun appliedTo(p: Preferences): Preferences {
        val d = Preferences()
        val log = p.prayedLog.toMutableMap()
        prayedLog?.forEach { (day, list) ->
            if (DAY.matches(day)) log[day] = (log[day].orEmpty()) + prayers(list)
        }
        return p.copy(
            hasOnboarded = true,
            useGPS = useGPS ?: d.useGPS,
            home = home?.place(),
            manualPlace = manualPlace?.place(),
            savedPlaces = savedPlaces?.map { it.place() }.orEmpty(),
            methodOverrideId = methodOverrideID,
            asrOverride = asrOverride,
            namingOverride = namingOverride,
            use24Hour = use24Hour ?: d.use24Hour,
            hijriAdjustment = (hijriAdjustment ?: d.hijriAdjustment).coerceIn(-2, 2),
            notifyPrayers = notifyPrayers?.let { prayers(it) } ?: d.notifyPrayers,
            reminderMinutesBefore = reminderMinutesBefore ?: d.reminderMinutesBefore,
            musafirEnabled = musafirEnabled ?: d.musafirEnabled,
            musafirThresholdKm = musafirThresholdKm ?: d.musafirThresholdKm,
            jakimZoneOverride = jakimZoneOverride,
            communityAuthority = communityAuthority,
            appearance = appearance ?: d.appearance,
            todayStyle = todayStyle ?: d.todayStyle,
            showOffers = showOffers ?: d.showOffers,
            showLocalNames = showLocalNames ?: d.showLocalNames,
            trackerEnabled = trackerEnabled ?: d.trackerEnabled,
            prayedLog = log,
            excusedDays = p.excusedDays + excusedDays.orEmpty(),
            wakeUp = wakeUp,
        )
    }

    val code: String
        get() {
            val packed = deflate(MoveJson.encodeToString(serializer(), this).toByteArray())
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(packed)
        }

    fun link(): String = LINK_BASE + code

    /**
     * The link for a QR code: everything if it fits, otherwise the tracker
     * history trimmed to the most recent days that fit. `keptDays` says how many made it.
     */
    fun qrLink(maxCharacters: Int = QR_MAX_CHARACTERS): Pair<String, Int?> {
        val full = link()
        val days = prayedLog.orEmpty().keys.sorted()
        if (full.length <= maxCharacters || days.isEmpty()) return full to null
        var keep = days.size
        while (true) {
            keep /= 2
            val recent = days.takeLast(keep).toSet()
            val trimmed = copy(prayedLog = if (keep == 0) null else prayedLog!!.filterKeys { it in recent })
            val l = trimmed.link()
            if (l.length <= maxCharacters || keep == 0) return l to keep
        }
    }

    /** What people are about to bring in, in a few short lines. */
    val summary: List<String>
        get() = buildList {
            (home?.name ?: manualPlace?.name)?.let { add("Place: $it") }
            savedPlaces?.size?.takeIf { it > 0 }?.let { add("$it saved place${if (it == 1) "" else "s"}") }
            val days = prayedLog?.size ?: 0
            if (trackerEnabled == true || days > 0) add("Prayer tracker" + if (days > 0) ", $days day${if (days == 1) "" else "s"} of history" else "")
            if (methodOverrideID != null || asrOverride != null || jakimZoneOverride != null) add("Your calculation choices")
            if (appearance != null || todayStyle != null || use24Hour != null || namingOverride != null) add("Your look and prayer names")
            if (notifyPrayers != null || reminderMinutesBefore != null) add("Which prayers to alert")
            if (wakeUp != null) add("Your wake-up alarm")
            if (musafirEnabled == true) add("Musafir features")
        }.ifEmpty { listOf("The standard settings") }

    companion object {
        const val VERSION = 1
        const val PREFIX = "PTA1."
        /** The web app's address; a phone camera that scans the QR code opens it straight into "Bring in settings". */
        const val LINK_BASE = "https://aarif86.github.io/PrayerTimesAsia/app/#move="
        /** Phone cameras read a QR code of this many characters off a screen without fuss. */
        const val QR_MAX_CHARACTERS = 1500

        private val DAY = Regex("""\d{4}-\d{2}-\d{2}""")
        private val CODE = Regex("""PTA1\.([A-Za-z0-9_-]+)""")
        internal val MoveJson = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            explicitNulls = false
            encodeDefaults = false
        }

        private fun prayers(raw: List<String>): Set<Prayer> = Prayer.entries.filter { it.raw in raw }.toSet()
        private fun ordered(set: Set<Prayer>): List<String> = Prayer.entries.filter { it in set }.map { it.raw }

        /** What to put in the code: only the settings that differ from a fresh install. */
        fun from(p: Preferences): MovedSettings {
            val d = Preferences()
            fun <T> changed(a: T, b: T): T? = if (a == b) null else a
            return MovedSettings(
                useGPS = changed(p.useGPS, d.useGPS),
                home = p.home?.let(MovedPlace::of),
                manualPlace = p.manualPlace?.let(MovedPlace::of),
                savedPlaces = p.savedPlaces.takeIf { it.isNotEmpty() }?.map(MovedPlace::of),
                methodOverrideID = p.methodOverrideId,
                asrOverride = p.asrOverride,
                namingOverride = p.namingOverride,
                use24Hour = changed(p.use24Hour, d.use24Hour),
                hijriAdjustment = changed(p.hijriAdjustment, d.hijriAdjustment),
                notifyPrayers = changed(p.notifyPrayers, d.notifyPrayers)?.let(::ordered),
                reminderMinutesBefore = changed(p.reminderMinutesBefore, d.reminderMinutesBefore),
                musafirEnabled = changed(p.musafirEnabled, d.musafirEnabled),
                musafirThresholdKm = changed(p.musafirThresholdKm, d.musafirThresholdKm),
                jakimZoneOverride = p.jakimZoneOverride,
                communityAuthority = p.communityAuthority,
                appearance = changed(p.appearance, d.appearance),
                todayStyle = changed(p.todayStyle, d.todayStyle),
                showOffers = changed(p.showOffers, d.showOffers),
                showLocalNames = changed(p.showLocalNames, d.showLocalNames),
                trackerEnabled = changed(p.trackerEnabled, d.trackerEnabled),
                prayedLog = p.prayedLog.filterValues { it.isNotEmpty() }.takeIf { it.isNotEmpty() }
                    ?.mapValues { ordered(it.value) }?.toSortedMap(),
                excusedDays = p.excusedDays.takeIf { it.isNotEmpty() }?.sorted(),
                wakeUp = p.wakeUp,
            )
        }

        /** The settings in a code, a link with one, or any text that contains one; null if there isn't a readable one. */
        fun fromCode(text: String): MovedSettings? {
            val match = CODE.find(text) ?: return null
            return runCatching {
                val json = inflate(Base64.getUrlDecoder().decode(match.groupValues[1])).decodeToString()
                MoveJson.decodeFromString(serializer(), json)
            }.getOrNull()?.takeIf { it.v == VERSION }
        }

        private fun deflate(bytes: ByteArray): ByteArray {
            val deflater = Deflater(Deflater.BEST_COMPRESSION, true)
            deflater.setInput(bytes)
            deflater.finish()
            val out = ByteArrayOutputStream()
            val buffer = ByteArray(4096)
            while (!deflater.finished()) out.write(buffer, 0, deflater.deflate(buffer))
            deflater.end()
            return out.toByteArray()
        }

        private fun inflate(bytes: ByteArray): ByteArray {
            val inflater = Inflater(true)
            inflater.setInput(bytes)
            val out = ByteArrayOutputStream()
            val buffer = ByteArray(4096)
            while (!inflater.finished()) {
                val n = inflater.inflate(buffer)
                if (n == 0 && (inflater.needsInput() || inflater.needsDictionary())) break
                out.write(buffer, 0, n)
            }
            val done = inflater.finished()
            inflater.end()
            require(done) { "Truncated code" }
            return out.toByteArray()
        }
    }
}
