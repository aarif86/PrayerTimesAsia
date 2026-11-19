import { useMemo, useState } from 'preact/hooks'
import { ChevronLeft, ChevronRight } from 'lucide-preact'
import { authorityName } from '../core/calendarSanad'
import { gregorianFromHijri, type HijriDate } from '../core/hijri'
import { hijriCalWords, islamicDayName, islamicDaysOf } from '../core/islamicDays'
import { hijriMonths } from '../core/prayer'
import { addDays, daysApart, type CivilDay } from '../core/season'
import { store, useNow, useStore } from '../services/store'
import { closeSheet, showDayOnPrayerScreen } from './common'

/** The civil days of one Hijri month, as this community counts it. */
function monthDays(year: number, month: number): { g: CivilDay; h: HijriDate }[] {
  const est = gregorianFromHijri(year, month, 1)
  if (!est) return []
  const out: { g: CivilDay; h: HijriDate }[] = []
  let g = addDays(est, -4)
  for (let i = 0; i < 40; i++, g = addDays(g, 1)) {
    const h = store.hijriOfCivil(g)
    if (h.year === year && h.month === month) out.push({ g, h })
    else if (out.length) break
  }
  return out
}

const GREG_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortAuthority = (id: string) => authorityName(id).replace(/\s*\(.*\)\s*$/, '')

function fmtCivil(g: CivilDay, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: style === 'long' ? 'long' : 'short', day: 'numeric', month: style === 'long' ? 'long' : 'short',
    ...(style === 'long' ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(g.year, g.month - 1, g.day))).replace(',', '')
}

