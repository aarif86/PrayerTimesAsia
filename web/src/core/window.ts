import type { PrayerDay } from './engine'
import type { Prayer } from './prayer'

/**
 * How long each prayer stays open. Busy people ask "how long do I still have
 * for Zohor", not only "when is Asar". Shafi'i reckoning:
 *  - Subuh from dawn until sunrise
 *  - Zohor until Asar begins (so a Hanafi Asar setting gives Zohor longer)
 *  - Asar until Maghrib
 *  - Maghrib until Isyak
 *  - Isyak until Subuh (the owner's choice: no midnight line, so Isyak has
 *    no "time running out" nudge, which would fall in the night).
 * Between sunrise and Zohor no obligatory prayer is open, so there is no window.
 * The same rules are in iOS PrayerWindow.swift and Android PrayerWindow.kt.
 */
export interface PrayerWindow {
  prayer: Exclude<Prayer, 'sunrise'>
  start: number
  end: number
}

/** The windows that start on `day`, in order. Isyak runs into `nextDay`. */
export function windowsOf(day: PrayerDay, nextDay: PrayerDay): PrayerWindow[] {
  const t = day.times
  return [
    { prayer: 'fajr', start: t.fajr, end: t.sunrise },
    { prayer: 'dhuhr', start: t.dhuhr, end: t.asr },
    { prayer: 'asr', start: t.asr, end: t.maghrib },
    { prayer: 'maghrib', start: t.maghrib, end: t.isha },
    { prayer: 'isha', start: t.isha, end: nextDay.times.fajr },
  ]
}

/** The prayer open at `now`, or null between sunrise and Zohor. */
export function openWindow(now: number, yesterday: PrayerDay, today: PrayerDay, tomorrow: PrayerDay): PrayerWindow | null {
  const all = [...windowsOf(yesterday, today), ...windowsOf(today, tomorrow)]
  return all.find((w) => w.start <= now && now < w.end) ?? null
}

/**
 * When the "time is running out" nudge fires: 30 minutes before the end, or a
 * third of the window when it is shorter (Maghrib can be just over an hour).
 * Isyak gets none (see above).
 */
export function nudgeAt(w: PrayerWindow): number {
  const lead = Math.min(30 * 60_000, Math.floor((w.end - w.start) / 3 / 60_000) * 60_000)
  return w.end - lead
}

/** Minutes past midnight, local, inside a quiet span that may wrap past midnight. */
export function inQuietHours(minuteOfDay: number, from: number, to: number): boolean {
  if (from === to) return false
  return from < to ? minuteOfDay >= from && minuteOfDay < to : minuteOfDay >= from || minuteOfDay < to
}
