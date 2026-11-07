import { METHODS, methodWithId, withHighLatitude, type CalculationMethod } from './methods'
import type { NamingStyle } from './prayer'

import { COUNTRY_ROWS, TZ_COUNTRY, WORLD_CITIES, type CountryRow, type TimesSource } from './countries'

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
export function sourceSummary(p: CountryProfile, method: CalculationMethod, pinned: boolean, short = false): string {
  if (short) {
    if (pinned) return `You chose ${method.name} in Settings.`
    if (p.source === 'table') return `Official timetable from ${p.authority}.`
    if (p.source === 'authority') return `Follows ${p.authority}.`
    return `No official timetable here, so the app uses ${method.name}. Your local masjid may differ by a few minutes.`
  }
  if (pinned) return `You chose ${method.name} in Settings. Automatic would follow ${p.source === 'standard' ? 'the method most used here' : p.authority ?? 'the local authority'}.`
  switch (p.source) {
    case 'table': return `Official timetable from ${p.authority}. When it can't be downloaded, the app works it out with the same method.`
    case 'authority': return `Follows ${p.authority}, worked out on your phone with their method so it works offline.${p.note ? ` ${p.note}` : ''}`
    case 'standard': return `${p.note ?? `No official timetable the app can use here yet, so it uses ${method.name}, a standard method.`} Your local masjid may differ by a few minutes. You can choose another method in Settings, or send us your masjid's timetable.`
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
 * Maps). Countries spanning several zones are split by longitude.
 */
export function timeZoneForPlace(code: string | null | undefined, longitude: number): string | undefined {
  const c = code?.toUpperCase()
  if (c === 'ID') return longitude < 114.5 ? 'Asia/Jakarta' : longitude < 127.0 ? 'Asia/Makassar' : 'Asia/Jayapura'
  if (c === 'MY') return longitude < 109 ? 'Asia/Kuala_Lumpur' : 'Asia/Kuching'
  if (c === 'KZ') return 'Asia/Almaty'
  if (c === 'CN') return 'Asia/Shanghai'
  if (c === 'UZ') return 'Asia/Tashkent'
  if (c === 'VN') return 'Asia/Ho_Chi_Minh'
  if (c === 'IN') return 'Asia/Kolkata'
  if (c === 'MM') return 'Asia/Yangon'
  if (c === 'PS') return 'Asia/Hebron'
  if (!c) return undefined
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

/**
 * Your names, when you haven't picked any: your browser's language when we
 * have names in it, else your home country's, else your region's, else
 * International. Read from the device only, never from your IP address.
 */
export function personalNaming(homeCountry: string | null | undefined, locale: string): NamingStyle {
  const parts = locale.replace(/_/g, '-').split('-')
  const lang = parts[0]
  const region = parts.slice(1).find((s) => /^[A-Za-z]{2}$/.test(s))
  const spoken = namingForLanguage(lang)
  if (spoken) return spoken
  // A home with its own spelling wins over an English browser.
  const home = profileFor(homeCountry)
  if (home && home.naming !== 'arabic') return home.naming
  return profileFor(region)?.naming ?? 'arabic'
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
