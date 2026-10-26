import { describe, expect, it } from 'vitest'
import type { OfficialSource } from '../src/core/official'
import { zonedTime } from '../src/core/tz'
import { configFromHash, DEFAULT_CONFIG, decodeConfig, encodeConfig, parseIqamah, sanitize, type ScreenConfig } from '../src/screen/config'
import { countdown, phaseAt, screenDay, type Row } from '../src/screen/model'

const TZ = 'Asia/Singapore'
const at = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => zonedTime(y, mo, d, h, mi, s, TZ)

const SG: ScreenConfig = {
  ...DEFAULT_CONFIG,
  name: 'Masjid Ujian',
  place: { name: 'Pasir Ris', lat: 1.3721, lng: 103.9474, tz: TZ, cc: 'SG', district: null },
  jumuah: '13:00',
}

/** A MUIS-shaped row for every day, so the tests don't depend on the network. */
const muisRow: Row = { fajr: '05:35', sunrise: '06:53', dhuhr: '12:52', asr: '16:10', maghrib: '18:56', isha: '20:07' }
const lookup = (s: OfficialSource): Row => (s.kind === 'muis' ? muisRow : null)
const noTable = (): Row => null

describe('screen config', () => {
  it('round-trips through the link, including non-Latin text', () => {
    const c = { ...SG, name: 'مسجد Al-Falah', notices: ['Kuliah Maghrib · Ustaz Ahmad'] }
    const text = encodeConfig(c)
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeConfig(text)).toEqual(c)
    expect(configFromHash(`#c=${text}`)).toEqual(c)
  })

  it('rejects garbage and repairs bad fields', () => {
    expect(decodeConfig('!!!')).toBeNull()
    const c = sanitize({ name: 5, place: { lat: 200, lng: 0, tz: 'x' }, hijriAdj: 9, notices: ['a', 7, '', 'b'], jumuah: '25:00', iqamah: { fajr: { after: 999 }, asr: { fixed: '16:20' } } })
    expect(c.place).toBeNull()
    expect(c.hijriAdj).toBe(2)
    expect(c.notices).toEqual(['a', 'b'])
    expect(c.jumuah).toBeNull()
    expect(c.iqamah).toEqual({ asr: { fixed: '16:20' } })
  })

  it('reads iqamah as minutes or a time', () => {
    expect(parseIqamah('10')).toEqual({ after: 10 })
    expect(parseIqamah(' 7 ')).toEqual({ after: 7 })
    expect(parseIqamah('13:15')).toEqual({ fixed: '13:15' })
    expect(parseIqamah('6.05')).toEqual({ fixed: '06:05' })
    expect(parseIqamah('')).toBeNull()
    expect(parseIqamah('soon')).toBeNull()
  })
})

describe('screen day', () => {
  it('uses the official table and adds iqamah', () => {
    const d = screenDay(at(2026, 10, 26, 9, 0), SG, lookup)!
    expect(d.source).toBe('MUIS official timetable')
    expect(d.day.times.asr).toBe(at(2026, 10, 26, 16, 10))
    expect(d.iqamah.asr).toBe(at(2026, 10, 26, 16, 20))
    expect(d.iqamah.maghrib).toBe(at(2026, 10, 26, 19, 1))
    expect(d.friday).toBe(false)
  })

  it('falls back to calculation without a table', () => {
    const d = screenDay(at(2026, 10, 26, 9, 0), SG, noTable)!
    expect(d.source).toMatch(/^Calculated/)
    // Calibrated never to be earlier than MUIS, at most a couple of minutes later.
    expect(Math.abs(d.day.times.asr - at(2026, 10, 26, 16, 10))).toBeLessThan(6 * 60_000)
  })

  it('uses the khutbah time on Friday', () => {
    const d = screenDay(at(2026, 10, 30, 9, 0), SG, lookup)!
    expect(d.friday).toBe(true)
    expect(d.iqamah.dhuhr).toBe(at(2026, 10, 30, 13, 0))
  })

  it('never puts a fixed iqamah before the azan', () => {
    const c = { ...SG, iqamah: { asr: { fixed: '15:00' } } }
    expect(screenDay(at(2026, 10, 26, 9, 0), c, lookup)!.iqamah.asr).toBe(at(2026, 10, 26, 16, 10))
  })
})

