import { useEffect, useRef, useState } from 'preact/hooks'
import { Check, Compass as CompassIcon, Map as MapIcon, Sun, TriangleAlert } from 'lucide-preact'
import { fix } from '../core/astro'
import { angleDelta, compassPoint, distanceKm, KAABA, qiblaBearing } from '../core/geo'
import { useCompass } from '../services/sensors'
import { useStore } from '../services/store'
import { QiblaMapButton } from './QiblaMap'
import { appLocale, tr, trWith } from '../core/appWords'

/** Lights up inside 4°, goes out past 6°, so it doesn't flicker at the edge. */
const ENTER = 4, LEAVE = 6

export function QiblaScreen() {
  const s = useStore()
  const place = s.activePlace
  const demoAligned = !!s.demo?.aligned
  const demoHeading = s.demo?.heading ?? null
  const compass = useCompass(!demoAligned && demoHeading == null)
  const [aligned, setAligned] = useState(false)
  useEffect(() => { if (compass.state === 'active') s.usageAction('qiblaCompass') }, [compass.state])
  const dial = useRef<{ heading: number; last: number | null }>({ heading: 0, last: null })
  const bearing = place ? qiblaBearing(place.coordinates) : 0
  const heading = !place ? null : demoAligned ? bearing : demoHeading != null ? demoHeading : compass.heading
  const delta = heading != null ? angleDelta(bearing, heading) : null

  // Heading accumulated without wrapping, so crossing north turns the dial a few degrees, not the long way round.
  if (heading != null) {
    const d = dial.current
    d.heading = d.last == null ? heading : d.heading + angleDelta(heading, d.last)
    d.last = heading
  }
  useEffect(() => {
    if (delta == null) { if (aligned) setAligned(false); return }
    if (aligned && Math.abs(delta) > LEAVE) setAligned(false)
    else if (!aligned && Math.abs(delta) < ENTER) {
      setAligned(true)
      s.usageAction('qiblaFaced')
      try { navigator.vibrate?.(30) } catch { /* not supported */ }
    }
  }, [delta == null ? null : Math.round(delta * 10)])
  if (!place) return <div class="page"><p class="headline" style={{ textAlign: 'center', marginTop: '40vh' }}>{tr('qibla.choosePlace')}</p></div>
  const isAligned = demoAligned || aligned
  const instruction = delta == null ? tr('qibla.faceFromNorth', { deg: Math.round(bearing) })
    : isAligned ? tr('qibla.youAreFacing') : tr(delta > 0 ? 'qibla.turnRight' : 'qibla.turnLeft', { deg: Math.round(Math.abs(delta)) })
  // Spoken in steps of 10 degrees, so a screen reader is not interrupted at every degree.
  const step = delta == null ? 0 : Math.max(10, Math.round(Math.abs(delta) / 10) * 10)
  const spoken = delta == null ? instruction
    : isAligned ? instruction : tr(delta > 0 ? 'qibla.turnRightAbout' : 'qibla.turnLeftAbout', { deg: step })
  const hasCompass = demoAligned || demoHeading != null || compass.state === 'active'
  // iPhone Safari only shares the compass after a tap, so the tap goes first and big.
  const askFirst = compass.state === 'needs-permission' && !demoAligned && demoHeading == null
  const turnOn = () => void compass.enable()

  const look = s.prefs.todayStyle
  const rel = bearing - (heading != null ? dial.current.heading : 0)
  const statFacing = heading != null ? `${Math.round(fix(heading, 360))}°` : '…'
  const statQibla = `${Math.round(bearing)}° ${compassPoint(bearing)}`
  const km = Math.round(distanceKm(place.coordinates, KAABA)).toLocaleString(appLocale())
  const toSun = () => s.setTab('falak')
  const dialProps = { H: heading != null ? dial.current.heading : 0, rel, aligned: isAligned }
  const turnWord = delta != null && !isAligned ? tr(delta > 0 ? 'qibla.turnRightWord' : 'qibla.turnLeftWord') : null
  const said = <span class="sr-only" aria-live="polite">{spoken}</span>
  const compassBtn = askFirst && (
    <button class="compass-on" onClick={turnOn}>
      <CompassIcon size={26} />
      <span class="compass-on-text">
        <span class="compass-on-title">{tr('qibla.compassOn')}</span>
        <span class="compass-on-line">{tr('qibla.compassOnLine')}</span>
      </span>
    </button>
  )
  const stats = (
    <div class="q-stats">
      <Stat label={tr('qibla.title')} value={statQibla} />
      <Stat label={tr('qibla.facingShort')} value={statFacing} />
      <Stat label={tr('qibla.toMakkah')} value={tr('common.km', { n: km })} />
    </div>
  )
  const sunBtn = <button class="q-btn" onClick={toSun} aria-label={tr('qibla.falakMode')}><Sun size={20} aria-hidden="true" />{tr('qibla.checkSun')}</button>
  const title = <h1 class="q-title">{tr('qibla.title')}</h1>
  const say = (cls: string, wide = false) => <div class={`q-say ${cls} ${wide ? 'wide' : ''} ${isAligned ? 'ok' : ''}`} aria-hidden="true">{instruction}</div>

  let body: preact.ComponentChildren
  if (look === 'bands') {
    body = (
      <>
        <h1 class="q-band q-band-title" style={{ background: BC[0] }}>{tr('qibla.title')}</h1>
        {say('q-say-bands')}
        {compassBtn}
        <BandsCompass {...dialProps} />
        <div class="q-bandstats">
          {([[tr('qibla.title'), statQibla], [tr('qibla.facingShort'), statFacing], [tr('qibla.toMakkah'), tr('common.km', { n: km })]] as const).map(([a, b], i) => (
            <div class="q-band" style={{ background: BC[i + 1] }}><span class="nm">{a}</span><span class="rd">{b}</span></div>
          ))}
        </div>
      </>
    )
  } else if (look === 'simple') {
    body = (
      <>
        {title}
        {turnWord
          ? <div class={`q-simple-say`} aria-hidden="true"><div class="w">{turnWord}</div><div class="d">{Math.round(Math.abs(delta!))}°</div></div>
          : say('q-say-simple')}
        {compassBtn}
        <SimpleCompass {...dialProps} />
        <div class="q-km">{tr('qibla.kmToMakkah', { km })}</div>
        {sunBtn}
      </>
    )
  } else if (look === 'sunPath') {
    body = (
      <>
        {title}
        {compassBtn}
        <SunCurve rel={delta != null ? delta : angleDelta(bearing, 0)} aligned={isAligned} hasHeading={heading != null} />
        <div class="q-sun-say">
          {say('q-say-sun', heading == null || isAligned)}
          {heading != null && !isAligned && <div class="q-hint">{tr('qibla.sunHint')}</div>}
        </div>
        {stats}
        {sunBtn}
      </>
    )
  } else {
    body = (
      <>
        {title}
        {say(look === 'gold' ? 'q-say-gold' : 'q-say-centre')}
        {compassBtn}
        {look === 'gold' ? <GoldCompass {...dialProps} /> : <BezelCompass {...dialProps} />}
        {stats}
        {sunBtn}
      </>
    )
  }

  return (
    <div class={`page qibla v12s v12q q-${look}`}>
      {said}
      {body}
      <div class="q-card steps">
        <div class="headline" style={{ marginBottom: '12px' }}>{tr('qibla.howTo')}</div>
        {askFirst && (
          <Step icon={<CompassIcon size={20} class="q-ac" />}>
            {trWith('qibla.browserAsksHow', { button: <b>{tr('qibla.compassOn')}</b>, allow: <b>{tr('qibla.allow')}</b> })}
            <div class="caption" style={{ marginTop: '4px', opacity: 0.8 }}>{tr('qibla.whyCompass')} {tr('qibla.whyLocation')}</div>
          </Step>
        )}
        {(compass.state === 'unavailable' || compass.state === 'denied') && !demoAligned && demoHeading == null && (
          <>
            <Step icon={<MapIcon size={20} class="q-ac" />}>
              {compass.state === 'denied' ? tr('qibla.notAllowed') : tr('qibla.noCompass')} {tr('qibla.noCompassHelp', { deg: Math.round(bearing), point: compassPoint(bearing) })}
            </Step>
            <div style={{ marginTop: '12px' }}><QiblaMapButton /></div>
          </>
        )}
        {(hasCompass || askFirst || compass.state === 'starting') && (
          <>
            <Step icon={<Num n={1} />}>{tr('qibla.step1')}</Step>
            <Step icon={<Num n={2} />}>{look === 'sunPath' ? tr('qibla.sunStep2') : tr('qibla.step2')}</Step>
            <Step icon={<Num n={3} />}>{look === 'sunPath'
              ? (('vibrate' in navigator) ? tr('qibla.sunStep3') : tr('qibla.sunStep3NoTap'))
              : (('vibrate' in navigator) ? tr('qibla.step3') : tr('qibla.step3NoTap'))}</Step>
            {!demoAligned && compass.state === 'active' && (compass.accuracy == null ? false : compass.accuracy < 0 || compass.accuracy > 25) && (
              <Step icon={<TriangleAlert size={20} style={{ color: 'var(--warning)' }} />}>
                {tr('qibla.calibrate')}
              </Step>
            )}
            <div style={{ marginTop: '4px' }}><QiblaMapButton /></div>
          </>
        )}
      </div>
    </div>
  )
}

