import { useEffect, useState } from 'preact/hooks'
import { Check, Copy, Share2 } from 'lucide-preact'
import { encode } from 'uqr'
import { applyMoved, decodeMove, describeMoved, encodeForQR, encodeMove, movedFrom, type MovedSettings } from '../services/move'
import { store } from '../services/store'
import { closeSheet, Sheet } from './common'

/** This web app's own address with a code on it, so a phone camera opens it straight into "Bring in settings". */
export function moveLink(code: string): string {
  return `${location.origin}${location.pathname}#move=${code}`
}

/** A code carried in on the link (#move=...), read once when the app opens. */
export function takeMoveFromLink(): string | null {
  const m = /[#&]move=([^&]+)/.exec(location.hash)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  return decodeURIComponent(m[1])
}

function QR({ text }: { text: string }) {
  const qr = encode(text, { ecc: 'L', border: 2 })
  let path = ''
  qr.data.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x} ${y}h1v1h-1z` }))
  return (
    <svg class="move-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} shape-rendering="crispEdges" role="img" aria-label="QR code with your settings">
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

export function MoveOutSheet() {
  const [qr, setQr] = useState<{ link: string; keptDays: number | null } | null>(null)
  const [full, setFull] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const m = movedFrom(store.prefs)
    const prefix = moveLink('').length
    void encodeForQR(m, undefined, prefix).then(({ code, keptDays }) => setQr({ link: moveLink(code), keptDays }))
    void encodeMove(m).then((code) => setFull(moveLink(code)))
  }, [])

  const copy = async () => {
    if (!full) return
    try { await navigator.clipboard.writeText(full); setCopied(true) } catch { prompt('Copy this link', full) }
  }
  const canShare = typeof navigator.share === 'function'

  return (
    <Sheet title="Move my settings">
      <div class="help">
        <p class="subhead">Your places, choices and tracker history, packed into one code. Nothing is uploaded: the settings are inside the code itself.</p>
        <div class="move-qr-wrap">{qr ? <QR text={qr.link} /> : <div class="move-qr" />}</div>
        <ol class="subhead">
          <li>On the other phone, open Prayer Times Asia › Settings › <b>Bring in settings</b> and scan this code.</li>
          <li>No app there? Point its camera at the code: it opens the web app with your settings.</li>
        </ol>
        {qr?.keptDays != null && (
          <p class="footnote secondary">The QR code carries your last {qr.keptDays} days of tracker history. To bring all of it, use Copy link or Share.</p>
        )}
        <div class="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button class="plain-btn" disabled={!full} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy link'}</button>
          {canShare && <button class="plain-btn" disabled={!full} onClick={() => void navigator.share({ title: 'My Prayer Times Asia settings', url: full! }).catch(() => {})}><Share2 size={16} />Share</button>}
        </div>
        <p class="footnote secondary">The code includes your saved places, so only send it to yourself.</p>
      </div>
    </Sheet>
  )
}

export function MoveInSheet({ code: initial }: { code?: string }) {
  const [text, setText] = useState(initial ?? '')
  const [moved, setMoved] = useState<MovedSettings | null>(null)
  const [error, setError] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!text.trim()) { setMoved(null); setError(false); return }
    let live = true
    void decodeMove(text).then((m) => { if (live) { setMoved(m); setError(!m) } })
    return () => { live = false }
  }, [text])

  const bringIn = () => {
    if (!moved) return
    const next = applyMoved(store.prefs, moved)
    store.update((p) => { Object.assign(p, next) })
    if (next.useGPS) store.locate()
    setDone(true)
  }

  if (done) {
    return (
      <Sheet title="Bring in settings">
        <div class="help">
          <p class="headline">Your settings are here.</p>
          {moved?.notifyPrayers || moved?.reminderMinutesBefore ? <p class="subhead">Prayer alerts need permission on each device: turn them on in Settings › Alerts.</p> : null}
          <button class="primary-btn" onClick={closeSheet}>Done</button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Bring in settings">
      <div class="help">
        <p class="subhead">On your other phone or browser, open Settings › <b>Move my settings</b>. Scan its QR code with this phone's camera, or paste its link here.</p>
        <textarea class="move-paste" rows={3} placeholder="Paste the link or code" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        {error && <p class="footnote" style={{ color: 'var(--danger, #e5484d)' }}>That doesn't look like a settings code. Copy the whole link and try again.</p>}
        {moved && (
          <>
            <p class="subhead" style={{ fontWeight: 600 }}>This will bring in:</p>
            <ul class="subhead move-list">{describeMoved(moved).map((l) => <li>{l}</li>)}</ul>
            <p class="footnote secondary">Your settings here are replaced. Tracker history is added to what's already here.</p>
            <button class="primary-btn" onClick={bringIn}>Bring in settings</button>
          </>
        )}
      </div>
    </Sheet>
  )
}
