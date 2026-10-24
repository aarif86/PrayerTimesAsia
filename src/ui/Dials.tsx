import type { ComponentChildren } from 'preact'
import { useMemo } from 'preact/hooks'
import type { PrayerDay } from '../core/engine'
import { PRAYERS, type Prayer } from '../core/prayer'
import { startOfDay } from '../core/tz'

/** Prayer tints: the sky at that time of day (PrayerPalette.swift). */
export const TINT: Record<Prayer, [number, number, number]> = {
  fajr: [0.50, 0.61, 0.88],
  sunrise: [0.95, 0.77, 0.42],
  dhuhr: [0.95, 0.60, 0.20],
  asr: [0.91, 0.50, 0.25],
  maghrib: [0.87, 0.36, 0.33],
  isha: [0.42, 0.37, 0.76],
}
export const tint = (p: Prayer, a = 1) => {
  const [r, g, b] = TINT[p]
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`
}

const NIGHT: [number, number, number] = [0.13, 0.15, 0.36]
const DAWN_PEACH: [number, number, number] = [0.96, 0.70, 0.58]

type Stop = [number, [number, number, number]]

/** The sky through the day as gradient stops, midnight (0) to midnight (1). */
function skyStops(day: PrayerDay, midnight: number): Stop[] {
  const f = (t: number) => Math.min(1, Math.max(0, (t - midnight) / 86_400_000))
  const t = day.times
  return [
    [0, NIGHT],
    [Math.max(0, f(t.fajr) - 0.06), TINT.isha],
    [f(t.fajr), TINT.fajr],
    [f(t.sunrise), DAWN_PEACH],
    [(f(t.sunrise) + f(t.dhuhr)) / 2, TINT.sunrise],
    [f(t.dhuhr), TINT.dhuhr],
    [f(t.asr), TINT.asr],
    [f(t.maghrib), TINT.maghrib],
    [f(t.isha), TINT.isha],
    [1, NIGHT],
  ]
}

function colorAt(stops: Stop[], x: number): string {
  const f = ((x % 1) + 1) % 1
  let i = 0
  while (i < stops.length - 2 && f > stops[i + 1][0]) i++
  const [a, ca] = stops[i], [b, cb] = stops[i + 1]
  const k = b > a ? Math.min(1, Math.max(0, (f - a) / (b - a))) : 0
  const c = ca.map((v, j) => Math.round((v + (cb[j] - v) * k) * 255))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/** Degrees clockwise from the top, with noon at the top and midnight at the bottom. */
const angleOf = (ms: number, midnight: number) => ((ms - midnight) / 3_600_000) / 24 * 360 + 180

const pt = (cx: number, cy: number, a: number, r: number): [number, number] => {
  const rad = (a * Math.PI) / 180
  return [cx + Math.sin(rad) * r, cy - Math.cos(rad) * r]
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(cx, cy, a0, r)
  const [x1, y1] = pt(cx, cy, a1, r)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/** One prayer's period as short sub-arcs, each in the sky's colour at that hour (the conic gradient). */
function SkyArc({ cx, cy, r, a0, a1, width, stops }: { cx: number; cy: number; r: number; a0: number; a1: number; width: number; stops: Stop[] }) {
  if (a1 <= a0) return null
  const n = Math.max(1, Math.ceil((a1 - a0) / 2.5))
  const step = (a1 - a0) / n
  const parts = []
  for (let i = 0; i < n; i++) {
    const s = a0 + i * step, e = Math.min(a1, s + step + (i < n - 1 ? 0.4 : 0))
    const mid = (s + Math.min(a1, s + step)) / 2
    parts.push(<path d={arcPath(cx, cy, r, s, e)} stroke={colorAt(stops, (mid - 180) / 360)} stroke-width={width} fill="none" />)
  }
  return <g>{parts}</g>
}

function NowDot({ cx, cy, ring }: { cx: number; cy: number; ring: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={ring * 1.05} fill="var(--accent)" fill-opacity="0.35" />
      <circle cx={cx} cy={cy} r={ring * 0.62} fill="#fff" stroke="var(--accent)" stroke-width="3" />
    </g>
  )
}

function Rays({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <circle cx="12" cy="12" r="4.6" />
      {Array.from({ length: 8 }, (_, i) => <rect x="11" y="1.2" width="2" height="4" rx="1" transform={`rotate(${i * 45} 12 12)`} />)}
    </svg>
  )
}

function MoonGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" fill={color} />
    </svg>
  )
}

/**
 * The Day Dial: the whole day as a 24-hour ring in the colours of the sky,
 * noon at the top, a glowing dot for now, and the prayer we are in at the centre.
 */
export function DayDial(props: {
  size: number; now: number; day: PrayerDay; nextFajr: number; tz: string
  currentPrayer: Prayer; currentName: string; countdown: string; nextName: string
}) {
  const { size, now, day, nextFajr, tz, currentPrayer } = props
  const midnight = useMemo(() => startOfDay(day.times.dhuhr, tz), [day, tz])
  const stops = useMemo(() => skyStops(day, midnight), [day, midnight])
  const ring = size * 0.085
  const r = size / 2 - ring / 2 - 2
  const c = size / 2
  const angle = (ms: number) => angleOf(ms, midnight)
  const segments = useMemo(() => PRAYERS.map((p, i) => {
    const start = angle(day.times[p])
    const end = i + 1 < PRAYERS.length ? angle(day.times[PRAYERS[i + 1]]) : angle(nextFajr)
    return { p, start: start + 1, end: end - 1 }
  }), [day, nextFajr, midnight])
  const [dx, dy] = pt(c, c, angle(now), r)
  return (
    <div class="daydial" style={{ width: `${size}px`, height: `${size}px` }} role="img"
      aria-label={`Now ${props.currentName}. ${props.countdown} until ${props.nextName}.`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--fg)" stroke-opacity="0.1" stroke-width={ring} />
        {segments.map((s) => (
          <SkyArc cx={c} cy={c} r={r} a0={s.start} a1={s.end} width={s.p === currentPrayer ? ring * 1.3 : ring} stops={stops} />
        ))}
        {[0, 1, 2, 3].map((q) => {
          const [x1, y1] = pt(c, c, q * 90, r - ring / 2 - 6)
          const [x2, y2] = pt(c, c, q * 90, r - ring / 2 - 13)
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg)" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round" />
        })}
        <NowDot cx={dx} cy={dy} ring={ring} />
      </svg>
      <span class="dial-sun" style={{ top: `${c - size * 0.3}px` }}><Rays size={size * 0.075} color="var(--accent)" /></span>
      <span class="dial-moon" style={{ top: `${c + size * 0.3}px` }}><MoonGlyph size={size * 0.065} color="var(--fg3)" /></span>
      <div class="daydial-centre" style={{ padding: `0 ${size * 0.18}px` }}>
        <div class="display" style={{ fontSize: `${size * 0.14}px`, fontWeight: 700, lineHeight: 1.1 }}>{props.currentName}</div>
        <div class="display accent mono" style={{ fontSize: `${size * 0.1}px`, fontWeight: 600, lineHeight: 1.15 }}>{props.countdown}</div>
        <div class="secondary" style={{ fontSize: `${size * 0.065}px`, fontWeight: 500 }}>until {props.nextName}</div>
      </div>
    </div>
  )
}

export interface DialMark { id: string; date: number; minor?: boolean; extraLine?: boolean; tint?: string }

const labelSize = (m: DialMark, size: number) =>
  m.minor ? { w: size * 0.22, h: size * 0.08 } : { w: size * 0.22, h: size * (m.extraLine ? 0.14 : 0.105) }

/**
 * Where each label goes: just inside the ring at its time, then nudged apart
 * along the circle when two would overlap (port of HeroDial.layout).
 */
function layout(marks: DialMark[], size: number, inner: number, angle: (ms: number) => number): Record<string, [number, number]> {
  const sorted = [...marks].sort((a, b) => (angle(a.date) % 360) - (angle(b.date) % 360))
  if (!sorted.length) return {}
  const angles = sorted.map((m) => angle(m.date) % 360)
  const spot = (i: number): [number, number] => {
    const box = labelSize(sorted[i], size)
    const rad = (angles[i] * Math.PI) / 180
    const inset = Math.abs(Math.sin(rad)) * box.w / 2 + Math.abs(Math.cos(rad)) * box.h / 2
    return [size / 2 + Math.sin(rad) * (inner - inset), size / 2 - Math.cos(rad) * (inner - inset)]
  }
  const n = sorted.length
  for (let iter = 0; iter < 120 && n > 1; iter++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const p = spot(i), q = spot(j)
      const a = labelSize(sorted[i], size), b = labelSize(sorted[j], size)
      if (Math.abs(p[0] - q[0]) < (a.w + b.w) / 2 + 2 && Math.abs(p[1] - q[1]) < (a.h + b.h) / 2 + 2) {
        angles[i] -= 0.5
        angles[j] += 0.5
        moved = true
      }
    }
    if (!moved) break
  }
  const out: Record<string, [number, number]> = {}
  sorted.forEach((m, i) => { out[m.id] = spot(i) })
  return out
}

/** The Day Dial as the hero of the "Day Dial" style: every time sits inside the ring at its hour. */
export function HeroDial(props: {
  size: number; now: number; day: PrayerDay; nextFajr: number; tz: string; currentPrayer: Prayer | null
  marks: DialMark[]; label: (m: DialMark, size: number) => ComponentChildren; centre: (size: number) => ComponentChildren
}) {
  const { size, now, day, nextFajr, tz, currentPrayer, marks } = props
  const midnight = useMemo(() => startOfDay(day.times.dhuhr, tz), [day, tz])
  const stops = useMemo(() => skyStops(day, midnight), [day, midnight])
  const angle = (ms: number) => angleOf(ms, midnight)
  const ring = size * 0.042
  const r = size / 2 - ring * 0.65 - 1
  const inner = r - ring * 0.65 - size * 0.015
  const c = size / 2
  const spots = useMemo(() => layout(marks, size, inner, angle), [marks.map((m) => m.id + m.date + m.extraLine).join(), size, midnight])
  const [dx, dy] = pt(c, c, angle(now), r)
  return (
    <div class="herodial" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={c} cy={c} r={size / 2 - ring * 1.3} fill="var(--fg)" fill-opacity="0.04" />
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--fg)" stroke-opacity="0.08" stroke-width={ring} />
        {PRAYERS.map((p, i) => {
          const start = angle(day.times[p])
          const end = i + 1 < PRAYERS.length ? angle(day.times[PRAYERS[i + 1]]) : angle(nextFajr)
          return <SkyArc cx={c} cy={c} r={r} a0={start + 0.8} a1={end - 0.8} width={p === currentPrayer ? ring * 1.3 : ring} stops={stops} />
        })}
        {marks.map((m) => {
          const a = angle(m.date)
          const [x1, y1] = pt(c, c, a, r - ring * 0.65 - 2)
          const [x2, y2] = pt(c, c, a, r - ring * 0.65 - (m.minor ? 5 : 8))
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={m.minor ? 'var(--fg3)' : m.tint ?? 'var(--fg)'}
            stroke-width={m.minor ? 1.5 : 2.5} stroke-linecap="round" />
        })}
        {currentPrayer && <NowDot cx={dx} cy={dy} ring={ring} />}
      </svg>
      {marks.map((m) => {
        const s = spots[m.id]
        if (!s) return null
        const box = labelSize(m, size)
        return (
          <div class="dial-label" style={{ left: `${s[0] - box.w / 2}px`, top: `${s[1] - box.h / 2}px`, width: `${box.w}px`, height: `${box.h}px` }}>
            {props.label(m, size)}
          </div>
        )
      })}
      <div class="herodial-centre" style={{ width: `${size * 0.34}px` }}>{props.centre(size)}</div>
    </div>
  )
}

/**
 * The day as one smooth arc, local midnight to midnight: highest at solar noon,
 * crossing the horizon at sunrise and Maghrib, every prayer marked (SunPath.swift).
 */
export function SunPath({ width, height, now, day, tz }: { width: number; height: number; now: number; day: PrayerDay; tz: string }) {
  const start = startOfDay(day.times.dhuhr, tz)
  const fraction = (ms: number) => Math.min(1, Math.max(0, (ms - start) / 86_400_000))
  const noon = fraction(day.times.dhuhr)
  const halfDay = (fraction(day.times.maghrib) - fraction(day.times.sunrise)) / 2
  const horizonValue = Math.cos(2 * Math.PI * halfDay)
  const top = 10, bottom = height - 6
  const y = (v: number) => bottom - ((v + 1) / 2) * (bottom - top)
  const horizon = y(horizonValue)
  const point = (f: number): [number, number] => [f * width, y(Math.cos(2 * Math.PI * (f - noon)))]
  let d = ''
  for (let i = 0; i <= 240; i++) { const [x, yy] = point(i / 240); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}` }
  const isDay = now >= day.times.sunrise && now < day.times.maghrib
  const [sx, sy] = point(fraction(now))
  const id = `sunclip-${Math.round(width)}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id={id}><rect x="0" y="-20" width={width} height={Math.max(0, horizon + 20)} /></clipPath>
        <filter id={`${id}-blur`} x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <line x1="0" y1={horizon} x2={width} y2={horizon} stroke="var(--fg)" stroke-opacity="0.14" />
      <path d={d} fill="none" stroke="var(--fg)" stroke-opacity="0.22" stroke-width="2" stroke-linecap="round" />
      <path d={d} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" clip-path={`url(#${id})`} />
      {PRAYERS.map((p) => {
        const [x, yy] = point(fraction(day.times[p]))
        const passed = day.times[p] <= now
        return <circle cx={x} cy={yy} r="3.8" fill={passed ? 'var(--fg)' : 'none'} fill-opacity="0.9" stroke="var(--fg)" stroke-opacity="0.85" stroke-width="1.5" />
      })}
      <circle cx={sx} cy={sy} r="17" fill="var(--accent)" fill-opacity="0.45" filter={`url(#${id}-blur)`} />
      {isDay
        ? <circle cx={sx} cy={sy} r="7" fill="var(--accent)" />
        : <g transform={`translate(${sx - 7} ${sy - 7})`}><MoonGlyph size={14} color="var(--accent)" /></g>}
    </svg>
  )
}
