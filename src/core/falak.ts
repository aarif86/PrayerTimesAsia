import { darcsin, darctan2, dcos, dsin, dtan, fix, jdOf, sun, utcMidnight } from './astro'
import type { Coordinates } from './engine'
import { KAABA, angleDelta, qiblaBearing } from './geo'
import { shadowFactor, type AsrSchool } from './prayer'
import { zoned, zonedTime } from './tz'

/**
 * Falak Mode F1: the classical, offline sun-and-shadow layer. A line-by-line
 * port of the iOS Falak.swift. Anything worked out from the user's own
 * observation is Grade F and never replaces official data.
 */
export const REVIEW_NOTE = 'Pending review by a falak and shariah panel. For learning and checking; follow your authority\'s times.'

export interface SunPosition { altitude: number; azimuth: number }

export function sunPosition(ms: number, c: Coordinates): SunPosition {
  const { declination: decl, equationOfTime: eqt } = sun(jdOf(ms))
  const utcHours = fix(ms / 3_600_000, 24)
  const h = 15 * (utcHours + c.longitude / 15 + eqt - 12)
  const lat = c.latitude
  const alt = darcsin(dsin(lat) * dsin(decl) + dcos(lat) * dcos(decl) * dcos(h))
  const az = darctan2(-dcos(decl) * dsin(h), dsin(decl) * dcos(lat) - dcos(decl) * dsin(lat) * dcos(h))
  return { altitude: alt, azimuth: fix(az, 360) }
}

/** Local solar noon (zawal): the sun crosses the meridian; a stick's shadow is shortest. */
export function solarNoon(year: number, month: number, day: number, longitude: number): number {
  const midnight = utcMidnight(year, month, day)
  let hours = 12 - longitude / 15
  for (let i = 0; i < 3; i++) {
    const jd = jdOf(midnight + hours * 3_600_000)
    hours = 12 - sun(jd).equationOfTime - longitude / 15
  }
  return midnight + hours * 3_600_000
}

/** Istiwa' a'zam: the two Makkah noons a year when the sun stands over the Ka'bah. */
export function qiblaDays(year: number): number[] {
  const out: number[] = []
  let prev: [number, number] | null = null
  for (let date = Date.UTC(year, 0, 1); new Date(date).getUTCFullYear() === year; date += 86_400_000) {
    const d = new Date(date)
    const noon = solarNoon(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), KAABA.longitude)
    const diff = sun(jdOf(noon)).declination - KAABA.latitude
    if (prev && (prev[1] < 0) !== (diff < 0)) out.push(Math.abs(prev[1]) < Math.abs(diff) ? prev[0] : noon)
    prev = [noon, diff]
  }
  return out
}

/** The next Qibla Day noon at or after `ms` (today's counts until it has passed). */
export function nextQiblaDay(ms: number): number {
  const year = new Date(ms).getUTCFullYear()
  return [...qiblaDays(year), ...qiblaDays(year + 1)].find((t) => t + 10 * 60_000 >= ms)!
}

export type AlignmentKind = 'sunInQibla' | 'sunOpposite'
export interface Alignment { time: number; kind: AlignmentKind; altitude: number }

export function shadowNote(kind: AlignmentKind): string {
  return kind === 'sunInQibla'
    ? 'Shadows point directly away from the qibla. Face along the shadow, from its tip to the base of the stick.'
    : 'Shadows point directly towards the qibla. Face along the shadow, from the base of the stick to its tip.'
}

/**
 * Rashdul qiblat for one local day: the moments the sun's azimuth lines up with
 * the qibla bearing (or its opposite), with the sun at least `minAltitude` up.
 */
