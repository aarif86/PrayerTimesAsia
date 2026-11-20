import { describe, expect, it } from 'vitest'
import { lead, openPrayer } from '../src/core/prayer'

// Same cases as ios/PrayerTimesAsiaTests/PrayerLeadTests.swift.
describe('what leads the Prayer screen', () => {
  const t = 1_800_000_000_000
  it('an open prayer leads as NOW', () => {
    expect(lead({ prayer: 'asr', time: t }, { prayer: 'maghrib', time: t + 3_600_000 })).toEqual({ prayer: 'asr', time: t, isNext: false })
    expect(openPrayer({ prayer: 'asr', time: t })?.prayer).toBe('asr')
  })
  it('from Syuruk to Zohor the next prayer leads', () => {
    expect(lead({ prayer: 'sunrise', time: t }, { prayer: 'dhuhr', time: t + 3_180_000 })).toEqual({ prayer: 'dhuhr', time: t + 3_180_000, isNext: true })
    expect(openPrayer({ prayer: 'sunrise', time: t })).toBeNull()
  })
  it('Subuh stays open until Syuruk', () => {
    expect(lead({ prayer: 'fajr', time: t }, { prayer: 'sunrise', time: t + 600_000 })?.prayer).toBe('fajr')
  })
  it('nothing without times', () => {
    expect(lead(null, { prayer: 'dhuhr', time: t })).toBeNull()
  })
})
