import type { Prayer } from './prayer'

/**
 * The parameters one authority uses to turn the sun's position into prayer times.
 * Every time the engine produces is ceil(astronomical time + offset) to the
 * minute. The offsets are each authority's precautionary minutes (ihtiyat),
 * fitted for MUIS, JAKIM and Kemenag on their full 2026 official timetables, so
 * the offline calculation is never earlier than the official time.
 * (Values identical to the iOS app's CalculationMethod.swift.)
 */
export interface CalculationMethod {
  id: string
  name: string
  shortName: string
  fajrAngle: number
  /** Sun depression for Isha; null when Isha is a fixed interval after Maghrib. */
  ishaAngle: number | null
  ishaInterval: number | null
  ramadanIshaInterval: number | null
  /** Sun depression for Maghrib; null means at sunset. */
  maghribAngle: number | null
  offsets: Partial<Record<Prayer, number>>
  matchesOfficialTable: boolean
  note: string
}

function fmt(v: number): string {
  return Math.round(v) === v ? String(v) : v.toFixed(1)
}

export function parameterSummary(m: CalculationMethod): string {
  const isha = m.ishaAngle != null ? `Isha ${fmt(m.ishaAngle)}°` : `Isha +${Math.trunc(m.ishaInterval ?? 0)} min`
  return `Fajr ${fmt(m.fajrAngle)}° · ${isha}`
}

const M = (m: Omit<CalculationMethod, 'ramadanIshaInterval' | 'maghribAngle' | 'ishaInterval'> &
  Partial<Pick<CalculationMethod, 'ramadanIshaInterval' | 'maghribAngle' | 'ishaInterval'>>): CalculationMethod => ({
  ishaInterval: null, ramadanIshaInterval: null, maghribAngle: null, ...m,
})

export const METHODS = {
  muis: M({
    id: 'muis', name: 'MUIS · Singapore', shortName: 'MUIS', fajrAngle: 20, ishaAngle: 18,
    offsets: { fajr: 0.625, sunrise: -0.375, dhuhr: 1.5, asr: 0.5, maghrib: 0.875, isha: 0.5 },
    matchesOfficialTable: true,
    note: "Majlis Ugama Islam Singapura. Online, the app shows MUIS's official timetable; offline it calculates, never earlier than the official time.",
  }),
  jakim: M({
    id: 'jakim', name: 'JAKIM · Malaysia', shortName: 'JAKIM', fajrAngle: 18, ishaAngle: 18,
    offsets: { fajr: 2.375, sunrise: -1.375, dhuhr: 3, asr: 2.25, maghrib: 2.25, isha: 2.375 },
    matchesOfficialTable: true,
    note: "Malaysia's 18° Subuh criterion (since 2019). Online, the app shows JAKIM's official e-Solat timetable for your zone; offline it calculates to within about 2 minutes.",
  }),
  kemenag: M({
    id: 'kemenag', name: 'Kemenag · Indonesia', shortName: 'Kemenag', fajrAngle: 20, ishaAngle: 18,
    offsets: { fajr: 2.25, sunrise: -4.5, dhuhr: 3.25, asr: 2.5, maghrib: 3.25, isha: 2.5 },
    matchesOfficialTable: true,
    note: "Kementerian Agama. Online, the app shows Kemenag's official timetable for your city or regency; offline it calculates with offsets fitted on the full 2026 Jakarta, Surabaya and Makassar tables.",
  }),
  sea: M({
    id: 'sea', name: 'Southeast Asia standard', shortName: 'SEA 20°/18°', fajrAngle: 20, ishaAngle: 18,
    offsets: { dhuhr: 1 }, matchesOfficialTable: false,
    note: 'The 20°/18° convention used across the Malay world. A sensible default where no national timetable exists.',
  }),
  mwl: M({
    id: 'mwl', name: 'Muslim World League', shortName: 'MWL', fajrAngle: 18, ishaAngle: 17,
    offsets: {}, matchesOfficialTable: false,
    note: 'The most widely used international convention; common in East Asia.',
  }),
  karachi: M({
    id: 'karachi', name: 'Karachi · University of Islamic Sciences', shortName: 'Karachi', fajrAngle: 18, ishaAngle: 18,
    offsets: {}, matchesOfficialTable: false,
    note: 'Standard across Pakistan, India, Bangladesh and Afghanistan.',
  }),
  ummalqura: M({
    id: 'ummalqura', name: 'Umm al-Qura · Makkah', shortName: 'Umm al-Qura', fajrAngle: 18.5, ishaAngle: null,
    ishaInterval: 90, ramadanIshaInterval: 120, offsets: {}, matchesOfficialTable: false,
    note: 'Saudi Arabia. Isha is 90 minutes after Maghrib, 120 in Ramadan.',
  }),
  dubai: M({
    id: 'dubai', name: 'Dubai · UAE', shortName: 'UAE', fajrAngle: 18.2, ishaAngle: 18.2,
    offsets: { sunrise: -3, dhuhr: 3, asr: 3, maghrib: 3 }, matchesOfficialTable: false,
    note: 'United Arab Emirates convention.',
  }),
  qatar: M({
    id: 'qatar', name: 'Qatar', shortName: 'Qatar', fajrAngle: 18, ishaAngle: null, ishaInterval: 90,
    offsets: {}, matchesOfficialTable: false, note: 'Isha 90 minutes after Maghrib.',
  }),
  kuwait: M({
    id: 'kuwait', name: 'Kuwait', shortName: 'Kuwait', fajrAngle: 18, ishaAngle: 17.5,
    offsets: {}, matchesOfficialTable: false, note: 'Kuwait convention.',
  }),
  diyanet: M({
    id: 'diyanet', name: 'Diyanet · Türkiye', shortName: 'Diyanet', fajrAngle: 18, ishaAngle: 17,
    offsets: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 }, matchesOfficialTable: false,
    note: 'An approximation of the Diyanet method; most accurate within Türkiye.',
  }),
  tehran: M({
    id: 'tehran', name: 'Tehran · Jafari', shortName: 'Jafari', fajrAngle: 17.7, ishaAngle: 14, maghribAngle: 4.5,
    offsets: {}, matchesOfficialTable: false,
    note: 'Institute of Geophysics, University of Tehran. Maghrib when the sun is 4.5° below the horizon.',
  }),
  egyptian: M({
    id: 'egyptian', name: 'Egyptian General Authority', shortName: 'Egypt', fajrAngle: 19.5, ishaAngle: 17.5,
    offsets: {}, matchesOfficialTable: false, note: 'Common in the Levant.',
  }),
} satisfies Record<string, CalculationMethod>

export const ALL_METHODS: CalculationMethod[] = [
  METHODS.muis, METHODS.jakim, METHODS.kemenag, METHODS.sea, METHODS.mwl, METHODS.karachi,
  METHODS.ummalqura, METHODS.dubai, METHODS.qatar, METHODS.kuwait, METHODS.diyanet, METHODS.tehran, METHODS.egyptian,
]

export function methodWithId(id: string | null | undefined): CalculationMethod | undefined {
  return id ? ALL_METHODS.find((m) => m.id === id) : undefined
}
