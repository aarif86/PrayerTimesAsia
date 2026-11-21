import { useEffect, useMemo, useState } from 'preact/hooks'

/** The main site's night sky: soft glows, twinkling stars and the odd shooting star. Light mode keeps only warm glows. */
export function Sky() {
  const stars = useMemo(() => Array.from({ length: 70 }, () => ({
    left: `${(Math.random() * 100).toFixed(2)}%`, top: `${(Math.random() * 100).toFixed(2)}%`,
    d: `${(3 + Math.random() * 5).toFixed(1)}s`, delay: `${(-Math.random() * 8).toFixed(1)}s`, big: Math.random() < 0.2,
  })), [])
  return (
    <div class="sp-sky" aria-hidden="true">
      <div class="glow g1" /><div class="glow g2" /><div class="glow g3" />
      {stars.map((s, i) => <i key={i} class={`star${s.big ? ' big' : ''}`} style={{ left: s.left, top: s.top, '--d': s.d, '--delay': s.delay }} />)}
      <div class="shoot s1" /><div class="shoot s2" />
    </div>
  )
}

/** The same light or dark choice as the main site (same key, same origin), else the device's setting. */
const THEME_KEY = 'pta-theme'
export type Theme = 'light' | 'dark'
function startTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'light' || t === 'dark') return t
  } catch { /* private mode */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** The page's light or dark look, shared with the main site, and a way to switch it. */
export function useSiteTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(startTheme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.add('is-setup')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F2EEE9' : '#0b0f2a')
    return () => { document.documentElement.classList.remove('is-setup') }
  }, [theme])
  const flip = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    try { localStorage.setItem(THEME_KEY, next) } catch { /* private mode */ }
    setTheme(next)
  }
  return [theme, flip]
}

/** The sun and moon button from the main site. */
export function ModeButton({ theme, onClick }: { theme: Theme; onClick: () => void }) {
  return (
    <button type="button" class="sp-mode" onClick={onClick} aria-label="Switch between light and dark">
      {theme === 'light'
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
        : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a.7.7 0 0 0-.9-.8A9.9 9.9 0 1 0 21.3 15.1a.7.7 0 0 0-.8-.9z" /></svg>}
    </button>
  )
}
