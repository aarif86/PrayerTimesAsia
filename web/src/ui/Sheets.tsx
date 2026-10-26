import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  BadgeCheck, Building2, Check, Globe, House, Navigation, Plane, Search, Share, SquarePlus, Trash2, Users, Sigma, SunDim,
} from 'lucide-preact'
import {
  announcementDate, AUTHORITIES, authorityName, basisLabel, eventTitle, expectedDate, upcomingEvents,
} from '../core/calendarSanad'
import type { PrayerDay } from '../core/engine'
import { parameterSummary } from '../core/methods'
import { musafirGuidance } from '../core/musafir'
import { isInAsia, isNear, placeProfile, placeSubtitle, type Place } from '../core/place'
import { OBLIGATORY } from '../core/prayer'
import { flag, profileFor, timeZoneForPlace } from '../core/regions'
import { GRADE_EXPLANATION, GRADE_TITLE, mosqueMethod, type SourceGrade } from '../core/sources'
import { isValidTimeZone } from '../core/tz'
import { searchCities } from '../services/cities'
import { alertSupport } from '../services/notifications'
import { fetchOK } from '../services/storage'
import { store, useNow, useStore } from '../services/store'
import { closeSheet, fmtDate, GRADE_TINT, Segmented, Sheet } from './common'
import { MakersAbout } from './Makers'
import { canInstall, install, isIOS } from './pwa'

// ---------- Places ----------

interface NominatimItem {
  lat: string; lon: string; name?: string; display_name: string
  address?: Record<string, string>
}

