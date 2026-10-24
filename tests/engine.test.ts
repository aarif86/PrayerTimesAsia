import { describe, expect, it } from 'vitest'
import { sunAltitude } from '../src/core/astro'
import { compute, ordered, type Coordinates } from '../src/core/engine'
import { distanceKm, KAABA, qiblaBearing } from '../src/core/geo'
import { formatHijri, hijriDate } from '../src/core/hijri'
import { ALL_METHODS, METHODS, methodWithId, type CalculationMethod } from '../src/core/methods'
import { musafirStatus } from '../src/core/musafir'
import { PRAYERS } from '../src/core/prayer'
import { countryForTimeZone, flag, PROFILES, profileFor, profileMethod } from '../src/core/regions'
import { zoned, zonedTime } from '../src/core/tz'

/**
 * Reference days copied from official timetables (same cases as the iOS
 * PrayerEngineTests). The offline calculation must never be earlier than the
 * official time: prayers 0-2 minutes later, sunrise 0-1 minute earlier.
 */
const singapore: Coordinates = { latitude: 1.3521, longitude: 103.8198 }
const kualaLumpur: Coordinates = { latitude: 3.1472, longitude: 101.6894 }
const SGT = 'Asia/Singapore'

const minutesOfDay = (ms: number) => { const z = zoned(ms, SGT); return z.hour * 60 + z.minute }

interface Case { method: CalculationMethod; date: [number, number, number]; c: Coordinates; official: string[] }

const cases: Case[] = [
  // MUIS 2026 timetable (data.gov.sg) and prayertime.sg for 21 Oct.
  { method: METHODS.muis, date: [2026, 1, 1], c: singapore, official: ['05:44', '07:08', '13:10', '16:34', '19:11', '20:25'] },
  { method: METHODS.muis, date: [2026, 8, 1], c: singapore, official: ['05:46', '07:06', '13:13', '16:34', '19:17', '20:29'] },
  { method: METHODS.muis, date: [2026, 10, 21], c: singapore, official: ['05:29', '06:47', '12:51', '16:07', '18:52', '20:02'] },
  // JAKIM e-Solat, zone WLY01 (Kuala Lumpur).
  { method: METHODS.jakim, date: [2026, 1, 1], c: kualaLumpur, official: ['06:06', '07:18', '13:19', '16:42', '19:17', '20:31'] },
]

