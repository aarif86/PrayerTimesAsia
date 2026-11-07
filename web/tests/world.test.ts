import { describe, expect, it } from 'vitest'
import { compute } from '../src/core/engine'
import { METHODS, methodWithId } from '../src/core/methods'
import { countryForTimeZone, methodHere, PROFILES, profileFor, profileMethod, sourceSummary, timeZoneForPlace } from '../src/core/regions'
import { searchCities } from '../src/services/cities'

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
})
