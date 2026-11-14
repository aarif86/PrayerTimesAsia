import { describe, expect, it } from 'vitest'
import { musafirDistanceCheck, musafirGuidance, musafirPlan, musafirStatus, type MusafirRules } from '../src/core/musafir'

const shafii: MusafirRules = { school: 'standard', thresholdKm: 81 }
const hanafi: MusafirRules = { school: 'hanafi', thresholdKm: 78 }
const SG = { latitude: 1.3521, longitude: 103.8198 }
const KL = { latitude: 3.139, longitude: 101.6869 }
/** A point `km` due north of Singapore. */
const north = (km: number) => ({ latitude: SG.latitude + km / 111.195, longitude: SG.longitude })

describe('journey and musafir', () => {
  it('says nothing without a home', () => {
    expect(musafirStatus(null, KL, 0, shafii)).toBeNull()
    expect(musafirStatus(undefined, KL, 0, shafii)).toBeNull()
  })

  it('is home within 2 km, nearby under the travel distance, a traveller beyond it', () => {
    expect(musafirStatus(SG, north(1), 0, shafii)?.kind).toBe('home')
    expect(musafirStatus(SG, north(50), 0, shafii)?.kind).toBe('nearby')
    expect(musafirStatus(SG, KL, 0, shafii)?.kind).toBe('traveller')
  })

  it('switching 81 km to 89 km changes the answer for an 85 km trip', () => {
    expect(musafirStatus(SG, north(85), 0, shafii)?.kind).toBe('traveller')
    expect(musafirStatus(SG, north(85), 0, { ...shafii, thresholdKm: 89 })?.kind).toBe('nearby')
  })

  it('ends the concession after 3 days (Shafi\'i) or 15 days (Hanafi)', () => {
    expect(musafirStatus(SG, KL, 3, shafii)?.kind).toBe('traveller')
    expect(musafirStatus(SG, KL, 4, shafii)?.kind).toBe('settled')
    expect(musafirStatus(SG, KL, 15, hanafi)?.kind).toBe('traveller')
    expect(musafirStatus(SG, KL, 16, hanafi)?.kind).toBe('settled')
  })

  it('never reads "81 km, less than 81 km" just short of the limit', () => {
    const s = musafirStatus(SG, north(80.7), 0, shafii)!
    expect(s.kind).toBe('nearby')
    const text = musafirDistanceCheck(s, shafii)!.text
    expect(text).toMatch(/^You are 80 km from home\. That is less than 81 km/)
  })

  it('joins prayers in the plan only outside the Hanafi school', () => {
    const plan = musafirPlan(shafii, 'malay')
    expect(plan.map((r) => r.rakaat)).toEqual(['2 rakaat', '2 rakaat', '2 rakaat', '3 rakaat', '2 rakaat'])
    expect(plan.find((r) => r.prayer === 'dhuhr')!.join).toBe('Can join with Asar')
    expect(musafirPlan(hanafi, 'arabic').every((r) => r.join === 'Not joined')).toBe(true)
    expect(musafirGuidance({ kind: 'traveller', distanceKm: 300 }, hanafi, 'arabic').body).toMatch(/not joined/)
  })

  it('uses International names in the plan when the prayer names are right to left', () => {
    expect(musafirPlan(shafii, 'urdu')[0].name).toBe(musafirPlan(shafii, 'arabic')[0].name)
  })
})
