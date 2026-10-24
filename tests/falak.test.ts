import { describe, expect, it } from 'vitest'
import { computeBlessed } from '../src/core/blessed'
import { compute } from '../src/core/engine'
import * as Falak from '../src/core/falak'
import { angleDelta, compassPoint, KAABA, qiblaBearing } from '../src/core/geo'
import { METHODS } from '../src/core/methods'
import { zonedTime } from '../src/core/tz'

/** Falak Mode F1 - expected values from the iOS FalakTests (tools/falak_reference.py). */
const singapore = { latitude: 1.3521, longitude: 103.8198 }
const SGT = 'Asia/Singapore'
const utc = (y: number, mo: number, d: number, h: number, mi: number, s: number) => Date.UTC(y, mo - 1, d, h, mi, s)
const sg = (h: number, mi: number, s = 0) => zonedTime(2026, 10, 22, h, mi, s, SGT)
const near = (a: number, b: number, tolMs: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tolMs)

describe('Falak', () => {
  it('finds both Qibla Days', () => {
    const d26 = Falak.qiblaDays(2026)
    expect(d26.length).toBe(2)
    near(d26[0], utc(2026, 5, 28, 9, 17, 59), 30_000)
    near(d26[1], utc(2026, 7, 15, 9, 26, 42), 30_000)
    const d27 = Falak.qiblaDays(2027)
    near(d27[0], utc(2027, 5, 28, 9, 17, 57), 30_000)
    near(d27[1], utc(2027, 7, 16, 9, 26, 46), 30_000)
    expect(Falak.sunPosition(d27[0], KAABA).altitude).toBeGreaterThan(89.8)
  })

  it('rolls the next Qibla Day over', () => {
    near(Falak.nextQiblaDay(utc(2026, 10, 22, 0, 0, 0)), utc(2027, 5, 28, 9, 17, 57), 30_000)
    near(Falak.nextQiblaDay(utc(2026, 6, 1, 0, 0, 0)), utc(2026, 7, 15, 9, 26, 42), 30_000)
  })

  it('finds rashdul qiblat for Singapore on 22 Oct 2026', () => {
    const hits = Falak.rashdulQiblat(2026, 10, 22, SGT, singapore)
    expect(hits.length).toBe(1)
    expect(hits[0].kind).toBe('sunOpposite')
    near(hits[0].time, sg(10, 48), 60_000)
    const sun = Falak.sunPosition(hits[0].time, singapore)
    expect(Math.abs(angleDelta(sun.azimuth + 180, qiblaBearing(singapore)))).toBeLessThanOrEqual(0.1)
  })

  it('plans the shadow day and matches the engine', () => {
    const plan = Falak.shadowDay(2026, 10, 22, singapore)
    near(plan.noon, sg(12, 49, 13), 5_000)
    expect(Math.abs(Falak.noonShadow(plan, 100) - 22.0)).toBeLessThanOrEqual(0.2)
    expect(Math.abs(Falak.asrShadow(plan, 100, 'standard') - 122.0)).toBeLessThanOrEqual(0.2)
    expect(Math.abs(Falak.asrShadow(plan, 100, 'hanafi') - 222.0)).toBeLessThanOrEqual(0.2)
    expect(compassPoint(plan.noonShadowBearing)).toBe('N')
    const asr = plan.asrShafii!
    near(asr, sg(16, 6, 53), 10_000)
    const muis = compute(2026, 10, 22, singapore, METHODS.muis, 'standard')
    expect(Math.abs((muis.times.asr - asr) / 60_000 - 1)).toBeLessThanOrEqual(1)
  })

  it('round-trips a shadow-stick reading', () => {
    const clock = sg(15, 30)
    const sun = Falak.sunPosition(clock, singapore)
    const shadow = Falak.shadowLength(100, sun.altitude)
    const r = Falak.reading(100, shadow, clock, singapore, SGT, 'standard')!
    expect(r.afternoon).toBe(true)
    expect(Math.abs(r.offsetMinutes!)).toBeLessThanOrEqual(0.2)
    expect(r.asrReached).toBe(false)
    expect(r.uncertaintyMinutes!).toBeLessThan(3)
    const later = Falak.reading(100, shadow + 10, clock, singapore, SGT, 'standard')!
    expect(later.offsetMinutes!).toBeGreaterThan(2)
    const asr = Falak.reading(100, 130, sg(16, 20), singapore, SGT, 'standard')!
    expect(asr.asrReached).toBe(true)
  })

  it('works out the blessed times', () => {
    const today = compute(2026, 10, 22, singapore, METHODS.muis, 'standard')
    const tomorrow = compute(2026, 10, 23, singapore, METHODS.muis, 'standard')
    const times = computeBlessed(today, tomorrow, singapore, false)
    expect(times.map((t) => t[0])).toEqual(['dhuha', 'midnight', 'lastThird'])
    const afterSunrise = (times[0][1] - today.times.sunrise) / 60_000
    expect(afterSunrise).toBeGreaterThanOrEqual(15)
    expect(afterSunrise).toBeLessThanOrEqual(30)
    const night = tomorrow.times.fajr - today.times.maghrib
    near(times[1][1] - today.times.maghrib, night / 2, 60_000)
    near(times[2][1] - today.times.maghrib, (night * 2) / 3, 60_000)
    const ramadan = computeBlessed(today, tomorrow, singapore, true)
    expect(ramadan[0]).toEqual(['imsak', today.times.fajr - 600_000])
  })
})
