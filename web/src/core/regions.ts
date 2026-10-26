import { METHODS, methodWithId, type CalculationMethod } from './methods'
import type { AsrSchool, NamingStyle } from './prayer'

/**
 * What the app does by default in each Asian country: which authority's method,
 * which Asr school, and how prayer names are spelled. The heart of travel mode.
 */
export interface CountryProfile {
  code: string
  name: string
  methodID: string
  asr: AsrSchool
  naming: NamingStyle
}

export const profileMethod = (p: CountryProfile): CalculationMethod => methodWithId(p.methodID) ?? METHODS.mwl

export function flag(code: string): string {
  if (!code) return ''
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)))
}

const p = (code: string, name: string, methodID: string, asr: AsrSchool = 'standard', naming: NamingStyle = 'arabic'): CountryProfile =>
  ({ code, name, methodID, asr, naming })

export const PROFILES: CountryProfile[] = [
  // Southeast Asia
  p('SG', 'Singapore', 'muis', 'standard', 'malay'),
  p('MY', 'Malaysia', 'jakim', 'standard', 'malay'),
  p('BN', 'Brunei', 'sea', 'standard', 'malay'),
  p('ID', 'Indonesia', 'kemenag', 'standard', 'indonesian'),
  p('TH', 'Thailand', 'sea'),
  p('VN', 'Vietnam', 'sea'),
  p('KH', 'Cambodia', 'sea'),
  p('LA', 'Laos', 'sea'),
  p('MM', 'Myanmar', 'sea'),
  p('PH', 'Philippines', 'sea'),
  p('TL', 'Timor-Leste', 'sea'),
  // East Asia
  p('JP', 'Japan', 'mwl'),
  p('KR', 'South Korea', 'mwl'),
  p('KP', 'North Korea', 'mwl'),
  p('CN', 'China', 'mwl', 'hanafi'),
  p('TW', 'Taiwan', 'mwl'),
  p('HK', 'Hong Kong', 'mwl'),
  p('MO', 'Macau', 'mwl'),
  p('MN', 'Mongolia', 'mwl', 'hanafi'),
  // South Asia
  p('IN', 'India', 'karachi', 'hanafi', 'southAsian'),
  p('PK', 'Pakistan', 'karachi', 'hanafi', 'southAsian'),
  p('BD', 'Bangladesh', 'karachi', 'hanafi', 'southAsian'),
  p('AF', 'Afghanistan', 'karachi', 'hanafi', 'southAsian'),
  p('NP', 'Nepal', 'karachi', 'hanafi', 'southAsian'),
  p('BT', 'Bhutan', 'karachi', 'hanafi', 'southAsian'),
  p('LK', 'Sri Lanka', 'karachi', 'standard', 'southAsian'),
  p('MV', 'Maldives', 'karachi', 'standard', 'southAsian'),
  // Central Asia
  p('KZ', 'Kazakhstan', 'mwl', 'hanafi'),
  p('UZ', 'Uzbekistan', 'mwl', 'hanafi'),
  p('KG', 'Kyrgyzstan', 'mwl', 'hanafi'),
  p('TJ', 'Tajikistan', 'mwl', 'hanafi'),
  p('TM', 'Turkmenistan', 'mwl', 'hanafi'),
  // West Asia
  p('SA', 'Saudi Arabia', 'ummalqura'),
  p('AE', 'United Arab Emirates', 'dubai'),
  p('QA', 'Qatar', 'qatar'),
  p('KW', 'Kuwait', 'kuwait'),
  p('BH', 'Bahrain', 'ummalqura'),
  p('OM', 'Oman', 'mwl'),
  p('YE', 'Yemen', 'mwl'),
  p('JO', 'Jordan', 'mwl'),
  p('PS', 'Palestine', 'mwl'),
  p('IL', 'Israel', 'mwl'),
  p('LB', 'Lebanon', 'mwl'),
  p('SY', 'Syria', 'egyptian'),
  p('IQ', 'Iraq', 'mwl'),
  p('IR', 'Iran', 'tehran'),
  p('TR', 'Türkiye', 'diyanet', 'hanafi', 'turkish'),
  p('AZ', 'Azerbaijan', 'mwl'),
  p('GE', 'Georgia', 'mwl'),
  p('AM', 'Armenia', 'mwl'),
  p('CY', 'Cyprus', 'diyanet', 'hanafi', 'turkish'),
]

const BY_CODE = new Map(PROFILES.map((x) => [x.code, x]))

export function profileFor(code: string | null | undefined): CountryProfile | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined
}

/** Used outside Asia: still works, with the international default. */
export const FALLBACK_PROFILE: CountryProfile = { code: '', name: 'Outside Asia', methodID: 'mwl', asr: 'standard', naming: 'arabic' }

const TZ_COUNTRY: Record<string, string> = {
  'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY', 'Asia/Brunei': 'BN',
  'Asia/Jakarta': 'ID', 'Asia/Pontianak': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID',
  'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA', 'Asia/Yangon': 'MM', 'Asia/Rangoon': 'MM', 'Asia/Manila': 'PH', 'Asia/Dili': 'TL',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Pyongyang': 'KP', 'Asia/Shanghai': 'CN', 'Asia/Urumqi': 'CN',
  'Asia/Taipei': 'TW', 'Asia/Hong_Kong': 'HK', 'Asia/Macau': 'MO', 'Asia/Ulaanbaatar': 'MN',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Kabul': 'AF',
  'Asia/Kathmandu': 'NP', 'Asia/Thimphu': 'BT', 'Asia/Colombo': 'LK', 'Indian/Maldives': 'MV',
  'Asia/Almaty': 'KZ', 'Asia/Tashkent': 'UZ', 'Asia/Samarkand': 'UZ', 'Asia/Bishkek': 'KG',
  'Asia/Dushanbe': 'TJ', 'Asia/Ashgabat': 'TM',
  'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM', 'Asia/Aden': 'YE', 'Asia/Amman': 'JO', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS',
  'Asia/Jerusalem': 'IL', 'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY', 'Asia/Baghdad': 'IQ',
  'Asia/Tehran': 'IR', 'Europe/Istanbul': 'TR', 'Asia/Baku': 'AZ', 'Asia/Tbilisi': 'GE',
  'Asia/Yerevan': 'AM', 'Asia/Nicosia': 'CY',
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
  return timeZoneForCountry(c)
}

/**
 * Your names, when you haven't picked any: your home country's, else your
 * browser's language or region, else International.
 */
export function personalNaming(homeCountry: string | null | undefined, locale: string): NamingStyle {
  const home = profileFor(homeCountry)
  if (home) return home.naming
  const parts = locale.replace(/_/g, '-').split('-')
  const lang = parts[0]
  const region = parts.slice(1).find((s) => /^[A-Za-z]{2}$/.test(s))
  switch (lang?.toLowerCase()) {
    case 'ms': return 'malay'
    case 'id': return 'indonesian'
    case 'tr': return 'turkish'
    case 'ur': case 'bn': return 'southAsian'
  }
  return profileFor(region)?.naming ?? 'arabic'
}
