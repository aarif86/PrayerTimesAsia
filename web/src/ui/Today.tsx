import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import {
  Bell, BellOff, BellRing, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck,
  CloudMoon, Contrast, Droplet, Flame, MapPin, MoonStar, Navigation, Palette, Plane, Smartphone, Sparkles, Sun, Moon, Undo2, Utensils, X,
} from 'lucide-preact'
import { BLESSED_NAME, BLESSED_NOTE, BLESSED_SHORT, type BlessedTime } from '../core/blessed'
import type { PrayerDay } from '../core/engine'
import { formatHijri } from '../core/hijri'
import { parameterSummary } from '../core/methods'
import { isInAsia, placeProfile } from '../core/place'
import { isObligatory, PRAYERS, type Prayer } from '../core/prayer'
import { flag } from '../core/regions'
import { alertSupport, requestPermission } from '../services/notifications'
import { APPEARANCE_LABEL, APPEARANCES, TODAY_STYLE_LABEL, TODAY_STYLES } from '../services/prefs'
import { readString, writeString } from '../services/storage'
import { store, useNow, useStore } from '../services/store'
import { fmtDate, openSheet, short, SourceBadge, Switch, TimeText } from './common'
import { DayDial, HeroDial, SunPath, tint, type DialMark } from './Dials'
import { featuredOffer, MakersCard } from './Makers'
import { appBannerShownByBrowser, phoneAppOffer } from './pwa'

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

function toggleNotify(prayer: Prayer) {
  if (!store.prefs.notificationsEnabled) { void turnOnAlerts(prayer); return }
  store.update((p) => {
    p.notifyPrayers = p.notifyPrayers.includes(prayer) ? p.notifyPrayers.filter((x) => x !== prayer) : [...p.notifyPrayers, prayer]
  })
}

function dayLabel(offset: number): string {
  if (offset === 0) return 'TODAY'
  if (offset === 1) return 'TOMORROW'
  if (offset === -1) return 'YESTERDAY'
  return offset > 0 ? `IN ${offset} DAYS` : `${-offset} DAYS AGO`
}

