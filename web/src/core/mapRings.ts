/**
 * Distance rings for the Masjid map, kept in step with iPhone and Android
 * (MasjidExtras.rings / ringsFor): three rings in 1 2 5 steps, like a map's
 * distance scale, picked to suit what the map shows.
 */
export const RING_SETS: number[][] = [[0.25, 0.5, 1], [0.5, 1, 2], [1, 2, 5], [2, 5, 10], [5, 10, 20]]

/** Labels sit on each ring this far below the right hand side, in degrees, so they line up like a ruler. */
export const RING_LABEL_ANGLE = 35

/** The widest set whose outer label still lands on screen. Half the map's width and height in km. */
export function ringsFor(halfWidthKm: number, halfHeightKm: number): number[] {
  const a = RING_LABEL_ANGLE * Math.PI / 180
  let best = RING_SETS[0]
  for (const s of RING_SETS) if (s[2] * Math.cos(a) <= halfWidthKm * 0.9 && s[2] * Math.sin(a) <= halfHeightKm * 0.9) best = s
  return best
}

/** "500 m" or "2 km". */
export const ringDistance = (km: number): string => (km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km)} km`)
