import { FeedbackSheet, ReviewSheet } from './Feedback'
import { SuggestRoomSheet } from './SuggestRoom'
import type { ComponentType } from 'preact'
import { SiteHomeButton } from './SiteHome'
import { lazy, Suspense } from 'preact/compat'
import { useEffect, useLayoutEffect } from 'preact/hooks'
import { ChevronsLeft, ChevronsRight, Compass, Globe2, Plane } from 'lucide-preact'
import { scheduleAlerts } from '../services/notifications'
import { store, TABS, useNow, useStore, type Tab } from '../services/store'
import { closeSheet, openSheet, useSheet } from './common'
import { TabMasjid } from './icons'
import { Clock, SlidersHorizontal, Sun } from 'lucide-preact'
import { LivingSky } from './LivingSky'
import { takeMoveFromLink } from './moveLink'
import { AlertsHelpSheet, CalendarSheet, CreditsSheet, InstallSheet, JourneySheet, MakersSheet, PlacesSheet, SanadSheet } from './Sheets'
import { SKY, skyAt } from './sky'
import { TodayScreen } from './Today'
import { RamadanSheet } from './Ramadan'
import { VERSION } from './version'
import { WakeUpSheet } from './WakeUp'
import { tr } from '../core/appWords'

const MasjidScreen = lazy(() => import('./Masjid'))
// Screens and sheets the first screen never shows load when first opened (and are kept offline like the rest).
const QiblaScreen = later(() => import('./Qibla').then((m) => m.QiblaScreen), <div class="page" />)
const FalakScreen = later(() => import('./Falak').then((m) => m.FalakScreen), <div class="page" />)
const SettingsScreen = later(() => import('./Settings').then((m) => m.SettingsScreen), <div class="page" />)
const LevelSheet = later(() => import('./FalakTools').then((m) => m.LevelSheet))
const ARScreen = later(() => import('./FalakTools').then((m) => m.ARScreen))
const FalakExpertSheet = later(() => import('./Falak').then((m) => m.FalakExpertSheet))
const ShadowStepsSheet = later(() => import('./FalakShadow').then((m) => m.ShadowStepsSheet))
const ShadowCamera = later(() => import('./FalakShadow').then((m) => m.ShadowCamera))
const TrackerSheet = later(() => import('./Tracker').then((m) => m.TrackerSheet))
const LogPrayerSheet = later(() => import('./LogSheets').then((m) => m.LogPrayerSheet))
const CatchUpSheet = later(() => import('./LogSheets').then((m) => m.CatchUpSheet))
const MasjidLinkSheet = later(() => import('./MyMasjid').then((m) => m.MasjidLinkSheet))
const MoveInSheet = later(() => import('./Move').then((m) => m.MoveInSheet))
const MoveOutSheet = later(() => import('./Move').then((m) => m.MoveOutSheet))
const Guide = later(() => import('./Guide').then((m) => m.Guide))

/**
 * A lazy piece failed to download: usually a new version went live and its old
 * file is gone. Reload once (to the new version) rather than leave a broken
 * screen; if it fails again straight away, show the error as before.
 */
function reloadOnce(err: unknown): never {
  let again = false
  try { again = sessionStorage.getItem('ptasia.reloadedForChunk') === '1'; sessionStorage.setItem('ptasia.reloadedForChunk', '1') } catch { /* private mode */ }
  if (!again) { location.reload(); return new Promise<never>(() => {}) as never }
  throw err
}

/** A component loaded on first use; shows nothing (or `fallback`) for the moment it takes. */
function later<P extends object>(load: () => Promise<ComponentType<P>>, fallback: preact.JSX.Element | null = null) {
  const Lazy = lazy(() => load().then((c) => { try { sessionStorage.removeItem('ptasia.reloadedForChunk') } catch { /* private mode */ } return { default: c } }, reloadOnce)) as ComponentType<P>
  return (p: P) => <Suspense fallback={fallback}><Lazy {...p} /></Suspense>
}