function Num({ n }: { n: number }) {
  return <span class="num-badge">{n}</span>
}

function Step({ icon, children }: { icon: preact.ComponentChildren; children: preact.ComponentChildren }) {
  return <div class="step"><span class="step-icon">{icon}</span><div class="subhead" style={{ flex: 1 }}>{children}</div></div>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div class="q-stat">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  )
}

/* ---------- The five qibla dials, drawn as in the looks mockup ---------- */

/** Colour Bands' six band colours, the same as the Prayer screen. */
const BC = ['#3a6f63', '#8a9a52', '#ab8d3a', '#cd7d38', '#d3705c', '#c9565d']

interface DialProps {
  /** Phone heading, unwrapped so crossing north never spins the long way round. */
  H: number
  /** Qibla minus heading: where the Ka'bah sits from the top of the dial. */
  rel: number
  aligned: boolean
}

/** Dial width: the mockup's size on a phone, smaller on narrow screens. */
function dialSize(max: number, margin: number): number {
  const w = typeof window !== 'undefined' ? Math.min(window.innerWidth, 480) : 393
  return Math.max(220, Math.min(max, w - margin))
}

/** Turns an SVG group about the dial's centre, smoothly. */
const spin = (deg: number, c: number) => ({ transform: `rotate(${deg}deg)`, transformOrigin: `${c}px ${c}px` })
const pol = (c: number, r: number, deg: number): [number, number] => {
  const a = deg * Math.PI / 180
  return [c + Math.sin(a) * r, c - Math.cos(a) * r]
}

