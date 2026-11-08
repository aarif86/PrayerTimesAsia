import { describe, expect, it } from 'vitest'
import { HADITH, hadithAlertLine } from '../src/core/hadith'
import { decodePreferences } from '../src/services/prefs'

describe('hadith around the app', () => {
  it('every hadith has Arabic, three languages and a reference', () => {
    for (const h of Object.values(HADITH)) {
      expect(h.arabic).toMatch(/[؀-ۿ]/)
      for (const l of ['en', 'ms', 'id'] as const) { expect(h.meaning[l].length).toBeGreaterThan(10); expect(h.source[l].length).toBeGreaterThan(3) }
      expect(h.ref).toBeTruthy()
    }
  })
  it('public text has no colons or dashes', () => {
    for (const h of Object.values(HADITH)) for (const l of ['en', 'ms', 'id'] as const) {
      expect(h.meaning[l] + h.source[l]).not.toMatch(/[:–—]| - /)
    }
  })
  it('alert line names the book only', () => {
    expect(hadithAlertLine('azan', 'en')).toBe('“When you hear the azan, say what the muazzin says.” al Bukhari')
    expect(hadithAlertLine('monThu', 'ms')).toMatch(/” at Tirmizi$/)
  })
  it('is on by default and keeps what people closed', () => {
    const p = decodePreferences({})
    expect(p.showHadith).toBe(true)
    expect(p.hadithInAlerts).toBe(true)
    expect(decodePreferences({ showHadith: false, hiddenHadith: ['river'] })).toMatchObject({ showHadith: false, hiddenHadith: ['river'] })
  })
})
