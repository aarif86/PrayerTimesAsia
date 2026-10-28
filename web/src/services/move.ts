import { newPlaceId, type Place } from '../core/place'
import { PRAYERS, type Prayer } from '../core/prayer'
import { decodePreferences, DEFAULT_PREFS, type Preferences } from './prefs'

/**
 * "Move my settings": everything a user chose, packed into one short code they
 * carry to another phone or browser themselves (QR code, link or copy-paste).
 * No account and no server - the settings travel inside the code.
 *
 * The format is shared with the iPhone and Android apps (docs/move-settings.md,
 * checked by testdata/move-settings.json):
 *
 *   PTA1.<base64url of raw DEFLATE of the JSON below>
 *
 * The JSON holds only what differs from the defaults, so a missing key means
 * "the default". Places carry no id; the receiving app gives them new ones.
 */
export const MOVE_VERSION = 1
export const MOVE_PREFIX = 'PTA1.'
/** Phone cameras read a QR code of this many characters off a screen without fuss. */
export const QR_MAX_CHARS = 1500

export interface MovedPlace {
  name: string
  region?: string
  countryCode?: string
  countryName?: string
  timeZoneID: string
  lat: number
  lon: number
  district?: string
}

export interface MovedSettings {
  v: number
  useGPS?: boolean
  home?: MovedPlace
  manualPlace?: MovedPlace
  savedPlaces?: MovedPlace[]
  methodOverrideID?: string
  asrOverride?: string
  namingOverride?: string
  use24Hour?: boolean
  hijriAdjustment?: number
  notifyPrayers?: Prayer[]
  reminderMinutesBefore?: number
  musafirEnabled?: boolean
  musafirThresholdKm?: number
  jakimZoneOverride?: string
  communityAuthority?: string
  appearance?: string
  todayStyle?: string
  showOffers?: boolean
  showLocalNames?: boolean
  trackerEnabled?: boolean
  prayedLog?: Record<string, Prayer[]>
  excusedDays?: string[]
  /** The Subuh wake-up alarm (iPhone and Android only); kept so a web stop on the way doesn't lose it. */
  wakeUp?: string
}

/** The plain settings, with the travel-mode memory and one-off prompts left behind. */
const SIMPLE_KEYS = [
  'useGPS', 'methodOverrideID', 'asrOverride', 'namingOverride', 'use24Hour', 'hijriAdjustment', 'reminderMinutesBefore',
  'musafirEnabled', 'musafirThresholdKm', 'jakimZoneOverride', 'communityAuthority', 'appearance', 'todayStyle',
  'showOffers', 'showLocalNames', 'trackerEnabled',
] as const satisfies readonly (keyof Preferences & keyof MovedSettings)[]

function movedPlace(p: Place): MovedPlace {
  const out: MovedPlace = { name: p.name, timeZoneID: p.timeZoneID, lat: p.coordinates.latitude, lon: p.coordinates.longitude }
  if (p.region) out.region = p.region
  if (p.countryCode) out.countryCode = p.countryCode
  if (p.countryName) out.countryName = p.countryName
  if (p.district) out.district = p.district
  return out
}

function place(m: MovedPlace): Place {
  return {
    id: newPlaceId(), name: m.name, region: m.region ?? null, countryCode: m.countryCode ?? null, countryName: m.countryName ?? null,
    timeZoneID: m.timeZoneID, coordinates: { latitude: m.lat, longitude: m.lon }, district: m.district ?? null,
  }
}

/** What to put in the code: only the settings that differ from a fresh install. */
export function movedFrom(p: Preferences, wakeUp?: string | null): MovedSettings {
  const out: MovedSettings = { v: MOVE_VERSION }
  const o = out as unknown as Record<string, unknown>
  for (const k of SIMPLE_KEYS) if (p[k] !== DEFAULT_PREFS[k] && p[k] != null) o[k] = p[k]
  if (p.home) out.home = movedPlace(p.home)
  if (p.manualPlace) out.manualPlace = movedPlace(p.manualPlace)
  if (p.savedPlaces.length) out.savedPlaces = p.savedPlaces.map(movedPlace)
  const notify = PRAYERS.filter((x) => p.notifyPrayers.includes(x))
  if (notify.join() !== PRAYERS.filter((x) => DEFAULT_PREFS.notifyPrayers.includes(x)).join()) out.notifyPrayers = notify
  const log = Object.fromEntries(Object.entries(p.prayedLog).filter(([, v]) => v.length).sort(([a], [b]) => a.localeCompare(b)))
  if (Object.keys(log).length) out.prayedLog = log
  if (p.excusedDays.length) out.excusedDays = [...p.excusedDays].sort()
  if (wakeUp) out.wakeUp = wakeUp
  return out
}

/**
 * These preferences with the moved settings in place. Every moved setting
 * replaces this device's (a missing one goes back to its default), except the
 * tracker history, which is added to what this device already has.
 */
