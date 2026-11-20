import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, decodePreferences } from '../src/services/prefs'

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

describe('Leave for Jumaat', () => {
  it('moves old choices up to the next one and keeps the session sane', () => {
    expect(decodePreferences({ jumuahReminderMinutes: 20 }).jumuahReminderMinutes).toBe(30)
    expect(decodePreferences({ jumuahReminderMinutes: 90 }).jumuahReminderMinutes).toBe(120)
    expect(decodePreferences({ jumuahReminderMinutes: 120 }).jumuahReminderMinutes).toBe(120)
    expect(decodePreferences({ jumuahReminderMinutes: -5 }).jumuahReminderMinutes).toBe(0)
    expect(decodePreferences({ jumuahReminderMinutes: 17 }).jumuahReminderMinutes).toBe(0)
    expect(decodePreferences({ jumuahSession: 'third' }).jumuahSession).toBe('first')
    expect(decodePreferences({ jumuahSession: 'second' }).jumuahSession).toBe('second')
  })
})
