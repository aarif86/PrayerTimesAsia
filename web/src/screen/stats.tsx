import '@fontsource-variable/nunito/wght.css'
import { render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { STATS_URL } from './live'
import { ModeButton, Sky, useSiteTheme } from './sky'
import './setup.css'
import './stats.css'

/**
 * Masjid screens dashboard: how many masjid TVs are on now, when they are on, and the trend.
 * Anonymous counts only (functions/screens.js). Times are Singapore time.
 * `?demo` draws made-up example data, for screenshots before the counter has history.
 */

type MixPart = Record<string, { avg: number; peak: number }>
interface Mix { cc: MixPart; look: MixPart; lang: MixPart }
interface Day { date: string; peak: number; peakAt: string | null; avg: number; seen: number; screenHours: number; hours: number[]; mix?: Mix }
interface Stats { generatedAt: string; running: number; slotMinutes: number; days: Day[]; recent: [string, string, number][] }

const RANGES: { id: string; label: string; days: number }[] = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '3m', label: '3 months', days: 92 },
  { id: '6m', label: '6 months', days: 183 },
  { id: '9m', label: '9 months', days: 274 },
  { id: '1y', label: '1 year', days: 366 },
  { id: '2y', label: '2 years', days: 731 },
  { id: '3y', label: '3 years', days: 1097 },
]

const query = new URLSearchParams(location.search)
const DEMO = query.has('demo')

async function load(days: number): Promise<Stats> {
  if (DEMO) return demoStats(days)
  const r = await fetch(`${STATS_URL}?days=${days}`)
  if (!r.ok) throw new Error(String(r.status))
  return r.json() as Promise<Stats>
}

/** Every day in the range, with days that had no screens on filled in as zero. */
function fillDays(days: Day[], count: number, today: string): Day[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const out: Day[] = []
  const end = Date.parse(today + 'T00:00:00Z')
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(end - i * 86400e3).toISOString().slice(0, 10)
    out.push(byDate.get(date) ?? { date, peak: 0, peakAt: null, avg: 0, seen: 0, screenHours: 0, hours: new Array(24).fill(0) })
  }
  return out
}

const sgToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
const fmtDate = (d: string, withYear = false) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
const fmtSlot = (hhmm: string) => { const h = +hhmm.slice(0, 2), m = hhmm.slice(2); return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}` }
const fmtHour = (h: number) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`
/** Phones draw the charts at a narrower size, so the words stay readable. */
const narrow = () => typeof innerWidth === 'number' && innerWidth < 640

const fmtNum = (n: number) => n.toLocaleString('en', { maximumFractionDigits: 1 })

