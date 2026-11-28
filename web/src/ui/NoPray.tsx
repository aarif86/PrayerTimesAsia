import { noPrayerNow, noPrayerWindows, type NoPrayerWindow } from '../core/forbidden'
import type { PrayerDay } from '../core/engine'
import { tr } from '../core/appWords'
import { store } from '../services/store'

const KEYS: Record<NoPrayerWindow, [Parameters<typeof tr>[0], Parameters<typeof tr>[0]]> = {
  sunrise: ['nopray.sunrise', 'nopray.sunriseNote'],
  zenith: ['nopray.zenith', 'nopray.zenithNote'],
  sunset: ['nopray.sunset', 'nopray.sunsetNote'],
}

/** "Times not to pray": three short windows, shown under Show more times. Today only gets the live line. */
export function NoPrayCard({ day, now, today }: { day: PrayerDay; now: number; today: boolean }) {
  const ws = noPrayerWindows(day)
  const st = noPrayerNow(day, now)
  const line = !today ? null
    : st.inside ? tr('nopray.nowInside', { to: store.formatted(ws.find((w) => w.kind === st.inside)!.to) })
    : st.next ? tr('nopray.nowFine', { from: store.formatted(st.next.from) })
    : tr('nopray.nowDone')
  return (
    <section class="nopray card" aria-label={tr('nopray.title')}>
      <div class="headline">{tr('nopray.title')}</div>
      <div class="caption">{tr('nopray.sub')}</div>
      {ws.map((w) => (
        <div class={`nopray-row ${st.inside === w.kind ? 'on' : ''}`}>
          <div><div>{tr(KEYS[w.kind][0])}</div><div class="caption">{tr(KEYS[w.kind][1])}</div></div>
          <b>{tr('nopray.range', { from: store.formatted(w.from), to: store.formatted(w.to) })}</b>
        </div>
      ))}
      {line && <div class="nopray-now">{line}</div>}
      <div class="caption">{tr('nopray.fineprint')}</div>
    </section>
  )
}
