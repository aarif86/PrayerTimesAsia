import { afterEach, describe, expect, it, vi } from 'vitest'
import { zonedTime } from '../src/core/tz'
import { ensureTable, rowFor, seedTable, tableFor } from '../src/services/officialTables'
import { decodePreferences } from '../src/services/prefs'
import { fetchOK, readJSON, writeJSON } from '../src/services/storage'
import { store } from '../src/services/store'

/** No network, no saved data, private browsing: the app still shows times. */

afterEach(() => { vi.unstubAllGlobals() })

describe('offline and private browsing', () => {
  it('never throws when the browser has no storage', () => {
    expect(readJSON('ptasia.anything')).toBeNull()
    expect(() => writeJSON('ptasia.anything', { a: 1 })).not.toThrow()
  })

  it('treats a network failure or a timeout as no answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await fetchOK('https://example.invalid/x', 50)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    expect(await fetchOK('https://example.invalid/x', 50)).toBeNull()
  })

  it('gives up quietly on an official table when offline, and does not ask again straight away', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('offline') })
    vi.stubGlobal('fetch', fetch)
    const src = { kind: 'jakim', zone: 'WLY01' } as const
    expect(await ensureTable(src, 2031, 'Asia/Kuala_Lumpur')).toBe(false)
    expect(tableFor(src, 2031)).toBeNull()
    expect(rowFor(src, 2031, 1, 1)).toBeNull()
    const calls = fetch.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    expect(await ensureTable(src, 2031, 'Asia/Kuala_Lumpur')).toBe(false)
    expect(fetch.mock.calls.length).toBe(calls)
  })

  it('shows calculated times in Singapore when the official table is not there', () => {
    store.prefs = { ...decodePreferences({}), hasOnboarded: true, useGPS: false,
      manualPlace: { id: 't', name: 'Pasir Ris', countryCode: 'SG', countryName: 'Singapore', timeZoneID: 'Asia/Singapore', coordinates: { latitude: 1.3721, longitude: 103.9474 } } }
    store.emit()
    const day = store.day(zonedTime(2031, 6, 1, 12, 0, 0, 'Asia/Singapore'))!
    expect(day.grade).not.toBe('A')
    expect(day.times.fajr).toBeLessThan(day.times.sunrise)
    expect(day.times.sunrise).toBeLessThan(day.times.dhuhr)
    expect(day.times.maghrib).toBeLessThan(day.times.isha)
  })

  it('uses a saved official table when there is one', () => {
    seedTable({ kind: 'muis' }, 2031, { '2031-06-02': { fajr: '05:40', sunrise: '07:00', dhuhr: '13:05', asr: '16:28', maghrib: '19:10', isha: '20:25' } })
    expect(rowFor({ kind: 'muis' }, 2031, 6, 2)).toMatchObject({ fajr: '05:40' })
    store.emit()
    const day = store.day(zonedTime(2031, 6, 2, 12, 0, 0, 'Asia/Singapore'))!
    expect(day.grade).toBe('A')
    expect(day.times.fajr).toBe(zonedTime(2031, 6, 2, 5, 40, 0, 'Asia/Singapore'))
  })
})
