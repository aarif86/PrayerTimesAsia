import { beforeEach, describe, expect, it } from 'vitest'
import { AWAY_KM, cleanAwayMinutes, DEFAULT_AWAY_MINUTES, earlyMinutes, isAway } from '../src/core/away'
import type { Place } from '../src/core/place'
import { zonedTime } from '../src/core/tz'
import { decodePreferences, type Preferences } from '../src/services/prefs'
import { store } from '../src/services/store'
import { upcomingAlerts } from '../src/services/notifications'

const SG: Place = { id: 'h', name: 'Pasir Ris', countryCode: 'SG', countryName: 'Singapore', timeZoneID: 'Asia/Singapore', coordinates: { latitude: 1.3721, longitude: 103.9474 } }
const NEAR: Place = { ...SG, id: 'n', name: 'Tampines', coordinates: { latitude: 1.3496, longitude: 103.9568 } } // about 2.6 km
const KL: Place = { id: 'k', name: 'Kuala Lumpur', countryCode: 'MY', countryName: 'Malaysia', timeZoneID: 'Asia/Kuala_Lumpur', coordinates: { latitude: 3.139, longitude: 101.6869 } }
const sg = (y: number, m: number, d: number, h: number, min = 0) => zonedTime(y, m, d, h, min, 0, 'Asia/Singapore')

function use(here: Place, change: Partial<Preferences> = {}) {
  store.prefs = { ...decodePreferences({}), hasOnboarded: true, useGPS: false, manualPlace: here, home: SG, homeConfirmed: true, ...change }
  store.emit()
}
const early = (list: ReturnType<typeof upcomingAlerts>) => list.filter((a) => a.id.endsWith('-early'))

describe('away from home', () => {
  it('is away only past 5 km from a confirmed home', () => {
    expect(AWAY_KM).toBe(5)
    expect(isAway(SG, true, NEAR)).toBe(false)
    expect(isAway(SG, true, KL)).toBe(true)
    expect(isAway(SG, false, KL)).toBe(false)
    expect(isAway(null, true, KL)).toBe(false)
    expect(isAway(SG, true, null)).toBe(false)
  })

  it('keeps only the five prayers with a real choice', () => {
    expect(cleanAwayMinutes({ asr: 45, fajr: 7, sunrise: 15, isha: 'x' })).toEqual({ ...DEFAULT_AWAY_MINUTES, asr: 45 })
    expect(cleanAwayMinutes(null)).toEqual(DEFAULT_AWAY_MINUTES)
  })

  it('picks one early reminder: away choice away, old choice at home, none for Fajr with an alarm', () => {
    expect(earlyMinutes('asr', true, true, DEFAULT_AWAY_MINUTES, 15, false)).toBe(60)
    expect(earlyMinutes('asr', true, false, DEFAULT_AWAY_MINUTES, 15, false)).toBe(15)
    expect(earlyMinutes('asr', false, true, DEFAULT_AWAY_MINUTES, 0, false)).toBe(0)
    expect(earlyMinutes('fajr', true, true, { ...DEFAULT_AWAY_MINUTES, fajr: 30 }, 0, true)).toBe(0)
    expect(earlyMinutes('fajr', true, true, { ...DEFAULT_AWAY_MINUTES, fajr: 30 }, 0, false)).toBe(30)
  })

  it('is on by default with 1 hour and Fajr off', () => {
    const p = decodePreferences({})
    expect(p.awayReminder).toBe(true)
    expect(p.awayMinutes).toEqual(DEFAULT_AWAY_MINUTES)
  })
})

describe('away reminders in the alert plan', () => {
  beforeEach(() => use(SG))

  it('sends nothing early at home by default', () => {
    use(SG, { notificationsEnabled: true })
    expect(early(upcomingAlerts(sg(2026, 11, 16, 9)))).toEqual([])
  })

  it('sends 1 hour before when away, once per prayer, with the away words', () => {
    use(KL, { notificationsEnabled: true })
    const list = early(upcomingAlerts(sg(2026, 11, 16, 9)))
    expect(list.length).toBeGreaterThanOrEqual(3)
    const asr = list.find((a) => a.id === '2026-11-16-asr-early')!
    expect(asr.title).toMatch(/1 hour/)
    expect(asr.body).toMatch(/find a place to pray/)
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
    expect(list.some((a) => a.id.endsWith('-fajr-early'))).toBe(false)
  })

  it('sends nothing early when the away switch is off or home is not confirmed', () => {
    use(KL, { notificationsEnabled: true, awayReminder: false })
    expect(early(upcomingAlerts(sg(2026, 11, 16, 9)))).toEqual([])
    use(KL, { notificationsEnabled: true, homeConfirmed: false })
    expect(early(upcomingAlerts(sg(2026, 11, 16, 9)))).toEqual([])
  })

  it('uses the choice per prayer, and the old at-home reminder when at home', () => {
    use(KL, { notificationsEnabled: true, awayMinutes: { ...DEFAULT_AWAY_MINUTES, asr: 30, maghrib: 0 } })
    const away = early(upcomingAlerts(sg(2026, 11, 16, 9)))
    expect(away.find((a) => a.id.endsWith('asr-early'))!.title).toMatch(/30 min/)
    expect(away.some((a) => a.id.endsWith('maghrib-early'))).toBe(false)
    use(SG, { notificationsEnabled: true, reminderMinutesBefore: 15 })
    const home = early(upcomingAlerts(sg(2026, 11, 16, 9)))
    expect(home.find((a) => a.id.endsWith('asr-early'))!.title).toMatch(/15 min/)
  })

  it('does not double up Fajr when it has an alarm', () => {
    use(KL, { notificationsEnabled: true, wakeUp: 'atFajr', awayMinutes: { ...DEFAULT_AWAY_MINUTES, fajr: 30 } })
    expect(early(upcomingAlerts(sg(2026, 11, 16, 3))).some((a) => a.id.endsWith('fajr-early'))).toBe(false)
  })
})
