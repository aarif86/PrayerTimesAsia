import type { Coordinates } from './engine'
import { distanceKm } from './geo'
import { JAKIM_POINTS } from './jakimZones'
import type { CalculationMethod } from './methods'
import type { Place } from './place'
import type { Prayer } from './prayer'
import { ymdKey } from './tz'

/**
 * Official timetables (MUIS, JAKIM e-Solat, Kemenag): which one applies, and
 * parsers for each response shape. Ported from the iOS OfficialTimetables.swift,
 * plus a parser for the app's own published calendar feeds (the `feeds` branch),
 * which the web uses because the authorities' APIs are not reachable from a
 * browser on another origin.
 */
export type OfficialSource =
  | { kind: 'muis' }
  | { kind: 'jakim'; zone: string }
  | { kind: 'kemenag'; regency: string }

/** "yyyy-MM-dd" → prayer → "HH:mm" */
export type Table = Record<string, Partial<Record<Prayer, string>>>

export function sourceLabel(s: OfficialSource): string {
  switch (s.kind) {
    case 'muis': return 'MUIS official timetable'
    case 'jakim': return `JAKIM e-Solat · zone ${s.zone}`
    case 'kemenag': return `Kemenag · ${s.regency}`
  }
}

export function sourceAuthority(s: OfficialSource): string {
  return s.kind === 'muis' ? 'MUIS' : s.kind === 'jakim' ? 'JAKIM' : 'Kemenag'
}

export const FEEDS_BASE = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/feeds/'

/** The app's own .ics feed for this source, built from the official table. */
export function feedName(s: OfficialSource): string | null {
  switch (s.kind) {
    case 'muis': return 'sg-muis'
    case 'jakim': return `my-${s.zone.toLowerCase()}`
    case 'kemenag': return null
  }
}

export function cacheKey(s: OfficialSource, year: number): string {
  switch (s.kind) {
    case 'muis': return `muis-${year}`
    case 'jakim': return `jakim-${s.zone}-${year}`
    case 'kemenag': return `kemenag-${kemenagCore(s.regency).core}-${year}`
  }
}

export function sameSource(a: OfficialSource | null, b: OfficialSource | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Which official table applies, if any. Only when the method in use is that authority's own. */
export function officialSourceFor(place: Place, method: CalculationMethod, zoneOverride: string | null | undefined): OfficialSource | null {
  const code = place.countryCode?.toUpperCase()
  if (code === 'SG' && method.id === 'muis') return { kind: 'muis' }
  if (code === 'MY' && method.id === 'jakim') return { kind: 'jakim', zone: zoneOverride ?? nearestJakimZone(place.coordinates) }
  if (code === 'ID' && method.id === 'kemenag') {
    const name = place.district ?? place.region ?? (place.name === 'Current location' ? null : place.name)
    return name ? { kind: 'kemenag', regency: name } : null
  }
  return null
}

export function nearestJakimZone(c: Coordinates): string {
  let best = 'WLY01', bestKm = Number.MAX_VALUE
  for (const [zone, lat, lng] of JAKIM_POINTS) {
    const d = distanceKm(c, { latitude: lat, longitude: lng })
    if (d < bestKm) { best = zone; bestKm = d }
  }
  return best
}

/** "06:06:00" / "6:06" → "06:06" */
export function hhmm(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const p = s.trim().split(':')
  if (p.length < 2) return null
  const h = parseInt(p[0], 10), m = parseInt(p[1], 10)
  if (!/^\d+$/.test(p[0].trim()) || !/^\d+$/.test(p[1].trim())) return null
  if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const MALAY_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mac: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  ogos: 8, ogo: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dis: 12, dec: 12,
}

/** "15-Ogos-2026" → "2026-08-15" */
export function jakimDate(s: string): string | null {
  const parts = s.split('-')
  if (parts.length !== 3) return null
  const d = parseInt(parts[0], 10), y = parseInt(parts[2], 10), m = MALAY_MONTHS[parts[1].toLowerCase()]
  if (Number.isNaN(d) || Number.isNaN(y) || !m) return null
  return ymdKey(y, m, d)
}

function complete(row: Partial<Record<Prayer, string>>): boolean {
  return ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].every((p) => row[p as Prayer])
}