/**
 * Once the Prayer screen is up and the phone is idle, quietly load the other
 * screens too, so the first tap on Qibla, Falak, Masjid or Settings opens at
 * once instead of showing an empty page while its file arrives.
 */
function warmUpScreens(): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    const load = () => {
      for (const get of [() => import('./Qibla'), () => import('./Masjid'), () => import('./Settings'), () => import('./Falak'), () => import('./Tracker')]) {
        get().catch(() => { /* offline or a new version: the screen loads on its tap as before */ })
      }
    }
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (idle) idle(load, { timeout: 4000 }); else load()
  }, 2500)
}

const tabLabel = (tab: Tab): string => ({ today: tr('tab.prayer'), qibla: tr('tab.qibla'), falak: tr('tab.falak'), masjid: tr('tab.masjid'), settings: tr('tab.settings') })[tab]
const TAB_ICON: Record<Tab, (p: { size?: number }) => preact.JSX.Element> = {
  today: (p) => <Clock size={p.size} strokeWidth={1.75} />, qibla: (p) => <Compass size={p.size} strokeWidth={1.75} />,
  falak: (p) => <Sun size={p.size} strokeWidth={1.75} />, masjid: TabMasjid, settings: (p) => <SlidersHorizontal size={p.size} strokeWidth={1.75} />,
}

function prefersLight(): boolean {
  try { return window.matchMedia('(prefers-color-scheme: light)').matches } catch { return false }
}

/**
 * Light or Dark as chosen; Automatic follows the sky - light from sunrise to
 * Maghrib, the soft night after (and the device's setting until times are known).
 */
function useAppearance(now: number) {
  const day = store.day(now)
  const sky = day ? skyAt(now, day) : SKY.night
  const isNight = day ? now < day.times.sunrise || now >= day.times.maghrib : null
  const a = store.prefs.appearance
  const scheme: 'light' | 'dark' = a === 'light' ? 'light' : a === 'dark' ? 'dark' : isNight == null ? (prefersLight() ? 'light' : 'dark') : isNight ? 'dark' : 'light'
  // Colour Bands' flat page: Prayer, Qibla and Falak so far (the other tabs follow).
  const bands = (store.tab === 'today' || store.tab === 'qibla' || store.tab === 'falak') && store.prefs.todayStyle === 'bands'
  const gold = store.prefs.todayStyle === 'gold'
  return { sky, scheme, soft: a === 'system', bands, gold }
}

