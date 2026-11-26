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

describe('Falak for everyone', () => {
  it('counts Asr in your own steps (Singapore, 22 Oct 2026)', () => {
    const d = Falak.shadowDay(2026, 10, 22, singapore)
    // Noon shadow 0.22 of the body, so Asr at 7 × 1.22 ≈ 8.5 steps.
    expect(Falak.halfSteps(Falak.asrSteps(d, 'standard'))).toBe(8.5)
    expect(Falak.halfSteps(Falak.asrSteps(d, 'hanafi'))).toBe(15.5)
    const atAsr = Falak.sunPosition(d.asrShafii!, singapore).altitude
    expect(Falak.shadowSteps(atAsr)).toBeCloseTo(Falak.asrSteps(d, 'standard'), 1)
  })

  it('turns a camera angle into ground distance and back', () => {
    expect(Falak.groundDistance(1, 45)).toBeCloseTo(1, 6)
    expect(Falak.depressionTo(1.2, Falak.groundDistance(1.2, 30))).toBeCloseTo(30, 6)
    expect(Falak.groundDistance(1, 0)).toBe(Infinity)
  })

  it('reads Asr from the shadow camera', () => {
    const d = Falak.shadowDay(2026, 10, 22, singapore)
    const target = Falak.asrSteps(d, 'standard')
    const at = (steps: number) => Falak.depressionTo(Falak.CHEST_HEIGHT, steps / Falak.FEET_PER_BODY)
    const before = Falak.cameraReading(at(target - 1), sg(15, 30), singapore, SGT, 'standard')
    expect(before.asrBegun).toBe(false)
    const after = Falak.cameraReading(at(target + 1), sg(16, 30), singapore, SGT, 'standard')
    expect(after.asrBegun).toBe(true)
    expect(after.steps).toBeCloseTo(target + 1, 6)
    expect(Falak.cameraReading(at(20), sg(9, 0), singapore, SGT, 'standard').asrBegun).toBeNull()
  })

  it('names the sky for the slider', () => {
    const times = { fajr: sg(5, 35), sunrise: sg(6, 55), dhuhr: sg(12, 52), asr: sg(16, 8), maghrib: sg(18, 55), isha: sg(20, 6) }
    expect(Falak.skyStage(sg(4, 0), times)).toBe('night')
    expect(Falak.skyStage(sg(6, 0), times)).toBe('fajr')
    expect(Falak.skyStage(sg(7, 0), times)).toBe('sunrise')
    expect(Falak.skyStage(sg(10, 0), times)).toBe('morning')
    expect(Falak.skyStage(sg(13, 0), times)).toBe('dhuhr')
    expect(Falak.skyStage(sg(17, 0), times)).toBe('asr')
    expect(Falak.skyStage(sg(19, 30), times)).toBe('maghrib')
    expect(Falak.skyStage(sg(21, 0), times)).toBe('isha')
  })

  it('keeps the sky slider range around now, even in the small hours', () => {
    const fajr = sg(5, 29), isha = sg(19, 40), min = 60_000
    // 1:20 AM is before Fajr minus 45 minutes, so the range reaches back to now.
    const night = Falak.skyRange(fajr, isha, sg(1, 20))
    expect(night.from).toBe(sg(1, 20))
    expect(night.to).toBe(isha + 45 * min)
    // Midday leaves the usual span alone.
    const noon = Falak.skyRange(fajr, isha, sg(13, 0))
    expect(noon.from).toBe(fajr - 45 * min)
    expect(noon.to).toBe(isha + 45 * min)
    // Late night after Isha plus 45 minutes also reaches to now.
    expect(Falak.skyRange(fajr, isha, sg(23, 50)).to).toBe(sg(23, 50))
  })
})
