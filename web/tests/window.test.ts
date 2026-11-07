import { describe, expect, it } from 'vitest'
import type { PrayerDay } from '../src/core/engine'
import { inQuietHours, nudgeAt, openWindow, windowsOf } from '../src/core/window'
import { decodePreferences } from '../src/services/prefs'
import { applyMoved, movedFrom } from '../src/services/move'

const H = 3_600_000, M = 60_000
/** A day with simple round times, starting at `base` (local midnight). */
function day(base: number): PrayerDay {
  return {
    year: 2026, month: 11, day: 7, grade: 'D', jamaah: {}, alternate: {},
    times: { fajr: base + 5 * H + 40 * M, sunrise: base + 7 * H, dhuhr: base + 13 * H, asr: base + 16 * H + 20 * M, maghrib: base + 19 * H, isha: base + 20 * H + 15 * M },
  }
}
const D = 24 * H
const y = day(0), t = day(D), n = day(2 * D)

describe('Time left to pray', () => {
  it('finds the open prayer and when it ends', () => {
    expect(openWindow(D + 6 * H, y, t, n)).toMatchObject({ prayer: 'fajr', end: t.times.sunrise })
    expect(openWindow(D + 14 * H, y, t, n)).toMatchObject({ prayer: 'dhuhr', end: t.times.asr })
    expect(openWindow(D + 17 * H, y, t, n)).toMatchObject({ prayer: 'asr', end: t.times.maghrib })
    expect(openWindow(D + 19 * H + M, y, t, n)).toMatchObject({ prayer: 'maghrib', end: t.times.isha })
  })

  it('has nothing open between sunrise and Zohor', () => {
    expect(openWindow(D + 9 * H, y, t, n)).toBeNull()
  })

  it('keeps Isyak open until Subuh, across midnight', () => {
    const late = openWindow(D + 23 * H, y, t, n)!
    expect(late.prayer).toBe('isha')
    expect(late.end).toBe(n.times.fajr)
    const early = openWindow(D + 2 * H, y, t, n)!
    expect(early).toMatchObject({ prayer: 'isha', start: y.times.isha, end: t.times.fajr })
  })

  it('nudges 30 minutes before the end, or a third of a short window', () => {
    const [fajr, dhuhr, , maghrib] = windowsOf(t, n)
    expect(nudgeAt(dhuhr)).toBe(t.times.asr - 30 * M)
    expect(nudgeAt(fajr)).toBe(t.times.sunrise - 26 * M) // 80 min window, a third is 26 min
    expect(nudgeAt(maghrib)).toBe(t.times.isha - 25 * M) // 75 min window
  })
})

describe('Quiet hours', () => {
  it('wraps past midnight', () => {
    expect(inQuietHours(23 * 60 + 30, 23 * 60, 6 * 60)).toBe(true)
    expect(inQuietHours(3 * 60, 23 * 60, 6 * 60)).toBe(true)
    expect(inQuietHours(6 * 60, 23 * 60, 6 * 60)).toBe(false)
    expect(inQuietHours(12 * 60, 23 * 60, 6 * 60)).toBe(false)
  })
  it('works for a day sleeper', () => {
    expect(inQuietHours(10 * 60, 8 * 60, 15 * 60)).toBe(true)
    expect(inQuietHours(16 * 60, 8 * 60, 15 * 60)).toBe(false)
    expect(inQuietHours(10 * 60, 8 * 60, 8 * 60)).toBe(false)
  })
})

describe('Lifestyle settings', () => {
  it('falls back to defaults on bad values', () => {
    const p = decodePreferences({ quietFrom: 2000, quietTo: -1, jumuahReminderMinutes: 17, todayStyle: 'simple', largeText: true })
    expect(p.quietFrom).toBe(23 * 60)
    expect(p.quietTo).toBe(6 * 60)
    expect(p.jumuahReminderMinutes).toBe(0)
    expect(p.todayStyle).toBe('simple')
    expect(p.largeText).toBe(true)
    expect(decodePreferences({}).windowNudge).toBe(true)
  })
  it('moves to another phone', () => {
    const p = decodePreferences({ quietHours: true, quietFrom: 480, quietTo: 900, buzzOnly: true, largeText: true, jumuahReminderMinutes: 45, windowNudge: false })
    const m = movedFrom(p)
    expect(m).toMatchObject({ quietHours: true, quietFrom: 480, quietTo: 900, buzzOnly: true, largeText: true, jumuahReminderMinutes: 45, windowNudge: false })
    const back = applyMoved(decodePreferences({}), m)
    expect(back.quietFrom).toBe(480)
    expect(back.jumuahReminderMinutes).toBe(45)
    expect(movedFrom(decodePreferences({})).quietHours).toBeUndefined()
  })
})
