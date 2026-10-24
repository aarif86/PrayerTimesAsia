import { useEffect, useRef, useState } from 'preact/hooks'
import { Check, Compass as CompassIcon, Map as MapIcon, Navigation2, Sun, TriangleAlert } from 'lucide-preact'
import { fix } from '../core/astro'
import { angleDelta, compassPoint, distanceKm, KAABA, qiblaBearing } from '../core/geo'
import { useCompass } from '../services/sensors'
import { useStore } from '../services/store'
import { Kaaba } from './icons'
import { QiblaMapButton } from './QiblaMap'

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
  if (!place) return <div class="page"><p class="headline" style={{ textAlign: 'center', marginTop: '40vh' }}>Choose a place to find the qibla.</p></div>
  const isAligned = demoAligned || aligned
  const instruction = delta == null ? `Face ${Math.round(bearing)}° from north`
    : isAligned ? "You're facing the Qibla" : delta > 0 ? `Turn right ${Math.round(Math.abs(delta))}°` : `Turn left ${Math.round(Math.abs(delta))}°`
  const hasCompass = demoAligned || compass.state === 'active'

  return (
    <div class="page qibla">
      <div class="qibla-head">
        <h1 class="h-title">Qibla</h1>
        <div class={`qibla-instruction ${isAligned ? 'ok' : ''}`} aria-live="polite">{instruction}</div>
        <button class="chip" onClick={() => s.setTab('falak')} aria-label="Falak Mode: find the qibla from the sun"><Sun size={15} fill="currentColor" />Check with the sun</button>
      </div>
      <QiblaDial bearing={bearing} heading={heading != null ? dial.current.heading : 0} delta={delta} aligned={isAligned} />
      <div class="glass card stats">
        <Stat label="Qibla" value={`${Math.round(bearing)}° ${compassPoint(bearing)}`} />
        <span class="vline" />
        <Stat label="You're facing" value={heading != null ? `${Math.round(fix(heading, 360))}° ${compassPoint(heading)}` : '-'} />
        <span class="vline" />
        <Stat label="To Makkah" value={`${Math.round(distanceKm(place.coordinates, KAABA)).toLocaleString('en')} km`} />
      </div>
      <div class="glass card steps">
        <div class="headline" style={{ marginBottom: '12px' }}>How to find the qibla</div>
        {compass.state === 'needs-permission' && !demoAligned && (
          <div class="step">
            <CompassIcon size={20} class="gold" />
            <div style={{ flex: 1 }}>
              <div class="subhead">This browser asks before it shares the compass.</div>
              <button class="primary-btn" style={{ marginTop: '10px' }} onClick={() => void compass.enable()}>Use the compass</button>
            </div>
          </div>
        )}
        {(compass.state === 'unavailable' || compass.state === 'denied') && !demoAligned && (
          <>
            <Step icon={<MapIcon size={20} class="gold" />}>
              {compass.state === 'denied' ? 'Compass access was not allowed.' : 'This device or browser has no compass.'} Use the qibla bearing above with a map,
              or the sun in Falak. Stand facing {Math.round(bearing)}° ({compassPoint(bearing)}) - for example, line yourself up with the gold line on the map.
            </Step>
            <div style={{ marginTop: '12px' }}><QiblaMapButton /></div>
          </>
        )}
        {(hasCompass || compass.state === 'starting') && (
          <>
            <Step icon={<Num n={1} />}>Hold your phone flat in front of you, screen facing up.</Step>
            <Step icon={<Num n={2} />}>Turn your whole body slowly until the Ka'bah reaches the marker at the top.</Step>
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

/** The dial turns with the phone so the Ka'bah marker always sits at the true qibla. */
function QiblaDial({ bearing, heading, delta, aligned }: { bearing: number; heading: number; delta: number | null; aligned: boolean }) {
  const size = Math.min(320, (typeof window !== 'undefined' ? Math.min(window.innerWidth, 480) : 393) - 80)
  const half = size / 2
  const ticks = []
  for (let i = 0; i < 72; i++) {
    const major = i % 18 === 0, mid = i % 6 === 0
    ticks.push(<line x1={half} y1={14 - (mid ? 6 : 3)} x2={half} y2={14 + (mid ? 6 : 3)} stroke="var(--fg)"
      stroke-opacity={major ? 0.9 : mid ? 0.55 : 0.25} stroke-width={mid ? 2 : 1} stroke-linecap="round" transform={`rotate(${i * 5} ${half} ${half})`} />)
  }
  return (
    <div class={`qibla-dial ${aligned ? 'aligned' : ''}`} style={{ width: `${size}px`, height: `${size}px` }} role="img" aria-label={aligned ? 'Facing the qibla' : 'Qibla compass'}>
      <span class="top-marker" />
      <div class="face" />
      {aligned && <span class="ripple" />}
      <svg class="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={half} cy={half} r={half - 3} fill="none" stroke="var(--green)" stroke-width="5" stroke-dasharray={`${Math.PI * 2 * (half - 3)}`}
          stroke-dashoffset={aligned ? 0 : Math.PI * 2 * (half - 3)} transform={`rotate(-90 ${half} ${half})`} class="trim" />
      </svg>
      <div class="rotor" style={{ transform: `rotate(${-heading}deg)` }}>
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
      <div class="centre" style={{ width: `${size * 0.42}px`, height: `${size * 0.42}px` }}>
        {aligned
          ? <div class="aligned-mark"><Check size={size * 0.12} strokeWidth={3.2} /><span>Aligned</span></div>
          : delta != null
            ? <Navigation2 size={size * 0.15} class="gold arrow" fill="currentColor" style={{ transform: `rotate(${delta}deg)` }} />
            : <Navigation2 size={size * 0.08} style={{ opacity: 0.6 }} />}
      </div>
    </div>
  )
}

