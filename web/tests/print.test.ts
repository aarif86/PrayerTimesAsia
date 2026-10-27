import { describe, expect, it } from 'vitest'
import { zonedTime } from '../src/core/tz'
import { DEFAULT_CONFIG, EXAMPLE_PLACE, type ScreenConfig } from '../src/screen/config'
import { clock, configFromShortHash, hijriSpan, monthDays, optionsFromHash, ramadanDays, shortHash } from '../src/print/model'

const c: ScreenConfig = { ...DEFAULT_CONFIG, place: EXAMPLE_PLACE, names: 'malay' }
const none = () => null
const TZ = 'Asia/Singapore'

describe('printable sheets', () => {
  it('lists every day of the month with Fridays marked', () => {
    const days = monthDays(c, 2026, 11, none)
    expect(days).toHaveLength(30)
    expect(days[0].day).toBe(1)
    expect(days.filter((d) => d.times.friday).map((d) => d.day)).toEqual([6, 13, 20, 27])
    expect(hijriSpan(days, 'malay')).toBe('Jamadilawal – Jamadilakhir 1448')
  })

  it('finds Ramadan 1448 (expected 8 February 2027) and backs up to its first day', () => {
    const before = ramadanDays(c, zonedTime(2026, 11, 3, 10, 0, 0, TZ), none)
    expect([before[0].year, before[0].month, before[0].day]).toEqual([2027, 2, 8])
    expect(before[0].hijri).toMatchObject({ month: 9, day: 1 })
    expect(before.length).toBeGreaterThanOrEqual(29)
    expect(before[0].times.imsak).toBe(before[0].times.day.times.fajr - 600_000)
    const during = ramadanDays(c, zonedTime(2027, 2, 20, 10, 0, 0, TZ), none)
    expect(during[0].day).toBe(8)
  })

  it('prints 12-hour times without am/pm, or 24-hour', () => {
    const t = zonedTime(2026, 11, 1, 13, 5, 0, TZ)
    expect(clock(t, TZ, false)).toBe('1:05')
    expect(clock(t, TZ, true)).toBe('13:05')
  })

  it('reads the sheet and month from the link, defaulting to this month', () => {
    const now = zonedTime(2026, 10, 27, 9, 0, 0, TZ)
    expect(optionsFromHash('#c=x&sheet=stickers&m=2027-02', now, TZ)).toEqual({ sheet: 'stickers', year: 2027, month: 2 })
    expect(optionsFromHash('#sheet=nope', now, TZ)).toEqual({ sheet: 'month', year: 2026, month: 10 })
  })

  it('keeps the QR link short and reads it back', () => {
    const hash = shortHash({ ...c, name: 'Masjid Al-Falah' }, 'tracker')
    expect(hash.length).toBeLessThan(160)
    const back = configFromShortHash(hash)!
    expect(back.name).toBe('Masjid Al-Falah')
    expect(back.place).toMatchObject({ name: 'Pasir Ris', lat: 1.3721, lng: 103.9474, tz: TZ, cc: 'SG' })
    expect(back.names).toBe('malay')
    expect(optionsFromHash(hash, Date.now(), TZ).sheet).toBe('tracker')
  })
})
