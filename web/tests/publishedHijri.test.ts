import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { communityHijri, publishedHijri } from '../src/core/season'
import { islamicDaysOf } from '../src/core/islamicDays'

const cal = JSON.parse(readFileSync(new URL('../../data/calendar.json', import.meta.url), 'utf8'))

describe('MUIS published Hijri calendar', () => {
  const h = (y: number, m: number, d: number) => communityHijri({ year: y, month: m, day: d }, 0, cal.announcements, 'MUIS', cal.month_starts)
  it('follows MUIS month starts, not Umm al-Qura', () => {
    expect(h(2027, 3, 10)).toEqual({ year: 1448, month: 10, day: 1 }) // Hari Raya Aidilfitri
    expect(h(2027, 5, 17)).toEqual({ year: 1448, month: 12, day: 10 }) // Hari Raya Aidiladha
    expect(h(2027, 1, 6)).toEqual({ year: 1448, month: 7, day: 27 }) // Israk Mikraj
    expect(h(2027, 8, 15)).toEqual({ year: 1449, month: 3, day: 12 }) // Maulidur Rasul
  })
  it('marks the MUIS key days', () => {
    expect(islamicDaysOf(h(2027, 6, 15)).map((k) => k.kind)).toContain('ashura')
    expect(islamicDaysOf(h(2027, 2, 24)).map((k) => k.kind)).toContain('nuzulQuran')
  })
  it('falls back outside the table and for other authorities', () => {
    expect(publishedHijri({ year: 2030, month: 1, day: 1 }, cal.month_starts, 'MUIS')).toBeNull()
    expect(publishedHijri({ year: 2027, month: 3, day: 10 }, cal.month_starts, 'JAKIM')).toBeNull()
  })
})