function App() {
  const [theme, flip] = useSiteTheme()
  const [range, setRange] = useState(() => RANGES.find((r) => r.id === query.get('range')) ?? RANGES[2])
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let stop = false
    setError(false)
    const get = () => load(range.days).then((s) => { if (!stop) setStats(s) }).catch(() => { if (!stop) setError(true) })
    get()
    const id = setInterval(get, 5 * 60_000)
    return () => { stop = true; clearInterval(id) }
  }, [range.days])

  const days = useMemo(() => stats ? fillDays(stats.days, range.days, sgToday()) : [], [stats, range.days])
  const sum = useMemo(() => summary(days), [days])
  const months = useMemo(() => byMonth(days), [days])
  const recent = useMemo(() => recentSeries(stats), [stats])

  const csv = () => {
    const rows = [['date', 'peak_screens', 'peak_time_sgt', 'average_screens', 'screens_seen', 'screen_hours'],
      ...days.map((d) => [d.date, d.peak, d.peakAt ? `${d.peakAt.slice(0, 2)}:${d.peakAt.slice(2)}` : '', d.avg, d.seen, d.screenHours])]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `masjid-screens-${range.id}-${sgToday()}.csv`
    a.click()
  }

  return (
    <div class="sp" data-theme={theme}>
      <Sky />
      <header class="sp-top">
        <a class="sp-brand" href="../../../"><img src="../../icons/icon-192.png" alt="" width="34" height="34" />Prayer Times Asia</a>
        <ModeButton theme={theme} onClick={flip} />
      </header>
      <main class="st-main">
        <section class="st-head">
          <p class="sp-eyebrow">For Masjids</p>
          <h1>Masjid screens</h1>
          <p class="sp-lead">How many masjid TVs are on, when, and how it grows. Anonymous counts only, in Singapore time.</p>
          {DEMO && <p class="st-demo">Example data, not real numbers</p>}
        </section>

        <div class="st-ranges" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => <button key={r.id} type="button" role="radio" aria-checked={r.id === range.id} class={`sp-chip small${r.id === range.id ? ' on' : ''}`} onClick={() => setRange(r)}>{r.label}</button>)}
        </div>

        {error && !stats && <p class="sp-error">The numbers could not be loaded. Check the internet and try again.</p>}
        {!stats && !error && <p class="sp-hint">Loading</p>}

        {stats && (
          <>
            <section class="st-tiles">
              <Tile label="On right now" value={fmtNum(stats.running)} note="TVs that checked in within 30 minutes" live />
              <Tile label="Highest" value={fmtNum(sum.peak)} note={sum.peakDay ? `${fmtDate(sum.peakDay.date, true)}, ${fmtSlot(sum.peakDay.peakAt ?? '0000')}` : 'No screens yet'} />
              <Tile label="On at any time, on average" value={fmtNum(sum.avg)} note={`Across the ${range.label.toLowerCase()}`} />
              <Tile label="Hours on, per screen per day" value={fmtNum(sum.hoursPerScreen)} note="How long a screen stays on" />
              <Tile label="Busiest hour" value={sum.busyHour != null ? fmtHour(sum.busyHour) : 'None'} note="When the most screens are on" />
              <Tile label="Growth" value={sum.growth == null ? 'New' : `${sum.growth >= 0 ? '+' : ''}${Math.round(sum.growth)}%`} note="Average, last 30 days against the 30 before" />
            </section>

            <section class="st-card">
              <h2>On right now, last 2 days</h2>
              <p class="sp-hint">Screens on every 15 minutes.</p>
              <LineChart theme={theme} xs={recent.map((p) => p.label)} series={[{ name: 'Screens on', values: recent.map((p) => p.n), color: 0 }]} ticks={5} fullTicks />
            </section>

            <section class="st-card">
              <h2>Each day</h2>
              <p class="sp-hint">The highest number on each day, and the average across the day.</p>
              <LineChart theme={theme} xs={days.map((d) => fmtDate(d.date, range.days > 366))}
                series={[{ name: 'Highest', values: days.map((d) => d.peak), color: 0 }, { name: 'Average', values: days.map((d) => d.avg), color: 1 }]} ticks={6} fullTicks={range.days > 366} />
            </section>

            <section class="st-card">
              <h2>When are screens on</h2>
              <p class="sp-hint">Average screens on at each hour of the day, across the {range.label.toLowerCase()}.</p>
              <HourBars theme={theme} hours={sum.hours} />
            </section>

            <section class="st-card">
              <h2>By country</h2>
              <p class="sp-hint">Screens on at any time, on average, and the highest in a day, across the {range.label.toLowerCase()}. Country only, never the city.</p>
              <BarList rows={mixRows(days, 'cc', countryName, 12)} />
            </section>

            <div class="st-two">
              <section class="st-card">
                <h2>Looks</h2>
                <BarList rows={mixRows(days, 'look', (v) => LOOK_NAMES[v] ?? 'Not known', 6)} />
              </section>
              <section class="st-card">
                <h2>Screen language</h2>
                <BarList rows={mixRows(days, 'lang', (v) => LANG_NAMES[v] ?? 'Not known', 6)} />
              </section>
            </div>

            <section class="st-card">
              <h2>By month</h2>
              <div class="st-tablewrap">
                <table class="st-table">
                  <thead><tr><th>Month</th><th>Highest</th><th>Average on</th><th>Most screens in a day</th><th>Screen hours</th></tr></thead>
                  <tbody>
                    {months.map((m) => <tr key={m.month}><td>{m.label}</td><td>{fmtNum(m.peak)}</td><td>{fmtNum(m.avg)}</td><td>{fmtNum(m.seen)}</td><td>{fmtNum(m.screenHours)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <button type="button" class="sp-btn" onClick={csv}>Download as a spreadsheet (CSV)</button>
            </section>
            <p class="sp-hint center">Updated {new Date(stats.generatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' })} Singapore time. Refreshes every 5 minutes.</p>
          </>
        )}
      </main>
    </div>
  )
}

const LOOK_NAMES: Record<string, string> = { dial: 'Centre Dial', sunpath: 'Sun Path', bands: 'Colour Bands', simple: 'Big and Simple', surau: 'Calm Gold', night: 'Sky (old)', day: 'Sky light (old)', board: 'Board (old)' }
const LANG_NAMES: Record<string, string> = { en: 'English', ms: 'Bahasa Melayu', id: 'Bahasa Indonesia' }
const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
const countryName = (cc: string) => (cc === '?' ? 'Not known' : regionNames?.of(cc) ?? cc)

interface BarRow { label: string; avg: number; peak: number }

/** Average and highest for each country, look or language across the days; the smallest fold into "Others". */
function mixRows(days: Day[], key: keyof Mix, name: (v: string) => string, top: number): BarRow[] {
  const sum = new Map<string, { avg: number; peak: number }>()
  for (const d of days) for (const [v, x] of Object.entries(d.mix?.[key] ?? {})) {
    const o = sum.get(v) ?? { avg: 0, peak: 0 }
    o.avg += x.avg
    o.peak = Math.max(o.peak, x.peak)
    sum.set(v, o)
  }
  const n = Math.max(1, days.length)
  const rows = [...sum].map(([v, o]) => ({ label: name(v), avg: Math.round((o.avg / n) * 10) / 10, peak: o.peak })).sort((a, b) => b.avg - a.avg || b.peak - a.peak)
  if (rows.length <= top) return rows
  const rest = rows.slice(top - 1)
  return [...rows.slice(0, top - 1), { label: `${rest.length} others`, avg: Math.round(rest.reduce((s, r) => s + r.avg, 0) * 10) / 10, peak: Math.max(...rest.map((r) => r.peak)) }]
}

function BarList({ rows }: { rows: BarRow[] }) {
  if (!rows.length) return <p class="sp-hint">Nothing yet. This fills in once screens have been on for an hour.</p>
  const max = Math.max(...rows.map((r) => r.avg), 0.1)
  return (
    <div class="st-bars" role="table">
      <div class="st-bar head" role="row"><span role="columnheader" /><span role="columnheader" /><b role="columnheader">Average</b><b role="columnheader">Highest</b></div>
      {rows.map((r) => (
        <div class="st-bar" role="row" key={r.label}>
          <span class="st-bar-name" role="cell">{r.label}</span>
          <span class="st-bar-track" aria-hidden="true"><i style={{ width: `${(r.avg / max) * 100}%` }} /></span>
          <b role="cell">{fmtNum(r.avg)}</b>
          <span role="cell" class="st-bar-peak">{fmtNum(r.peak)}</span>
        </div>
      ))}
    </div>
  )
}

function Tile({ label, value, note, live = false }: { label: string; value: string; note: string; live?: boolean }) {
  return (
    <div class="st-tile">
      <p class="st-tile-label">{live && <i class="sp-dot" aria-hidden="true" />}{label}</p>
      <p class="st-tile-value">{value}</p>
      <p class="st-tile-note">{note}</p>
    </div>
  )
}

function summary(days: Day[]) {
  let peak = 0, peakDay: Day | null = null, avgSum = 0, hoursOn = 0, seenSum = 0
  const hours = new Array(24).fill(0)
  for (const d of days) {
    if (d.peak > peak) { peak = d.peak; peakDay = d }
    avgSum += d.avg
    hoursOn += d.screenHours
    seenSum += d.seen
    d.hours.forEach((h, i) => { hours[i] += h })
  }
  const n = Math.max(1, days.length)
  const hourAvg = hours.map((h) => Math.round((h / n) * 10) / 10)
  const busy = hourAvg.reduce((best, v, i) => (v > (best == null ? 0 : hourAvg[best]) ? i : best), null as number | null)
  const mean = (list: Day[]) => list.reduce((s, d) => s + d.avg, 0) / Math.max(1, list.length)
  const last = mean(days.slice(-30)), before = mean(days.slice(-60, -30))
  return {
    peak, peakDay, avg: Math.round((avgSum / n) * 10) / 10,
    hoursPerScreen: seenSum ? Math.round((hoursOn / seenSum) * 10) / 10 : 0,
    hours: hourAvg, busyHour: busy,
    growth: days.length >= 60 && before > 0 ? ((last - before) / before) * 100 : null,
  }
}

function byMonth(days: Day[]) {
  const map = new Map<string, Day[]>()
  for (const d of days) { const k = d.date.slice(0, 7); map.set(k, [...(map.get(k) ?? []), d]) }
  return [...map].reverse().map(([month, list]) => ({
    month,
    label: new Date(month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    peak: Math.max(...list.map((d) => d.peak)),
    avg: Math.round((list.reduce((s, d) => s + d.avg, 0) / list.length) * 10) / 10,
    seen: Math.max(...list.map((d) => d.seen)),
    screenHours: list.reduce((s, d) => s + d.screenHours, 0),
  }))
}

/** The last 48 hours, every 15 minutes, missing points as zero. */
function recentSeries(stats: Stats | null) {
  if (!stats) return []
  const got = new Map(stats.recent.map(([d, s, n]) => [`${d}${s}`, n]))
  const out: { label: string; n: number }[] = []
  const nowSg = Date.now() + 8 * 3600e3
  const end = Math.floor(nowSg / 900e3) * 900e3
  for (let t = end - 48 * 3600e3 + 900e3; t <= end; t += 900e3) {
    const iso = new Date(t).toISOString()
    const date = iso.slice(0, 10), slot = iso.slice(11, 13) + iso.slice(14, 16)
    out.push({ label: `${fmtDate(date)} ${fmtSlot(slot)}`, n: got.get(date + slot) ?? 0 })
  }
  return out
}

/** Series colours: checked for colour blindness against each page background (dataviz validator). */
const COLORS = { dark: ['#bd8520', '#6b86e0'], light: ['#b07400', '#4361c9'] }

function LineChart({ theme, xs, series, ticks, fullTicks = false }: { theme: 'light' | 'dark'; xs: string[]; series: { name: string; values: number[]; color: number }[]; ticks: number; fullTicks?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = narrow() ? 420 : 800, H = narrow() ? 240 : 260, L = 36, R = 14, T = 12, B = 28
  ticks = narrow() ? 3 : ticks
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const nice = niceMax(max)
  const x = (i: number) => L + (xs.length <= 1 ? 0 : (i / (xs.length - 1)) * (W - L - R))
  const y = (v: number) => T + (1 - v / nice) * (H - T - B)
  const tickIdx = Array.from({ length: ticks }, (_, k) => Math.round((k / (ticks - 1)) * (xs.length - 1)))
  const grid = [0, 0.5, 1].map((f) => Math.round(nice * f))
  const pick = (e: PointerEvent) => {
    const box = (e.currentTarget as SVGElement).getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(xs.length - 1, Math.round(((px - L) / (W - L - R)) * (xs.length - 1)))))
  }
  return (
    <div class="st-chart">
      {series.length > 1 && (
        <p class="st-legend">{series.map((s) => <span key={s.name}><i style={{ background: COLORS[theme][s.color] }} />{s.name}</span>)}</p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(' and ')} onPointerMove={pick} onPointerLeave={() => setHover(null)}>
        {grid.map((g) => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} class="st-grid" /><text x={L - 8} y={y(g) + 4} class="st-axis" text-anchor="end">{g}</text></g>)}
        {tickIdx.map((i, k) => <text key={k} x={x(i)} y={H - 8} class="st-axis" text-anchor={k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle'}>{fullTicks ? xs[i] : xs[i]?.split(' ').slice(0, 2).join(' ')}</text>)}
        {series.map((s) => (
          <path key={s.name} d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')} fill="none" stroke={COLORS[theme][s.color]} stroke-width="2" stroke-linejoin="round" />
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} class="st-cross" />
            {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="5" fill={COLORS[theme][s.color]} class="st-dot" />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div class="st-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{xs[hover]}</b>
          {series.map((s) => <span key={s.name}><i style={{ background: COLORS[theme][s.color] }} />{s.name} {fmtNum(s.values[hover])}</span>)}
        </div>
      )}
    </div>
  )
}

function HourBars({ theme, hours }: { theme: 'light' | 'dark'; hours: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = narrow() ? 420 : 800, H = 220, L = 36, R = 8, T = 12, B = 28
  const every = narrow() ? 6 : 3
  const nice = niceMax(Math.max(1, ...hours))
  const bw = (W - L - R) / 24
  const y = (v: number) => T + (1 - v / nice) * (H - T - B)
  return (
    <div class="st-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average screens on at each hour" onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => { const g = Math.round(nice * f); return <g key={f}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} class="st-grid" /><text x={L - 8} y={y(g) + 4} class="st-axis" text-anchor="end">{g}</text></g> })}
        {hours.map((v, i) => (
          <g key={i} onPointerEnter={() => setHover(i)}>
            <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
            <path d={barPath(L + i * bw + 1, y(v), bw - 2, H - B - y(v))} fill={COLORS[theme][0]} opacity={hover == null || hover === i ? 1 : 0.55} />
            {i % every === 0 && <text x={L + i * bw + bw / 2} y={H - 8} class="st-axis" text-anchor="middle">{fmtHour(i)}</text>}
          </g>
        ))}
      </svg>
      {hover != null && (
        <div class="st-tip" style={{ left: `${((L + hover * bw + bw / 2) / W) * 100}%` }}>
          <b>{fmtHour(hover)} to {fmtHour((hover + 1) % 24)}</b><span>{fmtNum(hours[hover])} screens on, on average</span>
        </div>
      )}
    </div>
  )
}

/** A bar with 4px rounded top corners, square on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function niceMax(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

/** Made-up numbers that look like masjids joining over time, busiest around the prayers. */
function demoStats(days: number): Stats {
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const today = sgToday()
  const shape = (h: number) => 0.55 + 0.45 * Math.max(Math.exp(-((h - 5.5) ** 2) / 2), Math.exp(-((h - 13) ** 2) / 3), Math.exp(-((h - 19.5) ** 2) / 3)) - (h >= 0 && h < 4 ? 0.35 : 0)
  const out: Day[] = []
  const recent: [string, string, number][] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.parse(today + 'T00:00:00Z') - i * 86400e3).toISOString().slice(0, 10)
    const base = Math.max(0, Math.round(140 * (1 - i / 1100) ** 2.2 + 3))
    const fri = new Date(date + 'T00:00:00Z').getUTCDay() === 5 ? 1.1 : 1
    const slots: Record<string, number> = {}
    for (let s = 0; s < 96; s++) {
      const h = s / 4
      slots[String(Math.floor(h)).padStart(2, '0') + String((s % 4) * 15).padStart(2, '0')] = Math.max(0, Math.round(base * shape(h) * fri * (0.92 + rnd() * 0.12)))
    }
    const keys = Object.keys(slots)
    let peak = 0, peakAt: string | null = null, sum = 0
    const hours = new Array(24).fill(0)
    for (const k of keys) { const n = slots[k]; sum += n; if (n > peak) { peak = n; peakAt = k } hours[+k.slice(0, 2)] += n / 4 }
    const avg = Math.round((sum / 96) * 10) / 10
    const split = (shares: Record<string, number>): MixPart => Object.fromEntries(Object.entries(shares).map(([k, f]) => [k, { avg: Math.round(avg * f * 10) / 10, peak: Math.round(peak * f) }]))
    const mix: Mix = {
      cc: split({ SG: 0.42, MY: 0.3, ID: 0.15, BN: 0.04, GB: 0.03, AU: 0.02, PH: 0.02, TH: 0.01, US: 0.01 }),
      look: split({ simple: 0.55, bands: 0.2, dial: 0.1, surau: 0.1, sunpath: 0.05 }),
      lang: split({ ms: 0.5, en: 0.3, id: 0.2 }),
    }
    out.push({ date, peak, peakAt, avg, seen: Math.round(base * 1.08), screenHours: Math.round(sum / 4), hours: hours.map((h) => Math.round(h * 10) / 10), mix })
    if (i <= 2) for (const k of keys) recent.push([date, k, slots[k]])
  }
  return { generatedAt: new Date().toISOString(), running: out[out.length - 1].peak - 9, slotMinutes: 15, days: out, recent }
}

render(<App />, document.getElementById('app')!)
