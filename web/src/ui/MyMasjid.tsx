import { MoonStar } from 'lucide-preact'
import { masjidQuery, type MasjidLink } from '../core/masjidLink'
import { OBLIGATORY } from '../core/prayer'
import { store, useStore } from '../services/store'
import { Sheet } from './common'
import { tr } from '../core/appWords'

/** "13:15" as the user reads times: 1:15 PM, or 13:15. */
function clock(hhmm: string): string {
  if (store.prefs.use24Hour) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function Rules({ m }: { m: MasjidLink }) {
  const rows = OBLIGATORY.filter((p) => m.jamaah[p]).map((p) => {
    const r = m.jamaah[p]!
    return { label: store.name(p), value: r.fixed ? clock(r.fixed) : r.after === 0 ? 'At the azan' : `${r.after} min after azan` }
  })
  if (m.jumuah) rows.push({ label: tr('myMasjid.jumuah'), value: clock(m.jumuah) })
  if (!rows.length) return <div class="item"><span class="label secondary">{tr('myMasjid.noTimes')}</span></div>
  return <>{rows.map((r) => <div class="item"><span class="label">{r.label}</span><span class="value">{r.value}</span></div>)}</>
}

/** Opened from a masjid screen's QR code: ask before making it "your masjid". */
export function MasjidLinkSheet({ m }: { m: MasjidLink }) {
  const s = useStore()
  const replacing = s.prefs.myMasjid && s.prefs.myMasjid.name !== m.name ? s.prefs.myMasjid.name : null
  return (
    <Sheet title={tr('myMasjid.title')} onDone={() => s.dismissMasjid()}>
      <div class="my-masjid-head">
        <MoonStar size={30} class="accent" />
        <div class="headline">{m.name}</div>
        <div class="subhead secondary">{tr('myMasjid.addExplain')}</div>
      </div>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('myMasjid.iqamah')}</h3>
      <div class="group"><Rules m={m} /></div>
      {replacing && <p class="group-foot">This replaces {replacing}.</p>}
      <div class="my-masjid-actions">
        <button class="primary-btn" onClick={() => s.followMasjid()}>{tr('myMasjid.add')}</button>
        <button class="plain-btn" onClick={() => s.dismissMasjid()}>{tr('common.notNow')}</button>
      </div>
      <p class="footnote secondary my-masjid-app">
        Using the iPhone or Android app? <a href={`prayertimesasia://${masjidQuery(m)}`}>{tr('myMasjid.openInApp')}</a>.
      </p>
    </Sheet>
  )
}
