import { lazy, Suspense } from 'preact/compat'
import { useEffect, useLayoutEffect } from 'preact/hooks'
import { Compass, Globe2, Plane } from 'lucide-preact'
import { scheduleAlerts } from '../services/notifications'
import { store, TABS, useNow, useStore, type Tab } from '../services/store'
import { openSheet, useSheet } from './common'
import { FalakScreen } from './Falak'
import { ARScreen, LevelSheet } from './FalakTools'
import { TabFalak, TabMasjid, TabPrayer, TabQibla, TabSettings } from './icons'
import { LivingSky } from './LivingSky'
import { MasjidLinkSheet } from './MyMasjid'
import { QiblaScreen } from './Qibla'
import { SettingsScreen } from './Settings'
import { AlertsHelpSheet, CalendarSheet, CreditsSheet, InstallSheet, JourneySheet, MakersSheet, PlacesSheet, SanadSheet } from './Sheets'
import { SKY, skyAt } from './sky'
import { TodayScreen } from './Today'

const MasjidScreen = lazy(() => import('./Masjid'))

const TAB_LABEL: Record<Tab, string> = { today: 'Prayer', qibla: 'Qibla', falak: 'Falak', masjid: 'Masjid', settings: 'Settings' }
const TAB_ICON: Record<Tab, (p: { size?: number }) => preact.JSX.Element> = {
  today: TabPrayer, qibla: TabQibla, falak: TabFalak, masjid: TabMasjid, settings: TabSettings,
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
  const bands = store.tab === 'today' && store.prefs.todayStyle === 'bands'
  return { sky, scheme, soft: a === 'system', bands }
}

export function App() {
  const s = useStore()
  const now = useNow(30_000)
  const sheet = useSheet()
  const { sky, scheme, soft, bands } = useAppearance(now)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = scheme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', bands ? '#2b2b2b' : scheme === 'light' ? '#e9ecf6' : '#0b0f2a')
  }, [scheme, bands])

  useEffect(() => {
    if (s.prefs.hasOnboarded && s.prefs.useGPS) s.locate()
    s.refreshOfficial()
    void s.refreshData()
    const onVisible = () => { if (document.visibilityState === 'visible') { s.refreshOfficial(); scheduleAlerts() } }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Re-arm the next prayer alert whenever anything changes.
  useEffect(() => { scheduleAlerts() }, [s.revision, Math.floor(now / 60_000)])

  if (!s.prefs.hasOnboarded) {
    return (
      <>
        <LivingSky colors={SKY.dawn} scheme="dark" soft={false} />
        <Onboarding />
        {sheet?.kind === 'places' && <PlacesSheet />}
      </>
    )
  }

  return (
    <>
      <LivingSky colors={sky} scheme={scheme} soft={soft} />
      {bands && <div class="bands-backdrop" />}
      <div class="shell">
        <main class={`screen tab-${s.tab}`} id="main">
          {s.tab === 'today' && <TodayScreen />}
          {s.tab === 'qibla' && <QiblaScreen />}
          {s.tab === 'falak' && <FalakScreen />}
          {s.tab === 'masjid' && <Suspense fallback={<div class="page" />}><MasjidScreen /></Suspense>}
          {s.tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
      <nav class="tabbar" role="tablist" aria-label="Sections">
        {TABS.map((t) => {
          const Icon = TAB_ICON[t]
          return (
            <button role="tab" aria-selected={s.tab === t} onClick={() => { s.setTab(t); document.getElementById('main')?.scrollTo({ top: 0 }) }}>
              <Icon size={25} /><span>{TAB_LABEL[t]}</span>
            </button>
          )
        })}
      </nav>
      {sheet?.kind === 'places' && <PlacesSheet />}
      {sheet?.kind === 'sanad' && <SanadSheet day={sheet.day} />}
      {sheet?.kind === 'calendar' && <CalendarSheet />}
      {sheet?.kind === 'makers' && <MakersSheet placement={sheet.placement} />}
      {sheet?.kind === 'journey' && <JourneySheet />}
      {sheet?.kind === 'level' && <LevelSheet />}
      {sheet?.kind === 'ar' && <ARScreen />}
      {sheet?.kind === 'alerts-help' && <AlertsHelpSheet />}
      {sheet?.kind === 'install' && <InstallSheet />}
      {sheet?.kind === 'credits' && <CreditsSheet />}
      {s.pendingMasjid && !sheet && <MasjidLinkSheet m={s.pendingMasjid} />}
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
          <p class="onb-lead">Wherever you land in Asia, know when to pray and which way to face.</p>
        </div>
        <div class="onb-features">
          <Feature icon={<Globe2 size={24} />} title="Every country's own method" detail="MUIS in Singapore, JAKIM in Malaysia, Kemenag in Indonesia - and sensible defaults everywhere else." />
          <Feature icon={<Plane size={24} />} title="Built for travel" detail="Switches when you land, works offline, and tells you when you can shorten and combine prayers." />
          <Feature icon={<Compass size={24} />} title="Qibla in one glance" detail="A calm compass that lights up when you're facing the Kaaba." />
        </div>
        <div class="spacer" />
        <div class="onb-actions">
          <button class="onb-primary" onClick={() => { store.update((p) => { p.hasOnboarded = true }); store.useGPS() }}>Use my location</button>
          <button class="onb-secondary" onClick={() => { store.update((p) => { p.hasOnboarded = true; p.useGPS = false }); openSheet({ kind: 'places' }) }}>Choose a city instead</button>
          <p class="caption" style={{ opacity: 0.75, textAlign: 'center' }}>No third-party ads. No account. Your location stays on your device.</p>
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
