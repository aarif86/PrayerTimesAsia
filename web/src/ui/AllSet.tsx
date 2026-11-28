import { CircleCheck } from 'lucide-preact'
import { tr } from '../core/appWords'
import { store } from '../services/store'
import { short } from './common'

/** Once, after a new user picks a place: what we chose for them and the next prayer. Then the quick guide. */
export function AllSetCard({ now }: { now: number }) {
  const place = store.activePlace
  const day = store.day(now)
  const next = store.next(now)
  const asr = store.asrSchool === 'hanafi' ? tr('settings.hanafi') : tr('settings.shafii')
  const done = () => store.update((p) => { p.allSetShown = true })
  return (
    <div class="allset" role="dialog" aria-modal="true" aria-label={tr('allset.title')}>
      <div class="allset-card">
        <CircleCheck size={56} class="allset-check" />
        <h2 class="display">{tr('allset.title')}</h2>
        <p class="caption">{tr('allset.lead')}</p>
        <div class="allset-rows">
          <div><span>{tr('allset.source')}</span><b>{store.sourceSummary}</b></div>
          <div><span>{tr('allset.asr')}</span><b>{asr}</b></div>
          {place && <div><span>{tr('allset.place')}</span><b>{place.name}</b></div>}
          {next && day && (
            <div><span>{tr('allset.next')}</span><b>{store.name(next.prayer, next.time)} {store.formatted(next.time)}</b></div>
          )}
        </div>
        {next && <p class="caption">{tr('allset.inTime', { time: short(next.time - now) })}</p>}
        <button class="onb-primary allset-go" onClick={done}>{tr('allset.go')}</button>
        <p class="caption">{tr('allset.change')}</p>
      </div>
    </div>
  )
}
