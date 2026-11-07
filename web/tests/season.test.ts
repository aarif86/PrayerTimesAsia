import { describe, expect, it } from 'vitest'
import type { CalendarAnnouncement } from '../src/core/calendarSanad'
import { baseHijri, communityHijri, previewShift, seasonFor } from '../src/core/season'
import { parseMasjidLink, masjidQuery } from '../src/core/masjidLink'

// Umm al-Qura: 1 Ramadan 1448 = 8 Feb 2027, 1 Syawal 1448 = 9 Mar 2027.
const ann = (event: '1_ramadan' | '1_syawal', date: string, status: 'expected' | 'announced' = 'announced'): CalendarAnnouncement =>
  ({ event, hijri_year: 1448, authority: 'MUIS', country: 'SG', date, status, basis: 'rukyah' })

describe('community Hijri dates', () => {
  it('uses Umm al-Qura when nothing is announced', () => {
    expect(baseHijri({ year: 2027, month: 2, day: 8 })).toEqual({ year: 1448, month: 9, day: 1 })
    expect(communityHijri({ year: 2027, month: 2, day: 8 }, 0, [], 'MUIS')).toEqual({ year: 1448, month: 9, day: 1 })
  })

  it('starts Ramadan a day later when the authority says so', () => {
    const list = [ann('1_ramadan', '2027-02-09')]
    expect(communityHijri({ year: 2027, month: 2, day: 8 }, 0, list, 'MUIS')).toEqual({ year: 1448, month: 8, day: 30 })
    expect(communityHijri({ year: 2027, month: 2, day: 9 }, 0, list, 'MUIS')).toEqual({ year: 1448, month: 9, day: 1 })
    expect(communityHijri({ year: 2027, month: 3, day: 1 }, 0, list, 'MUIS')).toEqual({ year: 1448, month: 9, day: 21 })
    // Another authority's announcement changes nothing for MUIS users.
    expect(communityHijri({ year: 2027, month: 2, day: 8 }, 0, list, 'JAKIM')).toEqual({ year: 1448, month: 9, day: 1 })
  })

  it('ends Ramadan on the announced Raya', () => {
    const list = [ann('1_ramadan', '2027-02-09'), ann('1_syawal', '2027-03-10')]
    // Umm al-Qura makes 9 March Raya; MUIS, a day behind, keeps it as 29 Ramadan.
    expect(communityHijri({ year: 2027, month: 3, day: 9 }, 0, list, 'MUIS')).toEqual({ year: 1448, month: 9, day: 29 })
    expect(communityHijri({ year: 2027, month: 3, day: 10 }, 0, list, 'MUIS')).toEqual({ year: 1448, month: 10, day: 1 })
    expect(communityHijri({ year: 2027, month: 3, day: 11 }, 0, list, 'MUIS')).toEqual({ year: 1448, month: 10, day: 2 })
  })

  it('prefers an announcement over an expected date', () => {
    const list = [ann('1_ramadan', '2027-02-08', 'expected'), ann('1_ramadan', '2027-02-09')]
    expect(communityHijri({ year: 2027, month: 2, day: 9 }, 0, list, 'MUIS').day).toBe(1)
  })
})

describe('season', () => {
  it('knows the nights', () => {
    expect(seasonFor({ year: 1448, month: 8, day: 29 }).sightingTonight).toBe('1_ramadan')
    expect(seasonFor({ year: 1448, month: 8, day: 29 }).nightTonight).toBe(1)
    const d20 = seasonFor({ year: 1448, month: 9, day: 20 })
    expect(d20.lastTen).toBe(true)
    expect(d20.oddNight).toBe(true) // night 21
    expect(seasonFor({ year: 1448, month: 9, day: 21 }).oddNight).toBe(false)
    expect(seasonFor({ year: 1448, month: 9, day: 29 }).sightingTonight).toBe('1_syawal')
    expect(seasonFor({ year: 1448, month: 10, day: 1 }).phase).toBe('raya')
    expect(seasonFor({ year: 1448, month: 10, day: 2 }).phase).toBe('syawal')
    expect(seasonFor({ year: 1448, month: 7, day: 2 }).phase).toBe('none')
  })

  it('moves today onto the tester\'s chosen day', () => {
    const today = { year: 2026, month: 11, day: 7 }
    const shift = previewShift(today, 'ramadan')
    const t = new Date(Date.UTC(2026, 10, 7 + shift))
    expect(baseHijri({ year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() })).toMatchObject({ month: 9, day: 12 })
    expect(previewShift(today, 'off')).toBe(0)
  })
})

describe('masjid link', () => {
  it('carries the Raya prayer time', () => {
    const q = masjidQuery({ name: 'M', lat: 1, lng: 103, tz: 'Asia/Singapore', cc: 'SG', jamaah: {}, jumuah: null, eid: '08:00' })
    expect(q).toContain('e=08:00')
    expect(parseMasjidLink(q)?.eid).toBe('08:00')
  })
})
