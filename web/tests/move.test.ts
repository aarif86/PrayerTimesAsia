import { describe, expect, it } from 'vitest'
import fixture from '../../testdata/move-settings.json'
import { applyMoved, decodeMove, describeMoved, encodeForQR, encodeMove, movedFrom, type MovedSettings } from '../src/services/move'
import { DEFAULT_PREFS } from '../src/services/prefs'

describe('Move my settings', () => {
  it('reads every shared code (testdata/move-settings.json, also read by the iPhone and Android tests)', async () => {
    for (const c of fixture.cases) expect(await decodeMove(c.code), c.name).toEqual(c.settings)
  })

  it('finds the code inside a link or a pasted message', async () => {
    const c = fixture.cases[1]
    expect(await decodeMove(`Here: https://aarif86.github.io/PrayerTimesAsia/app/#move=${c.code} `)).toEqual(c.settings)
    expect(await decodeMove('PTA1.not-a-code')).toBeNull()
    expect(await decodeMove('hello')).toBeNull()
  })

  it('round-trips: settings in, the same settings out on the other side', async () => {
    const m = fixture.cases[1].settings as MovedSettings
    const prefs = applyMoved(structuredClone(DEFAULT_PREFS), m)
    expect(prefs.hasOnboarded).toBe(true)
    expect(prefs.home?.name).toBe('Singapore')
    expect(prefs.savedPlaces[1].district).toBe('Kota Bandung')
    expect(prefs.todayStyle).toBe('bands')
    expect(prefs.notifyPrayers).toEqual(['fajr', 'maghrib', 'isha'])
    const back = movedFrom(prefs, m.wakeUp)
    expect(back).toEqual(m)
    expect(await decodeMove(await encodeMove(back))).toEqual(m)
  })

  it('a fresh install moves as an empty code', () => {
    expect(movedFrom(DEFAULT_PREFS)).toEqual({ v: 1 })
  })

  it('adds tracker history to what is already there, and replaces the rest', () => {
    const here = structuredClone(DEFAULT_PREFS)
    here.prayedLog = { '2026-10-25': ['isha'], '2026-10-01': ['fajr'] }
    here.excusedDays = ['2026-09-01']
    here.use24Hour = true
    const prefs = applyMoved(here, { v: 1, prayedLog: { '2026-10-25': ['fajr'] }, excusedDays: ['2026-10-20'] })
    expect(prefs.prayedLog).toEqual({ '2026-10-25': ['fajr', 'isha'], '2026-10-01': ['fajr'] })
    expect(prefs.excusedDays).toEqual(['2026-09-01', '2026-10-20'])
    expect(prefs.use24Hour).toBe(false)
  })

  it('ignores wrong values instead of breaking', () => {
    const prefs = applyMoved(structuredClone(DEFAULT_PREFS), { v: 1, appearance: 'purple', use24Hour: 'yes' as unknown as boolean, home: { name: 1 } as never })
    expect(prefs.appearance).toBe('system')
    expect(prefs.use24Hour).toBe(false)
    expect(prefs.home).toBeNull()
  })

  it('trims old tracker days so a long history still fits a QR code', async () => {
    const log: Record<string, ['fajr', 'isha']> = {}
    for (let i = 0; i < 2000; i++) log[new Date(Date.UTC(2021, 0, 1 + i)).toISOString().slice(0, 10)] = ['fajr', 'isha']
    const m: MovedSettings = { v: 1, trackerEnabled: true, prayedLog: log }
    const { code, keptDays } = await encodeForQR(m, 600)
    expect(code.length).toBeLessThanOrEqual(600)
    expect(keptDays).toBeGreaterThan(0)
    const back = await decodeMove(code)
    expect(Object.keys(back!.prayedLog!)).toContain('2026-06-23')
    expect(describeMoved(back!)[0]).toMatch(/Prayer tracker/)
  })
})
