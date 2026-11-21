import { SiteHomeButton } from './SiteHome'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Accessibility, Car, CalendarDays, ChevronDown, Clock, Droplets, Flag, Footprints, House, Info, LocateFixed, Loader2, MoonStar, ParkingCircle, Star, Users } from 'lucide-preact'
import type { Coordinates } from '../core/engine'
import { distanceKm } from '../core/geo'
import { RING_LABEL_ANGLE, ringDistance, ringsFor } from '../core/mapRings'
import { isGraveOrShrine, looksLikePrayerSpace } from '../core/official'
import { fetchOK } from '../services/storage'
import { listNearby } from '../services/masjidList'
import { useStore } from '../services/store'
import { openSheet, Segmented } from './common'
import { FRIDAY_SG, fridayMosqueAt, fridayNearest, inSingapore, type FridayMosque } from '../core/friday'
import { currentEid, eidAt, type EidEvent, type EidMosque } from '../core/eid'
import { hoursAt, localWeekMinute, type HoursNow } from '../core/openingHours'
import { OBLIGATORY, prayerName } from '../core/prayer'
import type { MasjidLink } from '../core/masjidLink'
import { store } from '../services/store'
import { tint } from './Dials'
import { appLocale, tr, trWith } from '../core/appWords'

/**
 * Masjids and musollahs (surau, prayer rooms) near the active place, from
 * OpenStreetMap through the Overpass API. The search sends the area (your
 * place's coordinates, rounded) to Overpass; nothing else.
 */
export interface PrayerSpace {
  id: string
  name: string
  address: string
  coordinates: Coordinates
  distanceKm: number
  isMusollah: boolean
  /** w women's space, a wheelchair, p parking, t toilets (from OpenStreetMap). */
  facilities?: string
  /** OpenStreetMap opening_hours, mostly on prayer rooms in malls. */
  hours?: string
}

type Kind = 'all' | 'masjid' | 'musollah'
const MUSOLLAH_WORDS = ['musolla', 'musalla', 'musholla', 'surau', 'prayer room', 'prayer space', 'mushola', 'prayer hall']
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']

interface OsmElement { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

export function parseOverpass(json: { elements?: OsmElement[] }, center: Coordinates): PrayerSpace[] {
  const out = new Map<string, PrayerSpace>()
  for (const e of json.elements ?? []) {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon
    if (lat == null || lon == null) continue
    const t = e.tags ?? {}
    const name = t['name:en'] || t.name || ''
    const kindTag = (t['place_of_worship:type'] || t.place_of_worship || '').toLowerCase()
    const lower = name.toLowerCase()
    const isMusollah = MUSOLLAH_WORDS.some((w) => lower.includes(w)) || ['musalla', 'musholla', 'surau', 'prayer_room', 'musallah'].includes(kindTag)
    // Tagged places are prayer spaces by definition; untagged names must say so.
    if (t.amenity !== 'place_of_worship' && !looksLikePrayerSpace(name)) continue
    if (isGraveOrShrine(name)) continue
    const c = { latitude: lat, longitude: lon }
    const km = distanceKm(center, c)
    if (km > 15) continue
    const display = name || (isMusollah ? tr('masjid.musollah') : tr('masjid.masjid'))
    const key = `${display.toLowerCase()}|${Math.round(lat * 2000)}|${Math.round(lon * 2000)}`
    if (out.has(key)) continue
    const address = [t['addr:street'] && `${t['addr:housenumber'] ? t['addr:housenumber'] + ' ' : ''}${t['addr:street']}`, t['addr:suburb'] || t['addr:city']]
      .filter(Boolean).join(', ')
    const yes = (v?: string) => ['yes', 'designated', 'limited', 'separate', 'only'].includes((v ?? '').toLowerCase())
    const facilities = (yes(t.female) || yes(t.women) ? 'w' : '') + (yes(t.wheelchair) ? 'a' : '') +
      (t.parking && t.parking !== 'no' ? 'p' : '') + (yes(t.toilets) ? 't' : '')
    out.set(key, { id: `${e.type}/${e.id}`, name: display, address, coordinates: c, distanceKm: km, isMusollah,
      ...(facilities ? { facilities } : {}), ...(t.opening_hours ? { hours: t.opening_hours } : {}) })
  }
  return [...out.values()].sort((a, b) => a.distanceKm - b.distanceKm)
}

async function searchNearby(center: Coordinates, country?: string | null): Promise<PrayerSpace[] | null> {
  // The weekly ready-made list first: a small file, answered in about a second.
  const listed = await listNearby(center, country).catch(() => null)
  if (listed) return listed
  const lat = center.latitude.toFixed(4), lng = center.longitude.toFixed(4)
  // Remembered for a week per ~1 km square, so coming back is instant even when
  // the free OpenStreetMap servers are busy. Distances are worked out again from here.
  const cacheKey = `ptasia.masjid.${center.latitude.toFixed(2)},${center.longitude.toFixed(2)}`
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) ?? 'null') as { at: number; spaces: PrayerSpace[] } | null
    if (cached && Date.now() - cached.at < 7 * 86_400_000 && Array.isArray(cached.spaces)) {
      return cached.spaces
        .map((x) => ({ ...x, distanceKm: distanceKm(center, x.coordinates) }))
        .filter((x) => x.distanceKm <= 15)
        .sort((a, b) => a.distanceKm - b.distanceKm)
    }
  } catch { /* ignore */ }
  const q = `[out:json][timeout:20];(nwr["amenity"="place_of_worship"]["religion"="muslim"](around:12000,${lat},${lng}););out center tags;`
  const ask = async (base: string) => {
    // Busy public servers can take 15-30 s to answer, so give each one time.
    const r = await fetchOK(`${base}?data=${encodeURIComponent(q)}`, 45000)
    if (!r) throw new Error('no answer')
    return parseOverpass(await r.json(), center)
  }
  // Ask every mirror at once and take the first answer, so one busy or dead
  // server can't leave the list spinning.
  const spaces = await Promise.any(OVERPASS.map(ask)).catch(() => null)
  if (spaces) try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), spaces })) } catch { /* ignore */ }
  return spaces
}

