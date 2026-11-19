import { useState } from 'preact/hooks'
import { ChevronLeft, ChevronRight, Droplet, Flame, Pause, Play } from 'lucide-preact'
import { OBLIGATORY } from '../core/prayer'
import { ymdKey } from '../core/tz'
import { useNow, useStore } from '../services/store'
import { Sheet } from './common'
import { Hadith } from './Hadith'
import { appLocale, tr, trWith } from '../core/appWords'

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
  const sinceLabel = since ? new Date(`${since}T12:00:00Z`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''

  return (
    <Sheet title={tr('settings.trackerOn')} full>
      <div style={{ marginTop: '10px' }} />
      <Hadith id="river" />
      <div class="glass card tracker-top">
        <div class="tracker-streak">
          {s.trackerPaused ? <Pause size={22} /> : <Flame size={22} fill="currentColor" />}
          <span class="mono big">{s.streak(now)}</span>
          <span class="secondary">{tr('tracker.streakLabel')}</span>
        </div>
        {s.trackerPaused ? (
          <>
            <p class="caption secondary">{tr('tracker.pausedSince', { date: sinceLabel })}</p>
            <Hadith id="illness" variant="line" />
            <button class="pill-btn" onClick={() => s.endTrackerPause(now)}><Play size={16} />{tr('tracker.endPause')}</button>
          </>
        ) : (
          <>
            <p class="caption secondary">{tr('tracker.pauseHelp')}</p>
            <div class="tracker-actions">
              <button class="pill-btn" onClick={() => s.pauseTracker(now)}><Pause size={16} />{tr('tracker.pause')}</button>
              <button class={`pill-btn quiet ${s.isExcused(now) ? 'on' : ''}`} aria-pressed={s.isExcused(now)} onClick={() => s.toggleExcused(now)}>
                <Droplet size={16} />{s.isExcused(now) ? tr('tracker.excusedToday') : tr('tracker.justToday')}
              </button>
            </div>
          </>
        )}
      </div>

      <div class="glass card">
        <div class="tracker-month-head">
          <button class="round-btn" aria-label={tr('tracker.prevMonth')} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
          <h3>{MONTHS[shown.m - 1]} {shown.y}</h3>
          <button class="round-btn" aria-label={tr('tracker.nextMonth')} disabled={isThisMonth} onClick={() => move(1)}><ChevronRight size={18} /></button>
        </div>
        <div class="tracker-grid">
          {WEEK.map((w) => <span class="tracker-wd secondary" aria-hidden="true">{w}</span>)}
          {cells.map((k) => {
            if (!k) return <span />
            const d = s.trackerDay(k)
            const future = k > today
            const full = d.prayed >= OBLIGATORY.length
            const label = `${Number(k.slice(8))} ${MONTHS[shown.m - 1]}: ${future ? tr('tracker.notYet') : d.excused ? 'excused' : `${d.prayed} of 5 prayers`}`
            return (
              <span class={`tracker-day ${k === today ? 'is-today' : ''} ${future ? 'future' : ''} ${full ? 'full' : ''} ${d.excused ? 'excused' : ''}`}
                style={{ '--fill': `${(d.prayed / OBLIGATORY.length) * 360}deg` }} role="img" aria-label={label}>
                {d.excused && !full ? <Droplet size={12} fill="currentColor" /> : <span class="mono">{Number(k.slice(8))}</span>}
              </span>
            )
          })}
        </div>
        <div class="tracker-legend caption secondary">
          <span><i class="tracker-key full" />{tr('tracker.allFive')}</span>
          <span><i class="tracker-key part" />{tr('tracker.some')}</span>
          <span><Droplet size={11} fill="#e06c8a" color="#e06c8a" />{tr('tracker.excused')}</span>
        </div>
        <p class="tracker-sum">
          {counted > 0 ? <>{trWith('tracker.tickedOf', { n: <b class="mono">{prayed}</b>, total: counted * OBLIGATORY.length })}</> : tr('tracker.nothing')}
          {excused > 0 && <span class="secondary"> · {tr('tracker.excusedDays', { n: excused })}</span>}
        </p>
      </div>
      <p class="caption secondary" style={{ padding: '0 20px 24px' }}>
        {tr('tracker.help')}
      </p>
    </Sheet>
  )
}
