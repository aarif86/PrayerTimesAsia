import { alertMode } from '../core/alertMode'
import { useEffect } from 'preact/hooks'
import { AlarmClock, ArrowDownToLine, ArrowRightLeft, Briefcase, CalendarPlus, ChevronRight, Download, Hand, Lightbulb, Mail, MapPinned, MapPinOff, MoonStar, Printer, Smartphone, Star } from 'lucide-preact'
import { JAKIM_ZONES } from '../core/jakimZones'
import { ALL_METHODS } from '../core/methods'
import { feedName, FEEDS_BASE, nearestJakimZone } from '../core/official'
import { NAMING_LABEL, NAMING_LANGUAGE, NAMING_STYLES, PRAYERS, prayerName, type NamingStyle } from '../core/prayer'
import { flag, profileMethod } from '../core/regions'
import { downloadICS, anyAlarm, nextWakeUp, WORK_PRAYERS } from '../services/notifications'
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
import { APP_LANGUAGE_LABEL, appearanceLabel, appLangFromLocales, styleLabel, tr } from '../core/appWords'
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

export function SettingsScreen() {
  const s = useStore()
  const p = s.prefs
  const place = s.activePlace
  const source = s.officialSource
  const appOffer = phoneAppOffer()
  const feed = source ? feedName(source) : null
  useEffect(() => {
    if (s.demo && new URLSearchParams(location.search).get('settings') === 'makers') {
      setTimeout(() => document.getElementById('makers')?.scrollIntoView({ block: 'start' }), 300)
    }
  }, [])

  const nextWake = nextWakeUp(s.now())
  const wakeValue = nextWake ? `Next ${s.formatted(nextWake.at)}` : ''
  const counts = { notify: 0, alarm: 0 }
  for (const pr of PRAYERS) { const m = alertMode(p, pr); if (m !== 'off') counts[m]++ }
  const alertsSummary = counts.notify + counts.alarm === 0 && !anyAlarm(p) ? tr('settings.nothingOn')
    : [counts.notify && tr('settings.nNotify', { n: counts.notify }), counts.alarm && tr('settings.nAlarms', { n: counts.alarm })].filter(Boolean).join(', ') || tr('common.on')


  const timetable = !source ? tr('settings.calculated')
    : s.hasTable() ? `Official · downloaded${s.tableVia() === 'feed' ? ' (feed)' : ''}` : tr('settings.officialLater')

  return (
    <div class="page settings">
      <h1 class="h-title" style={{ margin: '28px 0 4px' }}>{tr('settings.title')}</h1>
      <AppCard />

      <Group title={tr('settings.location')}>
        <button class="item" onClick={() => openSheet({ kind: 'places' })}>
          <span class="label">{tr('settings.place')}</span><span class="value">{place?.name ?? tr('settings.notSet')}</span><ChevronRight size={16} class="secondary" />
        </button>
        <div class="item"><span class="label">{tr('settings.countryRules')}</span><span class="value">{s.profile.code ? `${flag(s.profile.code)} ${s.profile.name}` : s.profile.name}</span></div>
      </Group>

      <Group title={tr('settings.alertsAlarms')} foot={tr('settings.alertsAlarmsFoot', { friday: prayerName('dhuhr', s.naming, true) })}>
        <button class="item" onClick={() => openSheet({ kind: 'wakeup' })}>
          <AlarmClock size={20} /><span class="label">{tr('settings.alertsAlarms')}<span class="sub">{alertsSummary}</span></span>
          <span class="value">{wakeValue}</span><ChevronRight size={16} class="secondary" />
        </button>
      </Group>

      <Group title={tr('settings.ramadan')} foot={<>
        {tr('settings.ramadanFoot')} {(() => { const d = daysToRamadan(s.now()); return d != null && d > 0 && !s.isSeasonPreview ? tr('settings.aboutDays', { n: d }) : '' })()}
        {' '}{tr('settings.tryRamadanFoot', { where: s.demo ? tr('settings.demo') : tr('settings.browser') })}
      </>}>
        <button class="item" onClick={() => openSheet({ kind: 'ramadan' })}>
          <MoonStar size={20} /><span class="label">{tr('settings.ramadanPage')}<span class="sub">{tr('settings.ramadanPageSub')}</span></span><ChevronRight size={16} class="secondary" />
        </button>
        <SelectItem label={tr('settings.tryRamadan')} value={p.seasonPreview}
          options={SEASON_PREVIEWS.map((v) => ({ value: v, label: tr(`preview.${v}`) }))}
          onChange={(v) => store.update((x) => { x.seasonPreview = v as SeasonPreview })} />
      </Group>


      <Group title={tr('settings.travel')} foot={tr('settings.travelFoot')}>
        <ToggleItem label={tr('settings.musafir')} on={p.musafirEnabled} onChange={(v) => store.update((x) => { x.musafirEnabled = v })} />
        {p.musafirEnabled && (
          <button class="item" onClick={() => openSheet({ kind: 'journey' })}><TabJourney size={20} /><span class="label">{tr('settings.journey')}</span><ChevronRight size={16} class="secondary" /></button>
        )}
      </Group>

      <Group title={tr('settings.calculation')} foot={<>{s.sourceSummary} {tr('settings.calculationFoot')} {s.method.note}</>}>
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
        <div class="item"><span class="label">{tr('settings.timetable')}</span><span class="value">{timetable}</span></div>
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

      <Group title={tr('settings.language')} foot={tr('settings.languageFoot')}>
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

      <Group title={tr('settings.hadith')} foot={tr('settings.hadithFoot')}>
        <ToggleItem label={tr('settings.showHadith')} sub={tr('settings.showHadithSub')} on={p.showHadith}
          onChange={(v) => store.update((x) => { x.showHadith = v; if (v) x.hiddenHadith = [] })} />
        <ToggleItem label={tr('settings.wakeHadith')} sub={tr('settings.wakeHadithSub')} on={p.hadithInAlerts}
          onChange={(v) => store.update((x) => { x.hadithInAlerts = v })} />
      </Group>

      <Group title={tr('settings.tracker')} foot={tr('settings.trackerFoot')}>
        <ToggleItem label={tr('settings.trackerOn')} on={p.trackerEnabled} onChange={(v) => store.update((x) => { x.trackerEnabled = v })} />
      </Group>

      <Group title={tr('settings.display')}>
        <SelectItem label={tr('settings.appearance')} value={p.appearance} options={APPEARANCES.map((a) => ({ value: a, label: appearanceLabel(a) }))}
          onChange={(v) => store.update((x) => { x.appearance = v as Appearance })} />
        <SelectItem label={tr('settings.prayerScreen')} value={p.todayStyle} options={TODAY_STYLES.map((t) => ({ value: t, label: styleLabel(t) }))}
          onChange={(v) => store.update((x) => { x.todayStyle = v as TodayStyle })} />
        <ToggleItem label={tr('settings.biggerText')} on={p.largeText} onChange={(v) => store.update((x) => { x.largeText = v })}
          sub={tr('settings.biggerTextSub')} />
        <ToggleItem label={tr('settings.opening')} on={p.showOpening} onChange={(v) => store.update((x) => { x.showOpening = v })}
          sub={tr('settings.openingSub')} />
        <ToggleItem label={tr('settings.hour24')} on={p.use24Hour} onChange={(v) => store.update((x) => { x.use24Hour = v })} />
        <div class="item">
          <span class="label">{tr('settings.hijriAdjust')}</span>
          <span class="value">{p.hijriAdjustment === 0 ? tr('common.none') : `${p.hijriAdjustment > 0 ? '+' : ''}${tr('settings.days', { n: p.hijriAdjustment })}`}</span>
          <span class="stepper">
            <button aria-label={tr('settings.dayEarlier')} disabled={p.hijriAdjustment <= -2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.max(-2, x.hijriAdjustment - 1) })}>−</button>
            <button aria-label={tr('settings.dayLater')} disabled={p.hijriAdjustment >= 2} onClick={() => store.update((x) => { x.hijriAdjustment = Math.min(2, x.hijriAdjustment + 1) })}>+</button>
          </span>
        </div>
      </Group>




      <Group title={tr('settings.moving')} foot={tr('settings.movingFoot')}>
        <button class="item" onClick={() => openSheet({ kind: 'move-out' })}>
          <ArrowRightLeft size={20} /><span class="label">{tr('move.title')}</span><ChevronRight size={16} class="secondary" />
        </button>
        <button class="item" onClick={() => openSheet({ kind: 'move-in' })}>
          <ArrowDownToLine size={20} /><span class="label">{tr('move.bringIn')}</span><ChevronRight size={16} class="secondary" />
        </button>
      </Group>

      {appOffer && (
        <Group title={tr('settings.phoneApp')} foot={appOffer.detail}>
          <a class="item" href={appOffer.href} target={appOffer.kind === 'ask' ? undefined : '_blank'} rel="noopener">
            <Smartphone size={20} /><span class="label">{appOffer.title}</span><ChevronRight size={16} class="secondary" />
          </a>
        </Group>
      )}

      {!isStandalone() && (
        <Group title={tr('settings.install')} foot={tr('settings.installFoot')}>
          <button class="item" onClick={() => (canInstall() ? void install() : openSheet({ kind: 'install' }))}>
            <Smartphone size={20} /><span class="label">{tr('settings.addHome')}</span><ChevronRight size={16} class="secondary" />
          </button>
        </Group>
      )}

      <Group title={tr('settings.help')} foot={tr('settings.helpFoot')}>
        <button class="item" onClick={() => openSheet({ kind: 'guide' })}>
          <Lightbulb size={20} /><span class="label">{tr('settings.showGuide')}</span><ChevronRight size={16} class="secondary" />
        </button>
      </Group>

      <Group title={tr('settings.accuracy')}>
        <p class="item footnote" style={{ display: 'block', lineHeight: 1.4 }}>{tr('settings.accuracyFoot')}</p>
      </Group>

      <Group title={tr('settings.privacy')} foot={<a href="../privacy.html">{tr('settings.privacyFull')}</a>}>
        <div class="item footnote"><Hand size={18} />{tr('settings.privacy1')}</div>
        <div class="item footnote"><MapPinOff size={18} />{tr('settings.privacy2')}</div>
        <ToggleItem label={tr('settings.usage')} on={p.shareUsage} onChange={(v) => store.update((x) => { x.shareUsage = v })}
          sub={tr('settings.usageSub')} />
        <div class="item footnote"><MapPinned size={18} />{tr('settings.osm')}</div>
      </Group>

      <Group id="makers" title={PICKS_NAME} foot={<>{tr('settings.picksFoot')} <a href="https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/community-cards.md" target="_blank" rel="noopener noreferrer">{tr('settings.picksRules')}</a></>}>
        <div class="makers-list">{ourCards(store.offerCountry, new Date()).map((c) => <MakersCard card={c} placement="settings" />)}</div>
        <ToggleItem label={tr('settings.showPicks')} on={p.showOffers} onChange={(v) => store.update((x) => { x.showOffers = v })} />
      </Group>

      <Group foot={tr('settings.motto')}>
        <a class="item" href="../"><span class="label">{tr('settings.aboutApp')}</span><ChevronRight size={16} class="secondary" /></a>
        <button class="item" onClick={() => openSheet({ kind: 'review' })}><Star size={18} class="accent" /><span class="label">{tr('settings.rate')}</span><ChevronRight size={16} class="secondary" /></button>
        <button class="item" onClick={() => openSheet({ kind: 'feedback' })}><Mail size={18} class="accent" /><span class="label">{tr('settings.sendNote')}</span><ChevronRight size={16} class="secondary" /></button>
        <button class="item" onClick={() => openSheet({ kind: 'credits' })}><span class="label">{tr('settings.sources')}</span><ChevronRight size={16} class="secondary" /></button>
        <a class="item" href="https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer"><span class="label">{tr('settings.helpVerify')}</span><ChevronRight size={16} class="secondary" /></a>
        <a class="item" href="https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md" target="_blank" rel="noopener noreferrer"><span class="label">{tr('settings.designLook')}</span><ChevronRight size={16} class="secondary" /></a>
        <div class="item"><span class="label">{tr('settings.version')}</span><span class="value">{VERSION}</span></div>
      </Group>
    </div>
  )
}

/** The app's own card: the icon on the navy compass-ring colour, kawung batik and cream stitching. */
function AppCard() {
  return (
    <a class="app-card" href="../" aria-label={tr('settings.aboutVersion', { v: VERSION })}>
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
    </a>
  )
}

