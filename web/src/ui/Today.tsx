import type { ComponentChildren } from 'preact'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import {
  AlarmClock, BellOff, BellRing, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, Ellipsis,
  CloudMoon, Globe, Heart, Palette, Star, MapPin, Navigation, Smartphone, Sparkles, Sun, Undo2, Utensils, X,
} from 'lucide-preact'
import { BLESSED_NAME, type BlessedTime } from '../core/blessed'
import { extraMode, isExtra, nextExtraMode, type ExtraTime } from '../core/extraAlerts'
import { stopAlarm } from '../services/alarmSound'
import type { PrayerDay } from '../core/engine'
import { parameterSummary } from '../core/methods'
import { isInAsia, placeProfile } from '../core/place'
import { isObligatory, lead, openPrayer, PRAYERS, type Prayer } from '../core/prayer'
import { LONG_DAYS_WORDS } from '../core/longDays'
import { flag } from '../core/regions'
import { noonDaysAfter } from '../core/tz'
import { nudgeAt } from '../core/window'
import { alertSupport, permission, requestPermission } from '../services/notifications'
import { TODAY_STYLES } from '../services/prefs'
import { readString, writeString } from '../services/storage'
import { store, useNow, useStore } from '../services/store'
import { cycleAlert, ModeIcon, modeWord, WakeChip } from './WakeUp'
import { alertMode, allFiveNotify } from '../core/alertMode'
import { fmtDate, openSheet, Segmented, useDayRequests, short, SourceLine, Switch, TimeText } from './common'
import { HomeQuestion } from './Sheets'
import { DayDial, GoldDial, SunPath, tint } from './Dials'
import { cardOfTheDay, cardURL } from '../core/communityCards'
import { MakersCard, PICKS_NAME } from './Makers'
import { appBannerShownByBrowser, isStandalone, phoneAppOffer } from './pwa'
import { TabJourney } from './icons'
import { SeasonCard } from './Ramadan'
import { Hadith } from './Hadith'
import { blessedNote, styleLabel, tr } from '../core/appWords'

type Moment = { prayer: Prayer; time: number } | null


/** The new style's name, shown for a moment after switching. */
function useToast(): [string | null, (s: string) => void] {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  return [toast, (s: string) => {
    setToast(s)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 1400)
  }]
}

async function turnOnAlerts(only?: Prayer) {
  if (alertSupport() !== 'supported') { openSheet({ kind: 'alerts-help' }); return }
  const ok = await requestPermission()
  if (!ok) { openSheet({ kind: 'alerts-help' }); return }
  store.update((p) => {
    p.notificationsEnabled = true
    p.notifyPrayers = only ? [only] : ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
  })
}

/** The bell: Off, then Notify, then Alarm. The first time, alerts were never on: start with this prayer only. */
function toggleNotify(prayer: Prayer) {
  if (!store.prefs.notificationsEnabled && alertMode(store.prefs, prayer) === 'off' && alertSupport() !== 'supported') { openSheet({ kind: 'alerts-help' }); return }
  announce(cycleAlert(prayer))
}

/** The bell on Dhuha, the middle of the night and the last third: Off, Notify, Alarm. */
function cycleExtra(b: ExtraTime) {
  const next = nextExtraMode(store.prefs, b)
  store.update((p) => { p.extraAlerts = { ...p.extraAlerts, [b]: next } })
  if (next === 'off') stopAlarm()
  else if (alertSupport() === 'supported') void requestPermission()
  announce(tr(next === 'off' ? 'alerts.nowOff' : next === 'notify' ? 'alerts.nowNotify' : 'alerts.nowAlarm', { name: BLESSED_NAME[b] }))
}

function ExtraBell({ b }: { b: BlessedTime }) {
  if (!isExtra(b)) return <span style={{ width: '30px', flex: 'none' }} />
  const mode = extraMode(store.prefs, b)
  return (
    <button class={`bell bell-${mode}`} aria-label={tr('today.bellAria', { name: BLESSED_NAME[b], mode: modeWord(mode) })}
      onClick={(e) => { e.stopPropagation(); cycleExtra(b) }}>
      <ModeIcon mode={mode} />
    </button>
  )
}

/** Read out what the bell changed, for screen reader users. */
function announce(text: string) {
  const el = document.getElementById('bell-status')
  if (el) el.textContent = text
}

export function TodayScreen() {
  const s = useStore()
  const now = useNow()
  const [offset, setOffset] = useState(0)
  useDayRequests(setOffset)
  const [showMore, setShowMoreState] = useState(() => s.demo ? s.demo.more : readString('today.showMore') === '1')
  const [toast, showToast] = useToast()
  const setShowMore = (v: boolean) => { setShowMoreState(v); if (!s.demo) writeString('today.showMore', v ? '1' : '0') }
  const day = s.day(now)
  if (!day) return <NoPlace />
  const shown = offset === 0 ? day : s.day(noonDaysAfter(now, offset, s.timeZone)) ?? day
  const ctx: Ctx = {
    now, day, shown, offset, setOffset, showMore, setShowMore, showToast,
    current: s.current(now), next: s.next(now),
  }
  const style = s.prefs.todayStyle
  return (
    <div class={`today style-${style}`} data-theme-local={style === 'bands' ? 'dark' : undefined}>
      <h1 class="sr-only">{s.activePlace ? tr('today.titleIn', { place: s.activePlace.name }) : tr('today.title')}</h1>
      <p id="bell-status" class="sr-only" aria-live="polite" />
      {style === 'centre' && <CentrePage c={ctx} />}
      {style === 'sunPath' && <SunPathPage c={ctx} />}
      {style === 'bands' && <BandsPage c={ctx} />}
      {style === 'simple' && <SimplePage c={ctx} />}
      {style === 'gold' && <GoldPage c={ctx} />}
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  )
}

