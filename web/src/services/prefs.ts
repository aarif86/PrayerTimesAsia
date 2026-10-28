import type { MasjidLink } from '../core/masjidLink'
import type { Place } from '../core/place'
import { OBLIGATORY, type AsrSchool, type NamingStyle, type Prayer } from '../core/prayer'

export type Appearance = 'system' | 'light' | 'dark'
export const APPEARANCES: Appearance[] = ['system', 'light', 'dark']
export const APPEARANCE_LABEL: Record<Appearance, string> = {
  system: 'Automatic (follows the sky)', light: 'Light', dark: 'Dark',
}

/** How the Prayer screen shows the day (same order as the iOS TodayStyle). */
export type TodayStyle = 'list' | 'centre' | 'dial' | 'sunPath' | 'bands'
export const TODAY_STYLES: TodayStyle[] = ['centre', 'list', 'dial', 'sunPath', 'bands']
export const TODAY_STYLE_LABEL: Record<TodayStyle, string> = {
  list: 'Side Dial', centre: 'Centre Dial', dial: 'Day Dial', sunPath: 'Sun Path', bands: 'Colour Bands',
}

export interface TripStop { countryCode: string; countryName: string; placeName: string; arrived: number }

/**
 * Everything the user chooses, kept in this browser only. `null` overrides mean
 * "automatic for the country I'm in" - the travel-mode behaviour.
 */
export interface Preferences {
  hasOnboarded: boolean
  useGPS: boolean
  manualPlace: Place | null
  savedPlaces: Place[]
  home: Place | null
  methodOverrideID: string | null
  asrOverride: AsrSchool | null
  namingOverride: NamingStyle | null
  use24Hour: boolean
  hijriAdjustment: number
  notificationsEnabled: boolean
  notifyPrayers: Prayer[]
  reminderMinutesBefore: number
  musafirThresholdKm: number
  jakimZoneOverride: string | null
  lastCountryCode: string | null
  arrivedAt: number | null
  arrivalBannerDismissed: boolean
  trip: TripStop[]
  trackerEnabled: boolean
  prayedLog: Record<string, Prayer[]>
  excusedDays: string[]
  communityAuthority: string | null
  appearance: Appearance
  todayStyle: TodayStyle
  showOffers: boolean
  musafirEnabled: boolean
  showLocalNames: boolean
  alertsPromptDismissed: boolean
  appPromptDismissed: boolean
  /** The masjid whose iqamah times show on the Prayer screen, from its screen's QR code. */
  myMasjid: MasjidLink | null
  /** Anonymous usage counts (city and country, never coordinates). See services/usage.ts. */
  shareUsage: boolean
}

export const DEFAULT_PREFS: Preferences = {
  hasOnboarded: false,
  useGPS: true,
  manualPlace: null,
  savedPlaces: [],
  home: null,
  methodOverrideID: null,
  asrOverride: null,
  namingOverride: null,
  use24Hour: false,
  hijriAdjustment: 0,
  notificationsEnabled: false,
  notifyPrayers: [...OBLIGATORY],
  reminderMinutesBefore: 0,
  musafirThresholdKm: 81,
  jakimZoneOverride: null,
  lastCountryCode: null,
  arrivedAt: null,
  arrivalBannerDismissed: true,
  trip: [],
  trackerEnabled: false,
  prayedLog: {},
  excusedDays: [],
  communityAuthority: null,
  appearance: 'system',
  todayStyle: 'centre',
  showOffers: true,
  musafirEnabled: false,
  showLocalNames: true,
  alertsPromptDismissed: false,
  appPromptDismissed: false,
  myMasjid: null,
  shareUsage: true,
}

const NULLABLE = new Set<keyof Preferences>([
  'manualPlace', 'home', 'methodOverrideID', 'asrOverride', 'namingOverride', 'jakimZoneOverride',
  'lastCountryCode', 'arrivedAt', 'communityAuthority', 'myMasjid',
])

const ENUMS: Partial<Record<keyof Preferences, readonly string[]>> = {
  appearance: ['system', 'light', 'dark'],
  todayStyle: ['list', 'centre', 'dial', 'sunPath', 'bands'],
  asrOverride: ['standard', 'hanafi'],
  namingOverride: ['arabic', 'malay', 'indonesian', 'southAsian', 'turkish'],
}

/**
 * Field by field with defaults, so adding a preference in an update never throws
 * away the ones a user already set (same rule as the iOS Preferences decoder).
 */
export function decodePreferences(raw: unknown): Preferences {
  const out: Preferences = structuredClone(DEFAULT_PREFS)
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const key of Object.keys(DEFAULT_PREFS) as (keyof Preferences)[]) {
    if (!(key in r)) continue
    const v = r[key]
    const d = DEFAULT_PREFS[key]
    if (v === null) { if (NULLABLE.has(key)) (out as unknown as Record<string, unknown>)[key] = null; continue }
    const allowed = ENUMS[key]
    if (allowed && !(typeof v === 'string' && allowed.includes(v))) continue
    if (NULLABLE.has(key) && d === null) {
      // Nullable values: accept the right primitive or an object (places).
      if ((key === 'manualPlace' || key === 'home') && !isPlace(v)) continue
      if (key === 'arrivedAt' && typeof v !== 'number') continue
      if (key === 'myMasjid' && !isMasjid(v)) continue
      if (['methodOverrideID', 'jakimZoneOverride', 'lastCountryCode', 'communityAuthority'].includes(key) && typeof v !== 'string') continue
      ;(out as unknown as Record<string, unknown>)[key] = v
      continue
    }
    if (Array.isArray(d)) {
      if (!Array.isArray(v)) continue
      if (key === 'savedPlaces') (out as unknown as Record<string, unknown>)[key] = v.filter(isPlace)
      else (out as unknown as Record<string, unknown>)[key] = v
      continue
    }
    if (typeof d === 'object') { if (typeof v === 'object' && !Array.isArray(v)) (out as unknown as Record<string, unknown>)[key] = v; continue }
    if (typeof v === typeof d) (out as unknown as Record<string, unknown>)[key] = v
  }
  return out
}

function isMasjid(v: unknown): v is MasjidLink {
  const m = v as MasjidLink
  return !!m && typeof m === 'object' && typeof m.name === 'string' && typeof m.lat === 'number' &&
    typeof m.lng === 'number' && typeof m.tz === 'string' && !!m.jamaah && typeof m.jamaah === 'object'
}

function isPlace(v: unknown): v is Place {
  const p = v as Place
  return !!p && typeof p === 'object' && typeof p.name === 'string' && typeof p.timeZoneID === 'string' &&
    !!p.coordinates && typeof p.coordinates.latitude === 'number' && typeof p.coordinates.longitude === 'number'
}

const KEY = 'ptasia.preferences.v1'

export function loadPreferences(): Preferences {
  try {
    const s = localStorage.getItem(KEY)
    return s ? decodePreferences(JSON.parse(s)) : structuredClone(DEFAULT_PREFS)
  } catch {
    return structuredClone(DEFAULT_PREFS)
  }
}

export function savePreferences(p: Preferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode: keep in memory */ }
}
