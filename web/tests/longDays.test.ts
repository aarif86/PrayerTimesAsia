import { describe, expect, it } from 'vitest'
import { LONG_DAYS_WORDS, longDaysKey, twilightLastsAllNight } from '../src/core/longDays'
import { METHODS } from '../src/core/methods'

const mwl = METHODS.mwl

describe('long summer days note', () => {
  it('shows in London and Oslo around midsummer', () => {
    expect(twilightLastsAllNight(2027, 6, 21, 51.51, mwl)).toBe(true)
    expect(twilightLastsAllNight(2027, 7, 10, 59.91, mwl)).toBe(true)
  })

  it('stays away in winter, in the tropics and in the south of Europe', () => {
    expect(twilightLastsAllNight(2027, 12, 21, 51.51, mwl)).toBe(false)
    expect(twilightLastsAllNight(2027, 6, 21, 1.35, mwl)).toBe(false)
    expect(twilightLastsAllNight(2027, 6, 21, 41.01, mwl)).toBe(false)
    expect(twilightLastsAllNight(2027, 6, 21, -33.87, mwl)).toBe(false)
  })

  it('stops in London once the nights get dark enough again', () => {
    // MWL Fajr 18°: from about the middle of August the sun gets lower than 18° in London.
    expect(twilightLastsAllNight(2027, 9, 15, 51.51, mwl)).toBe(false)
    expect(twilightLastsAllNight(2027, 3, 15, 51.51, mwl)).toBe(false)
  })

  it('works in the far south in December', () => {
    expect(twilightLastsAllNight(2027, 12, 21, -54.8, mwl)).toBe(true)
    expect(twilightLastsAllNight(2027, 6, 21, -54.8, mwl)).toBe(false)
  })

  it('makes one key per place and summer', () => {
    expect(longDaysKey(2027, 6, 51.51, -0.13, 'GB')).toBe('GB:52:0:2027')
    expect(longDaysKey(2027, 8, 51.4, -0.2, 'GB')).toBe('GB:51:0:2027')
    // A southern summer belongs to the year it began in.
    expect(longDaysKey(2028, 1, -54.8, -68.3, 'AR')).toBe(longDaysKey(2027, 12, -54.8, -68.3, 'AR'))
  })

  it('has every line in English, Malay and Indonesian, with no colons or dashes', () => {
    for (const w of Object.values(LONG_DAYS_WORDS)) {
      const text = [w.title, w.body('Fajr', 'Isha'), w.close].join(' ')
      expect(text).not.toMatch(/[:–—]| - /)
      expect(text).toContain('Fajr')
    }
  })
})
