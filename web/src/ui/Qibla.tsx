import { useEffect, useRef, useState } from 'preact/hooks'
import { Check, Compass as CompassIcon, Map as MapIcon, Navigation2, Sun, TriangleAlert } from 'lucide-preact'
import { fix } from '../core/astro'
import { angleDelta, compassPoint, distanceKm, KAABA, qiblaBearing } from '../core/geo'
import { useCompass } from '../services/sensors'
import { useStore } from '../services/store'
import { Kaaba } from './icons'
import { QiblaMapButton } from './QiblaMap'
import { tr } from '../core/appWords'

/** Lights up inside 4°, goes out past 6°, so it doesn't flicker at the edge. */
const ENTER = 4, LEAVE = 6

export function QiblaScreen() {
  const s = useStore()
  const place = s.activePlace
  const demoAligned = !!s.demo?.aligned
  const compass = useCompass(!demoAligned)
  const [aligned, setAligned] = useState(false)
  const dial = useRef<{ heading: number; last: number | null }>({ heading: 0, last: null })
  const bearing = place ? qiblaBearing(place.coordinates) : 0
  const heading = !place ? null : demoAligned ? bearing : compass.heading
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
      try { navigator.vibrate?.(30) } catch { /* not supported */ }
    }
  }, [delta == null ? null : Math.round(delta * 10)])
  if (!place) return <div class="page"><p class="headline" style={{ textAlign: 'center', marginTop: '40vh' }}>{tr('qibla.choosePlace')}</p></div>
  const isAligned = demoAligned || aligned
  const instruction = delta == null ? `Face ${Math.round(bearing)}° from north`
    : isAligned ? "You're facing the Qibla" : delta > 0 ? `Turn right ${Math.round(Math.abs(delta))}°` : `Turn left ${Math.round(Math.abs(delta))}°`
  // Spoken in steps of 10 degrees, so a screen reader is not interrupted at every degree.
  const step = delta == null ? 0 : Math.max(10, Math.round(Math.abs(delta) / 10) * 10)
  const spoken = delta == null ? instruction
    : isAligned ? instruction : `${delta > 0 ? 'Turn right' : 'Turn left'}, about ${step}°`
  const hasCompass = demoAligned || compass.state === 'active'
  // iPhone Safari only shares the compass after a tap, so the tap goes first and big.
  const askFirst = compass.state === 'needs-permission' && !demoAligned
  const turnOn = () => void compass.enable()

  return (
    <div class="page qibla">
      <div class="qibla-head">
        <h1 class="h-title">{tr('qibla.title')}</h1>
        <div class={`qibla-instruction ${isAligned ? 'ok' : ''}`} aria-hidden="true">{instruction}</div>
        <span class="sr-only" aria-live="polite">{spoken}</span>
        {askFirst && (
            <button class="compass-on" onClick={turnOn}>
              <CompassIcon size={26} />
              <span class="compass-on-text">
                <span class="compass-on-title">Turn on the compass</span>
                <span class="compass-on-line">Tap here, then press Allow</span>
              </span>
            </button>
        )}
        <button class="chip" onClick={() => s.setTab('falak')} aria-label="Falak Mode: find the qibla from the sun"><Sun size={15} fill="currentColor" />{tr('qibla.checkSun')}</button>
      </div>
      <QiblaDial bearing={bearing} heading={heading != null ? dial.current.heading : 0} delta={delta} aligned={isAligned} onTap={askFirst ? turnOn : undefined} />
      <div class="glass card stats">
        <Stat label={tr('qibla.title')} value={`${Math.round(bearing)}° ${compassPoint(bearing)}`} />
        <span class="vline" />
        <Stat label={tr('qibla.facing')} value={heading != null ? `${Math.round(fix(heading, 360))}° ${compassPoint(heading)}` : '-'} />
        <span class="vline" />
        <Stat label={tr('qibla.toMakkah')} value={`${Math.round(distanceKm(place.coordinates, KAABA)).toLocaleString('en')} km`} />
      </div>
      <div class="glass card steps">
        <div class="headline" style={{ marginBottom: '12px' }}>{tr('qibla.howTo')}</div>
        {askFirst && (
          <Step icon={<CompassIcon size={20} class="gold" />}>
            Your browser asks first before it shares the compass. Tap <b>Turn on the compass</b> at the top, then press <b>Allow</b>. The dial then turns with your phone.
          </Step>
        )}
        {(compass.state === 'unavailable' || compass.state === 'denied') && !demoAligned && (
          <>
            <Step icon={<MapIcon size={20} class="gold" />}>
              {compass.state === 'denied' ? tr('qibla.notAllowed') : tr('qibla.noCompass')} Use the qibla bearing above with a map,
              or the sun in Falak. Stand facing {Math.round(bearing)}° ({compassPoint(bearing)}). For example, line yourself up with the gold line on the map.
            </Step>
            <div style={{ marginTop: '12px' }}><QiblaMapButton /></div>
          </>
        )}
        {(hasCompass || askFirst || compass.state === 'starting') && (
          <>
            <Step icon={<Num n={1} />}>{tr('qibla.step1')}</Step>
            <Step icon={<Num n={2} />}>{tr('qibla.step2')}</Step>
            <Step icon={<Num n={3} />}>When the dial turns green{('vibrate' in navigator) ? ' and your phone taps' : ''}, you're facing the qibla.</Step>
            {!demoAligned && compass.state === 'active' && (compass.accuracy == null ? false : compass.accuracy < 0 || compass.accuracy > 25) && (
              <Step icon={<TriangleAlert size={20} style={{ color: 'var(--warning)' }} />}>
                The compass needs calibrating: wave your phone in a figure-8 a few times, away from cars, laptops and magnetic cases.
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
    <div class="stat">
      <div class="stat-label">{label}</div>
      <div class="stat-value display mono">{value}</div>
    </div>
  )
}

/** How wide the navy compass ring is, in px. The N E S W letters and the Ka'bah marker sit on it. */
export const BEZEL = 58

/**
 * The app icon's compass ring: navy, a faint fine-line kawung batik and cream
 * hand-stitching along both edges. Solid navy under the letters keeps them readable
 * in Light and Dark and on every sky.
 */
function Bezel({ size }: { size: number }) {
  const half = size / 2, outer = half - 3, inner = half - BEZEL
  const band = `M${half - outer},${half}a${outer},${outer} 0 1,0 ${2 * outer},0a${outer},${outer} 0 1,0 ${-2 * outer},0z`
    + `M${half - inner},${half}a${inner},${inner} 0 1,0 ${2 * inner},0a${inner},${inner} 0 1,0 ${-2 * inner},0z`
  return (
    <svg class="bezel" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <pattern id="kawung" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45) scale(0.45)">
          <g fill="none" stroke="#FFFFFF" stroke-width="1.8">
            <ellipse cx="20" cy="10" rx="5.6" ry="9.2" /><ellipse cx="20" cy="30" rx="5.6" ry="9.2" />
            <ellipse cx="10" cy="20" rx="9.2" ry="5.6" /><ellipse cx="30" cy="20" rx="9.2" ry="5.6" />
          </g>
          <circle cx="20" cy="20" r="1.8" fill="#FFFFFF" />
        </pattern>
      </defs>
      <circle cx={half} cy={half} r={outer + 1.5} fill="none" stroke="#F2EEE9" stroke-width="3" />
      <path d={band} fill-rule="evenodd" fill="#262B5E" />
      <path d={band} fill-rule="evenodd" fill="url(#kawung)" opacity="0.2" />
      <g fill="none" stroke="#F2E6CF" stroke-opacity="0.5" stroke-width="1.4" stroke-dasharray="4 3.2" stroke-linecap="round">
        <circle cx={half} cy={half} r={outer - 5} /><circle cx={half} cy={half} r={inner + 5} />
      </g>
    </svg>
  )
}

/** The dial turns with the phone so the Ka'bah marker always sits at the true qibla. */
function QiblaDial({ bearing, heading, delta, aligned, onTap }: { bearing: number; heading: number; delta: number | null; aligned: boolean; onTap?: () => void }) {
  const size = Math.min(320, (typeof window !== 'undefined' ? Math.min(window.innerWidth, 480) : 393) - 80)
  const half = size / 2
  const ticks = []
  for (let i = 0; i < 72; i++) {
    const major = i % 18 === 0, mid = i % 6 === 0
    ticks.push(<line x1={half} y1={14 - (mid ? 6 : 3)} x2={half} y2={14 + (mid ? 6 : 3)} stroke="#FFFFFF"
      stroke-opacity={major ? 0.9 : mid ? 0.55 : 0.25} stroke-width={mid ? 2 : 1} stroke-linecap="round" transform={`rotate(${i * 5} ${half} ${half})`} />)
  }
  return (
    <div class={`qibla-dial ${aligned ? 'aligned' : ''}`} style={{ width: `${size}px`, height: `${size}px` }} role="img" aria-label={aligned ? tr('qibla.facingQibla') : tr('qibla.compass')}>
      <span class="top-marker" />
      <div class="face" />
      {aligned && <span class="ripple" />}
      <div class="rotor" style={{ transform: `rotate(${-heading}deg)` }}>
        <Bezel size={size} />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">{ticks}</svg>
        {['N', 'E', 'S', 'W'].map((l, i) => (
          <span class={`cardinal ${i === 0 ? 'north' : ''}`} style={{ transform: `rotate(${i * 90}deg) translateY(${-half + 38}px) rotate(${-i * 90 + heading}deg)` }}>{l}</span>
        ))}
        <div class="pointer" style={{ transform: `rotate(${bearing}deg)` }}>
          <span class="beam" style={{ height: `${size * 0.14}px`, transform: `translate(-50%, ${-size * 0.29 - size * 0.07}px)` }} />
          <span class="kaaba-marker" style={{ transform: `translate(-50%, -50%) translateY(${-size * 0.40}px) rotate(${-bearing + heading}deg)` }}>
            <Kaaba size={30} />
          </span>
        </div>
      </div>
      <svg class="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={half} cy={half} r={half - 3} fill="none" stroke="var(--green)" stroke-width="5" stroke-dasharray={`${Math.PI * 2 * (half - 3)}`}
          stroke-dashoffset={aligned ? 0 : Math.PI * 2 * (half - 3)} transform={`rotate(-90 ${half} ${half})`} class="trim" />
      </svg>
      <div class="centre" style={{ width: `${size * 0.42}px`, height: `${size * 0.42}px` }}>
        {aligned
          ? <div class="aligned-mark"><Check size={size * 0.12} strokeWidth={3.2} /><span>{tr('qibla.aligned')}</span></div>
          : delta != null
            ? <Navigation2 size={size * 0.15} class="gold arrow" fill="currentColor" style={{ transform: `rotate(${delta}deg)` }} />
            : <Navigation2 size={size * 0.08} style={{ opacity: 0.6 }} />}
      </div>
      {onTap && (
        // A plain tap area for fingers only: the big "Turn on the compass" button above is
        // the one keyboard and screen reader users reach, and a button inside role="img" is not allowed.
        <div class="centre centre-tap" aria-hidden="true" style={{ width: `${size * 0.42}px`, height: `${size * 0.42}px` }} onClick={onTap}>
          <CompassIcon size={size * 0.1} />
          <span>Tap to start</span>
        </div>
      )}
    </div>
  )
}

