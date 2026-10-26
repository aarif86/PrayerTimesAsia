import { darccos, darccot, dcos, dsin, dtan, fix, julianDay, sun, utcMidnight } from './astro'
import { isRamadan } from './hijri'
import type { CalculationMethod } from './methods'
import { PRAYERS, shadowFactor, type AsrSchool, type Prayer } from './prayer'
import type { SourceGrade } from './sources'
import { zoned } from './tz'

export interface Coordinates {
  latitude: number
  longitude: number
}

/** One local calendar day of prayer times at one place. Times are ms since epoch. */
export interface PrayerDay {
  year: number
  month: number
  day: number
  times: Record<Prayer, number>
  /** Set when these times come from an authority's published table. */
  officialSource?: string
  grade: SourceGrade
  /** Congregation times from a nearby mosque's profile, when known. */
  jamaah: Partial<Record<Prayer, number>>
  mosqueName?: string
  /** A second credible source's times, only where they differ by more than 2 minutes. */
  alternate: Partial<Record<Prayer, number>>
  alternateSource?: string
  /** The official feed carries five prayers; Syuruk then comes from the calculation. */
  sunriseCalculated?: boolean
}

export const ordered = (day: PrayerDay) => PRAYERS.map((p) => ({ prayer: p, time: day.times[p] }))

/**
 * Offline prayer-time calculation: a line-by-line port of the iOS
 * PrayerEngine.compute (praytimes.org solar model, two refinement passes,
 * precautionary offsets, rounded UP to the minute so a time is never shown
 * earlier than it is).
 */
export function compute(
  year: number, month: number, day: number,
  coordinates: Coordinates, method: CalculationMethod, asr: AsrSchool, ramadan = false,
): PrayerDay {
  const lat = coordinates.latitude
  const lng = coordinates.longitude
  const jd0 = julianDay(year, month, day) - lng / (15 * 24)

  const noon = (t: number) => fix(12 - sun(jd0 + t).equationOfTime, 24)
  const angleTime = (angle: number, t: number, morning: boolean): number | null => {
    const decl = sun(jd0 + t).declination
    const x = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))
    if (!(x >= -1 && x <= 1)) return null
    const span = darccos(x) / 15
    return noon(t) + (morning ? -span : span)
  }
  const asrTime = (t: number): number | null => {
    const decl = sun(jd0 + t).declination
    const angle = -darccot(shadowFactor(asr) + dtan(Math.abs(lat - decl)))
    return angleTime(angle, t, false)
  }

  const t: Record<Prayer, number> = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 }
  for (let pass = 0; pass < 2; pass++) {
    const p = { fajr: t.fajr / 24, sunrise: t.sunrise / 24, dhuhr: t.dhuhr / 24, asr: t.asr / 24, maghrib: t.maghrib / 24, isha: t.isha / 24 }
    t.fajr = angleTime(method.fajrAngle, p.fajr, true) ?? t.fajr
    t.sunrise = angleTime(0.833, p.sunrise, true) ?? t.sunrise
    t.dhuhr = noon(p.dhuhr)
    t.asr = asrTime(p.asr) ?? t.asr
    t.maghrib = angleTime(method.maghribAngle ?? 0.833, p.maghrib, false) ?? t.maghrib
    if (method.ishaAngle != null) t.isha = angleTime(method.ishaAngle, p.isha, false) ?? t.isha
  }

  const sunset = angleTime(0.833, t.maghrib / 24, false) ?? t.maghrib
  const night = 24 - (sunset - t.sunrise)
  const interval = (ramadan ? method.ramadanIshaInterval : null) ?? method.ishaInterval
  if (interval != null) t.isha = t.maghrib + interval / 60
  // High-latitude safety net ("one-seventh of the night"). Never triggers in tropical Asia.
  const fajrSevenths = t.sunrise - night / 7
  if (angleTime(method.fajrAngle, t.fajr / 24, true) == null) t.fajr = fajrSevenths
  if (method.ishaAngle != null && angleTime(method.ishaAngle, t.isha / 24, false) == null) {
    t.isha = sunset + night / 7
  }

  const midnight = utcMidnight(year, month, day)
  const times = {} as Record<Prayer, number>
  for (const prayer of PRAYERS) {
    const hoursUTC = t[prayer] - lng / 15
    const seconds = hoursUTC * 3600 + (method.offsets[prayer] ?? 0) * 60
    const minutes = Math.ceil(seconds / 60)
    times[prayer] = midnight + minutes * 60_000
  }
  return { year, month, day, times, grade: 'D', jamaah: {}, alternate: {} }
}

/** The prayer day for the local calendar date containing `ms` in `tz`. */
export function computeFor(ms: number, tz: string, coordinates: Coordinates, method: CalculationMethod,
  asr: AsrSchool, hijriAdjustment = 0): PrayerDay {
  const z = zoned(ms, tz)
  return compute(z.year, z.month, z.day, coordinates, method, asr, isRamadan(ms, tz, hijriAdjustment))
}
