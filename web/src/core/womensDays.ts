import type { FastMark } from './ramadanContent'

/**
 * Women's days: the Ramadan fast record and the prayer tracker pause are one
 * fact, so marking it in one place marks it in the other. Pausing the tracker in
 * Ramadan shows those days as "Period" in the fast record; marking a fast day
 * "Period" pauses the tracker (today) or excuses that day (an earlier day).
 * Changing it back undoes both. Everything stays on this device.
 *
 * Same rules as ios Core/WomensDays.swift and android core WomensDays.kt.
 * Days are "yyyy-MM-dd" in the place's own calendar.
 */
export interface WomensDaysState {
  fastLog: Record<string, FastMark>
  excusedDays: string[]
  trackerPausedSince: string | null
}

/** Is this local day in Ramadan, for this community (announced dates, estimate or the tester's preview). */
export type IsRamadan = (key: string) => boolean

function addDay(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** Every day from `from` to `to`, both included (at most a year). */
function span(from: string, to: string): string[] {
  const out: string[] = []
  for (let k = from; k <= to && out.length < 366; k = addDay(k, 1)) out.push(k)
  return out
}

function inPause(s: WomensDaysState, key: string, today: string): boolean {
  const since = s.trackerPausedSince
  return !!since && key >= since && key <= today
}

/** How a fast day went: what was marked, or "Period" for an unmarked Ramadan day inside a tracker pause. */
export function fastMarkFor(s: WomensDaysState, key: string, today: string, isRamadan: IsRamadan): FastMark | null {
  return s.fastLog[key] ?? (inPause(s, key, today) && isRamadan(key) ? 'period' : null)
}

/** Writes "Period" into the fast record for the unmarked Ramadan days among `days`. */
function keepAsPeriod(s: WomensDaysState, days: string[], isRamadan: IsRamadan): void {
  for (const k of days) if (!s.fastLog[k] && isRamadan(k)) s.fastLog[k] = 'period'
}

function excuse(s: WomensDaysState, days: string[]): void {
  s.excusedDays = [...new Set([...s.excusedDays, ...days])].sort()
}

/** Mark how a fast day went, and keep the prayer tracker in step. Changes `s` in place. */
export function setFastLinked(s: WomensDaysState, key: string, mark: FastMark | null, today: string, isRamadan: IsRamadan): void {
  const before = fastMarkFor(s, key, today, isRamadan)
  if (mark) s.fastLog[key] = mark; else delete s.fastLog[key]
  if (mark === 'period' && before !== 'period') {
    if (inPause(s, key, today)) return
    if (key === today && !s.trackerPausedSince) s.trackerPausedSince = today
    else excuse(s, [key])
    return
  }
  if (before !== 'period' || mark === 'period') return
  // No longer a period day: the tracker counts it again.
  s.excusedDays = s.excusedDays.filter((k) => k !== key)
  const since = s.trackerPausedSince
  if (!since || !inPause(s, key, today)) return
  // Split the pause around this day: the days before stay excused, the days after stay paused.
  const earlier = key > since ? span(since, addDay(key, -1)) : []
  keepAsPeriod(s, earlier, isRamadan)
  excuse(s, earlier)
  s.trackerPausedSince = key < today ? addDay(key, 1) : null
}

/** Pause the tracker from today. Ramadan days in the pause read as "Period" until it ends. */
export function pauseLinked(s: WomensDaysState, today: string): void {
  s.trackerPausedSince = today
}

/** End the pause: the paused days stay excused, and their Ramadan days stay "Period" in the fast record. */
export function endPauseLinked(s: WomensDaysState, today: string, isRamadan: IsRamadan): void {
  const since = s.trackerPausedSince
  if (!since) return
  const days = span(since, today)
  keepAsPeriod(s, days, isRamadan)
  excuse(s, days)
  s.trackerPausedSince = null
}

/** "Just today" in the tracker: excuse one day, and in Ramadan mark that fast "Period". Again to undo both. */
export function toggleExcusedLinked(s: WomensDaysState, key: string, isRamadan: IsRamadan): void {
  if (s.excusedDays.includes(key)) {
    s.excusedDays = s.excusedDays.filter((k) => k !== key)
    if (s.fastLog[key] === 'period') delete s.fastLog[key]
  } else {
    s.excusedDays = [...s.excusedDays, key].sort()
    keepAsPeriod(s, [key], isRamadan)
  }
}