function fromNominatim(it: NominatimItem): Place {
  const a = it.address ?? {}
  const code = (a.country_code ?? '').toUpperCase() || null
  const lat = parseFloat(it.lat), lng = parseFloat(it.lon)
  const tz = timeZoneForPlace(code, lng)
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

export function PlacesSheet() {
  const s = useStore()
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const builtIn = useMemo(() => searchCities(query), [query])
  useEffect(() => { setOnline(null) }, [query])
  const pick = (p: Place) => { store.choose(p); closeSheet() }
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
        {!s.prefs.useGPS && s.prefs.manualPlace && isNear(s.prefs.manualPlace, p) && <Check size={18} class="accent" />}
      </button>
      {saved && <button aria-label={`Remove ${p.name}`} class="secondary" style={{ padding: '6px' }}
        onClick={() => store.update((x) => { x.savedPlaces = x.savedPlaces.filter((q) => q.id !== p.id) })}><Trash2 size={16} /></button>}
    </div>
  )
  return (
    <Sheet title="Location" full>
      <label class="search-box">
        <Search size={17} class="secondary" />
        <input type="search" placeholder="City or place" value={query} autoFocus={!s.demo}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="City or place" />
      </label>
      {!query ? (
        <>
          <div class="group" style={{ marginTop: '14px' }}>
            <button class="item" onClick={() => { store.useGPS(); closeSheet() }}>
              <Navigation size={18} fill="currentColor" />
              <span class="label">Current location{s.gpsPlace && <span class="sub">{s.gpsPlace.name}</span>}
                {s.gpsStatus === 'denied' && <span class="sub">Location is blocked for this site in your browser settings.</span>}</span>
              {s.prefs.useGPS && <span class="value">On</span>}
            </button>
          </div>
          {s.prefs.savedPlaces.length > 0 && (
            <>
              <h3 class="group-title" style={{ fontSize: '15px' }}>Saved places</h3>
              <div class="group">{s.prefs.savedPlaces.map((p) => row(p, true))}</div>
            </>
          )}
          <p class="group-foot">Search any city in Asia - Hanoi, Osaka, Seoul, Istanbul. Times are calculated in your browser, so they keep working offline. Your location never leaves this device.</p>
        </>
      ) : (
        <>
          {builtIn.length > 0 && <div class="group" style={{ marginTop: '14px' }}>{builtIn.map((p) => row(p))}</div>}
          {online && online.length > 0 && (
            <>
              <h3 class="group-title" style={{ fontSize: '15px' }}>From OpenStreetMap</h3>
              <div class="group">{online.map((p) => row(p))}</div>
            </>
          )}
          {online && online.length === 0 && <p class="group-foot">Nothing found online (or no connection).</p>}
          <div style={{ marginTop: '14px' }}>
            <button class="plain-btn" onClick={() => void searchOnline()} disabled={searching}>
              <Globe size={16} />{searching ? 'Searching…' : `Search OpenStreetMap for "${query}"`}
            </button>
            <p class="group-foot" style={{ marginLeft: 0 }}>Only the words you type are sent to OpenStreetMap's Nominatim search.</p>
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
    detail = `${parameterSummary(s.method)}. This is the authority's own published method.`
  } else if (day.grade === 'B' || day.grade === 'C') {
    const m = s.nearbyMosque
    detail = (m && mosqueMethod(m)?.note) ?? GRADE_EXPLANATION[day.grade]
  } else {
    detail = `${parameterSummary(s.method)} · ${s.asrSchool === 'hanafi' ? 'Hanafi' : "Shafi'i"} Asr. ${s.method.note}`
  }
  const alternates = OBLIGATORY.filter((p) => day.alternate[p] != null)
  const jamaah = OBLIGATORY.filter((p) => day.jamaah[p] != null)
  return (
    <Sheet title="Source" full>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Where today's times come from</h3>
      <div class="group">
        <div class="item" style={{ alignItems: 'flex-start' }}>
          <Icon size={28} style={{ color: GRADE_TINT[day.grade], flex: 'none' }} />
          <div>
            <div class="headline">Grade {day.grade} · {GRADE_TITLE[day.grade]}</div>
            <div class="subhead">{day.officialSource ?? s.method.name}</div>
            <div class="footnote secondary" style={{ marginTop: '4px' }}>{detail}</div>
          </div>
        </div>
      </div>
      {day.alternateSource && alternates.length > 0 && (
        <>
          <h3 class="group-title" style={{ fontSize: '15px' }}>{day.officialSource ?? 'Official'} · {day.alternateSource}</h3>
          <div class="group">{alternates.map((p) => <div class="item"><span class="label">{s.name(p, day.times.dhuhr)}</span><span class="value">{s.formatted(day.times[p])} · {s.formatted(day.alternate[p]!)}</span></div>)}</div>
          <p class="group-foot">These two sources differ by more than 2 minutes. We show both rather than silently pick one; follow your local masjid's practice.</p>
        </>
      )}
      {day.mosqueName && jamaah.length > 0 && (
        <>
          <h3 class="group-title" style={{ fontSize: '15px' }}>Jamaah at {day.mosqueName}</h3>
          <div class="group">{jamaah.map((p) => <div class="item"><span class="label">{s.name(p, day.times.dhuhr)}</span><span class="value">{s.formatted(day.jamaah[p]!)}</span></div>)}</div>
          <p class="group-foot">Prayer time begins at the times on the Prayer screen; these are when the congregation prays.</p>
        </>
      )}
      <h3 class="group-title" style={{ fontSize: '15px' }}>The grades</h3>
      <div class="group">
        {(['A', 'B', 'C', 'D', 'F'] as SourceGrade[]).map((g) => (
          <div class="item" style={{ alignItems: 'flex-start' }}>
            <span class="grade-dot" style={{ background: GRADE_TINT[g] }}>{g}</span>
            <div><div class="subhead" style={{ fontWeight: 600 }}>{GRADE_TITLE[g]}</div><div class="footnote secondary">{GRADE_EXPLANATION[g]}</div></div>
          </div>
        ))}
      </div>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Help verify times here</h3>
      <div class="group">
        <a class="item" href="https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">
          <span class="label">Send a mosque timetable, the method mosques here use, or an adhan time you heard</span>
        </a>
      </div>
      <p class="group-foot">Submissions are checked by a person before they change anyone's times, and shared openly under CC-BY 4.0.</p>
    </Sheet>
  )
}

// ---------- Calendar sanad ----------

function fmtYMD(d: { year: number; month: number; day: number } | null): string {
  if (!d) return '-'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(d.year, d.month - 1, d.day))).replace(',', '')
}

