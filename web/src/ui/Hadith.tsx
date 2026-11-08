import { X } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { HADITH, type HadithId } from '../core/hadith'
import { lang3 } from '../core/ramadanContent'
import { store, useStore } from '../services/store'

/**
 * A short hadith or ayah, as a card (`card`) or a softer line (`line`). Hidden
 * when Settings, Hadith is off or the person closed this one with its ✕. Right
 * after closing, a small "Hidden" note with Undo stays for a few seconds.
 */
export function Hadith({ id, tag, variant = 'card' }: { id: HadithId; tag?: string; variant?: 'card' | 'line' }) {
  const s = useStore()
  const [justHidden, setJustHidden] = useState(false)
  useEffect(() => {
    if (!justHidden) return
    const t = setTimeout(() => setJustHidden(false), 6000)
    return () => clearTimeout(t)
  }, [justHidden])
  if (!s.prefs.showHadith) return null
  const hidden = s.prefs.hiddenHadith.includes(id)
  if (hidden) {
    if (!justHidden) return null
    return (
      <div class="hadith-undo" role="status">
        <span>Hadith hidden here. Bring them all back in Settings, Hadith.</span>
        <button onClick={() => { store.update((p) => { p.hiddenHadith = p.hiddenHadith.filter((x) => x !== id) }); setJustHidden(false) }}>Undo</button>
      </div>
    )
  }
  const h = HADITH[id]
  const lang = lang3(s.naming)
  const close = () => { store.update((p) => { if (!p.hiddenHadith.includes(id)) p.hiddenHadith = [...p.hiddenHadith, id] }); setJustHidden(true) }
  return (
    <div class={variant === 'card' ? 'glass card hadith-card' : 'hadith-line'}>
      <div class="hadith-top">
        {variant === 'card' && <span class="hadith-tag">{tag ?? 'Hadith'}</span>}
        <button class="hadith-x" aria-label="Hide this hadith" onClick={close}><X size={15} strokeWidth={2.6} /></button>
      </div>
      <p class="arabic" dir="rtl" lang="ar">{h.arabic}</p>
      <p class="quote">“{h.meaning[lang]}”</p>
      <p class="caption secondary">{h.source[lang]}</p>
    </div>
  )
}
