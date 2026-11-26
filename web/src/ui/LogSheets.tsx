import { useState } from 'preact/hooks'
import { ChevronRight, CircleCheck } from 'lucide-preact'
import { OBLIGATORY, type Prayer } from '../core/prayer'
import { tr } from '../core/appWords'
import { store, useNow, useStore } from '../services/store'
import { closeSheet, Sheet } from './common'

/** "13:05" for a time input, in the shown place's time zone. */
function hhmm(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: store.timeZone }).format(new Date(ms))
}

/** The three ways to say when a prayer was prayed. No words about early or late. */
function Choices({ p, t, done, chips }: { p: Prayer; t: number; done: () => void; chips?: boolean }) {
  const s = useStore()
  const now = useNow(60_000)
  const [picking, setPicking] = useState(false)
  const [value, setValue] = useState(hhmm(now))
  const save = (at: number) => { s.setPrayed(p, t, at); done() }
  const row = (label: string, onClick: () => void, first = false, chev = false) => (
    <button class={`log-choice ${first ? 'first' : ''} ${chips ? 'chip' : ''}`} onClick={onClick}>
      <span>{label}</span>{chev && <ChevronRight size={18} />}
    </button>
  )
  return (
    <div class={`log-choices ${chips ? 'chips' : ''}`}>
      {row(tr('log.justNow', { time: s.formatted(now) }), () => save(now), true)}
      {row(tr('log.atTime', { time: s.formatted(t) }), () => save(t))}
      {picking ? (
        <div class="log-pick">
          <label class="caption secondary" for={`log-time-${p}`}>{tr('log.timeLabel')}</label>
          <input id={`log-time-${p}`} type="time" value={value} onInput={(e) => setValue((e.target as HTMLInputElement).value)} />
          <button class="primary-btn" onClick={() => { let at = s.timeOnDayOf(t, value); if (at === null) return; if (at < t) at += 86_400_000 /* Isha prayed after midnight */; save(Math.min(at, now)) }}>{tr('log.save')}</button>
        </div>
      ) : row(tr('log.pick'), () => setPicking(true), false, true)}
    </div>
  )
}

/** Tap a past prayer's circle: a small sheet to say when it was prayed, or take the tick away. */
export function LogPrayerSheet({ prayer, t }: { prayer: Prayer; t: number }) {
  const s = useStore()
  const prayed = s.isPrayed(prayer, t)
  return (
    <Sheet title={s.name(prayer, t)}>
      <p class="secondary log-ask">{tr('log.ask')}</p>
      <Choices p={prayer} t={t} done={closeSheet} />
      {prayed && <button class="log-remove" onClick={() => { s.setPrayed(prayer, t, null); closeSheet() }}>{tr('log.remove')}</button>}
    </Sheet>
  )
}

/** Log my prayers: today's prayers whose time has come, with the same choices and one button to tick the rest. */
export function CatchUpSheet() {
  const s = useStore()
  const now = useNow(60_000)
  const day = s.day(now)
  const due = day ? OBLIGATORY.filter((p) => day.times[p] <= now) : []
  const todo = due.filter((p) => !s.isPrayed(p, day!.times[p]))
  return (
    <Sheet title={tr('log.catchTitle')} back={tr('settings.trackerOn')} full>
      <p class="secondary log-ask">{tr('log.catchIntro')}</p>
      <div class="glass card log-list">
        {due.map((p) => {
          const t = day!.times[p]
          const prayed = s.isPrayed(p, t)
          const at = s.prefs.prayedAt[s.dayKey(t)]?.[p]
          return (
            <div class="log-item">
              <div class="log-item-head">
                <b>{s.name(p, t)}</b>{prayed && <CircleCheck size={16} class="accent" />}
                <span class="spacer" />
                <span class="caption secondary">{prayed ? (at ? tr('log.prayedAt', { time: s.formatted(at) }) : tr('log.prayed')) : tr('log.from', { time: s.formatted(t) })}</span>
              </div>
              {!prayed && <Choices p={p} t={t} done={() => {}} chips />}
            </div>
          )
        })}
        {!due.length || !todo.length ? <p class="caption secondary" style={{ padding: '8px 4px' }}>{tr('log.allDone')}</p> : null}
      </div>
      {todo.length > 0 && (
        <div style={{ padding: '14px 20px 24px' }}>
          <button class="primary-btn wide" onClick={() => todo.forEach((p) => s.setPrayed(p, day!.times[p], day!.times[p]))}>{tr('log.tickAll')}</button>
        </div>
      )}
    </Sheet>
  )
}
