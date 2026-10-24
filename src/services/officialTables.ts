import {
  cacheKey, FEEDS_BASE, feedName, matchKemenagCity, parseFeedICS, parseJAKIM, parseKemenag, parseMUIS,
  type OfficialSource, type Table,
} from '../core/official'
import type { Prayer } from '../core/prayer'
import { offsetMinutes } from '../core/tz'
import { fetchOK, readJSON, writeJSON } from './storage'

/**
 * Official timetables when online, kept in this browser for offline use.
 *
 * The authorities' APIs (data.gov.sg for MUIS, e-Solat for JAKIM, myquran for
 * Kemenag) allow browser access (CORS), so they are asked first, exactly as the
 * iOS app does. If one is down or blocked, MUIS and JAKIM fall back to the app's
 * own calendar feeds (the `feeds` branch, rebuilt weekly from the same official
 * tables). Without any table the app falls back to its calculation, which is
 * calibrated never to be earlier than the official time.
 */

/** data.gov.sg publishes one MUIS dataset per year; later years come from config/official-sources.json. */
const MUIS_DATASETS: Record<number, string> = { 2026: 'd_d441e7242e78efc566024dd5b0d9829c' }
const REMOTE_CONFIG = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/config/official-sources.json'

export interface StoredTable {
  table: Table
  /** Where it came from, for the source sheet. */
  via: 'authority' | 'feed'
  fetchedAt: number
}

const memory = new Map<string, StoredTable | null>()
const inFlight = new Set<string>()
const failedAt = new Map<string, number>()

export function tableFor(source: OfficialSource, year: number): StoredTable | null {
  const key = cacheKey(source, year)
  if (!memory.has(key)) memory.set(key, readJSON<StoredTable>(`ptasia.table.${key}`))
  return memory.get(key) ?? null
}

export function rowFor(source: OfficialSource, year: number, month: number, day: number): Partial<Record<Prayer, string>> | null {
  const t = tableFor(source, year)
  if (!t) return null
  const k = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return t.table[k] ?? null
}

function store(source: OfficialSource, year: number, table: Table, via: StoredTable['via']): void {
  const key = cacheKey(source, year)
  const value: StoredTable = { table, via, fetchedAt: Date.now() }
  memory.set(key, value)
  writeJSON(`ptasia.table.${key}`, value)
}

function splitByYear(table: Table): Map<number, Table> {
  const out = new Map<number, Table>()
  for (const [date, row] of Object.entries(table)) {
    const y = parseInt(date.slice(0, 4), 10)
    if (!out.has(y)) out.set(y, {})
    out.get(y)![date] = row
  }
  return out
}

async function muisDataset(year: number): Promise<string | null> {
  if (MUIS_DATASETS[year]) return MUIS_DATASETS[year]
  const r = await fetchOK(REMOTE_CONFIG, 10000)
  if (!r) return null
  try {
    const cfg = (await r.json()) as { muisDatasets?: Record<string, string> }
    return cfg.muisDatasets?.[String(year)] ?? null
  } catch { return null }
}

async function fromFeed(source: OfficialSource, tz: string): Promise<Map<number, Table> | null> {
  const name = feedName(source)
  if (!name) return null
  const r = await fetchOK(`${FEEDS_BASE}${name}.ics`, 20000)
  if (!r) return null
  const text = await r.text()
  return splitByYear(parseFeedICS(text, offsetMinutes(Date.now(), tz)))
}

let kemenagCities: { id: string; name: string }[] | null = null

async function kemenagCityList(): Promise<{ id: string; name: string }[] | null> {
  if (kemenagCities) return kemenagCities
  const cached = readJSON<{ id: string; name: string }[]>('ptasia.kemenag.cities')
  if (cached) return (kemenagCities = cached)
  const r = await fetchOK('https://api.myquran.com/v2/sholat/kota/semua', 15000)
  if (!r) return null
  try {
    const json = (await r.json()) as { data: { id: string; lokasi: string }[] }
    kemenagCities = json.data.map((c) => ({ id: c.id, name: c.lokasi }))
    writeJSON('ptasia.kemenag.cities', kemenagCities)
    return kemenagCities
  } catch { return null }
}

/**
 * Downloads the year's table if it isn't cached. Resolves to true when new data
 * arrived. Requests carry only a year, zone code or regency name - never coordinates.
 */
export async function ensureTable(source: OfficialSource, year: number, tz: string): Promise<boolean> {
  const key = cacheKey(source, year)
  if (tableFor(source, year) || inFlight.has(key)) return false
  const failed = failedAt.get(key)
  if (failed && Date.now() - failed < 30 * 60_000) return false
  inFlight.add(key)
  try {
    if (source.kind === 'muis') {
      const dataset = await muisDataset(year)
      if (dataset) {
        const r = await fetchOK(`https://data.gov.sg/api/action/datastore_search?resource_id=${dataset}&limit=400`, 12000)
        if (r) {
          try {
            const table = parseMUIS(await r.json())
            if (Object.keys(table).length > 25) { store(source, year, table, 'authority'); return true }
          } catch { /* fall through to the feed */ }
        }
      }
    }
    if (source.kind === 'jakim') {
      const r = await fetchOK(`https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=${source.zone}`, 15000)
      if (r) {
        try {
          const table = parseJAKIM(await r.json(), year)
          if (Object.keys(table).length > 25) { store(source, year, table, 'authority'); return true }
        } catch { /* fall through to the feed */ }
      }
    }
    if (source.kind === 'muis' || source.kind === 'jakim') {
      const years = await fromFeed(source, tz)
      let got = false
      for (const [y, table] of years ?? []) {
        if (Object.keys(table).length > 25 && !tableFor(source, y)) { store(source, y, table, 'feed'); if (y === year) got = true }
      }
      if (got) return true
    }
    if (source.kind === 'kemenag') {
      const cities = await kemenagCityList()
      const id = cities ? matchKemenagCity([source.regency], cities) : null
      if (id) {
        const table: Table = {}
        for (let month = 1; month <= 12; month++) {
          const r = await fetchOK(`https://api.myquran.com/v2/sholat/jadwal/${id}/${year}/${String(month).padStart(2, '0')}`, 12000)
          if (!r) { if (month === 1) break; continue }
          try { Object.assign(table, parseKemenag(await r.json())) } catch { /* skip month */ }
        }
        if (Object.keys(table).length > 25) { store(source, year, table, 'authority'); return true }
      }
    }
    failedAt.set(key, Date.now())
    return false
  } finally {
    inFlight.delete(key)
  }
}

/** Seed a table (used by the screenshot/demo mode and tests). */
export function seedTable(source: OfficialSource, year: number, table: Table, via: StoredTable['via'] = 'feed'): void {
  store(source, year, table, via)
}
