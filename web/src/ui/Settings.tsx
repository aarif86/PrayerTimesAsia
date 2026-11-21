import { alertMode } from '../core/alertMode'
import { useEffect, useState } from 'preact/hooks'
import { AlarmClock, ArrowDownToLine, ArrowRightLeft, BookOpen, Briefcase, CalendarPlus, Check, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, Clock, Download, Gift, Globe, Hand, Info, Lightbulb, Mail, MapPin, MapPinned, MapPinOff, MoonStar, Palette, Printer, Share2, Smartphone, Star, TabletSmartphone } from 'lucide-preact'
import { JAKIM_ZONES } from '../core/jakimZones'
import { ALL_METHODS } from '../core/methods'
import { feedName, FEEDS_BASE, nearestJakimZone } from '../core/official'
import { NAMING_LABEL, NAMING_LANGUAGE, NAMING_STYLES, PRAYERS, type NamingStyle } from '../core/prayer'
import { flag, profileMethod } from '../core/regions'
import { downloadICS, anyAlarm, WORK_PRAYERS } from '../services/notifications'
import { APPEARANCES, APP_LANGUAGES, type AppLanguage, TODAY_STYLES, type Appearance, type TodayStyle } from '../services/prefs'
import { browserLocales, store, useStore } from '../services/store'
import { openSheet, SelectItem, ToggleItem } from './common'
import { ourCards } from '../core/communityCards'
import { MakersCard, PICKS_NAME } from './Makers'
import { TabJourney } from './icons'
import { canInstall, install, isStandalone, phoneAppOffer } from './pwa'
import { SEASON_PREVIEWS, type SeasonPreview } from '../core/season'
import { daysToRamadan } from './Ramadan'

import { VERSION } from './version'
import { APP_LANGUAGE_LABEL, appearanceLabel, appLangFromLocales, methodNote, styleLabel, tr } from '../core/appWords'
export { VERSION }




function Group({ title, children, foot, id }: { title?: string; children: preact.ComponentChildren; foot?: preact.ComponentChildren; id?: string }) {
  return (
    <section id={id}>
      {title && <h2 class="group-title">{title}</h2>}
      <div class="group">{children}</div>
      {foot && <p class="group-foot">{foot}</p>}
    </section>
  )
}

const LINKS = {
  faq: 'https://prayertimes.asia/#faq',
  join: 'https://prayertimes.asia/join',
  instagram: 'https://www.instagram.com/prayertimesasia',
  facebook: 'https://www.facebook.com/prayertimesasia',
  verify: 'https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md',
  newLook: 'https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md',
  picksRules: 'https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/community-cards.md',
}

type Page = 'location' | 'times' | 'accuracy' | 'look' | 'language' | 'ramadan' | 'tracker' | 'hadith' | 'move' | 'privacy' | 'help' | 'picks' | 'about'

/** A main page row: a small coloured icon, the name, and the current choice on the right. */
function NavItem({ icon, color, label, value, onClick, id }: { icon: preact.ComponentChildren; color: string; label: string; value?: string; onClick: () => void; id?: string }) {
  return (
    <button class="item nav-item" id={id} onClick={onClick}>
      <span class="nav-icon" style={{ background: color }}>{icon}</span>
      <span class="label">{label}</span>
      {value && <span class="value">{value}</span>}
      <ChevronRight size={16} class="secondary" />
    </button>
  )
}

/**
 * Settings, laid out the way Apple lays out its own: a short main page of rows
 * that show the current choice, and every detail one tap deeper. Same groups as
 * iOS SettingsView.swift and Android SettingsScreen.kt.
 */
