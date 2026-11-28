import { describe, expect, it } from 'vitest'
import { planJourney, between, type Leg, type Stop } from '../src/core/journeyPlan'
import { CITIES } from '../src/services/cities'
import { profileFor, profileMethod } from '../src/core/regions'
import { zonedTime } from '../src/core/tz'

const stop = (cc: string, name: string): Stop => {
  const p = CITIES.find((c) => c.countryCode === cc && c.name === name)!
  const pr = profileFor(cc)!
  return { name, coords: p.coordinates, tz: p.timeZoneID, method: profileMethod(pr), asr: pr.asr }
}
const SIN = stop('SG', 'Singapore City'), LON = stop('GB', 'London'), DOH = stop('QA', 'Doha')

describe('journey planner', () => {
  it('great circle ends match', () => {
    const m = between(SIN.coords, LON.coords, 0.5)
    expect(m.latitude).toBeGreaterThan(SIN.coords.latitude)
    expect(between(SIN.coords, LON.coords, 0).latitude).toBeCloseTo(SIN.coords.latitude, 3)
  })
  it('overnight Singapore to London has Fajr in the air or on landing, in order, covering the whole trip', () => {
    const leg: Leg = { from: SIN, to: LON, departMs: zonedTime(2027, 3, 10, 23, 55, 0, SIN.tz), arriveMs: zonedTime(2027, 3, 11, 5, 50, 0, LON.tz) }
    const plan = planJourney([leg])
    expect(plan.airMs).toBe(leg.arriveMs - leg.departMs)
    expect(plan.runs.length).toBeGreaterThan(1)
    for (let i = 1; i < plan.runs.length; i++) {
      expect(plan.runs[i].startMs).toBe(plan.runs[i - 1].endMs)
      expect(plan.runs[i].startMs % 60000).toBe(0)
    }
    expect(plan.runs[0].startedBeforeTakeoff).toBe(true)
    expect(plan.runs[plan.runs.length - 1].endsAfterLanding).toBe(true)
    const names = plan.runs.map((r) => r.prayer)
    expect(names).toContain('fajr')
    expect(plan.runs.some((r) => r.airMs > 0)).toBe(true)
  })
  it('a daytime flight can hold a whole prayer time in the air', () => {
    const leg: Leg = { from: SIN, to: DOH, departMs: zonedTime(2027, 3, 10, 9, 0, 0, SIN.tz), arriveMs: zonedTime(2027, 3, 10, 12, 30, 0, DOH.tz) }
    const plan = planJourney([leg])
    expect(plan.runs.every((r) => r.parts.length > 0)).toBe(true)
  })
  it('a connection gives a layover part', () => {
    const a: Leg = { from: SIN, to: DOH, departMs: zonedTime(2027, 3, 10, 9, 0, 0, SIN.tz), arriveMs: zonedTime(2027, 3, 10, 12, 30, 0, DOH.tz) }
    const b: Leg = { from: DOH, to: LON, departMs: zonedTime(2027, 3, 10, 18, 0, 0, DOH.tz), arriveMs: zonedTime(2027, 3, 10, 22, 0, 0, LON.tz) }
    const plan = planJourney([a, b])
    expect(plan.runs.some((r) => r.parts.some((p) => p.kind === 'layover'))).toBe(true)
  })
})
