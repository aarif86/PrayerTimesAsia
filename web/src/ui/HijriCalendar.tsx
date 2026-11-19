import { useMemo, useState } from 'preact/hooks'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-preact'
import { authorityName } from '../core/calendarSanad'
import type { HijriDate } from '../core/hijri'
import { hijriCalWords, islamicDayName, islamicDayShort, islamicDaysOf, hijriMonthShort } from '../core/islamicDays'
import { hijriMonths } from '../core/prayer'
import { daysApart, publishedHijri, type CivilDay } from '../core/season'
import { store, useNow, useStore } from '../services/store'
import { closeSheet, showDayOnPrayerScreen } from './common'
import { appLocale, tr } from '../core/appWords'

/** The days of one Gregorian month, each with its Hijri date as this community counts it. */
function monthDays(year: number, month: number): { g: CivilDay; h: HijriDate }[] {
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => {
    const g = { year, month, day: i + 1 }
    return { g, h: store.hijriOfCivil(g) }
  })
}

const shortAuthority = (id: string) => authorityName(id).replace(/\s*\(.*\)\s*$/, '')

function fmtCivil(g: CivilDay, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(appLocale(), {
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
  const [shown, setShown] = useState({ y: today.year, m: today.month })
  const [picked, setPicked] = useState<CivilDay | null>(null)
  const days = useMemo(() => monthDays(shown.y, shown.m), [shown.y, shown.m, s.prefs.hijriAdjustment, s.communityAuthority, s.calendar])
  const move = (d: number) => {
    setPicked(null)
    setShown(({ y, m }) => { const i = y * 12 + (m - 1) + d; return { y: Math.floor(i / 12), m: (i % 12) + 1 } })
  }
  const isThisMonth = shown.y === today.year && shown.m === today.month
  const lead = new Date(Date.UTC(shown.y, shown.m - 1, 1)).getUTCDay() // Sunday first, like a wall calendar
  const hMonths = hijriMonths(s.naming)
  const keyDays = days.flatMap(({ g, h }) => islamicDaysOf(h).filter((k) => k.major || k.kind === 'lastTen' && h.day === 21 || k.kind === 'tasyrik' && h.day === 11 || k.kind === 'zulhijjahTen' && h.day === 1).map((k) => ({ g, h, k })))
  const hijriSpan = (() => {
    const a = days[0].h, z = days[days.length - 1].h
    const n = (m: number) => hijriMonthShort(m, s.naming, hMonths[m - 1])
    if (a.month === z.month) return `${n(a.month)} ${a.year}`
    return a.year === z.year ? `${n(a.month)} ${words.and} ${n(z.month)} ${z.year}`
      : `${n(a.month)} ${a.year} ${words.and} ${n(z.month)} ${z.year}`
  })()
  // A month with no big days still has its white days: list each run of 13, 14, 15.
  const whiteRuns = keyDays.length ? [] : days.filter(({ h }, i) => (h.day === 13 || i === 0) && islamicDaysOf(h).some((k) => k.kind === 'whiteDay'))
  const sel = picked ? days.find((d) => daysApart(d.g, picked) === 0) : null
  const authority = s.communityAuthority
  const adj = s.prefs.hijriAdjustment
  const published = !!authority && !!publishedHijri(days[0].g, s.calendar.month_starts, authority)
  const goTo = (g: CivilDay) => { showDayOnPrayerScreen(daysApart(today, g)); closeSheet() }

  return (
    <div class="glass card hcal" style={{ marginTop: '10px' }}>
      <div class="hcal-head">
        <button class="round-btn hcal-prev" aria-label={tr('tracker.prevMonth')} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
        <div class="hcal-title">
          <h3>{words.months[shown.m - 1]} {shown.y}</h3>
          <div class="hcal-hspan">{hijriSpan}</div>
        </div>
        <button class="round-btn hcal-next" aria-label={tr('tracker.nextMonth')} onClick={() => move(1)}><ChevronRight size={18} /></button>
      </div>
      <div class="hcal-grid">
        {words.week.map((w, i) => <span class={`hcal-wd secondary${i === 5 ? ' fri' : ''}`} aria-hidden="true">{w}</span>)}
        {Array.from({ length: lead }, () => <span />)}
        {days.map(({ g, h }, i) => {
          const marks = islamicDaysOf(h)
          const major = marks.find((k) => k.major)
          const quiet = !major && marks.some((k) => k.kind === 'lastTen' || k.kind === 'tasyrik' || k.kind === 'zulhijjahTen')
          const white = marks.some((k) => k.kind === 'whiteDay')
          const isToday = daysApart(today, g) === 0
          const isPicked = sel && daysApart(sel.g, g) === 0
          const newMonth = h.day === 1
          const showMonth = newMonth || i === 0
          const sunday = (lead + i) % 7 === 0
          const ramadan = h.month === 9
          const label = `${fmtCivil(g)}, ${h.day} ${hMonths[h.month - 1]} ${h.year}${marks.length ? `, ${marks.map((k) => islamicDayName(k.kind, s.naming)).join(', ')}` : ''}`
          return (
            <button class={`hcal-day${isToday ? ' is-today' : ''}${major ? ' major' : ''}${quiet ? ' quiet' : ''}${isPicked ? ' picked' : ''}${sunday ? ' sun' : ''}${ramadan ? ' ramadan' : ''}${newMonth ? ' new-month' : ''}`}
              aria-label={label} aria-current={isToday ? 'date' : undefined} onClick={() => setPicked(isPicked ? null : g)}>
              <span class="gd">{g.day}</span>
              <span class="hd mono">{h.day}{white && <i class="white-dot" aria-hidden="true" />}</span>
              {major ? <span class="ev">{islamicDayShort(major.kind, s.naming)}</span>
                : showMonth ? <span class="hm">{hijriMonthShort(h.month, s.naming, hMonths[h.month - 1])}</span> : null}
            </button>
          )
        })}
      </div>
      {sel ? (
        <div class="hcal-picked">
          <div>
            <div class="subhead" style={{ fontWeight: 600 }}>{sel.h.day} {hMonths[sel.h.month - 1]} {sel.h.year}</div>
            <div class="caption secondary">{fmtCivil(sel.g)}</div>
            {islamicDaysOf(sel.h).map((k) => <div class="caption accent" style={{ fontWeight: 600 }}>{islamicDayName(k.kind, s.naming)}</div>)}
          </div>
          <button class="pill-btn quiet" onClick={() => goTo(sel.g)}>{s.naming === 'malay' ? 'Waktu solat' : s.naming === 'indonesian' ? 'Jadwal salat' : tr('today.title')}</button>
        </div>
      ) : (
        <div class="hcal-list">
          {!isThisMonth && <button class="hcal-back caption accent" onClick={() => move((today.year - shown.y) * 12 + today.month - shown.m)}>{words.today}</button>}
          {keyDays.length ? keyDays.map(({ g, h, k }) => (
            <button class="hcal-row" onClick={() => setPicked(g)}>
              <span class="mono hcal-row-h">{g.day}</span>
              <span class="hcal-row-name">{islamicDayName(k.kind, s.naming)}</span>
              <span class="caption secondary mono">{h.day} {hMonths[h.month - 1]}</span>
            </button>
          )) : whiteRuns.length ? whiteRuns.map(({ g, h }) => (
            <button class="hcal-row" onClick={() => setPicked(g)}>
              <span class="mono hcal-row-h">{g.day}</span>
              <span class="hcal-row-name">{islamicDayName('whiteDay', s.naming)}</span>
              <span class="caption secondary mono">13, 14, 15 {hijriMonthShort(h.month, s.naming, hMonths[h.month - 1])}</span>
            </button>
          )) : <p class="caption secondary" style={{ margin: '4px 0' }}>{words.none}</p>}
          {!whiteRuns.length && <div class="caption secondary hcal-legend"><i class="white-dot" aria-hidden="true" />{islamicDayName('whiteDay', s.naming)} 13, 14, 15</div>}
        </div>
      )}
      <a class="hcal-print caption accent" href={`print/#sheet=year&m=${shown.y}-01`}><Printer size={14} />{words.print} {shown.y}</a>
      <p class="caption secondary hcal-note">{published ? words.notePublished(shortAuthority(authority!)) : words.note(authority ? shortAuthority(authority) : null)}</p>
      {/* A published calendar (MUIS) already gives the local dates, so there is nothing to move. */}
      {!published && <div class="hcal-adjust">
        <span class="caption">{words.adjust}</span>
        <span class="caption secondary mono">{adj === 0 ? words.adjustNone : `${adj > 0 ? '+' : ''}${adj} ${words.dayOff}`}</span>
        <span class="stepper">
          <button aria-label={words.earlier} disabled={adj <= -2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.max(-2, x.hijriAdjustment - 1) })}>−</button>
          <button aria-label={words.later} disabled={adj >= 2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.min(2, x.hijriAdjustment + 1) })}>+</button>
        </span>
      </div>}
    </div>
  )
}