export function SettingsScreen() {
  const [page, setPage] = useState<Page | null>(null)
  const go = (next: Page | null) => { setPage(next); window.scrollTo({ top: 0 }) }
  useEffect(() => {
    if (store.demo && new URLSearchParams(location.search).get('settings') === 'makers') {
      setTimeout(() => document.getElementById('makers')?.scrollIntoView({ block: 'start' }), 300)
    }
  }, [])
  if (!page) return <SettingsMain go={go} />
  const back = page === 'accuracy' ? () => go('times') : () => go(null)
  const titles: Record<Page, string> = {
    location: tr('settings.location'), times: tr('settings.prayerTimes'), accuracy: tr('settings.howAccurate'), look: tr('settings.lookFeel'),
    language: tr('settings.language'), ramadan: tr('settings.ramadan'), tracker: tr('settings.trackerOn'), hadith: tr('settings.hadith'),
    move: tr('settings.movePhone'), privacy: tr('settings.privacy'), help: tr('settings.help'), picks: PICKS_NAME, about: tr('settings.aboutCredits'),
  }
  return (
    <div class="page settings">
      <button class="settings-back" onClick={back}><ChevronLeft size={20} />{page === 'accuracy' ? tr('settings.prayerTimes') : tr('settings.title')}</button>
      <h1 class="h-title settings-sub-title">{titles[page]}</h1>
      {page === 'location' && <LocationPage />}
      {page === 'times' && <PrayerTimesPage openAccuracy={() => go('accuracy')} />}
      {page === 'accuracy' && <Group><p class="item footnote" style={{ display: 'block', lineHeight: 1.4 }}>{tr('settings.accuracyFoot')}</p></Group>}
      {page === 'look' && <LookPage />}
      {page === 'language' && <LanguagePage />}
      {page === 'ramadan' && <RamadanPage />}
      {page === 'tracker' && <TrackerPage />}
      {page === 'hadith' && <HadithPage />}
      {page === 'move' && <MovePage />}
      {page === 'privacy' && <PrivacyPage />}
      {page === 'help' && <HelpPage />}
      {page === 'picks' && <PicksPage />}
      {page === 'about' && <AboutPage />}
    </div>
  )
}


