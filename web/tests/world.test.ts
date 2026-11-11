import { describe, expect, it } from 'vitest'
import { compute } from '../src/core/engine'
import { METHODS, methodWithId } from '../src/core/methods'
import { countryForTimeZone, methodHere, PROFILES, profileFor, profileMethod, sourceSummary, timeZoneForPlace } from '../src/core/regions'
import { searchCities } from '../src/services/cities'
import { officialSourceFor, officialSummary, parseLondon } from '../src/core/official'

/** The worldwide country table (data/countries.json): authority first, standard method only as a fallback. */
describe('Countries worldwide', () => {
  it('has a known method for every country', () => {
    for (const p of PROFILES) expect(methodWithId(p.methodID), p.code).toBeDefined()
    expect(PROFILES.length).toBeGreaterThan(140)
  })

  it('follows the authority where there is one', () => {
    expect(profileFor('SA')).toMatchObject({ methodID: 'ummalqura', source: 'authority' })
    expect(profileFor('TR')).toMatchObject({ methodID: 'diyanet', source: 'authority', asr: 'standard' })
    expect(profileFor('EG')).toMatchObject({ methodID: 'egyptian', source: 'authority' })
    expect(profileFor('MA')).toMatchObject({ methodID: 'morocco', source: 'authority' })
    expect(profileFor('SG')).toMatchObject({ methodID: 'muis', source: 'table' })
  })

  it('uses a northern method in the UK and says why', () => {
    const uk = profileFor('GB')!
    expect(uk).toMatchObject({ methodID: 'moonsighting', source: 'standard' })
    expect(sourceSummary(uk, profileMethod(uk), false)).toContain('London Unified Prayer Timetable')
  })

  it('writes every source line without colons or dashes', () => {
    for (const p of PROFILES) {
      for (const [pinned, short] of [[false, false], [true, false], [false, true], [true, true]]) {
        const text = sourceSummary(p, profileMethod(p), pinned, short)
        expect(text, p.code).not.toMatch(/:|\s-\s|–|—/)
        expect(text, p.code).not.toContain('undefined')
      }
    }
  })

  it("applies the country's summer night rule, also to a method chosen in Settings", () => {
    const oslo = { latitude: 59.9139, longitude: 10.7522 }
    const norway = profileFor('NO')!
    // Midsummer: 17° is never reached, so Isha is capped at a share of the short night.
    const day = compute(2026, 6, 21, oslo, profileMethod(norway), 'standard')
    const night = (day.times.sunrise + 86_400_000 - day.times.maghrib) / 3_600_000
    const ishaAfterSunset = (day.times.isha - day.times.maghrib) / 3_600_000
    expect(ishaAfterSunset).toBeLessThan(night * 17 / 60 + 0.05)
    expect(methodHere(METHODS.egyptian, norway).highLatitude).toBe('angle')
    expect(methodHere(METHODS.moonsighting, norway).highLatitude).toBe('moonsighting')
  })

  it('leaves Asian countries on their original rule', () => {
    expect(profileMethod(profileFor('MY')!).highLatitude).toBe('fallback')
    expect(profileMethod(profileFor('ID')!).highLatitude).toBe('fallback')
  })

  it('finds world cities offline, in the right time zone', () => {
    expect(searchCities('London')[0]).toMatchObject({ countryCode: 'GB', timeZoneID: 'Europe/London' })
    expect(searchCities('Toronto')[0]).toMatchObject({ countryCode: 'CA', timeZoneID: 'America/Toronto' })
    expect(searchCities('Madinah')[0]).toMatchObject({ countryCode: 'SA' })
    expect(timeZoneForPlace('US', -118.2)).toBe('America/Los_Angeles')
    expect(timeZoneForPlace('US', -74)).toBe('America/New_York')
    expect(countryForTimeZone('Europe/Paris')).toBe('FR')
  })

  it('uses the London Unified timetable in London only, from the published file', () => {
    const gb = profileMethod(profileFor('GB')!)
    const place = (latitude: number, longitude: number) => ({ id: 'x', name: 'x', countryCode: 'GB', timeZoneID: 'Europe/London', coordinates: { latitude, longitude } })
    expect(officialSourceFor(place(51.515, -0.072), gb, null)).toEqual({ kind: 'london' })   // Whitechapel
    expect(officialSourceFor(place(51.556, -0.28), gb, null)).toEqual({ kind: 'london' })    // Wembley
    expect(officialSourceFor(place(52.4862, -1.8904), gb, null)).toBeNull()                   // Birmingham
    expect(officialSourceFor(place(51.515, -0.072), METHODS.mwl, null)).toBeNull()            // a method chosen in Settings
    const table = parseLondon({ times: {
      '2026-06-21': { fajr: '02:36', sunrise: '04:43', dhuhr: '13:03', asr: '17:24', maghrib: '21:21', isha: '22:41' },
      '2026-11-11': { fajr: '05:43', sunrise: '07:13', dhuhr: '11:53', asr: '1:57', maghrib: '16:17', isha: '17:51' },
      'bad': { fajr: '05:00' },
    } })
    expect(Object.keys(table)).toEqual(['2026-06-21', '2026-11-11'])
    expect(table['2026-11-11'].sunrise).toBe('07:13')
    for (const short of [false, true]) expect(officialSummary({ kind: 'london' }, short)).not.toMatch(/:|\s-\s|–|—/)
  })
})
