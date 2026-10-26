package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale

class NamingAndSanadTest {
    private val sgt = ZoneId.of("Asia/Singapore")

    @Test fun personalNamesComeFromHomeThenPhone() {
        val english = Locale("en", "AU")
        assertEquals(NamingStyle.MALAY, NamingStyle.personal("SG", english))
        assertEquals(NamingStyle.INDONESIAN, NamingStyle.personal("ID", english))
        assertEquals(NamingStyle.TURKISH, NamingStyle.personal("TR", english))
        assertEquals(NamingStyle.INTERNATIONAL, NamingStyle.personal(null, english))
        assertEquals(NamingStyle.MALAY, NamingStyle.personal(null, Locale("ms", "MY")))
        assertEquals(NamingStyle.SOUTH_ASIAN, NamingStyle.personal(null, Locale("en", "PK")))
        assertEquals(NamingStyle.INDONESIAN, NamingStyle.personal("AU", Locale("id", "ID")))
        // Android reports Indonesian with the old code "in".
        assertEquals(NamingStyle.INDONESIAN, NamingStyle.personal(null, "in", "ID"))
    }

    @Test fun authoritySpellings() {
        assertEquals("Zohor", Prayer.DHUHR.name(NamingStyle.MALAY))       // MUIS / JAKIM
        assertEquals("Dzuhur", Prayer.DHUHR.name(NamingStyle.INDONESIAN)) // Kemenag
        assertEquals("Fajr", Prayer.FAJR.name(NamingStyle.INTERNATIONAL))
        assertEquals("Cuma", Prayer.DHUHR.name(NamingStyle.TURKISH, isFriday = true))
    }

    @Test fun oldSavedChoiceStillDecodes() {
        // Earlier builds saved the international style as "arabic".
        assertEquals(NamingStyle.INTERNATIONAL, CoreJson.decodeFromString(NamingStyle.serializer(), "\"arabic\""))
    }

    @Test fun ummAlQuraEstimates1448() {
        // Umm al-Qura table values (cross-checked with the hijridate package).
        assertEquals(LocalDate.of(2027, 2, 8), CalendarSanad.expected(HijriEvent.RAMADAN, 1448))
        assertEquals(LocalDate.of(2027, 3, 9), CalendarSanad.expected(HijriEvent.SYAWAL, 1448))
        assertEquals(LocalDate.of(2027, 5, 16), CalendarSanad.expected(HijriEvent.ADHA, 1448))
        assertEquals(LocalDate.of(2027, 6, 6), CalendarSanad.expected(HijriEvent.MUHARRAM, 1449))
    }

    @Test fun upcomingOrder() {
        val oct22 = ZonedDateTime.of(2026, 10, 22, 12, 0, 0, 0, sgt).toInstant()
        val next = CalendarSanad.upcoming(oct22, sgt)
        assertEquals(listOf(HijriEvent.RAMADAN, HijriEvent.SYAWAL, HijriEvent.ADHA, HijriEvent.MUHARRAM), next.map { it.event })
        assertEquals(listOf(1448, 1448, 1448, 1449), next.map { it.hijriYear })
    }

    @Test fun decodesAnnouncement() {
        val json = """
        {"version":1,"licence":"CC-BY-4.0","announcements":[
          {"event":"1_ramadan","hijri_year":1448,"authority":"MUIS","country":"SG","date":"2027-02-08",
           "status":"announced","basis":"hisab","source_url":"https://example.org","announced_at":"2027-02-07T20:00:00+08:00"}]}
        """
        val a = CalendarDataset.decode(json).announcements.first()
        assertEquals(HijriEvent.RAMADAN, a.event)
        assertEquals(CalendarAnnouncement.Status.ANNOUNCED, a.status)
        assertEquals(LocalDate.of(2027, 2, 8), a.gregorian)
        assertEquals("calculation", a.basisLabel)
        assertEquals("MUIS", CalendarSanad.defaultAuthority("SG"))
    }

    @Test fun disagreementsOverTwoMinutesOnly() {
        val sg = Coordinates(1.3521, 103.8198)
        val muis = PrayerEngine.compute(2026, 10, 22, sg, CalculationMethod.MUIS, AsrSchool.STANDARD)
        val times = muis.times.toMutableMap()
        times[Prayer.FAJR] = muis.time(Prayer.FAJR).plusSeconds(3 * 60)  // 3 min: shown
        times[Prayer.ISHA] = muis.time(Prayer.ISHA).plusSeconds(2 * 60)  // 2 min: not shown
        val other = PrayerDay(muis.year, muis.month, muis.day, times)
        assertEquals(setOf(Prayer.FAJR), Resolver.disagreements(muis, other).keys)
    }