describe('screen phases', () => {
  it('counts down to the next prayer', () => {
    const p = phaseAt(at(2026, 10, 26, 15, 27, 45), SG, lookup)!
    expect(p.kind).toBe('waiting')
    if (p.kind !== 'waiting') return
    expect(p.next).toBe('asr')
    expect(p.current).toBe('dhuhr')
    expect(countdown(p.at - at(2026, 10, 26, 15, 27, 45))).toBe('42:15')
  })

  it('shows the iqamah countdown after the azan, then dims for the prayer', () => {
    const azan = phaseAt(at(2026, 10, 26, 16, 12), SG, lookup)!
    expect(azan.kind).toBe('azan')
    if (azan.kind === 'azan') expect(azan.iqamah).toBe(at(2026, 10, 26, 16, 20))
    const prayer = phaseAt(at(2026, 10, 26, 16, 25), SG, lookup)!
    expect(prayer.kind).toBe('prayer')
    expect(phaseAt(at(2026, 10, 26, 16, 31), SG, lookup)!.kind).toBe('waiting')
  })

  it('dims longer on Friday', () => {
    expect(phaseAt(at(2026, 10, 30, 13, 35), SG, lookup)!.kind).toBe('prayer')
    expect(phaseAt(at(2026, 10, 30, 13, 41), SG, lookup)!.kind).toBe('waiting')
  })

  it('shows "azan now" briefly when there is no iqamah', () => {
    const c = { ...SG, iqamah: {} }
    expect(phaseAt(at(2026, 10, 26, 16, 11), c, lookup)!.kind).toBe('azan')
    expect(phaseAt(at(2026, 10, 26, 16, 14), c, lookup)!.kind).toBe('waiting')
  })

  it('counts Syuruk as the end of Subuh', () => {
    const p = phaseAt(at(2026, 10, 26, 6, 30), SG, lookup)!
    expect(p.kind === 'waiting' && p.next).toBe('sunrise')
  })

  it('highlights nothing between Syuruk and Zohor', () => {
    const p = phaseAt(at(2026, 10, 26, 9, 0), SG, lookup)!
    expect(p.kind === 'waiting' && p.current).toBeNull()
  })

  it("shows tomorrow's times after Isyak, with nothing highlighted", () => {
    const p = phaseAt(at(2026, 10, 26, 23, 0), SG, lookup)!
    expect(p.kind).toBe('waiting')
    if (p.kind !== 'waiting') return
    expect(p.next).toBe('fajr')
    expect(p.current).toBeNull()
    expect(p.day.day.day).toBe(27)
  })

  it('carries an Isyak iqamah past midnight', () => {
    const c = { ...SG, iqamah: { isha: { fixed: '23:58' } }, dimMinutes: 10 }
    expect(phaseAt(at(2026, 10, 27, 0, 3), c, lookup)!.kind).toBe('prayer')
  })

  it('adds Imsak in Ramadan', () => {
    // 1 Ramadan 1448 is around 8 February 2027 (Umm al-Qura).
    const d = screenDay(at(2027, 2, 15, 9, 0), SG, lookup)!
    expect(d.ramadan).toBe(true)
    expect(d.imsak).toBe(d.day.times.fajr - 10 * 60_000)
  })
})

describe('countdown', () => {
  it('rounds up and keeps hours', () => {
    expect(countdown(0)).toBe('0:00')
    expect(countdown(59_001)).toBe('1:00')
    expect(countdown(3_725_000)).toBe('1:02:05')
  })
})
