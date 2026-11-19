/**
 * The short line under each on-time prayer alert, approved by Ustaz Aarif
 * Raziff. Lines live in data/alert-lines.json (English, Malay, Indonesian).
 * Each prayer has its own lines plus 20 shared ones, handed out by date so
 * the same words rarely come back (a shared line about every 16 days, a
 * prayer's own line about every two weeks) and never twice on one day.
 * Same rule in ios Core/AlertLines.swift and android core AlertLines.kt.
 */
import { ALERT_LINES } from './alertLinesData'
import type { Lang3 } from './ramadanContent'

const ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type AlertPrayer = (typeof ORDER)[number]

/** Days since 1970-01-01 for a calendar date (no time zone involved). */
export function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** The alert line for this prayer on this date, with the prayer's name filled in. */
export function alertLine(lang: Lang3, prayer: AlertPrayer, friday: boolean, y: number, m: number, d: number, name: string): string {
  const day = dayNumber(y, m, d)
  const k = ORDER.indexOf(prayer)
  const set = ALERT_LINES[lang]
  let line: string
  if (prayer === 'dhuhr' && friday) line = set.jumuah[mod(Math.floor(day / 7), set.jumuah.length)]
  else if (mod(day + k, 4) === 0) line = set.any[mod(Math.floor((day * 5 + k) / 4), set.any.length)]
  else line = set[prayer][mod(day, set[prayer].length)]
  return line.replaceAll('{p}', name)
}
