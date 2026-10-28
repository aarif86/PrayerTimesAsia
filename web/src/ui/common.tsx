import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Info, X } from 'lucide-preact'
import type { PrayerDay } from '../core/engine'
import { sourceAuthority } from '../core/official'
import { GRADE_TITLE, type SourceGrade } from '../core/sources'
import { store } from '../services/store'

/** A time with its AM/PM set smaller on the same baseline. Never wraps. */
export function TimeText({ ms, size = 28, weight = 600, class: cls, style }: { ms: number; size?: number; weight?: number; class?: string; style?: JSX.CSSProperties }) {
  const p = store.timeParts(ms)
  return (
    <span class={`time ${cls ?? ''}`} style={{ fontSize: `${size}px`, fontWeight: weight, ...style }} aria-label={store.formatted(ms)}>
      <span>{p.time}</span>
      {p.suffix && <span class="sfx" style={{ fontSize: `${size * 0.5}px` }}>{p.suffix}</span>}
    </span>
  )
}

/** "9h 22m", "22m", "45s". */
export function short(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s}s`
  const minutes = Math.floor((s + 59) / 60)
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export const GRADE_TINT: Record<SourceGrade, string> = {
  A: 'var(--grade-a)', B: 'var(--grade-b)', C: 'var(--grade-c)', D: 'var(--grade-d)', F: 'var(--accent)',
}

// ---------- Sheets: one at a time, like iOS ----------

export type SheetKind =
  | { kind: 'places' } | { kind: 'sanad'; day: PrayerDay } | { kind: 'calendar' } | { kind: 'makers'; placement: string }
  | { kind: 'journey' } | { kind: 'level' } | { kind: 'ar' } | { kind: 'alerts-help' } | { kind: 'credits' } | { kind: 'install' }
  | { kind: 'move-out' } | { kind: 'move-in'; code?: string }

let current: SheetKind | null = null
const listeners = new Set<() => void>()
export function openSheet(s: SheetKind) { current = s; listeners.forEach((f) => f()) }
export function closeSheet() { current = null; listeners.forEach((f) => f()) }
export function useSheet(): SheetKind | null {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set((x) => x + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  return current
}

export function Sheet({ title, children, full, onDone }: { title?: string; children: ComponentChildren; full?: boolean; onDone?: () => void }) {
  const done = onDone ?? closeSheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') done() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done])
  return (
    <div class="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) done() }}>
      <div class={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="grabber" />
        <div class="sheet-head">
          <span style={{ width: '64px' }} />
          <h2>{title}</h2>
          <button class="done" onClick={done}>Done</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- Controls ----------

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button class="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
}

export function ToggleItem({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div class="item">
      <span class="label">{label}{sub && <span class="sub">{sub}</span>}</span>
      <Switch on={on} onChange={onChange} label={label} />
    </div>
  )
}

export function SelectItem<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <label class="item">
      <span class="label">{label}</span>
      <select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)}>
        {options.map((o) => <option value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="segmented" role="group">
      {options.map((o) => <button aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}

/** "Every time has a source. We show it." The badge by the prayer list. */
export function SourceBadge({ day, compact }: { day: PrayerDay; compact?: boolean }) {
  const grade = day.grade
  const shortSource = grade === 'A'
    ? `${GRADE_TITLE[grade]} · ${store.officialSource && day.officialSource ? sourceAuthority(store.officialSource) : store.method.shortName}`
    : grade === 'B' || grade === 'C' ? day.mosqueName ?? GRADE_TITLE[grade] : `${GRADE_TITLE[grade]} · ${store.method.shortName}`
  const sourceName = day.officialSource ?? `${store.method.shortName} method`
  return (
    <button class={`source-badge ${compact ? 'compact' : 'full'}`} onClick={() => openSheet({ kind: 'sanad', day })}
      aria-label={`Source: grade ${grade}, ${GRADE_TITLE[grade]}, ${sourceName}. Shows where these times come from.`}>
      <span class="grade" style={{ background: GRADE_TINT[grade] }}>{grade}</span>
      <span class="src">{compact ? shortSource : `${GRADE_TITLE[grade]} · ${sourceName}`}</span>
      {!compact && <span class="spacer" />}
      <Info size={compact ? 12 : 15} style={{ opacity: 0.7, flex: 'none' }} />
    </button>
  )
}

export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return <button class="round-btn" onClick={onClick} aria-label={label}><X size={16} /></button>
}

/** Formats a date in the place's zone. */
export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: store.timeZone, ...opts }).format(new Date(ms)).replace(',', '')
}
