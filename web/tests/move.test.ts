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
    const back = movedFrom(prefs)
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

  it('carries the Ramadan record there and back (fasts, Tarawih and juz)', async () => {
    const m = fixture.cases.find((c) => c.name.startsWith('Ramadan record'))!.settings as MovedSettings
    const prefs = applyMoved(structuredClone(DEFAULT_PREFS), m)
    expect(prefs.fastLog['2026-02-25']).toBe('period')
    expect(prefs.fastLog['2026-04-10']).toBe('qadha')
    expect(prefs.tarawihLog).toEqual(['2026-02-17', '2026-02-18', '2026-03-16'])
    expect(prefs.quranLog).toEqual(['2026-02-18', '2026-02-19'])
    const back = movedFrom(prefs)
    expect(back).toEqual(m)
    expect(await decodeMove(await encodeMove(back))).toEqual(m)
    expect(describeMoved(back)).toContain('Your Ramadan record of fasts, Tarawih and juz')
  })

  it('adds the Ramadan record to what is already there', () => {
    const here = structuredClone(DEFAULT_PREFS)
    here.fastLog = { '2026-02-18': 'sick', '2025-03-01': 'fasted' }
    here.tarawihLog = ['2025-03-01']
    const prefs = applyMoved(here, { v: 1, fastLog: { '2026-02-18': 'fasted', bad: 'fasted', '2026-02-19': 'nope' as never }, tarawihLog: ['2026-02-18', 'x'], quranLog: 'x' as never })
    expect(prefs.fastLog).toEqual({ '2026-02-18': 'fasted', '2025-03-01': 'fasted' })
    expect(prefs.tarawihLog).toEqual(['2025-03-01', '2026-02-18'])
    expect(prefs.quranLog).toEqual([])
  })

  it('an older code without the Ramadan record leaves this device\'s record alone', async () => {
    const here = structuredClone(DEFAULT_PREFS)
    here.fastLog = { '2026-02-18': 'fasted' }
    here.tarawihLog = ['2026-02-18']
    here.quranLog = ['2026-02-19']
    const old = await decodeMove(fixture.cases[1].code)
    const prefs = applyMoved(here, old!)
    expect(prefs.home?.name).toBe('Singapore')
    expect(prefs.fastLog).toEqual({ '2026-02-18': 'fasted' })
    expect(prefs.tarawihLog).toEqual(['2026-02-18'])
    expect(prefs.quranLog).toEqual(['2026-02-19'])
  })

  it('keeps only this year\'s Ramadan record when the QR code would be too long', async () => {
    const fastLog: Record<string, 'fasted'> = {}
    const tarawihLog: string[] = []
    for (let y = 2020; y <= 2026; y++) {
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.UTC(y, 2, 1 + i)).toISOString().slice(0, 10)
        fastLog[d] = 'fasted'
        tarawihLog.push(d)
      }
    }
    const m: MovedSettings = { v: 1, fastLog, tarawihLog, quranLog: tarawihLog }
    const full = await encodeMove(m)
    const { code, ramadanTrimmed, keptDays } = await encodeForQR(m, full.length - 1)
    expect(ramadanTrimmed).toBe(true)
    expect(keptDays).toBeNull()
    const back = await decodeMove(code)
    expect(Object.keys(back!.fastLog!).every((d) => d.startsWith('2026-'))).toBe(true)
    expect(back!.tarawihLog).toHaveLength(30)
    // Short enough already: nothing is left out.
    expect((await encodeForQR(m, full.length)).ramadanTrimmed).toBe(false)
  })
})
