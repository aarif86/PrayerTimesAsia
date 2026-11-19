import data from '../../../data/friday-sg.json'
import type { Coordinates } from './engine'
import { distanceKm } from './geo'

/**
 * Singapore masjids that hold a second Friday prayer, from the Islamic Religious
 * Council of Singapore (MUIS) list in data/friday-sg.json. Bundled with the app,
 * so nothing is fetched and nothing about the user leaves the device.
 */
export interface FridayMosque { name: string; district: string; lat: number; lng: number; womenSession2: boolean }

export const FRIDAY_SG = data as {
  source: string; sourceUrl: string; sourceUpdated: string; secondSessionFrom: string; mosques: FridayMosque[]
}

const MATCH_KM = 0.3

/** The listed two-session masjid at this spot, if any (within 300 m). */
export function fridayMosqueAt(c: Coordinates): FridayMosque | null {
  let best: FridayMosque | null = null, bestKm = MATCH_KM
  for (const m of FRIDAY_SG.mosques) {
    const km = distanceKm(c, { latitude: m.lat, longitude: m.lng })
    if (km <= bestKm) { best = m; bestKm = km }
  }
  return best
}

/** Roughly mainland Singapore and its islands. */
export function inSingapore(c: Coordinates, countryCode?: string | null): boolean {
  if (countryCode) return countryCode.toUpperCase() === 'SG'
  return c.latitude > 1.15 && c.latitude < 1.48 && c.longitude > 103.59 && c.longitude < 104.1
}

/** Every two-session masjid, nearest first. */
export function fridayNearest(c: Coordinates): (FridayMosque & { km: number })[] {
  return FRIDAY_SG.mosques
    .map((m) => ({ ...m, km: distanceKm(c, { latitude: m.lat, longitude: m.lng }) }))
    .sort((a, b) => a.km - b.km)
}
