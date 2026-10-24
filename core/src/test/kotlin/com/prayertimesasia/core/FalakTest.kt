package com.prayertimesasia.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import kotlin.math.abs

/** Falak Mode. Expected values from the iOS FalakTests (tools/falak_reference.py, published Qibla Day times). */
class FalakTest {
    private val singapore = Coordinates(1.3521, 103.8198)
    private val sgt = ZoneId.of("Asia/Singapore")

    private fun utc(y: Int, mo: Int, d: Int, h: Int, mi: Int, s: Int): Instant = ZonedDateTime.of(y, mo, d, h, mi, s, 0, ZoneOffset.UTC).toInstant()
    private fun sg(h: Int, mi: Int, s: Int = 0): Instant = ZonedDateTime.of(2026, 10, 22, h, mi, s, 0, sgt).toInstant()

    @Test fun qiblaDays() {
        val days2026 = Falak.qiblaDays(2026)
        assertEquals(2, days2026.size)
        assertEquals(0.0, days2026[0].secondsSince(utc(2026, 5, 28, 9, 17, 59)), 30.0)
        assertEquals(0.0, days2026[1].secondsSince(utc(2026, 7, 15, 9, 26, 42)), 30.0)
        val days2027 = Falak.qiblaDays(2027)
        assertEquals(0.0, days2027[0].secondsSince(utc(2027, 5, 28, 9, 17, 57)), 30.0)
        assertEquals(0.0, days2027[1].secondsSince(utc(2027, 7, 16, 9, 26, 46)), 30.0)
        // At that instant the sun is overhead in Makkah.
        assertTrue(Falak.sunPosition(days2027[0], Geo.kaaba).altitude > 89.8)
    }

    @Test fun nextQiblaDayRollsOver() {
        assertEquals(0.0, Falak.nextQiblaDay(utc(2026, 10, 22, 0, 0, 0)).secondsSince(utc(2027, 5, 28, 9, 17, 57)), 30.0)
        assertEquals(0.0, Falak.nextQiblaDay(utc(2026, 6, 1, 0, 0, 0)).secondsSince(utc(2026, 7, 15, 9, 26, 42)), 30.0)
    }

    @Test fun rashdulQiblatSingapore() {
        val hits = Falak.rashdulQiblat(2026, 10, 22, sgt, singapore)
        assertEquals(1, hits.size)
        assertEquals(Falak.Alignment.Kind.SUN_OPPOSITE, hits[0].kind)
        assertEquals(0.0, hits[0].time.secondsSince(sg(10, 48)), 60.0)
        // The sun really is opposite the qibla then.
        val sun = Falak.sunPosition(hits[0].time, singapore)
        assertEquals(0.0, abs(Geo.angleDelta(sun.azimuth + 180, Geo.qiblaBearing(singapore))), 0.1)
    }

    @Test fun shadowDayMatchesEngine() {
        val plan = Falak.shadowDay(2026, 10, 22, singapore)
        assertEquals(0.0, plan.noon.secondsSince(sg(12, 49, 13)), 5.0)
        assertEquals(22.0, plan.noonShadow(100.0), 0.2)
        assertEquals(122.0, plan.asrShadow(100.0, AsrSchool.STANDARD), 0.2)
        assertEquals(222.0, plan.asrShadow(100.0, AsrSchool.HANAFI), 0.2)
        assertEquals("N", Geo.compassPoint(plan.noonShadowBearing)) // sun is south of Singapore in October
        val asr = plan.asrShafii
        assertNotNull(asr)
        assertEquals(0.0, asr!!.secondsSince(sg(16, 6, 53)), 10.0)
        // The shadow-stick Asr is the engine's Asr before ihtiyat: MUIS rounds up after +0.5 min.
        val muis = PrayerEngine.compute(2026, 10, 22, singapore, CalculationMethod.MUIS, AsrSchool.STANDARD)
        assertEquals(1.0, muis.time(Prayer.ASR).secondsSince(asr) / 60, 1.0)
    }

    @Test fun readingRoundTrip() {
        val clock = sg(15, 30)
        val sun = Falak.sunPosition(clock, singapore)
        val shadow = Falak.shadowLength(100.0, sun.altitude)
        val r = Falak.reading(100.0, shadow, clock, singapore, sgt, AsrSchool.STANDARD)!!
        assertTrue(r.afternoon)
        assertEquals(0.0, r.offsetMinutes!!, 0.2)
        assertEquals(false, r.asrReached)
        assertTrue(r.uncertaintyMinutes!! < 3)

        // A shadow 10 cm longer reads later; long enough, Asr has begun.
        val later = Falak.reading(100.0, shadow + 10, clock, singapore, sgt, AsrSchool.STANDARD)!!
        assertTrue(later.offsetMinutes!! > 2)
        val asr = Falak.reading(100.0, 130.0, sg(16, 20), singapore, sgt, AsrSchool.STANDARD)!!
        assertEquals(true, asr.asrReached)
    }

    @Test fun falakIsTheLastGrade() {
        assertEquals("F", SourceGrade.FALAK.code)
        assertEquals(SourceGrade.FALAK, CoreJson.decodeFromString(SourceGrade.serializer(), "\"F\""))
    }

    @Test fun blessedTimes() {
        val today = PrayerEngine.compute(2026, 10, 22, singapore, CalculationMethod.MUIS, AsrSchool.STANDARD)
        val tomorrow = PrayerEngine.compute(2026, 10, 23, singapore, CalculationMethod.MUIS, AsrSchool.STANDARD)
        val times = BlessedTime.compute(today, tomorrow, singapore, isRamadan = false)
        assertEquals(listOf(BlessedTime.DHUHA, BlessedTime.MIDNIGHT, BlessedTime.LAST_THIRD), times.map { it.first })
        val afterSunrise = times[0].second.secondsSince(today.time(Prayer.SUNRISE)) / 60
        assertTrue("Dhuha $afterSunrise min after sunrise", afterSunrise in 15.0..30.0)
        val night = tomorrow.time(Prayer.FAJR).secondsSince(today.time(Prayer.MAGHRIB))
        assertEquals(night / 2, times[1].second.secondsSince(today.time(Prayer.MAGHRIB)), 60.0)
        assertEquals(night * 2 / 3, times[2].second.secondsSince(today.time(Prayer.MAGHRIB)), 60.0)
        val ramadan = BlessedTime.compute(today, tomorrow, singapore, isRamadan = true)
        assertEquals(today.time(Prayer.FAJR).minusSeconds(600), ramadan.first().second)
    }
}
