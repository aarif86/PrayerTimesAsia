package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Reference days copied from official timetables (the same cases as the iOS
 * PrayerEngineTests). The offline calculation must never be earlier than the
 * official time: prayers 0-2 minutes later, sunrise 0-1 minute earlier.
 */
class PrayerEngineTest {
    private data class Case(val method: CalculationMethod, val date: LocalDate, val coordinates: Coordinates, val official: List<String>)

    private val singapore = Coordinates(1.3521, 103.8198)
    private val kualaLumpur = Coordinates(3.1472, 101.6894)
    private val sgt = ZoneId.of("Asia/Singapore")

    private val cases = listOf(
        // MUIS 2026 timetable (data.gov.sg) and the prayertime.sg app for 21 Oct.
        Case(CalculationMethod.MUIS, LocalDate.of(2026, 1, 1), singapore, listOf("05:44", "07:08", "13:10", "16:34", "19:11", "20:25")),
        Case(CalculationMethod.MUIS, LocalDate.of(2026, 8, 1), singapore, listOf("05:46", "07:06", "13:13", "16:34", "19:17", "20:29")),
        Case(CalculationMethod.MUIS, LocalDate.of(2026, 10, 21), singapore, listOf("05:29", "06:47", "12:51", "16:07", "18:52", "20:02")),
        // JAKIM e-Solat, zone WLY01 (Kuala Lumpur).
        Case(CalculationMethod.JAKIM, LocalDate.of(2026, 1, 1), kualaLumpur, listOf("06:06", "07:18", "13:19", "16:42", "19:17", "20:31")),
    )

    private fun minutesOfDay(i: java.time.Instant): Int {
        val z = i.atZone(sgt)
        return z.hour * 60 + z.minute
    }

    @Test fun calculationIsNeverEarlierThanOfficialTimetables() {
        for (c in cases) {
            val day = PrayerEngine.compute(c.date.year, c.date.monthValue, c.date.dayOfMonth, c.coordinates, c.method, AsrSchool.STANDARD)
            for ((prayer, official) in Prayer.all.zip(c.official)) {
                val got = minutesOfDay(day.time(prayer))
                val (h, m) = official.split(":").map { it.toInt() }
                val diff = got - (h * 60 + m)
                val label = "${c.method.shortName} ${c.date} $prayer: $diff min off"
                if (prayer == Prayer.SUNRISE) assertTrue(label, diff in -1..0) else assertTrue(label, diff in 0..2)
            }
        }
    }

    /**
     * The exact minutes the iOS app shows for calculated days (from its CI
     * screenshots), so any drift between the two engines shows up at once.
     */
    @Test fun matchesTheIosAppToTheMinute() {
        fun hhmm(day: PrayerDay, zone: ZoneId) = day.ordered.map { TimeFormat.formatted(it.second, zone, true) }
        // Hoàn Kiếm, Hanoi, Sat 24 Oct 2026, Southeast Asia 20°/18° (iOS 2-today-hanoi and 3-journey).
        val hanoiZone = ZoneId.of("Asia/Ho_Chi_Minh")
        val hanoi = PrayerEngine.compute(2026, 10, 24, Coordinates(21.0285, 105.8542), CalculationMethod.SOUTHEAST_ASIA, AsrSchool.STANDARD)
        assertEquals(listOf("04:33", "05:56", "11:42", "14:59", "17:26"), hhmm(hanoi, hanoiZone).take(5))
        // Makkah, Sat 24 Oct 2026, Umm al-Qura (iOS 1d-today-light-daytime).
        val riyadh = ZoneId.of("Asia/Riyadh")
        val makkah = PrayerEngine.compute(2026, 10, 24, Geo.kaaba, CalculationMethod.UMM_AL_QURA, AsrSchool.STANDARD)
        assertEquals(listOf("05:04", "06:20", "12:05", "15:23", "17:50", "19:20"), hhmm(makkah, riyadh))
    }

    @Test fun timesAreChronological() {
        val tokyo = Coordinates(35.6762, 139.6503)
        for (method in CalculationMethod.all) {
            val day = PrayerEngine.compute(2026, 6, 21, tokyo, method, AsrSchool.HANAFI)
            val times = day.ordered.map { it.second }
            assertEquals("${method.id} out of order", times.sorted(), times)
        }
    }

    @Test fun hanafiAsrIsLater() {
        val standard = PrayerEngine.compute(2026, 3, 1, singapore, CalculationMethod.MUIS, AsrSchool.STANDARD)
        val hanafi = PrayerEngine.compute(2026, 3, 1, singapore, CalculationMethod.MUIS, AsrSchool.HANAFI)
        assertTrue(hanafi.time(Prayer.ASR) > standard.time(Prayer.ASR).plusSeconds(30 * 60))
    }

    @Test fun ummAlQuraRamadanIshaInterval() {
        val makkah = Coordinates(21.4225, 39.8262)
        val normal = PrayerEngine.compute(2026, 5, 1, makkah, CalculationMethod.UMM_AL_QURA, AsrSchool.STANDARD)
        val ramadan = PrayerEngine.compute(2026, 5, 1, makkah, CalculationMethod.UMM_AL_QURA, AsrSchool.STANDARD, isRamadan = true)
        assertEquals(90.0 * 60, normal.time(Prayer.ISHA).secondsSince(normal.time(Prayer.MAGHRIB)), 60.0)
        assertEquals(120.0 * 60, ramadan.time(Prayer.ISHA).secondsSince(ramadan.time(Prayer.MAGHRIB)), 60.0)
    }

