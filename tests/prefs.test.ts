import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, decodePreferences } from '../src/services/prefs'
import { featuredOffer, offerURL } from '../src/ui/Makers'

describe('Preferences', () => {
  it('keep old values and default the new ones (iOS testOldPreferencesStillDecode)', () => {
    const prefs = decodePreferences(JSON.parse('{"hasOnboarded":true,"use24Hour":true,"musafirThresholdKm":89}'))
    expect(prefs.hasOnboarded).toBe(true)
    expect(prefs.use24Hour).toBe(true)
    expect(prefs.musafirThresholdKm).toBe(89)
    expect(prefs.trackerEnabled).toBe(false)
    expect(prefs.todayStyle).toBe('centre')
    expect(prefs.showOffers).toBe(true)
  })

  it('ignore values of the wrong type instead of throwing them all away', () => {
    const prefs = decodePreferences({ appearance: 'purple', todayStyle: 'bands', use24Hour: 'yes', manualPlace: { name: 1 } })
    expect(prefs.appearance).toBe(DEFAULT_PREFS.appearance)
    expect(prefs.todayStyle).toBe('bands')
    expect(prefs.use24Hour).toBe(false)
    expect(prefs.manualPlace).toBeNull()
  })
})

describe('From the makers', () => {
  it('offers Badal to Singapore and NasarDigital elsewhere, with the iOS utm tags', () => {
    expect(featuredOffer('SG')).toBe('badal')
    expect(featuredOffer('MY')).toBe('digital')
    expect(offerURL('badal', 'prayer')).toBe('https://badal.sg/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=prayer')
    expect(offerURL('digital', 'masjid')).toBe('https://nasardigital.com/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=masjid')
  })
})
