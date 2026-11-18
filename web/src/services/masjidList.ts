import type { Coordinates } from '../core/engine'
import { distanceKm } from '../core/geo'
import { fetchOK } from './storage'

/**
 * Ready-made masjid and surau lists, the same ones the iPhone and Android apps
 * use. They are built every week from OpenStreetMap (tools/build_masjid_list.py)
 * and cut into one-degree squares, so the web app only downloads the one to
 * four squares around you instead of waiting on the busy Overpass servers.
 * Only which square is asked for leaves the browser.
 */
export const LIST_BASE = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/masjids/'
const WEEK = 7 * 86_400_000

export interface ListPlace { id: string; name: string; address: string; coordinates: Coordinates; isMusollah: boolean }

/** The squares a circle of [km] around here touches (one to four), as "lat_lon". */
export function tilesAround(c: Coordinates, km = 15): string[] {
  const dLat = km / 111
  const dLon = km / (111 * Math.max(0.2, Math.cos(c.latitude * Math.PI / 180)))
  const keys: string[] = []
  for (const lat of [c.latitude - dLat, c.latitude + dLat]) {
    for (const lon of [c.longitude - dLon, c.longitude + dLon]) {
      let w = lon
      if (w >= 180) w -= 360
      if (w < -180) w += 360
      const key = `${Math.floor(lat)}_${Math.floor(w)}`
      if (!keys.includes(key)) keys.push(key)
    }
  }
  return keys
}

/** `{"places": [[id, lat, lon, name, address, musollah 0/1], ...]}` */
export function parseTile(json: unknown): ListPlace[] | null {
  const rows = (json as { places?: unknown })?.places
  if (!Array.isArray(rows)) return null
  const out: ListPlace[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6 || typeof row[0] !== 'string') continue
    const lat = Number(row[1]), lon = Number(row[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const musollah = Number(row[5]) === 1
    const name = typeof row[3] === 'string' && row[3] ? row[3] : (musollah ? 'Musollah' : 'Masjid')
    out.push({ id: row[0], name, address: typeof row[4] === 'string' ? row[4] : '', coordinates: { latitude: lat, longitude: lon }, isMusollah: musollah })
  }
  return out
}

interface Saved<T> { at: number; data: T }
const memory = new Map<string, Saved<unknown>>()

function readSaved<T>(key: string): Saved<T> | null {
  const m = memory.get(key)
  if (m) return m as Saved<T>
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? 'null') as Saved<T> | null
    if (s && typeof s.at === 'number') { memory.set(key, s); return s }
  } catch { /* ignore */ }
  return null
}

function save<T>(key: string, data: T) {
  const s = { at: Date.now(), data }
  memory.set(key, s)
  // A very large square may not fit; it stays in memory for this visit.
  try { localStorage.setItem(key, JSON.stringify(s)) } catch { /* ignore */ }
}

/** Fresh copy if it is under a week old, else download; an old copy is used if the download fails. */
async function cached<T>(key: string, url: string, parse: (j: unknown) => T | null, timeoutMs: number): Promise<T | null> {
  const old = readSaved<T>(key)
  if (old && Date.now() - old.at < WEEK) return old.data
  const r = await fetchOK(url, timeoutMs)
  if (r) {
    try {
      const data = parse(await r.json())
      if (data) { save(key, data); return data }
    } catch { /* fall through */ }
  }
  return old ? old.data : null
}

/**
 * Places within [km] of here from the ready-made lists, or null when the lists
 * can't answer (no square here, or offline with nothing saved), so the caller
 * can fall back to a live search.
 */
export async function listNearby(c: Coordinates, km = 15): Promise<(ListPlace & { distanceKm: number })[] | null> {
  const index = await cached<string[]>('ptasia.mlist.index', `${LIST_BASE}index.json`,
    (j) => Array.isArray((j as { tiles?: unknown })?.tiles) ? (j as { tiles: string[] }).tiles : null, 8000)
  const all = tilesAround(c, km)
  const want = Array.isArray(index) ? all.filter((k) => index.includes(k)) : all
  if (want.length === 0) return null
  const tiles = await Promise.all(want.map((k) => cached<ListPlace[]>(`ptasia.mlist.${k}`, `${LIST_BASE}tiles/${k}.json`, parseTile, 10000)))
  if (tiles.some((t) => t == null)) return null
  const out = (tiles as ListPlace[][]).flat()
    .map((p) => ({ ...p, distanceKm: distanceKm(c, p.coordinates) }))
    .filter((p) => p.distanceKm <= km)
    .sort((a, b) => a.distanceKm - b.distanceKm)
  return out.length ? out : null
}
