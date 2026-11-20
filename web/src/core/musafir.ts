import type { Coordinates } from './engine'
import { distanceKm } from './geo'
import { NAMES, isRightToLeft, type AsrSchool, type NamingStyle } from './prayer'
import { appLocale, tr } from './appWords'

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
      return { title: tr('journey.homeTitle'), body: tr('journey.homeBody', { km: Math.trunc(rules.thresholdKm) }) }
    case 'nearby':
      return { title: tr('journey.nearbyTitle', { km: Math.trunc(rules.thresholdKm) }), body: tr('journey.nearbyBody') }
    case 'traveller':
      return { title: tr('journey.travellerTitle'), body: tr(allowsJamak(rules) ? 'journey.travellerBody' : 'journey.travellerHanafi') }
    case 'settled':
      return { title: tr('journey.settledTitle'), body: tr('journey.settledBody', { n: status.days, max: maxStayDays(rules) }) }
  }
}

/** One prayer's line in the traveller's plan, so nobody has to work out from a sentence which prayers are shortened and which are joined. */
export interface PlanRow { prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'; name: string; rakaat: string; change: string; join: string }

/** Subuh and Maghrib keep their rakaat; Zohor, Asar and Isyak go from 4 to 2. Zohor joins Asar, Maghrib joins Isyak (not Hanafi). */
export function musafirPlan(rules: MusafirRules, naming: NamingStyle): PlanRow[] {
  // Right-to-left names would scramble an English sentence, so use International there.
  const n = NAMES[isRightToLeft(naming) ? 'arabic' : naming]
  const j = allowsJamak(rules)
  const join = (other: string) => (j ? tr('journey.canJoin', { name: other }) : tr('journey.notJoined'))
  const short = tr('journey.shortened')
  const same = tr('journey.noChange')
  const rakaat = (k: number) => tr('journey.rakaat', { n: k })
  return [
    { prayer: 'fajr', name: n.fajr, rakaat: rakaat(2), change: same, join: j ? tr('journey.neverJoinedShort') : tr('journey.notJoined') },
    { prayer: 'dhuhr', name: n.dhuhr, rakaat: rakaat(2), change: short, join: join(n.asr) },
    { prayer: 'asr', name: n.asr, rakaat: rakaat(2), change: short, join: join(n.dhuhr) },
    { prayer: 'maghrib', name: n.maghrib, rakaat: rakaat(3), change: same, join: join(n.isha) },
    { prayer: 'isha', name: n.isha, rakaat: rakaat(2), change: short, join: join(n.maghrib) },
  ]
}

/** Plain words on how the chosen travel distance decides the result, so switching 81 km and 89 km visibly does something. */
export function musafirDistanceCheck(status: MusafirStatus, rules: MusafirRules): { counts: boolean; text: string } | null {
  const limit = Math.trunc(rules.thresholdKm)
  if (status.kind === 'home') return null
  const km = Math.round(status.distanceKm).toLocaleString(appLocale())
  // Round down when short of the limit, so 80.6 km never reads "81 km, less than 81 km".
  const shortKm = Math.floor(status.distanceKm).toLocaleString(appLocale())
  if (status.kind === 'nearby') return { counts: false, text: tr('journey.notTravel', { km: shortKm, limit }) }
  return { counts: true, text: tr('journey.isTravel', { km, limit }) }
}
