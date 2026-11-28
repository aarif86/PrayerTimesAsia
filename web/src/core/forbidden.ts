import type { PrayerDay } from './engine'

/** The three short windows when a voluntary prayer is not prayed. Made up (qada) and obligatory prayers are not affected. */
export type NoPrayerWindow = 'sunrise' | 'zenith' | 'sunset'

/**
 * Lengths in minutes. These are the commonly taught values and are waiting for our ustaz to
 * review them, so they live here in one place. They are never shown as "checked" yet.
 */
export const NO_PRAYER_MINUTES = { sunrise: 15, zenith: 6, sunset: 20 } as const

const MIN = 60_000

/** The windows of one day, in time order. Zenith ends exactly when Zuhr begins. */
export function noPrayerWindows(day: PrayerDay): { kind: NoPrayerWindow; from: number; to: number }[] {
  const { sunrise, dhuhr, maghrib } = day.times
  return [
    { kind: 'sunrise', from: sunrise, to: sunrise + NO_PRAYER_MINUTES.sunrise * MIN },
    { kind: 'zenith', from: dhuhr - NO_PRAYER_MINUTES.zenith * MIN, to: dhuhr },
    { kind: 'sunset', from: maghrib - NO_PRAYER_MINUTES.sunset * MIN, to: maghrib },
  ]
}

/** Where `now` stands: inside a window, or the next window to start (null after the last one). */
export function noPrayerNow(day: PrayerDay, now: number): { inside: NoPrayerWindow | null; next: { kind: NoPrayerWindow; from: number } | null } {
  const ws = noPrayerWindows(day)
  const inside = ws.find((w) => now >= w.from && now < w.to)
  const next = ws.find((w) => w.from > now)
  return { inside: inside?.kind ?? null, next: next ? { kind: next.kind, from: next.from } : null }
}
