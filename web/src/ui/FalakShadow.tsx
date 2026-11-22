import { useEffect, useRef, useState } from 'preact/hooks'
import { Camera, Smartphone, X } from 'lucide-preact'
import * as Falak from '../core/falak'
import { zoned } from '../core/tz'
import { appLocale, tr } from '../core/appWords'
import { needsOrientationPermission, requestOrientationPermission } from '../services/sensors'
import { store, useNow, useStore } from '../services/store'
import { closeSheet, Sheet } from './common'
import { Hadith } from './Hadith'

/**
 * Falak for everyone: find Asr with your own shadow. Shadow steps (walk heel
 * to toe and compare with today's number) and the shadow camera (point the
 * phone at your shadow, tap its head). Both work with no signal.
 */

function today(now: number) {
  const place = store.activePlace!
  const z = zoned(now, store.timeZone)
  const plan = Falak.shadowDay(z.year, z.month, z.day, place.coordinates)
  const school = store.asrSchool
  const target = Falak.asrSteps(plan, school)
  const asrAt = school === 'hanafi' ? plan.asrHanafi : plan.asrShafii
  return { place, plan, target, asrAt }
}

/** 8.5 → 8½, the way people say it. */
export const stepsText = (n: number) => { const h = Falak.halfSteps(n); const whole = Math.floor(h); return `${whole ? whole.toLocaleString(appLocale()) : ''}${h % 1 ? '½' : ''}` || '0' }

export function ShadowStepsSheet() {
  useStore()
  const now = useNow(60_000)
  if (!store.activePlace) return null
  const { place, target } = today(now)
  const asr = store.name('asr')
  return (
    <Sheet title={tr('falak.stepsTitle')} full>
      <div class="steps-hero">
        <div class="secondary">{tr('falak.stepsLead', { name: asr })}</div>
        <div class="steps-n mono">{stepsText(target)}<span>{tr('falak.stepsUnit')}</span></div>
        <div class="secondary">{tr('falak.stepsToday', { place: place.name })}</div>
      </div>
      <div class="group steps-list">
        {[
          [tr('falak.step1'), tr('falak.step1Sub')],
          [tr('falak.step2'), tr('falak.step2Sub')],
          [tr('falak.step3'), tr('falak.step3Sub')],
          [tr('falak.step4', { n: stepsText(target) }), tr('falak.step4Sub', { name: asr })],
        ].map(([t, sub], i) => (
          <div class="item"><span class="step-num">{i + 1}</span><span class="label">{t}<span class="sub">{sub}</span></span></div>
        ))}
      </div>
      <StepsPicture target={target} />
      <p class="group-foot">{tr('falak.stepsWhy')}</p>
      <div style={{ marginTop: '16px' }}><Hadith id="falakFeet" variant="line" /></div>
      <p class="falak-foot">{tr('falak.lookGround')}</p>
    </Sheet>
  )
}

function StepsPicture({ target }: { target: number }) {
  const n = Math.min(16, Math.ceil(target))
  const w = 26, x0 = 52, end = x0 + w * target
  return (
    <svg class="steps-pic" viewBox={`0 0 ${Math.max(343, end + 40)} 110`} aria-hidden="true">
      <line x1="24" y1="84" x2={Math.max(319, end + 20)} y2="84" stroke="currentColor" stroke-opacity=".25" />
      <g fill="currentColor"><circle cx="40" cy="34" r="6" /><rect x="36" y="42" width="8" height="26" rx="4" /><rect x="36" y="66" width="3" height="18" rx="1.5" /><rect x="41" y="66" width="3" height="18" rx="1.5" /></g>
      <path d={`M40 84 L${end} 86 L${end} 89 L40 87Z`} fill="currentColor" opacity=".18" />
      {Array.from({ length: n }, (_, i) => <rect x={x0 + i * w} y="92" width={Math.min(22, (target - i) * w - 4)} height="6" rx="3" fill="var(--gold)" />)}
      <circle cx={end} cy="86" r="5" fill="#30D158" />
      <text x={end} y="72" fill="#30D158" font-size="12" font-weight="600" text-anchor="middle">{stepsText(target)}</text>
    </svg>
  )
}

// ---- Shadow camera -----------------------------------------------------------