export function App() {
  const s = useStore()
  const now = useNow(30_000)
  const sheet = useSheet()
  const { sky, scheme, soft, bands, gold } = useAppearance(now)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = scheme
    document.documentElement.toggleAttribute('data-large-text', s.prefs.largeText)
    document.documentElement.dataset.menu = s.prefs.menuSide
    document.documentElement.dataset.look = s.prefs.todayStyle
    document.documentElement.lang = s.appLang
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', bands ? (scheme === 'light' ? '#F2F0EB' : '#232326') : scheme === 'light' ? '#e9ecf6' : '#0b0f2a')
  }, [scheme, bands, s.prefs.todayStyle, s.prefs.largeText, s.prefs.menuSide, s.appLang])

  useEffect(() => {
    const moved = takeMoveFromLink()
    if (moved) openSheet({ kind: 'move-in', code: moved })
    // The website's phone frame opens a screen straight away: ?demo&open=alarms (or fajr, check, calendar, tracker, journey, ramadan).
    if (s.demo) {
      const open = new URLSearchParams(location.search).get('open')
      if (open === 'alarms') openSheet({ kind: 'wakeup' })
      else if (open === 'fajr') openSheet({ kind: 'wakeup', prayer: 'fajr' })
      else if (open === 'check') openSheet({ kind: 'wakeup', view: 'check' })
      else if (open === 'calendar') openSheet({ kind: 'calendar' })
      else if (open === 'tracker') openSheet({ kind: 'tracker' })
      else if (open === 'journey') openSheet({ kind: 'journey' })
      else if (open === 'ramadan') openSheet({ kind: 'ramadan' })
      // ?spot=extras (or sound, work): scroll to that part of the screen once it is open.
      const spot = new URLSearchParams(location.search).get('spot')
      if (spot) {
        let tries = 0
        const find = () => {
          const el = document.getElementById(`demo-${spot}`)
          if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 400)
          else if (++tries < 20) setTimeout(find, 250)
        }
        find()
      }
      // Ramadan preview notes are for testers, not for visitors trying the demo.
      document.documentElement.classList.add('demo')
    }
    if (s.prefs.hasOnboarded && s.prefs.useGPS) s.locate()
    s.refreshOfficial()
    void s.refreshData()
    // Counted a few seconds in, so the GPS place has usually arrived.
    const count = () => { s.countOpenDay(); setTimeout(() => s.countOpen(VERSION.replace(' (web)', '')), 8000) }
    count()
    s.usageVisible(true)
    const onVisible = () => {
      s.usageVisible(document.visibilityState === 'visible')
      if (document.visibilityState === 'visible') { s.refreshOfficial(); void s.refreshData(); scheduleAlerts(); count() }
    }
    const onHide = () => s.usageVisible(false)
    addEventListener('pagehide', onHide)
    // On moon sighting nights the announcement can arrive while the app is open.
    const poll = setInterval(() => { void s.refreshData() }, 10 * 60_000)
    document.addEventListener('visibilitychange', onVisible)
    const warm = warmUpScreens()
    return () => { document.removeEventListener('visibilitychange', onVisible); removeEventListener('pagehide', onHide); clearInterval(poll); clearTimeout(warm) }
  }, [])

  // Re-arm the next prayer alert whenever anything changes.
  useEffect(() => { scheduleAlerts() }, [s.revision, Math.floor(now / 60_000)])

  if (!s.prefs.hasOnboarded) {
    return (
      <>
        <LivingSky colors={SKY.dawn} scheme="dark" soft={false} />
        <Onboarding />
        {sheet?.kind === 'places' && <PlacesSheet forHome={sheet.forHome} />}
        {sheet?.kind === 'move-in' && <MoveInSheet code={sheet.code} />}
      </>
    )
  }

  return (
    <>
      {!gold && <LivingSky colors={sky} scheme={scheme} soft={soft} />}
      {bands && <div class="bands-backdrop" />}
      {gold && <div class="gold-backdrop" />}
      <div class="shell">
        <main class={`screen tab-${s.tab}`} id="main">
          {/* Prayer and Masjid place the home button in their own top bars. */}
          {s.tab !== 'today' && s.tab !== 'masjid' && <SiteHomeButton class="corner" />}
          {s.tab === 'today' && <TodayScreen />}
          {s.tab === 'qibla' && <QiblaScreen />}
          {s.tab === 'falak' && <FalakScreen />}
          {s.tab === 'masjid' && <Suspense fallback={<div class="page" />}><MasjidScreen /></Suspense>}
          {s.tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
      {/* Big screens have room beside the app: a way back to the website. */}
      <a class="site-link" href="../" aria-label={tr('app.backToWebsite')}>
        <span class="site-link-arrow" aria-hidden="true">&larr;</span>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width="24" height="24" />
        <span>prayertimes.asia</span>
      </a>
      <nav class="tabbar" aria-label={tr('app.sections')}>
        {TABS.map((t) => {
          const Icon = TAB_ICON[t]
          return (
            <button aria-current={s.tab === t ? 'page' : undefined} onClick={() => { s.setTab(t); document.getElementById('main')?.scrollTo({ top: 0 }) }}>
              <Icon size={25} /><span>{tabLabel(t)}</span>
            </button>
          )
        })}
        {/* Bigger screens: the bar sits at the side, and this arrow slides it across. Hidden on phones (bottom bar). */}
        <button class="tabbar-move" aria-label={s.prefs.menuSide === 'right' ? tr('app.menuLeft') : tr('app.menuRight')}
          title={s.prefs.menuSide === 'right' ? tr('app.toLeft') : tr('app.toRight')}
          onClick={() => store.update((p) => { p.menuSide = p.menuSide === 'right' ? 'left' : 'right' })}>
          {s.prefs.menuSide === 'right' ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
        </button>
      </nav>
      {sheet?.kind === 'places' && <PlacesSheet forHome={sheet.forHome} />}
      {sheet?.kind === 'sanad' && <SanadSheet day={sheet.day} />}
      {sheet?.kind === 'calendar' && <CalendarSheet />}
      {sheet?.kind === 'makers' && <MakersSheet placement={sheet.placement} />}
      {sheet?.kind === 'journey' && <JourneySheet />}
      {sheet?.kind === 'tracker' && <TrackerSheet />}
      {sheet?.kind === 'log-prayer' && <LogPrayerSheet prayer={sheet.prayer} t={sheet.t} />}
      {sheet?.kind === 'log-catchup' && <CatchUpSheet />}
      {sheet?.kind === 'ramadan' && <RamadanSheet />}
      {sheet?.kind === 'wakeup' && <WakeUpSheet start={sheet.prayer} view={sheet.view} />}
      {sheet?.kind === 'level' && <LevelSheet />}
      {sheet?.kind === 'ar' && <ARScreen />}
      {sheet?.kind === 'falak-expert' && <FalakExpertSheet />}
      {sheet?.kind === 'shadow-steps' && <ShadowStepsSheet />}
      {sheet?.kind === 'shadow-camera' && <ShadowCamera />}
      {sheet?.kind === 'alerts-help' && <AlertsHelpSheet />}
      {sheet?.kind === 'install' && <InstallSheet />}
      {sheet?.kind === 'credits' && <CreditsSheet />}
      {sheet?.kind === 'feedback' && <FeedbackSheet />}
      {sheet?.kind === 'review' && <ReviewSheet />}
      {sheet?.kind === 'suggest-room' && <SuggestRoomSheet near={sheet.near} />}
      {s.pendingMasjid && !sheet && <MasjidLinkSheet m={s.pendingMasjid} />}
      {sheet?.kind === 'move-out' && <MoveOutSheet />}
      {sheet?.kind === 'move-in' && <MoveInSheet code={sheet.code} />}
      {/* New users see the quick guide once, right after choosing their place. */}
      {(sheet?.kind === 'guide' || (!s.prefs.guideShown && !sheet && !s.pendingMasjid)) && <Guide onClose={closeSheet} />}
    </>
  )
}

function Onboarding() {
  return (
    <div class="shell">
      <div class="onboarding">
        <div class="spacer" />
        <div>
          <h1 class="display onb-title">Prayer Times<br />Asia</h1>
          <p class="onb-lead">{tr('welcome.tagline')}</p>
        </div>
        <div class="onb-features">
          <Feature icon={<Globe2 size={24} />} title={tr('welcome.countryMethod')} detail={tr('welcome.countryMethodDetail')} />
          <Feature icon={<Plane size={24} />} title={tr('welcome.travel')} detail={tr('welcome.travelDetail')} />
          <Feature icon={<Compass size={24} />} title={tr('welcome.qiblaGlance')} detail={tr('welcome.qiblaDetail')} />
        </div>
        <div class="spacer" />
        <div class="onb-actions">
          <button class="onb-primary" onClick={() => { store.update((p) => { p.hasOnboarded = true }); store.useGPS() }}>{tr('welcome.useLocation')}</button>
          <button class="onb-secondary" onClick={() => { store.update((p) => { p.hasOnboarded = true; p.useGPS = false }); openSheet({ kind: 'places' }) }}>{tr('welcome.chooseCity')}</button>
          <button class="onb-secondary" onClick={() => openSheet({ kind: 'move-in' })}>{tr('welcome.bringIn')}</button>
          <p class="caption" style={{ opacity: 0.75, textAlign: 'center' }}>{tr('welcome.privacy')}</p>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, title, detail }: { icon: preact.ComponentChildren; title: string; detail: string }) {
  return (
    <div class="onb-feature">
      <span class="onb-icon">{icon}</span>
      <div><div class="headline">{title}</div><div class="subhead" style={{ opacity: 0.85 }}>{detail}</div></div>
    </div>
  )
}