type Mode = 'walk' | 'drive'
const MODE_KEY = 'ptasia.masjid.mode'

/** "Second Friday prayer from 1:30 PM", with or without the women's line. */
function secondFridayLine(women: boolean | undefined, use24: boolean): string {
  const time = clock(FRIDAY_SG.secondSessionFrom, use24)
  return women ? tr('masjid.secondFridayWomen', { time }) : tr('masjid.secondFriday', { time })
}

function directionsURL(c: Coordinates, mode: Mode): string {
  const { latitude: la, longitude: lo } = c
  const apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?daddr=${la},${lo}&dirflg=${mode === 'walk' ? 'w' : 'd'}`
    : `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}&travelmode=${mode === 'walk' ? 'walking' : 'driving'}`
}

/** A note on OpenStreetMap at this spot, so a volunteer can fix or add the place. No sign up needed. */
function reportURL(c: Coordinates): string {
  return `https://www.openstreetmap.org/note/new#map=19/${c.latitude.toFixed(5)}/${c.longitude.toFixed(5)}`
}

/** How many places the list shows; the rest are pins on the map. */
const SHOW = 5

/** Distance rings around you on the map. */

function distanceText(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

/**
 * About 5 km an hour on foot, shown up to 2 km. By car, a rough town pace
 * (about 30 km an hour plus a little for parking); the maps app shows the jams.
 */
function tripText(km: number, mode: Mode): string | null {
  if (mode === 'walk') return km > 2 ? null : tr('masjid.walkMin', { n: Math.max(1, Math.round(km / 0.08)) })
  return tr('masjid.driveMin', { n: Math.max(2, Math.round(km * 2 + 2)) })
}

const escapeHTML = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function clock(hhmm: string, use24: boolean): string {
  if (use24) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`
}

function hoursText(h: HoursNow, use24: boolean): string {
  if (h.open) return h.until ? tr('masjid.openUntil', { time: clock(h.until, use24) }) : tr('masjid.openAllDay')
  return h.opensAt ? tr('masjid.closedOpens', { time: clock(h.opensAt, use24) }) : tr('masjid.closedToday')
}

const FACILITIES: [string, 'masjid.women' | 'masjid.wheelchair' | 'masjid.parking' | 'masjid.toilets', typeof Users][] = [['w', 'masjid.women', Users], ['a', 'masjid.wheelchair', Accessibility], ['p', 'masjid.parking', ParkingCircle], ['t', 'masjid.toilets', Droplets]]

/** "Eid al-Fitr prayer" or "Eid al-Adha prayer" from the MUIS event name, in the app's language. */
const eidPrayerName = (e: EidEvent): string => tr(/adha/i.test(e.name) ? 'masjid.eidAdha' : 'masjid.eidFitr')

type Here = { coordinates: Coordinates; label: string; fromGps: boolean }

export default function MasjidScreen() {
  const s = useStore()
  const place = s.activePlace
  const [nearMe, setNearMe] = useState<Coordinates | null>(null)
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied' | 'failed'>('idle')
  const here: Here | null = nearMe
    ? { coordinates: nearMe, label: 'you now', fromGps: true }
    : place ? { coordinates: place.coordinates, label: place.name, fromGps: s.prefs.useGPS && place.id === 'gps' } : null
  const [spaces, setSpaces] = useState<PrayerSpace[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [kind, setKind] = useState<Kind>('all')
  const [openOnly, setOpenOnly] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mode, setModeState] = useState<Mode>(() => { try { return localStorage.getItem(MODE_KEY) === 'drive' ? 'drive' : 'walk' } catch { return 'walk' } })
  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ } }
  const [allFriday, setAllFriday] = useState(false)
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<{ api: typeof import('./leafletMap'); map: import('leaflet').Map; layer: import('leaflet').LayerGroup; ringLayer: import('leaflet').LayerGroup; rings: string; you: import('leaflet').Marker } | null>(null)
  const drawRingsRef = useRef<() => void>(() => undefined)
  const dark = document.documentElement.dataset.theme !== 'light'
  const use24 = s.prefs.use24Hour
  const tz = place?.timeZoneID || Intl.DateTimeFormat().resolvedOptions().timeZone

  const lat = here?.coordinates.latitude, lng = here?.coordinates.longitude
  const singapore = here ? inSingapore(here.coordinates, nearMe ? null : place?.countryCode) : false
  const tick = Math.floor(s.now() / 600_000)
  // Friday in Singapore until the second prayer is done (about 3 PM): the card goes to the top.
  const friday = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Singapore' }).formatToParts(new Date(s.now()))
    return parts.find((p) => p.type === 'weekday')?.value === 'Fri' && Number(parts.find((p) => p.type === 'hour')?.value) < 15
  }, [tick])
  const eid: EidEvent | null = useMemo(() => {
    if (!singapore) return null
    const sample = !!s.demo && new URLSearchParams(location.search).get('eid') === 'sample'
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date(s.now()))
    return currentEid(today, sample)
  }, [tick, singapore])
  const week = useMemo(() => localWeekMinute(s.now(), tz), [tick, tz])
  const hoursOf = (sp: PrayerSpace) => sp.hours ? hoursAt(sp.hours, week.weekday, week.minute) : null

  const visible = useMemo(() => spaces
    .filter((x) => kind === 'all' || (kind === 'musollah') === x.isMusollah)
    .filter((x) => !openOnly || hoursOf(x)?.open), [spaces, kind, openOnly, week])
  const anyHours = useMemo(() => spaces.some((x) => hoursOf(x) != null), [spaces, week])
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  const findNearMe = () => {
    if (!('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setNearMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocating('idle') },
      (err) => setLocating(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
    )
  }

  useEffect(() => {
    if (!here) return
    let cancelled = false
    setLoading(true); setFailed(false); setSlow(false)
    const slowTimer = setTimeout(() => setSlow(true), 8000)
    const country = nearMe ? (inSingapore(nearMe) ? 'SG' : place?.countryCode) : place?.countryCode
    searchNearby(here.coordinates, country).then((r) => {
      clearTimeout(slowTimer)
      if (cancelled) return
      setLoading(false)
      if (r) setSpaces(r.map((x) => ({ ...x, distanceKm: distanceKm(here.coordinates, x.coordinates) })).sort((a, b) => a.distanceKm - b.distanceKm))
      else { setSpaces([]); setFailed(true) }
    })
    return () => { cancelled = true; clearTimeout(slowTimer) }
  }, [lat, lng, attempt])

  useEffect(() => {
    if (!here || !mapEl.current) return
    let cancelled = false
    import('./leafletMap').then((api) => {
      if (cancelled || !mapEl.current) return
      const m = api.createMap(mapEl.current, here.coordinates, dark, 13)
      const you = api.youMarker(here.coordinates, true).addTo(m)
      const layer = api.L.layerGroup().addTo(m)
      const ringLayer = api.L.layerGroup().addTo(m)
      map.current = { api, map: m, layer, ringLayer, rings: '', you }
      m.on('zoomend', () => drawRingsRef.current())
      draw()
    }).catch(() => undefined)
    return () => { cancelled = true; map.current?.map.remove(); map.current = null }
  }, [place?.coordinates.latitude, place?.coordinates.longitude, dark])

  const draw = () => {
    const m = map.current
    if (!m || !here) return
    m.you.setLatLng([here.coordinates.latitude, here.coordinates.longitude])
    m.layer.clearLayers()
    for (const sp of visibleRef.current) {
      const fri = singapore ? fridayMosqueAt(sp.coordinates) : null
      const h = hoursOf(sp)
      const trip = tripText(sp.distanceKm, mode)
      const pin = m.api.spaceMarker(sp.coordinates, sp.isMusollah, sp.name)
      pin.bindPopup(`<div class="pin-pop"><b>${escapeHTML(sp.name)}</b><span>${escapeHTML(tr('masjid.away', { distance: distanceText(sp.distanceKm) }))}${trip ? ', ' + escapeHTML(trip) : ''}</span>` +
        (h ? `<span class="${h.open ? 'pin-open' : ''}">${hoursText(h, use24)}</span>` : '') +
        (fri ? `<span class="pin-fri">${escapeHTML(tr('masjid.twoFriday', { time: clock(FRIDAY_SG.secondSessionFrom, use24) }))}</span>` : '') +
        `<a href="${directionsURL(sp.coordinates, mode)}" target="_blank" rel="noopener noreferrer">${escapeHTML(tr('masjid.directions'))}</a></div>`, { closeButton: false, autoPanPaddingTopLeft: [16, 80] })
      pin.addTo(m.layer)
    }
    const near = visibleRef.current.slice(0, SHOW).map((sp) => [sp.coordinates.latitude, sp.coordinates.longitude] as [number, number])
    // Always show at least the 1 km ring, so the nearest pins have something to measure against.
    const { latitude: la, longitude: lo } = here.coordinates
    const d = 1 / 111.2, dl = d / Math.max(0.2, Math.cos(la * Math.PI / 180))
    m.map.fitBounds(m.api.L.latLngBounds([[la - d, lo - dl], [la + d, lo + dl], ...near]), { padding: [36, 36], maxZoom: 16, animate: false })
    m.rings = ''
    drawRings()
  }

  // Three rings in 1 2 5 steps that suit the zoom: 500 m, 1 and 2 km close up, 1, 2 and 5 km
  // further out, up to 5, 10 and 20 km, as on iPhone and Android.
  const drawRings = () => {
    const m = map.current
    if (!m || !here) return
    const b = m.map.getBounds()
    const la = here.coordinates.latitude
    const halfH = (b.getNorth() - b.getSouth()) * 111.2 / 2
    const halfW = (b.getEast() - b.getWest()) * 111.2 * Math.cos(la * Math.PI / 180) / 2
    const set = ringsFor(halfW, halfH)
    const key = `${set.join(',')} ${mode} ${la} ${here.coordinates.longitude}`
    if (key === m.rings) return
    m.rings = key
    m.ringLayer.clearLayers()
    m.api.distanceRings(here.coordinates, set.map((km) => {
      const trip = tripText(km, mode)
      return { km, label: trip ? `${ringDistance(km)}, ${trip.replace(/ (walk|drive)$/, '')}` : ringDistance(km) }
    }), RING_LABEL_ANGLE).addTo(m.ringLayer)
  }
  drawRingsRef.current = drawRings
  useEffect(draw, [visible, lat, lng, mode])

  const focus = (c: Coordinates) => {
    map.current?.map.flyTo([c.latitude, c.longitude], 16, { duration: 0.6 })
  }

  const top = visible.slice(0, SHOW)
  const more = visible.length - top.length
  const mine = s.prefs.myMasjid
  const isMine = (c: Coordinates) => !!mine && Math.abs(mine.lat - c.latitude) < 0.003 && Math.abs(mine.lng - c.longitude) < 0.003

  const fridayCard = singapore && here
    ? <FridayCard from={here.coordinates} all={allFriday} onAll={() => setAllFriday((v) => !v)} today={friday} use24={use24} mode={mode} onFocus={focus} />
    : null

  return (
    <div class="masjid">
      <div class="masjid-map-wrap">
        <div ref={mapEl} class="masjid-map" />
        <div class="masjid-title">
          <SiteHomeButton class="masjid-home" />
          <span class="spacer" />
          <h1>{tr('masjid.title')}</h1>
          <span class="spacer" />
          <button class="round-btn info" aria-label={tr('masjid.about')} onClick={() => openSheet({ kind: 'makers', placement: 'masjid' })}><Info size={20} /></button>
        </div>
      </div>
      <div class="page masjid-page">
        {mine && here && <YourMasjid m={mine} from={here.coordinates} mode={mode} use24={use24} singapore={singapore} eid={eid} onFocus={focus} />}
        <button class="near-me-btn" onClick={findNearMe} disabled={locating === 'busy'}>
          {locating === 'busy' ? <Loader2 class="spin" size={20} /> : <LocateFixed size={20} />}
          <span>{locating === 'busy' ? tr('today.finding') : nearMe ? tr('masjid.searchAgain') : tr('masjid.findNear')}</span>
        </button>
        {locating === 'denied' && <p class="near-me-note secondary">{tr('masjid.locationOff', { place: place?.name ?? tr('masjid.savedPlace') })}</p>}
        {locating === 'failed' && <p class="near-me-note secondary">{tr('masjid.locationFailed', { place: place?.name ?? tr('masjid.savedPlace') })}</p>}
        {eid && here && <EidCard e={eid} from={here.coordinates} spaces={spaces} use24={use24} />}
        {friday && fridayCard}
        <div class="near-head">
          <div class="near-title">
            <h2>{here && !here.fromGps && here.label ? tr('masjid.nearestTo', { place: here.label }) : tr('masjid.nearestYou')}</h2>
            <div class="mode-switch" role="group" aria-label={tr('masjid.howGoing')}>
              <button aria-pressed={mode === 'walk'} onClick={() => setMode('walk')}><Footprints size={15} /> {tr('masjid.walk')}</button>
              <button aria-pressed={mode === 'drive'} onClick={() => setMode('drive')}><Car size={15} /> {tr('masjid.drive')}</button>
            </div>
          </div>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: tr('masjid.all') }, { value: 'masjid', label: tr('masjid.masjid') }, { value: 'musollah', label: tr('masjid.musollah') }]} />
          {anyHours && (
            <button class={`open-chip${openOnly ? ' on' : ''}`} aria-pressed={openOnly} onClick={() => setOpenOnly((v) => !v)}>
              <Clock size={14} /> {tr('masjid.openOnly')}
            </button>
          )}
        </div>
        {mode === 'drive' && <p class="near-me-note secondary">{tr('masjid.driveNote')}</p>}
        {!here && <Empty title={tr('masjid.choosePlace')} body={tr('masjid.choosePlaceBody')} />}
        {here && loading && spaces.length === 0 && <div class="masjid-loading"><Loader2 class="spin" size={22} /> {slow ? tr('masjid.busy') : tr('masjid.searching')}</div>}
        {here && !loading && visible.length === 0 && (
          <Empty title={failed ? tr('masjid.failed') : openOnly ? tr('masjid.nothingOpen') : tr('masjid.nothing')}
            body={failed ? tr('masjid.failedHelp')
              : openOnly ? tr('masjid.nothingOpenBody')
              : tr('masjid.nothingHelp', { kind: kind === 'musollah' ? tr('masjid.prayerRooms') : tr('masjid.masjidWord') })}
            action={failed ? <button class="primary-btn" style={{ marginTop: 14 }} onClick={() => setAttempt((n) => n + 1)}>{tr('common.tryAgain')}</button> : undefined} />
        )}
        <ul class="space-list">
          {top.map((sp) => {
            const fri = singapore ? fridayMosqueAt(sp.coordinates) : null
            const trip = tripText(sp.distanceKm, mode)
            const h = hoursOf(sp)
            const raya = eid ? eidAt(eid, sp.name, sp.coordinates) : null
            const open = expanded === sp.id
            return (
              <li class={open ? 'open' : ''}>
                <div class="space-line">
                  <button class="space-row" aria-expanded={open} onClick={() => { setExpanded(open ? null : sp.id); focus(sp.coordinates) }}>
                    {sp.isMusollah ? <House size={20} style={{ color: tint('fajr') }} fill="currentColor" /> : <MoonStar size={20} class="accent" />}
                    <span class="space-text">
                      <span class="space-name">{isMine(sp.coordinates) && <Star size={14} class="accent" fill="currentColor" style={{ marginRight: 4 }} />}{sp.name}</span>
                      {sp.address && <span class="space-addr">{sp.address}</span>}
                      {(fri || h) && (
                        <span class="space-chips">
                          {fri && <span class="space-chip">{tr('masjid.twoFridayChip')}</span>}
                          {h && <span class={`space-chip ${h.open ? 'ok' : 'closed'}`}>{h.open ? tr('masjid.openNow') : tr('masjid.closedNow')}</span>}
                        </span>
                      )}
                    </span>
                    <span class="space-dist">
                      <span class="mono">{distanceText(sp.distanceKm)}</span>
                      {trip && <span class="space-walk">{trip}</span>}
                    </span>
                  </button>
                  <a class="walk" href={directionsURL(sp.coordinates, mode)} target="_blank" rel="noopener noreferrer" aria-label={mode === 'walk' ? tr('masjid.walking', { name: sp.name }) : tr('masjid.drivingTo', { name: sp.name })}>{mode === 'walk' ? <Footprints size={17} /> : <Car size={17} />}</a>
                </div>
                {open && (
                  <div class="space-more">
                    <Facilities f={sp.facilities} />
                    {h && <p><Clock size={14} /> {hoursText(h, use24)}</p>}
                    {fri && <p class="accent-text">{secondFridayLine(fri.womenSession2, use24)}</p>}
                    {raya && <p class="accent-text">{tr('masjid.eidAt', { name: eidPrayerName(eid!), times: raya.sessions.map((x) => clock(x.time, use24)).join(', ') })}</p>}
                    <div class="space-actions">
                      <a class="plain-btn" href={directionsURL(sp.coordinates, mode)} target="_blank" rel="noopener noreferrer">{mode === 'walk' ? <Footprints size={15} /> : <Car size={15} />} {tr('masjid.directions')}</a>
                      {isMine(sp.coordinates)
                        ? <span class="plain-btn done"><Star size={15} fill="currentColor" /> {sp.isMusollah ? tr('masjid.keptTop') : tr('myMasjid.title')}</span>
                        : <button class="plain-btn" onClick={() => s.chooseMasjid(sp.name, sp.coordinates)}><Star size={15} /> {sp.isMusollah ? tr('masjid.keepTop') : tr('masjid.makeMine')}</button>}
                      <a class="plain-btn quiet" href={reportURL(sp.coordinates)} target="_blank" rel="noopener noreferrer"><Flag size={15} /> {tr('masjid.report')}</a>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {more > 0 && <p class="more-on-map secondary">{tr('masjid.moreOnMap', { n: more })}</p>}
        {!mine && spaces.length > 0 && <p class="more-on-map secondary">{tr('masjid.keepHint')}</p>}
        {!friday && fridayCard}
        {here && (
          <p class="footnote secondary" style={{ marginTop: '14px' }}>
            {trWith('masjid.mapCredit', { link: <a href={reportURL(here.coordinates)} target="_blank" rel="noopener noreferrer">{tr('masjid.tellMap')}</a> })}
          </p>
        )}
      </div>
    </div>
  )
}

function Facilities({ f }: { f?: string }) {
  const have = FACILITIES.filter(([k]) => f?.includes(k))
  if (!have.length) return <p class="secondary">{tr('masjid.noFacilities')}</p>
  return <div class="space-chips">{have.map(([, label, Icon]) => <span class="space-chip plain"><Icon size={13} /> {tr(label)}</span>)}</div>
}

/** "Subuh +15, Zohor 1:15 PM", one line. */
function iqamahLine(m: MasjidLink, use24: boolean): string | null {
  const parts = OBLIGATORY.filter((p) => m.jamaah[p]).map((p) => {
    const r = m.jamaah[p]!
    return `${store.name(p)} ${r.fixed ? clock(r.fixed, use24) : `+${r.after} min`}`
  })
  if (m.jumuah) parts.push(`${prayerName('dhuhr', store.naming, true)} ${clock(m.jumuah, use24)}`)
  return parts.length ? parts.join(', ') : null
}

/** Your masjid, pinned at the top with how far it is and its iqamah times. */
function YourMasjid({ m, from, mode, use24, singapore, eid, onFocus }: {
  m: MasjidLink; from: Coordinates; mode: Mode; use24: boolean; singapore: boolean; eid: EidEvent | null; onFocus: (c: Coordinates) => void
}) {
  const s = useStore()
  const c = { latitude: m.lat, longitude: m.lng }
  const km = distanceKm(from, c)
  const trip = tripText(km, mode)
  const iq = iqamahLine(m, use24)
  const fri = singapore ? fridayMosqueAt(c) : null
  const raya = eid ? eidAt(eid, m.name, c) : null
  return (
    <section class="your-masjid">
      <button class="your-masjid-main" onClick={() => onFocus(c)}>
        <Star size={20} class="accent" fill="currentColor" />
        <span class="space-text">
          <span class="caps secondary">{tr('myMasjid.title')}</span>
          <span class="space-name">{m.name}</span>
          <span class="space-addr">{tr('masjid.away', { distance: distanceText(km) })}{trip ? `, ${trip}` : ''}</span>
        </span>
      </button>
      <p class="your-masjid-line">{iq ? tr('masjid.iqamahLine', { times: iq }) : tr('masjid.iqamahHow')}</p>
      {fri && <p class="your-masjid-line accent-text">{secondFridayLine(fri.womenSession2, use24)}</p>}
      {raya && <p class="your-masjid-line accent-text">{tr('masjid.eidAt', { name: eidPrayerName(eid!), times: raya.sessions.map((x) => clock(x.time, use24)).join(', ') })}</p>}
      {!raya && m.eid && <p class="your-masjid-line accent-text">{tr('masjid.eidAtTime', { time: clock(m.eid, use24) })}</p>}
      <div class="space-actions">
        <a class="plain-btn" href={directionsURL(c, mode)} target="_blank" rel="noopener noreferrer">{mode === 'walk' ? <Footprints size={15} /> : <Car size={15} />} {tr('masjid.directions')}</a>
        <button class="plain-btn quiet" onClick={() => s.forgetMasjid()}>{tr('common.remove')}</button>
      </div>
    </section>
  )
}

/** Singapore, in the two weeks before Hari Raya: sessions at the nearest masjids, from MUIS. */
function EidCard({ e, from, spaces, use24 }: { e: EidEvent; from: Coordinates; spaces: PrayerSpace[]; use24: boolean }) {
  const [all, setAll] = useState(false)
  // Place each listed masjid on the map list (by spot or name) to know how far it is.
  const rows = e.mosques.map((m) => {
    const c = m.lat != null && m.lng != null ? { latitude: m.lat, longitude: m.lng }
      : spaces.find((sp) => eidAt({ ...e, mosques: [m] }, sp.name, sp.coordinates))?.coordinates
    return { m, km: c ? distanceKm(from, c) : null }
  }).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))
  const shown = all ? rows : rows.slice(0, 3)
  const date = new Date(e.date + 'T00:00:00').toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
  const sessionText = (m: EidMosque) => m.sessions.map((x) => `${clock(x.time, use24)}${x.khutbah ? ` (${x.khutbah})` : ''}`).join(', ')
  return (
    <section class="friday-card today eid-card">
      <div class="friday-head">
        <MoonStar size={20} class="accent" />
        <div>
          <h2>{eidPrayerName(e)}</h2>
          <p class="secondary">{tr('masjid.eidNearest', { date })}</p>
        </div>
      </div>
      <ul class="space-list">
        {shown.map(({ m, km }) => (
          <li>
            <div class="space-line">
              <div class="space-row static">
                <MoonStar size={20} class="accent" />
                <span class="space-text">
                  <span class="space-name">{m.name}</span>
                  <span class="space-addr">{sessionText(m)}</span>
                  {(m.sessions.some((x) => x.women) || m.note) && (
                    <span class="space-addr">{[m.sessions.some((x) => x.women) ? tr('masjid.spaceWomen') : '', m.note ?? ''].filter(Boolean).join('. ')}</span>
                  )}
                </span>
                {km != null && <span class="space-dist"><span class="mono">{distanceText(km)}</span></span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > 3 && (
        <button class="plain-btn friday-all" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? tr('masjid.showNearest3') : tr('masjid.seeAll', { n: rows.length })} <ChevronDown size={16} style={{ transform: all ? 'rotate(180deg)' : undefined }} />
        </button>
      )}
      <p class="footnote secondary">
        {trWith('masjid.fromMuis', { link: <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">{tr('masjid.seeMuis')}</a> })}
      </p>
    </section>
  )
}

/** Singapore only: masjids with a second Friday prayer, nearest first. */
function FridayCard({ from, all, onAll, today, use24, mode, onFocus }: {
  from: Coordinates; all: boolean; onAll: () => void; today: boolean; use24: boolean; mode: Mode; onFocus: (c: Coordinates) => void
}) {
  const list = fridayNearest(from)
  const shown = all ? list : list.slice(0, 3)
  const t = clock(FRIDAY_SG.secondSessionFrom, use24)
  const updated = new Date(FRIDAY_SG.sourceUpdated + 'T00:00:00').toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
  const row = (m: FridayMosque & { km: number }) => {
    const trip = tripText(m.km, mode)
    return (
      <li>
        <div class="space-line">
          <button class="space-row" onClick={() => onFocus({ latitude: m.lat, longitude: m.lng })}>
            <MoonStar size={20} class="accent" />
            <span class="space-text">
              <span class="space-name">{m.name}</span>
              <span class="space-addr">{m.district}{m.womenSession2 ? `. ${tr('masjid.women2')}` : ''}</span>
            </span>
            <span class="space-dist"><span class="mono">{distanceText(m.km)}</span>{trip && <span class="space-walk">{trip}</span>}</span>
          </button>
          <a class="walk" href={directionsURL({ latitude: m.lat, longitude: m.lng }, mode)} target="_blank" rel="noopener noreferrer" aria-label={tr('masjid.directionsTo', { name: m.name })}>{mode === 'walk' ? <Footprints size={17} /> : <Car size={17} />}</a>
        </div>
      </li>
    )
  }
  return (
    <section class={`friday-card${today ? ' today' : ''}`}>
      <div class="friday-head">
        <CalendarDays size={20} class="accent" />
        <div>
          <h2>{today ? tr('masjid.fridayToday') : tr('masjid.fridaySg')}</h2>
          <p class="secondary">{tr('masjid.fridayHold', { n: FRIDAY_SG.mosques.length, time: t, name: store.name('dhuhr') })}</p>
        </div>
      </div>
      <ul class="space-list">{shown.map(row)}</ul>
      <button class="plain-btn friday-all" onClick={onAll} aria-expanded={all}>
        {all ? tr('masjid.showNearest3') : tr('masjid.seeAll', { n: list.length })} <ChevronDown size={16} style={{ transform: all ? 'rotate(180deg)' : undefined }} />
      </button>
      <p class="footnote secondary">
        {trWith('masjid.fromMuisUpdated', { date: updated, link: <a href={FRIDAY_SG.sourceUrl} target="_blank" rel="noopener noreferrer">{tr('masjid.seeMuis')}</a> })}
      </p>
    </section>
  )
}

function Empty({ title, body, action }: { title: string; body: string; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <MoonStar size={40} strokeWidth={1.4} style={{ opacity: 0.6 }} />
      <div class="headline">{title}</div>
      <div class="subhead secondary">{body}</div>
      {action}
    </div>
  )
}
