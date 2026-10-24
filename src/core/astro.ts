/**
 * The solar model: the classic praytimes.org formulation, a line-by-line port
 * of the iOS app's Astro (PrayerEngine.swift).
 */
const RAD = Math.PI / 180

export const dsin = (d: number) => Math.sin(d * RAD)
export const dcos = (d: number) => Math.cos(d * RAD)
export const dtan = (d: number) => Math.tan(d * RAD)
export const darcsin = (x: number) => Math.asin(x) / RAD
export const darccos = (x: number) => Math.acos(Math.min(1, Math.max(-1, x))) / RAD
export const darctan2 = (y: number, x: number) => Math.atan2(y, x) / RAD
export const darccot = (x: number) => Math.atan(1 / x) / RAD

export function fix(a: number, b: number): number {
  const r = a - b * Math.floor(a / b)
  return r < 0 ? r + b : r
}

export function julianDay(year: number, month: number, day: number): number {
  let y = year, m = month
  if (m <= 2) { y -= 1; m += 12 }
  const a = Math.trunc(y / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5
}

export function sun(jd: number): { declination: number; equationOfTime: number } {
  const d = jd - 2451545.0
  const g = fix(357.529 + 0.98560028 * d, 360)
  const q = fix(280.459 + 0.98564736 * d, 360)
  const l = fix(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g), 360)
  const e = 23.439 - 0.00000036 * d
  const ra = darctan2(dcos(e) * dsin(l), dcos(l)) / 15
  const eqt = q / 15 - fix(ra, 24)
  const decl = darcsin(dsin(e) * dsin(l))
  return { declination: decl, equationOfTime: eqt }
}

/** Julian day of an instant (ms since epoch). */
export const jdOf = (ms: number) => ms / 86_400_000 + 2_440_587.5

/** The sun's altitude in degrees at an instant and place (negative below the horizon). */
export function sunAltitude(ms: number, lat: number, lng: number): number {
  const { declination: decl, equationOfTime: eqt } = sun(jdOf(ms))
  const utcHours = fix(ms / 3_600_000, 24)
  const hourAngle = 15 * (utcHours + lng / 15 + eqt - 12)
  return darcsin(dsin(lat) * dsin(decl) + dcos(lat) * dcos(decl) * dcos(hourAngle))
}

export const utcMidnight = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)
