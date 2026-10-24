import type { Coordinates } from './engine'
import { distanceKm } from './geo'
import { NAMES, type AsrSchool, type NamingStyle } from './prayer'

/**
 * Traveller's concessions (rukhsah): shortening (qasar) and combining (jamak).
 * Guidance, not a fatwa. Two marhalah ≈ 81 km (Shafi'i; some use 89 km), ≈ 78 km Hanafi.
 */
export interface MusafirRules { school: AsrSchool; thresholdKm: number }

export const maxStayDays = (r: MusafirRules) => (r.school === 'hanafi' ? 15 : 3)
export const allowsJamak = (r: MusafirRules) => r.school !== 'hanafi'

export type MusafirStatus =
  | { kind: 'home' }
  | { kind: 'nearby'; distanceKm: number }
  | { kind: 'traveller'; distanceKm: number }
  | { kind: 'settled'; distanceKm: number; days: number }

export function musafirStatus(home: Coordinates | null | undefined, current: Coordinates, daysHere: number,
  rules: MusafirRules): MusafirStatus | null {
  if (!home) return null
  const km = distanceKm(home, current)
  if (km < 2) return { kind: 'home' }
  if (km < rules.thresholdKm) return { kind: 'nearby', distanceKm: km }
  if (daysHere > maxStayDays(rules)) return { kind: 'settled', distanceKm: km, days: daysHere }
  return { kind: 'traveller', distanceKm: km }
}

export function musafirGuidance(status: MusafirStatus, rules: MusafirRules, naming: NamingStyle): { title: string; body: string } {
  const n = NAMES[naming]
  const four = `${n.dhuhr}, ${n.asr} and ${n.isha}`
  switch (status.kind) {
    case 'home':
      return { title: "You're home", body: `Pray in full. Travel concessions apply once you journey at least ${Math.trunc(rules.thresholdKm)} km.` }
    case 'nearby':
      return { title: `Within ${Math.trunc(rules.thresholdKm)} km of home`, body: "That's short of the travel distance, so pray in full." }
    case 'traveller':
      if (allowsJamak(rules)) {
        return {
          title: 'You are a musafir',
          body: `You may shorten (qasar) ${four} to 2 rakaat, and combine (jamak) ${n.dhuhr} with ${n.asr}, and ${n.maghrib} with ${n.isha}.`,
        }
      }
      return { title: 'You are a musafir', body: `Shorten (qasr) ${four} to 2 rakaat. In the Hanafi school prayers are not combined outside Hajj.` }
    case 'settled':
      return {
        title: 'Settled here',
        body: `You've been here ${status.days} days. Staying longer than ${maxStayDays(rules)} days ends the travel concession - pray in full.`,
      }
  }
}