    @Test fun qiblaFromPasirRis() {
        // prayertime.sg shows 293° for Pasir Ris.
        val pasirRis = Coordinates(1.3721, 103.9474)
        assertEquals(293.0, Geo.qiblaBearing(pasirRis), 0.5)
        assertEquals(7282.0, Geo.distanceKm(pasirRis, Geo.kaaba), 15.0)
        assertEquals("WNW", Geo.compassPoint(Geo.qiblaBearing(pasirRis)))
    }

    @Test fun everyAsianProfileHasAKnownMethod() {
        for (profile in AsiaRegions.profiles) {
            assertTrue(profile.code, CalculationMethod.withId(profile.methodId) != null)
        }
        assertEquals("sea", AsiaRegions.profile("vn")?.method?.id)
        assertEquals("jakim", AsiaRegions.profile("MY")?.method?.id)
        assertEquals("VN", AsiaRegions.countryCode("Asia/Ho_Chi_Minh"))
        assertEquals("🇸🇬", AsiaRegions.profile("SG")?.flag)
    }

    @Test fun musafirStatus() {
        val rules = Musafir.Rules(AsrSchool.STANDARD, 81.0)
        val hanoi = Coordinates(21.0278, 105.8342)
        assertEquals(Musafir.Status.Home, Musafir.status(singapore, singapore, 0, rules))
        assertTrue(Musafir.status(singapore, hanoi, 1, rules)!!.isTraveller)
        assertTrue("a 5-day stay should end the concession under Shafi'i rules",
            Musafir.status(singapore, hanoi, 5, rules) is Musafir.Status.Settled)
        assertNull(Musafir.status(null, hanoi, 0, rules))
    }

    @Test fun hijriMonthNames() {
        // prayertime.sg: 21 Oct 2026 = 10 Jamadilawal 1448.
        val date = ZonedDateTime.of(2026, 10, 21, 12, 0, 0, 0, sgt).toInstant()
        assertEquals("10 Jamadilawal 1448", Hijri.format(date, sgt, NamingStyle.MALAY))
        assertEquals("10 Jumada al-Ula 1448", Hijri.format(date, sgt, NamingStyle.INTERNATIONAL))
        // The ±day adjustment for sighting-based calendars.
        assertEquals("11 Jamadilawal 1448", Hijri.format(date, sgt, NamingStyle.MALAY, adjustment = 1))
    }

    @Test fun hijriAgreesWithJavaUmmAlQuraForAWholeCentury() {
        var d = LocalDate.of(1950, 1, 1)
        while (d.year < 2075) {
            val ours = Hijri.fromLocalDate(d)
            val jh = java.time.chrono.HijrahDate.from(d)
            assertEquals("$d", jh.get(java.time.temporal.ChronoField.YEAR), ours.year)
            assertEquals("$d", jh.get(java.time.temporal.ChronoField.MONTH_OF_YEAR), ours.month)
            assertEquals("$d", jh.get(java.time.temporal.ChronoField.DAY_OF_MONTH), ours.day)
            assertEquals(d, Hijri.toLocalDate(ours.year, ours.month, ours.day))
            d = d.plusDays(1)
        }
    }

    @Test fun sunAltitudeAtKeyMoments() {
        val day = PrayerEngine.compute(2026, 10, 21, singapore, CalculationMethod.MUIS, AsrSchool.STANDARD)
        // Sunrise is when the sun's upper limb clears the horizon (about -0.83°).
        assertEquals(-0.83, Astro.sunAltitude(day.time(Prayer.SUNRISE).minusSeconds(60), singapore), 0.6)
        assertTrue(Astro.sunAltitude(day.time(Prayer.DHUHR), singapore) > 70)
        // Subuh begins with the sun 20° below the horizon (MUIS).
        assertEquals(-20.0, Astro.sunAltitude(day.time(Prayer.FAJR), singapore), 0.5)
    }

    @Test fun wakeUpTimings() {
        val day = PrayerEngine.compute(2026, 10, 21, singapore, CalculationMethod.MUIS, AsrSchool.STANDARD)
        assertEquals(day.time(Prayer.FAJR), WakeUpTiming.AT_FAJR.date(day))
        assertEquals(day.time(Prayer.SUNRISE).minusSeconds(1800), WakeUpTiming.SUNRISE_MINUS_30.date(day))
        assertEquals("15 min before Syuruk", WakeUpTiming.SUNRISE_MINUS_15.label(NamingStyle.MALAY))
    }

    @Test fun oldPreferencesStillDecode() {
        // A blob saved before newer fields existed must keep its values.
        val prefs = Preferences.decode("""{"hasOnboarded":true,"use24Hour":true,"musafirThresholdKm":89,"someFutureField":1}""")
        assertTrue(prefs.hasOnboarded)
        assertTrue(prefs.use24Hour)
        assertEquals(89.0, prefs.musafirThresholdKm, 0.0)
        assertTrue(!prefs.trackerEnabled)
        assertNull(prefs.wakeUp)
        // Round trip.
        assertEquals(prefs, Preferences.decode(prefs.encode()))
        // Garbage gives defaults rather than a crash.
        assertEquals(Preferences(), Preferences.decode("not json"))
    }

    @Test fun formats() {
        assertEquals("9h 22m", TimeFormat.short(9 * 3600 + 21 * 60 + 5.0))
        assertEquals("22m", TimeFormat.short(21 * 60 + 1.0))
        assertEquals("45s", TimeFormat.short(45.0))
        assertEquals("1:05:09", TimeFormat.countdown(3909.0))
        val t = ZonedDateTime.of(2026, 10, 21, 17, 5, 0, 0, sgt).toInstant()
        assertEquals("5:05" to "PM", TimeFormat.parts(t, sgt, false))
        assertEquals("17:05" to null, TimeFormat.parts(t, sgt, true))
    }
}
