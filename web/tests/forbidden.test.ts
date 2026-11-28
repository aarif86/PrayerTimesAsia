import { describe, expect, it } from 'vitest'
import { noPrayerNow, noPrayerWindows } from '../src/core/forbidden'
import type { PrayerDay } from '../src/core/engine'

const at = (h: number, m = 0) => Date.UTC(2026, 10, 28, h, m)
const day = { year: 2026, month: 11, day: 28, grade: 'A', jamaah: {}, alternate: {},
  times: { fajr: at(5), sunrise: at(7), dhuhr: at(13, 12), asr: at(16, 30), maghrib: at(19), isha: at(20, 15) } } as unknown as PrayerDay

describe('times not to pray', () => {
  it('gives three windows in order, zenith ending at Zuhr', () => {
    const w = noPrayerWindows(day)
    expect(w.map((x) => x.kind)).toEqual(['sunrise', 'zenith', 'sunset'])
    expect(w[1].to).toBe(day.times.dhuhr)
    expect(w[0].to).toBeGreaterThan(w[0].from)
  })
  it('says inside a window, or when the next one starts', () => {
    expect(noPrayerNow(day, at(7, 5)).inside).toBe('sunrise')
    expect(noPrayerNow(day, at(10)).inside).toBeNull()
    expect(noPrayerNow(day, at(10)).next?.kind).toBe('zenith')
    expect(noPrayerNow(day, at(21)).next).toBeNull()
  })
})
