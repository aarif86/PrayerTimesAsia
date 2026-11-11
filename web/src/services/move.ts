import { newPlaceId, type Place } from '../core/place'
import { PRAYERS, type Prayer } from '../core/prayer'
import type { FastMark } from '../core/ramadanContent'
import { SAHUR_DAYS } from '../core/wakeup'
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
  trackerPausedSince?: string | null
  windowNudge?: boolean
  quietHours?: boolean
  quietFrom?: number
  quietTo?: number
  buzzOnly?: boolean
  largeText?: boolean
  jumuahReminderMinutes?: number
  /** The Subuh wake-up alarm and the earlier sahur alarm. */
  wakeUp?: string
  sahurAlarm?: string
  sahurDays?: string[]
  /** Alarms for the other prayers and the alarm sound. */
  dhuhrAlarm?: string
  asrAlarm?: string
  maghribAlarm?: string
  ishaAlarm?: string
  alarmSound?: string
  /** The Ramadan record: how each day's fast went, and the days Tarawih was prayed and the juz read. */
  fastLog?: Record<string, FastMark>
  tarawihLog?: string[]
  quranLog?: string[]
}

const FAST_MARKS: readonly FastMark[] = ['fasted', 'period', 'sick', 'travel', 'other', 'qadha', 'syawal']
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The plain settings, with the travel-mode memory and one-off prompts left behind. */
const SIMPLE_KEYS = [
  'useGPS', 'methodOverrideID', 'asrOverride', 'namingOverride', 'use24Hour', 'hijriAdjustment', 'reminderMinutesBefore',
  'musafirEnabled', 'musafirThresholdKm', 'jakimZoneOverride', 'communityAuthority', 'appearance', 'todayStyle',
  'showOffers', 'showLocalNames', 'trackerEnabled', 'trackerPausedSince', 'wakeUp', 'sahurAlarm',
  'dhuhrAlarm', 'asrAlarm', 'maghribAlarm', 'ishaAlarm', 'alarmSound',
  'windowNudge', 'quietHours', 'quietFrom', 'quietTo', 'buzzOnly', 'largeText', 'jumuahReminderMinutes',
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
export function movedFrom(p: Preferences): MovedSettings {
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
  const sahurDays = SAHUR_DAYS.filter((d) => p.sahurDays.includes(d))
  if (sahurDays.join() !== SAHUR_DAYS.filter((d) => DEFAULT_PREFS.sahurDays.includes(d)).join()) out.sahurDays = sahurDays
  const fasts = Object.entries(p.fastLog).sort(([a], [b]) => a.localeCompare(b))
  if (fasts.length) out.fastLog = Object.fromEntries(fasts)
  if (p.tarawihLog.length) out.tarawihLog = [...p.tarawihLog].sort()
  if (p.quranLog.length) out.quranLog = [...p.quranLog].sort()
  return out
}

/**
 * These preferences with the moved settings in place. Every moved setting
 * replaces this device's (a missing one goes back to its default), except the
 * tracker history and the Ramadan record, which are added to what this device
 * already has (an older code without them leaves this device's as they are).
 */
export function applyMoved(p: Preferences, m: MovedSettings): Preferences {
  const raw: Record<string, unknown> = structuredClone(p) as unknown as Record<string, unknown>
  for (const k of SIMPLE_KEYS) raw[k] = k in m ? (m as unknown as Record<string, unknown>)[k] : DEFAULT_PREFS[k]
  const okPlace = (x: unknown): x is MovedPlace => {
    const q = x as MovedPlace
    return !!q && typeof q === 'object' && typeof q.name === 'string' && typeof q.timeZoneID === 'string' && typeof q.lat === 'number' && typeof q.lon === 'number'
  }
  raw.home = okPlace(m.home) ? place(m.home) : null
  raw.homeConfirmed = raw.home != null
  raw.manualPlace = okPlace(m.manualPlace) ? place(m.manualPlace) : null
  raw.savedPlaces = Array.isArray(m.savedPlaces) ? m.savedPlaces.filter(okPlace).map(place) : []
  raw.sahurDays = Array.isArray(m.sahurDays) ? SAHUR_DAYS.filter((d) => m.sahurDays!.includes(d)) : [...DEFAULT_PREFS.sahurDays]
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
  const fasts: Record<string, FastMark> = structuredClone(p.fastLog)
  if (m.fastLog && typeof m.fastLog === 'object' && !Array.isArray(m.fastLog)) {
    for (const [day, mark] of Object.entries(m.fastLog)) if (DAY.test(day) && FAST_MARKS.includes(mark)) fasts[day] = mark
  }
  raw.fastLog = fasts
  const days = (here: string[], moved: unknown) =>
    [...new Set([...here, ...(Array.isArray(moved) ? moved.filter((d): d is string => typeof d === 'string' && DAY.test(d)) : [])])].sort()
  raw.tarawihLog = days(p.tarawihLog, m.tarawihLog)
  raw.quranLog = days(p.quranLog, m.quranLog)
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

/** How far back "this year's Ramadan record" reaches from its newest day: the month itself, Syawal and the replaced fasts after it. */
export const RAMADAN_YEAR_DAYS = 330

/** Only the Ramadan record from the newest day back RAMADAN_YEAR_DAYS days; null if nothing older was there to leave out. */
export function latestRamadanYear(m: MovedSettings): MovedSettings | null {
  const all = [...Object.keys(m.fastLog ?? {}), ...(m.tarawihLog ?? []), ...(m.quranLog ?? [])].filter((d) => DAY.test(d)).sort()
  if (!all.length) return null
  const newest = Date.parse(all[all.length - 1] + 'T00:00:00Z')
  const from = new Date(newest - RAMADAN_YEAR_DAYS * 86_400_000).toISOString().slice(0, 10)
  if (all[0] >= from) return null
  const out: MovedSettings = { ...m }
  const fasts = Object.entries(m.fastLog ?? {}).filter(([d]) => d >= from)
  const tarawih = (m.tarawihLog ?? []).filter((d) => d >= from)
  const quran = (m.quranLog ?? []).filter((d) => d >= from)
  if (fasts.length) out.fastLog = Object.fromEntries(fasts); else delete out.fastLog
  if (tarawih.length) out.tarawihLog = tarawih; else delete out.tarawihLog
  if (quran.length) out.quranLog = quran; else delete out.quranLog
  return out
}

/**
 * The code for a QR code: everything if it fits. Otherwise first only this
 * year's Ramadan record (`ramadanTrimmed`), then the tracker history trimmed to
 * the most recent days that fit (`keptDays` says how many made it).
 */
export async function encodeForQR(m: MovedSettings, max = QR_MAX_CHARS, prefixLength = 0): Promise<{ code: string; keptDays: number | null; ramadanTrimmed: boolean }> {
  const fits = (c: string) => c.length + prefixLength <= max
  let code = await encodeMove(m)
  if (fits(code)) return { code, keptDays: null, ramadanTrimmed: false }
  const thisYear = latestRamadanYear(m)
  const ramadanTrimmed = thisYear != null
  if (thisYear) {
    m = thisYear
    code = await encodeMove(m)
    if (fits(code)) return { code, keptDays: null, ramadanTrimmed }
  }
  const days = Object.keys(m.prayedLog ?? {}).sort()
  if (!days.length) return { code, keptDays: null, ramadanTrimmed }
  let keep = days.length
  for (;;) {
    keep = Math.floor(keep / 2)
    const recent = new Set(days.slice(days.length - keep))
    const trimmed: MovedSettings = { ...m, prayedLog: Object.fromEntries(Object.entries(m.prayedLog!).filter(([d]) => recent.has(d))) }
    if (!keep) delete trimmed.prayedLog
    const c = await encodeMove(trimmed)
    if (fits(c) || !keep) return { code: c, keptDays: keep, ramadanTrimmed }
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
  if (m.notifyPrayers || m.reminderMinutesBefore || m.quietHours || m.buzzOnly || m.jumuahReminderMinutes) lines.push('Which prayers to alert, and how')
  if (m.wakeUp || m.sahurAlarm) lines.push('Your wake-up alarms')
  if (Object.keys(m.fastLog ?? {}).length || m.tarawihLog?.length || m.quranLog?.length) lines.push('Your Ramadan record of fasts, Tarawih and juz')
  if (m.largeText) lines.push('Bigger text')
  if (m.musafirEnabled) lines.push('Musafir features')
  return lines.length ? lines : ['The standard settings']
}
