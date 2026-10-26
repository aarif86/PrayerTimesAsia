import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

/**
 * Gives its children `--h` and `--w` (1% of its own height and width, in px)
 * and a portrait/landscape class, so the screen lays out the same on a TV and
 * inside the setup page's preview. Plain JS rather than container units, which
 * older TV browsers lack.
 */
export function Frame({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const portrait = size.h > size.w * 1.05
  return (
    <div ref={ref} class={`frame ${portrait ? 'portrait' : 'landscape'} ${cls}`}
      style={{ '--h': `${size.h / 100}px`, '--w': `${size.w / 100}px` }}>
      {size.w > 0 && children}
    </div>
  )
}
