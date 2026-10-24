import { describe, expect, it } from 'vitest'
import { announcementDate, basisLabel, defaultAuthority, expectedDate, upcomingEvents, type CalendarDataset } from '../src/core/calendarSanad'
import { prayerName } from '../src/core/prayer'
import { personalNaming } from '../src/core/regions'
import { zonedTime } from '../src/core/tz'

/** Your names follow you; the local word only shows when it differs (iOS NamingTests). */
describe('Prayer names', () => {
  it('come from home, then the browser', () => {
    expect(personalNaming('SG', 'en-AU')).toBe('malay')
    expect(personalNaming('ID', 'en-AU')).toBe('indonesian')
    expect(personalNaming('TR', 'en-AU')).toBe('turkish')
    expect(personalNaming(null, 'en-AU')).toBe('arabic')
    expect(personalNaming(null, 'ms-MY')).toBe('malay')
    expect(personalNaming(null, 'en_PK')).toBe('southAsian')
    expect(personalNaming('AU', 'id-ID')).toBe('indonesian')
  })

  it("follow each authority's spelling", () => {
    expect(prayerName('dhuhr', 'malay')).toBe('Zohor')
    expect(prayerName('dhuhr', 'indonesian')).toBe('Dzuhur')
    expect(prayerName('fajr', 'arabic')).toBe('Fajr')
    expect(prayerName('dhuhr', 'turkish', true)).toBe('Cuma')
  })
})

/** Calendar sanad (iOS CalendarSanadTests). */
describe('Calendar sanad', () => {
  it('gives the Umm al-Qura estimates for 1448', () => {
    expect(expectedDate('1_ramadan', 1448)).toEqual({ year: 2027, month: 2, day: 8 })
    expect(expectedDate('1_syawal', 1448)).toEqual({ year: 2027, month: 3, day: 9 })
    expect(expectedDate('10_zulhijjah', 1448)).toEqual({ year: 2027, month: 5, day: 16 })
    expect(expectedDate('1_muharram', 1449)).toEqual({ year: 2027, month: 6, day: 6 })
  })

  it('lists upcoming events in order', () => {
    const next = upcomingEvents(zonedTime(2026, 10, 22, 12, 0, 0, 'Asia/Singapore'), 'Asia/Singapore')
    expect(next.map((x) => x.event)).toEqual(['1_ramadan', '1_syawal', '10_zulhijjah', '1_muharram'])
    expect(next.map((x) => x.hijriYear)).toEqual([1448, 1448, 1448, 1449])
  })

  it('decodes an announcement', () => {
    const data: CalendarDataset = JSON.parse(`{"version":1,"licence":"CC-BY-4.0","announcements":[
      {"event":"1_ramadan","hijri_year":1448,"authority":"MUIS","country":"SG","date":"2027-02-08",
       "status":"announced","basis":"hisab","source_url":"https://example.org","announced_at":"2027-02-07T20:00:00+08:00"}]}`)
    const a = data.announcements[0]
    expect(a.event).toBe('1_ramadan')
    expect(a.status).toBe('announced')
    expect(announcementDate(a)).toEqual({ year: 2027, month: 2, day: 8 })
    expect(basisLabel(a.basis)).toBe('calculation')
    expect(defaultAuthority('SG')).toBe('MUIS')
  })
})
