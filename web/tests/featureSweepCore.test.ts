import { describe, expect, it } from 'vitest'
import { angleDelta, bearing, compassPoint, distanceKm, KAABA, qiblaBearing } from '../src/core/geo'
import { dayKey, daysBetween, isValidTimeZone, noonDaysAfter, offsetMinutes, startOfDay, zonedTime } from '../src/core/tz'
import { gregorianFromHijri, hijriDate, isRamadan } from '../src/core/hijri'
import { islamicDaysOf } from '../src/core/islamicDays'
import { leaveSpan, snapLeaveMinutes } from '../src/core/jumuahLeave'
import { currentEid, eidAt, nameKey, EID_SAMPLE } from '../src/core/eid'

describe('Qibla and distance', () => {
  it('points the right way from well known cities', () => {
    expect(qiblaBearing({ latitude: 1.3521, longitude: 103.8198 })).toBeCloseTo(293, 0) // Singapore
    expect(qiblaBearing({ latitude: 51.5074, longitude: -0.1278 })).toBeCloseTo(118.9, 0) // London
    expect(qiblaBearing({ latitude: 40.7128, longitude: -74.006 })).toBeCloseTo(58.5, 0) // New York
    expect(qiblaBearing({ latitude: -33.8688, longitude: 151.2093 })).toBeCloseTo(277, 0) // Sydney
  })
  it('stays between 0 and 360 across the date line and at the poles', () => {
    for (const [lat, lng] of [[0, 179.9], [0, -179.9], [89.9, 0], [-89.9, 100], [21.4225, 39.8262]]) {
      const b = qiblaBearing({ latitude: lat, longitude: lng })
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(360)
      expect(Number.isFinite(b)).toBe(true)
    }
  })
  it('measures distance in km, zero at the Kaaba, and the same both ways', () => {
    const sg = { latitude: 1.3521, longitude: 103.8198 }
    expect(distanceKm(KAABA, KAABA)).toBe(0)
    expect(distanceKm(sg, KAABA)).toBeGreaterThan(7200)
    expect(distanceKm(sg, KAABA)).toBeLessThan(7350)
    expect(distanceKm(sg, KAABA)).toBeCloseTo(distanceKm(KAABA, sg), 6)
    expect(bearing({ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 0 })).toBeCloseTo(0, 6)
  })
  it('names compass points and finds the short way round', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(359)).toBe('N')
    expect(compassPoint(293)).toBe('WNW')
    expect(compassPoint(-90)).toBe('W')
    expect(angleDelta(350, 10)).toBe(-20)
    expect(angleDelta(10, 350)).toBe(20)
    expect(angleDelta(180, 0)).toBe(180)
  })
})

