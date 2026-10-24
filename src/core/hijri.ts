import { hijriMonths, type NamingStyle } from './prayer'

export interface HijriDate { day: number; month: number; year: number }

const cache = new Map<string, Intl.DateTimeFormat>()
function formatter(tz: string): Intl.DateTimeFormat {
  let f = cache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      timeZone: tz, day: 'numeric', month: 'numeric', year: 'numeric',
    })
    cache.set(tz, f)
  }
  return f
}

/**
 * Umm al-Qura date (the same calendar as iOS's .islamicUmmAlQura), shifted by the
 * user's ±days adjustment (sighting-based calendars in Southeast Asia can be a
 * day apart from Makkah).
 */
export function hijriDate(ms: number, tz: string, adjustment = 0): HijriDate {
  const shifted = ms + adjustment * 86_400_000
  const out: HijriDate = { day: 1, month: 1, year: 1448 }
  for (const p of formatter(tz).formatToParts(new Date(shifted))) {
    if (p.type === 'day') out.day = parseInt(p.value, 10)
    else if (p.type === 'month') out.month = parseInt(p.value, 10)
    else if (p.type === 'year' || p.type === 'relatedYear') {
      const v = parseInt(p.value, 10)
      if (!Number.isNaN(v) && p.type === 'year') out.year = v
    }
  }
  return out
}

export function isRamadan(ms: number, tz: string, adjustment = 0): boolean {
  return hijriDate(ms, tz, adjustment).month === 9
}

export function formatHijri(ms: number, tz: string, style: NamingStyle, adjustment = 0): string {
  const h = hijriDate(ms, tz, adjustment)
  const name = hijriMonths(style)[Math.max(0, Math.min(11, h.month - 1))]
  return `${h.day} ${name} ${h.year}`
}

/**
 * The Gregorian date (UTC calendar) on which an Umm al-Qura date falls, or null.
 * Starts from the arithmetic estimate and searches a few days either side.
 */
export function gregorianFromHijri(year: number, month: number, day: number): { year: number; month: number; day: number } | null {
  // Days since the Islamic epoch (16 July 622, JD 1948439.5), arithmetic calendar.
  const estimate = Math.floor((year - 1) * 354.36667 + (month - 1) * 29.5306 + (day - 1))
  const epochMs = Date.UTC(622, 6, 16) // proleptic Gregorian handled by Date.UTC for display only
  // Date.UTC uses the proleptic Gregorian calendar; the Julian 16 July 622 is Gregorian 19 July 622.
  const base = epochMs + 3 * 86_400_000 + estimate * 86_400_000
  for (let delta = 0; delta <= 15; delta++) {
    for (const sign of delta === 0 ? [0] : [-1, 1]) {
      const ms = base + sign * delta * 86_400_000 + 12 * 3_600_000
      const h = hijriDate(ms, 'UTC')
      if (h.year === year && h.month === month && h.day === day) {
        const d = new Date(ms)
        return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
      }
    }
  }
  return null
}
