import { useEffect, useRef, useState } from 'preact/hooks'
import { AlarmClock, BellRing, CalendarDays, MapPin, Palette, Plane } from 'lucide-preact'
import centre from '../assets/guide/look-centre.webp'
import list from '../assets/guide/look-list.webp'
import dial from '../assets/guide/look-dial.webp'
import sunPath from '../assets/guide/look-sunPath.webp'
import bands from '../assets/guide/look-bands.webp'
import simple from '../assets/guide/look-simple.webp'

/** Real screenshots of the six Prayer screen looks, shown one after another on the Looks card. */
const LOOKS = [centre, list, dial, sunPath, bands, simple]
import { GUIDE_CARDS, GUIDE_TAB, GUIDE_WORDS, guideLang, type GuideCardId } from '../core/guideWords'
import { lang3, type Lang3 } from '../core/ramadanContent'
import { navigatorLocale, store, TABS } from '../services/store'
import { TabFalak, TabJourney, TabMasjid, TabPrayer, TabQibla, TabSettings } from './icons'

const LANGS: { id: Lang3; label: string }[] = [{ id: 'en', label: 'EN' }, { id: 'ms', label: 'BM' }, { id: 'id', label: 'ID' }]
const TAB_ICON = { today: TabPrayer, qibla: TabQibla, falak: TabFalak, masjid: TabMasjid, settings: TabSettings }

/**
 * The quick guide: eight swipe cards a new user sees once, right after choosing
 * their location. Skip at any time; Settings opens it again.
 */
export function Guide({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState<Lang3>(() => guideLang(lang3(store.naming), navigatorLocale()))
  const [i, setI] = useState(0)
  const [drag, setDrag] = useState(0)
  const start = useRef<{ x: number; y: number; w: number } | null>(null)
  const w = GUIDE_WORDS[lang]
  const last = i === GUIDE_CARDS.length - 1

  const go = (n: number) => { setI(Math.max(0, Math.min(GUIDE_CARDS.length - 1, n))); setDrag(0) }
  const finish = () => { store.update((p) => { p.guideSeen = true }); onClose() }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1)
      else if (e.key === 'ArrowLeft') go(i - 1)
      else if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i])

  const onDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, w: (e.currentTarget as HTMLElement).clientWidth }
  }
  const onMove = (e: PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    if (Math.abs(dx) < Math.abs(e.clientY - start.current.y)) return
    // A little resistance past the first and last card.
    setDrag((i === 0 && dx > 0) || (last && dx < 0) ? dx / 3 : dx)
  }
  const onUp = () => {
    if (!start.current) return
    const limit = start.current.w * 0.18
    start.current = null
    if (drag < -limit) go(i + 1)
    else if (drag > limit) go(i - 1)
    else setDrag(0)
  }

  return (
    <div class="guide" role="dialog" aria-modal="true" aria-label={w.label}>
      <div class="guide-top">
        <div class="guide-langs" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button aria-pressed={lang === l.id} onClick={() => setLang(l.id)} lang={l.id}>{l.label}</button>
          ))}
        </div>
        {!last && <button class="guide-skip" onClick={finish}>{w.skip}</button>}
      </div>

      <div class="guide-viewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
        <div class={`guide-track ${drag ? 'dragging' : ''}`} style={{ transform: `translateX(calc(${-i * 100}% + ${drag}px))` }}>
          {GUIDE_CARDS.map((id, n) => (
            <section class={`guide-card ${n === i ? 'on' : ''}`} aria-hidden={n !== i} key={id} lang={lang}>
              <Scene id={id} />
              {n === 0 && <p class="guide-hello">{w.hello}</p>}
              <h2 class="guide-title">{w.cards[id].title}</h2>
              <p class="guide-body">{w.cards[id].body}</p>
              <MiniTabs lit={GUIDE_TAB[id]} />
              {id === 'yours' && <p class="guide-again">{w.again}</p>}
            </section>
          ))}
        </div>
      </div>

      <div class="guide-foot">
        <button class="guide-back" onClick={() => go(i - 1)} style={{ visibility: i === 0 ? 'hidden' : 'visible' }}>{w.back}</button>
        <div class="guide-dots" aria-label={w.of.replace('{n}', String(i + 1)).replace('{t}', String(GUIDE_CARDS.length))}>
          {GUIDE_CARDS.map((id, n) => <button aria-label={w.cards[id].title} class={n === i ? 'on' : ''} onClick={() => go(n)} />)}
        </div>
        <button class="guide-next" onClick={() => (last ? finish() : go(i + 1))}>{last ? w.start : w.next}</button>
      </div>
    </div>
  )
}

/** The five tabs, small, with this card's one lit, so people learn where it lives. */
function MiniTabs({ lit }: { lit: keyof typeof TAB_ICON }) {
  return (
    <div class="guide-tabs" aria-hidden="true">
      {TABS.map((t) => {
        const Icon = TAB_ICON[t]
        return <span class={t === lit ? 'lit' : ''}><Icon size={20} /></span>
      })}
    </div>
  )
}

/** A small moving picture for each card. Still when the device asks for less motion. */
function Scene({ id }: { id: GuideCardId }) {
  return (
    <div class={`guide-scene scene-${id}`} aria-hidden="true">
      <div class="scene-ring" />
      {id === 'prayer' && <>
        <span class="scene-orbit"><span class="sun" /></span>
        <TabPrayer size={78} class="scene-icon" />
      </>}
      {id === 'looks' && <>
        <span class="scene-phone">{LOOKS.map((src, n) => <img src={src} alt="" style={{ animationDelay: `${n * 1.6}s` }} />)}</span>
        <span class="scene-badge"><Palette size={26} strokeWidth={1.8} /></span>
      </>}
      {id === 'alerts' && <>
        <BellRing size={70} class="scene-icon bell" strokeWidth={1.6} />
        <span class="scene-badge"><AlarmClock size={26} strokeWidth={1.8} /></span>
      </>}
      {id === 'qibla' && <>
        <TabQibla size={92} class="scene-icon needle" />
        <span class="scene-glow" />
      </>}
      {id === 'masjid' && <>
        <TabMasjid size={84} class="scene-icon" />
        <span class="scene-pin"><MapPin size={30} strokeWidth={2} /></span>
      </>}
      {id === 'travel' && <>
        <span class="scene-plane"><Plane size={30} strokeWidth={1.8} /></span>
        <TabJourney size={74} class="scene-icon bag" />
      </>}
      {id === 'falak' && (
        <svg class="scene-falak" viewBox="0 0 120 120" width="120" height="120">
          <g class="sun-arc"><circle cx="60" cy="22" r="8" /></g>
          <line x1="12" y1="92" x2="108" y2="92" class="ground" />
          <line x1="60" y1="92" x2="104" y2="92" class="shadow" />
          <line x1="60" y1="92" x2="60" y2="62" class="stick" />
        </svg>
      )}
      {id === 'yours' && <>
        <TabSettings size={80} class="scene-icon gear" />
        <span class="scene-badge"><CalendarDays size={26} strokeWidth={1.8} /></span>
      </>}
    </div>
  )
}
