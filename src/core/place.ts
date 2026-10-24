import type { Coordinates } from './engine'
import { distanceKm } from './geo'
import { FALLBACK_PROFILE, profileFor, type CountryProfile } from './regions'

export interface Place {
  id: string
  name: string
  region?: string | null
  countryCode?: string | null
  countryName?: string | null
  timeZoneID: string
  coordinates: Coordinates
  /** Regency / city level, e.g. "Kota Bandung" - finds the Kemenag timetable in Indonesia. */
  district?: string | null
}

export const placeProfile = (p: Place): CountryProfile => profileFor(p.countryCode) ?? FALLBACK_PROFILE
export const isInAsia = (p: Place): boolean => profileFor(p.countryCode) != null

export function placeSubtitle(p: Place): string {
  return [p.region, p.countryName].filter((x): x is string => !!x && x !== p.name).join(', ')
}

/** Same spot for our purposes (prayer times differ by < 1 min within ~15 km). */
export function isNear(a: Place, b: Place): boolean {
  return distanceKm(a.coordinates, b.coordinates) < 2
}

export function newPlaceId(): string {
  return Math.random().toString(36).slice(2, 10)
}
