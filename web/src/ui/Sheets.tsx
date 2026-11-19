import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  BadgeCheck, Building2, Check, Globe, House, Navigation, CircleCheck, CircleX, Search, Share, SquarePlus, Trash2, Users, Sigma, SunDim,
} from 'lucide-preact'
import {
  announcementDate, AUTHORITIES, authorityName, basisLabel, eventTitle, expectedDate, upcomingEvents,
} from '../core/calendarSanad'
import type { PrayerDay } from '../core/engine'
import { parameterSummary } from '../core/methods'
import { musafirDistanceCheck, musafirGuidance, musafirPlan } from '../core/musafir'
import { isInAsia, isNear, placeProfile, placeSubtitle, type Place } from '../core/place'
import { OBLIGATORY } from '../core/prayer'
import { flag, profileFor, timeZoneForPlace } from '../core/regions'
import { GRADE_EXPLANATION, GRADE_TITLE, mosqueMethod, type SourceGrade } from '../core/sources'
import { isValidTimeZone, noonDaysAfter } from '../core/tz'
import { searchCities } from '../services/cities'
import { alertSupport } from '../services/notifications'
import { fetchOK } from '../services/storage'
import { store, useNow, useStore } from '../services/store'
import { closeSheet, fmtDate, GRADE_TINT, Segmented, Sheet, openSheet } from './common'
import { TabJourney } from './icons'
import { HijriMonthCard } from './HijriCalendar'
import { MakersAbout } from './Makers'
import { canInstall, install, isIOS } from './pwa'
import { appLocale, tr, trWith } from '../core/appWords'

// ---------- Places ----------

interface NominatimItem {
  lat: string; lon: string; name?: string; display_name: string
  address?: Record<string, string>
}