function SettingsMain({ go }: { go: (p: Page) => void }) {
  const s = useStore()
  const p = s.prefs
  const appOffer = phoneAppOffer()
  const counts = { notify: 0, alarm: 0 }
  for (const pr of PRAYERS) { const m = alertMode(p, pr); if (m !== 'off') counts[m]++ }
  const alertsSummary = counts.notify + counts.alarm === 0 && !anyAlarm(p) ? tr('settings.nothingOn')
    : [counts.notify && tr('settings.nNotify', { n: counts.notify }), counts.alarm && tr('settings.nAlarms', { n: counts.alarm })].filter(Boolean).join(', ') || tr('common.on')
  const language = APP_LANGUAGE_LABEL[p.appLanguageOverride ?? appLangFromLocales(browserLocales())]
  const share = async () => {
    const text = tr('settings.shareText')
    const url = 'https://prayertimes.asia'
    try {
      if (navigator.share) { await navigator.share({ title: 'Prayer Times Asia', text, url }); return }
    } catch { return }
    try { await navigator.clipboard.writeText(`${text} ${url}`) } catch { /* nothing more to do */ }
  }
  const onOff = (on: boolean) => (on ? tr('common.on') : tr('common.off'))
  return (
    <div class="page settings">
      <h1 class="h-title" style={{ margin: '28px 0 4px' }}>{tr('settings.title')}</h1>
      <AppCard onClick={() => go('about')} />

      <Group>
        <NavItem icon={<MapPin size={17} />} color="#0a84ff" label={tr('settings.location')} value={s.activePlace?.name ?? tr('settings.notSet')} onClick={() => go('location')} />
        <NavItem icon={<Clock size={17} />} color="#2f9e8f" label={tr('settings.prayerTimes')} value={s.method.shortName} onClick={() => go('times')} />
        <NavItem icon={<AlarmClock size={17} />} color="#ff453a" label={tr('settings.alertsAlarms')} value={alertsSummary} onClick={() => openSheet({ kind: 'wakeup' })} />
      </Group>

      <Group>
        <NavItem icon={<Palette size={17} />} color="#bf5af2" label={tr('settings.lookFeel')} value={styleLabel(p.todayStyle)} onClick={() => go('look')} />
        <NavItem icon={<Globe size={17} />} color="#0a84ff" label={tr('settings.language')} value={language} onClick={() => go('language')} />
        {appOffer && (
          <a class="item nav-item" href={appOffer.href} target={appOffer.kind === 'ask' ? undefined : '_blank'} rel="noopener">
            <span class="nav-icon" style={{ background: '#5e5ce6' }}><Smartphone size={17} /></span><span class="label">{appOffer.title}</span><ChevronRight size={16} class="secondary" />
          </a>
        )}
        {!isStandalone() && (
          <NavItem icon={<TabletSmartphone size={17} />} color="#5e5ce6" label={tr('settings.addHome')}
            onClick={() => (canInstall() ? void install() : openSheet({ kind: 'install' }))} />
        )}
      </Group>

      <Group>
        <NavItem icon={<MoonStar size={17} />} color="#3a3480" label={tr('settings.ramadan')}
          value={p.seasonPreview === 'off' ? tr('settings.ramadanStarts') : tr('settings.pretendOn')} onClick={() => go('ramadan')} />
        <NavItem icon={<CircleCheck size={17} />} color="#30d158" label={tr('settings.trackerOn')} value={onOff(p.trackerEnabled)} onClick={() => go('tracker')} />
        <NavItem icon={<BookOpen size={17} />} color="#a2845e" label={tr('settings.hadith')} value={onOff(p.showHadith || p.hadithInAlerts)} onClick={() => go('hadith')} />
      </Group>

      <Group>
        <NavItem icon={<ArrowRightLeft size={17} />} color="#32ade6" label={tr('settings.movePhone')} onClick={() => go('move')} />
        <NavItem icon={<Hand size={17} />} color="#0a84ff" label={tr('settings.privacy')} onClick={() => go('privacy')} />
        <NavItem icon={<CircleHelp size={17} />} color="#ff9f0a" label={tr('settings.help')} onClick={() => go('help')} />
      </Group>

      <Group id="makers">
        <NavItem icon={<Share2 size={17} />} color="#30d158" label={tr('settings.share')} onClick={() => void share()} />
        <NavItem icon={<Star size={17} />} color="#ffb800" label={tr('settings.rateApp')} onClick={() => openSheet({ kind: 'review' })} />
        <NavItem icon={<Mail size={17} />} color="#0a84ff" label={tr('settings.sendUsNote')} onClick={() => openSheet({ kind: 'feedback' })} />
        <NavItem icon={<Gift size={17} />} color="#e0634f" label={PICKS_NAME} value={onOff(p.showOffers)} onClick={() => go('picks')} />
        <NavItem icon={<Info size={17} />} color="#8e8e93" label={tr('settings.aboutCredits')} onClick={() => go('about')} />
      </Group>
      <p class="group-foot" style={{ textAlign: 'center', marginTop: '18px' }}>{tr('settings.versionN', { v: VERSION })}</p>
    </div>
  )
}

function LocationPage() {
  const s = useStore()
  const p = s.prefs
  return (
    <>
      <Group foot={tr('settings.placeFoot')}>
        <button class="item" onClick={() => openSheet({ kind: 'places' })}>
          <span class="label">{tr('settings.place')}</span><span class="value">{s.activePlace?.name ?? tr('settings.notSet')}</span><ChevronRight size={16} class="secondary" />
        </button>
      </Group>
      <Group title={tr('settings.travel')} foot={tr('settings.travelAsk')}>
        <ToggleItem label={tr('settings.musafirMode')} sub={tr('settings.musafirModeSub')} on={p.musafirEnabled} onChange={(v) => store.update((x) => { x.musafirEnabled = v })} />
        {p.musafirEnabled && (
          <button class="item" onClick={() => openSheet({ kind: 'journey' })}><TabJourney size={20} /><span class="label">{tr('settings.myJourneys')}</span><ChevronRight size={16} class="secondary" /></button>
        )}
      </Group>
    </>
  )
}

