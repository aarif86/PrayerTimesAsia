import type { CalculationMethod } from './methods'
import type { SourceGrade } from './sources'
import { PROFILES, type CountryProfile } from './regions'
import { tr, type AppWordKey } from './appWords'

/**
 * What kind of time this is, in plain words, so nobody has to know what a
 * grade means.
 *   published   copied from the timetable an authority publishes
 *   formula     worked out on the device with an authority's own published method
 *   masjid      from a masjid's own timetable
 *   calculated  worked out with a widely used international method
 */
export type TimeKind = 'published' | 'formula' | 'masjid' | 'calculated'

/** Methods that belong to no single authority. Everything else is some authority's own method. */
const INTERNATIONAL = new Set(['sea', 'mwl', 'karachi', 'isna', 'moonsighting'])

export function timeKind(grade: SourceGrade, hasOfficialTimetable: boolean, method: CalculationMethod): TimeKind {
  if (grade === 'B') return 'masjid'
  if (grade === 'A') return hasOfficialTimetable ? 'published' : 'formula'
  if (grade === 'D' && !INTERNATIONAL.has(method.id)) return 'formula'
  return 'calculated'
}

const KIND_KEY: Record<TimeKind, AppWordKey> = {
  published: 'source.kindPublished', formula: 'source.kindFormula', masjid: 'source.kindMasjid', calculated: 'source.kindCalculated',
}
const EXPLAIN_KEY: Record<TimeKind, AppWordKey> = {
  published: 'source.kindExplainPublished', formula: 'source.kindExplainFormula', masjid: 'source.kindExplainMasjid', calculated: 'source.kindExplainCalculated',
}
export const timeKindTitle = (k: TimeKind): string => tr(KIND_KEY[k])
export const timeKindExplanation = (k: TimeKind): string => tr(EXPLAIN_KEY[k])

/** The country whose authority owns this method (null for international methods). */
export function methodCountry(method: CalculationMethod): CountryProfile | null {
  if (INTERNATIONAL.has(method.id)) return null
  return PROFILES.find((p) => p.methodID === method.id && p.source !== 'standard') ?? null
}

/**
 * The person pinned a method in Settings and is now in another country, so the
 * times follow a country they are not in. Returns that country, else null.
 */
export function awayFromMethodCountry(pinned: boolean, method: CalculationMethod, placeCountry: string | null | undefined): CountryProfile | null {
  if (!pinned || !placeCountry) return null
  const home = methodCountry(method)
  return home && home.code !== placeCountry.toUpperCase() ? home : null
}
