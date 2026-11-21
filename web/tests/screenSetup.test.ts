import { describe, expect, it } from 'vitest'
import { decodeConfig, DEFAULT_CONFIG, encodeConfig, NO_HIDE, sanitize } from '../src/screen/config'
import { nextClockFix } from '../src/screen/live'
import { inFridayWindow } from '../src/screen/model'

describe('masjid screen links made before the show or hide switches', () => {
  it('show everything and have no Friday line', () => {
    const { hide, fridayNote, ...old } = DEFAULT_CONFIG
    void hide; void fridayNote
    const c = decodeConfig(encodeConfig(old as typeof DEFAULT_CONFIG))!
    expect(c.hide).toEqual(NO_HIDE)
    expect(c.fridayNote).toBe('')
  })
  it('keep only real switches and a short Friday line', () => {
    const c = sanitize({ ...DEFAULT_CONFIG, hide: { clock: true, times: 'yes', bogus: true }, fridayNote: `  ${'x'.repeat(300)}  ` })
    expect(c.hide).toEqual({ ...NO_HIDE, clock: true })
    expect(c.fridayNote.length).toBe(100)
  })
})

describe('Friday line', () => {
  const maghrib = 1000, dhuhr = 5000
  it('shows Thursday after Maghrib, not before', () => {
    expect(inFridayWindow(4, maghrib - 1, maghrib, dhuhr)).toBe(false)
    expect(inFridayWindow(4, maghrib, maghrib, dhuhr)).toBe(true)
  })
  it('shows Friday until an hour and a half after Zohor', () => {
    expect(inFridayWindow(5, dhuhr + 89 * 60_000, maghrib, dhuhr)).toBe(true)
    expect(inFridayWindow(5, dhuhr + 90 * 60_000, maghrib, dhuhr)).toBe(false)
    expect(inFridayWindow(6, 0, maghrib, dhuhr)).toBe(false)
  })
})

describe('TV clock correction', () => {
  it('starts at 30 seconds out and does not flip near the line', () => {
    expect(nextClockFix(0, 20_000)).toBe(0)
    expect(nextClockFix(0, 31_000)).toBe(31_000)
    expect(nextClockFix(31_000, 25_000)).toBe(25_000)
    expect(nextClockFix(25_000, 5_000)).toBe(0)
    expect(nextClockFix(0, -300_000)).toBe(-300_000)
  })
})
