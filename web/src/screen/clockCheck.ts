import { readJSON, writeJSON } from '../services/storage'

/**
 * TV clock check. Many masjid TVs and TV boxes run for months with a clock that
 * drifts, or was never set. When online, the screen asks our own site for the
 * time (the HTTPS Date header) and, if the TV is more than 30 seconds off,
 * quietly corrects every time it shows by the difference. Only the Settings page
 * mentions it; the main screen never does.
 *
 * Prayer times themselves are not touched: the screen only reads "now" from a
 * corrected clock, so the countdown and the highlighted prayer are right.
 */

/** Smaller differences are left alone (the Date header only has whole seconds). */
export const CLOCK_LIMIT_MS = 30_000
/** A sample whose round trip took longer than this is too unsure to use. */
export const MAX_ROUND_TRIP_MS = 5_000
/** A saved correction is trusted for a week without a new check. */
export const SAVED_FOR_MS = 7 * 86_400_000
export const CHECK_EVERY_MS = 6 * 3_600_000

export interface ClockSample { sentAt: number; receivedAt: number; serverDate: string | null }
export interface ClockStatus {
  /** Internet time minus the TV's time, in ms (positive: the TV is slow). */
  offset: number
  /** When the check was made, by the TV's own clock. */
  checkedAt: number
}

/**
 * Internet time minus device time from one request, or null when it can't be trusted.
 * The Date header is cut to the whole second, so the true server time is half a second later on average.
 */
export function offsetFromSample(s: ClockSample): number | null {
  if (!s.serverDate) return null
  const server = Date.parse(s.serverDate)
  const trip = s.receivedAt - s.sentAt
  if (Number.isNaN(server) || trip < 0 || trip > MAX_ROUND_TRIP_MS) return null
  return server + 500 - (s.sentAt + trip / 2)
}

/** The sample with the quickest round trip is the most exact. */
export function bestOffset(samples: ClockSample[]): number | null {
  const ok = samples.map((s) => ({ s, o: offsetFromSample(s) })).filter((x): x is { s: ClockSample; o: number } => x.o != null)
  if (!ok.length) return null
  ok.sort((a, b) => (a.s.receivedAt - a.s.sentAt) - (b.s.receivedAt - b.s.sentAt))
  return ok[0].o
}

/** The correction the screen applies: nothing within 30 seconds, nothing from an old check. */
export function correctionFor(status: ClockStatus | null, deviceNow: number): number {
  if (!status || !Number.isFinite(status.offset)) return 0
  if (Math.abs(deviceNow - status.checkedAt) > SAVED_FOR_MS) return 0
  return Math.abs(status.offset) > CLOCK_LIMIT_MS ? Math.round(status.offset) : 0
}

const STORAGE = 'ptasia.screen.clock'
let status: ClockStatus | null = readJSON<ClockStatus>(STORAGE)
const listeners = new Set<() => void>()

/** The TV's time, corrected when the last check found it more than 30 seconds off. */
export function screenNow(): number {
  const now = Date.now()
  return now + correctionFor(status, now)
}

export function clockStatus(): ClockStatus | null { return status }

export function onClockChange(f: () => void): () => void {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

/** For tests and screenshots. */
export function setClockStatus(s: ClockStatus | null): void {
  status = s
  listeners.forEach((f) => f())
}

/**
 * Ask our own site for the time, three times, and keep the best answer.
 * HEAD requests skip the offline copy in the service worker and the browser cache.
 */
export async function checkClock(url = location.href.split('#')[0]): Promise<ClockStatus | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
  const samples: ClockSample[] = []
  for (let i = 0; i < 3; i++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 10_000)
    const sentAt = Date.now()
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store', credentials: 'omit', signal: ctl.signal })
      samples.push({ sentAt, receivedAt: Date.now(), serverDate: r.headers.get('date') })
    } catch { /* offline or blocked: try again, then give up quietly */ } finally {
      clearTimeout(timer)
    }
  }
  const offset = bestOffset(samples)
  if (offset == null) return null
  const next = { offset: Math.round(offset), checkedAt: Date.now() }
  writeJSON(STORAGE, next)
  setClockStatus(next)
  return next
}

/** "2 minutes 10 seconds", for the Settings notice. */
export function differenceText(ms: number): string {
  const total = Math.round(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
  const parts: string[] = []
  if (h) parts.push(part(h, 'hour'))
  if (m) parts.push(part(m, 'minute'))
  if (s && !h) parts.push(part(s, 'second'))
  return parts.join(' ') || '0 seconds'
}
