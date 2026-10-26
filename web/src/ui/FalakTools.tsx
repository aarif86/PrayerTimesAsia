import { useEffect, useRef, useState } from 'preact/hooks'
import { Camera, X } from 'lucide-preact'
import { fix } from '../core/astro'
import * as Falak from '../core/falak'
import { qiblaBearing } from '../core/geo'
import { useCompass, useMotion } from '../services/sensors'
import { store, useNow } from '../services/store'
import { closeSheet, Segmented, Sheet } from './common'

/**
 * Falak through the camera: on the floor in front of you, a virtual tongkat
 * istiwa', the shadow it should cast right now, and the qibla line. The web
 * has no plane detection, so the floor is drawn from the phone's tilt and
 * compass; outdoors in sunshine, real shadows should lie along the dark bar.
 */
export function ARScreen() {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting')
  const compass = useCompass(true)
  const now = useNow(15_000)
  const place = store.activePlace

  useEffect(() => {
    let stream: MediaStream | null = null
    if (!navigator.mediaDevices?.getUserMedia) { setCamera('off'); return }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; void video.current.play() } setCamera('on') })
      .catch(() => setCamera('off'))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  useEffect(() => {
    const el = canvas.current
    if (!el || !place) return
    const dpr = Math.min(devicePixelRatio || 1, 3)
    const w = el.clientWidth, h = el.clientHeight
    el.width = w * dpr; el.height = h * dpr
    const ctx = el.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const heading = compass.heading ?? 0
    // Pitch: 0° camera level (phone upright), 90° straight down (phone flat).
    const pitch = Math.min(85, Math.max(15, 90 - (compass.beta ?? 45)))
    const th = (pitch * Math.PI) / 180
    const camH = 1.3, focal = (w / 2) / Math.tan((32 * Math.PI) / 180)
    const project = (x: number, yUp: number, z: number): [number, number] | null => {
      const py = yUp - camH
      const f = -py * Math.sin(th) + z * Math.cos(th)
      const u = py * Math.cos(th) + z * Math.sin(th)
      if (f <= 0.05) return null
      return [w / 2 + (focal * x) / f, h / 2 - (focal * u) / f]
    }
    const base = { x: 0, z: camH / Math.tan(th) } // the floor point the camera centre looks at
    const along = (bearing: number, len: number) => {
      const a = ((bearing - heading) * Math.PI) / 180
      return { x: base.x + Math.sin(a) * len, z: base.z + Math.cos(a) * len }
    }
    const line = (pts: { x: number; z: number; y?: number }[], color: string, width: number) => {
      const p = pts.map((q) => project(q.x, q.y ?? 0, q.z))
      if (p.some((q) => !q)) return
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(p[0]![0], p[0]![1]); for (const q of p.slice(1)) ctx.lineTo(q![0], q![1]); ctx.stroke()
    }
    const qibla = qiblaBearing(place.coordinates)
    const sun = Falak.sunPosition(now, place.coordinates)
    const q = along(qibla, 1.2)
    line([base, q], 'rgba(255, 214, 128, 0.95)', 6)
    const qp = project(q.x, 0.03, q.z)
    if (qp) { ctx.fillStyle = '#141419'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.fillRect(qp[0] - 9, qp[1] - 9, 18, 18); ctx.strokeRect(qp[0] - 9, qp[1] - 9, 18, 18); ctx.fillStyle = '#F2C766'; ctx.fillRect(qp[0] - 9, qp[1] - 5, 18, 3) }
    if (sun.altitude > 1) {
      const len = Math.min(2, Falak.shadowLength(0.3, sun.altitude))
      line([base, along(fix(sun.azimuth + 180, 360), len)], 'rgba(0, 0, 0, 0.6)', 10)
    }
    line([{ ...base, y: 0 }, { ...base, y: 0.3 }], '#fff', 5)
  }, [compass.heading == null ? null : Math.round(compass.heading), compass.beta == null ? null : Math.round(compass.beta), now, camera])

  return (
    <div class="ar-screen">
      <video ref={video} playsInline muted class="ar-video" />
      {camera !== 'on' && <div class="ar-fallback"><Camera size={44} /><div class="headline">{camera === 'starting' ? 'Starting the camera…' : 'Camera not available'}</div>
        {camera === 'off' && <div class="footnote" style={{ opacity: 0.8 }}>This view draws the qibla and the stick's shadow over the camera. Allow the camera, or use the compass and the cards on the Falak tab.</div>}</div>}
      <canvas ref={canvas} class="ar-canvas" />
      <button class="round-btn ar-close" aria-label="Close" onClick={closeSheet}><X size={20} /></button>
      <div class="ar-legend glass">
        <div class="subhead" style={{ fontWeight: 600 }}>Point the camera at the floor in front of you.</div>
        {compass.state === 'needs-permission' && <button class="primary-btn" onClick={() => void compass.enable()}>Use the compass</button>}
        {compass.state === 'unavailable' && <div class="footnote" style={{ color: 'var(--warning)' }}>No compass on this device: the lines can't turn with you.</div>}
        <div class="footnote gold">━ Gold line: the qibla</div>
        <div class="footnote">━ Dark bar: where a stick's shadow falls right now</div>
        <div class="caption" style={{ opacity: 0.85 }}>Outdoors in sunshine, real shadows should lie along the dark bar. If they don't, move away from metal and wave the phone in a figure-8 to recalibrate the compass. Never look at the sun.</div>
      </div>
    </div>
  )
}

/**
 * A spirit level for the shadow stick. Lay the phone flat to check the ground;
 * stand it on its edge against the stick to check the stick is vertical.
 */
export function LevelSheet() {
  const motion = useMotion(true)
  const [mode, setMode] = useState<'flat' | 'upright'>('flat')
  let tilt = 0, bx = 0, by = 0
  const g = motion.g
  if (g) {
    if (mode === 'flat') {
      tilt = (Math.acos(Math.min(1, Math.max(-1, -g.z))) * 180) / Math.PI
      bx = Math.max(-1, Math.min(1, -g.x * 4)); by = Math.max(-1, Math.min(1, g.y * 4))
    } else {
      tilt = (Math.acos(Math.min(1, Math.max(-1, -g.y))) * 180) / Math.PI
      bx = Math.max(-1, Math.min(1, -g.x * 4)); by = Math.max(-1, Math.min(1, g.z * 4))
    }
  }
  const available = motion.state === 'active'
  const level = available && tilt < 0.5
  useEffect(() => { if (level) { try { navigator.vibrate?.(20) } catch { /* ignore */ } } }, [level])
  return (
    <Sheet title="Level" full>
      <div class="level">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'flat', label: 'Ground (phone flat)' }, { value: 'upright', label: 'Stick (phone upright)' }]} />
        <div class="bubble-box">
          <span class="ring-inner" />
          <span class={`bubble ${level ? 'ok' : ''}`} style={{ transform: `translate(${bx * 110}px, ${by * 110}px)` }} />
        </div>
        <div class="display mono" style={{ fontSize: '54px', fontWeight: 700 }}>{available ? `${tilt.toFixed(1)}°` : '-'}</div>
        <div class="headline" style={{ color: level ? 'var(--green)' : 'var(--fg)', textAlign: 'center' }}>
          {motion.state === 'needs-permission' ? 'This browser asks before sharing motion.'
            : available ? (level ? 'Level - good for a reading' : 'Not level yet - adjust until the bubble turns green')
              : motion.state === 'starting' ? 'Waiting for the motion sensor…' : 'This device has no motion sensor.'}
        </div>
        {motion.state === 'needs-permission' && <button class="primary-btn" onClick={() => void motion.enable()}>Use motion sensor</button>}
        <p class="footnote" style={{ textAlign: 'center', opacity: 0.75 }}>
          {mode === 'flat' ? 'Lay the phone flat where the stick will stand. Within 0.5° is good.' : "Hold the phone's long edge against the stick. Within 0.5° of vertical is good."}
          {' '}A tilt of 1° moves a 1 m stick's shadow tip by about 1.7 cm - enough to shift a reading by a minute.
        </p>
      </div>
    </Sheet>
  )
}