function fromNominatim(it: NominatimItem): Place {
  const a = it.address ?? {}
  const code = (a.country_code ?? '').toUpperCase() || null
  const lat = parseFloat(it.lat), lng = parseFloat(it.lon)
  const tz = timeZoneForPlace(code, lng, lat)
  const offset = Math.round(lng / 15)
  const fallbackTz = offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`
  return {
    id: `osm-${lat.toFixed(4)},${lng.toFixed(4)}`,
    name: it.name || a.city || a.town || a.village || a.suburb || it.display_name.split(',')[0],
    region: a.state ?? a.region ?? null,
    countryCode: code,
    countryName: profileFor(code)?.name ?? a.country ?? null,
    timeZoneID: tz && isValidTimeZone(tz) ? tz : fallbackTz,
    coordinates: { latitude: lat, longitude: lng },
    district: a.city ?? a.county ?? a.state_district ?? null,
  }
}

/** Pick where times are shown, or (forHome) where home is. Picking home goes back to Journey. */
export function PlacesSheet({ forHome = false }: { forHome?: boolean } = {}) {
  const s = useStore()
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const builtIn = useMemo(() => searchCities(query), [query])
  useEffect(() => { setOnline(null) }, [query])
  const pick = (p: Place) => {
    if (forHome) { store.setHome(p); openSheet({ kind: 'journey' }) } else { store.choose(p); closeSheet() }
  }
  const here = s.gpsPlace ?? s.activePlace
  const searchOnline = async () => {
    setSearching(true)
    const r = await fetchOK(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en&q=${encodeURIComponent(query)}`, 15000)
    setSearching(false)
    if (!r) { setOnline([]); return }
    try { setOnline(((await r.json()) as NominatimItem[]).map(fromNominatim)) } catch { setOnline([]) }
  }
  const row = (p: Place, saved = false) => (
    <div class="item place-item">
      <button class="row" style={{ flex: 1, gap: '12px', textAlign: 'left' }} onClick={() => pick(p)}>
        <span style={{ fontSize: '20px' }}>{isInAsia(p) ? flag(placeProfile(p).code) : '🌏'}</span>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block' }}>{p.name}</span>{placeSubtitle(p) && <span class="sub">{placeSubtitle(p)}</span>}</span>
        {(forHome ? !!s.prefs.home && isNear(s.prefs.home, p) : !s.prefs.useGPS && !!s.prefs.manualPlace && isNear(s.prefs.manualPlace, p)) && <Check size={18} class="accent" />}
      </button>
      {saved && <button aria-label={tr('common.removeName', { name: p.name })} class="secondary" style={{ padding: '6px' }}
        onClick={() => store.update((x) => { x.savedPlaces = x.savedPlaces.filter((q) => q.id !== p.id) })}><Trash2 size={16} /></button>}
    </div>
  )
  return (
    <Sheet title={forHome ? tr('places.whereHome') : tr('settings.location')} full>
      <label class="search-box">
        <Search size={17} class="secondary" />
        <input type="search" placeholder={tr('places.search')} value={query} autoFocus={!s.demo}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label={tr('places.search')} />
      </label>
      {!query && forHome ? (
        <>
          {here && (
            <div class="group" style={{ marginTop: '14px' }}>
              <button class="item" onClick={() => pick(here)}>
                <Navigation size={18} fill="currentColor" />
                <span class="label">{tr('places.whereNow')}<span class="sub">{here.name}{here.countryName ? `, ${here.countryName}` : ''}</span></span>
              </button>
            </div>
          )}
          {s.prefs.savedPlaces.filter((p) => p.name !== 'Current location').length > 0 && (
            <>
              <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('places.saved')}</h3>
              <div class="group">{s.prefs.savedPlaces.filter((p) => p.name !== 'Current location').map((p) => row(p))}</div>
            </>
          )}
          <p class="group-foot">{tr('places.homeHelp')}</p>
        </>
      ) : !query ? (
        <>
          <div class="group" style={{ marginTop: '14px' }}>
            <button class="item" onClick={() => { store.useGPS(); closeSheet() }}>
              <Navigation size={18} fill="currentColor" />
              <span class="label">{tr('places.current')}{s.gpsPlace && <span class="sub">{s.gpsPlace.name}</span>}
                {s.gpsStatus === 'denied' && <span class="sub">{tr('places.locationBlocked')}</span>}</span>
              {s.gpsStatus === 'denied' ? <span class="value">{tr('common.off')}</span> : s.prefs.useGPS && <span class="value">{tr('common.on')}</span>}
            </button>
          </div>
          {s.prefs.savedPlaces.length > 0 && (
            <>
              <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('places.saved')}</h3>
              <div class="group">{s.prefs.savedPlaces.map((p) => row(p, true))}</div>
            </>
          )}
          <p class="group-foot">{tr('places.searchHelp')}</p>
        </>
      ) : (
        <>
          {builtIn.length > 0 && <div class="group" style={{ marginTop: '14px' }}>{builtIn.map((p) => row(p))}</div>}
          {online && online.length > 0 && (
            <>
              <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('places.fromOsm')}</h3>
              <div class="group">{online.map((p) => row(p))}</div>
            </>
          )}
          {online && online.length === 0 && <p class="group-foot">{tr('places.nothingOnline')}</p>}
          <div style={{ marginTop: '14px' }}>
            <button class="plain-btn" onClick={() => void searchOnline()} disabled={searching}>
              <Globe size={16} />{searching ? tr('common.searching') : tr('places.searchOsm', { q: query })}
            </button>
            <p class="group-foot" style={{ marginLeft: 0 }}>{tr('places.osmNote')}</p>
          </div>
        </>
      )}
    </Sheet>
  )
}

// ---------- Source (sanad) ----------

const GRADE_ICON: Record<SourceGrade, typeof BadgeCheck> = { A: BadgeCheck, B: Building2, C: Users, D: Sigma, F: SunDim }

