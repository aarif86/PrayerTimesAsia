import { MoonStar } from 'lucide-preact'
import { masjidQuery, MY_MASJID_RADIUS_KM, type MasjidLink } from '../core/masjidLink'
import { OBLIGATORY } from '../core/prayer'
import { store, useStore } from '../services/store'
import { Sheet } from './common'

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
  if (m.jumuah) rows.push({ label: "Jumu'ah", value: clock(m.jumuah) })
  if (!rows.length) return <div class="item"><span class="label secondary">This masjid hasn't set its iqamah times yet.</span></div>
  return <>{rows.map((r) => <div class="item"><span class="label">{r.label}</span><span class="value">{r.value}</span></div>)}</>
}

/** Opened from a masjid screen's QR code: ask before making it "your masjid". */
export function MasjidLinkSheet({ m }: { m: MasjidLink }) {
  const s = useStore()
  const replacing = s.prefs.myMasjid && s.prefs.myMasjid.name !== m.name ? s.prefs.myMasjid.name : null
  return (
    <Sheet title="Your masjid" onDone={() => s.dismissMasjid()}>
      <div class="my-masjid-head">
        <MoonStar size={30} class="accent" />
        <div class="headline">{m.name}</div>
        <div class="subhead secondary">Add it as your masjid and its iqamah times show on your Prayer screen whenever you're nearby.</div>
      </div>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Iqamah</h3>
      <div class="group"><Rules m={m} /></div>
      {replacing && <p class="group-foot">This replaces {replacing}.</p>}
      <div class="my-masjid-actions">
        <button class="primary-btn" onClick={() => s.followMasjid()}>Add my masjid</button>
        <button class="plain-btn" onClick={() => s.dismissMasjid()}>Not now</button>
      </div>
      <p class="footnote secondary my-masjid-app">
        Using the iPhone or Android app? <a href={`prayertimesasia://${masjidQuery(m)}`}>Open this in the app</a>.
      </p>
    </Sheet>
  )
}

/** "Subuh +15 · Zohor +10 · … · Jumu'ah 1:00 PM", for one line. */
function summary(m: MasjidLink): string {
  const parts = OBLIGATORY.filter((p) => m.jamaah[p]).map((p) => {
    const r = m.jamaah[p]!
    return `${store.name(p)} ${r.fixed ? clock(r.fixed) : `+${r.after}`}`
  })
  if (m.jumuah) parts.push(`Jumu'ah ${clock(m.jumuah)}`)
  return parts.length ? `Iqamah: ${parts.join(' · ')}` : 'No iqamah times set yet'
}

/** On the Masjid tab: your masjid in one row, or how to add one. */
export function MyMasjidGroup() {
  const s = useStore()
  const m = s.prefs.myMasjid
  if (!m) {
    return (
      <p class="footnote secondary my-masjid-hint">
        Your masjid has a Prayer Times Asia screen? Scan its QR code with your phone's camera to see its iqamah times on your Prayer screen.
      </p>
    )
  }
  const here = s.myMasjidHere != null
  return (
    <div class="my-masjid-row">
      <div class="group">
        <div class="item" style={{ alignItems: 'flex-start' }}>
          <MoonStar size={22} class="accent" style={{ flex: 'none', marginTop: '2px' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div class="caps secondary">Your masjid</div>
            <div class="headline">{m.name}</div>
            <div class="footnote secondary" style={{ marginTop: '2px' }}>{summary(m)}</div>
            <div class="footnote secondary" style={{ marginTop: '4px' }}>
              {here ? 'Shown as "Jamaah" on your Prayer screen.' : `Shown on your Prayer screen when you're within ${MY_MASJID_RADIUS_KM} km.`}
            </div>
          </div>
          <button class="plain-btn" onClick={() => s.forgetMasjid()}>Remove</button>
        </div>
      </div>
    </div>
  )
}
