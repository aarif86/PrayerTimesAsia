import { useEffect, useMemo, useState } from 'preact/hooks'
import qrcode from 'qrcode-generator'
import { readJSON, writeJSON } from '../services/storage'
import { decodeConfig, sanitize, type ScreenConfig } from './config'
import { pairStart, pairSync, type PairWait } from './live'

/** What the TV keeps once it has been paired: the code, its key, and the newest settings number it has. */
export interface TvPair { code: string; tvKey: string; rev: number }
export const PAIR_KEY = 'ptasia.screen.pair'
const WAIT_KEY = 'ptasia.screen.pairwait'
const WAIT_MS = 15 * 60_000
/** After pairing, the TV looks for changes from the phone this often. */
export const PAIR_SYNC_MS = 10 * 60_000

/** The address the phone opens when it scans the QR code on the TV. */
const pairLink = (code: string) => `${location.origin}${location.pathname}#pair=${code}`

/**
 * The TV's first screen at prayertimes.asia/tv: a big code and a QR code. The committee scans it (or types the code)
 * on their phone, chooses what shows, and taps one button. This screen then turns into the masjid screen.
 * The code is kept across a reload, and a new one is asked for when it runs out.
 */
export function PairScreen({ onPaired }: { onPaired: (c: ScreenConfig, pair: TvPair) => void }) {
  const [wait, setWait] = useState<PairWait | null>(() => {
    const w = readJSON<PairWait>(WAIT_KEY)
    return w && Date.now() - w.startedAt < WAIT_MS - 60_000 ? w : null
  })
  const [offline, setOffline] = useState(false)

  // Ask for a code when there is none (or it ran out); every 4 seconds ask whether the phone has sent the settings.
  useEffect(() => {
    let stop = false, id: ReturnType<typeof setTimeout>
    let current = wait
    const loop = async () => {
      if (stop) return
      if (!current || Date.now() - current.startedAt > WAIT_MS - 30_000) {
        const w = await pairStart()
        if (stop) return
        setOffline(!w)
        if (w) { writeJSON(WAIT_KEY, w); current = w; setWait(w) }
      } else {
        const r = await pairSync(current.code, current.tvKey, 0)
        if (stop) return
        if (r === 'gone') { current = null; writeJSON(WAIT_KEY, null) }
        else if (r && r.c) {
          const c = decodeConfig(r.c)
          if (c) { writeJSON(WAIT_KEY, null); onPaired(sanitize(c), { code: current.code, tvKey: current.tvKey, rev: r.rev }); return }
        } else setOffline(r === null)
      }
      id = setTimeout(loop, current ? 4000 : 8000)
    }
    void loop()
    return () => { stop = true; clearTimeout(id) }
  }, [])

  const svg = useMemo(() => {
    if (!wait) return ''
    const qr = qrcode(0, 'M')
    qr.addData(pairLink(wait.code))
    qr.make()
    return qr.createSvgTag({ scalable: true, margin: 2 })
  }, [wait?.code])

  return (
    <main class="pair">
      <h1>Set up this screen</h1>
      <p class="pair-lead">On your phone, scan this code, or go to <b>prayertimes.asia/app/screen</b> and type the code below.</p>
      <div class="pair-row">
        {svg ? <div class="pair-qr" dangerouslySetInnerHTML={{ __html: svg }} /> : <div class="pair-qr empty" />}
        <div class="pair-code" aria-live="polite">
          <span>Your code</span>
          <b>{wait ? [...wait.code].join(' ') : '. . . . . .'}</b>
        </div>
      </div>
      <p class="pair-hint">{offline ? 'This TV cannot reach the internet yet. Trying again.' : 'Pick what shows on your phone, tap Show on my TV, and this screen turns into your masjid screen.'}</p>
      <p class="pair-foot">prayertimes.asia</p>
    </main>
  )
}
