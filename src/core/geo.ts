import { fix } from './astro'
import type { Coordinates } from './engine'

export const KAABA: Coordinates = { latitude: 21.422487, longitude: 39.826206 }
export const EARTH_RADIUS_KM = 6371.0088

const RAD = Math.PI / 180

/** Initial great-circle bearing, degrees clockwise from true north. */
export function bearing(a: Coordinates, b: Coordinates): number {
  const p1 = a.latitude * RAD, p2 = b.latitude * RAD
  const dl = (b.longitude - a.longitude) * RAD
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return fix(Math.atan2(y, x) / RAD, 360)
}

export const qiblaBearing = (from: Coordinates) => bearing(from, KAABA)

/** Haversine distance in kilometres. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const p1 = a.latitude * RAD, p2 = b.latitude * RAD
  const dp = p2 - p1
  const dl = (b.longitude - a.longitude) * RAD
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

/** "NW", "WNW"... for the compass caption. */
export function compassPoint(degrees: number): string {
  return POINTS[Math.trunc((fix(degrees, 360) + 11.25) / 22.5) % 16]
}

/** Signed smallest difference a - b in (-180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = fix(a - b, 360)
  if (d > 180) d -= 360
  return d
}
