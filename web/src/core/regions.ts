import { appLang, appWord, type AppWordArgs, type AppWordKey } from './appWords'
import type { Lang3 } from './ramadanContent'
import { METHODS, methodWithId, withHighLatitude, type CalculationMethod } from './methods'
import type { NamingStyle } from './prayer'

import { COUNTRY_ROWS, TZ_COUNTRY, WORLD_CITIES, type CountryRow, type TimesSource } from './countries'
import { distanceKm } from './geo'
import { deviceTimeZone, isValidTimeZone } from './tz'
import { ZONE_ANCHORS } from './zoneAnchors'

/**
 * What the app does by default in each country: whose times it follows, which
 * method, which Asr school, and how prayer names are spelled. The heart of
 * travel mode. The table itself lives in data/countries.json (one copy for all
 * three apps), so edit that and run tools/gen_countries.py.
 *
 * The owner's rule: the local official or state religious authority first
 * (its timetable, else its own method); a standard method only where no
 * authority's times can be used, and then the app says so.
 */
export type CountryProfile = CountryRow
export type { TimesSource }

/** The country's method, with the country's own rule for short summer nights. */
export const profileMethod = (p: CountryProfile): CalculationMethod =>
  withHighLatitude(methodWithId(p.methodID) ?? METHODS.mwl, p.highLatitude)

/**
 * A method the person picked in Settings, used in this country: keeps the
 * method's own high-latitude rule, else takes the country's.
 */
export const methodHere = (m: CalculationMethod, p: CountryProfile): CalculationMethod =>
  m.highLatitude === 'fallback' ? withHighLatitude(m, p.highLatitude) : m

export function flag(code: string): string {
  if (!code) return ''
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)))
}

export const PROFILES: CountryProfile[] = COUNTRY_ROWS

const BY_CODE = new Map(PROFILES.map((x) => [x.code, x]))

export function profileFor(code: string | null | undefined): CountryProfile | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined
}

/** Somewhere not in the table: still works, with the international method. */
export const FALLBACK_PROFILE: CountryProfile = {
  code: '', name: 'Worldwide', methodID: 'mwl', asr: 'standard', naming: 'arabic', source: 'standard', highLatitude: 'angle',
}

/**
 * Where this place's times come from, in plain words: the authority, or the
 * standard method and why. `pinned` when the person chose a method in Settings.
 */
export function sourceSummary(p: CountryProfile, method: CalculationMethod, pinned: boolean, short = false, lang: Lang3 = appLang()): string {
  const w = (key: AppWordKey, args: AppWordArgs = {}) => appWord(lang, key, args)
  const authority = p.authority ?? w('source.summary.localAuthority')
  if (short) {
    if (pinned) return w('source.summary.pinnedShort', { method: method.name })
    if (p.source === 'table') return w('source.summary.tableShort', { authority })
    if (p.source === 'authority') return w('source.summary.authorityShort', { authority })
    return w('source.summary.standardShort', { method: method.name })
  }
  if (pinned) return w('source.summary.pinned', { method: method.name, follow: p.source === 'standard' ? w('source.summary.mostUsed') : authority })
  switch (p.source) {
    case 'table': return w('source.summary.table', { authority })
    // The country notes in data/countries.json stay in English for now.
    case 'authority': return `${w('source.summary.authority', { authority })}${p.note ? ` ${p.note}` : ''}`
    case 'standard': return `${p.note ?? w('source.summary.standardNone', { method: method.name })} ${w('source.summary.standardEnd')}`
  }
}

/** Offline country guess from a time zone. */
export function countryForTimeZone(tz: string): string | undefined {
  return TZ_COUNTRY[tz]
}

/** A representative zone for a country (first match, sorted). */
export function timeZoneForCountry(code: string | null | undefined): string | undefined {
  if (!code) return undefined
  const c = code.toUpperCase()
  return Object.keys(TZ_COUNTRY).filter((k) => TZ_COUNTRY[k] === c).sort()[0]
}

/**
 * The zone for a searched place (web addition: the iOS app gets it from Apple
 * Maps). Countries spanning several zones are split by where the place is:
 * with its latitude, the nearest listed city or zone point (core/zoneAnchors.ts)
 * in that country; without it, the listed city nearest in longitude.
 */