export function TodayScreen() {
  const s = useStore()
  const now = useNow()
  const [offset, setOffset] = useState(0)
  const [showMore, setShowMoreState] = useState(() => s.demo ? s.demo.more : readString('today.showMore') === '1')
  const [toast, showToast] = useToast()
  const setShowMore = (v: boolean) => { setShowMoreState(v); if (!s.demo) writeString('today.showMore', v ? '1' : '0') }
  const day = s.day(now)
  if (!day) return <NoPlace />
  const shown = offset === 0 ? day : s.day(now + offset * 86_400_000) ?? day
  const ctx: Ctx = {
    now, day, shown, offset, setOffset, showMore, setShowMore, showToast,
    current: s.current(now), next: s.next(now),
  }
  const style = s.prefs.todayStyle
  return (
    <div class={`today style-${style}`} data-theme-local={style === 'bands' ? 'dark' : undefined}>
      {style === 'list' && <ClassicPage c={ctx} />}
      {style === 'centre' && <CentrePage c={ctx} />}
      {style === 'dial' && <DialPage c={ctx} />}
      {style === 'sunPath' && <SunPathPage c={ctx} />}
      {style === 'bands' && <BandsPage c={ctx} />}
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

/** Automatic (follows the sky) → Light → Dark, one tap each. */
function AppearanceButton({ c }: { c: Ctx }) {
  const a = store.prefs.appearance
  const Icon = a === 'system' ? Contrast : a === 'light' ? Sun : Moon
  return (
    <button class="round-btn" aria-label={`Appearance: ${APPEARANCE_LABEL[a]}. Switches between Automatic, Light and Dark.`}
      onClick={() => {
        const next = APPEARANCES[(APPEARANCES.indexOf(a) + 1) % APPEARANCES.length]
        store.update((p) => { p.appearance = next })
        c.showToast(next === 'system' ? 'Automatic: follows the sky' : APPEARANCE_LABEL[next])
      }}>
      <Icon size={17} strokeWidth={2.4} fill={a === 'system' ? 'none' : 'currentColor'} />
    </button>
  )
}

/** Tap to try the next Prayer screen style; touch and hold (or right-click) to pick one. */
function StyleButton({ c }: { c: Ctx }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const hold = useRef<ReturnType<typeof setTimeout>>()
  const held = useRef(false)
  const ref = useRef<HTMLButtonElement>(null)
  const openMenu = () => {
    const r = ref.current!.getBoundingClientRect()
    setMenu({ x: Math.max(12, Math.min(r.right - 230, window.innerWidth - 242)), y: r.bottom + 8 })
  }
  const pick = (style: (typeof TODAY_STYLES)[number]) => {
    store.update((p) => { p.todayStyle = style })
    c.showToast(TODAY_STYLE_LABEL[style])
  }
  return (
    <>
      <button ref={ref} class="round-btn" aria-label={`Prayer screen style: ${TODAY_STYLE_LABEL[store.prefs.todayStyle]}. Switches to the next style; touch and hold to choose one.`}
        onPointerDown={() => { held.current = false; hold.current = setTimeout(() => { held.current = true; openMenu() }, 500) }}
        onPointerUp={() => clearTimeout(hold.current)} onPointerLeave={() => clearTimeout(hold.current)}
        onContextMenu={(e) => { e.preventDefault(); openMenu() }}
        onClick={() => {
          if (held.current) return
          const all = TODAY_STYLES
          pick(all[(all.indexOf(store.prefs.todayStyle) + 1) % all.length])
        }}>
        <Palette size={17} strokeWidth={2.2} />
      </button>
      {menu && (
        <div class="sheet-backdrop" style={{ background: 'transparent' }} onClick={() => setMenu(null)}>
          <div class="menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }} role="menu">
            {TODAY_STYLES.map((st) => (
              <button role="menuitem" onClick={() => { setMenu(null); pick(st) }}>
                <span style={{ width: '16px' }}>{st === store.prefs.todayStyle && <CircleCheck size={16} />}</span>
                {TODAY_STYLE_LABEL[st]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function StreakChip({ now }: { now: number }) {
  const excused = store.isExcused(now)
  const [menu, setMenu] = useState(false)
  return (
    <span style={{ position: 'relative' }}>
      <button class="streak-chip" onClick={() => setMenu(!menu)} aria-label={`Streak ${store.streak(now)} days${excused ? ', excused today' : ''}`}>
        {excused ? <Droplet size={15} fill="currentColor" /> : <Flame size={15} fill="currentColor" />}
        <span class="mono">{store.streak(now)}</span>
      </button>
      {menu && (
        <div class="sheet-backdrop" style={{ background: 'transparent' }} onClick={() => setMenu(false)}>
          <div class="menu" style={{ right: '20px', top: 'calc(var(--safe-top) + 60px)' }}>
            <button onClick={() => { setMenu(false); store.toggleExcused(now) }}>
              {excused ? <X size={16} /> : <Droplet size={16} />}{excused ? 'Not excused today' : 'Excused today'}
            </button>
            <div class="caption secondary" style={{ padding: '4px 12px 8px', maxWidth: '240px' }}>
              Mark today as excused - for example during haid or illness - so your streak continues.
            </div>
          </div>
        </div>
      )}
    </span>
  )
}

function PlaneButton({ now }: { now: number }) {
  if (!store.prefs.musafirEnabled || store.musafirStatus(now)?.kind !== 'traveller') return null
  return (
    <button class="round-btn" style={{ background: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}
      aria-label="Musafir: you may shorten and combine prayers" onClick={() => openSheet({ kind: 'journey' })}>
      <Plane size={17} fill="currentColor" />
    </button>
  )
}

function Controls({ c, order = 'row' }: { c: Ctx; order?: 'row' | 'column' }) {
  if (order === 'column') {
    return (
      <div class="controls-col">
        <StyleButton c={c} />
        <AppearanceButton c={c} />
        {store.prefs.trackerEnabled && <StreakChip now={c.now} />}
      </div>
    )
  }
  return (
    <>
      <PlaneButton now={c.now} />
      {store.prefs.trackerEnabled && <StreakChip now={c.now} />}
      <AppearanceButton c={c} />
      <StyleButton c={c} />
    </>
  )
}

function PlaceLabel() {
  const place = store.activePlace
  return (
    <>
      {store.prefs.useGPS ? <Navigation size={11} fill="currentColor" /> : <MapPin size={12} />}
      <span class="place-name" style={(place?.name.length ?? 0) > 11 ? { fontSize: '0.87em' } : undefined}>{place?.name ?? 'Choose a place'}</span>
      {place && isInAsia(place) && <span class="flag">{flag(placeProfile(place).code)}</span>}
      <ChevronDown size={12} strokeWidth={3} style={{ opacity: 0.6 }} />
    </>
  )
}

function PlaceChip() {
  return <button class="place-chip" onClick={() => openSheet({ kind: 'places' })} aria-label="Change location"><PlaceLabel /></button>
}

/** "TODAY | ➤ Pasir Ris 🇸🇬" - which day and where, in one centred chip. */
function SunPlaceChip({ offset }: { offset: number }) {
  return (
    <div class="center-row">
      <button class="sun-place-chip" onClick={() => openSheet({ kind: 'places' })} aria-label="Change location">
        <span class="caps-day">{dayLabel(offset)}</span>
        <span class="divider" />
        <PlaceLabel />
      </button>
    </div>
  )
}

function ShowMoreButton({ c, inline }: { c: Ctx; inline?: boolean }) {
  const btn = (
    <button class="capsule-btn" onClick={() => c.setShowMore(!c.showMore)} aria-expanded={c.showMore}
      aria-label={`${c.showMore ? 'Show less' : 'Show more'}: Dhuha and the blessed times of the night`}>
      {c.showMore ? 'SHOW LESS' : 'SHOW MORE'}
      {c.showMore ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
    </button>
  )
  return inline ? btn : <div class="center-row">{btn}</div>
}

function Offer({ c }: { c: Ctx }) {
  if (!store.prefs.showOffers || !c.showMore) return null
  return <MakersCard offer={featuredOffer(store.offerCountry)} placement="prayer" compact />
}

/** One prompt at a time: the phone app first, since its alerts ring even when it's closed. */
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
      <button class="x" aria-label="Not now" onClick={() => store.update((p) => { p.appPromptDismissed = true })}><X size={15} strokeWidth={3} /></button>
    </div>
  )
}

/** One tap to be told when each prayer begins. */
function AlertsPrompt() {
  if (store.prefs.notificationsEnabled || store.prefs.alertsPromptDismissed) return null
  return (
    <div class="alerts-prompt">
      <BellRing size={19} class="accent" fill="currentColor" style={{ flex: 'none' }} />
      <span class="text">Get an alert when each prayer begins</span>
      <button class="primary-btn" onClick={() => void turnOnAlerts()}>Turn on</button>
      <button class="x" aria-label="Not now" onClick={() => store.update((p) => { p.alertsPromptDismissed = true })}><X size={15} strokeWidth={3} /></button>
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
          <div class="headline">{profile.code ? `Welcome to ${profile.name}` : 'Outside Asia'}</div>
          <div class="subhead" style={{ opacity: 0.85, marginTop: '4px' }}>
            {store.isMethodAutomatic ? `Switched to ${method.name} (${parameterSummary(method)}), local time. Works offline.`
              : `Local time applied. You've pinned ${method.shortName} in Settings.`}
          </div>
        </div>
        <button aria-label="Dismiss" onClick={() => store.update((p) => { p.arrivalBannerDismissed = true })} style={{ padding: '6px' }}><X size={16} strokeWidth={3} /></button>
      </div>
      <hr />
      <div class="row arrival-row">
        <div style={{ flex: 1 }}><div class="subhead" style={{ fontWeight: 600 }}>Switch automatically</div><div class="caption" style={{ opacity: 0.75 }}>Follow each country's method as you travel</div></div>
        <Switch label="Switch automatically" on={store.isMethodAutomatic} onChange={(auto) => { const id = store.method.id; store.update((p) => { p.methodOverrideID = auto ? null : id }) }} />
      </div>
      {store.prefs.home?.countryCode && store.prefs.home.countryCode !== profile.code && (
        <div class="row arrival-row">
          <div style={{ flex: 1 }}><div class="subhead" style={{ fontWeight: 600 }}>Musafir features</div><div class="caption" style={{ opacity: 0.75 }}>Jamak and qasar guidance while you're away</div></div>
          <Switch label="Musafir features" on={store.prefs.musafirEnabled} onChange={(v) => store.update((p) => { p.musafirEnabled = v })} />
        </div>
      )}
      <label class="row arrival-row">
        <span class="subhead" style={{ fontWeight: 600, flex: 1 }}>Asr</span>
        <select class="inline-select" value={store.prefs.asrOverride ?? 'auto'}
          onChange={(e) => { const v = (e.target as HTMLSelectElement).value; store.update((p) => { p.asrOverride = v === 'auto' ? null : (v as 'standard' | 'hanafi') }) }}>
          <option value="auto">{store.asrSchool === 'hanafi' ? 'Later Asr (Hanafi)' : "Earlier Asr (Shafi'i)"} · Automatic</option>
          <option value="standard">Earlier Asr (Shafi'i)</option>
          <option value="hanafi">Later Asr (Hanafi)</option>
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
  return formatHijri(ms, store.timeZone, store.naming, store.prefs.hijriAdjustment)
}

function dateTap(c: Ctx) {
  if (c.offset === 0) openSheet({ kind: 'calendar' })
  else c.setOffset(0)
}

// ---------- The list ----------

type Entry = { kind: 'prayer'; p: Prayer; t: number } | { kind: 'blessed'; b: BlessedTime; t: number }

function entries(c: Ctx, day: PrayerDay): Entry[] {
  const list: Entry[] = PRAYERS.map((p) => ({ kind: 'prayer', p, t: day.times[p] }))
  if (c.showMore) for (const [b, t] of store.blessed(day)) list.push({ kind: 'blessed', b, t })
  return list.sort((a, b) => a.t - b.t)
}

function PrayerList({ c, fill }: { c: Ctx; fill: boolean }) {
  const day = c.shown
  const list = entries(c, day)
  const swipe = useSwipe(c)
  const current = c.offset === 0 ? c.current?.prayer : null
  const next = c.offset === 0 ? c.next : null
  const prayerRows = list.filter((e) => e.kind === 'prayer').length
  return (
    <div class={`list-wrap ${fill ? 'fill' : ''}`} {...swipe}>
      <div class="prayer-list glass" style={fill ? { maxHeight: `${prayerRows * 92 + (list.length - 1) * 6 + 16 + (list.length - prayerRows) * 66}px` } : undefined}>
        {list.map((e) => e.kind === 'prayer'
          ? <PrayerRow p={e.p} t={e.t} now={c.now} day={day} isCurrent={e.p === current && e.t <= c.now} next={next?.prayer === e.p && next.time === e.t ? next : null} />
          : <BlessedRow b={e.b} t={e.t} now={c.now} />)}
      </div>
    </div>
  )
}

function PrayerRow({ p, t, now, day, isCurrent, next }: { p: Prayer; t: number; now: number; day: PrayerDay; isCurrent: boolean; next: Moment }) {
  const prefs = store.prefs
  const passed = t <= now && !isCurrent
  const notifying = prefs.notificationsEnabled && prefs.notifyPrayers.includes(p)
  const trackable = prefs.trackerEnabled && isObligatory(p) && t <= now
  const prayed = trackable && store.isPrayed(p, t)
  const local = store.localName(p, t)
  const jamaah = day.jamaah[p]
  const other = day.alternate[p]
  return (
    <div class={`prayer-row ${isCurrent ? 'current' : ''}`} style={{ '--tint': tint(p), '--tint-soft': tint(p, 0.16), '--tint-line': tint(p, 0.45), opacity: passed && !prayed ? 0.55 : 1 }}
      onClick={() => { if (trackable) store.togglePrayed(p, t) }}>
      <span class="bar" style={{ opacity: isCurrent ? 1 : 0.55 }} />
      <div class="names">
        <div class="name-line">
          <span class="pname">{store.name(p, t)}</span>
          {local && <span class="local" aria-label={`called ${local} here`}>{local}</span>}
          {prayed && <CheckCircle2 size={16} class="check" fill="var(--green)" color="var(--bg-check, #fff)" />}
        </div>
        {isCurrent && <div class="now-tag">NOW</div>}
        {!isCurrent && next && <div class="in-tag mono">in {short(next.time - now)}</div>}
        {jamaah != null && <div class="extra">Jamaah {store.formatted(jamaah)}</div>}
        {other != null && day.alternateSource && <div class="extra alt">{day.alternateSource} {store.formatted(other)}</div>}
      </div>
      <TimeText ms={t} size={27} />
      <button class="bell" aria-label={notifying ? 'Turn off alert' : 'Turn on alert'} onClick={(e) => { e.stopPropagation(); toggleNotify(p) }}>
        {notifying ? <Bell size={16} fill="currentColor" /> : <BellOff size={16} style={{ opacity: 0.4 }} />}
      </button>
    </div>
  )
}

function BlessedRow({ b, t, now }: { b: BlessedTime; t: number; now: number }) {
  return (
    <div class="blessed-row" style={{ opacity: t <= now ? 0.55 : 0.9 }}>
      <span class="bar" />
      <div class="names">
        <div class="bname">{BLESSED_NAME[b]}</div>
        <div class="bnote">{BLESSED_NOTE[b]}</div>
      </div>
      <TimeText ms={t} size={22} weight={500} />
      <span style={{ width: '30px', flex: 'none' }} />
    </div>
  )
}

const BLESSED_ICON: Record<BlessedTime, typeof Sun> = { imsak: Utensils, dhuha: Sun, midnight: CloudMoon, lastThird: Sparkles }

// ---------- Side Dial (Day Dial beside the list) ----------

function DateBlock({ c }: { c: Ctx }) {
  const date = c.shown.times.dhuhr
  return (
    <div class="date-block">
      <button class="chev" aria-label="Previous day" onClick={() => c.setOffset(c.offset - 1)}><ChevronLeft size={18} strokeWidth={2.4} /></button>
      <button class="date-main" onClick={() => dateTap(c)} aria-label={c.offset === 0 ? 'Ramadan and Eid dates with their sources' : 'Back to today'}>
        <span class="caps-day accent">{dayLabel(c.offset)}</span>
        <span class="date-line">{fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span class="hijri-line">{hijri(date)} {c.offset === 0 ? <Calendar size={12} /> : <Undo2 size={12} />}</span>
      </button>
      <button class="chev" aria-label="Next day" onClick={() => c.setOffset(c.offset + 1)}><ChevronRight size={18} strokeWidth={2.4} /></button>
    </div>
  )
}

function SmallDial({ c, size }: { c: Ctx; size: number }) {
  const { now, day, current, next } = c
  const tomorrow = store.day(now + 86_400_000)
  if (!current || !next || !tomorrow) return <div style={{ width: `${size}px`, height: `${size}px` }} />
  return (
    <DayDial size={size} now={now} day={day} nextFajr={tomorrow.times.fajr} tz={store.timeZone}
      currentPrayer={current.prayer} currentName={store.name(current.prayer, current.time)}
      countdown={short(next.time - now)} nextName={store.name(next.prayer, next.time)} />
  )
}

function ClassicPage({ c }: { c: Ctx }) {
  return (
    <div class="today-page page">
      <div class="classic-header">
        <SmallDial c={c} size={172} />
        <div class="classic-side">
          <div class="controls-row"><Controls c={c} /></div>
          <PlaceChip />
          <DateBlock c={c} />
          <div><SourceBadge day={c.shown} compact /></div>
        </div>
      </div>
      <TopPrompt />
      <ArrivalCard />
      <PrayerList c={c} fill />
      <ShowMoreButton c={c} />
      <Offer c={c} />
    </div>
  )
}

// ---------- Centre Dial ----------

function DayNavigator({ c }: { c: Ctx }) {
  const date = c.shown.times.dhuhr
  return (
    <div class="day-nav">
      <button class="chev" aria-label="Previous day" onClick={() => c.setOffset(c.offset - 1)}><ChevronLeft size={22} strokeWidth={2.4} /></button>
      <button class="day-nav-main" onClick={() => dateTap(c)} aria-label={c.offset === 0 ? 'Ramadan and Eid dates with their sources' : 'Back to today'}>
        <span class="day-nav-date">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span class="day-nav-hijri">{hijri(date)} {c.offset === 0 ? <Calendar size={12} /> : <Undo2 size={12} />}</span>
      </button>
      <button class="chev" aria-label="Next day" onClick={() => c.setOffset(c.offset + 1)}><ChevronRight size={22} strokeWidth={2.4} /></button>
    </div>
  )
}

function MusafirChip({ now }: { now: number }) {
  if (!store.prefs.musafirEnabled || store.musafirStatus(now)?.kind !== 'traveller') return null
  return (
    <button class="musafir-chip" onClick={() => openSheet({ kind: 'journey' })}>
      <Plane size={16} fill="currentColor" /><span style={{ flex: 1, textAlign: 'left' }}>Musafir · you may shorten &amp; combine</span><ChevronRight size={14} strokeWidth={3} />
    </button>
  )
}

function CentrePage({ c }: { c: Ctx }) {
  return (
    <div class="today-page page centre-page">
      <div class="centre-top">
        <div class="centre-dial"><SmallDial c={c} size={148} /></div>
        <Controls c={c} order="column" />
      </div>
      <SunPlaceChip offset={c.offset} />
      <TopPrompt />
      <ArrivalCard />
      <MusafirChip now={c.now} />
      <DayNavigator c={c} />
      <PrayerList c={c} fill />
      <div class="row foot-row"><SourceBadge day={c.shown} compact /><span class="spacer" /><ShowMoreButton c={c} inline /></div>
      <Offer c={c} />
    </div>
  )
}

// ---------- Day Dial (full) ----------

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

function DialPage({ c }: { c: Ctx }) {
  const wrap = useRef<HTMLDivElement>(null)
  const box = useSize(wrap, 377)
  const shown = c.shown
  const isToday = c.offset === 0
  const nextDay = store.nextDay(shown)
  const nextFajr = nextDay?.times.fajr ?? shown.times.fajr + 86_400_000
  const blessed = c.showMore ? store.blessed(shown) : []
  const marks: DialMark[] = [
    ...PRAYERS.map((p) => ({ id: p, date: shown.times[p], extraLine: shown.jamaah[p] != null || shown.alternate[p] != null, tint: tint(p) })),
    ...blessed.map(([b, t]) => ({ id: b, date: t, minor: true })),
  ]
  const swipe = useSwipe(c)
  // A square that fits the free space (the dial scrolls only when it can't).
  const size = Math.max(280, Math.min(box.w, box.h, 560))
  return (
    <div class="today-page page dial-page">
      <div class="top-bar"><PlaceChip /><span class="spacer" /><Controls c={c} /></div>
      <TopPrompt />
      <ArrivalCard />
      <button class="date-header" onClick={() => dateTap(c)} aria-label={c.offset === 0 ? 'Ramadan and Eid dates with their sources' : 'Back to today'}>
        <span class="caps-day accent">{dayLabel(c.offset)}</span>
        <span class="date-big display">{fmtDate(shown.times.dhuhr, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span class="hijri-line subhead">{hijri(shown.times.dhuhr)} {c.offset === 0 ? <Calendar size={13} /> : <Undo2 size={13} />}</span>
      </button>
      <div class="hero-wrap" ref={wrap} {...swipe}>
        <div class="hero-centre-box">
        <HeroDial size={size} now={c.now} day={shown} nextFajr={nextFajr} tz={store.timeZone}
          currentPrayer={isToday ? c.current?.prayer ?? null : null} marks={marks}
          label={(m, sz) => {
            const p = PRAYERS.find((x) => x === m.id)
            if (p) return <DialPrayerLabel p={p} t={m.date} now={c.now} size={sz} day={shown} isCurrent={isToday && p === c.current?.prayer} />
            const b = blessed.find(([x]) => x === m.id)
            return b ? <DialBlessedLabel b={b[0]} t={b[1]} now={c.now} size={sz} /> : null
          }}
          centre={(sz) => {
            const cur = isToday ? c.current : null
            if (!cur || !c.next) return <MoonStar size={sz * 0.08} style={{ opacity: 0.5 }} />
            return (
              <div class="hero-centre">
                <div style={{ fontSize: `${sz * 0.028}px`, fontWeight: 800, letterSpacing: '0.6px', color: tint(cur.prayer) }}>NOW</div>
                <div class="display" style={{ fontSize: `${sz * 0.085}px`, fontWeight: 700, lineHeight: 1.1 }}>{store.name(cur.prayer, cur.time)}</div>
                <div class="display accent mono" style={{ fontSize: `${sz * 0.066}px`, fontWeight: 600 }}>{short(c.next.time - c.now)}</div>
                <div class="secondary" style={{ fontSize: `${sz * 0.034}px`, fontWeight: 500 }}>until {store.name(c.next.prayer, c.next.time)}</div>
              </div>
            )
          }} />
        </div>
      </div>
      <div class="row day-row">
        <button class="round-btn big" aria-label="Previous day" onClick={() => c.setOffset(c.offset - 1)}><ChevronLeft size={18} strokeWidth={2.4} /></button>
        <span class="spacer" /><SourceBadge day={shown} compact /><span class="spacer" />
        <button class="round-btn big" aria-label="Next day" onClick={() => c.setOffset(c.offset + 1)}><ChevronRight size={18} strokeWidth={2.4} /></button>
      </div>
      <ShowMoreButton c={c} />
      <Offer c={c} />
    </div>
  )
}

function DialPrayerLabel({ p, t, now, size, day, isCurrent }: { p: Prayer; t: number; now: number; size: number; day: PrayerDay; isCurrent: boolean }) {
  const prefs = store.prefs
  const passed = t <= now && !isCurrent
  const notifying = prefs.notificationsEnabled && prefs.notifyPrayers.includes(p)
  const trackable = prefs.trackerEnabled && isObligatory(p) && t <= now
  const prayed = trackable && store.isPrayed(p, t)
  const own = store.name(p, t)
  const local = store.localName(p, t)
  const name = local ? `${own} · ${local}` : own
  return (
    <button class={`dial-mark ${isCurrent ? 'current' : ''}`} style={{ '--tint': tint(p), '--tint-soft': tint(p, 0.16), '--tint-line': tint(p, 0.5), opacity: passed && !prayed ? 0.55 : 1, borderRadius: `${size * 0.035}px` }}
      aria-label={`${name}, ${store.formatted(t)}${isCurrent ? ', now' : ''}${prayed ? ', prayed' : ''}`}
      onClick={() => (trackable ? store.togglePrayed(p, t) : toggleNotify(p))}>
      <span class="dm-name" style={{ fontSize: `${size * 0.034}px`, fontWeight: isCurrent ? 700 : 600 }}>
        {name}
        {prayed && <CheckCircle2 size={size * 0.03} fill="var(--green)" color="#fff" />}
        {!prayed && prefs.notificationsEnabled && !notifying && isObligatory(p) && <BellOff size={size * 0.026} style={{ opacity: 0.5 }} />}
      </span>
      <TimeText ms={t} size={size * 0.05} weight={isCurrent ? 700 : 600} />
      {day.jamaah[p] != null && <span style={{ fontSize: `${size * 0.027}px`, opacity: 0.75 }}>Jamaah {store.formatted(day.jamaah[p]!)}</span>}
    </button>
  )
}

function DialBlessedLabel({ b, t, now, size }: { b: BlessedTime; t: number; now: number; size: number }) {
  const Icon = BLESSED_ICON[b]
  return (
    <div class="dial-blessed" style={{ opacity: t <= now ? 0.55 : 1 }} aria-label={`${BLESSED_NAME[b]}, ${store.formatted(t)}. ${BLESSED_NOTE[b]}`}>
      <span class="secondary" style={{ fontSize: `${size * 0.028}px`, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        <Icon size={size * 0.03} />{BLESSED_SHORT[b]}
      </span>
      <TimeText ms={t} size={size * 0.04} weight={500} style={{ opacity: 0.85 }} />
    </div>
  )
}

// ---------- Sun Path ----------

function SunPathPage({ c }: { c: Ctx }) {
  const wrap = useRef<HTMLDivElement>(null)
  const width = useWidth(wrap, 393)
  const { current, next, now } = c
  const nextName = next ? store.name(next.prayer, next.time) : ''
  return (
    <div class="today-page page sunpath-page">
      <div class="row" style={{ alignItems: 'flex-start', gap: '8px', paddingTop: '6px' }}>
        {current && next && (
          <div class="sun-status" aria-label={`Now ${store.name(current.prayer, current.time)}. ${nextName} at ${store.formatted(next.time)}.`}>
            <div class="row" style={{ gap: '8px' }}>
              <span class="dot" style={{ background: tint(current.prayer) }} />
              <span class="display" style={{ fontSize: '30px', fontWeight: 700 }}>{store.name(current.prayer, current.time)}</span>
            </div>
            <span class="status-pill mono">
              {next.prayer === 'sunrise' ? `${short(next.time - now)} until ${nextName} - ${store.name('fajr')} ends` : `${short(next.time - now)} until ${nextName}`}
            </span>
          </div>
        )}
        <span class="spacer" />
        {store.prefs.trackerEnabled && <StreakChip now={now} />}
        <AppearanceButton c={c} />
        <StyleButton c={c} />
      </div>
      <div class="sunpath-wrap" ref={wrap}>
        <SunPath width={width} height={96} now={now} day={c.day} tz={store.timeZone} />
      </div>
      <SunPlaceChip offset={c.offset} />
      <TopPrompt />
      <ArrivalCard />
      <MusafirChip now={now} />
      <DayNavigator c={c} />
      <PrayerList c={c} fill={false} />
      <ShowMoreButton c={c} />
      <SourceBadge day={c.shown} />
      <Offer c={c} />
    </div>
  )
}

// ---------- Colour Bands ----------

const BAND: Record<Prayer, string> = {
  fajr: 'rgb(33, 110, 92)', sunrise: 'rgb(143, 168, 82)', dhuhr: 'rgb(217, 171, 33)',
  asr: 'rgb(227, 148, 82)', maghrib: 'rgb(224, 110, 84)', isha: 'rgb(219, 79, 89)',
}

function BandsPage({ c }: { c: Ctx }) {
  const { now, shown, current, next, offset } = c
  const swipe = useSwipe(c)
  const blessed = c.showMore ? store.blessed(shown) : []
  return (
    <div class="today-page bands-page">
      <div class="bands-top page">
        <div class="row" style={{ gap: '8px' }}>
          <button class="bands-place" onClick={() => openSheet({ kind: 'places' })} aria-label="Change location"><PlaceLabel /></button>
          <span class="spacer" />
          <Controls c={c} />
        </div>
        {current && next && offset === 0 && (
          <div class="bands-status mono">{store.name(current.prayer, current.time)} now · {short(next.time - now)} until {store.name(next.prayer, next.time)}</div>
        )}
        <TopPrompt />
        <ArrivalCard />
      </div>
      <div class="bands-date">
        <button aria-label="Previous day" onClick={() => c.setOffset(offset - 1)}><ChevronLeft size={20} strokeWidth={2.6} /></button>
        <button class="bands-date-main" onClick={() => dateTap(c)} aria-label={offset === 0 ? 'Ramadan and Eid dates with their sources' : 'Back to today'}>
          {offset !== 0 && <Undo2 size={13} />} {fmtDate(shown.times.dhuhr, { day: 'numeric', month: 'short', year: 'numeric' })} · {hijri(shown.times.dhuhr)}
        </button>
        <button aria-label="Next day" onClick={() => c.setOffset(offset + 1)}><ChevronRight size={20} strokeWidth={2.6} /></button>
      </div>
      <div class="bands" {...swipe}>
        {PRAYERS.map((p) => <PrayerBand p={p} t={shown.times[p]} now={now} isCurrent={offset === 0 && p === current?.prayer}
          next={offset === 0 && p === next?.prayer ? next : null} />)}
        {blessed.map(([b, t]) => <BlessedBand b={b} t={t} now={now} />)}
      </div>
      <div class="bands-foot page">
        <div class="row foot-row"><SourceBadge day={shown} compact /><span class="spacer" /><ShowMoreButton c={c} inline /></div>
        <Offer c={c} />
      </div>
    </div>
  )
}

function PrayerBand({ p, t, now, isCurrent, next }: { p: Prayer; t: number; now: number; isCurrent: boolean; next: Moment }) {
  const prefs = store.prefs
  const notifying = prefs.notificationsEnabled && prefs.notifyPrayers.includes(p)
  const trackable = prefs.trackerEnabled && isObligatory(p) && t <= now
  const prayed = trackable && store.isPrayed(p, t)
  const parts = store.timeParts(t)
  const local = store.localName(p, t)
  return (
    <button class={`band ${isCurrent ? 'current' : ''}`} style={{ background: BAND[p] }}
      aria-label={`${store.name(p, t)}, ${store.formatted(t)}${isCurrent ? ', now' : ''}${prayed ? ', prayed' : ''}`}
      onClick={() => (trackable ? store.togglePrayed(p, t) : toggleNotify(p))}>
      <span class="band-names">
        <span class="row" style={{ gap: '8px', alignItems: 'baseline' }}>
          <span class="band-name">{store.name(p, t)}</span>
          {local && <span class="caption" style={{ fontWeight: 600, opacity: 0.8 }}>{local}</span>}
          {isCurrent && <span class="now-pill">NOW</span>}
          {prayed && <CheckCircle2 size={16} />}
        </span>
        {next && <span class="caption mono" style={{ fontWeight: 600, opacity: 0.85 }}>in {short(next.time - now)}</span>}
      </span>
      <span class="spacer" />
      <span class="band-time"><span>{parts.time}</span>{parts.suffix && <span class="sfx">{parts.suffix}</span>}</span>
      {prefs.notificationsEnabled && !notifying && isObligatory(p) && <BellOff size={13} style={{ opacity: 0.6 }} />}
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
        <span class="caption" style={{ opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{BLESSED_NOTE[b]}</span>
      </span>
      <span class="spacer" />
      <span class="band-time small"><span>{parts.time}</span>{parts.suffix && <span class="sfx">{parts.suffix}</span>}</span>
    </div>
  )
}

// ---------- No place yet ----------

function NoPlace() {
  const s = useStore()
  return (
    <div class="no-place page">
      <Navigation size={54} strokeWidth={1.2} />
      <h2 class="display">{s.gpsStatus === 'denied' ? 'Location is off' : s.gpsStatus === 'locating' ? 'Finding where you are…' : 'Where are you?'}</h2>
      <p>Prayer times are calculated for your exact spot. Allow location, or pick a city.</p>
      <button class="primary-btn" onClick={() => openSheet({ kind: 'places' })}>Choose a city</button>
    </div>
  )
}
