import { azanAvailable } from '../services/azan'
import { useEffect, useState } from 'preact/hooks'
import { AlarmClock, ArrowDownToLine, ArrowRightLeft, MoonStar, BellRing, Briefcase, CalendarPlus, ChevronRight, Download, Hand, MapPinned, MapPinOff, Printer, Smartphone } from 'lucide-preact'
import { JAKIM_ZONES } from '../core/jakimZones'
import { ALL_METHODS } from '../core/methods'
import { feedName, FEEDS_BASE, nearestJakimZone } from '../core/official'
import { NAMING_LABEL, NAMING_LANGUAGE, NAMING_STYLES, PRAYERS, prayerName, type NamingStyle, type Prayer } from '../core/prayer'
import { flag, profileMethod } from '../core/regions'
import { alertSupport, downloadICS, anyAlarm, nextWakeUp, permission, requestPermission, testAlert, WORK_PRAYERS } from '../services/notifications'
import { APPEARANCE_LABEL, APPEARANCES, DEFAULT_REMINDER_MINUTES, JUMUAH_REMINDER_CHOICES, REMINDER_CHOICES, TODAY_STYLE_LABEL, TODAY_STYLES, type Appearance, type TodayStyle } from '../services/prefs'
import { store, useStore } from '../services/store'
import { openSheet, SelectItem, ToggleItem } from './common'
import { MakersCard, OFFERS } from './Makers'
import { TabJourney } from './icons'
import { canInstall, install, isStandalone, phoneAppOffer } from './pwa'
import { SEASON_PREVIEW_LABEL, SEASON_PREVIEWS, type SeasonPreview } from '../core/season'
import { daysToRamadan } from './Ramadan'

export const VERSION = '1.0.0 (web)'