/** Vertical field of view of the shown camera picture, roughly, in a phone held upright. */
const V_FOV = 60
const GLOW = 'url(#sc-glow)'

/**
 * The phone's front-to-back tilt (90 = upright), all the shadow camera needs.
 * No compass, so it works on phones without one.
 */
function useTilt() {
  const [state, setState] = useState<'starting' | 'needs-permission' | 'active' | 'unavailable' | 'denied'>(needsOrientationPermission() ? 'needs-permission' : 'starting')
  const [beta, setBeta] = useState<number | null>(null)
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') { setState('unavailable'); return }
    if (needsOrientationPermission() && !granted) return
    let got = false
    const on = (e: DeviceOrientationEvent) => { if (e.beta != null) { got = true; setBeta(e.beta); setState('active') } }
    window.addEventListener('deviceorientation', on)
    const timer = setTimeout(() => { if (!got) setState('unavailable') }, 3000)
    return () => { clearTimeout(timer); window.removeEventListener('deviceorientation', on) }
  }, [granted])
  return { state, beta, enable: async () => { if (await requestOrientationPermission()) { setGranted(true); setState('starting') } else setState('denied') } }
}

function buzz(pattern: number[]) { try { navigator.vibrate?.(pattern) } catch { /* no vibration */ } }
function say(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = appLocale(); u.rate = 0.95
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  } catch { /* no voice */ }
}

