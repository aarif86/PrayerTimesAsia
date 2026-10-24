import type { JSX } from 'preact'

/** The app's own outline icon set (24 pt, 1.6 pt stroke), the same SVGs as the iOS tab bar. */
type P = { size?: number; class?: string; style?: JSX.CSSProperties }

const svg = (size: number, cls: string | undefined, style: JSX.CSSProperties | undefined, children: JSX.Element | JSX.Element[]) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class={cls} style={style} aria-hidden="true">
    {children}
  </svg>
)

export const TabPrayer = ({ size = 24, class: c, style }: P) => svg(size, c, style, [
  <rect x="5" y="2" width="14" height="17.5" rx="1.8" />,
  <path d="M8.6 15.5V10.2a3.4 3.4 0 0 1 6.8 0V15.5" />,
  <path d="M8.6 15.5h6.8" />,
  <path d="M7.5 19.5v2.6M10 19.5v2.6M12.5 19.5v2.6M15 19.5v2.6M17 19.5v2.6" stroke-width="1.3" />,
])

export const TabQibla = ({ size = 24, class: c, style }: P) => svg(size, c, style, [
  <circle cx="12" cy="12" r="9.3" />,
  <path d="M12 5.8l2.3 6.2-2.3 6.2-2.3-6.2z" />,
  <path d="M12 5.8l2.3 6.2h-4.6z" fill="currentColor" />,
])

export const TabFalak = ({ size = 24, class: c, style }: P) => svg(size, c, style, [
  <g transform="rotate(-28 12 9)">
    <rect x="5.2" y="7" width="11.5" height="4.2" rx="1" />
    <rect x="16.7" y="6" width="2.8" height="6.2" rx="0.9" />
    <rect x="2.6" y="7.9" width="2.6" height="2.4" rx="0.6" />
  </g>,
  <path d="M11.6 12.4L7.2 21.6M11.6 12.4l4.4 9.2M11.6 12.4v9.2" />,
  <path d="M4 2.2v3M2.5 3.7h3" stroke-width="1.3" />,
])

export const TabMasjid = ({ size = 24, class: c, style }: P) => svg(size, c, style, [
  <path d="M6.2 13.2C6.2 9.6 9 7.8 12 5.8c3 2 5.8 3.8 5.8 7.4" />,
  <path d="M12 5.8V3.4" />,
  <path d="M4.8 13.2h14.4v7.3H4.8z" />,
  <path d="M10.4 20.5v-2.9a1.6 1.6 0 0 1 3.2 0v2.9" />,
  <path d="M2.8 20.5h18.4" />,
  <circle cx="12" cy="2.6" r="0.5" fill="currentColor" />,
])

export const TabJourney = ({ size = 24, class: c, style }: P) => svg(size, c, style, [
  <path d="M12 2.4c.9 0 1.5 1 1.5 2.1v5.2l7.2 4.1v2l-7.2-2.1v4.1l2.1 1.6v1.6L12 20l-3.6 1v-1.6l2.1-1.6v-4.1l-7.2 2.1v-2l7.2-4.1V4.5c0-1.1.6-2.1 1.5-2.1z" />,
])

/** Filled gear for the Settings tab, like SF Symbols' gearshape.fill. */
export const TabSettings = ({ size = 24, class: c, style }: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" class={c} style={style} aria-hidden="true">
    <path fill="currentColor" fill-rule="evenodd" d="M10.3 1.6h3.4l.55 2.6c.6.2 1.17.44 1.7.74l2.24-1.45 2.4 2.4-1.45 2.24c.3.53.55 1.1.74 1.7l2.6.55v3.4l-2.6.55c-.2.6-.44 1.17-.74 1.7l1.45 2.24-2.4 2.4-2.24-1.45c-.53.3-1.1.55-1.7.74l-.55 2.6h-3.4l-.55-2.6a8 8 0 0 1-1.7-.74l-2.24 1.45-2.4-2.4 1.45-2.24a8 8 0 0 1-.74-1.7l-2.6-.55v-3.4l2.6-.55c.2-.6.44-1.17.74-1.7L3.36 5.9l2.4-2.4L8 4.95c.53-.3 1.1-.55 1.7-.74zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z" />
  </svg>
)

/** A simple cube with the gold band, drawn so it scales crisply (KaabaGlyph). */
export const Kaaba = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
    <rect x="0.75" y="0.75" width="28.5" height="28.5" rx="3.6" fill="#141419" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" />
    <rect x="1.5" y="7.8" width="27" height="3.6" fill="#F2C766" />
  </svg>
)