export function SanadSheet({ day }: { day: PrayerDay }) {
  const s = useStore()
  const Icon = GRADE_ICON[day.grade]
  const via = s.tableVia()
  let detail: string
  if (day.grade === 'A' && day.officialSource) {
    detail = via === 'feed'
      ? "Published by the authority and loaded through Prayer Times Asia's own calendar feed, which a workflow rebuilds every week from the official table. Kept in this browser, so it works offline."
      : 'Downloaded once a year from the authority and kept in this browser, so it works offline.'
    if (day.sunriseCalculated) detail += ` ${s.name('sunrise')} is not in the feed, so it is calculated (never later than the official time).`
  } else if (day.grade === 'A') {
    detail = `${parameterSummary(s.method)}. ${s.sourceSummary}`
  } else if (day.grade === 'B' || day.grade === 'C') {
    const m = s.nearbyMosque
    detail = (m && mosqueMethod(m)?.note) ?? GRADE_EXPLANATION[day.grade]
  } else {
    detail = `${parameterSummary(s.method)} · ${s.asrSchool === 'hanafi' ? tr('settings.hanafi') : tr('settings.shafii')} Asr. ${s.sourceSummary} ${s.method.note}`
  }
  const alternates = OBLIGATORY.filter((p) => day.alternate[p] != null)
  const jamaah = OBLIGATORY.filter((p) => day.jamaah[p] != null)
  return (
    <Sheet title={tr('source.title')} full>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('source.where')}</h3>
      <div class="group">
        <div class="item" style={{ alignItems: 'flex-start' }}>
          <Icon size={28} style={{ color: GRADE_TINT[day.grade], flex: 'none' }} />
          <div>
            <div class="headline">{tr('source.gradeName', { grade: day.grade, name: GRADE_TITLE[day.grade] })}</div>
            <div class="subhead">{day.officialSource ?? s.method.name}</div>
            <div class="footnote secondary" style={{ marginTop: '4px' }}>{detail}</div>
          </div>
        </div>
      </div>
      {day.alternateSource && alternates.length > 0 && (
        <>
          <h3 class="group-title" style={{ fontSize: '15px' }}>{day.officialSource ?? tr('source.official')} · {day.alternateSource}</h3>
          <div class="group">{alternates.map((p) => <div class="item"><span class="label">{s.name(p, day.times.dhuhr)}</span><span class="value">{s.formatted(day.times[p])} · {s.formatted(day.alternate[p]!)}</span></div>)}</div>
          <p class="group-foot">{tr('source.differ')}</p>
        </>
      )}
      {day.mosqueName && jamaah.length > 0 && (
        <>
          <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('source.jamaahAt', { name: day.mosqueName ?? '' })}</h3>
          <div class="group">{jamaah.map((p) => <div class="item"><span class="label">{s.name(p, day.times.dhuhr)}</span><span class="value">{s.formatted(day.jamaah[p]!)}</span></div>)}</div>
          <p class="group-foot">{tr('source.jamaahHelp')}</p>
        </>
      )}
      <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('source.grades')}</h3>
      <div class="group">
        {(['A', 'B', 'C', 'D', 'F'] as SourceGrade[]).map((g) => (
          <div class="item" style={{ alignItems: 'flex-start' }}>
            <span class="grade-dot" style={{ background: GRADE_TINT[g] }}>{g}</span>
            <div><div class="subhead" style={{ fontWeight: 600 }}>{GRADE_TITLE[g]}</div><div class="footnote secondary">{GRADE_EXPLANATION[g]}</div></div>
          </div>
        ))}
      </div>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{tr('source.helpVerify')}</h3>
      <div class="group">
        <a class="item" href="https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">
          <span class="label">{tr('source.helpVerifySub')}</span>
        </a>
      </div>
      <p class="group-foot">{tr('source.checked')}</p>
    </Sheet>
  )
}

// ---------- Calendar sanad ----------

function fmtYMD(d: { year: number; month: number; day: number } | null): string {
  if (!d) return '-'
  return new Intl.DateTimeFormat(appLocale(), { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(d.year, d.month - 1, d.day))).replace(',', '')
}