    private val mosqueJson = """
    {"version":1,"licence":"CC-BY-4.0","mosques":[
      {"id":"test-hcm","name":"Test Masjid","lat":10.7626,"lng":106.6957,"country":"VN","radiusKm":3,
       "fingerprint":{"fajrAngle":18,"ishaAngle":17,"ishaInterval":null,"asrFactor":1,
                      "offsets":{"fajr":2,"dhuhr":2,"asr":2,"maghrib":2,"isha":2}},
       "jamaah":{"fajr":{"afterMinutes":20},"dhuhr":{"fixed":"13:00"},"isha":{"beforeSunriseMinutes":null,"afterMinutes":15}},
       "jumuah":"13:15","source":"unit test","verifiedAt":"2026-10-22","grade":"B"}
    ]}
    """

    @Test fun mosqueResolvesWithinRadiusOnly() {
        val data = MosqueDataset.decode(mosqueJson)
        assertEquals("test-hcm", data.profile(Coordinates(10.77, 106.70))?.id)
        assertNull(data.profile(Coordinates(21.03, 105.85))) // Hanoi
    }

    @Test fun mosqueFingerprintAndJamaah() {
        val mosque = MosqueDataset.decode(mosqueJson).mosques[0]
        val method = mosque.method!!
        assertEquals(18.0, method.fajrAngle, 0.0)
        assertEquals(2.0, method.offsets[Prayer.MAGHRIB]!!, 0.0)
        val tz = ZoneId.of("Asia/Ho_Chi_Minh")
        val day = PrayerEngine.compute(2026, 10, 21, mosque.coordinates, method, AsrSchool.STANDARD)
        val jamaah = mosque.jamaahTimes(day, tz, isFriday = false)
        assertEquals(day.time(Prayer.FAJR).plusSeconds(20 * 60), jamaah[Prayer.FAJR])
        assertEquals(day.time(Prayer.ISHA).plusSeconds(15 * 60), jamaah[Prayer.ISHA])
        assertEquals("13:00", TimeFormat.formatted(jamaah[Prayer.DHUHR]!!, tz, true))
        val friday = mosque.jamaahTimes(day, tz, isFriday = true)
        assertEquals("13:15", TimeFormat.formatted(friday[Prayer.DHUHR]!!, tz, true))
        assertNull(jamaah[Prayer.ASR])
    }

    @Test fun resolverPrefersTheOfficialTableAndKeepsHanafiAsr() {
        val pasirRis = Place(name = "Pasir Ris", countryCode = "SG", countryName = "Singapore",
            timeZoneId = "Asia/Singapore", coordinates = Coordinates(1.3721, 103.9474))
        val prefs = Preferences(useGPS = false, manualPlace = pasirRis, home = pasirRis)
        val table = mapOf(Prayer.FAJR to "05:28", Prayer.SUNRISE to "06:47", Prayer.DHUHR to "12:50",
            Prayer.ASR to "16:08", Prayer.MAGHRIB to "18:52", Prayer.ISHA to "20:02")
        val r = Resolver(prefs, officialTimes = { s, y, m, d -> if (s == OfficialSource.Muis && y == 2026 && m == 10 && d == 25) table else null })
        val now = ZonedDateTime.of(2026, 10, 25, 20, 49, 0, 0, sgt).toInstant()
        val day = r.day(now)!!
        assertEquals(SourceGrade.OFFICIAL, day.grade)
        assertEquals("MUIS official timetable", day.officialSource)
        assertEquals("8:02 PM", r.formatted(day.time(Prayer.ISHA)))
        assertEquals(Prayer.ISHA, r.current(now)!!.first)
        assertEquals(Prayer.FAJR, r.next(now)!!.first)
        assertEquals(NamingStyle.MALAY, r.naming)
        assertEquals("14 Jamadilawal 1448", r.hijri(now))
        // Without a table (offline) it falls back to the calibrated calculation.
        val offline = Resolver(prefs).day(now)!!
        assertEquals(SourceGrade.CALCULATED, offline.grade)
        // Hanafi keeps the calculated Asr even with the official table.
        val hanafi = Resolver(prefs.copy(asrOverride = AsrSchool.HANAFI), officialTimes = { _, _, _, _ -> table }).day(now)!!
        assertTrue(hanafi.time(Prayer.ASR) > day.time(Prayer.ASR).plusSeconds(30 * 60))
    }

    @Test fun visitorSeesTheirOwnNamesAndTheLocalWord() {
        val sydney = Place(name = "Sydney", countryCode = "AU", timeZoneId = "Australia/Sydney", coordinates = Coordinates(-33.8688, 151.2093))
        val kl = Place(name = "Kuala Lumpur", countryCode = "MY", timeZoneId = "Asia/Kuala_Lumpur", coordinates = Coordinates(3.139, 101.6869))
        val r = Resolver(Preferences(useGPS = false, manualPlace = kl, home = sydney), locale = Locale("en", "AU"))
        val day = r.day(ZonedDateTime.of(2026, 10, 25, 12, 0, 0, 0, ZoneId.of("Asia/Kuala_Lumpur")).toInstant())!!
        assertEquals(NamingStyle.INTERNATIONAL, r.naming)
        assertEquals("Subuh", r.localName(Prayer.FAJR, day.time(Prayer.FAJR)))
        assertNull(r.localName(Prayer.MAGHRIB, day.time(Prayer.MAGHRIB)))
    }
}
