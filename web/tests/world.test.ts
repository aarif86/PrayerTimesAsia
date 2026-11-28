import { describe, expect, it } from 'vitest'
import { compute } from '../src/core/engine'
import { METHODS, methodWithId, withHighLatitude } from '../src/core/methods'
import { countryForTimeZone, methodHere, PROFILES, profileFor, profileMethod, sourceSummary, timeZoneForPlace } from '../src/core/regions'
import { searchCities } from '../src/services/cities'
import { bruneiFeed, officialSourceFor, officialSummary, parseLondon } from '../src/core/official'

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

  it('follows the Balkan authorities with their own methods', () => {
    expect(profileFor('BA')).toMatchObject({ methodID: 'icbih', source: 'authority', asr: 'standard' })
    expect(profileFor('AL')).toMatchObject({ methodID: 'kmsh', source: 'authority', asr: 'standard' })
  })

  it('matches the published Takvim for Sarajevo and the KMSH calendar for Tirana', () => {
    // vaktija.ba (Islamic Community) Sarajevo 18 July 2026 and the KMSH 2026 calendar, Tirana 1 January 2026.
    const minutesIn = (ms: number, tz: string) => {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))
      return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value)
    }
    const check = (day: ReturnType<typeof compute>, tz: string, published: string[]) => {
      const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
      keys.forEach((k, i) => {
        const [h, m] = published[i].split(':').map(Number)
        const diff = minutesIn(day.times[k], tz) - (h * 60 + m)
        expect(Math.abs(diff), k).toBeLessThanOrEqual(3)
        // Never earlier than the published time (sunrise never later).
        expect(k === 'sunrise' ? diff <= 0 : diff >= 0, k).toBe(true)
      })
    }
    check(compute(2026, 7, 18, { latitude: 43.8563, longitude: 18.4131 }, METHODS.icbih, 'standard'), 'Europe/Sarajevo',
      ['3:09', '5:13', '12:53', '16:56', '20:31', '22:17'])
    check(compute(2026, 1, 1, { latitude: 41.3275, longitude: 19.8187 }, METHODS.kmsh, 'standard'), 'Europe/Tirane',
      ['5:27', '7:00', '11:49', '14:08', '16:28', '17:55'])
  })

  it('matches the Kazakhstan board formula in Almaty and, with its northern minutes, in Astana', () => {
    // Reference days made with the board's own PrayTimes script (ISNA, Hanafi, angle based, UTC+5), 15th of the month, minutes after midnight.
    const days: [number, number, number, number[]][] = [
      [43.2389, 76.8897, 1, [358, 439, 725, 903, 1005, 1086]], [43.2389, 76.8897, 6, [143, 249, 716, 1035, 1177, 1283]],
      [43.2389, 76.8897, 9, [252, 329, 711, 975, 1086, 1163]], [51.1694, 71.4491, 1, [392, 487, 749, 894, 1001, 1095]],
      [51.1694, 71.4491, 6, [127, 233, 740, 1076, 1236, 1343]], [51.1694, 71.4491, 9, [255, 344, 734, 994, 1114, 1203]],
    ]
    const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
    const minutesIn = (ms: number) => {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))
      return Number(p[0].value) * 60 + Number(p[2].value)
    }
    for (const [latitude, longitude, month, ref] of days) {
      const day = compute(2026, month, 15, { latitude, longitude }, withHighLatitude(METHODS.qmdb, 'angle'), 'hanafi')
      keys.forEach((k, i) => expect(Math.abs(minutesIn(day.times[k]) - ref[i]), `${latitude} ${month} ${k}`).toBeLessThanOrEqual(1))
    }
    expect(profileFor('KZ')).toMatchObject({ methodID: 'qmdb', source: 'authority', asr: 'hanafi' })
  })

  it('matches the Kyrgyz Muftiyat calendar for Bishkek, never earlier', () => {
    // muftiyat.kg Bishkek 2026 (UTC+6): 15 January, 15 April, 15 July, 15 October.
    const days: [number, number, string[]][] = [
      [1, 15, ['06:49', '08:29', '13:11', '16:11', '17:58', '19:21']], [4, 15, ['04:38', '06:20', '13:02', '17:46', '19:50', '21:12']],
      [7, 15, ['03:27', '05:36', '13:08', '18:23', '20:45', '22:29']], [10, 15, ['05:40', '07:14', '12:48', '16:37', '18:27', '19:43']],
    ]
    const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
    const minutesIn = (ms: number) => {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))
      return Number(p[0].value) * 60 + Number(p[2].value)
    }
    for (const [month, dayOfMonth, ref] of days) {
      const day = compute(2026, month, dayOfMonth, { latitude: 42.8746, longitude: 74.5698 }, METHODS.muftiyatkg, 'hanafi')
      keys.forEach((k, i) => {
        const [h, m] = ref[i].split(':').map(Number)
        const diff = minutesIn(day.times[k]) - (h * 60 + m)
        expect(Math.abs(diff), `${month} ${k}`).toBeLessThanOrEqual(2)
        expect(k === 'sunrise' ? diff <= 0 : diff >= 0, `${month} ${k} safe side`).toBe(true)
      })
    }
    expect(profileFor('KG')).toMatchObject({ methodID: 'muftiyatkg', source: 'authority', asr: 'hanafi' })
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

  it("uses Brunei's Ministry of Religious Affairs timetable, by KHEU zone", () => {
    const bn = profileMethod(profileFor('BN')!)
    expect(profileFor('BN')!.source).toBe('table')
    const place = (latitude: number, longitude: number) => ({ id: 'x', name: 'x', countryCode: 'BN', timeZoneID: 'Asia/Brunei', coordinates: { latitude, longitude } })
    expect(officialSourceFor(place(4.9031, 114.9398), bn, null)).toEqual({ kind: 'brunei', zone: 'BRN01' }) // Bandar Seri Begawan
    expect(officialSourceFor(place(4.7086, 115.0717), bn, null)).toEqual({ kind: 'brunei', zone: 'BRN01' }) // Bangar, Temburong
    expect(officialSourceFor(place(4.8028, 114.6497), bn, null)).toEqual({ kind: 'brunei', zone: 'BRN02' }) // Tutong
    expect(officialSourceFor(place(4.5836, 114.2312), bn, null)).toEqual({ kind: 'brunei', zone: 'BRN03' }) // Kuala Belait
    expect(officialSourceFor(place(4.9031, 114.9398), METHODS.mwl, null)).toBeNull()                       // a method chosen in Settings
    expect(bruneiFeed('BRN03')).toMatch(/\/feeds\/bn-brn03\.json$/)
    expect(sourceSummary(profileFor('BN')!, bn, false, true)).toBe('Official timetable from the Ministry of Religious Affairs, Brunei.')
  })
})
