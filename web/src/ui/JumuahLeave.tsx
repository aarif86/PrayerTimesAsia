import { useState } from 'preact/hooks'
import { inSingapore } from '../core/friday'
import { JUMUAH_LEAVE_CHOICES, leaveSpan, SECOND_SESSION_FROM, type JumuahSession } from '../core/jumuahLeave'
import { prayerName } from '../core/prayer'
import { alertSupport, nextJumuahLeave, permission, requestPermission } from '../services/notifications'
import { store, useNow, useStore } from '../services/store'
import { openSheet, ToggleItem } from './common'
import { stopAlarm } from '../services/alarmSound'
import { appLang, tr } from '../core/appWords'

/**
 * "Leave for Jumaat", in the Prayer alarms sheet, its one home. Same
 * setting on every platform. Singapore also gets the first or second session.
 */
export function JumuahLeaveGroup({ title = true }: { title?: boolean }) {
  const s = useStore()
  const now = useNow(60_000)
  const [, setPerm] = useState(permission())
  const p = s.prefs
  const place = s.activePlace
  const friday = prayerName('dhuhr', s.naming, true)
  const sg = !!place && inSingapore(place.coordinates, place.countryCode)
  const next = nextJumuahLeave(now)
  const [h, m] = SECOND_SESSION_FROM.split(':').map((x) => parseInt(x, 10))
  const twoPM = s.clock(h * 60 + m)

  const setMinutes = async (minutes: number) => {
    if (minutes > 0 && alertSupport() === 'supported' && !(await requestPermission())) { setPerm(permission()); openSheet({ kind: 'alerts-help' }); return }
    setPerm(permission())
    store.update((x) => { x.jumuahReminderMinutes = minutes })
  }

  const nextText = next
    ? tr(s.dayKey(next.leave) === s.dayKey(now) ? 'jumuah.nextToday' : 'jumuah.nextFriday', { leave: s.formatted(next.leave), friday, start: s.formatted(next.start) })
    : null
  const firstFrom = sg && p.jumuahSession === 'second' ? twoPM : s.myMasjidHere?.jumuah ? tr('jumuah.ownTime', { friday }) : tr('jumuah.startOf', { dhuhr: s.name('dhuhr') })

  return (
    <section>
      {title && <h2 class="group-title">{tr('jumuah.leaveFor', { friday })}</h2>}
      <div class="group">
        <label class="item">
          <span class="label">{tr('settings.leave')}{nextText && <span class="sub mono">{nextText}</span>}</span>
          <select class="inline-select" value={String(p.jumuahReminderMinutes)} aria-label={tr('jumuah.leaveForAria', { friday })}
            onChange={(e) => void setMinutes(parseInt((e.target as HTMLSelectElement).value, 10))}>
            {JUMUAH_LEAVE_CHOICES.map((v) => <option value={String(v)}>{v === 0 ? tr('common.off') : tr('jumuah.before', { span: leaveSpan(v, appLang()) })}</option>)}
          </select>
        </label>
        {p.jumuahReminderMinutes > 0 && (
          <ToggleItem label={tr('jumuah.ringAlarm')} sub={tr('jumuah.ringAlarmSub')} on={p.jumuahLeaveAlarm}
            onChange={(v) => { store.update((x) => { x.jumuahLeaveAlarm = v }); if (v && alertSupport() === 'supported') void requestPermission(); if (!v) stopAlarm() }} />
        )}
        {sg && p.jumuahReminderMinutes > 0 && (
          <label class="item">
            <span class="label">{tr('jumuah.session')}<span class="sub">{tr('jumuah.sessionSub', { dhuhr: s.name('dhuhr'), time: twoPM })}</span></span>
            <select class="inline-select" value={p.jumuahSession} aria-label={tr('jumuah.sessionAria', { friday })}
              onChange={(e) => { const v = (e.target as HTMLSelectElement).value as JumuahSession; store.update((x) => { x.jumuahSession = v }) }}>
              <option value="first">{tr('jumuah.first')}</option>
              <option value="second">{tr('jumuah.second')}</option>
            </select>
          </label>
        )}
      </div>
      <p class="group-foot">
        {tr('jumuah.foot', { from: firstFrom })}
        {sg && ` ${tr('jumuah.footSg')}`}
        {` ${tr('jumuah.footWho', { friday, dhuhr: s.name('dhuhr') })}`}
      </p>
    </section>
  )
}
