import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sanitize } from '../src/screen/config'
import { decodePreferences } from '../src/services/prefs'
import { basePayload, cleanCity, makeSignal, OPEN_GAP_MS, screenPayload, shouldCountOpen } from '../src/services/usage'

const ON = { telemetryDeckAppID: 'AAAA-BBBB', enabled: true }

describe('anonymous usage counts', () => {
  it('sends nothing until there is an App ID, or when switched off', () => {
    expect(makeSignal({ telemetryDeckAppID: '', enabled: true }, 'id', 'App.opened', {}, false)).toBeNull()
    expect(makeSignal({ ...ON, enabled: false }, 'id', 'App.opened', {}, false)).toBeNull()
    expect(makeSignal(ON, 'id', 'App.opened', {}, false)).toMatchObject({ appID: 'AAAA-BBBB', clientUser: 'id', type: 'App.opened' })
  })

  it('shares only the city and country, never coordinates', () => {
    const p = basePayload('web', '1.0.0', { city: 'Pasir Ris', countryCode: 'sg' }, 'en-SG')
    expect(p).toMatchObject({ 'App.platform': 'web', 'App.version': '1.0.0', 'App.language': 'en', 'Place.country': 'SG', 'Place.city': 'Pasir Ris' })
    expect(Object.keys(p).join(' ')).not.toMatch(/\b(lat|lng|latitude|longitude|coordinates)\b/i)
    expect(basePayload('web', '1', { city: 'Current location', countryCode: 'Singapore' }, 'en')).not.toHaveProperty('Place.city')
    expect(basePayload('web', '1', { city: null, countryCode: 'Singapore' }, 'en')).not.toHaveProperty('Place.country')
    expect(cleanCity('  ')).toBeNull()
  })

  it('counts an app open at most once an hour', () => {
    expect(shouldCountOpen(null, 1000)).toBe(true)
    expect(shouldCountOpen(1000, 1000 + OPEN_GAP_MS - 1)).toBe(false)
    expect(shouldCountOpen(1000, 1000 + OPEN_GAP_MS)).toBe(true)
  })

  it('names the masjid on a screen check-in', () => {
    const p = screenPayload('1.0.0', { masjid: ' Masjid Al-Istiqamah ', city: 'Serangoon', countryCode: 'SG', look: 'night', language: 'ms' }, false)
    expect(p).toMatchObject({ 'App.platform': 'screen', 'Masjid.name': 'Masjid Al-Istiqamah', 'Screen.look': 'night', 'Screen.orientation': 'landscape', 'Place.country': 'SG' })
    expect(screenPayload('1', { masjid: '', city: null, countryCode: null, look: 'day', language: 'en' }, true)['Masjid.name']).toBe('(no name)')
  })

  it('is on by default, and remembers when turned off', () => {
    expect(decodePreferences({}).shareUsage).toBe(true)
    expect(decodePreferences({ shareUsage: false }).shareUsage).toBe(false)
    expect(sanitize({}).report).toBe(true)
    expect(sanitize({ report: false }).report).toBe(false)
  })

  it('reads its switch from the shared config file', () => {
    const config = JSON.parse(readFileSync(new URL('../../config/analytics.json', import.meta.url), 'utf8'))
    expect(typeof config.telemetryDeckAppID).toBe('string')
    expect(typeof config.enabled).toBe('boolean')
  })
})
