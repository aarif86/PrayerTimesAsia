import { describe, expect, it } from 'vitest'
import { alertLine, type AlertPrayer } from '../src/core/alertLines'
import { ALERT_LINES } from '../src/core/alertLinesData'

const PRAYERS: AlertPrayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const NAMES = { fajr: 'Subuh', dhuhr: 'Zohor', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak' }

function day(offset: number): [number, number, number] {
  const d = new Date(Date.UTC(2026, 10, 1 + offset))
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}

describe('prayer alert lines', () => {
  it('fills in the prayer name and has no colons or dashes', () => {
    for (const lang of ['en', 'ms', 'id'] as const) {
      for (let i = 0; i < 60; i++) {
        for (const p of PRAYERS) {
          const line = alertLine(lang, p, false, ...day(i), NAMES[p])
          expect(line).not.toMatch(/\{p\}|:|—|–/)
        }
      }
    }
  })

  it('never shows the same words twice on one day, and rarely within a week', () => {
    const seen = new Map<string, number>()
    for (let i = 0; i < 365; i++) {
      const today = PRAYERS.map((p) => alertLine('en', p, false, ...day(i), '{p}'))
      expect(new Set(today).size).toBe(5)
      for (const line of today) {
        const last = seen.get(line)
        if (last !== undefined) expect(i - last).toBeGreaterThanOrEqual(7)
        seen.set(line, i)
      }
    }
    // Every line gets its turn within a year.
    const all = new Set([...PRAYERS.flatMap((p) => ALERT_LINES.en[p]), ...ALERT_LINES.en.any])
    expect(seen.size).toBe(all.size)
  })

  it('uses Malay in baku style and the Jumaat lines on Friday', () => {
    for (const line of Object.values(ALERT_LINES.ms).flat()) {
      expect(line).not.toMatch(/\b(solatlah|marilah|peliharalah|sahutlah|bangunlah|tunaikanlah|ambillah|segeralah)\b|sekejap|ayuh/i)
    }
    expect(ALERT_LINES.en.jumuah.map((l) => l.replace('{p}', 'Jumaat'))).toContain(alertLine('en', 'dhuhr', true, 2026, 11, 13, 'Jumaat'))
  })
})
