import { useEffect, useRef, useState } from 'preact/hooks'
import { BellRing, CircleDot, Palette, Pointer, Printer } from 'lucide-preact'
import { GUIDE_CARDS, GUIDE_STEPS, guideLang, guideWord, type GuideCardId } from '../core/guideWords'
import { lang3, type Lang3 } from '../core/ramadanContent'
import { navigatorLocale, store } from '../services/store'
import { TabFalak, TabJourney, TabMasjid, TabPrayer, TabQibla, TabSettings } from './icons'

/** Real app screens for the little phone, by name (made by scripts/guide-shots.mjs). */
const SHOTS = Object.fromEntries(Object.entries(import.meta.glob('../assets/guide/steps/*.webp', { eager: true, import: 'default' }))
  .map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url as string]))

const LANGS: { id: Lang3; label: string }[] = [{ id: 'en', label: 'EN' }, { id: 'ms', label: 'BM' }, { id: 'id', label: 'ID' }]
/** The icon on each feature's tab along the bottom. */
const FEATURE_ICON = {
  prayer: TabPrayer, buttons: CircleDot, looks: Palette, alerts: BellRing, qibla: TabQibla, masjid: TabMasjid,
  travel: TabJourney, falak: TabFalak, print: Printer, yours: TabSettings,
} satisfies Record<GuideCardId, unknown>
type Say = (k: Parameters<typeof guideWord>[1], a?: Record<string, number>) => string

/**
 * The quick guide: nine swipe cards a new user sees once, right after choosing
 * their location. Each card is a small phone showing the real app, with a finger
 * that taps the exact button. Skip at any time; Settings opens it again.
 */
export function Guide({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState<Lang3>(() => guideLang(lang3(store.naming), navigatorLocale()))
  const [i, setI] = useState(0)
  const [drag, setDrag] = useState(0)
  const start = useRef<{ x: number; y: number; w: number; moved: boolean } | null>(null)
  const t: Say = (k, a) => guideWord(lang, k, a)
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
    start.current = { x: e.clientX, y: e.clientY, w: (e.currentTarget as HTMLElement).clientWidth, moved: false }
  }
  const onMove = (e: PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    if (Math.abs(dx) < Math.abs(e.clientY - start.current.y)) return
    if (Math.abs(dx) > 8) start.current.moved = true
    // A little resistance past the first and last card.
    setDrag((i === 0 && dx > 0) || (last && dx < 0) ? dx / 3 : dx)
  }
  const onUp = () => {
    if (!start.current) return
    const limit = start.current.w * 0.18
    swiped.current = start.current.moved
    start.current = null
    if (drag < -limit) go(i + 1)
    else if (drag > limit) go(i - 1)
    else setDrag(0)
  }
  /** A swipe should not also count as a tap on the phone. */
  const swiped = useRef(false)

  return (
    <div class="guide" role="dialog" aria-modal="true" aria-label={t('label')}>
      <div class="guide-top">
        <div class="guide-langs" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button aria-pressed={lang === l.id} onClick={() => setLang(l.id)} lang={l.id}>{l.label}</button>
          ))}
        </div>
        {!last && <button class="guide-skip" onClick={finish}>{t('skip')}</button>}
      </div>

      <div class="guide-viewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
        <div class={`guide-track ${drag ? 'dragging' : ''}`} style={{ transform: `translateX(calc(${-i * 100}% + ${drag}px))` }}>
          {GUIDE_CARDS.map((id, n) => (
            <section class={`guide-card ${n === i ? 'on' : ''}`} aria-hidden={n !== i} key={id} lang={lang}>
              {n === 0 && <p class="guide-hello">{t('hello')}</p>}
              <h2 class="guide-title">{t(`${id}_title`)}</h2>
              {Math.abs(n - i) <= 1
                ? <PhoneDemo id={id} on={n === i} t={t} swiped={swiped} />
                : <div class="guide-demo" />}
            </section>
          ))}
        </div>
      </div>

      <div class="guide-foot">
        <button class="guide-back" onClick={() => go(i - 1)} style={{ visibility: i === 0 ? 'hidden' : 'visible' }}>{t('back')}</button>
        <Features i={i} go={go} t={t} />
        <button class="guide-next" onClick={() => (last ? finish() : go(i + 1))}>{last ? t('start') : t('next')}</button>
      </div>
    </div>
  )
}