function PrayerTimesPage({ openAccuracy }: { openAccuracy: () => void }) {
  const s = useStore()
  const p = s.prefs
  const place = s.activePlace
  const source = s.officialSource
  const feed = source ? feedName(source) : null
  const timetable = !source ? tr('settings.calculated')
    : s.hasTable() ? (s.tableVia() === 'feed' ? tr('settings.officialFeed') : tr('settings.officialDownloaded')) : tr('settings.officialLater')
  return (
    <>
      <Group foot={<>{s.sourceSummary} {tr('settings.followAuthority')}</>}>
        <div class="item"><span class="label">{tr('settings.countryRules')}</span><span class="value">{s.profile.code ? `${flag(s.profile.code)} ${s.profile.name}` : s.profile.name}</span></div>
        <div class="item"><span class="label">{tr('settings.timesFrom')}</span><span class="value">{s.method.shortName}</span></div>
        <div class="item"><span class="label">{tr('settings.timetable')}</span><span class="value">{timetable}</span></div>
        {source && (
          <button class="item" onClick={() => store.refreshOfficial()}><Download size={20} /><span class="label">{tr('settings.downloadAgain')}</span></button>
        )}
        <button class="item" onClick={openAccuracy}><span class="label">{tr('settings.howAccurate')}</span><ChevronRight size={16} class="secondary" /></button>
      </Group>

      <Group title={tr('settings.calculation')} foot={<>{tr('settings.calcFootShort')} {methodNote(s.method)}</>}>
        <SelectItem label={tr('settings.method')} value={p.methodOverrideID ?? 'auto'}
          options={[{ value: 'auto', label: tr('common.automaticWith', { name: profileMethod(s.profile).shortName }) }, ...ALL_METHODS.map((m) => ({ value: m.id, label: m.name }))]}
          onChange={(v) => store.update((x) => { x.methodOverrideID = v === 'auto' ? null : v })} />
        <SelectItem label={tr('settings.asr')} value={p.asrOverride ?? 'auto'}
          options={[{ value: 'auto', label: tr('common.automaticWith', { name: s.profile.asr === 'hanafi' ? tr('settings.hanafi') : tr('settings.shafii') }) }, { value: 'standard', label: tr('settings.shafiiStandard') }, { value: 'hanafi', label: tr('settings.hanafi') }]}
          onChange={(v) => store.update((x) => { x.asrOverride = v === 'auto' ? null : (v as 'standard' | 'hanafi') })} />
        {s.method.id === 'jakim' && place && (
          <SelectItem label={tr('settings.jakimZone')} value={p.jakimZoneOverride ?? 'auto'}
            options={[{ value: 'auto', label: tr('common.automaticWith', { name: nearestJakimZone(place.coordinates) }) }, ...JAKIM_ZONES.map((z) => ({ value: z.id, label: `${z.id} · ${z.areas}` }))]}
            onChange={(v) => store.update((x) => { x.jakimZoneOverride = v === 'auto' ? null : v })} />
        )}
      </Group>

      <Group title={tr('settings.dates')} foot={tr('settings.hijriFoot')}>
        <div class="item">
          <span class="label">{tr('settings.hijriDate')}</span>
          <span class="value">{p.hijriAdjustment === 0 ? tr('settings.sameDay') : `${p.hijriAdjustment > 0 ? '+' : ''}${tr('settings.days', { n: p.hijriAdjustment })}`}</span>
          <span class="stepper">
            <button aria-label={tr('settings.dayEarlier')} disabled={p.hijriAdjustment <= -2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.max(-2, x.hijriAdjustment - 1) })}>−</button>
            <button aria-label={tr('settings.dayLater')} disabled={p.hijriAdjustment >= 2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.min(2, x.hijriAdjustment + 1) })}>+</button>
          </span>
        </div>
      </Group>

      <Group title={tr('settings.addToCalendar')}>
        {feed && (
          <a class="item" href={`webcal://${FEEDS_BASE.replace('https://', '')}${feed}.ics`}>
            <CalendarPlus size={20} /><span class="label">{tr('settings.subscribe')}<span class="sub">{tr('settings.subscribeSub', { name: source?.kind === 'muis' ? 'MUIS' : 'JAKIM' })}</span></span>
          </a>
        )}
        <button class="item" onClick={() => downloadICS()}>
          <Download size={20} /><span class="label">{tr('settings.add30')}<span class="sub">{tr('settings.add30Sub', { place: place?.name ?? tr('settings.yourPlace') })}</span></span>
        </button>
        <button class="item" id="demo-work" onClick={() => downloadICS(WORK_PRAYERS)}>
          <Briefcase size={20} /><span class="label">{tr('settings.workCalendar', { names: `${s.name('dhuhr')} ${tr('common.and')} ${s.name('asr')}` })}<span class="sub">{tr('settings.workCalendarSub')}</span></span>
        </button>
        <a class="item" href="print/">
          <Printer size={20} /><span class="label">{tr('settings.print')}<span class="sub">{tr('settings.printSub')}</span></span>
        </a>
        <a class="item" href="print/#sheet=letter">
          <Mail size={20} /><span class="label">{tr('settings.letter')}<span class="sub">{tr('settings.letterSub')}</span></span>
        </a>
      </Group>
    </>
  )
}

