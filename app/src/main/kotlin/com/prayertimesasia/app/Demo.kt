package com.prayertimesasia.app

import android.content.Intent
import com.prayertimesasia.core.Appearance
import com.prayertimesasia.core.Coordinates
import com.prayertimesasia.core.Geo
import com.prayertimesasia.core.OfficialSource
import com.prayertimesasia.core.Place
import com.prayertimesasia.core.Prayer
import com.prayertimesasia.core.Preferences
import com.prayertimesasia.core.TodayStyle
import com.prayertimesasia.core.TripStop
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Demo mode for screenshots and store listings: a fixed place and, optionally, a
 * fixed clock. Start it with intent extras, e.g.
 *
 *     adb shell am start -n com.prayertimesasia.app/.MainActivity \
 *         --ez demo true --es variant home --es style bands --es appearance dark \
 *         --es tab prayer --es now 2026-10-25T20:49:00+08:00 --ez more false
 *
 * variant: home (Pasir Ris, Singapore), travel (just landed in Hanoi), visitor
 * (from Sydney in Kuala Lumpur) or makkah. Nothing in demo mode is saved.
 */
data class DemoConfig(
    val variant: String = "home",
    val style: TodayStyle = TodayStyle.CENTRE,
    val appearance: Appearance = Appearance.DARK,
    val tab: Tab = Tab.PRAYER,
    val now: Instant? = null,
    val showMore: Boolean = false,
    val aligned: Boolean = false,
) {
    val pasirRis = Place(id = "demo-pasir-ris", name = "Pasir Ris", countryCode = "SG", countryName = "Singapore",
        timeZoneId = "Asia/Singapore", coordinates = Coordinates(1.3721, 103.9474))

    fun preferences(nowForStreak: Instant = now ?: Instant.now()): Preferences {
        val sgt = ZoneId.of("Asia/Singapore")
        // The tracker with a three-day streak.
        val log = (1..3).associate { back ->
            nowForStreak.atZone(sgt).toLocalDate().minusDays(back.toLong()).toString() to Prayer.obligatory.toSet()
        }
        var p = Preferences(
            hasOnboarded = true, useGPS = false, home = pasirRis, manualPlace = pasirRis, lastCountryCode = "SG",
            trackerEnabled = true, prayedLog = log, appearance = appearance, todayStyle = style, showMore = showMore,
        )
        when (variant) {
            "visitor" -> {
                // A visitor from Sydney in Kuala Lumpur: International names, Malay underneath.
                p = p.copy(
                    home = Place(id = "demo-sydney", name = "Sydney", countryCode = "AU", countryName = "Australia",
                        timeZoneId = "Australia/Sydney", coordinates = Coordinates(-33.8688, 151.2093)),
                    manualPlace = Place(id = "demo-kl", name = "Kuala Lumpur", countryCode = "MY", countryName = "Malaysia",
                        timeZoneId = "Asia/Kuala_Lumpur", coordinates = Coordinates(3.139, 101.6869)),
                    lastCountryCode = "MY", trackerEnabled = false,
                )
            }
            "makkah" -> p = p.copy(
                manualPlace = Place(id = "demo-makkah", name = "Makkah", countryCode = "SA", countryName = "Saudi Arabia",
                    timeZoneId = "Asia/Riyadh", coordinates = Geo.kaaba),
                lastCountryCode = "SA", musafirEnabled = true,
            )
            "travel" -> {
                val hanoi = Place(id = "demo-hanoi", name = "Hoàn Kiếm", region = "Hanoi", countryCode = "VN", countryName = "Vietnam",
                    timeZoneId = "Asia/Ho_Chi_Minh", coordinates = Coordinates(21.0285, 105.8542))
                val t = (now ?: Instant.now()).toEpochMilli()
                p = p.copy(
                    manualPlace = hanoi, lastCountryCode = "VN", musafirEnabled = true, arrivedAt = t,
                    arrivalBannerDismissed = false,
                    trip = listOf(
                        TripStop(id = "t1", countryCode = "VN", countryName = "Vietnam", placeName = "Hoàn Kiếm", arrived = t),
                        TripStop(id = "t2", countryCode = "SG", countryName = "Singapore", placeName = "Pasir Ris", arrived = t - 86_400_000L * 30),
                    ),
                )
            }
        }
        return p
    }

    companion object {
        /** The MUIS published times for Sunday 25 October 2026 (as the iOS app downloaded them), for offline demos. */
        val muis25Oct2026: Map<String, Map<String, String>> = mapOf(
            "2026-10-25" to mapOf("fajr" to "05:28", "sunrise" to "06:47", "dhuhr" to "12:50", "asr" to "16:08",
                "maghrib" to "18:52", "isha" to "20:02"),
        )

        fun seedOfficial(state: AppState) {
            if (!state.official.hasTable(OfficialSource.Muis, 2026)) state.official.seed(OfficialSource.Muis, 2026, muis25Oct2026)
        }

        /** Sunday 25 October 2026, 4:49 am in Singapore - the iOS screenshots' moment (Isyak, before Subuh). */
        val night: Instant = ZonedDateTime.of(2026, 10, 25, 4, 49, 0, 0, ZoneId.of("Asia/Singapore")).toInstant()
        /** The same day, mid-morning. */
        val morning: Instant = ZonedDateTime.of(2026, 10, 25, 10, 20, 0, 0, ZoneId.of("Asia/Singapore")).toInstant()

        fun from(intent: Intent?): DemoConfig? {
            if (intent?.getBooleanExtra("demo", false) != true) return null
            fun <T : Enum<T>> pick(values: Array<T>, raw: String?, names: (T) -> List<String>): T? =
                raw?.lowercase()?.let { r -> values.firstOrNull { v -> names(v).any { it.equals(r, ignoreCase = true) } } }
            return DemoConfig(
                variant = intent.getStringExtra("variant") ?: "home",
                style = pick(TodayStyle.entries.toTypedArray(), intent.getStringExtra("style")) {
                    listOf(it.name, it.name.replace("_", ""), it.label.replace(" ", ""))
                } ?: TodayStyle.CENTRE,
                appearance = pick(Appearance.entries.toTypedArray(), intent.getStringExtra("appearance")) {
                    listOf(it.name, if (it == Appearance.SYSTEM) "auto" else it.name)
                } ?: Appearance.DARK,
                tab = pick(Tab.entries.toTypedArray(), intent.getStringExtra("tab")) { listOf(it.name) } ?: Tab.PRAYER,
                now = intent.getStringExtra("now")?.let { runCatching { ZonedDateTime.parse(it).toInstant() }.getOrNull() },
                showMore = intent.getBooleanExtra("more", false),
                aligned = intent.getBooleanExtra("aligned", false),
            )
        }
    }
}
