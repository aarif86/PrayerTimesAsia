import { useEffect, useRef } from 'preact/hooks'
import { css, darkness, daylight, softNight, type SkyColors } from './sky'

/** A fixed field of stars that fades in as the sky darkens (StarField). */
function Stars({ opacity }: { opacity: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const w = canvas.clientWidth, h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)
      // Same LCG as the iOS StarField, so the sky has the same stars.
      let seed = 0x9E3779B97F4A7C15n
      const mask = (1n << 64n) - 1n
      const next = () => {
        seed = (seed * 6364136223846793005n + 1442695040888963407n) & mask
        return Number(seed >> 33n) / 2 ** 31
      }
      // Keep the field phone-sized and centred on wide screens.
      const fieldW = Math.min(w, 520), x0 = (w - fieldW) / 2
      for (let pass = 0; pass < (w > 700 ? 3 : 1); pass++) {
        const off = pass === 0 ? x0 : pass === 1 ? x0 - fieldW : x0 + fieldW
        for (let i = 0; i < 90; i++) {
          const x = off + next() * fieldW
          const y = Math.pow(next(), 1.6) * h * 0.7
          const r = 0.4 + next() * 1.1
          const a = 0.25 + next() * 0.6
          ctx.fillStyle = `rgba(255,255,255,${a})`
          ctx.beginPath()
          ctx.arc(x + r, y + r, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])
  return <canvas ref={ref} class="stars" style={{ opacity }} />
}

function Cloud({ width, speed, y, phase, color }: { width: number; speed: number; y: number; phase: number; color: string }) {
  const vw = typeof window !== 'undefined' ? Math.min(window.innerWidth, 560) : 400
  const span = vw + width * 2
  const duration = span / speed
  return (
    <div class="cloud" style={{
      top: `${y - width * 0.2}px`, width: `${width}px`, height: `${width * 0.5}px`, color,
      '--from': `${-width}px`, '--to': `${vw + width}px`,
      animationDuration: `${duration}s`, animationDelay: `${-phase * duration}s`,
    }}>
      <i style={{ left: 0, top: `${width * 0.12}px`, width: `${width}px`, height: `${width * 0.32}px` }} />
      <i style={{ left: `${width * 0.105}px`, top: `${width * -0.02}px`, width: `${width * 0.55}px`, height: `${width * 0.36}px` }} />
      <i style={{ left: `${width * 0.455}px`, top: `${width * 0.05}px`, width: `${width * 0.45}px`, height: `${width * 0.3}px` }} />
    </div>
  )
}

/** Light appearance only: a softly breathing sun (or moon after dark) and slow clouds. */
function BrightSky({ isDay, glow }: { isDay: boolean; glow: string }) {
  const core = isDay ? 'rgb(255, 219, 140)' : 'rgb(219, 224, 255)'
  const coreA = (a: number) => (isDay ? `rgba(255, 219, 140, ${a})` : `rgba(219, 224, 255, ${a})`)
  const rays = Array.from({ length: 8 }, (_, i) => `${coreA(0.16)} ${i * 45}deg, transparent ${i * 45 + 22.5}deg`).join(', ')
  return (
    <div class="bright">
      <div class="orb">
        <div class="halo" style={{ background: `radial-gradient(circle, ${coreA(isDay ? 0.55 : 0.4)} 3%, ${glow} 40%, transparent 70%)` }} />
        {isDay && <div class="rays" style={{ background: `conic-gradient(${rays}, ${coreA(0.16)} 360deg)` }} />}
        <div class="core" style={{ background: `radial-gradient(circle, #fff 5%, ${core} 100%)`, boxShadow: `0 0 24px 6px ${coreA(0.8)}` }} />
      </div>
      <Cloud width={220} speed={7} y={170} phase={0} color={`rgba(255,255,255,${isDay ? 0.55 : 0.25})`} />
      <Cloud width={150} speed={4.5} y={300} phase={0.45} color={`rgba(255,255,255,${isDay ? 0.55 : 0.25})`} />
      <Cloud width={260} speed={5.5} y={520} phase={0.8} color={`rgba(255,255,255,${isDay ? 0.55 : 0.25})`} />
    </div>
  )
}

/** The Living Sky behind every tab: the sky outside, right now. */
export function LivingSky({ colors, scheme, soft }: { colors: SkyColors; scheme: 'light' | 'dark'; soft: boolean }) {
  const shown = scheme === 'light' ? daylight(colors) : soft ? softNight(colors) : colors
  const dark = darkness(colors)
  return (
    <div class="sky" aria-hidden="true" style={{ background: `linear-gradient(180deg, ${css(shown.top)} 0%, ${css(shown.bottom)} 100%)` }}>
      {scheme === 'dark'
        ? <Stars opacity={dark * (soft ? 0.6 : 1)} />
        : <BrightSky isDay={dark < 0.5} glow={css(shown.glow, 0.18)} />}
      <div class="horizon" style={{ background: `radial-gradient(circle, ${css(shown.glow, 0.35)} 0%, transparent 70%)` }} />
    </div>
  )
}
