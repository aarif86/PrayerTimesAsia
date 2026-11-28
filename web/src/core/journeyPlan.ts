import { compute, type Coordinates } from './engine'
import { isRamadan } from './hijri'
import type { CalculationMethod } from './methods'
import type { AsrSchool, Prayer } from './prayer'
import { PRAYERS } from './prayer'

/**
 * Journey Prayer Planner. Given flights (cities and local take off and landing times) it works out which prayer
 * time is in force at every minute of the trip and where the traveller is then (on the ground, in the air).
 * Only calculation and facts here. Nothing about shortening or joining prayers.
 *
 * In the air the position is the great circle between the two cities, spread evenly over the flight time. That is an
 * estimate. The method used in the air is the one of the nearer city.
 */
export interface Stop {
  name: string
  coords: Coordinates
  tz: string
  method: CalculationMethod
  asr: AsrSchool
}
export interface Leg { from: Stop; to: Stop; departMs: number; arriveMs: number }

export type Where =
  | { kind: 'ground'; stop: Stop; leg: number; layover: boolean }
  | { kind: 'air'; leg: number; fraction: number; pos: Coordinates }

export interface RunPart {
  kind: 'before' | 'air' | 'layover' | 'after'
  fromMs: number
  toMs: number
  leg: number
  stop?: Stop
  /** Where the part starts, for the compass line. */
  pos: Coordinates
}
export interface PrayerRun {
  prayer: Prayer
  startMs: number
  endMs: number
  startWhere: Where
  endWhere: Where
  parts: RunPart[]
  airMs: number
  /** True when this prayer's whole time begins and ends in the air (no ground time at all). */
  onlyInAir: boolean
  startedBeforeTakeoff: boolean
  endsAfterLanding: boolean
}
export interface Plan {
  departMs: number
  arriveMs: number
  airMs: number
  runs: PrayerRun[]
}

const MIN = 60_000
const HOUR = 3_600_000
const RAD = Math.PI / 180
const ORDER: Prayer[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

/** A point on the great circle from a to b, f from 0 to 1. */
export function between(a: Coordinates, b: Coordinates, f: number): Coordinates {
  const p1 = a.latitude * RAD, l1 = a.longitude * RAD, p2 = b.latitude * RAD, l2 = b.longitude * RAD
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2))
  if (d < 1e-9) return { ...a }
  const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d)
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
  const z = A * Math.sin(p1) + B * Math.sin(p2)
  return { latitude: Math.atan2(z, Math.hypot(x, y)) / RAD, longitude: Math.atan2(y, x) / RAD }
}

export function whereAt(legs: Leg[], t: number): Where {
  if (t < legs[0].departMs) return { kind: 'ground', stop: legs[0].from, leg: 0, layover: false }
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i]
    if (t < l.arriveMs) {
      const f = Math.min(1, Math.max(0, (t - l.departMs) / (l.arriveMs - l.departMs)))
      return { kind: 'air', leg: i, fraction: f, pos: between(l.from.coords, l.to.coords, f) }
    }
    const next = legs[i + 1]
    if (!next) return { kind: 'ground', stop: l.to, leg: i, layover: false }
    if (t < next.departMs) return { kind: 'ground', stop: l.to, leg: i, layover: true }
  }
  const last = legs[legs.length - 1]
  return { kind: 'ground', stop: last.to, leg: legs.length - 1, layover: false }
}

const coordsOf = (w: Where): Coordinates => (w.kind === 'ground' ? w.stop.coords : w.pos)
const stopFor = (legs: Leg[], w: Where): Stop =>
  w.kind === 'ground' ? w.stop : (w.fraction < 0.5 ? legs[w.leg].from : legs[w.leg].to)

/** Which prayer time is in force at an instant. */
export function stateAt(legs: Leg[], t: number): Prayer {
  const w = whereAt(legs, t)
  const s = stopFor(legs, w)
  const c = coordsOf(w)
  const u = new Date(t + (c.longitude / 15) * HOUR)
  const base = Date.UTC(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate())
  const ramadan = isRamadan(t, s.tz)
  let best: Prayer = 'isha', bestT = -Infinity
  for (const dd of [-1, 0, 1]) {
    const d = new Date(base + dd * 86_400_000)
    const day = compute(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), c, s.method, s.asr, ramadan)
    for (const p of PRAYERS) {
      const x = day.times[p]
      if (x <= t && x > bestT) { bestT = x; best = p }
    }
  }
  return best
}