export function rashdulQiblat(year: number, month: number, day: number, tz: string,
  c: Coordinates, minAltitude = 5): Alignment[] {
  const start = zonedTime(year, month, day, 0, 0, 0, tz)
  const qibla = qiblaBearing(c)
  const targets: [number, AlignmentKind][] = [[qibla, 'sunInQibla'], [fix(qibla + 180, 360), 'sunOpposite']]
  const out: Alignment[] = []
  let prev: [number, number[]] | null = null
  for (let minute = 0; minute <= 24 * 60; minute++) {
    const t = start + minute * 60_000
    const s = sunPosition(t, c)
    const deltas = targets.map(([b]) => angleDelta(s.azimuth, b))
    if (prev && s.altitude >= minAltitude) {
      const [pt, pd] = prev
      targets.forEach(([, kind], i) => {
        if ((pd[i] < 0) !== (deltas[i] < 0) && Math.abs(pd[i] - deltas[i]) < 90) {
          const f = pd[i] / (pd[i] - deltas[i])
          out.push({ time: pt + 60_000 * f, kind, altitude: s.altitude })
        }
      })
    }
    prev = [t, deltas]
  }
  return out.sort((a, b) => a.time - b.time)
}

/** Shadow of a vertical stick of `height` with the sun at `altitude` degrees. */
export function shadowLength(height: number, altitude: number): number {
  return altitude <= 0 ? Infinity : height / dtan(altitude)
}

/** Sun altitude implied by a stick and its measured shadow. */
export function altitudeFrom(height: number, shadow: number): number {
  return darctan2(height, shadow)
}

export interface ShadowDay {
  noon: number
  noonAltitude: number
  noonShadowBearing: number
  asrShafii: number | null
  asrHanafi: number | null
}

export const noonShadow = (d: ShadowDay, height: number) => shadowLength(height, d.noonAltitude)
export const asrShadow = (d: ShadowDay, height: number, school: AsrSchool) => noonShadow(d, height) + shadowFactor(school) * height

/** When the sun is at `altitude` on the given side of `noon`, to the second. */
export function timeWhenAltitude(altitude: number, noon: number, c: Coordinates, afternoon: boolean): number | null {
  const step = afternoon ? 60_000 : -60_000
  let prevT = noon
  let prevAlt = sunPosition(noon, c).altitude
  if (!(prevAlt >= altitude)) return null
  for (let i = 1; i <= 12 * 60; i++) {
    const t = noon + i * step
    const alt = sunPosition(t, c).altitude
    if (alt < altitude) {
      const f = (prevAlt - altitude) / (prevAlt - alt)
      return prevT + step * f
    }
    prevT = t; prevAlt = alt
  }
  return null
}

export function shadowDay(year: number, month: number, day: number, c: Coordinates): ShadowDay {
  const noon = solarNoon(year, month, day, c.longitude)
  const s = sunPosition(noon, c)
  const asr = (factor: number) => {
    const target = altitudeFrom(1, shadowLength(1, s.altitude) + factor)
    return timeWhenAltitude(target, noon, c, true)
  }
  return {
    noon, noonAltitude: s.altitude, noonShadowBearing: fix(s.azimuth + 180, 360),
    asrShafii: asr(1), asrHanafi: asr(2),
  }
}

export interface Reading {
  altitude: number
  sunTime: number | null
  offsetMinutes: number | null
  uncertaintyMinutes: number | null
  afternoon: boolean
  asrReached: boolean | null
}

/** One shadow-stick observation, compared with the sun's computed position. */
export function reading(height: number, shadow: number, clock: number, c: Coordinates, tz: string,
  school: AsrSchool, measurementError = 0.5): Reading | null {
  if (!(height > 0 && shadow > 0)) return null
  const z = zoned(clock, tz)
  const d = shadowDay(z.year, z.month, z.day, c)
  const afternoon = clock >= d.noon
  const alt = altitudeFrom(height, shadow)
  const when = (s: number) => timeWhenAltitude(altitudeFrom(height, Math.max(s, 0.01)), d.noon, c, afternoon)
  const sunTime = when(shadow)
  let uncertainty: number | null = null
  const a = when(shadow - measurementError), b = when(shadow + measurementError)
  if (a != null && b != null) uncertainty = Math.abs(b - a) / 120_000 + 1
  return {
    altitude: alt, sunTime,
    offsetMinutes: sunTime != null ? (sunTime - clock) / 60_000 : null,
    uncertaintyMinutes: uncertainty, afternoon,
    asrReached: afternoon ? shadow >= asrShadow(d, height, school) : null,
  }
}
