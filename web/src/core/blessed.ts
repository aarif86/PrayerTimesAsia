import type { Coordinates, PrayerDay } from './engine'
import { solarNoon, timeWhenAltitude } from './falak'

/** The extra times behind "Show more" on the Prayer screen. */
export type BlessedTime = 'imsak' | 'dhuha' | 'midnight' | 'lastThird'

/** In English for everyone (as in the iOS app). */
export const BLESSED_NAME: Record<BlessedTime, string> = {
  imsak: 'Imsak',
  dhuha: 'Dhuha',
  midnight: 'Middle of the night',
  lastThird: 'Last third of the night',
}

export const BLESSED_SHORT: Record<BlessedTime, string> = {
  imsak: 'Imsak', dhuha: 'Dhuha', midnight: 'Midnight', lastThird: 'Last third',
}

export const BLESSED_NOTE: Record<BlessedTime, string> = {
  imsak: '10 minutes before Subuh - stop eating for the fast',
  dhuha: "Sun a spear's length up (about 4½°)",
  midnight: 'Halfway from Maghrib to Subuh',
  lastThird: 'Best time for tahajjud and dua',
}

const roundUp = (ms: number) => Math.ceil(ms / 60_000) * 60_000

/**
 * Times for the night after `day` (Maghrib of `day` to Subuh of `nextDay`), and
 * Dhuha/Imsak of `day`. Imsak only in Ramadan.
 */
export function computeBlessed(day: PrayerDay, nextDay: PrayerDay, c: Coordinates, ramadan: boolean): [BlessedTime, number][] {
  const out: [BlessedTime, number][] = []
  if (ramadan) out.push(['imsak', day.times.fajr - 10 * 60_000])
  const noon = solarNoon(day.year, day.month, day.day, c.longitude)
  const dhuha = timeWhenAltitude(4.5, noon, c, false)
  if (dhuha != null) out.push(['dhuha', roundUp(Math.max(dhuha, day.times.sunrise))])
  const night = nextDay.times.fajr - day.times.maghrib
  out.push(['midnight', roundUp(day.times.maghrib + night / 2)])
  out.push(['lastThird', roundUp(day.times.maghrib + (night * 2) / 3)])
  return out
}