function LookPage() {
  const p = useStore().prefs
  return (
    <>
      <Group title={tr('settings.prayerScreen')}>
        {TODAY_STYLES.map((t) => (
          <button class="item" role="radio" aria-checked={p.todayStyle === t} onClick={() => store.update((x) => { x.todayStyle = t as TodayStyle })}>
            <span class="label">{styleLabel(t)}</span>{p.todayStyle === t && <Check size={18} class="accent" />}
          </button>
        ))}
      </Group>
      <Group title={tr('settings.appearance')} foot={tr('settings.appearanceFoot')}>
        <SelectItem label={tr('settings.appearance')} value={p.appearance} options={APPEARANCES.map((a) => ({ value: a, label: appearanceLabel(a) }))}
          onChange={(v) => store.update((x) => { x.appearance = v as Appearance })} />
      </Group>
      <Group title={tr('settings.textTime')} foot={tr('settings.lookTip')}>
        <ToggleItem label={tr('settings.biggerText')} on={p.largeText} onChange={(v) => store.update((x) => { x.largeText = v })}
          sub={tr('settings.biggerTextSub')} />
        <ToggleItem label={tr('settings.hour24')} on={p.use24Hour} onChange={(v) => store.update((x) => { x.use24Hour = v })} />
        <ToggleItem label={tr('settings.openingDial')} sub={tr('settings.openingDialSub')} on={p.showOpening} onChange={(v) => store.update((x) => { x.showOpening = v })} />
      </Group>
    </>
  )
}

function LanguagePage() {
  const s = useStore()
  const p = s.prefs
  return (
    <>
      <Group foot={tr('settings.languageFoot')}>
        <SelectItem label={tr('settings.language')} value={p.appLanguageOverride ?? 'auto'}
          options={[{ value: 'auto', label: tr('common.automaticWith', { name: APP_LANGUAGE_LABEL[appLangFromLocales(browserLocales())] }) },
            ...APP_LANGUAGES.map((l) => ({ value: l, label: APP_LANGUAGE_LABEL[l] }))]}
          onChange={(v) => store.update((x) => { x.appLanguageOverride = v === 'auto' ? null : (v as AppLanguage) })} />
      </Group>
      <Group title={tr('settings.names')} foot={tr('settings.namesFoot')}>
        <SelectItem label={tr('settings.names')} value={p.namingOverride ?? 'auto'}
          options={[{ value: 'auto', label: tr('common.automaticWith', { name: NAMING_LANGUAGE[s.personalNaming] }) }, ...NAMING_STYLES.map((n) => ({ value: n, label: NAMING_LABEL[n] }))]}
          onChange={(v) => store.update((x) => { x.namingOverride = v === 'auto' ? null : (v as NamingStyle) })} />
        <ToggleItem label={tr('settings.localNames')} on={p.showLocalNames} onChange={(v) => store.update((x) => { x.showLocalNames = v })} />
      </Group>
    </>
  )
}