export function timeZoneForPlace(code: string | null | undefined, longitude: number, latitude?: number): string | undefined {
  const c = code?.toUpperCase()
  const near = latitude != null && Number.isFinite(latitude) && c ? nearestZone(c, latitude, longitude) : undefined
  if (c === 'ID') {
    // Indonesia's three zones mostly follow longitude; the anchors only fix the places near a border that doesn't.
    if (near && near.km < 150) return near.tz
    return longitude < 114.5 ? 'Asia/Jakarta' : longitude < 127.0 ? 'Asia/Makassar' : 'Asia/Jayapura'
  }
  if (c === 'MY') return longitude < 109 ? 'Asia/Kuala_Lumpur' : 'Asia/Kuching'
  if (c === 'KZ') return 'Asia/Almaty'
  if (c === 'CN') return 'Asia/Shanghai'
  if (c === 'UZ') return 'Asia/Tashkent'
  if (c === 'VN') return 'Asia/Ho_Chi_Minh'
  if (c === 'IN') return 'Asia/Kolkata'
  if (c === 'MM') return 'Asia/Yangon'
  if (c === 'PS') return 'Asia/Hebron'
  if (!c) return undefined
  if (near) return near.tz
  // Elsewhere, a country with several zones: the zone of the listed city nearest in longitude.
  const zones = new Set(Object.keys(TZ_COUNTRY).filter((k) => TZ_COUNTRY[k] === c))
  if (zones.size > 1) {
    let best: string | undefined, bestDiff = Infinity
    for (const [, , cc, , lng, tz] of WORLD_CITIES) {
      if (cc !== c) continue
      const d = Math.abs(lng - longitude)
      if (d < bestDiff) { best = tz; bestDiff = d }
    }
    if (best) return best
  }
  return timeZoneForCountry(c)
}

/** The zone of the nearest listed city or zone point, for countries with more than one zone. */
function nearestZone(c: string, lat: number, lng: number): { tz: string; km: number } | undefined {
  const points: [number, number, string][] = ZONE_ANCHORS.filter((a) => a[0] === c).map(([, la, lo, tz]) => [la, lo, tz])
  const several = points.length > 0 || Object.keys(TZ_COUNTRY).filter((k) => TZ_COUNTRY[k] === c).length > 1
  if (!several) return undefined
  for (const [, , cc, la, lo, tz] of WORLD_CITIES) if (cc === c) points.push([la, lo, tz])
  let best: { tz: string; km: number } | undefined
  for (const [la, lo, tz] of points) {
    const km = distanceKm({ latitude: lat, longitude: lng }, { latitude: la, longitude: lo })
    if ((!best || km < best.km) && isValidTimeZone(tz)) best = { tz, km }
  }
  return best
}

/**
 * The zone for a place found by GPS: the device's own zone when it belongs to
 * that country (the phone is there, so its clock is right, Indiana or Arizona
 * included), otherwise worked out from where the place is.
 */
export function timeZoneForLocated(code: string | null | undefined, latitude: number, longitude: number, device = deviceTimeZone()): string | undefined {
  if (code && isValidTimeZone(device) && countryForTimeZone(device) === code.toUpperCase()) return device
  return timeZoneForPlace(code, longitude, latitude)
}

/**
 * Your names, when you haven't picked any: your browser's language when we
 * have names in it, else English (International). Your home country does not
 * change them, so a Singapore user on an English browser sees Fajr, and picks
 * Malay in Settings for Subuh. Read from the device only, never from your IP
 * address.
 */
export function personalNaming(locale: string): NamingStyle {
  return namingForLanguage(locale.replace(/_/g, '-').split('-')[0]) ?? 'arabic'
}

/** The names that go with a language code (ISO 639; old Android/Java code "in" is Indonesian). */
export function namingForLanguage(lang: string | null | undefined): NamingStyle | null {
  switch (lang?.toLowerCase()) {
    case 'ms': return 'malay'
    case 'id': case 'in': return 'indonesian'
    case 'tr': return 'turkish'
    case 'ar': return 'arabicScript'
    case 'ur': return 'urdu'
    case 'bn': return 'bengali'
    case 'fr': return 'french'
    default: return null
  }
}
