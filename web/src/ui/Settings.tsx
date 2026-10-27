import { useEffect, useState } from 'preact/hooks'
import { BellRing, CalendarPlus, ChevronRight, Download, Hand, MapPinned, MapPinOff, Smartphone } from 'lucide-preact'
import { JAKIM_ZONES } from '../core/jakimZones'
import { ALL_METHODS } from '../core/methods'
import { feedName, FEEDS_BASE, nearestJakimZone } from '../core/official'
import { NAMING_LABEL, NAMING_LANGUAGE, NAMING_STYLES, PRAYERS, type NamingStyle, type Prayer } from '../core/prayer'
import { flag, profileMethod } from '../core/regions'
import { alertSupport, downloadICS, permission, requestPermission, testAlert } from '../services/notifications'
import { APPEARANCE_LABEL, APPEARANCES, TODAY_STYLE_LABEL, TODAY_STYLES, type Appearance, type TodayStyle } from '../services/prefs'
import { store, useStore } from '../services/store'
import { openSheet, SelectItem, ToggleItem } from './common'
import { MakersCard, OFFERS } from './Makers'
import { TabJourney } from './icons'
import { canInstall, install, isStandalone, phoneAppOffer } from './pwa'

export const VERSION = '1.0.0 (web)'

function Group({ title, children, foot, id }: { title?: string; children: preact.ComponentChildren; foot?: preact.ComponentChildren; id?: string }) {
  return (
    <section id={id}>
      {title && <h2 class="group-title">{title}</h2>}
      <div class="group">{children}</div>
      {foot && <p class="group-foot">{foot}</p>}
    </section>
  )
}