export function CalendarSheet() {
  const s = useStore()
  const now = useNow(60_000)
  useEffect(() => { void store.refreshData() }, [])
  const mine = s.communityAuthority
  return (
    <Sheet title="Calendar" full>
      <div class="group" style={{ marginTop: '10px' }}>
        <label class="item">
          <span class="label">My community follows</span>
          <select value={s.prefs.communityAuthority ?? 'auto'} onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value
            store.update((x) => { x.communityAuthority = v === 'auto' ? null : v })
          }}>
            <option value="auto">Automatic · {mine ? authorityName(mine) : 'none'}</option>
            {AUTHORITIES.map((a) => <option value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      <p class="group-foot">Countries can start Ramadan and celebrate Eid on different days, because of local moon sighting and different methods. Pick whose announcement your masjid follows.</p>
      {upcomingEvents(now, s.timeZone).map((u) => {
        const entries = s.announcements(u.event, u.hijriYear)
          .sort((a, b) => (a.authority === mine ? 0 : 1) - (b.authority === mine ? 0 : 1) || a.authority.localeCompare(b.authority))
        const announcedMine = entries.some((a) => a.authority === mine && a.status === 'announced')
        return (
          <section>
            <h3 class="group-title" style={{ fontSize: '15px' }}>{eventTitle(u.event, s.naming)} {u.hijriYear} AH</h3>
            <div class="group">
              <div class="item" style={{ alignItems: 'flex-start' }}>
                <div class="label"><div class="subhead" style={{ fontWeight: 600 }}>Expected</div><div class="caption secondary">Astronomical estimate (Umm al-Qura calendar). Local dates may differ by a day.</div></div>
                <div style={{ textAlign: 'right' }}><div class="subhead mono" style={{ fontWeight: 600 }}>{fmtYMD(expectedDate(u.event, u.hijriYear))}</div><div class="caption secondary" style={{ fontWeight: 800 }}>Estimate</div></div>
              </div>
              {entries.map((a) => (
                <div class="item" style={{ alignItems: 'flex-start' }}>
                  <div class="label">
                    <div class="subhead" style={{ fontWeight: a.authority === mine ? 700 : 600 }}>{authorityName(a.authority)}</div>
                    <div class="caption secondary">{basisLabel(a.basis)}</div>
                    {a.source_url && <a class="caption accent" href={a.source_url} target="_blank" rel="noopener noreferrer">Source</a>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div class="subhead mono" style={{ fontWeight: 600 }}>{fmtYMD(announcementDate(a))}</div>
                    <div class="caption" style={{ fontWeight: 800, color: a.status === 'announced' ? 'var(--grade-a)' : 'var(--fg2)' }}>{a.status === 'announced' ? 'Announced' : 'Expected'}</div>
                  </div>
                </div>
              ))}
              {!announcedMine && mine && <div class="item footnote secondary">{authorityName(mine)} hasn't announced yet. It usually does the evening before; this page updates within a few hours.</div>}
            </div>
          </section>
        )
      })}
      <p class="group-foot">Every date shows who set it and how: moon sighting, calculation, or following another authority. Dates are shared openly under CC-BY 4.0.</p>
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
  const today = s.day(now), tomorrow = s.day(now + 86_400_000)
  const place = s.activePlace
  const home = s.prefs.home
  return (
    <Sheet title="Journey" full>
      <div class="glass card" style={{ marginTop: '10px' }}>
        {g && status ? (
          <>
            <div class="row" style={{ gap: '10px' }}>{status.kind === 'traveller' ? <Plane size={28} fill="currentColor" /> : <House size={28} />}<span style={{ fontSize: '22px', fontWeight: 700 }}>{g.title}</span></div>
            {km != null && <div style={{ margin: '8px 0' }}><span class="display mono" style={{ fontSize: '48px', fontWeight: 600 }}>{Math.round(km).toLocaleString('en')} km</span><span class="headline">  from home</span></div>}
            <p style={{ margin: '6px 0', opacity: 0.9 }}>{g.body}</p>
            {s.prefs.arrivedAt != null && (status.kind === 'traveller' || status.kind === 'settled') && <div class="subhead" style={{ fontWeight: 600, opacity: 0.8 }}>Day {s.daysHere(now) + 1} in {s.profile.name || 'this place'}</div>}
          </>
        ) : (
          <><div style={{ fontSize: '22px', fontWeight: 700 }}>Set your home</div><p style={{ opacity: 0.85 }}>Tell us where home is and we'll work out when you count as a traveller.</p></>
        )}
      </div>
      {status?.kind === 'traveller' && s.asrSchool !== 'hanafi' && today && tomorrow && (
        <div class="glass card" style={{ marginTop: '16px' }}>
          <div class="row"><span class="caps" style={{ opacity: 0.7 }}>Combined windows today</span><span class="spacer" /><span class="caption" style={{ opacity: 0.6, fontWeight: 600 }}>Pending shariah review</span></div>
          <div class="row headline" style={{ marginTop: '10px' }}><span>{s.name('dhuhr')} + {s.name('asr')}</span><span class="spacer" /><span class="mono">{s.formatted(today.times.dhuhr)} – {s.formatted(today.times.maghrib)}</span></div>
          <div class="row headline" style={{ marginTop: '6px' }}><span>{s.name('maghrib')} + {s.name('isha')}</span><span class="spacer" /><span class="mono">{s.formatted(today.times.maghrib)} – {s.formatted(tomorrow.times.fajr)}</span></div>
          <p class="footnote" style={{ opacity: 0.85 }}>Jamak taqdim prays both in the first prayer's time; jamak ta'khir prays both in the second's. {s.name('fajr')} is never combined.</p>
        </div>
      )}
      <div class="glass card row" style={{ marginTop: '16px' }}>
        <div style={{ flex: 1 }}>
          <div class="caps" style={{ opacity: 0.7 }}>Home</div>
          <div class="headline">{home ? `${flag(placeProfile(home).code)} ${home.name}` : 'Not set'}</div>
          {home && placeSubtitle(home) && <div class="subhead" style={{ opacity: 0.75 }}>{placeSubtitle(home)}</div>}
        </div>
        {place && (!home || !isNear(home, place)) && <button class="plain-btn" onClick={() => store.setHome(place)}>Set to here</button>}
      </div>
      <div class="glass card" style={{ marginTop: '16px' }}>
        <div class="caps" style={{ opacity: 0.7, marginBottom: '10px' }}>Travel distance</div>
        {s.asrSchool === 'hanafi'
          ? <div class="subhead">Hanafi: about 78 km, stays up to 15 days. Prayers are shortened but not combined.</div>
          : <>
            <Segmented value={s.prefs.musafirThresholdKm} onChange={(v) => store.update((x) => { x.musafirThresholdKm = v })}
              options={[{ value: 81, label: '81 km (2 marhalah)' }, { value: 89, label: '89 km' }]} />
            <div class="subhead" style={{ opacity: 0.85, marginTop: '10px' }}>Shafi'i: stays of up to 3 days, not counting the days you arrive and leave.</div>
          </>}
      </div>
      {s.prefs.trip.length > 0 && (
        <div class="glass card" style={{ marginTop: '16px' }}>
          <div class="caps" style={{ opacity: 0.7, marginBottom: '10px' }}>Where you've prayed</div>
          {s.prefs.trip.slice(0, 12).map((t) => (
            <div class="row" style={{ gap: '10px', marginBottom: '8px' }}>
              <span>{profileFor(t.countryCode) ? flag(t.countryCode) : '🌏'}</span>
              <div style={{ flex: 1 }}><div class="subhead" style={{ fontWeight: 600 }}>{t.countryName}</div><div class="caption" style={{ opacity: 0.7 }}>{t.placeName}</div></div>
              <span class="caption" style={{ opacity: 0.75 }}>{fmtDate(t.arrived, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}
      <p class="caption" style={{ opacity: 0.7, marginTop: '16px' }}>This is general guidance on the traveller's concessions (rukhsah), not a fatwa. When unsure, follow your local religious authority.</p>
    </Sheet>
  )
}

// ---------- Alerts help, install, credits, makers ----------

export function AlertsHelpSheet() {
  const support = alertSupport()
  return (
    <Sheet title="Prayer alerts">
      <div class="help">
        {support === 'needs-install' && (
          <>
            <p class="headline">On iPhone and iPad, alerts need the app on your Home Screen.</p>
            <ol class="subhead">
              <li>Tap <Share size={15} /> Share in Safari's toolbar.</li>
              <li>Choose <SquarePlus size={15} /> Add to Home Screen, then Add.</li>
              <li>Open Prayer Times Asia from the Home Screen and turn alerts on.</li>
            </ol>
          </>
        )}
        {support === 'unsupported' && <p class="headline">This browser can't show notifications.</p>}
        {support === 'supported' && <p class="headline">Notifications are blocked for this site.</p>}
        {support === 'supported' && <p class="subhead">Allow notifications in your browser's site settings (the icon left of the address), then try again.</p>}
        <p class="subhead">Web alerts ring only while Prayer Times Asia is open. For alerts that ring when it's closed, use <b>Settings › Add the next 30 days to a calendar</b> - your calendar app rings every prayer.</p>
        <button class="primary-btn" onClick={closeSheet}>OK</button>
      </div>
    </Sheet>
  )
}

export function InstallSheet() {
  return (
    <Sheet title="Add to Home Screen">
      <div class="help">
        {isIOS() ? (
          <ol class="subhead">
            <li>Tap <Share size={15} /> Share in Safari's toolbar.</li>
            <li>Choose <SquarePlus size={15} /> Add to Home Screen.</li>
            <li>Tap Add. Prayer Times Asia opens full screen and works offline.</li>
          </ol>
        ) : canInstall() ? (
          <button class="primary-btn" onClick={() => void install().then(closeSheet)}>Install Prayer Times Asia</button>
        ) : (
          <p class="subhead">Use your browser's menu: <b>Install app</b> or <b>Add to Home screen</b>. Once added, it opens like an app and works offline.</p>
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
  ['Maps and places', 'Map data © OpenStreetMap contributors (ODbL), tiles © CARTO, masjid search through the Overpass API, place search through Nominatim.', 'https://www.openstreetmap.org/copyright'],
  ['Icons and fonts', 'Lucide icons (ISC); Inter and Nunito (SIL Open Font Licence).', 'https://lucide.dev'],
  ['Community data', 'Masjid timetables and method confirmations from contributors, shared under CC-BY 4.0.', 'https://github.com/aarif86/PrayerTimesAsia/blob/main/CONTRIBUTING.md'],
  ['This app', 'Open source under the MIT licence. Made by Aarif Raziff.', 'https://github.com/aarif86/PrayerTimesAsia'],
]

export function CreditsSheet() {
  return (
    <Sheet title="Sources & credits" full>
      <div class="group" style={{ marginTop: '10px' }}>
        {CREDITS.map(([t, d, u]) => (
          <div class="item" style={{ display: 'block' }}>
            <div class="subhead" style={{ fontWeight: 600 }}>{t}</div>
            <div class="footnote secondary">{d}</div>
            {u && <a class="footnote accent" href={u} target="_blank" rel="noopener noreferrer">{u.replace('https://', '')}</a>}
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export function MakersSheet({ placement }: { placement: string }) {
  return <Sheet title=""><MakersAbout placement={placement} /></Sheet>
}

