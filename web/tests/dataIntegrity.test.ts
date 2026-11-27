import { describe, expect, it } from 'vitest'
import { COUNTRY_ROWS, TZ_COUNTRY, WORLD_CITIES } from '../src/core/countries'
import { JAKIM_POINTS, JAKIM_ZONES } from '../src/core/jakimZones'
import { BUNDLED_CALENDAR, withBundled } from '../src/core/bundledCalendar'
import { ALL_METHODS, methodWithId } from '../src/core/methods'
import { countryForTimeZone, flag, profileFor, timeZoneForCountry } from '../src/core/regions'
import { nearestJakimZone } from '../src/core/official'
import { isValidTimeZone } from '../src/core/tz'
import { CITIES, nearestCity, searchCities } from '../src/services/cities'

// The shared tables must be whole: a typo in one row would show as a wrong place, zone or time at the other end of the world.

describe('country table', () => {
  it('has one row per country code, each with a known method', () => {
    const codes = COUNTRY_ROWS.map((r) => r.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const r of COUNTRY_ROWS) {
      expect(r.code).toMatch(/^[A-Z]{2}$/)
      expect(r.name.length).toBeGreaterThan(1)
      expect(methodWithId(r.methodID), `${r.code} uses method ${r.methodID}`).toBeDefined()
    }
    expect(ALL_METHODS.length).toBeGreaterThan(5)
  })
  it('names who the times come from when a country follows an authority or a table', () => {
    for (const r of COUNTRY_ROWS) {
      if (r.source === 'table' || r.source === 'authority') expect(r.authority, `${r.code} needs an authority name`).toBeTruthy()
    }
  })
  it('only lists real time zones, for countries that are in the table', () => {
    // Zone names that newer time zone databases folded into another zone. A phone that still reports one should still find its country.
    const RETIRED_NAMES = new Set(['Europe/Kazan'])
    for (const [tz, code] of Object.entries(TZ_COUNTRY)) {
      if (!RETIRED_NAMES.has(tz)) expect(isValidTimeZone(tz), tz).toBe(true)
      expect(profileFor(code), `${tz} points at ${code}`).toBeDefined()
    }
  })
  it('guesses the country from a time zone and a zone from a country', () => {
    expect(countryForTimeZone('Asia/Singapore')).toBe('SG')
    expect(countryForTimeZone('Asia/Kuala_Lumpur')).toBe('MY')
    expect(countryForTimeZone('Nowhere/Land')).toBeUndefined()
    expect(timeZoneForCountry('sg')).toBe('Asia/Singapore')
    expect(timeZoneForCountry(null)).toBeUndefined()
    expect(timeZoneForCountry('ZZ')).toBeUndefined()
  })
  it('finds a profile whatever the letter case, and nothing for empty or unknown codes', () => {
    expect(profileFor('sg')?.name).toBe('Singapore')
    expect(profileFor('')).toBeUndefined()
    expect(profileFor(undefined)).toBeUndefined()
    expect(profileFor('ZZ')).toBeUndefined()
  })
  it('makes a flag from two letters', () => {
    expect(flag('SG')).toBe('🇸🇬')
    expect(flag('my')).toBe('🇲🇾')
    expect(flag('')).toBe('')
  })
})

describe('world cities', () => {
  it('have real coordinates, a real time zone and a country in the table', () => {
    for (const [name, , code, lat, lng, tz] of WORLD_CITIES) {
      expect(lat, name).toBeGreaterThanOrEqual(-90)
      expect(lat, name).toBeLessThanOrEqual(90)
      expect(lng, name).toBeGreaterThanOrEqual(-180)
      expect(lng, name).toBeLessThanOrEqual(180)
      expect(isValidTimeZone(tz), `${name}: ${tz}`).toBe(true)
      expect(profileFor(code), `${name}: ${code}`).toBeDefined()
    }
  })
  it('give every place in the search list a unique id and a valid zone', () => {
    const ids = CITIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CITIES) expect(isValidTimeZone(c.timeZoneID), `${c.name}: ${c.timeZoneID}`).toBe(true)
  })
})

