import { useEffect, useState } from 'preact/hooks'
import { Check, Copy, Share2 } from 'lucide-preact'
import { encode } from 'uqr'
import { applyMoved, decodeMove, describeMoved, encodeForQR, encodeMove, movedFrom, type MovedSettings } from '../services/move'
import { store } from '../services/store'
import { closeSheet, Sheet } from './common'
import { moveLink } from './moveLink'
import { tr } from '../core/appWords'
export { moveLink, takeMoveFromLink } from './moveLink'


function QR({ text }: { text: string }) {
  const qr = encode(text, { ecc: 'L', border: 2 })
  let path = ''
  qr.data.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x} ${y}h1v1h-1z` }))
  return (
    <svg class="move-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} shape-rendering="crispEdges" role="img" aria-label={tr('move.qrAlt')}>
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

export function MoveOutSheet() {
  const [qr, setQr] = useState<{ link: string; keptDays: number | null; ramadanTrimmed: boolean } | null>(null)
  const [full, setFull] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const m = movedFrom(store.prefs)
    const prefix = moveLink('').length
    void encodeForQR(m, undefined, prefix).then(({ code, keptDays, ramadanTrimmed }) => setQr({ link: moveLink(code), keptDays, ramadanTrimmed }))
    void encodeMove(m).then((code) => setFull(moveLink(code)))
  }, [])

  const copy = async () => {
    if (!full) return
    try { await navigator.clipboard.writeText(full); setCopied(true) } catch { prompt('Copy this link', full) }
  }
  const canShare = typeof navigator.share === 'function'

  return (
    <Sheet title={tr('move.title')}>
      <div class="help">
        <p class="subhead">{tr('move.intro')}</p>
        <div class="move-qr-wrap">{qr ? <QR text={qr.link} /> : <div class="move-qr" />}</div>
        <ol class="subhead">
          <li>{tr('move.otherPhone')}</li>
          <li>{tr('move.noApp')}</li>
        </ol>
        {qr && (qr.keptDays != null || qr.ramadanTrimmed) && (
          <p class="footnote secondary">{tr('move.carries', { what: [
            qr.keptDays != null ? tr('move.lastDays', { n: qr.keptDays }) : null,
            qr.ramadanTrimmed ? tr('move.ramadanOnly') : null,
          ].filter(Boolean).join(` ${tr('common.and')} `) })}</p>
        )}
        <div class="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button class="plain-btn" disabled={!full} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? tr('common.copied') : tr('common.copyLink')}</button>
          {canShare && <button class="plain-btn" disabled={!full} onClick={() => void navigator.share({ title: tr('move.shareTitle'), url: full! }).catch(() => {})}><Share2 size={16} />{tr('common.share')}</button>}
        </div>
        <p class="footnote secondary">{tr('move.private')}</p>
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
      <Sheet title={tr('move.bringIn')}>
        <div class="help">
          <p class="headline">{tr('move.arrived')}</p>
          {moved?.notifyPrayers || moved?.reminderMinutesBefore ? <p class="subhead">{tr('move.alertsAgain')}</p> : null}
          <button class="primary-btn" onClick={closeSheet}>{tr('common.done')}</button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={tr('move.bringIn')}>
      <div class="help">
        <p class="subhead">{tr('move.bringHow')}</p>
        <textarea class="move-paste" rows={3} placeholder={tr('move.paste')} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        {error && <p class="footnote" style={{ color: 'var(--danger, #e5484d)' }}>{tr('move.bad')}</p>}
        {moved && (
          <>
            <p class="subhead" style={{ fontWeight: 600 }}>{tr('move.willBring')}</p>
            <ul class="subhead move-list">{describeMoved(moved).map((l) => <li>{l}</li>)}</ul>
            <p class="footnote secondary">{tr('move.replaceNote')}</p>
            <button class="primary-btn" onClick={bringIn}>{tr('move.bringIn')}</button>
          </>
        )}
      </div>
    </Sheet>
  )
}
