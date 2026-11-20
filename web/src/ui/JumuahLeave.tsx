import { useState } from 'preact/hooks'
import { inSingapore } from '../core/friday'
import { JUMUAH_LEAVE_CHOICES, leaveChoiceLabel, SECOND_SESSION_FROM, type JumuahSession } from '../core/jumuahLeave'
import { prayerName } from '../core/prayer'
import { alertSupport, nextJumuahLeave, permission, requestPermission } from '../services/notifications'
import { store, useNow, useStore } from '../services/store'
import { openSheet } from './common'

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
    ? `${s.dayKey(next.leave) === s.dayKey(now) ? 'Today' : 'Friday'} ${s.formatted(next.leave)}, for ${friday} at ${s.formatted(next.start)}`
    : null
  const firstFrom = sg && p.jumuahSession === 'second' ? `the second session at ${twoPM}` : s.myMasjidHere?.jumuah ? `your masjid's own ${friday} time` : `the start of ${s.name('dhuhr')}`

  return (
    <section>
      {title && <h2 class="group-title">Leave for {friday}</h2>}
      <div class="group">
        <label class="item">
          <span class="label">Remind me to leave{nextText && <span class="sub mono">{nextText}</span>}</span>
          <select class="inline-select" value={String(p.jumuahReminderMinutes)} aria-label={`Remind me to leave for ${friday}`}
            onChange={(e) => void setMinutes(parseInt((e.target as HTMLSelectElement).value, 10))}>
            {JUMUAH_LEAVE_CHOICES.map((v) => <option value={String(v)}>{leaveChoiceLabel(v)}</option>)}
          </select>
        </label>
        {sg && p.jumuahReminderMinutes > 0 && (
          <label class="item">
            <span class="label">Which session</span>
            <select class="inline-select" value={p.jumuahSession} aria-label={`Which ${friday} session`}
              onChange={(e) => { const v = (e.target as HTMLSelectElement).value as JumuahSession; store.update((x) => { x.jumuahSession = v }) }}>
              <option value="first">First, at {s.name('dhuhr')}</option>
              <option value="second">Second, from {twoPM}</option>
            </select>
          </label>
        )}
      </div>
      <p class="group-foot">
        {`A reminder on Fridays to get ready and leave in time. It counts back from ${firstFrom}.`}
        {sg && ` In Singapore some masjids hold a second session from ${twoPM}. The Masjid tab shows which ones.`}
        {` ${friday} is not required of women, travellers or the sick, who pray ${s.name('dhuhr')} instead.`}
      </p>
    </section>
  )
}
