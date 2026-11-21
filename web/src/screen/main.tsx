import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/nunito/wght.css'
import '../ui/flags.css'
import { render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { zoned } from '../core/tz'
import { ensureTable } from '../services/officialTables'
import { readJSON, readString, writeJSON, writeString } from '../services/storage'
import { countScreenRunning, SCREEN_EVERY_MS } from '../services/usage'
import { registerServiceWorker } from '../ui/pwa'
import { configFromHash, decodeConfig, DEFAULT_CONFIG, encodeConfig, EXAMPLE_PLACE, isTvHash, looksLikeTv, pairCodeFromHash, sanitize, shortCodeFromHash, type ScreenConfig } from './config'
import { Display } from './Display'
import { withPlace } from './place'
import { Frame } from './Frame'
import { officialSourceForScreen, setScreenAnnouncements, setScreenClock, WORDS } from './model'
import type { CalendarDataset } from '../core/calendarSanad'
import { fetchOK } from '../services/storage'
import { Setup } from './Setup'
import { PAIR_KEY, PAIR_SYNC_MS, PairScreen, type TvPair } from './pair'
import { loadShortLink, pairSync, checkClock, CLOCK_WARN_MS, nextClockFix, PING_EVERY_MS, pingScreen, saveClockFix, savedClockFix } from './live'
import { withBundled } from '../core/bundledCalendar'
import './screen.css'

const STORAGE = 'ptasia.screen'
/** The short code the saved settings came from, so a new code on the link means fetching again. */
const CODE_KEY = 'ptasia.screen.code'
const SCREEN_VERSION = '1.0.0'

/** Screenshot mode: ?demo (an example masjid) and ?now=2026-10-26T16:30:00%2B08:00 (a fixed clock). */
const query = new URLSearchParams(location.search)
const fixedNow = (() => { const t = Date.parse(query.get('now') ?? ''); return Number.isNaN(t) ? null : t })()
if (fixedNow != null) setScreenClock(() => fixedNow)

/** Ramadan and Raya announcements: the saved copy at once, then the latest every 15 minutes (moon sighting nights). */
const CALENDAR_URL = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/data/calendar.json'
setScreenAnnouncements(withBundled(readJSON<CalendarDataset>('ptasia.calendar')).announcements, withBundled(readJSON<CalendarDataset>('ptasia.calendar')).month_starts ?? [])
async function refreshAnnouncements(): Promise<boolean> {
  if (query.has('demo')) return false
  const r = await fetchOK(CALENDAR_URL)
  if (!r) return false
  try {
    const data = (await r.json()) as CalendarDataset
    if (!Array.isArray(data.announcements)) return false
    writeJSON('ptasia.calendar', data)
    setScreenAnnouncements(data.announcements, withBundled(data).month_starts ?? [])
    return true
  } catch { return false }
}

export const DEMO_CONFIG: ScreenConfig = {
  ...DEFAULT_CONFIG,
  name: 'Masjid Al-Example',
  place: EXAMPLE_PLACE,
  jumuah: '13:00',
  notices: ['Kuliah Maghrib every Tuesday · Example notice', 'Please keep the corridors clear for wheelchairs · Example notice'],
}

function initialConfig(): ScreenConfig | null {
  // ?demo&look=day&lang=ms for screenshots of each variation.
  if (query.has('demo')) {
    return sanitize({ ...DEMO_CONFIG, look: query.get('look'), mode: query.get('mode') ?? (query.get('look') === 'day' ? 'light' : 'dark'), lang: query.get('lang') ?? 'en', names: query.get('names') ?? DEMO_CONFIG.names,
      // ?season=ramadan|lastTen|raya: the committee's Ramadan preview, with typical settings.
      showIqamah: query.has('iqamah'),
      ramadan: { ishaExtra: 5, tarawih: true, tarawihAt: null, qiyamAt: '03:30', eidAt: '08:00', preview: query.get('season') ?? 'off' } })
  }
  const fromLink = configFromHash(location.hash)
  if (fromLink) { writeJSON(STORAGE, fromLink); writeString(CODE_KEY, ''); return fromLink }
  // A short link (#k=...): the saved copy is used only when it came from this same code. Otherwise App fetches it.
  const code = shortCodeFromHash(location.hash)
  if (code && readString(CODE_KEY) !== code) return null
  const saved = readJSON<unknown>(STORAGE)
  return saved ? sanitize(saved) : null
}

/** How far the TV's own clock is off, from the last check-in (0 until then). The screen counts from the corrected time. */
let clockFix = fixedNow == null && !query.has('demo') ? savedClockFix() : 0
const screenNow = () => Date.now() + clockFix

/** The look the dashboard counts: Sky in Light keeps its old name, Day. */
const reportLook = (c: ScreenConfig): string => (c.look === 'night' && c.mode === 'light' ? 'day' : c.look)

function useClock(): number {
  const [now, setNow] = useState(fixedNow ?? screenNow())
  useEffect(() => {
    if (fixedNow != null) return
    // Tick on the second boundary so the countdown never skips a number.
    let id: ReturnType<typeof setTimeout>
    const tick = () => { setNow(screenNow()); id = setTimeout(tick, 1000 - (screenNow() % 1000) + 5) }
    tick()
    return () => clearTimeout(id)
  }, [])
  return now
}

/** Opening a short link on a new TV: fetch the settings, keep them on the TV, and retry while there is no internet. */
function useShortLink(code: string | null, have: boolean, onLoaded: (c: ScreenConfig) => void): 'idle' | 'loading' | 'failed' {
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>(code && !have ? 'loading' : 'idle')
  useEffect(() => {
    if (!code || have) return
    let stop = false, id: ReturnType<typeof setTimeout>
    const attempt = async () => {
      const text = await loadShortLink(code)
      const c = text ? decodeConfig(text) : null
      if (stop) return
      if (c) { writeJSON(STORAGE, c); writeString(CODE_KEY, code); onLoaded(c); setState('idle'); return }
      setState('failed')
      id = setTimeout(attempt, 15_000)
    }
    void attempt()
    return () => { stop = true; clearTimeout(id) }
  }, [code, have])
  return state
}

function App() {
  const [config, setConfig] = useState<ScreenConfig | null>(initialConfig)
  const code = shortCodeFromHash(location.hash)
  const link = useShortLink(code, config != null, setConfig)
  // One address, prayertimes.asia/masjid, for everyone: a TV (by its browser name) shows the pairing code,
  // a phone or computer shows the setup page. #tv and #setup force one or the other.
  const wantsSetup = location.hash.includes('setup') || query.has('setup') || pairCodeFromHash(location.hash) != null
  const tv = isTvHash(location.hash) || (!wantsSetup && looksLikeTv(navigator.userAgent))
  const [editing, setEditing] = useState(() => wantsSetup || (!config && !code && !tv))
  const now = useClock()
  // No place chosen: the TV works out a place from its own time zone.
  // A paired TV looks for changes from the phone, now and every 10 minutes.
  useEffect(() => {
    if (!config || fixedNow != null || query.has('demo')) return
    let stop = false
    const look = async () => {
      const pair = readJSON<TvPair>(PAIR_KEY)
      if (!pair || !navigator.onLine) return
      const r = await pairSync(pair.code, pair.tvKey, pair.rev)
      if (stop || !r || r === 'gone' || !r.c) return
      const next = decodeConfig(r.c)
      if (!next) return
      const c = sanitize(next)
      writeJSON(STORAGE, c); writeJSON(PAIR_KEY, { ...pair, rev: r.rev }); setConfig(c)
    }
    void look()
    const id = setInterval(look, PAIR_SYNC_MS)
    return () => { stop = true; clearInterval(id) }
  }, [config != null])
  const placed = useMemo(() => (config ? withPlace(config) : null), [config])
  // The setup page is in English; the screen speaks its chosen language (screen readers, TV translation prompts).
  useEffect(() => { document.documentElement.lang = editing || !config ? 'en' : config.lang }, [editing, config])

  if (!config && tv && !code && !editing) {
    return <PairScreen onPaired={(c, pair) => { writeJSON(STORAGE, c); writeJSON(PAIR_KEY, pair); writeString(CODE_KEY, ''); setConfig(c) }} />
  }
  if (!config && code && !editing) {
    return <div class="scr scr-empty"><p>{link === 'failed' ? 'Could not open this link yet. Check that the TV is online. Trying again.' : 'Opening your masjid screen'}</p></div>
  }
  if (editing || !config) {
    return <Setup initial={config ?? DEFAULT_CONFIG} now={now} onOpen={(c) => {
      writeJSON(STORAGE, c)
      writeString(CODE_KEY, '')
      writeJSON(PAIR_KEY, null)  // Changed on the TV itself: the phone no longer controls it.
      history.replaceState(null, '', `${location.pathname}${location.search}#c=${encodeConfig(c)}`)
      setConfig(c)
      setEditing(false)
    }} />
  }
  return <Screen config={placed!} now={now} onEdit={() => { history.replaceState(null, '', `${location.pathname}#setup`); setEditing(true) }} />
}

function Screen({ config, now, onEdit }: { config: ScreenConfig; now: number; onEdit: () => void }) {
  const [, setTables] = useState(0)
  const [pointer, setPointer] = useState(true)
  const [clockOff, setClockOff] = useState(clockFix)
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

  useEffect(() => {
    const get = () => { void refreshAnnouncements().then((changed) => { if (changed) setTables((n) => n + 1) }) }
    get()
    const id = setInterval(get, 15 * 60_000)
    return () => clearInterval(id)
  }, [])

  // Anonymous check-in: on start and every six hours, unless the committee turned it off.
  useEffect(() => {
    if (fixedNow != null || query.has('demo') || !config.report || !config.place) return
    const checkIn = () => countScreenRunning(SCREEN_VERSION, {
      masjid: config.name, city: config.place?.district || config.place?.name || null,
      countryCode: config.place?.cc ?? null, look: reportLook(config), language: config.lang,
    })
    const first = setTimeout(checkIn, 20_000)
    const id = setInterval(checkIn, SCREEN_EVERY_MS)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [config])

  // "This screen is on": a random ID every 15 minutes for the live count, which also tells us when the TV clock is wrong.
  // With counting off, only the time is asked for, and nothing about the screen is sent.
  useEffect(() => {
    if (fixedNow != null || query.has('demo') || !config.place) return
    if (clockFix) setScreenClock(screenNow)
    const ping = () => (config.report ? pingScreen({ cc: config.place?.cc ?? null, look: reportLook(config), lang: config.lang }) : checkClock()).then((off) => {
      if (off == null) return
      clockFix = nextClockFix(clockFix, off)
      saveClockFix(clockFix)
      setScreenClock(screenNow)
      setClockOff(clockFix)
    })
    const first = setTimeout(ping, 5_000)
    const id = setInterval(ping, PING_EVERY_MS)
    return () => { clearTimeout(first); clearInterval(id) }
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
      {Math.abs(clockOff) >= CLOCK_WARN_MS && <p class="screen-clockwarn" role="status">{w.clockOff(Math.round(Math.abs(clockOff) / 60_000), clockOff > 0)}</p>}
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