export function CalendarSheet() {
  const s = useStore()
  const now = useNow(60_000)
  useEffect(() => { void store.refreshData() }, [])
  const mine = s.communityAuthority
  return (
    <Sheet title={tr('calendar.title')} full>
      <HijriMonthCard />
      <h3 class="group-title" style={{ fontSize: '15px', marginTop: '22px' }}>{tr('calendar.byAuthority')}</h3>
      <div class="group">
        <label class="item">
          <span class="label">{tr('calendar.follows')}</span>
          <select value={s.prefs.communityAuthority ?? 'auto'} onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value
            store.update((x) => { x.communityAuthority = v === 'auto' ? null : v })
          }}>
            <option value="auto">{tr('common.automaticWith', { name: mine ? authorityName(mine) : tr('common.none') })}</option>
            {AUTHORITIES.map((a) => <option value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      <p class="group-foot">{tr('calendar.explain')}</p>
      {upcomingEvents(now, s.timeZone).map((u) => {
        const entries = s.announcements(u.event, u.hijriYear)
          .sort((a, b) => (a.authority === mine ? 0 : 1) - (b.authority === mine ? 0 : 1) || a.authority.localeCompare(b.authority))
        const announcedMine = entries.some((a) => a.authority === mine && a.status === 'announced')
        return (
          <section>
            <h3 class="group-title" style={{ fontSize: '15px' }}>{eventTitle(u.event, s.naming)} {u.hijriYear} {tr('calendar.ah')}</h3>
            <div class="group">
              <div class="item" style={{ alignItems: 'flex-start' }}>
                <div class="label"><div class="subhead" style={{ fontWeight: 600 }}>{tr('calendar.expected')}</div><div class="caption secondary">{tr('calendar.estimateExplain')}</div></div>
                <div style={{ textAlign: 'right' }}><div class="subhead mono" style={{ fontWeight: 600 }}>{fmtYMD(expectedDate(u.event, u.hijriYear))}</div><div class="caption secondary" style={{ fontWeight: 800 }}>{tr('calendar.estimate')}</div></div>
              </div>
              {entries.map((a) => (
                <div class="item" style={{ alignItems: 'flex-start' }}>
                  <div class="label">
                    <div class="subhead" style={{ fontWeight: a.authority === mine ? 700 : 600 }}>{authorityName(a.authority)}</div>
                    <div class="caption secondary">{basisLabel(a.basis)}</div>
                    {a.source_url && <a class="caption accent" href={a.source_url} target="_blank" rel="noopener noreferrer">{tr('source.title')}</a>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div class="subhead mono" style={{ fontWeight: 600 }}>{fmtYMD(announcementDate(a))}</div>
                    <div class="caption" style={{ fontWeight: 800, color: a.status === 'announced' ? 'var(--grade-a)' : 'var(--fg2)' }}>{a.status === 'announced' ? tr('calendar.announced') : tr('calendar.expected')}</div>
                  </div>
                </div>
              ))}
              {!announcedMine && mine && <div class="item footnote secondary">{tr('calendar.notYet', { name: authorityName(mine) })}</div>}
            </div>
          </section>
        )
      })}
      <p class="group-foot">{tr('calendar.sanad')}</p>
    </Sheet>
  )
}

// ---------- Journey ----------

export function JourneySheet() {
  const s = useStore()
  const now = useNow(60_000)
  const status = s.musafirStatus(now)
  const rules = s.musafirRules
  const g = status ? musafirGuidance(status, rules, s.naming) : null
  const km = status && status.kind !== 'home' ? status.distanceKm : null
  const today = s.day(now), tomorrow = s.day(noonDaysAfter(now, 1, s.timeZone))
  const home = s.prefs.home
  return (
    <Sheet title={tr('settings.journey')} full>
      {home && !s.prefs.homeConfirmed ? <HomeQuestion /> : <div class="glass card" style={{ marginTop: '10px' }}>
        {g && status ? (
          <>
            <div class="row" style={{ gap: '10px' }}>{status.kind === 'traveller' ? <span class="journey-badge"><TabJourney size={18} /></span> : <House size={28} />}<span style={{ fontSize: '22px', fontWeight: 700 }}>{g.title}</span></div>
            {km != null && <div style={{ margin: '8px 0' }}><span class="display mono" style={{ fontSize: '48px', fontWeight: 600 }}>{Math.round(km).toLocaleString(appLocale())}</span><span class="headline">  {tr('journey.fromHome', { km: '' }).trim()}</span></div>}
            <p style={{ margin: '6px 0', opacity: 0.9 }}>{g.body}</p>
            {status.kind === 'traveller' && (
              <div class="musafir-plan">
                {musafirPlan(rules, s.naming).map((r) => (
                  <div class="row" key={r.prayer}>
                    <div style={{ flex: 1 }}><div class="headline">{r.name}</div><div class="footnote" style={{ opacity: 0.75 }}>{r.join}</div></div>
                    <div style={{ textAlign: 'right' }}><div class="headline mono">{r.rakaat}</div><div class="footnote" style={{ opacity: 0.75 }}>{r.change}</div></div>
                  </div>
                ))}
              </div>
            )}
            {s.prefs.arrivedAt != null && (status.kind === 'traveller' || status.kind === 'settled') && <div class="subhead" style={{ fontWeight: 600, opacity: 0.8 }}>{tr('journey.day', { n: s.daysHere(now) + 1 })} · {s.profile.name || tr('journey.thisPlace')}</div>}
          </>
        ) : (
          <><div style={{ fontSize: '22px', fontWeight: 700 }}>{tr('journey.setHome')}</div><p style={{ opacity: 0.85 }}>{tr('journey.setHomeHelp')}</p>
            <button class="pill-btn" onClick={() => openSheet({ kind: 'places', forHome: true })}><House size={16} /> {tr('journey.setHomeButton')}</button></>
        )}
      </div>}
      {status?.kind === 'traveller' && s.isRamadanDay(now) && (
        <div class="glass card" style={{ marginTop: '16px' }}>
          <div class="caps" style={{ opacity: 0.7 }}>{tr('journey.fasting')}</div>
          <p class="footnote" style={{ opacity: 0.9, margin: '8px 0 0' }}>{tr('journey.fastingHelp')}</p>
          <button class="pill-btn" style={{ marginTop: '10px' }} onClick={() => openSheet({ kind: 'ramadan' })}>{tr('journey.openRamadan')}</button>
        </div>
      )}
      {status?.kind === 'traveller' && s.asrSchool !== 'hanafi' && today && tomorrow && (
        <div class="glass card" style={{ marginTop: '16px' }}>
          <div class="row"><span class="caps" style={{ opacity: 0.7 }}>{tr('journey.combined')}</span><span class="spacer" /><span class="caption" style={{ opacity: 0.6, fontWeight: 600 }}>{tr('falak.pendingReview')}</span></div>
          <div class="row headline" style={{ marginTop: '10px' }}><span>{s.name('dhuhr')} + {s.name('asr')}</span><span class="spacer" /><span class="mono">{s.formatted(today.times.dhuhr)} – {s.formatted(today.times.maghrib)}</span></div>
          <div class="row headline" style={{ marginTop: '6px' }}><span>{s.name('maghrib')} + {s.name('isha')}</span><span class="spacer" /><span class="mono">{s.formatted(today.times.maghrib)} – {s.formatted(tomorrow.times.fajr)}</span></div>
          <p class="footnote" style={{ opacity: 0.85 }}>{tr('journey.jamakExplain')} {tr('journey.neverJoined', { name: s.name('fajr') })}</p>
        </div>
      )}
      <div class="glass card row" style={{ marginTop: '16px' }}>
        <div style={{ flex: 1 }}>
          <div class="caps" style={{ opacity: 0.7 }}>{tr('journey.home')}</div>
          <div class="headline">{home ? `${flag(placeProfile(home).code)} ${home.name}` : tr('settings.notSet')}</div>
          {home && placeSubtitle(home) && <div class="subhead" style={{ opacity: 0.75 }}>{placeSubtitle(home)}</div>}
        </div>
        <button class="plain-btn" onClick={() => openSheet({ kind: 'places', forHome: true })}><House size={16} />{home ? tr('journey.changeHome') : tr('journey.setHomeButton')}</button>
      </div>
      <div class="glass card" style={{ marginTop: '16px' }}>
        <div class="caps" style={{ opacity: 0.7, marginBottom: '10px' }}>{tr('journey.distance')}</div>
        {s.asrSchool === 'hanafi'
          ? <div class="subhead">{tr('journey.hanafi')}</div>
          : <>
            <Segmented value={s.prefs.musafirThresholdKm} onChange={(v) => store.update((x) => { x.musafirThresholdKm = v })}
              options={[{ value: 81, label: tr('journey.km81') }, { value: 89, label: tr('journey.km89') }]} />
            <div class="subhead" style={{ opacity: 0.85, marginTop: '10px' }}>{tr('journey.distanceHelp')}</div>
            <div class="subhead" style={{ opacity: 0.85, marginTop: '8px' }}>{tr('journey.shafii')}</div>
          </>}
        {status && (() => {
          const c = musafirDistanceCheck(status, rules)
          // Keyed on the chosen distance so switching 81 km and 89 km replays the fade and the answer visibly refreshes.
          return c && (
            <div key={rules.thresholdKm} class={`distance-check ${c.counts ? 'yes' : 'no'}`}>
              {c.counts ? <CircleCheck size={20} /> : <CircleX size={20} />}<span>{c.text}</span>
            </div>
          )
        })()}
      </div>
      {s.prefs.trip.length > 0 && (
        <div class="glass card" style={{ marginTop: '16px' }}>
          <div class="caps" style={{ opacity: 0.7, marginBottom: '10px' }}>{tr('journey.prayedAt')}</div>
          {s.prefs.trip.slice(0, 12).map((t) => (
            <div class="row" style={{ gap: '10px', marginBottom: '8px' }}>
              <span>{profileFor(t.countryCode) ? flag(t.countryCode) : '🌏'}</span>
              <div style={{ flex: 1 }}><div class="subhead" style={{ fontWeight: 600 }}>{t.countryName}</div><div class="caption" style={{ opacity: 0.7 }}>{t.placeName}</div></div>
              <span class="caption" style={{ opacity: 0.75 }}>{fmtDate(t.arrived, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}
      <p class="caption" style={{ opacity: 0.7, marginTop: '16px' }}>{tr('journey.notFatwa')}</p>
    </Sheet>
  )
}

// ---------- Alerts help, install, credits, makers ----------

export function AlertsHelpSheet() {
  const support = alertSupport()
  return (
    <Sheet title={tr('alertsHelp.title')}>
      <div class="help">
        {support === 'needs-install' && (
          <>
            <p class="headline">{tr('alertsHelp.iphone')}</p>
            <ol class="subhead">
              <li>{trWith('alertsHelp.step1', { icon: <Share size={15} /> })}</li>
              <li>{trWith('alertsHelp.step2', { icon: <SquarePlus size={15} /> })}</li>
              <li>{tr('alertsHelp.step3')}</li>
            </ol>
          </>
        )}
        {support === 'unsupported' && <p class="headline">{tr('alertsHelp.cant')}</p>}
        {support === 'supported' && <p class="headline">{tr('alertsHelp.blocked')}</p>}
        {support === 'supported' && <p class="subhead">{tr('alertsHelp.allow')}</p>}
        <p class="subhead">{tr('alertsHelp.webOnly')} {tr('alertsHelp.calendarRings')}</p>
        <button class="primary-btn" onClick={closeSheet}>{tr('common.ok')}</button>
      </div>
    </Sheet>
  )
}

export function InstallSheet() {
  return (
    <Sheet title={tr('install.addHome')}>
      <div class="help">
        {isIOS() ? (
          <ol class="subhead">
            <li>{trWith('alertsHelp.step1', { icon: <Share size={15} /> })}</li>
            <li>{trWith('install.step2', { icon: <SquarePlus size={15} /> })}</li>
            <li>{tr('install.tapAdd')}</li>
          </ol>
        ) : canInstall() ? (
          <button class="primary-btn" onClick={() => void install().then(closeSheet)}>{tr('install.title')}</button>
        ) : (
          <p class="subhead">{trWith('install.menuHow', { menu: tr('install.menu'), app: <b>{tr('install.app')}</b>, home: <b>{tr('install.addHome')}</b> })}</p>
        )}
      </div>
    </Sheet>
  )
}

const CREDITS: [string, string, string | null][] = [
  ['MUIS - Singapore', 'Contains information from the Muslim Prayer Timetable accessed from data.gov.sg, which is made available under the terms of the Singapore Open Data Licence version 1.0.', 'https://data.gov.sg/open-data-licence'],
  ['JAKIM e-Solat - Malaysia', 'Official prayer times by zone from Jabatan Kemajuan Islam Malaysia (e-solat.gov.my).', 'https://www.e-solat.gov.my'],
  ['Kemenag - Indonesia', 'Kementerian Agama (Bimas Islam) schedules via the myquran.com community API.', 'https://api.myquran.com'],
  ['JAKIM zone boundaries', 'District-to-zone mapping from mptwaktusolat/malaysia.geojson; one reference point per district is used.', 'https://github.com/mptwaktusolat/malaysia.geojson'],
  ['Calculation', 'In-browser solar calculation after praytimes.org; method presets as published by MUIS, JAKIM, Kemenag, the Muslim World League, Karachi, Umm al-Qura, Diyanet and others.', 'https://praytimes.org/wiki/Calculation_Methods'],
  ['Maps and places', 'Map data © OpenStreetMap contributors (ODbL), tiles © CARTO, masjid lists built weekly from OpenStreetMap with the Overpass API, place search through Nominatim.', 'https://www.openstreetmap.org/copyright'],
  ['Icons and fonts', 'Lucide icons (ISC); Inter and Nunito (SIL Open Font Licence).', 'https://lucide.dev'],
  ['Community data', 'Masjid timetables and method confirmations from contributors, shared under CC-BY 4.0.', 'https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md'],
  ['This app', 'Open source under the GNU AGPL 3.0 licence. Made by Aarif Raziff.', 'https://github.com/aarif86/PrayerTimesAsia'],
]

export function CreditsSheet() {
  return (
    <Sheet title={tr('settings.sources')} full>
      <div class="group" style={{ marginTop: '10px' }}>
        {CREDITS.map(([t, d, u]) => (
          <div class="item" style={{ display: 'block' }}>
            <div class="subhead" style={{ fontWeight: 600 }}>{t}</div>
            <div class="footnote secondary">{d}</div>
            {u && <a class="footnote accent" style={{ overflowWrap: 'anywhere' }} href={u} target="_blank" rel="noopener noreferrer">{u.replace('https://', '')}</a>}
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export function MakersSheet({ placement }: { placement: string }) {
  return <Sheet label={tr('settings.aboutApp')}><MakersAbout placement={placement} country={store.offerCountry} /></Sheet>
}


/**
 * "Is Kuala Lumpur your home?" for a home the app only guessed (from where the
 * device was when the app was first opened). Until it is answered, Journey and
 * the musafir line say nothing about travelling.
 */
export function HomeQuestion() {
  const s = useStore()
  const home = s.prefs.home
  if (!home || s.prefs.homeConfirmed) return null
  return (
    <div class="glass card home-question" style={{ marginTop: '10px' }}>
      <div class="row" style={{ gap: '10px' }}><House size={28} /><span style={{ fontSize: '20px', fontWeight: 700 }}>{tr('places.isHome', { place: home.name })}</span></div>
      <p class="subhead" style={{ opacity: 0.85 }}>{tr('places.isHomeHelp')}</p>
      <div class="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
        <button class="pill-btn" onClick={() => store.confirmHome()}>{tr('places.yesHome')}</button>
        <button class="plain-btn" onClick={() => openSheet({ kind: 'places', forHome: true })}>{tr('journey.changeHome')}</button>
      </div>
    </div>
  )
}