/** e-Solat: {"prayerTime":[{"date":"01-Jan-2026","fajr":"06:06:00","syuruk":"07:18:00",...}]} */
export function parseJAKIM(json: unknown, year: number): Table {
  const rows = (json as { prayerTime?: Record<string, unknown>[] })?.prayerTime ?? []
  const out: Table = {}
  for (const r of rows) {
    const date = typeof r.date === 'string' ? jakimDate(r.date) : null
    if (!date || !date.startsWith(`${year}-`)) continue
    const row: Partial<Record<Prayer, string>> = {}
    const map: [Prayer, unknown][] = [['fajr', r.fajr], ['sunrise', r.syuruk], ['dhuhr', r.dhuhr], ['asr', r.asr], ['maghrib', r.maghrib], ['isha', r.isha]]
    for (const [p, v] of map) { const t = hhmm(v); if (t) row[p] = t }
    if (complete(row)) out[date] = row
  }
  return out
}

/** data.gov.sg: {"result":{"records":[{"Date":"2026-01-01","Subuh":"05:44","Syuruk":"07:08",...}]}} */
export function parseMUIS(json: unknown): Table {
  const records = (json as { result?: { records?: Record<string, unknown>[] } })?.result?.records
  if (!Array.isArray(records)) throw new Error('Unexpected MUIS response')
  const columns: [Prayer, string[]][] = [
    ['fajr', ['subuh']], ['sunrise', ['syuruk']], ['dhuhr', ['zohor', 'zuhur']],
    ['asr', ['asar']], ['maghrib', ['maghrib']], ['isha', ['isyak']],
  ]
  const out: Table = {}
  for (const record of records) {
    const lower: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(record)) if (!(k.toLowerCase() in lower)) lower[k.toLowerCase()] = v
    const date = typeof lower.date === 'string' ? lower.date.slice(0, 10) : null
    if (!date) continue
    const row: Partial<Record<Prayer, string>> = {}
    for (const [prayer, names] of columns) {
      const raw = names.map((n) => lower[n]).find((v) => typeof v === 'string')
      let t = hhmm(raw)
      if (!t) continue
      // Guard against a 12-hour afternoon value ("1:10" for 13:10).
      const h = parseInt(t.slice(0, 2), 10)
      if (prayer !== 'fajr' && prayer !== 'sunrise' && h < 11) t = String(h + 12).padStart(2, '0') + t.slice(2)
      row[prayer] = t
    }
    if (complete(row)) out[date] = row
  }
  return out
}

/** myquran v2: {"data":{"jadwal":[{"date":"2026-10-01","subuh":"04:23","terbit":"05:35",...}]}} */
export function parseKemenag(json: unknown): Table {
  const rows = (json as { data?: { jadwal?: Record<string, unknown>[] } })?.data?.jadwal
  if (!Array.isArray(rows)) throw new Error('Unexpected Kemenag response')
  const out: Table = {}
  for (const r of rows) {
    if (typeof r.date !== 'string') continue
    const row: Partial<Record<Prayer, string>> = {}
    const map: [Prayer, unknown][] = [['fajr', r.subuh], ['sunrise', r.terbit], ['dhuhr', r.dzuhur], ['asr', r.ashar], ['maghrib', r.maghrib], ['isha', r.isya]]
    for (const [p, v] of map) { const t = hhmm(v); if (t) row[p] = t }
    if (complete(row)) out[r.date.slice(0, 10)] = row
  }
  return out
}

/**
 * The app's own calendar feed (tools/gen_ics.py on the `feeds` branch): one
 * VEVENT per prayer, UID "<feed>-<yyyy-MM-dd>-<prayer>@prayertimes.asia" and a
 * UTC DTSTART. Five prayers per day (no Syuruk). `utcOffsetMinutes` is the
 * zone's fixed offset (Singapore and Malaysia: +480, no DST).
 */