export function SettingsScreen() {
  const s = useStore()
  const p = s.prefs
  const place = s.activePlace
  const source = s.officialSource
  const appOffer = phoneAppOffer()
  const feed = source ? feedName(source) : null
  const [perm, setPerm] = useState(permission())
  const support = alertSupport()
  useEffect(() => {
    if (s.demo && new URLSearchParams(location.search).get('settings') === 'makers') {
      setTimeout(() => document.getElementById('makers')?.scrollIntoView({ block: 'start' }), 300)
    }
  }, [])

  const setAlerts = async (on: boolean) => {
    if (!on) { store.update((x) => { x.notificationsEnabled = false }); return }
    if (support !== 'supported') { openSheet({ kind: 'alerts-help' }); return }
    const ok = await requestPermission()
    setPerm(permission())
    if (ok) store.update((x) => { x.notificationsEnabled = true })
    else openSheet({ kind: 'alerts-help' })
  }

  const timetable = !source ? 'Calculated on this device'
    : s.hasTable() ? `Official · downloaded${s.tableVia() === 'feed' ? ' (feed)' : ''}` : 'Official · will download when online'

  return (
    <div class="page settings">
      <h1 class="h-title" style={{ margin: '28px 0 4px' }}>Settings</h1>

      <Group title="Location">
        <button class="item" onClick={() => openSheet({ kind: 'places' })}>
          <span class="label">Place</span><span class="value">{place?.name ?? 'Not set'}</span><ChevronRight size={16} class="secondary" />
        </button>
        <div class="item"><span class="label">Country rules</span><span class="value">{s.profile.code ? `${flag(s.profile.code)} ${s.profile.name}` : 'Outside Asia'}</span></div>
      </Group>

      <Group title="Travel" foot="Jamak and qasar guidance, combined prayer windows and a log of where you've prayed. We'll ask when you land in another country.">
        <ToggleItem label="Musafir features" on={p.musafirEnabled} onChange={(v) => store.update((x) => { x.musafirEnabled = v })} />
        {p.musafirEnabled && (
          <button class="item" onClick={() => openSheet({ kind: 'journey' })}><TabJourney size={20} /><span class="label">Journey</span><ChevronRight size={16} class="secondary" /></button>
        )}
      </Group>

      <Group title="Calculation" foot={<>Automatic follows the country you're in, so landing in a new country switches it for you. {s.method.note}</>}>
        <SelectItem label="Method" value={p.methodOverrideID ?? 'auto'}
          options={[{ value: 'auto', label: `Automatic · ${profileMethod(s.profile).shortName}` }, ...ALL_METHODS.map((m) => ({ value: m.id, label: m.name }))]}
          onChange={(v) => store.update((x) => { x.methodOverrideID = v === 'auto' ? null : v })} />
        <SelectItem label="Asr" value={p.asrOverride ?? 'auto'}
          options={[{ value: 'auto', label: `Automatic · ${s.profile.asr === 'hanafi' ? 'Hanafi' : "Shafi'i"}` }, { value: 'standard', label: "Shafi'i (standard)" }, { value: 'hanafi', label: 'Hanafi' }]}
          onChange={(v) => store.update((x) => { x.asrOverride = v === 'auto' ? null : (v as 'standard' | 'hanafi') })} />
        {s.method.id === 'jakim' && place && (
          <SelectItem label="JAKIM zone" value={p.jakimZoneOverride ?? 'auto'}
            options={[{ value: 'auto', label: `Automatic · ${nearestJakimZone(place.coordinates)}` }, ...JAKIM_ZONES.map((z) => ({ value: z.id, label: `${z.id} · ${z.areas}` }))]}
            onChange={(v) => store.update((x) => { x.jakimZoneOverride = v === 'auto' ? null : v })} />
        )}
        <div class="item"><span class="label">Timetable</span><span class="value">{timetable}</span></div>
        {feed && (
          <a class="item" href={`webcal://${FEEDS_BASE.replace('https://', '')}${feed}.ics`}>
            <CalendarPlus size={20} /><span class="label">Subscribe in Calendar<span class="sub">The official {source?.kind === 'muis' ? 'MUIS' : 'JAKIM'} times as a calendar feed</span></span>
          </a>
        )}
        <button class="item" onClick={downloadICS}>
          <Download size={20} /><span class="label">Add the next 30 days to a calendar<span class="sub">An .ics file with an alert at every prayer, for {place?.name ?? 'your place'}</span></span>
        </button>
      </Group>

      <Group title="Prayer names" foot={'Your names stay the same wherever you are: Automatic uses your home country\'s words, or your browser\'s language. When you travel somewhere that uses different words, the local name appears small beside it - "Fajr" with "Subuh" in Kuala Lumpur - so the masjid\'s signs make sense. Spellings follow each authority\'s own timetable.'}>
        <SelectItem label="Prayer names" value={p.namingOverride ?? 'auto'}
          options={[{ value: 'auto', label: `Automatic · ${NAMING_LANGUAGE[s.personalNaming]}` }, ...NAMING_STYLES.map((n) => ({ value: n, label: NAMING_LABEL[n] }))]}
          onChange={(v) => store.update((x) => { x.namingOverride = v === 'auto' ? null : (v as NamingStyle) })} />
        <ToggleItem label="Show local names when travelling" on={p.showLocalNames} onChange={(v) => store.update((x) => { x.showLocalNames = v })} />
      </Group>

      <Group title="Tracker" foot="Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only in this browser.">
        <ToggleItem label="Prayer tracker" on={p.trackerEnabled} onChange={(v) => store.update((x) => { x.trackerEnabled = v })} />
      </Group>

      <Group title="Display">
        <SelectItem label="Appearance" value={p.appearance} options={APPEARANCES.map((a) => ({ value: a, label: APPEARANCE_LABEL[a] }))}
          onChange={(v) => store.update((x) => { x.appearance = v as Appearance })} />
        <SelectItem label="Prayer screen" value={p.todayStyle} options={TODAY_STYLES.map((t) => ({ value: t, label: TODAY_STYLE_LABEL[t] }))}
          onChange={(v) => store.update((x) => { x.todayStyle = v as TodayStyle })} />
        <ToggleItem label="24-hour time" on={p.use24Hour} onChange={(v) => store.update((x) => { x.use24Hour = v })} />
        <div class="item">
          <span class="label">Hijri date adjustment</span>
          <span class="value">{p.hijriAdjustment === 0 ? 'None' : `${p.hijriAdjustment > 0 ? '+' : ''}${p.hijriAdjustment} day`}</span>
          <span class="stepper">
            <button aria-label="One day earlier" disabled={p.hijriAdjustment <= -2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.max(-2, x.hijriAdjustment - 1) })}>−</button>
            <button aria-label="One day later" disabled={p.hijriAdjustment >= 2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.min(2, x.hijriAdjustment + 1) })}>+</button>
          </span>
        </div>
      </Group>

      <Group title="Alerts" foot={<>
        An alert at the exact time of each prayer you choose, plus an early reminder if you like. <b>On the web, alerts ring only while Prayer Times Asia is open</b> - in a tab or as an installed app.
        For alerts when it's closed, add the times to your calendar above: your calendar rings them.
        {perm === 'denied' && ' Notifications are blocked for this site in your browser settings.'}
      </>}>
        <ToggleItem label="Prayer time alerts" on={p.notificationsEnabled && perm === 'granted'} onChange={(v) => void setAlerts(v)} />
        {p.notificationsEnabled && perm === 'granted' && (
          <>
            {PRAYERS.map((pr: Prayer) => (
              <ToggleItem label={pr === 'sunrise' ? `${s.name(pr)} (${s.name('fajr')} ends)` : s.name(pr)} on={p.notifyPrayers.includes(pr)}
                onChange={(v) => store.update((x) => { x.notifyPrayers = v ? [...new Set([...x.notifyPrayers, pr])] : x.notifyPrayers.filter((q) => q !== pr) })} />
            ))}
            <SelectItem label="Early reminder" value={String(p.reminderMinutesBefore)}
              options={[{ value: '0', label: 'Off' }, { value: '5', label: '5 min before' }, { value: '10', label: '10 min before' }, { value: '15', label: '15 min before' }]}
              onChange={(v) => store.update((x) => { x.reminderMinutesBefore = parseInt(v, 10) })} />
            <button class="item" onClick={testAlert}><BellRing size={20} /><span class="label">Send a test alert</span></button>
          </>
        )}
      </Group>

      {appOffer && (
        <Group title="Phone app" foot={appOffer.detail}>
          <a class="item" href={appOffer.href} target={appOffer.kind === 'ask' ? undefined : '_blank'} rel="noopener">
            <Smartphone size={20} /><span class="label">{appOffer.title}</span><ChevronRight size={16} class="secondary" />
          </a>
        </Group>
      )}

      {!isStandalone() && (
        <Group title="Install" foot="Installed, it opens like an app from your Home Screen or dock, works offline, and on iPhone it is the only way the web can show alerts.">
          <button class="item" onClick={() => (canInstall() ? void install() : openSheet({ kind: 'install' }))}>
            <Smartphone size={20} /><span class="label">Add Prayer Times Asia to your Home Screen</span><ChevronRight size={16} class="secondary" />
          </button>
        </Group>
      )}

      <Group title="Accuracy">
        <p class="item footnote" style={{ display: 'block', lineHeight: 1.4 }}>
          Every day shows its source grade: A official, B masjid-confirmed, C community-verified, D calculated. F (falak) marks a reading from your own shadow stick, which only checks the times.
          In Singapore, Malaysia and Indonesia the app downloads the official MUIS, JAKIM or Kemenag timetable for the year (only the year, zone code or regency name is sent) and keeps it in this browser for offline use; if an authority is down, the app's own calendar feeds (built weekly from the same tables) stand in.
          Everywhere else, and before that download, times are calculated in your browser with the country's own method - the same engine as the iOS app, checked against every day of the 2026 MUIS, JAKIM and Kemenag timetables: for Singapore it is never earlier than the official time (at most 2 minutes later); for Malaysia and Indonesia it is within about 2 minutes.
        </p>
      </Group>

      <Group title="Privacy" foot={<a href="../privacy.html">Full privacy details</a>}>
        <div class="item footnote"><Hand size={18} />No third-party ads, no accounts, no tracking across other apps or sites.</div>
        <div class="item footnote"><MapPinOff size={18} />Your exact location stays in this browser. The place name comes from a built-in list, not a server.</div>
        <ToggleItem label="Share anonymous usage counts" on={p.shareUsage} onChange={(v) => store.update((x) => { x.shareUsage = v })}
          sub="Tells us how many people use the app and in which city and country, so we know where to add official timetables. A random number stands in for you: no name, no exact location, no IP address kept." />
        <div class="item footnote"><MapPinned size={18} />The Masjid map and search use OpenStreetMap services (CARTO tiles, Overpass), which see the area you look at.</div>
      </Group>

      <Group id="makers" title="From the makers" foot="Prayer Times Asia is free and built fisabilillah by Nasar Pte Ltd. The only offers you will see are our own - no ad networks, nothing tracked.">
        <div class="makers-list">{OFFERS.map((o) => <MakersCard offer={o} placement="settings" />)}</div>
        <ToggleItem label="Show offers on Prayer and Masjid" on={p.showOffers} onChange={(v) => store.update((x) => { x.showOffers = v })} />
      </Group>

      <Group foot="Prayer Times Asia - made for Muslims living and travelling across Asia.">
        <button class="item" onClick={() => openSheet({ kind: 'credits' })}><span class="label">Sources &amp; credits</span><ChevronRight size={16} class="secondary" /></button>
        <a class="item" href="https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer"><span class="label">Help verify times where you are</span><ChevronRight size={16} class="secondary" /></a>
        <div class="item"><span class="label">Version</span><span class="value">{VERSION}</span></div>
      </Group>
    </div>
  )
}
