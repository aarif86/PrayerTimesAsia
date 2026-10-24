import { useEffect, useRef, useState } from 'preact/hooks'

/**
 * Compass and motion from the browser. iPhone Safari asks permission (from a
 * tap) and gives webkitCompassHeading; Android Chrome gives an absolute alpha
 * through 'deviceorientationabsolute'. Desktops usually have neither.
 */
type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number }
type PermissionAPI = { requestPermission?: () => Promise<'granted' | 'denied'> }

export type SensorState = 'starting' | 'needs-permission' | 'active' | 'unavailable' | 'denied'

export const needsOrientationPermission = () =>
  typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as unknown as PermissionAPI).requestPermission === 'function'

export const needsMotionPermission = () =>
  typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as unknown as PermissionAPI).requestPermission === 'function'

export async function requestOrientationPermission(): Promise<boolean> {
  try {
    const api = DeviceOrientationEvent as unknown as PermissionAPI
    const res = await api.requestPermission?.()
    return res === 'granted'
  } catch { return false }
}

export async function requestMotionPermission(): Promise<boolean> {
  try {
    const api = DeviceMotionEvent as unknown as PermissionAPI
    const res = await api.requestPermission?.()
    return res === 'granted'
  } catch { return false }
}

function screenAngle(): number {
  const a = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number
  return Number.isFinite(a) ? a : 0
}

export interface Compass {
  state: SensorState
  /** Degrees clockwise from true north (magnetic on some devices), or null. */
  heading: number | null
  /** ± degrees, when the device reports it (iPhone). */
  accuracy: number | null
  /** Device tilt front-to-back, degrees (90 = upright). */
  beta: number | null
  enable: () => Promise<void>
}

export function useCompass(active = true): Compass {
  const [state, setState] = useState<SensorState>(needsOrientationPermission() ? 'needs-permission' : 'starting')
  const [heading, setHeading] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [beta, setBeta] = useState<number | null>(null)
  const [granted, setGranted] = useState(false)
  const got = useRef(false)

  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') { setState('unavailable'); return }
    if (needsOrientationPermission() && !granted) { setState('needs-permission'); return }
    const onIOS = (e: IOSOrientationEvent) => {
      if (e.beta != null) setBeta(e.beta)
      if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
        got.current = true
        setHeading((e.webkitCompassHeading + screenAngle()) % 360)
        setAccuracy(typeof e.webkitCompassAccuracy === 'number' ? e.webkitCompassAccuracy : null)
        setState('active')
      }
    }
    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (e.beta != null) setBeta(e.beta)
      if (e.alpha == null) return
      got.current = true
      setHeading(((360 - e.alpha) + screenAngle()) % 360)
      setState('active')
    }
    const hasAbsolute = 'ondeviceorientationabsolute' in window
    if (hasAbsolute) window.addEventListener('deviceorientationabsolute', onAbsolute as EventListener)
    else window.addEventListener('deviceorientation', onIOS as EventListener)
    const timer = setTimeout(() => { if (!got.current) setState('unavailable') }, 2500)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('deviceorientationabsolute', onAbsolute as EventListener)
      window.removeEventListener('deviceorientation', onIOS as EventListener)
    }
  }, [active, granted])

  return {
    state, heading, accuracy, beta,
    enable: async () => {
      const ok = await requestOrientationPermission()
      if (ok) { setGranted(true); setState('starting') } else setState('denied')
    },
  }
}

export interface Motion {
  state: SensorState
  /** Gravity, normalised, in the device frame (x right, y up the screen, z out of the screen). */
  g: { x: number; y: number; z: number } | null
  enable: () => Promise<void>
}

/** Gravity from DeviceMotion, sign-normalised so a phone lying face up reads z = -1 (as Core Motion). */
export function useMotion(active = true): Motion {
  const [state, setState] = useState<SensorState>(needsMotionPermission() ? 'needs-permission' : 'starting')
  const [g, setG] = useState<Motion['g']>(null)
  const [granted, setGranted] = useState(false)
  const got = useRef(false)
  useEffect(() => {
    if (!active) return
    if (typeof DeviceMotionEvent === 'undefined') { setState('unavailable'); return }
    if (needsMotionPermission() && !granted) { setState('needs-permission'); return }
    // iOS reports acceleration with the opposite sign to the spec (and Android).
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const sign = ios ? 1 : -1
    let last = 0
    const on = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      const t = performance.now()
      if (t - last < 33) return
      last = t
      const n = Math.hypot(a.x, a.y, a.z) || 1
      got.current = true
      setG({ x: (sign * a.x) / n, y: (sign * a.y) / n, z: (sign * a.z) / n })
      setState('active')
    }
    window.addEventListener('devicemotion', on)
    const timer = setTimeout(() => { if (!got.current) setState('unavailable') }, 2500)
    return () => { clearTimeout(timer); window.removeEventListener('devicemotion', on) }
  }, [active, granted])
  return {
    state, g,
    enable: async () => {
      const ok = await requestMotionPermission()
      if (ok) { setGranted(true); setState('starting') } else setState('denied')
    },
  }
}