export function ShadowCamera() {
  useStore()
  const video = useRef<HTMLVideoElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting')
  const [size, setSize] = useState({ w: 375, h: 812 })
  const compass = useTilt()
  const now = useNow(15_000)
  /** The tapped head of the shadow, as degrees below the horizon. */
  const [tapped, setTapped] = useState<number | null>(null)
  const announced = useRef<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    if (!navigator.mediaDevices?.getUserMedia) { setCamera('off'); return }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; void video.current.play() } setCamera('on') })
      .catch(() => setCamera('off'))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const place = store.activePlace
  const { target, asrAt, plan } = place ? today(now) : { target: 1, asrAt: null, plan: null }
  const asr = store.name('asr')
  const { w, h } = size
  const focal = (h / 2) / Math.tan((V_FOV / 2) * Math.PI / 180)
  // Phone upright (beta 90) looks at the horizon; tilted forward it looks down.
  const pitch = compass.beta == null ? null : Math.min(89, Math.max(1, 90 - compass.beta))
  const yFor = (depression: number) => pitch == null ? null : h / 2 + focal * Math.tan((depression - pitch) * Math.PI / 180)
  const lineY = yFor(Falak.depressionTo(Falak.CHEST_HEIGHT, target / Falak.FEET_PER_BODY))
  const headY = tapped == null ? null : yFor(tapped)
  const reading = tapped == null || !place ? null : Falak.cameraReading(tapped, now, place.coordinates, store.timeZone, store.asrSchool)
  const morning = plan != null && now < plan.noon
  const begun = reading?.asrBegun === true

  useEffect(() => {
    if (!reading || reading.asrBegun == null) return
    const key = `${reading.asrBegun}`
    if (announced.current === key) return
    announced.current = key
    if (reading.asrBegun) { buzz([220, 120, 220]); say(tr('falak.camSayBegun', { name: asr })) } else { buzz([40]); say(tr('falak.camSayNotYet')) }
  }, [reading?.asrBegun, tapped])

  if (!place || !plan) return null
  const onTap = (e: MouseEvent) => {
    if (pitch == null || !box.current) return
    const r = box.current.getBoundingClientRect()
    const y = e.clientY - r.top
    const dep = pitch + Math.atan((y - h / 2) / focal) * 180 / Math.PI
    if (dep > 1) { announced.current = null; setTapped(dep) }
  }

  const sunAlt = Falak.sunPosition(now, place.coordinates).altitude
  const progress = reading ? Math.min(1, reading.steps / target) : 0
  const minsLeft = asrAt != null ? Math.max(0, Math.round((asrAt - now) / 60_000)) : null
  const status = morning ? tr('falak.camMorning') : begun ? tr('falak.camBegun', { name: asr }) : tr('falak.camNotYet')
  const glow = begun ? '#30D158' : '#fff'
  return (
    <div class="shadow-cam" ref={box} onClick={onTap}>
      <video ref={video} playsInline muted class="ar-video" />
      <div class="shadow-cam-dim" />
      {camera !== 'on' && <div class="ar-fallback"><Camera size={44} /><div class="headline">{camera === 'starting' ? tr('falakTools.starting') : tr('falakTools.noCamera')}</div></div>}
      <svg class="shadow-cam-marks" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <defs><filter id="sc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter></defs>
        {lineY != null && lineY > 0 && lineY < h && <g>
          <line x1="24" y1={lineY} x2={w - 24} y2={lineY} stroke={glow} stroke-width="12" filter={GLOW} opacity=".9" />
          <line x1="24" y1={lineY} x2={w - 24} y2={lineY} stroke="#fff" stroke-width="4" stroke-linecap="round" />
          <text x="28" y={lineY - 12} fill="#fff" font-size="13" font-weight="600" letter-spacing=".5">{asr.toUpperCase()}</text>
        </g>}
        {headY != null && headY > 0 && headY < h && <g>
          <circle cx={w / 2} cy={headY} r="18" fill="none" stroke={glow} stroke-width="10" filter={GLOW} opacity=".8" />
          <circle cx={w / 2} cy={headY} r="18" fill="none" stroke="#fff" stroke-width="3" />
          <circle cx={w / 2} cy={headY} r="3" fill="#fff" />
        </g>}
      </svg>
      <button class="round-btn sc-close glass-dark" aria-label={tr('common.close')} onClick={(e) => { e.stopPropagation(); closeSheet() }}><X size={18} /></button>
      {reading && sunAlt > 2 && <div class={`sc-pill ${begun ? 'begun' : 'glass-dark'}`} role="status">
        {!begun && <span class="dot" style={{ background: morning ? '#8E8E93' : '#FF9F0A' }} />}{begun && '✓ '}{status}
      </div>}
      <div class="sc-sheet glass-dark" onClick={(e) => e.stopPropagation()}>
        {compass.state === 'needs-permission' ? <>
          <div class="sc-k">{tr('falak.camNeedMotion')}</div>
          <button class="primary-btn" onClick={() => void compass.enable()}>{tr('falak.camAllow')}</button>
        </> : compass.state === 'unavailable' || compass.state === 'denied' ? <div class="sc-k">{tr('falak.camNoMotion')}</div>
        : sunAlt <= 2 ? <>
          <div class="sc-big" style={{ fontSize: '24px' }}>{tr('falak.sunBelow')}</div>
          <div class="sc-scale">{tr('falak.camAfterSunrise')}</div>
        </> : !reading ? <ol class="sc-how">
          <li>{tr('falak.camHow1')}</li><li>{tr('falak.camHow2')}</li><li>{tr('falak.camHow3')}</li>
        </ol> : morning ? <>
          <div class="sc-k">{tr('falak.camYourShadow')}</div>
          <div class="sc-big">{tr('falak.camMorning')}</div>
          <div class="sc-scale">{tr('falak.camMorningSub', { time: store.formatted(plan.noon) })}</div>
        </> : <>
          <div class="sc-k">{tr('falak.camYourShadow')}</div>
          <div class="sc-big mono">{(Math.round(reading.steps * 10) / 10).toLocaleString(appLocale())} <span>{tr('falak.camOf', { n: stepsText(target) })}</span></div>
          <div class="sc-bar"><i style={{ width: `${progress * 100}%`, background: begun ? '#30D158' : '#FF9F0A' }} /></div>
          <div class="sc-scale"><span>{tr('falak.camNoon')}</span><span>{begun
            ? tr('falak.camTimetable', { time: store.day(now) ? store.formatted(store.day(now)!.times.asr) : '' })
            : minsLeft ? tr('falak.camInAbout', { name: asr, n: minsLeft }) : ''}</span></div>
          <div class="sc-hint"><Smartphone size={15} />{begun ? tr('falak.camDoneHint') : tr('falak.camWaitHint', { name: asr })}</div>
          <div class="sc-hint">{tr('falak.camRetap')}</div>
        </>}
        <div class="sc-foot">{tr('falak.camEstimate')} {tr('falak.lookGround')}</div>
      </div>
    </div>
  )
}