/** The Ka'bah: a dark cube with the gold band. */
function KaabaMark({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.14} fill="#111" />
      <rect x={-s / 2} y={-s * 0.22} width={s} height={s * 0.12} fill="#E2B65A" />
    </g>
  )
}

/** A letter that turns with the dial but stays upright. */
function Letter({ c, r, deg, H, t, class: cls, size }: { c: number; r: number; deg: number; H: number; t: string; class?: string; size: number }) {
  const [x, y] = pol(c, r, deg)
  return (
    <g transform={`translate(${x},${y})`}>
      <g class="q-spin" style={{ transform: `rotate(${H}deg)` }}>
        <text class={cls} y={size * 0.36} text-anchor="middle" font-size={size} font-weight="700">{t}</text>
      </g>
    </g>
  )
}

/** Ticks round the edge, longer at N, E, S and W. */
function Ticks({ c, n, len, r, class: cls }: { c: number; n: number; len: number; r: number; class: string }) {
  const out = []
  for (let k = 0; k < n; k++) {
    const L = k % (n / 4) === 0 ? len * 1.7 : len
    const [x1, y1] = pol(c, r, k * 360 / n), [x2, y2] = pol(c, r - L, k * 360 / n)
    out.push(<line x1={x1} y1={y1} x2={x2} y2={y2} class={cls} />)
  }
  return <>{out}</>
}

/** The little bar at the top: the way the phone points. */
const TopMark = () => <span class="q-top" aria-hidden="true" />

function DialBox({ size, aligned, children }: { size: number; aligned: boolean; children: preact.ComponentChildren }) {
  return (
    <div class={`q-dial ${aligned ? 'aligned' : ''}`} style={{ width: `${size}px`, height: `${size}px` }} role="img" aria-label={aligned ? tr('qibla.facingQibla') : tr('qibla.compass')}>
      <TopMark />
      {children}
      {aligned && <div class="q-ok"><Check size={size * 0.1} strokeWidth={3.2} /><span>{tr('qibla.aligned')}</span></div>}
    </div>
  )
}

