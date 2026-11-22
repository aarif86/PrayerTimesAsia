import type { Coordinates } from '../core/engine'
import { distanceKm } from '../core/geo'
import { isGraveOrShrine } from '../core/official'
import { fetchOK } from './storage'

/**
 * Ready-made masjid and surau lists, the same ones the iPhone and Android apps
 * use. They are built every week from OpenStreetMap (tools/build_masjid_list.py)
 * and cut into one-degree squares, so the web app only downloads the one to
 * four squares around you instead of waiting on the busy Overpass servers.
 * Only which square is asked for leaves the browser.
 */
export const LIST_BASE = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/masjids/'
/** The lists are rebuilt weekly; a day is short enough that a rebuild reaches phones soon after. */
const WEEK = 86_400_000

/** facilities: letters from the weekly list, w women's space, a wheelchair, p parking, t toilets. */
export interface ListPlace { id: string; name: string; address: string; coordinates: Coordinates; isMusollah: boolean; facilities?: string; hours?: string; details?: RoomDetails }

/** Extra facts about a prayer room from the community list. Only what is known; f how to find it, l level, m nearest MRT, p what is provided, t toilet level, c who it fits, n notes. */
export interface RoomDetails { f?: string; l?: string; m?: string; p?: string; t?: string; c?: string; n?: string }

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

/** `{"places": [[id, lat, lon, name, address, musollah 0/1, facilities?, opening_hours?, details?], ...]}` */
export function parseTile(json: unknown): ListPlace[] | null {
  const rows = (json as { places?: unknown })?.places
  if (!Array.isArray(rows)) return null
  const out: ListPlace[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6 || typeof row[0] !== 'string') continue
    const lat = Number(row[1]), lon = Number(row[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const musollah = Number(row[5]) === 1
    const name = typeof row[3] === 'string' && row[3] ? row[3] : (musollah ? 'Prayer room' : 'Masjid')
    if (isGraveOrShrine(name)) continue
    const place: ListPlace = { id: row[0], name, address: typeof row[4] === 'string' ? row[4] : '', coordinates: { latitude: lat, longitude: lon }, isMusollah: musollah }
    if (typeof row[6] === 'string' && row[6]) place.facilities = row[6]
    if (typeof row[7] === 'string' && row[7]) place.hours = row[7]
    const d = row[8]
    if (d && typeof d === 'object' && !Array.isArray(d)) place.details = d as RoomDetails
    out.push(place)
  }
  return out
}

type Row = [string, number, number, string, string, number, string?, string?, RoomDetails?]
interface Index { tiles: string[]; countries: string[] }
interface Saved<T> { at: number; data: T }

const memory = new Map<string, Saved<unknown>>()
const TILE_PREFIX = 'ptasia.mlist.t.'
const MAX_SAVED_TILES = 6
const MAX_SAVED_CHARS = 400_000

function readSaved<T>(key: string): Saved<T> | null {
  const m = memory.get(key)
  if (m) return m as Saved<T>
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? 'null') as Saved<T> | null
    if (s && typeof s.at === 'number') { memory.set(key, s); return s }
  } catch { /* ignore */ }
  return null
}

/**
 * Keeps the download as it came (compact rows), only for small squares and only
 * the few most recent ones, so the list never crowds out the user's settings in
 * browser storage. Bigger squares stay in memory for this visit only.
 */
function save<T>(key: string, data: T) {
  const s = { at: Date.now(), data }
  memory.set(key, s)
  try {
    const text = JSON.stringify(s)
    if (text.length > MAX_SAVED_CHARS) return
    if (key.startsWith(TILE_PREFIX)) {
      const saved: { k: string; at: number }[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(TILE_PREFIX) && k !== key) {
          try { saved.push({ k, at: (JSON.parse(localStorage.getItem(k) ?? '{}') as { at?: number }).at ?? 0 }) } catch { saved.push({ k, at: 0 }) }
        }
      }
      saved.sort((a, b) => b.at - a.at).slice(MAX_SAVED_TILES - 1).forEach((x) => localStorage.removeItem(x.k))
    }
    localStorage.setItem(key, text)
  } catch { /* ignore */ }
}

/** Fresh copy if it is under a day old, else download; an old copy is used if the download fails. */
async function cached<T>(key: string, url: string, check: (j: unknown) => T | null, timeoutMs: number): Promise<T | null> {
  const old = readSaved<T>(key)
  if (old && Date.now() - old.at < WEEK) return old.data
  const r = await fetchOK(url, timeoutMs)
  if (r) {
    try {
      const data = check(await r.json())
      if (data) { save(key, data); return data }
    } catch { /* fall through */ }
  }
  return old ? old.data : null
}

const indexOf = (j: unknown): Index | null => {
  const o = j as { tiles?: unknown; countries?: unknown }
  if (!Array.isArray(o?.tiles) || !o.countries || typeof o.countries !== 'object') return null
  return { tiles: o.tiles as string[], countries: Object.keys(o.countries as object) }
}
const rowsOf = (j: unknown): Row[] | null => {
  const rows = (j as { places?: unknown })?.places
  return Array.isArray(rows) ? rows as Row[] : null
}

/**
 * Places within [km] of here from the ready-made lists, or null when the lists
 * can't answer (country not covered, or offline with nothing saved), so the
 * caller can fall back to a live search, as the iPhone and Android apps do.
 */
export async function listNearby(c: Coordinates, country: string | null | undefined, km = 15): Promise<(ListPlace & { distanceKm: number })[] | null> {
  if (!country) return null
  const index = await cached<Index>('ptasia.mlist.index', `${LIST_BASE}index.json`, indexOf, 8000)
  if (!index || !index.countries.includes(country.toUpperCase())) return null
  const want = tilesAround(c, km).filter((k) => index.tiles.includes(k))
  if (want.length === 0) return null
  const tiles = await Promise.all(want.map((k) => cached<Row[]>(`${TILE_PREFIX}${k}`, `${LIST_BASE}tiles/${k}.json`, rowsOf, 10000)))
  if (tiles.some((t) => t == null)) return null
  const out = tiles.flatMap((rows) => parseTile({ places: rows }) ?? [])
    .map((p) => ({ ...p, distanceKm: distanceKm(c, p.coordinates) }))
    .filter((p) => p.distanceKm <= km)
    .sort((a, b) => a.distanceKm - b.distanceKm)
  return out.length ? out : null
}