describe('city search', () => {
  it('finds a city from the start of its name, ignoring capitals and accents', () => {
    expect(searchCities('singap')[0]?.countryCode).toBe('SG')
    expect(searchCities('LONDON')[0]?.name).toBe('London')
    expect(searchCities('  london  ')[0]?.name).toBe('London')
  })
  it('returns nothing for an empty search and respects the limit', () => {
    expect(searchCities('')).toEqual([])
    expect(searchCities('   ')).toEqual([])
    expect(searchCities('a', 3).length).toBeLessThanOrEqual(3)
    expect(searchCities('zzzzqqq')).toEqual([])
  })
  it('names a GPS fix only when a listed place is near', () => {
    const sg = CITIES.find((c) => c.name === 'Singapore City')
    expect(sg).toBeDefined()
    expect(nearestCity(sg!.coordinates.latitude, sg!.coordinates.longitude)?.id).toBe(sg!.id)
    expect(nearestCity(-60, -30)).toBeNull() // the South Atlantic
  })
})

describe('JAKIM zones', () => {
  it('have unique ids and every point belongs to a listed zone', () => {
    const ids = JAKIM_ZONES.map((z) => z.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const z of JAKIM_ZONES) expect(z.id).toMatch(/^[A-Z]{3}\d{2}$/)
    for (const [zone, lat, lng] of JAKIM_POINTS) {
      expect(ids, `point ${lat},${lng}`).toContain(zone)
      expect(lat).toBeGreaterThan(0)
      expect(lat).toBeLessThan(8) // Malaysia sits between about 0.8 and 7.4 degrees north
      expect(lng).toBeGreaterThan(98)
      expect(lng).toBeLessThan(120)
    }
  })
  it('have at least one point for every zone, so every zone can be found', () => {
    const used = new Set(JAKIM_POINTS.map((p) => p[0]))
    for (const z of JAKIM_ZONES) expect(used.has(z.id), `${z.id} has no point`).toBe(true)
  })
  it('pick the right zone for well known places', () => {
    expect(nearestJakimZone({ latitude: 3.139, longitude: 101.6869 })).toBe('WLY01') // Kuala Lumpur
    expect(nearestJakimZone({ latitude: 1.4927, longitude: 103.7414 })).toBe('JHR02') // Johor Bahru
    expect(nearestJakimZone({ latitude: 5.4141, longitude: 100.3288 })).toBe('PNG01') // George Town
    expect(nearestJakimZone({ latitude: 6.1254, longitude: 100.3673 })).toMatch(/^PLS|^KDH/) // Alor Setar and Kangar
  })
})

describe('bundled Hijri calendar', () => {
  it('is there offline and has the month starts and announcements the app reads', () => {
    expect(BUNDLED_CALENDAR.announcements.length).toBeGreaterThan(0)
    expect(BUNDLED_CALENDAR.month_starts?.length ?? 0).toBeGreaterThan(0)
    for (const a of BUNDLED_CALENDAR.announcements) expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('keeps the bundled data when a download is missing or has empty parts', () => {
    expect(withBundled(null)).toBe(BUNDLED_CALENDAR)
    expect(withBundled(undefined)).toBe(BUNDLED_CALENDAR)
    const empty = withBundled({ version: 9, licence: 'x', announcements: [], month_starts: [] })
    expect(empty.announcements).toEqual(BUNDLED_CALENDAR.announcements)
    expect(empty.month_starts).toEqual(BUNDLED_CALENDAR.month_starts)
    expect(empty.version).toBe(9)
  })
  it('prefers a newer download that has data', () => {
    const one = { ...BUNDLED_CALENDAR.announcements[0] }
    const got = withBundled({ version: 9, licence: 'x', announcements: [one], month_starts: [] })
    expect(got.announcements).toEqual([one])
    expect(got.month_starts).toEqual(BUNDLED_CALENDAR.month_starts)
  })
})
