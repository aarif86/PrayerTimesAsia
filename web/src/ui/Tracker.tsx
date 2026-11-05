import { useState } from 'preact/hooks'
import { ChevronLeft, ChevronRight, Droplet, Flame, Pause, Play } from 'lucide-preact'
import { OBLIGATORY } from '../core/prayer'
import { ymdKey } from '../core/tz'
import { useNow, useStore } from '../services/store'
import { Sheet } from './common'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** The tracker's month view, the pause, and the streak. Everything here lives only on this device. */
export function TrackerSheet() {
  const s = useStore()
  const now = useNow(60_000)
  const today = s.dayKey(now)
  const [ty, tm] = today.split('-').map(Number)
  const [shown, setShown] = useState({ y: ty, m: tm })
  const first = new Date(Date.UTC(shown.y, shown.m - 1, 1))
  const daysInMonth = new Date(Date.UTC(shown.y, shown.m, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7 // Monday first
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => ymdKey(shown.y, shown.m, i + 1))]
  const past = cells.filter((k): k is string => !!k && k <= today)
  const prayed = past.reduce((n, k) => { const d = s.trackerDay(k); return d.excused ? n : n + d.prayed }, 0)
  const excused = past.filter((k) => s.trackerDay(k).excused).length
  const counted = past.length - excused
  const move = (d: number) => setShown(({ y, m }) => { const t = new Date(Date.UTC(y, m - 1 + d, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 } })
  const isThisMonth = shown.y === ty && shown.m === tm
  const since = s.prefs.trackerPausedSince
  const sinceLabel = since ? new Date(`${since}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''

  return (
    <Sheet title="Prayer tracker" full>
      <div class="glass card tracker-top" style={{ marginTop: '10px' }}>
        <div class="tracker-streak">
          {s.trackerPaused ? <Pause size={22} /> : <Flame size={22} fill="currentColor" />}
          <span class="mono big">{s.streak(now)}</span>
          <span class="secondary">day streak</span>
        </div>
        {s.trackerPaused ? (
          <>
            <p class="caption secondary">Paused since {sinceLabel}. These days count as excused, so your streak waits for you.</p>
            <button class="pill-btn" onClick={() => s.endTrackerPause(now)}><Play size={16} />End pause</button>
          </>
        ) : (
          <>
            <p class="caption secondary">For haid, nifas or illness: pause the tracker and every day until you end it counts as excused.</p>
            <div class="tracker-actions">
              <button class="pill-btn" onClick={() => s.pauseTracker(now)}><Pause size={16} />Pause tracker</button>
              <button class={`pill-btn quiet ${s.isExcused(now) ? 'on' : ''}`} aria-pressed={s.isExcused(now)} onClick={() => s.toggleExcused(now)}>
                <Droplet size={16} />{s.isExcused(now) ? 'Excused today' : 'Just today'}
              </button>
            </div>
          </>
        )}
      </div>

      <div class="glass card">
        <div class="tracker-month-head">
          <button class="round-btn" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
          <h3>{MONTHS[shown.m - 1]} {shown.y}</h3>
          <button class="round-btn" aria-label="Next month" disabled={isThisMonth} onClick={() => move(1)}><ChevronRight size={18} /></button>
        </div>
        <div class="tracker-grid" role="grid">
          {WEEK.map((w) => <span class="tracker-wd secondary">{w}</span>)}
          {cells.map((k) => {
            if (!k) return <span />
            const d = s.trackerDay(k)
            const future = k > today
            const full = d.prayed >= OBLIGATORY.length
            const label = `${Number(k.slice(8))} ${MONTHS[shown.m - 1]}: ${future ? 'not yet' : d.excused ? 'excused' : `${d.prayed} of 5 prayers`}`
            return (
              <span class={`tracker-day ${k === today ? 'is-today' : ''} ${future ? 'future' : ''} ${full ? 'full' : ''} ${d.excused ? 'excused' : ''}`}
                style={{ '--fill': `${(d.prayed / OBLIGATORY.length) * 360}deg` }} role="gridcell" aria-label={label}>
                {d.excused && !full ? <Droplet size={12} fill="currentColor" /> : <span class="mono">{Number(k.slice(8))}</span>}
              </span>
            )
          })}
        </div>
        <div class="tracker-legend caption secondary">
          <span><i class="tracker-key full" />All five</span>
          <span><i class="tracker-key part" />Some</span>
          <span><Droplet size={11} fill="#e06c8a" color="#e06c8a" />Excused</span>
        </div>
        <p class="tracker-sum">
          {counted > 0 ? <><b class="mono">{prayed}</b> of {counted * OBLIGATORY.length} prayers ticked</> : 'Nothing to count yet'}
          {excused > 0 && <span class="secondary"> · {excused} excused day{excused === 1 ? '' : 's'}</span>}
        </p>
      </div>
      <p class="caption secondary" style={{ padding: '0 20px 24px' }}>
        Tap a prayer on the Prayer screen once its time has come to tick it off. Your tracker is kept only on this device - never uploaded, and it moves to a new phone only through Move my settings.
      </p>
    </Sheet>
  )
}
