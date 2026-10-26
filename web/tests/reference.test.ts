import { describe, expect, it } from 'vitest'
import { compute } from '../src/core/engine'
import { methodWithId } from '../src/core/methods'
import { PRAYERS } from '../src/core/prayer'
import reference from '../../testdata/reference-2026.json'

/**
 * Every day of 2026 (testdata/reference-2026.json, shared with the iPhone and
 * Android tests) for Singapore (MUIS), Kuala Lumpur (JAKIM) and Jakarta
 * (Kemenag), against the Python port of PrayerEngine.swift
 * (tools/reference_engine.py final_minutes). That port is what the iOS
 * whole-year validation against the official tables runs on, so matching it
 * carries the same "never earlier than official" guarantee over to the web.
 */
type Ref = Record<string, { method: string; lat: number; lng: number; tzHours: number; days: Record<string, number[]> }>

describe('Whole-year cross-check with the iOS reference engine', () => {
  for (const [city, r] of Object.entries(reference as Ref)) {
    it(`${city} (${r.method}): every prayer, every day of 2026`, () => {
      const method = methodWithId(r.method)!
      let exact = 0, total = 0
      for (const [date, minutes] of Object.entries(r.days)) {
        const [y, m, d] = date.split('-').map(Number)
        const day = compute(y, m, d, { latitude: r.lat, longitude: r.lng }, method, 'standard')
        PRAYERS.forEach((p, i) => {
          const local = Math.round((day.times[p] - Date.UTC(y, m - 1, d)) / 60_000) + r.tzHours * 60
          const diff = local - minutes[i]
          expect(Math.abs(diff), `${date} ${p}`).toBeLessThanOrEqual(1)
          if (diff === 0) exact++
          total++
        })
      }
      // Only float noise at an exact minute boundary may differ.
      expect(exact / total).toBeGreaterThan(0.995)
    })
  }
})