/** Centre Dial: the navy kawung bezel with the Ka'bah and a glowing arrow. */
function BezelCompass({ H, rel, aligned }: DialProps) {
  const size = dialSize(340, 40), V = 340, c = V / 2
  const [kx, ky] = [c, 46]
  return (
    <DialBox size={size} aligned={aligned}>
      <svg width={size} height={size} viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
        <defs>
          <pattern id="q-kw" width="22" height="22" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#fff" stroke-opacity=".17">
              <circle cx="11" cy="0" r="8" /><circle cx="11" cy="22" r="8" /><circle cx="0" cy="11" r="8" /><circle cx="22" cy="11" r="8" />
            </g>
          </pattern>
          <radialGradient id="q-glow"><stop offset="0" class="q-glow0" /><stop offset="1" class="q-glow1" /></radialGradient>
        </defs>
        <g class="q-spin" style={spin(-H, c)}>
          <circle cx={c} cy={c} r={c - 3} class="q-bez" stroke-width="5" />
          <circle cx={c} cy={c} r={c - 3} fill="url(#q-kw)" />
          <Ticks c={c} n={36} len={7} r={c - 4} class="q-tick-w" />
          <circle cx={c} cy={c} r={c - 62} class="q-face" />
          <circle cx={c} cy={c} r={c - 62} fill="none" stroke="#fff" stroke-opacity=".35" stroke-dasharray="4 4" />
          {['N', 'E', 'S', 'W'].map((t, i) => <Letter c={c} r={c - 40} deg={i * 90} H={H} t={t} class={i === 0 ? 'q-n' : 'q-w'} size={20} />)}
        </g>
        <circle cx={c} cy={c} r={c * 0.34} fill="url(#q-glow)" />
        <g class="q-spin" style={spin(rel, c)}>
          <path d={`M${c} ${c + 4} L${kx} ${ky}`} class="q-arrow" stroke-width="5" stroke-linecap="round" />
          <g transform={`translate(${kx},${ky})`}><g class="q-spin" style={{ transform: `rotate(${-rel}deg)` }}><KaabaMark x={0} y={0} s={36} /></g></g>
        </g>
        <circle cx={c} cy={c} r="9" class="q-arrow-fill" />
      </svg>
    </DialBox>
  )
}

/** Colour Bands: a flat compass cut from the six band colours. */
function BandsCompass({ H, rel, aligned }: DialProps) {
  const size = dialSize(330, 50), V = 330, c = V / 2, R = c - 4, w = 34
  const seg = BC.map((col, k) => {
    const a0 = (k * 60 - 90) * Math.PI / 180, a1 = ((k + 1) * 60 - 90) * Math.PI / 180, r0 = R - w
    const p = (r: number, a: number) => `${c + Math.cos(a) * r} ${c + Math.sin(a) * r}`
    return <path d={`M${p(R, a0)} A${R} ${R} 0 0 1 ${p(R, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`} fill={col} />
  })
  const ky = c - (R - w / 2)
  return (
    <DialBox size={size} aligned={aligned}>
      <svg width={size} height={size} viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
        <g class="q-spin" style={spin(-H, c)}>
          {seg}
          <circle cx={c} cy={c} r={R - w} class="q-card-fill" />
          {['N', 'E', 'S', 'W'].map((t, i) => <Letter c={c} r={R - w - 26} deg={i * 90} H={H} t={t} class={i === 0 ? 'q-n-bands' : 'q-tx'} size={22} />)}
        </g>
        <g class="q-spin" style={spin(rel, c)}>
          <path d={`M${c} ${c} L${c} ${ky}`} class="q-ac-stroke" stroke-width="6" />
          <g transform={`translate(${c},${ky})`}><g class="q-spin" style={{ transform: `rotate(${-rel}deg)` }}><KaabaMark x={0} y={0} s={34} /></g></g>
        </g>
        <circle cx={c} cy={c} r="9" class="q-ac-fill" />
      </svg>
    </DialBox>
  )
}

/** Big and Simple: one big arrow that points at the Ka'bah. */
function SimpleCompass({ H, rel, aligned }: DialProps) {
  const size = dialSize(300, 80), V = 300, c = 150
  return (
    <DialBox size={size} aligned={aligned}>
      <svg width={size} height={size} viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
        <circle cx={c} cy={c} r="140" class="q-simple-ring" stroke-width="3" />
        <g class="q-spin" style={spin(-H, c)}>
          <Letter c={c} r={112} deg={0} H={H} t="N" class="q-n" size={26} />
        </g>
        <g class="q-spin" style={spin(rel, c)}>
          <polygon points="150,52 198,128 168,128 168,236 132,236 132,128 102,128" class="q-ac-fill" />
          <g transform={`translate(${c},${c - 124})`}><g class="q-spin" style={{ transform: `rotate(${-rel}deg)` }}><KaabaMark x={0} y={0} s={50} /></g></g>
        </g>
        <circle cx={c} cy={c} r="12" fill="#fff" class="q-ac-stroke" stroke-width="5" />
      </svg>
    </DialBox>
  )
}

