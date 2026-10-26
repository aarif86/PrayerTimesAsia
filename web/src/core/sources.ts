import type { Coordinates, PrayerDay } from './engine'
import { distanceKm } from './geo'
import type { CalculationMethod } from './methods'
import { OBLIGATORY, type AsrSchool, type Prayer } from './prayer'
import { zonedTime } from './tz'

/** Where a day's times come from - the "sanad" shown next to every timetable. */
export type SourceGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export const GRADE_TITLE: Record<SourceGrade, string> = {
  A: 'Official', B: 'Masjid-confirmed', C: 'Community-verified', D: 'Calculated', F: 'Falak (observed)',
}

export const GRADE_EXPLANATION: Record<SourceGrade, string> = {
  A: 'Published by the national or state religious authority, or its exact published method.',
  B: "From a named mosque's own timetable, checked against our calculation.",
  C: 'Method confirmed by two or more independent local contributors.',
  D: 'Astronomical calculation on your device. The method is shown; local mosques may differ by a few minutes.',
  F: "Worked out from your own observation of the sun's shadow or the sky, with honest ± minutes. Used to learn and to check, never in place of the grades above.",
}

/** A mosque's own timetable rule, from data/mosques.json in the iOS repo. */
export interface MosqueProfile {
  id: string
  name: string
  lat: number
  lng: number
  country: string
  radiusKm?: number | null
  fingerprint?: {
    fajrAngle: number
    ishaAngle?: number | null
    ishaInterval?: number | null
    asrFactor: number
    offsets: Record<string, number>
  } | null
  jamaah?: Record<string, { fixed?: string | null; afterMinutes?: number | null; beforeSunriseMinutes?: number | null }> | null
  jumuah?: string | null
  source: string
  verifiedAt: string
  grade: SourceGrade
}

export interface MosqueDataset { version: number; licence: string; mosques: MosqueProfile[] }

export function mosqueMethod(m: MosqueProfile): CalculationMethod | null {
  const fp = m.fingerprint
  if (!fp) return null
  const offsets: Partial<Record<Prayer, number>> = {}
  for (const [k, v] of Object.entries(fp.offsets)) {
    if (['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(k)) offsets[k as Prayer] = v
  }
  const isha = fp.ishaAngle != null ? `Isha ${fp.ishaAngle}°` : `Isha +${Math.trunc(fp.ishaInterval ?? 0)} min`
  return {
    id: `mosque-${m.id}`, name: m.name, shortName: m.name,
    fajrAngle: fp.fajrAngle, ishaAngle: fp.ishaAngle ?? null, ishaInterval: fp.ishaInterval ?? null,
    ramadanIshaInterval: null, maghribAngle: null, offsets, matchesOfficialTable: false,
    note: `${m.name}'s own timetable (Fajr ${fp.fajrAngle}° · ${isha}), from: ${m.source}.`,
  }
}

export function mosqueAsr(m: MosqueProfile): AsrSchool | null {
  return m.fingerprint ? (m.fingerprint.asrFactor === 2 ? 'hanafi' : 'standard') : null
}

/** Jamaah times for a day, in the place's time zone. */
export function jamaahTimes(m: MosqueProfile, day: PrayerDay, tz: string, isFriday: boolean): Partial<Record<Prayer, number>> {
  const at = (hhmm: string): number | null => {
    const p = hhmm.split(':').map((x) => parseInt(x, 10))
    if (p.length !== 2 || p.some(Number.isNaN)) return null
    return zonedTime(day.year, day.month, day.day, p[0], p[1], 0, tz)
  }
  const out: Partial<Record<Prayer, number>> = {}
  for (const prayer of OBLIGATORY) {
    if (prayer === 'dhuhr' && isFriday && m.jumuah) {
      const d = at(m.jumuah)
      if (d != null) { out[prayer] = d; continue }
    }
    const rule = m.jamaah?.[prayer]
    if (!rule) continue
    if (rule.fixed) {
      const d = at(rule.fixed)
      if (d != null) out[prayer] = d
    } else if (rule.afterMinutes != null) {
      out[prayer] = day.times[prayer] + rule.afterMinutes * 60_000
    } else if (rule.beforeSunriseMinutes != null) {
      out[prayer] = day.times.sunrise - rule.beforeSunriseMinutes * 60_000
    }
  }
  return out
}

/** The closest profile whose radius covers `point`. */
export function mosqueNear(dataset: MosqueDataset, point: Coordinates): MosqueProfile | null {
  let best: MosqueProfile | null = null
  let bestKm = Infinity
  for (const m of dataset.mosques) {
    const km = distanceKm({ latitude: m.lat, longitude: m.lng }, point)
    if (km <= (m.radiusKm ?? 3) && km < bestKm) { best = m; bestKm = km }
  }
  return best
}

/** Prayers where `other` differs from `day` by more than 2 minutes. */
export function disagreements(day: PrayerDay, other: PrayerDay): Partial<Record<Prayer, number>> {
  const out: Partial<Record<Prayer, number>> = {}
  for (const p of OBLIGATORY) {
    if (Math.abs(other.times[p] - day.times[p]) > 120_000) out[p] = other.times[p]
  }
  return out
}

