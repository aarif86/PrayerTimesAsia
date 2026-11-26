import type { Place } from './place'
import { distanceKm } from './geo'
import { type Prayer } from './prayer'

/**
 * Early reminders when away from home. Same rules in ios Core/AwayReminder.swift
 * and android core AwayReminder.kt.
 *
 * "Away" means the place the app is showing is more than AWAY_KM from the home the
 * user confirmed. Home and the check stay on the device.
 */
export const AWAY_KM = 5
/** How early the away reminder can be, in minutes. 0 is off. */
export const AWAY_CHOICES = [15, 30, 45, 60] as const
export const AWAY_PRAYERS: readonly Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
export type AwayMinutes = Record<string, number>

/** Fajr starts Off: most people are asleep. The rest start at 1 hour. */
export const DEFAULT_AWAY_MINUTES: AwayMinutes = { fajr: 0, dhuhr: 60, asr: 60, maghrib: 60, isha: 60 }

export function isAway(home: Place | null, homeConfirmed: boolean, here: Place | null): boolean {
  if (!home || !homeConfirmed || !here) return false
  return distanceKm(home.coordinates, here.coordinates) > AWAY_KM
}

/** Keep only the five prayers, each with Off or one of the choices. */
export function cleanAwayMinutes(raw: unknown): AwayMinutes {
  const out: AwayMinutes = { ...DEFAULT_AWAY_MINUTES }
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const p of AWAY_PRAYERS) {
    const v = r[p]
    if (v === 0 || (AWAY_CHOICES as readonly unknown[]).includes(v)) out[p] = v as number
  }
  return out
}

/**
 * The one early reminder a prayer gets, in minutes, or 0 for none. Away uses the
 * away choice (when that switch is on), at home uses the old single early reminder.
 */
export function earlyMinutes(prayer: Prayer, away: boolean, awayOn: boolean, awayMinutes: AwayMinutes, atHome: number, hasAlarm: boolean): number {
  if (away && awayOn && prayer !== 'sunrise') {
    // A Fajr alarm already wakes the person: no early reminder on top of it.
    if (prayer === 'fajr' && hasAlarm) return 0
    return awayMinutes[prayer] ?? 0
  }
  return atHome
}
