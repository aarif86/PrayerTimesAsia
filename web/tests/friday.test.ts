import { describe, expect, it } from 'vitest'
import { FRIDAY_SG, fridayMosqueAt, fridayNearest, inSingapore } from '../src/core/friday'
import { isGraveOrShrine, looksLikePrayerSpace } from '../src/core/official'

describe('Singapore two-session Friday list', () => {
  it('has the 24 MUIS masjids with a source', () => {
    expect(FRIDAY_SG.mosques).toHaveLength(24)
    expect(FRIDAY_SG.sourceUrl).toContain('muis.gov.sg')
    for (const m of FRIDAY_SG.mosques) expect(inSingapore({ latitude: m.lat, longitude: m.lng })).toBe(true)
  })
  it('matches a listed place within 300 m only', () => {
    expect(fridayMosqueAt({ latitude: 1.37106, longitude: 103.96412 })?.name).toBe('Masjid Al-Istighfar')
    expect(fridayMosqueAt({ latitude: 1.38, longitude: 103.97 })).toBeNull()
  })
  it('sorts nearest first', () => {
    expect(fridayNearest({ latitude: 1.3044, longitude: 103.8537 })[0].name).toBe('Masjid Abdul Gafoor')
  })
})

describe('graves and shrines', () => {
  it('leaves out graves but keeps masjids named after them', () => {
    expect(isGraveOrShrine('Kubur Kassim')).toBe(true)
    expect(isGraveOrShrine('Keramat Radin Mas')).toBe(true)
    expect(isGraveOrShrine('Masjid Kubur Kassim')).toBe(false)
    expect(isGraveOrShrine('Masjid Al-Istighfar')).toBe(false)
    expect(looksLikePrayerSpace('Makam Habib Noh')).toBe(false)
  })
})
