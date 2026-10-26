/**
 * Time-zone arithmetic on top of Intl, so the engine can work in the place's
 * own zone (not the browser's), exactly as the iOS app uses Calendar + TimeZone.
 * All instants are milliseconds since the Unix epoch.
 */

export interface Zoned {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number
}

const cache = new Map<string, Intl.DateTimeFormat>()
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function formatter(tz: string): Intl.DateTimeFormat {
  let f = cache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    })
    cache.set(tz, f)
  }
  return f
}

/** Is this an IANA zone the browser knows? */
export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false
  try { formatter(tz); return true } catch { return false }
}

/** The browser's own zone. */
export function deviceTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

/** Calendar fields of an instant in a zone. */
export function zoned(ms: number, tz: string): Zoned {
  const parts = formatter(tz).formatToParts(new Date(ms))
  const out: Zoned = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, weekday: 0 }
  for (const p of parts) {
    switch (p.type) {
      case 'year': out.year = parseInt(p.value, 10); break
      case 'month': out.month = parseInt(p.value, 10); break
      case 'day': out.day = parseInt(p.value, 10); break
      case 'hour': out.hour = parseInt(p.value, 10) % 24; break
      case 'minute': out.minute = parseInt(p.value, 10); break
      case 'second': out.second = parseInt(p.value, 10); break
      case 'weekday': out.weekday = WEEKDAYS[p.value] ?? 0; break
    }
  }
  return out
}

/** Offset of the zone from UTC at an instant, in minutes (Singapore: +480). */
export function offsetMinutes(ms: number, tz: string): number {
  const z = zoned(ms, tz)
  const asUTC = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second)
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000)
}

/** The instant of a local wall-clock time in a zone. */
export function zonedTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, tz = 'UTC'): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second)
  const first = guess - offsetMinutes(guess, tz) * 60000
  return guess - offsetMinutes(first, tz) * 60000
}

/** Local midnight that starts the calendar day containing `ms`. */
export function startOfDay(ms: number, tz: string): number {
  const z = zoned(ms, tz)
  return zonedTime(z.year, z.month, z.day, 0, 0, 0, tz)
}

/** "yyyy-MM-dd" for the local date of an instant. */
export function dayKey(ms: number, tz: string): string {
  const z = zoned(ms, tz)
  return ymdKey(z.year, z.month, z.day)
}

export function ymdKey(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Whole local calendar days from a to b (b later is positive). */
export function daysBetween(a: number, b: number, tz: string): number {
  const za = zoned(a, tz), zb = zoned(b, tz)
  return Math.round((Date.UTC(zb.year, zb.month - 1, zb.day) - Date.UTC(za.year, za.month - 1, za.day)) / 86_400_000)
}
