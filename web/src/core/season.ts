import type { CalendarAnnouncement, HijriEvent } from './calendarSanad'
import { gregorianFromHijri, hijriDate, type HijriDate } from './hijri'

/**
 * Ramadan and Syawal, the way the user's community counts them.
 *
 * The Umm al-Qura calendar (plus the user's ± day adjustment) is only the
 * estimate. When the user's authority (MUIS, JAKIM's Penyimpan Mohor Besar
 * Raja-Raja, Kemenag, ...) has published or announced the first day of Ramadan
 * or Syawal in data/calendar.json, that date wins, so Imsak, Berbuka and Raya
 * appear on the days people actually fast and celebrate.
 *
 * Same rules in ios Core/Season.swift and android core Season.kt.
 */

export interface CivilDay { year: number; month: number; day: number }

/** For testers: pretend today is one of these days, to try every part of Ramadan and Syawal. */
export type SeasonPreview = 'off' | 'sighting' | 'ramadan' | 'lastTen' | 'raya' | 'syawal'
export const SEASON_PREVIEWS: SeasonPreview[] = ['off', 'sighting', 'ramadan', 'lastTen', 'raya', 'syawal']
export const SEASON_PREVIEW_LABEL: Record<SeasonPreview, string> = {
  off: 'Off (real dates)',
  sighting: 'Moon sighting night (29 Syaaban)',
  ramadan: 'Ramadan (day 12)',
  lastTen: 'Last ten nights (day 26)',
  raya: 'Hari Raya morning (1 Syawal)',
  syawal: 'Syawal (day 8)',
}
const PREVIEW_TARGET: Record<Exclude<SeasonPreview, 'off'>, { month: number; day: number }> = {
  sighting: { month: 8, day: 29 }, ramadan: { month: 9, day: 12 }, lastTen: { month: 9, day: 26 },
  raya: { month: 10, day: 1 }, syawal: { month: 10, day: 8 },
}