describe('time zones and the clock change', () => {
  const NY = 'America/New_York'
  it('knows Singapore has no clock change and valid zone names', () => {
    expect(offsetMinutes(Date.UTC(2026, 0, 1), 'Asia/Singapore')).toBe(480)
    expect(offsetMinutes(Date.UTC(2026, 6, 1), 'Asia/Singapore')).toBe(480)
    expect(isValidTimeZone('Asia/Singapore')).toBe(true)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
  })
  it('handles the day the clocks go forward (23 hours) and back (25 hours)', () => {
    const springStart = zonedTime(2026, 3, 8, 0, 0, 0, NY)
    const springNext = zonedTime(2026, 3, 9, 0, 0, 0, NY)
    expect((springNext - springStart) / 3_600_000).toBe(23)
    const fallStart = zonedTime(2026, 11, 1, 0, 0, 0, NY)
    const fallNext = zonedTime(2026, 11, 2, 0, 0, 0, NY)
    expect((fallNext - fallStart) / 3_600_000).toBe(25)
    expect(startOfDay(springStart + 12 * 3_600_000, NY)).toBe(springStart)
  })
  it('steps by whole days without skipping or repeating one', () => {
    let t = zonedTime(2026, 3, 6, 12, 0, 0, NY)
    const keys: string[] = []
    for (let i = 0; i < 5; i++) { keys.push(dayKey(t, NY)); t = noonDaysAfter(t, 1, NY) }
    expect(keys).toEqual(['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
    expect(daysBetween(zonedTime(2026, 3, 7, 23, 0, 0, NY), zonedTime(2026, 3, 9, 1, 0, 0, NY), NY)).toBe(2)
  })
  it('changes the date at local midnight, not at midnight UTC', () => {
    const justBefore = zonedTime(2026, 5, 10, 23, 59, 59, 'Asia/Singapore')
    expect(dayKey(justBefore, 'Asia/Singapore')).toBe('2026-05-10')
    expect(dayKey(justBefore + 1000, 'Asia/Singapore')).toBe('2026-05-11')
    expect(dayKey(justBefore, 'UTC')).toBe('2026-05-10')
  })
})

describe('Hijri date', () => {
  it('finds the Gregorian day of a Hijri day and back again', () => {
    const g = gregorianFromHijri(1448, 9, 1)
    expect(g).not.toBeNull()
    const ms = Date.UTC(g!.year, g!.month - 1, g!.day, 12)
    expect(hijriDate(ms, 'UTC')).toMatchObject({ year: 1448, month: 9, day: 1 })
    expect(isRamadan(ms, 'UTC')).toBe(true)
  })
  it('lets the user move the date a day either way', () => {
    const ms = Date.UTC(2027, 1, 10, 12)
    const base = hijriDate(ms, 'UTC')
    const next = hijriDate(ms, 'UTC', 1)
    const prev = hijriDate(ms, 'UTC', -1)
    expect(next.day === base.day + 1 || next.day === 1).toBe(true)
    expect(prev.day === base.day - 1 || prev.day >= 29).toBe(true)
  })
})

describe('special Islamic days', () => {
  const on = (month: number, day: number) => islamicDaysOf({ year: 1448, month, day }).map((d) => d.kind)
  it('marks the main days', () => {
    expect(on(1, 10)).toEqual(['ashura'])
    expect(on(9, 1)).toEqual(['ramadanStart'])
    expect(on(10, 1)).toEqual(['aidilfitri'])
    expect(on(12, 10)).toEqual(['aidiladha'])
    expect(on(12, 9)).toEqual(['arafah'])
  })
  it('marks the last ten nights and the first ten days as minor, and an ordinary day as nothing', () => {
    expect(on(9, 25)).toEqual(['lastTen'])
    expect(on(9, 29)).toEqual(['lastTen', 'sightingSyawal'])
    expect(on(12, 3)).toEqual(['zulhijjahTen'])
    expect(on(5, 5)).toEqual([])
    expect(islamicDaysOf({ year: 1448, month: 9, day: 25 })[0].major).toBe(false)
  })
})

describe('Jumaat leave reminder choices', () => {
  it('keeps listed choices, moves 20 up to 30 and turns anything else off', () => {
    expect(snapLeaveMinutes(60)).toBe(60)
    expect(snapLeaveMinutes(20)).toBe(30)
    expect(snapLeaveMinutes(7)).toBe(0)
    expect(snapLeaveMinutes('60')).toBe(0)
    expect(snapLeaveMinutes(null)).toBe(0)
    expect(snapLeaveMinutes(undefined)).toBe(0)
  })
  it('says the time in plain words in each language', () => {
    expect(leaveSpan(15, 'en')).toBe('15 min')
    expect(leaveSpan(60, 'en')).toBe('1 hour')
    expect(leaveSpan(90, 'en')).toBe('1 hour 30 min')
    expect(leaveSpan(180, 'en')).toBe('3 hours')
    expect(leaveSpan(90, 'ms')).toBe('1 jam 30 minit')
    expect(leaveSpan(90, 'id')).toBe('1 jam 30 menit')
  })
})

describe('Eid lookup', () => {
  it('matches a masjid name however it is written', () => {
    expect(nameKey('Masjid Al-Ansar')).toBe('alansar')
    expect(nameKey('Al-Ansar Mosque')).toBe('alansar')
    expect(nameKey('Al Ansar')).toBe('alansar')
  })
  it('shows nothing when no Eid is close, and finds a place by name or by spot', () => {
    expect(currentEid('2000-01-01')).toBeNull()
    const first = EID_SAMPLE.mosques[0]
    expect(eidAt(EID_SAMPLE, first.name, { latitude: 0, longitude: 0 })).toBe(first)
    expect(eidAt(EID_SAMPLE, 'No such place', { latitude: -80, longitude: 0 })).toBeNull()
    expect(currentEid('2000-01-01', true)).toBe(EID_SAMPLE)
  })
})
