import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compute } from '../src/core/engine'
import { METHODS } from '../src/core/methods'
import {
  jakimDate, looksLikePrayerSpace, matchKemenagCity, nearestJakimZone, officialSourceFor,
  parseFeedICS, parseJAKIM, parseKemenag, parseMUIS,
} from '../src/core/official'
import type { Place } from '../src/core/place'
import { disagreements, jamaahTimes, mosqueMethod, mosqueNear, type MosqueDataset } from '../src/core/sources'
import { zoned } from '../src/core/tz'

/** Parsers use the exact response shapes seen from e-solat.gov.my, data.gov.sg and myquran (iOS OfficialTimetablesTests). */
describe('Official timetables', () => {
  it('parses JAKIM with Malay months', () => {
    const json = { prayerTime: [
      { hijri: '1447-07-11', date: '01-Jan-2026', day: 'Thursday', imsak: '05:56:00', fajr: '06:06:00', syuruk: '07:18:00', dhuha: '07:43:00', dhuhr: '13:19:00', asr: '16:42:00', maghrib: '19:17:00', isha: '20:31:00' },
      { hijri: '1447-09-12', date: '01-Mac-2026', day: 'Sunday', imsak: '06:02:00', fajr: '06:12:00', syuruk: '07:21:00', dhuha: '07:46:00', dhuhr: '13:25:00', asr: '16:35:00', maghrib: '19:26:00', isha: '20:35:00' },
    ], status: 'OK!', zone: 'WLY01' }
    const table = parseJAKIM(json, 2026)
    expect(table['2026-01-01']?.fajr).toBe('06:06')
    expect(table['2026-01-01']?.sunrise).toBe('07:18')
    expect(table['2026-03-01']?.isha).toBe('20:35')
    expect(jakimDate('15-Ogos-2026')).toBe('2026-08-15')
    expect(jakimDate('31-Dis-2026')).toBe('2026-12-31')
  })

  it('parses MUIS', () => {
    const json = { success: true, result: { records: [
      { _id: 1, Date: '2026-01-01', Day: 'Thurs', Subuh: '05:44', Syuruk: '07:08', Zohor: '13:10', Asar: '16:34', Maghrib: '19:11', Isyak: '20:25' },
    ] } }
    expect(parseMUIS(json)['2026-01-01']).toEqual({ fajr: '05:44', sunrise: '07:08', dhuhr: '13:10', asr: '16:34', maghrib: '19:11', isha: '20:25' })
  })

  it('parses Kemenag', () => {
    const json = { status: true, data: { id: 1301, lokasi: 'KOTA JAKARTA', jadwal: [
      { tanggal: 'Kamis, 01/10/2026', imsak: '04:13', subuh: '04:23', terbit: '05:35', dhuha: '06:02', dzuhur: '11:46', ashar: '14:51', maghrib: '17:50', isya: '18:59', date: '2026-10-01' },
    ] } }
    expect(parseKemenag(json)['2026-10-01']).toEqual({ fajr: '04:23', sunrise: '05:35', dhuhr: '11:46', asr: '14:51', maghrib: '17:50', isha: '18:59' })
  })

  it('parses the published MUIS calendar feed (feeds branch)', () => {
    const ics = readFileSync(new URL('./fixtures/sg-muis-sample.ics', import.meta.url), 'utf8')
    const table = parseFeedICS(ics, 480)
    // Same official values the iOS tests use for 1 Jan 2026.
    expect(table['2026-01-01']).toEqual({ fajr: '05:44', dhuhr: '13:10', asr: '16:34', maghrib: '19:11', isha: '20:25' })
    // 25 Oct 2026, as in the iOS screenshots (Subuh 5:28, Isyak 8:02).
    expect(table['2026-10-25']?.fajr).toBe('05:28')
    expect(table['2026-10-25']?.isha).toBe('20:02')
  })

  it('never puts the calculation earlier than the published MUIS feed (Oct 2026)', () => {
    const ics = readFileSync(new URL('./fixtures/sg-muis-sample.ics', import.meta.url), 'utf8')
    const table = parseFeedICS(ics, 480)
    const sg = { latitude: 1.3521, longitude: 103.8198 }
    let checked = 0
    for (const [date, row] of Object.entries(table)) {
      const [y, m, d] = date.split('-').map(Number)
      const day = compute(y, m, d, sg, METHODS.muis, 'standard')
      for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
        const z = zoned(day.times[p], 'Asia/Singapore')
        const [h, mi] = row[p]!.split(':').map(Number)
        const diff = z.hour * 60 + z.minute - (h * 60 + mi)
        expect(diff, `${date} ${p}`).toBeGreaterThanOrEqual(0)
        expect(diff, `${date} ${p}`).toBeLessThanOrEqual(2)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(30)
  })

  it('finds the nearest JAKIM zone', () => {
    expect(nearestJakimZone({ latitude: 3.1478, longitude: 101.6953 })).toBe('WLY01')
    expect(nearestJakimZone({ latitude: 1.4927, longitude: 103.7414 })).toBe('JHR02')
    expect(nearestJakimZone({ latitude: 5.4141, longitude: 100.3288 })).toBe('PNG01')
    expect(nearestJakimZone({ latitude: 1.5535, longitude: 110.3593 })).toBe('SWK08')
    expect(nearestJakimZone({ latitude: 5.9804, longitude: 116.0735 })).toBe('SBH07')
  })

  it("uses an official source only for the authority's own method", () => {
    const kl: Place = { id: 'kl', name: 'KL', countryCode: 'MY', countryName: 'Malaysia', timeZoneID: 'Asia/Kuala_Lumpur', coordinates: { latitude: 3.1478, longitude: 101.6953 } }
    expect(officialSourceFor(kl, METHODS.jakim, null)).toEqual({ kind: 'jakim', zone: 'WLY01' })
    expect(officialSourceFor(kl, METHODS.jakim, 'SGR01')).toEqual({ kind: 'jakim', zone: 'SGR01' })
    expect(officialSourceFor(kl, METHODS.mwl, null)).toBeNull()
    const sg: Place = { id: 'sg', name: 'SG', countryCode: 'SG', countryName: 'Singapore', timeZoneID: 'Asia/Singapore', coordinates: { latitude: 1.35, longitude: 103.82 } }
    expect(officialSourceFor(sg, METHODS.muis, null)).toEqual({ kind: 'muis' })
  })

  it('matches Kemenag cities by name', () => {
    const cities = [
      { id: '1201', name: 'KAB. BANDUNG' }, { id: '1202', name: 'KAB. BANDUNG BARAT' }, { id: '1219', name: 'KOTA BANDUNG' },
      { id: '1204', name: 'KAB. BOGOR' }, { id: '1222', name: 'KOTA BOGOR' }, { id: '1301', name: 'KOTA JAKARTA' },
      { id: '1638', name: 'KOTA SURABAYA' }, { id: '2622', name: 'KOTA MAKASSAR' },
    ]
    expect(matchKemenagCity(['Kota Bandung'], cities)).toBe('1219')
    expect(matchKemenagCity(['Bandung City'], cities)).toBe('1219')
    expect(matchKemenagCity(['Kabupaten Bandung Barat'], cities)).toBe('1202')
    expect(matchKemenagCity(['Bogor Regency'], cities)).toBe('1204')
    expect(matchKemenagCity(['Bogor'], cities)).toBe('1222')
    expect(matchKemenagCity(['Jakarta Selatan'], cities)).toBe('1301')
    expect(matchKemenagCity(['South Jakarta'], cities)).toBe('1301')
    expect(matchKemenagCity(['Nowhere', 'Surabaya'], cities)).toBe('1638')
    expect(matchKemenagCity(['Tokyo'], cities)).toBeNull()
  })

  it('keeps prayer spaces and drops lookalikes', () => {
    for (const n of ['Al-Istighfar Mosque', 'Musollah@Pasir Ris Mall', 'Surau Raudhatul Jannah', 'Masjid Kampong Siglap',
      'Prayer Room', 'Tokyo Camii', 'Seoul Central Masjid', 'Masjid Jalan Kebun', 'Masjid Jamek']) {
      expect(looksLikePrayerSpace(n), n).toBe(true)
    }
    for (const n of ['Darul Ghufran Mosque Stop', 'Mosque Street', 'Jalan Masjid', 'Masjid Jamek LRT Station',
      'Mosque Road Car Park', 'Bugis Mosque Bus Stop', 'Starbucks']) {
      expect(looksLikePrayerSpace(n), n).toBe(false)
    }
  })
})

describe('Masjid profiles (Grade B)', () => {
  const dataset: MosqueDataset = { version: 1, licence: 'CC-BY-4.0', mosques: [{
    id: 'test-hcm', name: 'Test Masjid', lat: 10.7626, lng: 106.6957, country: 'VN', radiusKm: 3,
    fingerprint: { fajrAngle: 18, ishaAngle: 17, ishaInterval: null, asrFactor: 1, offsets: { fajr: 2, dhuhr: 2, asr: 2, maghrib: 2, isha: 2 } },
    jamaah: { fajr: { afterMinutes: 20 }, dhuhr: { fixed: '13:00' }, isha: { beforeSunriseMinutes: null, afterMinutes: 15 } },
    jumuah: '13:15', source: 'unit test', verifiedAt: '2026-10-22', grade: 'B',
  }] }

  it('resolves within the radius only', () => {
    expect(mosqueNear(dataset, { latitude: 10.77, longitude: 106.70 })?.id).toBe('test-hcm')
    expect(mosqueNear(dataset, { latitude: 21.03, longitude: 105.85 })).toBeNull()
  })

  it('turns the fingerprint and jamaah rules into times', () => {
    const mosque = dataset.mosques[0]
    const method = mosqueMethod(mosque)!
    expect(method.fajrAngle).toBe(18)
    expect(method.offsets.maghrib).toBe(2)
    const tz = 'Asia/Ho_Chi_Minh'
    const day = compute(2026, 10, 21, { latitude: mosque.lat, longitude: mosque.lng }, method, 'standard')
    const j = jamaahTimes(mosque, day, tz, false)
    expect(j.fajr).toBe(day.times.fajr + 20 * 60_000)
    expect(j.isha).toBe(day.times.isha + 15 * 60_000)
    expect(zoned(j.dhuhr!, tz)).toMatchObject({ hour: 13, minute: 0 })
    expect(zoned(jamaahTimes(mosque, day, tz, true).dhuhr!, tz)).toMatchObject({ hour: 13, minute: 15 })
    expect(j.asr).toBeUndefined()
  })

  it('shows a second source only when it differs by more than 2 minutes', () => {
    const sg = { latitude: 1.3521, longitude: 103.8198 }
    const muis = compute(2026, 10, 22, sg, METHODS.muis, 'standard')
    const other = { ...muis, times: { ...muis.times, fajr: muis.times.fajr + 3 * 60_000, isha: muis.times.isha + 2 * 60_000 } }
    expect(Object.keys(disagreements(muis, other))).toEqual(['fajr'])
  })
})
