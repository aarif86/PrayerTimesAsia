import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/nunito/wght.css'
import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { zoned } from '../core/tz'
import { ensureTable } from '../services/officialTables'
import { readJSON, writeJSON } from '../services/storage'
import { registerServiceWorker } from '../ui/pwa'
import { configFromHash, DEFAULT_CONFIG, encodeConfig, EXAMPLE_PLACE, sanitize, type ScreenConfig } from './config'
import { Display } from './Display'
import { Frame } from './Frame'
import { officialSourceForScreen, WORDS } from './model'
import { Setup } from './Setup'
import './screen.css'

const STORAGE = 'ptasia.screen'

/** Screenshot mode: ?demo (an example masjid) and ?now=2026-10-26T16:30:00%2B08:00 (a fixed clock). */
const query = new URLSearchParams(location.search)
const fixedNow = (() => { const t = Date.parse(query.get('now') ?? ''); return Number.isNaN(t) ? null : t })()

export const DEMO_CONFIG: ScreenConfig = {
  ...DEFAULT_CONFIG,
  name: 'Masjid Al-Example',
  place: EXAMPLE_PLACE,
  jumuah: '13:00',
  notices: ['Kuliah Maghrib every Tuesday · Example notice', 'Please keep the corridors clear for wheelchairs · Example notice'],
}

function initialConfig(): ScreenConfig | null {
  // ?demo&look=day&lang=ms for screenshots of each variation.
  if (query.has('demo')) return sanitize({ ...DEMO_CONFIG, look: query.get('look'), lang: query.get('lang') ?? 'en', names: query.get('names') ?? DEMO_CONFIG.names })
  const fromLink = configFromHash(location.hash)
  if (fromLink) { writeJSON(STORAGE, fromLink); return fromLink }
  const saved = readJSON<unknown>(STORAGE)
  return saved ? sanitize(saved) : null
}

function useClock(): number {
  const [now, setNow] = useState(fixedNow ?? Date.now())
  useEffect(() => {
    if (fixedNow != null) return
    // Tick on the second boundary so the countdown never skips a number.
    let id: ReturnType<typeof setTimeout>
    const tick = () => { setNow(Date.now()); id = setTimeout(tick, 1000 - (Date.now() % 1000) + 5) }
    tick()
    return () => clearTimeout(id)
  }, [])
  return now
}

function App() {
  const [config, setConfig] = useState<ScreenConfig | null>(initialConfig)
  const [editing, setEditing] = useState(() => !config || location.hash.includes('setup') || query.has('setup'))
  const now = useClock()

  if (editing || !config) {
    return <Setup initial={config ?? DEFAULT_CONFIG} now={now} onOpen={(c) => {
      writeJSON(STORAGE, c)
      history.replaceState(null, '', `${location.pathname}${location.search}#c=${encodeConfig(c)}`)
      setConfig(c)
      setEditing(false)
    }} />
  }
  return <Screen config={config} now={now} onEdit={() => { history.replaceState(null, '', `${location.pathname}#setup`); setEditing(true) }} />
}

function Screen({ config, now, onEdit }: { config: ScreenConfig; now: number; onEdit: () => void }) {
  const [, setTables] = useState(0)
  const [pointer, setPointer] = useState(true)
  const w = WORDS[config.lang]

  // The official table: this year's, and next year's from December. Retried every 6 hours while missing.
  useEffect(() => {
    const source = officialSourceForScreen(config)
    if (!source || !config.place) return
    const tz = config.place.tz
    const fetchTables = () => {
      const z = zoned(Date.now(), tz)
      for (const y of z.month === 12 ? [z.year, z.year + 1] : [z.year]) {
        ensureTable(source, y, tz).then((changed) => { if (changed) setTables((n) => n + 1) })
      }
    }
    fetchTables()
    const id = setInterval(fetchTables, 6 * 3_600_000)
    return () => clearInterval(id)
  }, [config])

  // Keep the TV awake where the browser allows it; ask again when the page comes back.
  useEffect(() => {
    type Lock = { release: () => Promise<void> }
    let lock: Lock | null = null
    const request = () => {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock
      if (document.visibilityState === 'visible' && wl) wl.request('screen').then((l) => { lock = l }).catch(() => undefined)
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => { document.removeEventListener('visibilitychange', request); lock?.release().catch(() => undefined) }
  }, [])

  // A quiet reload at 3 am picks up app updates and clears any slow memory growth (signage practice).
  useEffect(() => {
    if (fixedNow != null || !config.place) return
    const id = setInterval(() => {
      const z = zoned(Date.now(), config.place!.tz)
      if (z.hour === 3 && z.minute === 0 && navigator.onLine) location.reload()
    }, 30_000)
    return () => clearInterval(id)
  }, [config])

  // OK on a TV remote (Enter) or a click: full screen. The edit button shows only when a mouse moves.
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout>
    const full = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') full() }
    const move = () => { setPointer(true); clearTimeout(hide); hide = setTimeout(() => setPointer(false), 6000) }
    move()
    window.addEventListener('keydown', key)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', move)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', move); clearTimeout(hide) }
  }, [])

  // Burn-in: drift a few pixels every three minutes, as signage players do.
  const step = Math.floor(now / 180_000) % 8
  const shift = [[0, 0], [1, 1], [2, 0], [1, -1], [0, -2], [-1, -1], [-2, 0], [-1, 1]][step]
  const arabicTurn = Math.floor(now / 8000) % 2 === 1

  return (
    <div class="screen-page" onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) document.documentElement.requestFullscreen?.().catch(() => undefined) }}>
      <Frame class="screen-frame">
        <div class="screen-shift" style={{ transform: `translate(${shift[0] * 0.1}%, ${shift[1] * 0.1}%)` }}>
          <Display config={config} now={now} arabicTurn={arabicTurn} />
        </div>
      </Frame>
      {pointer && fixedNow == null && (
        <div class="screen-tools">
          <span>{w.fullScreen}</span>
          <button type="button" onClick={onEdit}>{w.edit}</button>
        </div>
      )}
    </div>
  )
}

render(<App />, document.getElementById('app')!)
registerServiceWorker()