/** Every half hour of the day, in minutes past midnight. */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 30)



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

  const setReminder = async (on: boolean) => {
    if (!on) { store.update((x) => { x.reminderMinutesBefore = 0 }); return }
    if (support !== 'supported') { openSheet({ kind: 'alerts-help' }); return }
    const ok = await requestPermission()
    setPerm(permission())
    if (ok) store.update((x) => { x.reminderMinutesBefore = DEFAULT_REMINDER_MINUTES })
    else openSheet({ kind: 'alerts-help' })
  }
  const reminderOn = p.reminderMinutesBefore > 0 && perm === 'granted'
  const nextWake = nextWakeUp(s.now())
  const wakeValue = nextWake ? `Next ${s.formatted(nextWake.at)}` : anyAlarm(p) ? 'On' : 'Off'
  const friday = prayerName('dhuhr', s.naming, true)

  const setJumuah = async (minutes: number) => {
    if (minutes > 0 && support === 'supported' && !(await requestPermission())) { setPerm(permission()); openSheet({ kind: 'alerts-help' }); return }
    setPerm(permission())
    store.update((x) => { x.jumuahReminderMinutes = minutes })
  }

  const timetable = !source ? 'Calculated on this device'
    : s.hasTable() ? `Official · downloaded${s.tableVia() === 'feed' ? ' (feed)' : ''}` : 'Official · will download when online'

  return (
    <div class="page settings">
      <h1 class="h-title" style={{ margin: '28px 0 4px' }}>Settings</h1>
      <AppCard />

      <Group title="Location">
        <button class="item" onClick={() => openSheet({ kind: 'places' })}>
          <span class="label">Place</span><span class="value">{place?.name ?? 'Not set'}</span><ChevronRight size={16} class="secondary" />
        </button>
        <div class="item"><span class="label">Country rules</span><span class="value">{s.profile.code ? `${flag(s.profile.code)} ${s.profile.name}` : s.profile.name}</span></div>
      </Group>

      <Group title="Ramadan and Syawal" foot={<>
        Ramadan mode turns on by itself on the first day your authority announces, and Syawal follows on Raya. {(() => { const d = daysToRamadan(s.now()); return d != null && d > 0 && !s.isSeasonPreview ? `About ${d} days to Ramadan.` : '' })()}
        {' '}Try Ramadan lets testers see every part of it now. It only changes this {s.demo ? 'demo' : 'browser'}, and the real dates come back when you turn it off.
      </>}>
        <button class="item" onClick={() => openSheet({ kind: 'ramadan' })}>
          <MoonStar size={20} /><span class="label">Ramadan page<span class="sub">Imsak and Berbuka, your fasts, doa, zakat fitrah, the last ten nights</span></span><ChevronRight size={16} class="secondary" />
        </button>
        <SelectItem label="Try Ramadan (for testers)" value={p.seasonPreview}
          options={SEASON_PREVIEWS.map((v) => ({ value: v, label: SEASON_PREVIEW_LABEL[v] }))}
          onChange={(v) => store.update((x) => { x.seasonPreview = v as SeasonPreview })} />
        <ToggleItem label="Imsak alert" sub="10 minutes before Imsak, in Ramadan" on={p.imsakAlert} onChange={(v) => { if (v) void requestPermission().then(() => setPerm(permission())); store.update((x) => { x.imsakAlert = v }) }} />
        <ToggleItem label="Berbuka alert" sub="At Maghrib, in Ramadan" on={p.berbukaAlert} onChange={(v) => { if (v) void requestPermission().then(() => setPerm(permission())); store.update((x) => { x.berbukaAlert = v }) }} />
        <ToggleItem label="Qiyam reminder" sub="The last third of the last ten nights" on={p.qiyamAlert} onChange={(v) => { if (v) void requestPermission().then(() => setPerm(permission())); store.update((x) => { x.qiyamAlert = v }) }} />
      </Group>

      <Group title="Wake-up" foot="Also on the Prayer screen. Tap the alarm clock at the top.">
        <button class="item" onClick={() => openSheet({ kind: 'wakeup' })}>
          <AlarmClock size={20} /><span class="label">Prayer alarms</span>
          <span class="value">{wakeValue}</span><ChevronRight size={16} class="secondary" />
        </button>
      </Group>

      <Group title="Travel" foot="Jamak and qasar guidance, combined prayer windows and a log of where you've prayed. We'll ask when you land in another country.">
        <ToggleItem label="Musafir features" on={p.musafirEnabled} onChange={(v) => store.update((x) => { x.musafirEnabled = v })} />
        {p.musafirEnabled && (
          <button class="item" onClick={() => openSheet({ kind: 'journey' })}><TabJourney size={20} /><span class="label">Journey</span><ChevronRight size={16} class="secondary" /></button>
        )}
      </Group>

      <Group title="Calculation" foot={<>{s.sourceSummary} Automatic follows the country you're in, so landing in a new country switches it for you. {s.method.note}</>}>
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
        <button class="item" onClick={() => downloadICS()}>
          <Download size={20} /><span class="label">Add the next 30 days to a calendar<span class="sub">An .ics file with an alert at every prayer, for {place?.name ?? 'your place'}</span></span>
        </button>
        <button class="item" onClick={() => downloadICS(WORK_PRAYERS)}>
          <Briefcase size={20} /><span class="label">Only {s.name('dhuhr')} and {s.name('asr')}, for a work calendar<span class="sub">So meetings and classes don't land on prayer time. Add it to Outlook or Google Calendar at work.</span></span>
        </button>
        <a class="item" href="print/">
          <Printer size={20} /><span class="label">Print a prayer calendar<span class="sub">A monthly or Ramadan timetable, a sticker calendar or a kids' prayer tracker</span></span>
        </a>
      </Group>

      <Group title="Prayer names" foot={'Your names stay the same wherever you are: Automatic uses your home country\'s words, or your browser\'s language. When you travel somewhere that uses different words, the local name appears small beside it - "Fajr" with "Subuh" in Kuala Lumpur - so the masjid\'s signs make sense. Spellings follow each authority\'s own timetable.'}>
        <SelectItem label="Prayer names" value={p.namingOverride ?? 'auto'}
          options={[{ value: 'auto', label: `Automatic · ${NAMING_LANGUAGE[s.personalNaming]}` }, ...NAMING_STYLES.map((n) => ({ value: n, label: NAMING_LABEL[n] }))]}
          onChange={(v) => store.update((x) => { x.namingOverride = v === 'auto' ? null : (v as NamingStyle) })} />
        <ToggleItem label="Show local names when travelling" on={p.showLocalNames} onChange={(v) => store.update((x) => { x.showLocalNames = v })} />
      </Group>

      <Group title="Tracker" foot="Tap a prayer on the Prayer screen once it has passed to tick it off, and keep a streak. Tap the streak to mark a day as excused (haid, illness) so it carries on. Kept only in this browser.">
        <ToggleItem label="Prayer tracker" on={p.trackerEnabled} onChange={(v) => store.update((x) => { x.trackerEnabled = v })} />
        {p.trackerEnabled && (
          <ToggleItem label="Nudge before time runs out" on={p.windowNudge} onChange={(v) => store.update((x) => { x.windowNudge = v })}
            sub={`One gentle alert about 30 minutes before a prayer's time ends, only if you haven't ticked it. Not for ${s.name('isha')}, which stays open until ${s.name('fajr')}. Never while paused.`} />
        )}
      </Group>

      <Group title="Display">
        <SelectItem label="Appearance" value={p.appearance} options={APPEARANCES.map((a) => ({ value: a, label: APPEARANCE_LABEL[a] }))}
          onChange={(v) => store.update((x) => { x.appearance = v as Appearance })} />
        <SelectItem label="Prayer screen" value={p.todayStyle} options={TODAY_STYLES.map((t) => ({ value: t, label: TODAY_STYLE_LABEL[t] }))}
          onChange={(v) => store.update((x) => { x.todayStyle = v as TodayStyle })} />
        <ToggleItem label="Bigger text" on={p.largeText} onChange={(v) => store.update((x) => { x.largeText = v })}
          sub="Makes every word and time larger. For the clearest screen, pick Big and Simple as the Prayer screen too." />
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
        Prayer time alerts ring at the exact time of each prayer you choose. Reminder before prayer gives you a heads-up a few minutes earlier (15 by default), so a meeting or work doesn't run past it - turn on either or both. <b>On the web, they ring only while Prayer Times Asia is open</b> - in a tab or as an installed app.
        For alerts when it's closed, add the times to your calendar above: your calendar rings them, reminder included.
        {perm === 'denied' && ' Notifications are blocked for this site in your browser settings.'}
      </>}>
        <ToggleItem label="Prayer time alerts" on={p.notificationsEnabled && perm === 'granted'} onChange={(v) => void setAlerts(v)} />
        {p.notificationsEnabled && perm === 'granted' && azanAvailable() && (
          <ToggleItem label="Play the azan" on={p.azanSound} onChange={(v) => store.update((x) => { x.azanSound = v })} />
        )}
        <ToggleItem label="Reminder before prayer" on={reminderOn} onChange={(v) => void setReminder(v)} />
        {reminderOn && (
          <SelectItem label="Remind me" value={String(p.reminderMinutesBefore)}
            options={REMINDER_CHOICES.map((m) => ({ value: String(m), label: `${m} min before` }))}
            onChange={(v) => store.update((x) => { x.reminderMinutesBefore = parseInt(v, 10) })} />
        )}
        {(p.notificationsEnabled || p.reminderMinutesBefore > 0) && perm === 'granted' && (
          <>
            {PRAYERS.map((pr: Prayer) => (
              <ToggleItem label={pr === 'sunrise' ? `${s.name(pr)} (${s.name('fajr')} ends)` : s.name(pr)} on={p.notifyPrayers.includes(pr)}
                onChange={(v) => store.update((x) => { x.notifyPrayers = v ? [...new Set([...x.notifyPrayers, pr])] : x.notifyPrayers.filter((q) => q !== pr) })} />
            ))}
            <button class="item" onClick={testAlert}><BellRing size={20} /><span class="label">Send a test alert</span></button>
          </>
        )}
      </Group>

      <Group title="Quiet alerts" foot={`For shift workers sleeping in the day, a baby asleep in the room, or simply a calm night. Alerts still come, but they only buzz. ${s.name('fajr')} keeps its sound so it can wake you.`}>
        <ToggleItem label="Buzz only, no sound" on={p.buzzOnly} onChange={(v) => store.update((x) => { x.buzzOnly = v })} />
        <ToggleItem label="Quiet hours" on={p.quietHours} onChange={(v) => store.update((x) => { x.quietHours = v })} />
        {p.quietHours && (
          <>
            <SelectItem label="From" value={String(p.quietFrom)} options={HALF_HOURS.map((m) => ({ value: String(m), label: s.clock(m) }))}
              onChange={(v) => store.update((x) => { x.quietFrom = parseInt(v, 10) })} />
            <SelectItem label="Until" value={String(p.quietTo)} options={HALF_HOURS.map((m) => ({ value: String(m), label: s.clock(m) }))}
              onChange={(v) => store.update((x) => { x.quietTo = parseInt(v, 10) })} />
          </>
        )}
      </Group>

      <Group title={friday} foot={`A reminder on Fridays to get ready and leave in time. It uses your masjid's own ${friday} time when you have set one in the Masjid tab, otherwise the start of ${s.name('dhuhr')}. ${friday} is not required of women, travellers or the sick, who pray ${s.name('dhuhr')} instead.`}>
        <SelectItem label="Remind me to leave" value={String(p.jumuahReminderMinutes)}
          options={JUMUAH_REMINDER_CHOICES.map((m) => ({ value: String(m), label: m === 0 ? 'Off' : `${m} min before` }))}
          onChange={(v) => void setJumuah(parseInt(v, 10))} />
      </Group>

      <Group title="Moving to another phone" foot="Your places, choices and tracker history travel inside a QR code or link - no account, nothing uploaded. It works between the web, iPhone and Android.">
        <button class="item" onClick={() => openSheet({ kind: 'move-out' })}>
          <ArrowRightLeft size={20} /><span class="label">Move my settings</span><ChevronRight size={16} class="secondary" />
        </button>
        <button class="item" onClick={() => openSheet({ kind: 'move-in' })}>
          <ArrowDownToLine size={20} /><span class="label">Bring in settings</span><ChevronRight size={16} class="secondary" />
        </button>
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
        <div class="item footnote"><MapPinned size={18} />The Masjid map and search use OpenStreetMap services (map tiles and Overpass), which see the area you look at.</div>
      </Group>

      <Group id="makers" title="From the makers" foot="Prayer Times Asia is free and built fisabilillah in Singapore by Ustaz Aarif Raziff and Nasar Digital (Nasar Pte Ltd). The only offers you will see are our own - no ad networks, nothing tracked.">
        <div class="makers-list">{OFFERS.map((o) => <MakersCard offer={o} placement="settings" />)}</div>
        <ToggleItem label="Show offers on Prayer and Masjid" on={p.showOffers} onChange={(v) => store.update((x) => { x.showOffers = v })} />
      </Group>

      <Group foot="Prayer Times Asia. Built in Asia, made for Muslims everywhere.">
        <a class="item" href="../"><span class="label">About Prayer Times Asia</span><ChevronRight size={16} class="secondary" /></a>
        <button class="item" onClick={() => openSheet({ kind: 'credits' })}><span class="label">Sources &amp; credits</span><ChevronRight size={16} class="secondary" /></button>
        <a class="item" href="https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer"><span class="label">Help verify times where you are</span><ChevronRight size={16} class="secondary" /></a>
        <a class="item" href="https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md" target="_blank" rel="noopener noreferrer"><span class="label">Design a new look</span><ChevronRight size={16} class="secondary" /></a>
        <div class="item"><span class="label">Version</span><span class="value">{VERSION}</span></div>
      </Group>
    </div>
  )
}

/** The app's own card: the icon on the navy compass-ring colour, kawung batik and cream stitching. */
function AppCard() {
  return (
    <a class="app-card" href="../" aria-label={`About Prayer Times Asia, version ${VERSION}`}>
      <svg class="app-card-batik" aria-hidden="true">
        <defs>
          <pattern id="kawung-card" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45) scale(0.45)">
            <g fill="none" stroke="#FFFFFF" stroke-width="1.8">
              <ellipse cx="20" cy="10" rx="5.6" ry="9.2" /><ellipse cx="20" cy="30" rx="5.6" ry="9.2" />
              <ellipse cx="10" cy="20" rx="9.2" ry="5.6" /><ellipse cx="30" cy="20" rx="9.2" ry="5.6" />
            </g>
            <circle cx="20" cy="20" r="1.8" fill="#FFFFFF" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kawung-card)" />
      </svg>
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width="64" height="64" />
      <span class="app-card-text">
        <span class="app-card-name">Prayer Times Asia</span>
        <span class="app-card-line">Built fisabilillah in Singapore</span>
        <span class="app-card-version">Version {VERSION}</span>
      </span>
      <ChevronRight size={18} class="app-card-chevron" />
    </a>
  )
}