function RamadanPage() {
  const s = useStore()
  const p = s.prefs
  // Testers only (the demo, or ?tester in the address), or if it is still on, so it can be turned off.
  const tester = s.demo || p.seasonPreview !== 'off' || new URLSearchParams(location.search).has('tester')
  const days = daysToRamadan(s.now())
  return (
    <>
      <Group foot={<>{tr('settings.ramadanFootShort')} {days != null && days > 0 && !s.isSeasonPreview ? tr('settings.aboutDays', { n: days }) : ''}</>}>
        <button class="item" onClick={() => openSheet({ kind: 'ramadan' })}>
          <MoonStar size={20} /><span class="label">{tr('settings.ramadanPage')}<span class="sub">{tr('settings.ramadanPageSub')}</span></span><ChevronRight size={16} class="secondary" />
        </button>
      </Group>
      {tester && (
        <Group title={tr('settings.forTesters')} foot={tr('settings.tryRamadanFoot', { where: s.demo ? tr('settings.demo') : tr('settings.browser') })}>
          <SelectItem label={tr('settings.tryRamadan')} value={p.seasonPreview}
            options={SEASON_PREVIEWS.map((v) => ({ value: v, label: tr(`preview.${v}`) }))}
            onChange={(v) => store.update((x) => { x.seasonPreview = v as SeasonPreview })} />
        </Group>
      )}
    </>
  )
}

function TrackerPage() {
  const p = useStore().prefs
  return (
    <Group foot={tr('settings.trackerFoot')}>
      <ToggleItem label={tr('settings.trackerOn')} on={p.trackerEnabled} onChange={(v) => store.update((x) => { x.trackerEnabled = v })} />
    </Group>
  )
}

function HadithPage() {
  const p = useStore().prefs
  return (
    <Group foot={tr('settings.hadithFoot')}>
      <ToggleItem label={tr('settings.showHadith')} sub={tr('settings.showHadithSub')} on={p.showHadith}
        onChange={(v) => store.update((x) => { x.showHadith = v; if (v) x.hiddenHadith = [] })} />
      <ToggleItem label={tr('settings.wakeHadith')} sub={tr('settings.wakeHadithSub')} on={p.hadithInAlerts}
        onChange={(v) => store.update((x) => { x.hadithInAlerts = v })} />
    </Group>
  )
}

function MovePage() {
  return (
    <Group foot={tr('settings.movingFoot')}>
      <button class="item" onClick={() => openSheet({ kind: 'move-out' })}>
        <ArrowRightLeft size={20} /><span class="label">{tr('move.title')}</span><ChevronRight size={16} class="secondary" />
      </button>
      <button class="item" onClick={() => openSheet({ kind: 'move-in' })}>
        <ArrowDownToLine size={20} /><span class="label">{tr('move.bringIn')}</span><ChevronRight size={16} class="secondary" />
      </button>
    </Group>
  )
}

function PrivacyPage() {
  const s = useStore()
  const p = s.prefs
  const [geo, setGeo] = useState<string>('')
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((r) => setGeo(r.state)).catch(() => setGeo(''))
  }, [])
  const notif = typeof Notification === 'undefined' ? '' : Notification.permission
  const word = (state: string) => state === 'granted' ? tr('settings.allowed') : state === 'denied' ? tr('common.off') : tr('settings.notAsked')
  return (
    <>
      <Group title={tr('settings.promise')}>
        <div class="item footnote"><Hand size={18} />{tr('settings.privacy1')}</div>
        <div class="item footnote"><MapPinOff size={18} />{tr('settings.privacy2')}</div>
        <div class="item footnote"><MapPinned size={18} />{tr('settings.osm')}</div>
      </Group>
      <Group>
        <ToggleItem label={tr('settings.usage')} on={p.shareUsage} onChange={(v) => store.update((x) => { x.shareUsage = v })}
          sub={tr('settings.usageSub')} />
      </Group>
      <Group title={tr('settings.browserPermissions')} foot={tr('settings.permissionsFoot')}>
        <div class="item"><span class="label">{tr('settings.location')}</span><span class="value">{p.useGPS ? word(geo) : tr('settings.pickedPlace')}</span></div>
        <div class="item"><span class="label">{tr('settings.notificationsWord')}</span><span class="value">{word(notif)}</span></div>
      </Group>
      <Group>
        <a class="item" href="../privacy.html"><span class="label">{tr('settings.privacyPolicy')}</span><ChevronRight size={16} class="secondary" /></a>
      </Group>
    </>
  )
}

