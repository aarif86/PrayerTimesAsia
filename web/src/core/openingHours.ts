/**
 * The common part of OpenStreetMap's opening_hours, enough for prayer rooms in
 * malls and offices ("Mo-Su 10:00-22:00", "Mo-Fr 08:00-20:00; Sa,Su off", "24/7").
 * Anything it doesn't understand (months, holidays, sunrise) gives null, so the
 * app says nothing rather than something wrong.
 */
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export interface HoursNow { open: boolean; until?: string; opensAt?: string }

type Rule = { days: boolean[]; spans: [number, number][] }

function dayList(text: string): boolean[] | null {
  const days = Array(7).fill(false)
  for (const part of text.split(',')) {
    const m = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/)
    if (!m) return null
    const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a
    for (let i = a; ; i = (i + 1) % 7) { days[i] = true; if (i === b) break }
  }
  return days
}

function spanList(text: string): [number, number][] | null {
  const out: [number, number][] = []
  for (const part of text.split(',')) {
    const m = part.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const a = +m[1] * 60 + +m[2]
    let b = +m[3] * 60 + +m[4]
    if (b <= a) b += 24 * 60
    out.push([a, b])
  }
  return out
}

export function parseHours(raw: string): Rule[] | null {
  const text = raw.trim()
  if (!text) return null
  if (text === '24/7') return [{ days: Array(7).fill(true), spans: [[0, 24 * 60]] }]
  const rules: Rule[] = []
  for (const r of text.split(';').map((x) => x.trim()).filter(Boolean)) {
    const tokens = r.replace(/\s*,\s*/g, ',').replace(/\s*-\s*/g, '-').split(/\s+/)
    let days: boolean[] = Array(7).fill(true)
    let rest = tokens
    if (/^(Mo|Tu|We|Th|Fr|Sa|Su)/.test(tokens[0])) {
      const d = dayList(tokens[0])
      if (!d) return null
      days = d; rest = tokens.slice(1)
    } else if (/^PH/.test(tokens[0])) continue
    if (rest.length !== 1) return null
    if (rest[0] === 'off' || rest[0] === 'closed') { rules.push({ days, spans: [] }); continue }
    const spans = rest[0] === '24/7' ? [[0, 24 * 60] as [number, number]] : spanList(rest[0])
    if (!spans) return null
    rules.push({ days, spans })
  }
  return rules.length ? rules : null
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Open or closed at [weekday] (0 = Monday) and [minute] of the day, in the place's own time. */
export function hoursAt(raw: string, weekday: number, minute: number): HoursNow | null {
  const rules = parseHours(raw)
  if (!rules) return null
  // Later rules win for the days they name, as in OpenStreetMap.
  const spansFor = (d: number) => {
    let s: [number, number][] = []
    for (const r of rules) if (r.days[d]) s = r.spans
    return s
  }
  const today = spansFor(weekday)
  for (const [a, b] of today) if (minute >= a && minute < b) return { open: true, until: b - a >= 24 * 60 ? undefined : hhmm(b) }
  // Still open from last night?
  for (const [a, b] of spansFor((weekday + 6) % 7)) if (b > 24 * 60 && minute < b - 24 * 60 && a < 24 * 60) return { open: true, until: hhmm(b - 24 * 60) }
  const later = today.filter(([a]) => a > minute).sort((x, y) => x[0] - y[0])[0]
  return { open: false, opensAt: later ? hhmm(later[0]) : undefined }
}

/** Weekday (0 = Monday) and minute of the day at [ms] in [timeZone]. */
export function localWeekMinute(ms: number, timeZone: string): { weekday: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone }).formatToParts(new Date(ms))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')), minute: +get('hour') * 60 + +get('minute') }
}