/** One named tab per feature along the bottom, so people see what they are learning and can jump to any of it. */
function Features({ i, go, t }: { i: number; go: (n: number) => void; t: Say }) {
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = row.current?.children[i] as HTMLElement | undefined
    if (el && row.current) row.current.scrollTo({ left: el.offsetLeft - (row.current.clientWidth - el.offsetWidth) / 2, behavior: quiet() ? 'auto' : 'smooth' })
  }, [i])
  return (
    <div class="guide-feats" ref={row} role="tablist" aria-label={t('of', { n: i + 1, t: GUIDE_CARDS.length })}>
      {GUIDE_CARDS.map((id, n) => {
        const Icon = FEATURE_ICON[id]
        return (
          <button role="tab" aria-selected={n === i} class={n === i ? 'on' : n < i ? 'seen' : ''} onClick={() => go(n)}>
            <Icon size={16} /><span>{t(`${id}_tab`)}</span>
          </button>
        )
      })}
    </div>
  )
}

const quiet = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A small phone playing the real app: a gold box lights the button, a finger
 * glides to it and taps, and the next screen shows what the tap does. It plays
 * by itself; tapping the phone moves on a step.
 */
function PhoneDemo({ id, on, t, swiped }: { id: GuideCardId; on: boolean; t: Say; swiped: { current: boolean } }) {
  const steps = GUIDE_STEPS[id]
  const [k, setK] = useState(0)
  const [press, setPress] = useState(false)
  const s = steps[k]

  useEffect(() => { if (!on) { setK(0); setPress(false) } }, [on])
  useEffect(() => {
    if (!on) return
    setPress(false)
    const slow = quiet() ? 1.8 : 1
    const tap = s.tap ? setTimeout(() => setPress(true), 1250 * slow) : 0
    const next = setTimeout(() => setK((k + 1) % steps.length), (s.tap ? 2300 : 2700) * slow)
    return () => { clearTimeout(tap); clearTimeout(next) }
  }, [on, k])

  // The fingertip rests just under the box, so the button itself stays in sight;
  // on the tab bar at the very bottom it rests on the button instead.
  const low = s.y + s.h > 0.9
  const cx = (s.x + s.w / 2) * 100, cy = (low ? s.y + s.h / 2 : s.y + s.h) * 100 + (low ? 0 : 0.6)
  const step = () => { if (swiped.current) { swiped.current = false; return } setK((k + 1) % steps.length) }
  return (
    <div class="guide-demo">
      <button class="guide-phone" onClick={step} aria-label={t('next')} tabIndex={on ? 0 : -1}>
        {steps.map((st, n) => (
          <img src={SHOTS[st.shot]} alt="" draggable={false} class={n === k || (n === 0 && !on) ? 'on' : ''} />
        ))}
        <span class={`guide-spot ${press ? 'press' : ''}`} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` }}><i class="guide-ripple" /></span>
        <span class={`guide-finger ${press ? 'press' : ''}`} style={{ left: `${cx}%`, top: `${cy}%` }}>
          <Pointer size={34} strokeWidth={1.6} fill="#fff" />
        </span>
      </button>
      <p class="guide-say" aria-live="polite" key={`${k}-${s.say}`}>{t(s.say)}</p>
      <div class="guide-steps" role="group" aria-label={t('step', { n: k + 1, t: steps.length })}>
        {steps.map((_, n) => (
          <button class={n === k ? 'on' : n < k ? 'seen' : ''} onClick={() => setK(n)} tabIndex={on ? 0 : -1} aria-label={t('step', { n: n + 1, t: steps.length })}>{n + 1}</button>
        ))}
      </div>
    </div>
  )
}