export function parseFeedICS(text: string, utcOffsetMinutes: number): Table {
  const out: Table = {}
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const events = unfolded.split('BEGIN:VEVENT').slice(1)
  for (const ev of events) {
    const uid = /UID:[^\r\n]*?-(\d{4}-\d{2}-\d{2})-(fajr|dhuhr|asr|maghrib|isha)@/.exec(ev)
    const start = /DTSTART:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(ev)
    if (!uid || !start) continue
    const utc = Date.UTC(+start[1], +start[2] - 1, +start[3], +start[4], +start[5], +start[6])
    const local = new Date(utc + utcOffsetMinutes * 60_000)
    const date = uid[1]
    const t = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`
    ;(out[date] ??= {})[uid[2] as Prayer] = t
  }
  for (const k of Object.keys(out)) {
    const r = out[k]
    if (!(r.fajr && r.dhuhr && r.asr && r.maghrib && r.isha)) delete out[k]
  }
  return out
}

export type RegencyKind = 'city' | 'regency' | 'unknown'

/** "Kota Bandung" / "Bandung City" / "KOTA BANDUNG" → ("BANDUNG", city); "Kabupaten Bogor" → ("BOGOR", regency). */
export function kemenagCore(name: string): { core: string; kind: RegencyKind } {
  const upper = name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\./g, ' ')
  let tokens = upper.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  let kind: RegencyKind = 'unknown'
  if (tokens[0] === 'KOTA' || tokens[tokens.length - 1] === 'CITY') kind = 'city'
  if (['KAB', 'KABUPATEN'].includes(tokens[0] ?? '') || tokens[tokens.length - 1] === 'REGENCY') kind = 'regency'
  const filler = new Set(['KOTA', 'KAB', 'KABUPATEN', 'ADMINISTRASI', 'ADM', 'REGENCY', 'CITY', 'OF'])
  tokens = tokens.filter((t) => !filler.has(t))
  return { core: tokens.join(' '), kind }
}

/** Best Kemenag id for the given place names (most specific first). */
export function matchKemenagCity(names: string[], list: { id: string; name: string }[]): string | null {
  const entries = list.map((e) => ({ id: e.id, key: kemenagCore(e.name) }))
  for (const name of names) {
    const want = kemenagCore(name)
    if (!want.core) continue
    const exact = entries.filter((e) => e.key.core === want.core)
    const hit = exact.find((e) => e.key.kind === want.kind) ?? exact.find((e) => e.key.kind === 'city') ?? exact[0]
    if (hit) return hit.id
    // "Jakarta Selatan" / "South Jakarta" → KOTA JAKARTA: whole-word containment, longest wins.
    const words = new Set(want.core.split(' '))
    const partial = entries.filter((e) => {
      const w = e.key.core.split(' ').filter(Boolean)
      return w.length > 0 && w.every((x) => words.has(x))
    })
    let best: (typeof entries)[number] | null = null
    for (const e of partial) {
      if (!best) { best = e; continue }
      const a = [best.key.core.length, best.key.kind === 'city' ? 1 : 0]
      const b = [e.key.core.length, e.key.kind === 'city' ? 1 : 0]
      if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) best = e
    }
    if (best) return best.id
  }
  return null
}

/**
 * Search for "mosque" also returns streets and stops named after one; keep
 * results whose name says what they are. (Port of NearbySearch.looksLikePrayerSpace.)
 */
export function looksLikePrayerSpace(name: string): boolean {
  const n = name.toLowerCase()
  const transport = [' stop', 'bus ', 'station', 'mrt', 'lrt', 'car park', 'carpark', ' exit', 'halte']
  if (transport.some((t) => n.includes(t))) return false
  const streetWords = new Set(['street', 'st', 'road', 'rd', 'jalan', 'jln', 'lorong', 'avenue', 'ave'])
  const tokens = n.split(/[^\p{L}]+/u).filter(Boolean)
  if (tokens.length && (streetWords.has(tokens[0]) || streetWords.has(tokens[tokens.length - 1]))) return false
  const words = ['masjid', 'mosque', 'mesjid', 'musolla', 'musalla', 'musholla', 'mushola', 'surau',
    'prayer', 'jami', 'islamic cent', 'islamic center', 'camii', 'cami ', 'masjed', 'مسجد',
    '清真寺', 'モスク', '모스크', 'nhà thờ hồi giáo', 'มัสยิด']
  return words.some((w) => n.includes(w))
}