describe('PrayerEngine', () => {
  for (const c of cases) {
    it(`is never earlier than the official ${c.method.shortName} table on ${c.date.join('-')}`, () => {
      const day = compute(c.date[0], c.date[1], c.date[2], c.c, c.method, 'standard')
      PRAYERS.forEach((prayer, i) => {
        const [h, m] = c.official[i].split(':').map(Number)
        const diff = minutesOfDay(day.times[prayer]) - (h * 60 + m)
        if (prayer === 'sunrise') expect(diff, `${prayer}: ${diff} min off`).toBeGreaterThanOrEqual(-1)
        else expect(diff, `${prayer}: ${diff} min off`).toBeGreaterThanOrEqual(0)
        expect(diff, `${prayer}: ${diff} min off`).toBeLessThanOrEqual(prayer === 'sunrise' ? 0 : 2)
      })
    })
  }

  it('gives Singapore 21 Oct 2026 exactly as the iOS app (MUIS method)', () => {
    const day = compute(2026, 10, 21, singapore, METHODS.muis, 'standard')
    const got = PRAYERS.map((p) => { const z = zoned(day.times[p], SGT); return `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}` })
    // Same as tools/reference_engine.py (the iOS Python port); pinned so any change is noticed.
    expect(got).toEqual(['05:30', '06:47', '12:51', '16:08', '18:53', '20:03'])
  })

  it('keeps times chronological for every method (Tokyo, midsummer, Hanafi)', () => {
    const tokyo = { latitude: 35.6762, longitude: 139.6503 }
    for (const method of ALL_METHODS) {
      const day = compute(2026, 6, 21, tokyo, method, 'hanafi')
      const times = ordered(day).map((x) => x.time)
      expect([...times].sort((a, b) => a - b), method.id).toEqual(times)
    }
  })

  it('puts Hanafi Asr more than 30 minutes later', () => {
    const standard = compute(2026, 3, 1, singapore, METHODS.muis, 'standard')
    const hanafi = compute(2026, 3, 1, singapore, METHODS.muis, 'hanafi')
    expect(hanafi.times.asr).toBeGreaterThan(standard.times.asr + 30 * 60_000)
  })

  it('uses the Umm al-Qura Isha interval, 120 minutes in Ramadan', () => {
    const makkah = { latitude: 21.4225, longitude: 39.8262 }
    const normal = compute(2026, 5, 1, makkah, METHODS.ummalqura, 'standard')
    const ramadan = compute(2026, 5, 1, makkah, METHODS.ummalqura, 'standard', true)
    expect(Math.abs(normal.times.isha - normal.times.maghrib - 90 * 60_000)).toBeLessThanOrEqual(60_000)
    expect(Math.abs(ramadan.times.isha - ramadan.times.maghrib - 120 * 60_000)).toBeLessThanOrEqual(60_000)
  })

  it('has the sun where the times say it is', () => {
    const day = compute(2026, 10, 21, singapore, METHODS.muis, 'standard')
    expect(Math.abs(sunAltitude(day.times.sunrise - 60_000, singapore.latitude, singapore.longitude) - -0.83)).toBeLessThanOrEqual(0.6)
    expect(sunAltitude(day.times.dhuhr, singapore.latitude, singapore.longitude)).toBeGreaterThan(70)
    expect(Math.abs(sunAltitude(day.times.fajr, singapore.latitude, singapore.longitude) - -20)).toBeLessThanOrEqual(0.5)
  })
})

describe('Qibla and distance', () => {
  it('matches prayertime.sg for Pasir Ris (293°, ~7282 km)', () => {
    const pasirRis = { latitude: 1.3721, longitude: 103.9474 }
    expect(Math.abs(qiblaBearing(pasirRis) - 293)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(distanceKm(pasirRis, KAABA) - 7282)).toBeLessThanOrEqual(15)
  })
})

describe('Regions', () => {
  it('has a known method for every Asian profile', () => {
    for (const p of PROFILES) expect(methodWithId(p.methodID), p.code).toBeDefined()
    expect(profileMethod(profileFor('vn')!).id).toBe('sea')
    expect(profileMethod(profileFor('MY')!).id).toBe('jakim')
    expect(countryForTimeZone('Asia/Ho_Chi_Minh')).toBe('VN')
    expect(flag('SG')).toBe('🇸🇬')
  })
})

describe('Musafir', () => {
  it('follows the Shafi\'i rules', () => {
    const rules = { school: 'standard' as const, thresholdKm: 81 }
    const hanoi = { latitude: 21.0278, longitude: 105.8342 }
    expect(musafirStatus(singapore, singapore, 0, rules)).toEqual({ kind: 'home' })
    expect(musafirStatus(singapore, hanoi, 1, rules)?.kind).toBe('traveller')
    expect(musafirStatus(singapore, hanoi, 5, rules)?.kind).toBe('settled')
    expect(musafirStatus(null, hanoi, 0, rules)).toBeNull()
  })
})

describe('Hijri', () => {
  it('matches prayertime.sg: 21 Oct 2026 = 10 Jamadilawal 1448', () => {
    const noon = zonedTime(2026, 10, 21, 12, 0, 0, SGT)
    expect(formatHijri(noon, SGT, 'malay')).toBe('10 Jamadilawal 1448')
    expect(hijriDate(noon, SGT)).toEqual({ day: 10, month: 5, year: 1448 })
    expect(formatHijri(noon, SGT, 'malay', 1)).toBe('11 Jamadilawal 1448')
  })
})