const dayNumber = (g: CivilDay) => Math.round(Date.UTC(g.year, g.month - 1, g.day) / 86_400_000)
const fromDayNumber = (n: number): CivilDay => {
  const d = new Date(n * 86_400_000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}
export const addDays = (g: CivilDay, n: number): CivilDay => fromDayNumber(dayNumber(g) + n)
export const daysApart = (a: CivilDay, b: CivilDay) => dayNumber(b) - dayNumber(a)
export function parseCivil(s: string): CivilDay | null {
  const p = s.split('-').map((x) => parseInt(x, 10))
  return p.length === 3 && !p.some(Number.isNaN) ? { year: p[0], month: p[1], day: p[2] } : null
}
export const civilKey = (g: CivilDay) => `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`

/** The Umm al-Qura date of a civil day, shifted by the user's adjustment. */
export function baseHijri(g: CivilDay, adjustment = 0): HijriDate {
  return hijriDate(Date.UTC(g.year, g.month - 1, g.day, 12), 'UTC', adjustment)
}

/** The authority's own date for an event: an announcement beats its published expectation. */
export function authorityDate(list: CalendarAnnouncement[], authority: string | null, event: HijriEvent, hijriYear: number): { day: CivilDay; announced: boolean } | null {
  if (!authority) return null
  const mine = list.filter((a) => a.authority === authority && a.event === event && a.hijri_year === hijriYear)
  const pick = mine.find((a) => a.status === 'announced') ?? mine[0]
  const day = pick ? parseCivil(pick.date) : null
  return day ? { day, announced: pick!.status === 'announced' } : null
}

/**
 * The Hijri date of a civil day for this community. Around Ramadan and Syawal it
 * follows the authority's first days; elsewhere it is the adjusted estimate.
 */
export function communityHijri(g: CivilDay, adjustment: number, list: CalendarAnnouncement[], authority: string | null): HijriDate {
  const base = baseHijri(g, adjustment)
  if (base.month < 8 || base.month > 10) return base
  const y = base.year
  const n = dayNumber(g)
  const r = authorityDate(list, authority, '1_ramadan', y)
  const s = authorityDate(list, authority, '1_syawal', y)
  if (s) {
    const sn = dayNumber(s.day)
    if (n >= sn && n < sn + 29) return { year: y, month: 10, day: n - sn + 1 }
  }
  if (r) {
    const rn = dayNumber(r.day)
    const end = s ? dayNumber(s.day) : rn + 30
    if (n >= rn && n < end) return { year: y, month: 9, day: Math.min(30, n - rn + 1) }
    if (n < rn && base.month >= 9) return { year: y, month: 8, day: 30 - (rn - n) + 1 }
  } else if (s) {
    // Raya announced without a start date: count back from it.
    const sn = dayNumber(s.day)
    if (n < sn && base.month === 10) return { year: y, month: 9, day: 30 - (sn - n) + 1 }
  }
  return base
}

/** How many days to move "today" so it lands on the tester's chosen day. */
export function previewShift(today: CivilDay, preview: SeasonPreview): number {
  if (preview === 'off') return 0
  const t = PREVIEW_TARGET[preview]
  const h = baseHijri(today)
  // The chosen day in this Hijri year, or next year's once this year's has passed long ago.
  for (const year of [h.year, h.year + 1, h.year - 1]) {
    const g = gregorianFromHijri(year, t.month, t.day)
    if (g) return daysApart(today, g)
  }
  return 0
}

export type SeasonPhase = 'none' | 'syaaban' | 'ramadan' | 'raya' | 'syawal'

export interface Season {
  hijri: HijriDate
  phase: SeasonPhase
  /** 1 to 30 in Ramadan. */
  ramadanDay: number | null
  /** 1 to 30 in Syawal. */
  syawalDay: number | null
  /** The Ramadan night that begins at Maghrib this evening (night 1 is the evening before the first fast). */
  nightTonight: number | null
  /** The evening of the 20th onwards: the last ten nights. */
  lastTen: boolean
  /** Tonight is the 21st, 23rd, 25th, 27th or 29th night. */
  oddNight: boolean
  /** 17 Ramadan. */
  nuzulQuran: boolean
  /** The 29th of Syaaban or Ramadan: the moon is looked for this evening. */
  sightingTonight: HijriEvent | null
  /** What the authority has said about the next first day, when it has. */
  nextStart: { event: HijriEvent; day: CivilDay; announced: boolean } | null
}

export function seasonFor(hijri: HijriDate, nextStart: Season['nextStart'] = null): Season {
  const { month, day } = hijri
  const ramadanDay = month === 9 ? day : null
  const syawalDay = month === 10 ? day : null
  let phase: SeasonPhase = 'none'
  if (month === 8 && day >= 15) phase = 'syaaban'
  if (month === 9) phase = 'ramadan'
  if (month === 10) phase = day === 1 ? 'raya' : 'syawal'
  let nightTonight: number | null = null
  if (month === 9 && day < 30) nightTonight = day + 1
  if (month === 8 && day >= 29) nightTonight = 1
  // Whether 30 Ramadan has a night 31: no. The evening of 29 or 30 Ramadan is Raya eve.
  const lastTen = nightTonight != null && nightTonight >= 21
  const oddNight = lastTen && nightTonight! % 2 === 1
  const sightingTonight: HijriEvent | null = day === 29 && month === 8 ? '1_ramadan' : day === 29 && month === 9 ? '1_syawal' : null
  return { hijri, phase, ramadanDay, syawalDay, nightTonight, lastTen, oddNight, nuzulQuran: ramadanDay === 17, sightingTonight, nextStart }
}

/** Gregorian days of this Ramadan for this community, first to last (at most 30). */
export function ramadanDays(anyDayInSeason: CivilDay, hijriOf: (g: CivilDay) => HijriDate): CivilDay[] {
  let g = anyDayInSeason
  let h = hijriOf(g)
  // Walk to 1 Ramadan from anywhere in Syaaban to Syawal.
  for (let i = 0; i < 80 && !(h.month === 9 && h.day === 1); i++) {
    g = addDays(g, h.month >= 10 || (h.month === 9 && h.day > 1) ? -1 : 1)
    h = hijriOf(g)
  }
  const out: CivilDay[] = []
  while (hijriOf(g).month === 9 && out.length < 30) { out.push(g); g = addDays(g, 1) }
  return out
}
