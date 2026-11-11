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
    val trackerPausedSince: String? = null,
    val wakeUp: WakeUpTiming? = null,
    val sahurAlarm: SahurTiming? = null,
    val sahurDays: List<String>? = null,
    val dhuhrAlarm: PrayerAlarmTiming? = null,
    val asrAlarm: PrayerAlarmTiming? = null,
    val maghribAlarm: PrayerAlarmTiming? = null,
    val ishaAlarm: PrayerAlarmTiming? = null,
    val alarmSound: AlarmSound? = null,
    val windowNudge: Boolean? = null,
    val quietHours: Boolean? = null,
    val quietFrom: Int? = null,
    val quietTo: Int? = null,
    val buzzOnly: Boolean? = null,
    val largeText: Boolean? = null,
    val jumuahReminderMinutes: Int? = null,
    /** The Ramadan record: how each day's fast went (FastMark raw values; an unknown one is skipped), and the days Tarawih was prayed and the juz read. */
    val fastLog: Map<String, String>? = null,
    val tarawihLog: List<String>? = null,
    val quranLog: List<String>? = null,
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
     * tracker history and the Ramadan record, which are added to what this phone
     * already has (an older code without them leaves this phone's as they are).
     */
    fun appliedTo(p: Preferences): Preferences {
        val d = Preferences()
        val log = p.prayedLog.toMutableMap()
        prayedLog?.forEach { (day, list) ->
            if (DAY.matches(day)) log[day] = (log[day].orEmpty()) + prayers(list)
        }
        val fasts = p.fastLog.toMutableMap()
        fastLog?.forEach { (day, raw) -> if (DAY.matches(day)) fastMark(raw)?.let { fasts[day] = it } }
        return p.copy(
            hasOnboarded = true,
            useGPS = useGPS ?: d.useGPS,
            home = home?.place(),
            homeConfirmed = home != null,
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
            trackerPausedSince = trackerPausedSince?.takeIf { DAY.matches(it) },
            wakeUp = wakeUp,
            sahurAlarm = sahurAlarm,
            sahurDays = sahurDays?.let { raw -> SahurDay.entries.filter { it.raw in raw }.toSet() } ?: d.sahurDays,
            dhuhrAlarm = dhuhrAlarm,
            asrAlarm = asrAlarm,
            maghribAlarm = maghribAlarm,
            ishaAlarm = ishaAlarm?.takeIf { it != PrayerAlarmTiming.END_MINUS_30 },
            alarmSound = alarmSound ?: d.alarmSound,
            // The picked ringtone lives on this phone only; another phone's "From my phone" plays Classic until one is picked.
            alarmRingtone = p.alarmRingtone,
            windowNudge = windowNudge ?: d.windowNudge,
            quietHours = quietHours ?: d.quietHours,
            quietFrom = quietFrom?.takeIf { it in 0 until 1440 } ?: d.quietFrom,
            quietTo = quietTo?.takeIf { it in 0 until 1440 } ?: d.quietTo,
            buzzOnly = buzzOnly ?: d.buzzOnly,
            largeText = largeText ?: d.largeText,
            jumuahReminderMinutes = jumuahReminderMinutes?.takeIf { it in PrayerWindow.JUMUAH_REMINDER_CHOICES } ?: 0,
            fastLog = fasts,
            tarawihLog = p.tarawihLog + tarawihLog.orEmpty().filter { DAY.matches(it) },
            quranLog = p.quranLog + quranLog.orEmpty().filter { DAY.matches(it) },
        )
    }

    val code: String
        get() {
            val packed = deflate(MoveJson.encodeToString(serializer(), this).toByteArray())
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(packed)
        }

    fun link(): String = LINK_BASE + code

    /** Only the Ramadan record from the newest day back [RAMADAN_YEAR_DAYS] days; null if nothing older was there to leave out. */
    fun latestRamadanYear(): MovedSettings? {
        val all = (fastLog.orEmpty().keys + tarawihLog.orEmpty() + quranLog.orEmpty()).filter { DAY.matches(it) }.sorted()
        if (all.isEmpty()) return null
        val from = runCatching { java.time.LocalDate.parse(all.last()).minusDays(RAMADAN_YEAR_DAYS.toLong()).toString() }.getOrNull() ?: return null
        if (all.first() >= from) return null
        return copy(
            fastLog = fastLog?.filterKeys { it >= from }?.takeIf { it.isNotEmpty() },
            tarawihLog = tarawihLog?.filter { it >= from }?.takeIf { it.isNotEmpty() },
            quranLog = quranLog?.filter { it >= from }?.takeIf { it.isNotEmpty() },
        )
    }

    /** A QR code's link, and what it left out to fit (the shared link always carries everything). */
    data class QrLink(val link: String, val keptDays: Int?, val ramadanTrimmed: Boolean)

    /**
     * The link for a QR code: everything if it fits. Otherwise first only this
     * year's Ramadan record (`ramadanTrimmed`), then the tracker history trimmed
     * to the most recent days that fit (`keptDays` says how many made it).
     */
    fun qrLink(maxCharacters: Int = QR_MAX_CHARACTERS): QrLink {
        var base = this
        var l = link()
        if (l.length <= maxCharacters) return QrLink(l, null, false)
        val thisYear = latestRamadanYear()
        if (thisYear != null) {
            base = thisYear
            l = base.link()
            if (l.length <= maxCharacters) return QrLink(l, null, true)
        }
        val ramadanTrimmed = thisYear != null
        val days = base.prayedLog.orEmpty().keys.sorted()
        if (days.isEmpty()) return QrLink(l, null, ramadanTrimmed)
        var keep = days.size
        while (true) {
            keep /= 2
            val recent = days.takeLast(keep).toSet()
            val trimmed = base.copy(prayedLog = if (keep == 0) null else base.prayedLog!!.filterKeys { it in recent })
            val t = trimmed.link()
            if (t.length <= maxCharacters || keep == 0) return QrLink(t, keep, ramadanTrimmed)
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
            if (notifyPrayers != null || reminderMinutesBefore != null || quietHours != null || buzzOnly != null || jumuahReminderMinutes != null) add("Which prayers to alert, and how")
            if (wakeUp != null || sahurAlarm != null || dhuhrAlarm != null || asrAlarm != null || maghribAlarm != null || ishaAlarm != null) {
                add("Your prayer alarms")
            }
            if (!fastLog.isNullOrEmpty() || !tarawihLog.isNullOrEmpty() || !quranLog.isNullOrEmpty()) add("Your Ramadan record of fasts, Tarawih and juz")
            if (largeText == true) add("Bigger text")
            if (musafirEnabled == true) add("Musafir features")
        }.ifEmpty { listOf("The standard settings") }

    companion object {
        const val VERSION = 1
        const val PREFIX = "PTA1."
        /** The web app's address; a phone camera that scans the QR code opens it straight into "Bring in settings". */
        const val LINK_BASE = "https://aarif86.github.io/PrayerTimesAsia/app/#move="
        /** Phone cameras read a QR code of this many characters off a screen without fuss. */
        const val QR_MAX_CHARACTERS = 1500
        /** How far back "this year's Ramadan record" reaches from its newest day: the month itself, Syawal and the replaced fasts after it. */
        const val RAMADAN_YEAR_DAYS = 330

        /** What the QR code left out, if anything, in one line; null when it carries everything. */
        fun trimNote(keptDays: Int?, ramadanTrimmed: Boolean): String? {
            val parts = listOfNotNull(
                keptDays?.let { "your last $it days of tracker history" },
                if (ramadanTrimmed) "only this year's Ramadan record" else null,
            )
            return if (parts.isEmpty()) null else "The QR code carries ${parts.joinToString(" and ")}. To bring all of it, share the link instead."
        }

        private val DAY = Regex("""\d{4}-\d{2}-\d{2}""")
        private val CODE = Regex("""PTA1\.([A-Za-z0-9_-]+)""")
        internal val MoveJson = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            explicitNulls = false
            encodeDefaults = false
        }

        private fun prayers(raw: List<String>): Set<Prayer> = Prayer.entries.filter { it.raw in raw }.toSet()
        private fun fastMark(raw: String): FastMark? = FastMark.entries.firstOrNull { it.name.lowercase() == raw }
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
                trackerPausedSince = p.trackerPausedSince,
                wakeUp = p.wakeUp,
                sahurAlarm = p.sahurAlarm,
                sahurDays = changed(p.sahurDays, d.sahurDays)?.let { set -> SahurDay.entries.filter { it in set }.map { it.raw } },
                dhuhrAlarm = p.dhuhrAlarm,
                asrAlarm = p.asrAlarm,
                maghribAlarm = p.maghribAlarm,
                ishaAlarm = p.ishaAlarm,
                alarmSound = changed(p.alarmSound, d.alarmSound),
                windowNudge = changed(p.windowNudge, d.windowNudge),
                quietHours = changed(p.quietHours, d.quietHours),
                quietFrom = changed(p.quietFrom, d.quietFrom),
                quietTo = changed(p.quietTo, d.quietTo),
                buzzOnly = changed(p.buzzOnly, d.buzzOnly),
                largeText = changed(p.largeText, d.largeText),
                jumuahReminderMinutes = changed(p.jumuahReminderMinutes, d.jumuahReminderMinutes),
                fastLog = p.fastLog.takeIf { it.isNotEmpty() }?.mapValues { it.value.name.lowercase() }?.toSortedMap(),
                tarawihLog = p.tarawihLog.takeIf { it.isNotEmpty() }?.sorted(),
                quranLog = p.quranLog.takeIf { it.isNotEmpty() }?.sorted(),
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