const forward = (from: Prayer, to: Prayer) => (ORDER.indexOf(to) - ORDER.indexOf(from) + 6) % 6

/** Walks the whole trip (24 hours either side) and returns each prayer time period in order. */
function runsOver(legs: Leg[], t0: number, t1: number): { prayer: Prayer; startMs: number; endMs: number }[] {
  const out: { prayer: Prayer; startMs: number; endMs: number }[] = []
  let cur = stateAt(legs, t0)
  let runStart = t0
  let prev = t0
  for (let t = t0 + 5 * MIN; ; t += 5 * MIN) {
    const at = Math.min(t, t1)
    const raw = stateAt(legs, at)
    const d = forward(cur, raw)
    if (d >= 1 && d <= 3) {
      let lo = prev, hi = at
      while (hi - lo > 1000) {
        const mid = Math.floor((lo + hi) / 2)
        const r = stateAt(legs, mid)
        const dm = forward(cur, r)
        if (dm >= 1 && dm <= 3) hi = mid; else lo = mid
      }
      const edge = Math.ceil(hi / MIN) * MIN
      out.push({ prayer: cur, startMs: runStart, endMs: edge })
      cur = stateAt(legs, hi)
      runStart = edge
    }
    prev = at
    if (at >= t1) break
  }
  out.push({ prayer: cur, startMs: runStart, endMs: t1 })
  return out
}

export function planJourney(legs: Leg[]): Plan {
  const dep = legs[0].departMs
  const arr = legs[legs.length - 1].arriveMs
  const t0 = dep - 24 * HOUR, t1 = arr + 24 * HOUR
  const bounds: { kind: RunPart['kind']; from: number; to: number; leg: number; stop?: Stop; pos: Coordinates }[] = [
    { kind: 'before', from: -Infinity, to: dep, leg: 0, stop: legs[0].from, pos: legs[0].from.coords },
  ]
  legs.forEach((l, i) => {
    bounds.push({ kind: 'air', from: l.departMs, to: l.arriveMs, leg: i, pos: l.from.coords })
    const next = legs[i + 1]
    if (next) bounds.push({ kind: 'layover', from: l.arriveMs, to: next.departMs, leg: i, stop: l.to, pos: l.to.coords })
  })
  bounds.push({ kind: 'after', from: arr, to: Infinity, leg: legs.length - 1, stop: legs[legs.length - 1].to, pos: legs[legs.length - 1].to.coords })

  const runs: PrayerRun[] = []
  for (const r of runsOver(legs, t0, t1)) {
    if (r.endMs <= dep || r.startMs >= arr) continue
    const parts: RunPart[] = []
    for (const b of bounds) {
      const from = Math.max(r.startMs, b.from), to = Math.min(r.endMs, b.to)
      if (to - from < 1000) continue
      const pos = b.kind === 'air' ? coordsOf(whereAt(legs, from)) : b.pos
      parts.push({ kind: b.kind, fromMs: from, toMs: to, leg: b.leg, stop: b.stop, pos })
    }
    const airMs = parts.filter((p) => p.kind === 'air').reduce((a, p) => a + (p.toMs - p.fromMs), 0)
    runs.push({
      prayer: r.prayer, startMs: r.startMs, endMs: r.endMs,
      startWhere: whereAt(legs, Math.max(r.startMs, t0)), endWhere: whereAt(legs, Math.min(r.endMs - 1, t1)),
      parts, airMs,
      onlyInAir: airMs > 0 && parts.every((p) => p.kind === 'air'),
      startedBeforeTakeoff: r.startMs < dep, endsAfterLanding: r.endMs > arr,
    })
  }
  const airMs = legs.reduce((a, l) => a + (l.arriveMs - l.departMs), 0)
  return { departMs: dep, arriveMs: arr, airMs, runs }
}