/** A quiet month view at the top of the Calendar sheet (tap the date on the Prayer screen). */
export function HijriMonthCard() {
  const s = useStore()
  const now = useNow(60_000)
  const words = hijriCalWords(s.naming)
  const today = s.civil(now)
  const todayH = s.hijriOfCivil(today)
  const [shown, setShown] = useState({ y: todayH.year, m: todayH.month })
  const [picked, setPicked] = useState<CivilDay | null>(null)
  const days = useMemo(() => monthDays(shown.y, shown.m), [shown.y, shown.m, s.prefs.hijriAdjustment, s.communityAuthority, s.calendar])
  const move = (d: number) => {
    setPicked(null)
    setShown(({ y, m }) => { const i = y * 12 + (m - 1) + d; return { y: Math.floor(i / 12), m: (i % 12) + 1 } })
  }
  const isThisMonth = shown.y === todayH.year && shown.m === todayH.month
  const first = days[0]?.g
  const lead = first ? (new Date(Date.UTC(first.year, first.month - 1, first.day)).getUTCDay() + 6) % 7 : 0
  const keyDays = days.flatMap(({ g, h }) => islamicDaysOf(h).filter((k) => k.major || k.kind === 'lastTen' && h.day === 21 || k.kind === 'tasyrik' && h.day === 11).map((k) => ({ g, h, k })))
  const hasWhite = days.some(({ h }) => islamicDaysOf(h).some((k) => k.kind === 'whiteDay'))
  const gregSpan = first && days.length
    ? (() => {
      const last = days[days.length - 1].g
      return first.month === last.month ? `${GREG_MONTHS[first.month - 1]} ${first.year}`
        : first.year === last.year ? `${GREG_MONTHS[first.month - 1]} and ${GREG_MONTHS[last.month - 1]} ${last.year}`
          : `${GREG_MONTHS[first.month - 1]} ${first.year} and ${GREG_MONTHS[last.month - 1]} ${last.year}`
    })()
    : ''
  const sel = picked ? days.find((d) => daysApart(d.g, picked) === 0) : null
  const authority = s.communityAuthority
  const adj = s.prefs.hijriAdjustment
  const goTo = (g: CivilDay) => { showDayOnPrayerScreen(daysApart(today, g)); closeSheet() }

  return (
    <div class="glass card hcal" style={{ marginTop: '10px' }}>
      <div class="hcal-head">
        <button class="round-btn hcal-prev" aria-label="Previous Hijri month" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
        <div class="hcal-title">
          <h3>{hijriMonths(s.naming)[shown.m - 1]} {shown.y}</h3>
          <div class="caption secondary">{gregSpan}</div>
        </div>
        <button class="round-btn hcal-next" aria-label="Next Hijri month" onClick={() => move(1)}><ChevronRight size={18} /></button>
      </div>
      <div class="hcal-grid" role="grid">
        {words.week.map((w) => <span class="hcal-wd secondary" aria-hidden="true">{w}</span>)}
        {Array.from({ length: lead }, () => <span />)}
        {days.map(({ g, h }) => {
          const marks = islamicDaysOf(h)
          const major = marks.some((k) => k.major)
          const quiet = !major && marks.some((k) => k.kind === 'lastTen' || k.kind === 'tasyrik')
          const white = marks.some((k) => k.kind === 'whiteDay')
          const isToday = daysApart(today, g) === 0
          const isPicked = sel && daysApart(sel.g, g) === 0
          const showMonth = g.day === 1 || h.day === 1
          const label = `${h.day} ${hijriMonths(s.naming)[h.month - 1]}, ${fmtCivil(g)}${marks.length ? `, ${marks.map((k) => islamicDayName(k.kind, s.naming)).join(', ')}` : ''}`
          return (
            <button class={`hcal-day${isToday ? ' is-today' : ''}${major ? ' major' : ''}${quiet ? ' quiet' : ''}${isPicked ? ' picked' : ''}`}
              aria-label={label} aria-current={isToday ? 'date' : undefined} onClick={() => setPicked(isPicked ? null : g)}>
              <span class="hd mono">{h.day}</span>
              <span class="gd mono">{showMonth ? `${g.day} ${GREG_MONTHS[g.month - 1]}` : g.day}</span>
              {white && <i class="white-dot" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      {sel ? (
        <div class="hcal-picked">
          <div>
            <div class="subhead" style={{ fontWeight: 600 }}>{sel.h.day} {hijriMonths(s.naming)[sel.h.month - 1]} {sel.h.year}</div>
            <div class="caption secondary">{fmtCivil(sel.g)}</div>
            {islamicDaysOf(sel.h).map((k) => <div class="caption accent" style={{ fontWeight: 600 }}>{islamicDayName(k.kind, s.naming)}</div>)}
          </div>
          <button class="pill-btn quiet" onClick={() => goTo(sel.g)}>{s.naming === 'malay' ? 'Waktu solat' : s.naming === 'indonesian' ? 'Jadwal salat' : 'Prayer times'}</button>
        </div>
      ) : (
        <div class="hcal-list">
          {!isThisMonth && <button class="hcal-back caption accent" onClick={() => move((todayH.year - shown.y) * 12 + todayH.month - shown.m)}>{words.today}</button>}
          {keyDays.length ? keyDays.map(({ g, h, k }) => (
            <button class="hcal-row" onClick={() => setPicked(g)}>
              <span class="mono hcal-row-h">{h.day}</span>
              <span class="hcal-row-name">{islamicDayName(k.kind, s.naming)}</span>
              <span class="caption secondary mono">{fmtCivil(g, 'short')}</span>
            </button>
          )) : <p class="caption secondary" style={{ margin: '4px 0' }}>{words.none}</p>}
          {hasWhite && keyDays.length > 0 && <div class="caption secondary hcal-legend"><i class="white-dot" aria-hidden="true" />{islamicDayName('whiteDay', s.naming)} 13, 14, 15</div>}
        </div>
      )}
      <p class="caption secondary hcal-note">{words.note(authority ? shortAuthority(authority) : null)}</p>
      <div class="hcal-adjust">
        <span class="caption">{words.adjust}</span>
        <span class="caption secondary mono">{adj === 0 ? words.adjustNone : `${adj > 0 ? '+' : ''}${adj} ${words.dayOff}`}</span>
        <span class="stepper">
          <button aria-label={words.earlier} disabled={adj <= -2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.max(-2, x.hijriAdjustment - 1) })}>−</button>
          <button aria-label={words.later} disabled={adj >= 2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.min(2, x.hijriAdjustment + 1) })}>+</button>
        </span>
      </div>
    </div>
  )
}