function HelpPage() {
  return (
    <Group foot={tr('settings.helpFoot')}>
      <button class="item" onClick={() => openSheet({ kind: 'guide' })}>
        <Lightbulb size={20} /><span class="label">{tr('settings.showGuide')}</span><ChevronRight size={16} class="secondary" />
      </button>
      <a class="item" href={LINKS.faq} target="_blank" rel="noopener noreferrer"><span class="label">{tr('settings.faq')}</span><ChevronRight size={16} class="secondary" /></a>
      <a class="item" href={LINKS.verify} target="_blank" rel="noopener noreferrer"><span class="label">{tr('settings.helpVerify')}</span><ChevronRight size={16} class="secondary" /></a>
    </Group>
  )
}

function PicksPage() {
  const p = useStore().prefs
  return (
    <Group foot={<>{tr('settings.picksFoot')} <a href={LINKS.picksRules} target="_blank" rel="noopener noreferrer">{tr('settings.picksRules')}</a></>}>
      <div class="makers-list">{ourCards(store.offerCountry, new Date()).map((c) => <MakersCard card={c} placement="settings" />)}</div>
      <ToggleItem label={tr('settings.showPicks')} on={p.showOffers} onChange={(v) => store.update((x) => { x.showOffers = v })} />
    </Group>
  )
}

function AboutPage() {
  return (
    <>
      <Group foot={tr('settings.motto')}>
        <a class="item" href="../"><span class="label">{tr('settings.aboutApp')}</span><ChevronRight size={16} class="secondary" /></a>
        <button class="item" onClick={() => openSheet({ kind: 'credits' })}><span class="label">{tr('settings.sources')}</span><ChevronRight size={16} class="secondary" /></button>
        <a class="item" href={LINKS.newLook} target="_blank" rel="noopener noreferrer"><span class="label">{tr('settings.designLook')}</span><ChevronRight size={16} class="secondary" /></a>
      </Group>
      <Group title={tr('settings.community')}>
        <a class="item" href={LINKS.join} target="_blank" rel="noopener"><span class="label">{tr('settings.joinTimekeepers')}</span><ChevronRight size={16} class="secondary" /></a>
        <a class="item" href={LINKS.instagram} target="_blank" rel="noopener noreferrer"><span class="label">{tr('settings.instagram')}</span><ChevronRight size={16} class="secondary" /></a>
        <a class="item" href={LINKS.facebook} target="_blank" rel="noopener noreferrer"><span class="label">{tr('settings.facebook')}</span><ChevronRight size={16} class="secondary" /></a>
      </Group>
      <Group foot={tr('settings.freeLine')}>
        <a class="item" href="../privacy.html"><span class="label">{tr('settings.privacyPolicy')}</span><ChevronRight size={16} class="secondary" /></a>
        <a class="item" href="../terms.html"><span class="label">{tr('settings.terms')}</span><ChevronRight size={16} class="secondary" /></a>
        <div class="item"><span class="label">{tr('settings.version')}</span><span class="value">{VERSION}</span></div>
      </Group>
    </>
  )
}

/** The app's own card: the icon on the navy compass-ring colour, kawung batik and cream stitching. */
function AppCard({ onClick }: { onClick: () => void }) {
  return (
    <button class="app-card" onClick={onClick} aria-label={tr('settings.aboutVersion', { v: VERSION })}>
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
        <span class="app-card-line">{tr('settings.builtIn')}</span>
        <span class="app-card-version">{tr('settings.versionN', { v: VERSION })}</span>
      </span>
      <ChevronRight size={18} class="app-card-chevron" />
    </button>
  )
}

