import { describe, expect, it } from 'vitest'
import { hoursAt, parseHours } from '../src/core/openingHours'

describe('opening hours', () => {
  it('reads the usual mall prayer room hours', () => {
    expect(hoursAt('Mo-Su 10:00-22:00', 2, 9 * 60)).toEqual({ open: false, opensAt: '10:00' })
    expect(hoursAt('Mo-Su 10:00-22:00', 2, 13 * 60)).toEqual({ open: true, until: '22:00' })
    expect(hoursAt('24/7', 6, 3 * 60)).toEqual({ open: true, until: undefined })
  })
  it('lets later rules win and knows days off', () => {
    const h = 'Mo-Fr 08:00-20:00; Sa,Su off'
    expect(hoursAt(h, 4, 12 * 60)?.open).toBe(true)
    expect(hoursAt(h, 5, 12 * 60)).toEqual({ open: false, opensAt: undefined })
  })
  it('handles late nights past midnight', () => {
    expect(hoursAt('Mo-Su 18:00-02:00', 1, 60)).toEqual({ open: true, until: '02:00' })
  })
  it('says nothing about hours it does not understand', () => {
    expect(parseHours('Jan-Mar Mo-Fr 09:00-17:00')).toBeNull()
    expect(parseHours('sunrise-sunset')).toBeNull()
    expect(parseHours('')).toBeNull()
  })
})