export function applyMoved(p: Preferences, m: MovedSettings): Preferences {
  const raw: Record<string, unknown> = structuredClone(p) as unknown as Record<string, unknown>
  for (const k of SIMPLE_KEYS) raw[k] = k in m ? (m as unknown as Record<string, unknown>)[k] : DEFAULT_PREFS[k]
  const okPlace = (x: unknown): x is MovedPlace => {
    const q = x as MovedPlace
    return !!q && typeof q === 'object' && typeof q.name === 'string' && typeof q.timeZoneID === 'string' && typeof q.lat === 'number' && typeof q.lon === 'number'
  }
  raw.home = okPlace(m.home) ? place(m.home) : null
  raw.manualPlace = okPlace(m.manualPlace) ? place(m.manualPlace) : null
  raw.savedPlaces = Array.isArray(m.savedPlaces) ? m.savedPlaces.filter(okPlace).map(place) : []
  raw.notifyPrayers = Array.isArray(m.notifyPrayers) ? PRAYERS.filter((x) => m.notifyPrayers!.includes(x)) : [...DEFAULT_PREFS.notifyPrayers]
  const log: Record<string, Prayer[]> = structuredClone(p.prayedLog)
  if (m.prayedLog && typeof m.prayedLog === 'object') {
    for (const [day, list] of Object.entries(m.prayedLog)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(list)) continue
      log[day] = PRAYERS.filter((x) => list.includes(x) || (log[day] ?? []).includes(x))
    }
  }
  raw.prayedLog = log
  const excused = Array.isArray(m.excusedDays) ? m.excusedDays.filter((d) => typeof d === 'string') : []
  raw.excusedDays = [...new Set([...p.excusedDays, ...excused])].sort()
  raw.hasOnboarded = true
  // The same checks as loading saved preferences: a wrong value falls back to its default.
  return decodePreferences(raw)
}

// MARK: The code

function toBase64url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array {
  const b = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

export async function encodeMove(m: MovedSettings): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(m))
  return MOVE_PREFIX + toBase64url(await pipe(json, new CompressionStream('deflate-raw')))
}

/** The settings in a code, a link with one, or any text that contains one; null if there isn't a readable one. */
export async function decodeMove(text: string): Promise<MovedSettings | null> {
  const match = /PTA1\.([A-Za-z0-9_-]+)/.exec(text)
  if (!match) return null
  try {
    const json = new TextDecoder().decode(await pipe(fromBase64url(match[1]), new DecompressionStream('deflate-raw')))
    const m = JSON.parse(json) as MovedSettings
    return m && typeof m === 'object' && m.v === MOVE_VERSION ? m : null
  } catch {
    return null
  }
}

/**
 * The code for a QR code: everything if it fits, otherwise the tracker history
 * trimmed to the most recent days that fit. `keptDays` says how many made it.
 */
export async function encodeForQR(m: MovedSettings, max = QR_MAX_CHARS, prefixLength = 0): Promise<{ code: string; keptDays: number | null }> {
  const code = await encodeMove(m)
  const days = Object.keys(m.prayedLog ?? {}).sort()
  if (code.length + prefixLength <= max || !days.length) return { code, keptDays: null }
  let keep = days.length
  for (;;) {
    keep = Math.floor(keep / 2)
    const recent = new Set(days.slice(days.length - keep))
    const trimmed: MovedSettings = { ...m, prayedLog: Object.fromEntries(Object.entries(m.prayedLog!).filter(([d]) => recent.has(d))) }
    if (!keep) delete trimmed.prayedLog
    const c = await encodeMove(trimmed)
    if (c.length + prefixLength <= max || !keep) return { code: c, keptDays: keep }
  }
}

/** A line for the "Bring in settings" sheet, so people see what they're about to get. */
export function describeMoved(m: MovedSettings): string[] {
  const lines: string[] = []
  const where = m.home?.name ?? m.manualPlace?.name
  if (where) lines.push(`Place: ${where}`)
  if (m.savedPlaces?.length) lines.push(`${m.savedPlaces.length} saved place${m.savedPlaces.length === 1 ? '' : 's'}`)
  const days = Object.keys(m.prayedLog ?? {}).length
  if (m.trackerEnabled || days) lines.push(`Prayer tracker${days ? `, ${days} day${days === 1 ? '' : 's'} of history` : ''}`)
  if (m.methodOverrideID || m.asrOverride || m.jakimZoneOverride) lines.push('Your calculation choices')
  if (m.appearance || m.todayStyle || m.use24Hour || m.namingOverride) lines.push('Your look and prayer names')
  if (m.notifyPrayers || m.reminderMinutesBefore) lines.push('Which prayers to alert')
  if (m.musafirEnabled) lines.push('Musafir features')
  return lines.length ? lines : ['The standard settings']
}