/** Calm Gold: a thin gold ring, fine ticks and a gold Ka'bah mark. */
function GoldCompass({ H, rel, aligned }: DialProps) {
  const size = dialSize(330, 50), V = 330, c = V / 2
  return (
    <DialBox size={size} aligned={aligned}>
      <svg width={size} height={size} viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
        <circle cx={c} cy={c} r={c * 0.94} class="q-ac-fill" opacity=".07" />
        <circle cx={c} cy={c} r={c * 0.8} fill="none" class="q-ac-stroke" stroke-width="3" />
        <g class="q-spin" style={spin(-H, c)}>
          <Ticks c={c} n={72} len={4} r={c - 4} class="q-tick-g" />
          <Letter c={c} r={c * 0.8 - 26} deg={0} H={H} t="N" class="q-tx2" size={22} />
        </g>
        <g class="q-spin" style={spin(rel, c)}>
          <path d={`M${c} ${c + 30} L${c} ${c - 60}`} class="q-ac-stroke" stroke-width="4" stroke-linecap="round" />
          <g transform={`translate(${c},30)`}><g class="q-spin" style={{ transform: `rotate(${-rel}deg)` }}>
            <rect x="-16" y="-16" width="32" height="32" rx="8" class="q-ac-fill" />
            <path d="M-8 0h16" class="q-gold-band" stroke-width="3" stroke-linecap="round" />
          </g></g>
        </g>
      </svg>
    </DialBox>
  )
}

/** Sun Path: the sun moves along the day's curve; turn until it reaches the Ka'bah. */
function SunCurve({ rel, aligned, hasHeading }: { rel: number; aligned: boolean; hasHeading: boolean }) {
  const y = (x: number) => 164 - 40 * Math.cos(Math.PI * (x - 208) / 196)
  const kx = 195
  // Steep near the Ka'bah, and still moving all the way out to half a turn, so the sun never looks stuck.
  const off = Math.min(180, Math.abs(rel)) / 180
  const sx = kx - Math.sign(rel) * 181 * (1 - (1 - off) ** 2)
  let d = ''
  for (let x = -10; x <= 400; x += 5) d += `${x === -10 ? 'M' : 'L'}${x} ${y(x).toFixed(1)}`
  let seg = ''
  const [a, b] = sx < kx ? [sx, kx] : [kx, sx]
  for (let x = a; x <= b; x += 4) seg += `${x === a ? 'M' : 'L'}${x} ${y(x).toFixed(1)}`
  seg += `L${b} ${y(b).toFixed(1)}`
  return (
    <div class={`q-suncurve ${aligned ? 'aligned' : ''}`} role="img" aria-label={aligned ? tr('qibla.facingQibla') : tr('qibla.compass')}>
      <svg viewBox="0 70 390 150" width="100%" aria-hidden="true" style={{ display: 'block' }}>
        <defs><radialGradient id="q-sg"><stop offset="0" stop-color="#FFD98A" stop-opacity=".8" /><stop offset="1" stop-color="#FFD98A" stop-opacity="0" /></radialGradient></defs>
        <line x1="0" y1="164" x2="390" y2="164" class="q-horizon" />
        <path d={d} fill="none" class="q-curve" stroke-width="2.5" stroke-linecap="round" />
        {!aligned && <path d={seg} fill="none" class="q-ac-stroke" stroke-width="3.5" stroke-linecap="round" />}
        <circle cx={kx} cy={y(kx)} r="7" fill="none" class="q-tx-stroke" stroke-width="2.5" />
        <KaabaMark x={kx} y={y(kx) - 30} s={34} />
        <g class="q-sun" style={{ transform: `translate(${sx}px, ${y(sx)}px)` }}>
          <circle r="30" fill="url(#q-sg)" />
          <circle r="9" fill="#fff" />
          <text y="34" text-anchor="middle" font-size="12" font-weight="600" class="q-tx2">{hasHeading ? tr('qibla.youFaceHere') : tr('qibla.northHere')}</text>
        </g>
      </svg>
    </div>
  )
}
