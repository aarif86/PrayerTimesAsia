import type { Coordinates } from './engine'
import { distanceKm } from './geo'
import { NAMES, isRightToLeft, type AsrSchool, type NamingStyle } from './prayer'

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

export function musafirGuidance(status: MusafirStatus, rules: MusafirRules, _naming: NamingStyle): { title: string; body: string } {
  switch (status.kind) {
    case 'home':
      return { title: "You're home", body: `Pray in full. Travel concessions apply once you journey at least ${Math.trunc(rules.thresholdKm)} km.` }
    case 'nearby':
      return { title: `Within ${Math.trunc(rules.thresholdKm)} km of home`, body: "That's short of the travel distance, so pray in full." }
    case 'traveller':
      if (allowsJamak(rules)) {
        return { title: 'You are a musafir', body: 'You may shorten (qasar) and join (jamak) your prayers. Here is what changes for each one.' }
      }
      return {
        title: 'You are a musafir',
        body: 'You may shorten (qasr) your prayers. In the Hanafi school prayers are not joined outside Hajj. Here is what changes for each one.',
      }
    case 'settled':
      return {
        title: 'Settled here',
        body: `You've been here ${status.days} days. Staying longer than ${maxStayDays(rules)} days ends the travel concession, so pray in full.`,
      }
  }
}

/** One prayer's line in the traveller's plan, so nobody has to work out from a sentence which prayers are shortened and which are joined. */
export interface PlanRow { prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'; name: string; rakaat: string; change: string; join: string }

/** Subuh and Maghrib keep their rakaat; Zohor, Asar and Isyak go from 4 to 2. Zohor joins Asar, Maghrib joins Isyak (not Hanafi). */
export function musafirPlan(rules: MusafirRules, naming: NamingStyle): PlanRow[] {
  // Right-to-left names would scramble an English sentence, so use International there.
  const n = NAMES[isRightToLeft(naming) ? 'arabic' : naming]
  const j = allowsJamak(rules)
  const join = (other: string) => (j ? `Can join with ${other}` : 'Not joined')
  const short = 'Shortened from 4'
  return [
    { prayer: 'fajr', name: n.fajr, rakaat: '2 rakaat', change: 'No change', join: j ? 'Never joined' : 'Not joined' },
    { prayer: 'dhuhr', name: n.dhuhr, rakaat: '2 rakaat', change: short, join: join(n.asr) },
    { prayer: 'asr', name: n.asr, rakaat: '2 rakaat', change: short, join: join(n.dhuhr) },
    { prayer: 'maghrib', name: n.maghrib, rakaat: '3 rakaat', change: 'No change', join: join(n.isha) },
    { prayer: 'isha', name: n.isha, rakaat: '2 rakaat', change: short, join: join(n.maghrib) },
  ]
}

/** Plain words on how the chosen travel distance decides the result, so switching 81 km and 89 km visibly does something. */
export function musafirDistanceCheck(status: MusafirStatus, rules: MusafirRules): { counts: boolean; text: string } | null {
  const limit = Math.trunc(rules.thresholdKm)
  if (status.kind === 'home') return null
  const km = Math.round(status.distanceKm).toLocaleString('en')
  // Round down when short of the limit, so 80.6 km never reads "81 km, less than 81 km".
  const shortKm = Math.floor(status.distanceKm).toLocaleString('en')
  if (status.kind === 'nearby') return { counts: false, text: `You are ${shortKm} km from home. That is less than ${limit} km, so this trip does not count as travel yet.` }
  return { counts: true, text: `You are ${km} km from home. That is more than ${limit} km, so this trip counts as travel.` }
}