interface Ctx {
  now: number; day: PrayerDay; shown: PrayerDay; offset: number; setOffset: (n: number) => void
  showMore: boolean; setShowMore: (v: boolean) => void; showToast: (s: string) => void
  current: Moment; next: Moment
}

// ---------- Buttons ----------

/** The menu: pick a look, change light or dark, go to the website. */
function MenuButton({ c }: { c: Ctx }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [looks, setLooks] = useState(false)
  const card = store.prefs.showOffers ? cardOfTheDay(store.offerCountry, new Date(c.now)) : null
  const ref = useRef<HTMLButtonElement>(null)
  const a = store.prefs.appearance
  const open = () => {
    const r = ref.current!.getBoundingClientRect()
    setMenu({ x: Math.max(12, Math.min(r.right - 262, window.innerWidth - 274)), y: r.bottom + 8 })
  }
  const pick = (style: (typeof TODAY_STYLES)[number]) => {
    store.update((p) => { p.todayStyle = style })
    c.showToast(styleLabel(style))
  }
  return (
    <>
      <button ref={ref} class="round-btn" aria-haspopup="menu" aria-expanded={!!menu} aria-label={tr('today.styleButton', { name: styleLabel(store.prefs.todayStyle) })} onClick={open}>
        <Ellipsis size={18} strokeWidth={2.4} />
      </button>
      {menu && (
        <div class="sheet-backdrop" style={{ background: 'rgba(0,0,0,0.28)' }} onClick={() => { setMenu(null); setLooks(false) }}>
          <div class="menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }} role="menu" onClick={(e) => e.stopPropagation()}>
            {looks ? (
              <>
                <button role="menuitem" class="mi" onClick={() => setLooks(false)}><ChevronLeft size={20} /><span>{tr('menu.back')}</span></button>
                {TODAY_STYLES.map((st) => (
                  <button role="menuitemradio" aria-checked={st === store.prefs.todayStyle} class="mi" onClick={() => { setMenu(null); setLooks(false); pick(st) }}>
                    <span class="mi-tick">{st === store.prefs.todayStyle && <CircleCheck size={20} />}</span>
                    <span>{styleLabel(st)}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div class="mi mi-block">
                  <div class="mi-cap">{tr('menu.appearance').toLocaleUpperCase()}</div>
                  <Segmented value={a} onChange={(v) => store.update((p) => { p.appearance = v })}
                    options={[{ value: 'system', label: tr('menu.auto') }, { value: 'light', label: tr('menu.light') }, { value: 'dark', label: tr('menu.dark') }]} />
                </div>
                <button role="menuitem" class="mi" onClick={() => setLooks(true)}>
                  <Palette size={20} /><span>{tr('menu.lookAndFeel')}</span><em>{styleLabel(store.prefs.todayStyle)}</em>
                </button>
                <button role="menuitem" class="mi" onClick={() => { setMenu(null); openSheet({ kind: 'tracker' }) }}>
                  <CircleCheck size={20} /><span>{tr('menu.streak')}</span><em>{!store.prefs.trackerEnabled ? tr('common.off') : store.trackerPaused ? tr('today.trackerPaused').replace(/^,\s*/, '') : store.isExcused(c.now) ? tr('today.trackerExcused').replace(/^,\s*/, '') : tr('menu.days', { n: store.streak(c.now) })}</em>
                </button>
                {!isStandalone() && (
                  <a role="menuitem" class="mi" href="../"><Globe size={20} /><span>prayertimes.asia</span><em>↗</em></a>
                )}
                {card && (
                  <a role="menuitem" class="mi mi-pick" href={cardURL(card, 'menu')} target="_blank" rel="noopener noreferrer sponsored"
                    onClick={() => store.countCard('Card.tapped', { id: card.id, kind: card.kind, placement: 'menu' })}>
                    <Heart size={20} /><span><small>{(card.kind === 'sponsor' ? `${PICKS_NAME} · ${tr('makers.sponsored')}` : PICKS_NAME).toLocaleUpperCase()}</small>{card.title}</span><em>↗</em>
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** The luggage button. On pages with the big Musafir line it only shows once that line is closed. */
function JourneyButton({ now, withChip = false }: { now: number; withChip?: boolean }) {
  if (!store.prefs.musafirEnabled || store.musafirStatus(now)?.kind !== 'traveller') return null
  if (withChip && !store.prefs.musafirChipDismissed) return null
  return (
    <button class="round-btn" style={{ background: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}
      aria-label={tr('today.musafirButton')} onClick={() => openSheet({ kind: 'journey' })}>
      <TabJourney size={18} />
    </button>
  )
}

/** Top right of every look: the trip button when travelling, streak, the alarm, and the menu. */
function Controls({ c }: { c: Ctx }) {
  return (
    <>
      <JourneyButton now={c.now} />
      <WakeChip now={c.now} open={() => openSheet({ kind: 'wakeup' })} />
      <MenuButton c={c} />
    </>
  )
}

function PlaceLabel() {
  const place = store.activePlace
  return (
    <>
      {store.prefs.useGPS ? <Navigation size={11} fill="currentColor" class={store.isCheckingLocation ? 'checking-location' : undefined} /> : <MapPin size={12} />}
      <span class="place-name" style={(place?.name.length ?? 0) > 11 ? { fontSize: '0.87em' } : undefined}>{place?.name ?? tr('masjid.choosePlace')}</span>
      {place && isInAsia(place) && <span class="flag">{flag(placeProfile(place).code)}</span>}
      <ChevronDown size={12} strokeWidth={3} style={{ opacity: 0.6 }} />
    </>
  )
}

function PlaceChip() {
  return <button class="place-chip" onClick={() => openSheet({ kind: 'places' })} aria-label={tr('today.changeLocation')}><PlaceLabel /></button>
}

/** The quiet "Show more" link at the foot of the list card (Centre Dial). */
function ShowMoreLink({ c }: { c: Ctx }) {
  return (
    <button class="more-link" onClick={() => c.setShowMore(!c.showMore)} aria-expanded={c.showMore}
      aria-label={`${c.showMore ? tr('common.showLess') : tr('common.showMore')}, ${tr('today.blessedTimes', { name: store.name('sunrise') })}`}>
      {c.showMore ? tr('common.showLess') : tr('common.showMore')}
      {c.showMore ? <ChevronUp size={22} strokeWidth={2.2} /> : <ChevronDown size={22} strokeWidth={2.2} />}
    </button>
  )
}

/** Today's one community card, below the times and only with Show more open (docs/community-cards.md). */
function Offer({ c }: { c: Ctx }) {
  if (!store.prefs.showOffers || !c.showMore) return null
  // Never in the half hour before Berbuka in Ramadan.
  if (c.next?.prayer === 'maghrib' && c.next.time - c.now < 30 * 60_000 && store.season(c.now).phase === 'ramadan') return null
  const card = cardOfTheDay(store.offerCountry, new Date(c.now))
  return card && <MakersCard card={card} placement="prayer" compact />
}

/** One prompt at a time: the phone app first, since its alerts ring even when it's closed. */
/** Before Subuh and before Asar: the hadith of the two cool prayers. Today only, and only on the list pages. */
function PrayerHadith({ c }: { c: Ctx }) {
  if (c.offset !== 0 || !store.prefs.showHadith) return null
  const n = c.next?.prayer
  if (n !== 'fajr' && n !== 'asr') return null
  return <Hadith id="coolPrayers" tag={tr('today.before', { name: store.name(n, c.next!.time) })} />
}

function TopPrompt() {
  return phoneAppOffer() && !store.prefs.appPromptDismissed && !appBannerShownByBrowser() ? <AppPrompt /> : <AlertsPrompt />
}

/** On a phone, offer the iPhone or Android app. */
function AppPrompt() {
  const offer = phoneAppOffer()
  if (!offer) return null
  return (
    <div class="alerts-prompt">
      <Smartphone size={19} class="accent" style={{ flex: 'none' }} />
      <span class="text">{offer.title}</span>
      <a class="primary-btn" href={offer.href} target={offer.kind === 'ask' ? undefined : '_blank'} rel="noopener">{offer.action}</a>
      <button class="x" aria-label={tr('common.notNow')} onClick={() => store.update((p) => { p.appPromptDismissed = true })}><X size={15} strokeWidth={3} /></button>
    </div>
  )
}

/**
 * Once ever, after ten separate days of use: a quiet line asking for a note to the
 * makers. Never close to a prayer, never twice. Closing it or using it ends it.
 */
function NotePrompt({ c }: { c: Ctx }) {
  const p = store.prefs
  if (c.offset !== 0 || p.noteCardDone || p.reviewTappedAt > 0 || p.openDayCount < 10) return null
  if (c.next && c.next.time - c.now < 15 * 60_000) return null
  const done = () => store.update((x) => { x.noteCardDone = true })
  return (
    <div class="alerts-prompt note-prompt">
      <Star size={18} class="accent" style={{ flex: 'none' }} />
      <span class="text">{tr('today.reviewAsk')}</span>
      <button class="primary-btn" onClick={() => { done(); openSheet({ kind: 'review' }) }}>{tr('today.review')}</button>
      <button class="x" aria-label={tr('common.notNow')} onClick={done}><X size={15} strokeWidth={3} /></button>
    </div>
  )
}

/** One tap to be told when each prayer begins. */
function AlertsPrompt() {
  // Alerts are on by default, but still ask once if the browser has not been asked yet.
  if ((store.prefs.notificationsEnabled && permission() !== 'default') || store.prefs.alertsPromptDismissed) return null
  return (
    <div class="alerts-prompt">
      <BellRing size={19} class="accent" fill="currentColor" style={{ flex: 'none' }} />
      <span class="text">{tr('today.alertPrompt')}</span>
      <button class="primary-btn" onClick={() => void turnOnAlerts()}>{tr('common.turnOn')}</button>
      <button class="x" aria-label={tr('common.notNow')} onClick={() => store.update((p) => { p.alertsPromptDismissed = true })}><X size={15} strokeWidth={3} /></button>
    </div>
  )
}

/** Far from the equator in summer: why Fajr and Isha look unusual. Once per place and summer, closable. */
function LongDaysNote({ now }: { now: number }) {
  const key = store.longDaysNote(now)
  if (!key) return null
  const w = LONG_DAYS_WORDS[store.appLang]
  return (
    <div class="glass card arrival long-days" role="note">
      <div class="row" style={{ alignItems: 'flex-start', gap: '12px' }}>
        <Sun size={26} class="accent" style={{ flex: 'none', marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div class="headline">{w.title}</div>
          <div class="subhead" style={{ opacity: 0.85, marginTop: '4px' }}>{w.body(store.name('fajr'), store.name('isha'))}</div>
        </div>
        <button aria-label={w.close} onClick={() => store.closeLongDaysNote(key)} style={{ padding: '6px' }}><X size={16} strokeWidth={3} /></button>
      </div>
    </div>
  )
}

function ArrivalCard() {
  if (store.prefs.arrivalBannerDismissed) return null
  const profile = store.profile
  const method = store.method
  return (
    <div class="glass card arrival">
      <div class="row" style={{ alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '34px', lineHeight: 1 }}>{profile.code ? flag(profile.code) : '🌏'}</span>
        <div style={{ flex: 1 }}>
          <div class="headline">{profile.code ? tr('today.welcomeTo', { place: profile.name }) : tr('today.welcome')}</div>
          <div class="subhead" style={{ opacity: 0.85, marginTop: '4px' }}>
            {store.isMethodAutomatic ? tr('today.switched', { method: method.name, country: parameterSummary(method) })
              : tr('today.pinned', { method: method.shortName })}
          </div>
          <div class="caption" style={{ opacity: 0.75, marginTop: '6px' }}>
            {store.sourceShort}
          </div>
        </div>
        <button aria-label={tr('common.dismiss')} onClick={() => store.update((p) => { p.arrivalBannerDismissed = true })} style={{ padding: '6px' }}><X size={16} strokeWidth={3} /></button>
      </div>
      <hr />
      <div class="row arrival-row">
        <div style={{ flex: 1 }}><div class="subhead" style={{ fontWeight: 600 }}>{tr('today.switchAuto')}</div><div class="caption" style={{ opacity: 0.75 }}>{tr('today.switchAutoSub')}</div></div>
        <Switch label={tr('today.switchAuto')} on={store.isMethodAutomatic} onChange={(auto) => { const id = store.method.id; store.update((p) => { p.methodOverrideID = auto ? null : id }) }} />
      </div>
      {store.prefs.home?.countryCode && store.prefs.home.countryCode !== profile.code && (
        <div class="row arrival-row">
          <div style={{ flex: 1 }}><div class="subhead" style={{ fontWeight: 600 }}>{tr('settings.musafir')}</div><div class="caption" style={{ opacity: 0.75 }}>{tr('today.musafirSub')}</div></div>
          <Switch label={tr('settings.musafir')} on={store.prefs.musafirEnabled} onChange={(v) => store.update((p) => { p.musafirEnabled = v })} />
        </div>
      )}
      {store.prefs.musafirEnabled && !store.prefs.homeConfirmed && <HomeQuestion />}
      <label class="row arrival-row">
        <span class="subhead" style={{ fontWeight: 600, flex: 1 }}>{tr('settings.asr')}</span>
        <select class="inline-select" value={store.prefs.asrOverride ?? 'auto'}
          onChange={(e) => { const v = (e.target as HTMLSelectElement).value; store.update((p) => { p.asrOverride = v === 'auto' ? null : (v as 'standard' | 'hanafi') }) }}>
          <option value="auto">{tr('common.nameAutomatic', { name: store.asrSchool === 'hanafi' ? tr('today.asrHanafi') : tr('today.asrShafii') })}</option>
          <option value="standard">{tr('today.asrShafii')}</option>
          <option value="hanafi">{tr('today.asrHanafi')}</option>
        </select>
      </label>
    </div>
  )
}

/** Horizontal swipe on the times moves a day. */
function useSwipe(c: Ctx) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: PointerEvent) => { start.current = { x: e.clientX, y: e.clientY } },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x, dy = e.clientY - s.y
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 2) c.setOffset(c.offset + (dx < 0 ? 1 : -1))
    },
    onPointerCancel: () => { start.current = null },
  }
}

function hijri(ms: number) {
  return store.hijriLabel(ms)
}

/** Show more adds every blessed time; in Ramadan, Imsak is always shown. */
function visibleBlessed(c: Ctx, day: PrayerDay): [BlessedTime, number][] {
  const all = store.blessed(day)
  return c.showMore ? all : all.filter(([b]) => b === 'imsak')
}

function dateTap(c: Ctx) {
  if (c.offset === 0) openSheet({ kind: 'calendar' })
  else c.setOffset(0)
}

// ---------- The list ----------

type Entry = { kind: 'prayer'; p: Prayer; t: number } | { kind: 'blessed'; b: BlessedTime; t: number }

function entries(c: Ctx, day: PrayerDay): Entry[] {
  const list: Entry[] = PRAYERS.map((p) => ({ kind: 'prayer', p, t: day.times[p] }))
  for (const [b, t] of visibleBlessed(c, day)) list.push({ kind: 'blessed', b, t })
  return list.sort((a, b) => a.t - b.t)
}

function PrayerList({ c, fill, slim, footer }: { c: Ctx; fill: boolean; slim?: boolean; footer?: ComponentChildren }) {
  const day = c.shown
  const list = entries(c, day)
  const swipe = useSwipe(c)
  const current = c.offset === 0 ? openPrayer(c.current)?.prayer : null
  const next = c.offset === 0 ? c.next : null
  const prayerRows = list.filter((e) => e.kind === 'prayer').length
  // Tapping Syuruk opens a short hadith on why it is not a prayer time.
  const [syuruk, setSyuruk] = useState(false)
  const syurukOpen = syuruk && store.prefs.showHadith && !store.prefs.hiddenHadith.includes('syuruk')
  return (
    <div class={`list-wrap ${fill ? 'fill' : ''}`} {...swipe}>
      <div class={`prayer-list glass ${slim ? 'slim' : ''}`} style={fill && !slim ? { maxHeight: `${prayerRows * 92 + (list.length - 1) * 6 + 16 + (list.length - prayerRows) * 66 + (syurukOpen ? 200 : 0)}px` } : slim ? { '--rows': list.length, '--extra': syurukOpen ? '240px' : '0px' } : undefined}>
        {list.map((e) => e.kind === 'prayer'
          ? <>
              <PrayerRow slim={slim} lit={slim ? e.p === (current ?? next?.prayer) && c.offset === 0 : false} p={e.p} t={e.t} now={c.now} day={day} isCurrent={e.p === current && e.t <= c.now} next={next?.prayer === e.p && next.time === e.t ? next : null}
                onTap={e.p === 'sunrise' && store.prefs.showHadith ? () => setSyuruk(!syuruk) : undefined} />
              {e.p === 'sunrise' && syurukOpen && <div class="syuruk-hadith"><Hadith id="syuruk" variant="line" /></div>}
            </>
          : <BlessedRow b={e.b} t={e.t} now={c.now} />)}
        {footer}
      </div>
      <AllFiveLine />
    </div>
  )
}

/** All five on Notify and the browser lets us show them: only then is it true to say so. */
function allFiveOn(): boolean {
  return allFiveNotify(store.prefs) && permission() === 'granted'
}

/** Shown instead of five identical bells: every main prayer is on Notify. */
function AllFiveLine() {
  if (!allFiveOn()) return null
  return (
    <button class="all-five-line" onClick={() => openSheet({ kind: 'wakeup' })}>
      <BellRing size={14} />
      <span>{tr('today.allFiveOn')}</span>
      <b>{tr('today.allFiveChange')}</b>
    </button>
  )
}

/** "Jamaah 1:20 PM", with a countdown between the azan and the iqamah. */
function jamaahText(day: PrayerDay, p: Prayer, now: number): string | null {
  const j = day.jamaah[p]
  if (j == null) return null
  return day.times[p] <= now && now < j ? `Jamaah ${store.formatted(j)} · in ${short(j - now)}` : `Jamaah ${store.formatted(j)}`
}

function PrayerRow({ p, t, now, day, isCurrent, next, onTap, slim, lit }: { p: Prayer; t: number; now: number; day: PrayerDay; isCurrent: boolean; next: Moment; onTap?: () => void; slim?: boolean; lit?: boolean }) {
  const prefs = store.prefs
  const passed = t <= now && !isCurrent
  const mode = alertMode(prefs, p)
  // All five on Notify: no repeating bells, one line under the list says so.
  const hideBell = isObligatory(p) && allFiveOn()
  const trackable = prefs.trackerEnabled && isObligatory(p) && t <= now
  const prayed = trackable && store.isPrayed(p, t)
  const local = store.localName(p, t)
  const jamaah = jamaahText(day, p, now)
  const other = day.alternate[p]
  return (
    <div class={`prayer-row ${isCurrent || lit ? 'current' : ''} ${lit ? 'lit' : ''} ${passed ? 'past' : ''}`} style={{ '--tint': tint(p), '--tint-soft': tint(p, 0.16), '--tint-line': tint(p, 0.45), opacity: passed && !prayed ? 0.55 : 1 }}
      onClick={() => { if (trackable) openSheet({ kind: 'log-prayer', prayer: p, t }); else onTap?.() }}>
      <span class="bar" style={{ opacity: isCurrent ? 1 : 0.55 }} />
      <div class="names">
        <div class="name-line">
          <span class="pname">{store.name(p, t)}</span>
          {local && <span class="local" aria-label={tr('today.calledHere', { name: local })}>{local}</span>}
          {prayed && (slim ? <span class="tick" aria-hidden="true"><Check size={11} strokeWidth={3.4} /></span> : <CheckCircle2 size={16} class="check" fill="var(--accent)" color="var(--bg-check, #fff)" />)}
          {prayed && <PrayedTime store={store} p={p} t={t} />}
        </div>
        {isCurrent && <div class="now-tag">{tr('today.now')}</div>}
        {!isCurrent && next && <div class="in-tag mono">{tr('today.inTime', { time: short(next.time - now) })}</div>}
        {jamaah && <div class="extra">{jamaah}</div>}
        {other != null && day.alternateSource && <div class="extra alt">{day.alternateSource} {store.formatted(other)}</div>}
      </div>
      <TimeText ms={t} size={slim ? 20 : 29} />
      {hideBell ? <span class="bell bell-none" aria-hidden="true" /> : (
        <button class={`bell bell-${mode}`} aria-label={tr('today.bellAria', { name: store.name(p, t), mode: modeWord(mode) })}
          onClick={(e) => { e.stopPropagation(); toggleNotify(p) }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openSheet({ kind: 'wakeup', prayer: p }) }}>
          <ModeIcon mode={mode} />
        </button>
      )}
    </div>
  )
}

function BlessedRow({ b, t, now }: { b: BlessedTime; t: number; now: number }) {
  return (
    <div class="blessed-row" style={{ opacity: t <= now ? 0.55 : 0.9 }}>
      <span class="bar" />
      <div class="names">
        <div class="bname">{BLESSED_NAME[b]}</div>
        <div class="bnote">{blessedNote(b)}</div>
      </div>
      <TimeText ms={t} size={22} weight={500} />
      <ExtraBell b={b} />
    </div>
  )
}

const BLESSED_ICON: Record<BlessedTime, typeof Sun> = { imsak: Utensils, dhuha: Sun, midnight: CloudMoon, lastThird: Sparkles }

function useSize(ref: { current: HTMLElement | null }, fallback: number) {
  const [size, setSize] = useState({ w: fallback, h: fallback })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return size
}
const useWidth = (ref: { current: HTMLElement | null }, fallback: number) => useSize(ref, fallback).w

function SmallDial({ c, size, gold }: { c: Ctx; size: number; gold?: boolean }) {
  const { now, day, current, next } = c
  const tomorrow = store.day(noonDaysAfter(now, 1, store.timeZone))
  const top = lead(current, next)
  if (!top || !tomorrow) return <div style={{ width: `${size}px`, height: `${size}px` }} />
  const t = countdown(now)
  const Dial = gold ? GoldDial : DayDial
  const name = store.name(top.prayer, top.time)
  // In a prayer's time (not yet ticked): the prayer's name, the time left. Otherwise: the next prayer and the wait.
  const inPrayer = !t.toNext
  const kicker = inPrayer ? name : tr('today.nextPrayer')
  const count = inPrayer ? t.count : t.bare
  const label = inPrayer ? t.label : tr('today.untilName', { name: next ? store.name(next.prayer, next.time) : name })
  // Little surprise: for twenty minutes after Maghrib in Ramadan the dial glows warm, the moment to break the fast.
  const iftar = store.prefs.littleSurprises && current?.prayer === 'maghrib' && now - current.time < 20 * 60_000
    && store.season(now).phase === 'ramadan'
  const dial = (
    <Dial size={size} now={now} day={day} nextFajr={tomorrow.times.fajr} tz={store.timeZone}
      kicker={kicker} countdown={count} label={label} urgent={t.urgent}
      ariaLabel={inPrayer ? `${tr('common.now')} ${name}. ${count} ${label}.` : tr('today.nextAria', { name: next ? store.name(next.prayer, next.time) : name, time: count })} />
  )
  return iftar ? <div class="egg-iftar">{dial}</div> : dial
}

// ---------- Time left to pray ----------

/**
 * The one countdown on the Prayer screen. While a prayer is open (and not yet
 * ticked) it says how long is left to pray it: "19m left to pray". Every
 * prayer's time ends when the next one starts (Subuh at Syuruk), so this is
 * the same moment as the next prayer, said the way busy people ask it.
 * Between Syuruk and Zohor, or once ticked, it counts to the next prayer.
 */
export function countdown(now: number): { count: string; label: string; text: string; urgent: boolean; done: boolean; toNext: boolean; bare: string } {
  const w = store.window(now)
  const done = !!w && store.prefs.trackerEnabled && store.isPrayed(w.prayer, w.start)
  if (w && !done) {
    const count = short(w.end - now)
    return { count, label: tr('today.leftLabel'), text: tr('today.leftToPray', { time: count }), urgent: w.prayer !== 'isha' && now >= nudgeAt(w), done, toNext: false, bare: count }
  }
  const next = store.next(now)
  if (!next) return { count: '', label: '', text: '', urgent: false, done, toNext: true, bare: '' }
  // Syuruk to Zohor: the next prayer's name leads, so the count only says when.
  if (!w && store.current(now)?.prayer === 'sunrise') {
    const text = tr('today.inTime', { time: short(next.time - now) })
    return { count: text, label: '', text, urgent: false, done, toNext: true, bare: short(next.time - now) }
  }
  const count = short(next.time - now)
  const label = tr('today.untilName', { name: store.name(next.prayer, next.time) })
  return { count, label, text: `${count} ${label}`, urgent: false, done, toNext: true, bare: count }
}

// ---------- Big and Simple ----------

/**
 * For older eyes and anyone who wants only the times: the prayer and how long
 * to go in big words, then the five times in one big list (v12 mockup).
 * Tap a row to tick it when the tracker is on.
 */
function SimplePage({ c }: { c: Ctx }) {
  const top = lead(c.current, c.next)
  const t = countdown(c.now)
  return (
    <div class="today-page page simple-page v12">
      <div class="row top-bar"><PlaceChip /><span class="spacer" /><Controls c={c} /></div>
      {top && (
        <div class="simple-now">
          <div class="simple-big display">{store.name(top.prayer, top.time)}{t.done && <CheckCircle2 size={30} class="accent" style={{ marginLeft: '8px' }} />}</div>
          {t.text && <div class={`simple-left display ${t.urgent ? 'accent' : ''}`}>{t.text}</div>}
        </div>
      )}
      <TopPrompt />
      <ArrivalCard />
      {c.offset === 0 && <LongDaysNote now={c.now} />}
      {c.offset === 0 && <SeasonCard now={c.now} />}
      <MusafirChip now={c.now} />
      <DayNavigator c={c} slim />
      <PrayerList c={c} fill slim footer={<ShowMoreLink c={c} />} />
      <NotePrompt c={c} />
      <Offer c={c} />
    </div>
  )
}

// ---------- Centre Dial ----------

function DayNavigator({ c, slim }: { c: Ctx; slim?: boolean }) {
  const date = c.shown.times.dhuhr
  return (
    <div class="day-nav">
      <button class="chev" aria-label={tr('today.prevDay')} onClick={() => c.setOffset(c.offset - 1)}><ChevronLeft size={slim ? 26 : 22} strokeWidth={slim ? 2 : 2.4} /></button>
      <button class="day-nav-main" onClick={() => dateTap(c)} aria-label={c.offset === 0 ? tr('today.datesSources') : tr('today.backToToday')}>
        <span class="day-nav-date">{fmtDate(date, slim ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span class="day-nav-hijri">{hijri(date)} {c.offset === 0 ? <Calendar size={slim ? 20 : 12} /> : <Undo2 size={slim ? 18 : 12} />}</span>
      </button>
      <button class="chev" aria-label={tr('today.nextDay')} onClick={() => c.setOffset(c.offset + 1)}><ChevronRight size={slim ? 26 : 22} strokeWidth={slim ? 2 : 2.4} /></button>
    </div>
  )
}

/** Shown when a trip starts. Closing it tucks it away as the luggage button with the others. */
function MusafirChip({ now }: { now: number }) {
  if (!store.prefs.musafirEnabled || store.prefs.musafirChipDismissed || store.musafirStatus(now)?.kind !== 'traveller') return null
  return (
    <div class="musafir-chip">
      <button class="musafir-chip-open" onClick={() => openSheet({ kind: 'journey' })}>
        <TabJourney size={17} /><span style={{ flex: 1, textAlign: 'left' }}>{tr('today.musafirLine')}</span><ChevronRight size={14} strokeWidth={3} />
      </button>
      <button class="musafir-chip-close" aria-label={tr('today.musafirHide')}
        onClick={() => store.update((p) => { p.musafirChipDismissed = true })}><X size={14} strokeWidth={3} /></button>
    </div>
  )
}

function CentrePage({ c, gold }: { c: Ctx; gold?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const width = useWidth(wrap, 393)
  const size = gold ? Math.round(Math.max(160, Math.min(204, width * 0.52))) : Math.round(Math.max(150, Math.min(190, width * 0.485)))
  return (
    <div class="today-page page centre-page v12" ref={wrap}>
      <div class="row top-bar"><PlaceChip /><span class="spacer" /><Controls c={c} /></div>
      <div class="centre-dial"><SmallDial c={c} size={size} gold={gold} /></div>
      <TopPrompt />
      <PrayerHadith c={c} />
      <ArrivalCard />
      {c.offset === 0 && <LongDaysNote now={c.now} />}
      {c.offset === 0 && <SeasonCard now={c.now} />}
      <MusafirChip now={c.now} />
      <DayNavigator c={c} slim />
      <PrayerList c={c} fill slim footer={<ShowMoreLink c={c} />} />
      <SourceLine day={c.shown} />
      <NotePrompt c={c} />
      <Offer c={c} />
    </div>
  )
}

/** Calm Gold: the same calm layout on flat navy (or warm white) with one gold accent. */
function GoldPage({ c }: { c: Ctx }) {
  return <CentrePage c={c} gold />
}

// ---------- Sun Path ----------

function SunPathPage({ c }: { c: Ctx }) {
  const wrap = useRef<HTMLDivElement>(null)
  const width = useWidth(wrap, 393)
  const { next, now } = c
  const nextName = next ? store.name(next.prayer, next.time) : ''
  const top = lead(c.current, next)
  return (
    <div class="today-page page sunpath-page v12">
      <div class="row top-bar"><PlaceChip /><span class="spacer" /><Controls c={c} /></div>
      {top && next && (
        <div class="sun-status" aria-label={top.isNext ? tr('today.nextAt', { next: nextName, time: store.formatted(next.time) }) : tr('today.nowNext', { now: store.name(top.prayer, top.time), next: nextName, time: store.formatted(next.time) })}>
          <div class="sun-name-row">
            <span class="dot" style={{ background: tint(top.prayer) }} />
            <span class="sun-name">{store.name(top.prayer, top.time)}</span>
          </div>
          <span class={`status-pill mono ${countdown(now).urgent ? 'urgent' : ''}`}>{countdown(now).text}</span>
        </div>
      )}
      <div class="sunpath-wrap" ref={wrap}>
        <SunPath width={width} height={120} now={now} day={c.day} tz={store.timeZone} v12 />
      </div>
      <TopPrompt />
      <PrayerHadith c={c} />
      <ArrivalCard />
      {c.offset === 0 && <LongDaysNote now={c.now} />}
      {c.offset === 0 && <SeasonCard now={c.now} />}
      <MusafirChip now={now} />
      <DayNavigator c={c} slim />
      <PrayerList c={c} fill slim footer={<ShowMoreLink c={c} />} />
      <SourceLine day={c.shown} />
      <NotePrompt c={c} />
      <Offer c={c} />
    </div>
  )
}

// ---------- Colour Bands ----------

/** The six band colours of the v10 and v12 mockups. */
const BAND: Record<Prayer, string> = {
  fajr: '#3a6f63', sunrise: '#8a9a52', dhuhr: '#ab8d3a',
  asr: '#cd7d38', maghrib: '#d3705c', isha: '#c9565d',
}

function BandsPage({ c }: { c: Ctx }) {
  const { now, shown, next, offset } = c
  const current = openPrayer(c.current)
  const top = lead(c.current, next)
  const swipe = useSwipe(c)
  const blessed = visibleBlessed(c, shown)
  return (
    <div class="today-page bands-page v12">
      <div class="bands-top page">
        <div class="row top-bar" style={{ gap: '8px' }}><PlaceChip /><span class="spacer" /><Controls c={c} /></div>
        {top && offset === 0 && (
          <div class="bands-hero"><span class="bands-hero-name">{top.isNext ? store.name(top.prayer, top.time) : tr('today.nameNow', { name: store.name(top.prayer, top.time) })}</span><span class="bands-hero-count">{countdown(now).text}</span></div>
        )}
        <TopPrompt />
        <ArrivalCard />
      {c.offset === 0 && <LongDaysNote now={c.now} />}
      {c.offset === 0 && <SeasonCard now={c.now} />}
      </div>
      <div class="bands-date">
        <button aria-label={tr('today.prevDay')} onClick={() => c.setOffset(offset - 1)}><ChevronLeft size={20} strokeWidth={2.6} /></button>
        <button class="bands-date-main" onClick={() => dateTap(c)} aria-label={offset === 0 ? tr('today.datesSources') : tr('today.backToToday')}>
          {offset !== 0 && <Undo2 size={13} />}<span>{fmtDate(shown.times.dhuhr, { day: 'numeric', month: 'short' })} ·</span><span>{hijri(shown.times.dhuhr)}</span>
        </button>
        <button aria-label={tr('today.nextDay')} onClick={() => c.setOffset(offset + 1)}><ChevronRight size={20} strokeWidth={2.6} /></button>
      </div>
      <div class="bands" {...swipe}>
        {PRAYERS.map((p) => <PrayerBand p={p} t={shown.times[p]} jamaah={shown.jamaah[p]} now={now} isCurrent={offset === 0 && p === current?.prayer}
          next={offset === 0 && p === next?.prayer && next.time === shown.times[p] ? next : null} />)}
        {blessed.map(([b, t]) => <BlessedBand b={b} t={t} now={now} />)}
      </div>
      <div class="bands-foot page">
        <div class="row foot-row"><SourceLine day={shown} /><span class="spacer" /><ShowMoreLink c={c} /></div>
        <NotePrompt c={c} />
      <Offer c={c} />
        <AllFiveLine />
        <p class="bands-credit">{tr('bands.credit')}</p>
      </div>
    </div>
  )
}

function PrayerBand({ p, t, jamaah, now, isCurrent, next }: { p: Prayer; t: number; jamaah?: number; now: number; isCurrent: boolean; next: Moment }) {
  const prefs = store.prefs
  const mode = alertMode(prefs, p)
  const hideBell = isObligatory(p) && allFiveOn()
  const trackable = prefs.trackerEnabled && isObligatory(p) && t <= now
  const prayed = trackable && store.isPrayed(p, t)
  const parts = store.timeParts(t)
  const local = store.localName(p, t)
  return (
    <button class={`band ${isCurrent ? 'current' : ''}`} style={{ background: BAND[p] }}
      aria-label={`${store.name(p, t)}, ${store.formatted(t)}${isCurrent ? tr('today.isNow') : ''}${prayed ? tr('today.prayed') : ''}, ${modeWord(mode)}`}
      onClick={() => (trackable ? openSheet({ kind: 'log-prayer', prayer: p, t }) : hideBell ? openSheet({ kind: 'wakeup' }) : toggleNotify(p))}>
      <span class="band-names">
        <span class="row" style={{ gap: '8px', alignItems: 'baseline' }}>
          <span class="band-name">{store.name(p, t)}</span>
          {local && <span class="caption" style={{ fontWeight: 600, opacity: 0.8 }}>{local}</span>}
          {isCurrent && <span class="now-pill">{tr('today.now')}</span>}
          {prayed && <span class="tick" aria-hidden="true"><Check size={11} strokeWidth={3.4} /></span>}
          {prayed && <PrayedTime store={store} p={p} t={t} />}
          {next && <span class="band-in mono">{tr('today.inTime', { time: short(next.time - now) })}</span>}
        </span>
        {isCurrent && jamaah != null && t <= now && now < jamaah && <span class="caption mono" style={{ fontWeight: 600, opacity: 0.85 }}>{tr('today.jamaahIn', { time: short(jamaah - now) })}</span>}
      </span>
      <span class="spacer" />
      <span class="band-time"><span>{parts.time}</span>{parts.suffix && <span class="sfx">{parts.suffix}</span>}</span>
      <span class={`band-bell band-bell-${mode}`} aria-hidden="true" style={hideBell ? { visibility: 'hidden' } : undefined}>{mode === 'alarm' ? <AlarmClock size={22} /> : mode === 'notify' ? <BellRing size={22} /> : <BellOff size={22} />}</span>
    </button>
  )
}

function BlessedBand({ b, t, now }: { b: BlessedTime; t: number; now: number }) {
  const parts = store.timeParts(t)
  const Icon = BLESSED_ICON[b]
  return (
    <div class="blessed-band" style={{ opacity: t <= now ? 0.7 : 1 }}>
      <Icon size={17} style={{ opacity: 0.8, flex: 'none' }} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span class="headline">{BLESSED_NAME[b]}</span>
        <span class="caption" style={{ opacity: 0.7 }}>{blessedNote(b)}</span>
      </span>
      <span class="spacer" />
      <span class="band-time small"><span>{parts.time}</span>{parts.suffix && <span class="sfx">{parts.suffix}</span>}</span>
      <ExtraBell b={b} />
    </div>
  )
}

// ---------- No place yet ----------

function NoPlace() {
  const s = useStore()
  return (
    <div class="no-place page">
      <Navigation size={54} strokeWidth={1.2} />
      <h2 class="display">{s.gpsStatus === 'denied' ? tr('today.locationOff') : s.gpsStatus === 'locating' ? tr('today.finding') : tr('today.whereAreYou')}</h2>
      <p>{tr('today.whereExplain')}</p>
      <button class="primary-btn" onClick={() => openSheet({ kind: 'places' })}>{tr('today.chooseCity')}</button>
    </div>
  )
}

/** The small "6:15 AM" after a tick. Nothing when the setting is off or the time isn't known. */
function PrayedTime({ store, p, t }: { store: typeof import("../services/store").store; p: Prayer; t: number }) {
  const at = store.prayedTime(p, t)
  return at ? <span class="prayed-time mono">{at}</span> : null
}
