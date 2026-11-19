import { SiteHomeButton } from './SiteHome'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { CalendarDays, ChevronDown, Footprints, House, Info, LocateFixed, Loader2, MoonStar } from 'lucide-preact'
import type { Coordinates } from '../core/engine'
import { distanceKm } from '../core/geo'
import { isGraveOrShrine, looksLikePrayerSpace } from '../core/official'
import { fetchOK } from '../services/storage'
import { listNearby } from '../services/masjidList'
import { useStore } from '../services/store'
import { openSheet, Segmented } from './common'
import { FRIDAY_SG, fridayMosqueAt, fridayNearest, inSingapore, type FridayMosque } from '../core/friday'
import { tint } from './Dials'
import { MyMasjidGroup } from './MyMasjid'

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
    const display = name || (isMusollah ? 'Musollah' : 'Masjid')
    const key = `${display.toLowerCase()}|${Math.round(lat * 2000)}|${Math.round(lon * 2000)}`
    if (out.has(key)) continue
    const address = [t['addr:street'] && `${t['addr:housenumber'] ? t['addr:housenumber'] + ' ' : ''}${t['addr:street']}`, t['addr:suburb'] || t['addr:city']]
      .filter(Boolean).join(', ')
    out.set(key, { id: `${e.type}/${e.id}`, name: display, address, coordinates: c, distanceKm: km, isMusollah })
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

function directionsURL(c: Coordinates): string {
  const { latitude: la, longitude: lo } = c
  const apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?daddr=${la},${lo}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}&travelmode=walking`
}

/** How many places the list shows; the rest are pins on the map. */
const SHOW = 5

function distanceText(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

/** About 5 km an hour on foot, shown only when walking is a sensible choice. */
function walkText(km: number): string | null {
  if (km > 2) return null
  const min = Math.max(1, Math.round(km / 0.08))
  return `${min} min walk`
}

const escapeHTML = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function clock(hhmm: string, use24: boolean): string {
  if (use24) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`
}

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
  const [allFriday, setAllFriday] = useState(false)
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<{ api: typeof import('./leafletMap'); map: import('leaflet').Map; layer: import('leaflet').LayerGroup; you: import('leaflet').Marker } | null>(null)
  const dark = document.documentElement.dataset.theme !== 'light'
  const use24 = s.prefs.use24Hour

  const lat = here?.coordinates.latitude, lng = here?.coordinates.longitude
  const singapore = here ? inSingapore(here.coordinates, nearMe ? null : place?.countryCode) : false
  // Friday in Singapore until the second prayer is done (about 3 PM): the card goes to the top.
  const friday = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Singapore' }).formatToParts(new Date(s.now()))
    return parts.find((p) => p.type === 'weekday')?.value === 'Fri' && Number(parts.find((p) => p.type === 'hour')?.value) < 15
  }, [Math.floor(s.now() / 600_000)])

  const visible = useMemo(() => kind === 'all' ? spaces : spaces.filter((x) => (kind === 'musollah') === x.isMusollah), [spaces, kind])
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
    // Your own spot gets the country from the place list when it is close by.
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
      const you = api.youMarker(here.coordinates).addTo(m)
      const layer = api.L.layerGroup().addTo(m)
      map.current = { api, map: m, layer, you }
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
      const pin = m.api.spaceMarker(sp.coordinates, sp.isMusollah, sp.name)
      pin.bindPopup(`<div class="pin-pop"><b>${escapeHTML(sp.name)}</b><span>${distanceText(sp.distanceKm)} away</span>` +
        (fri ? `<span class="pin-fri">Two Friday prayers, 2nd from ${clock(FRIDAY_SG.secondSessionFrom, use24)}</span>` : '') +
        `<a href="${directionsURL(sp.coordinates)}" target="_blank" rel="noopener noreferrer">Directions</a></div>`, { closeButton: false, autoPanPaddingTopLeft: [16, 80] })
      pin.addTo(m.layer)
    }
    // You and the nearest few fill the map; the rest are a pinch or a drag away.
    const near = visibleRef.current.slice(0, SHOW).map((sp) => [sp.coordinates.latitude, sp.coordinates.longitude] as [number, number])
    if (near.length) {
      m.map.fitBounds(m.api.L.latLngBounds([[here.coordinates.latitude, here.coordinates.longitude], ...near]), { padding: [40, 40], maxZoom: 16, animate: false })
    } else {
      m.map.setView([here.coordinates.latitude, here.coordinates.longitude], 14, { animate: false })
    }
  }
  useEffect(draw, [visible, lat, lng])

  const focus = (c: Coordinates) => {
    map.current?.map.flyTo([c.latitude, c.longitude], 16, { duration: 0.6 })
    mapEl.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const top = visible.slice(0, SHOW)
  const more = visible.length - top.length

  const fridayCard = singapore && here
    ? <FridayCard from={here.coordinates} all={allFriday} onAll={() => setAllFriday((v) => !v)} today={friday} use24={use24} onFocus={focus} />
    : null

  return (
    <div class="masjid">
      <div class="masjid-map-wrap">
        <div ref={mapEl} class="masjid-map" />
        <div class="masjid-title">
          <SiteHomeButton class="masjid-home" />
          <span class="spacer" />
          <h1>Masjid &amp; Musollah</h1>
          <span class="spacer" />
          <button class="round-btn info" aria-label="About this app" onClick={() => openSheet({ kind: 'makers', placement: 'masjid' })}><Info size={20} /></button>
        </div>
      </div>
      <div class="page masjid-page">
        <MyMasjidGroup />
        <button class="near-me-btn" onClick={findNearMe} disabled={locating === 'busy'}>
          {locating === 'busy' ? <Loader2 class="spin" size={20} /> : <LocateFixed size={20} />}
          <span>{locating === 'busy' ? 'Finding where you are…' : nearMe ? 'Search again from here' : 'Find prayer places near me'}</span>
        </button>
        {locating === 'denied' && <p class="near-me-note secondary">Location is turned off for this site. Showing places near {place?.name ?? 'your saved place'}.</p>}
        {locating === 'failed' && <p class="near-me-note secondary">Couldn't find where you are. Showing places near {place?.name ?? 'your saved place'}.</p>}
        {friday && fridayCard}
        <div class="near-head">
          <h2>Nearest to {here?.fromGps ? 'you' : here?.label ?? 'you'}</h2>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'masjid', label: 'Masjid' }, { value: 'musollah', label: 'Musollah' }]} />
        </div>
        {!here && <Empty title="Choose a place" body="Tap the button above, or pick a city on the Prayer tab." />}
        {here && loading && spaces.length === 0 && <div class="masjid-loading"><Loader2 class="spin" size={22} /> {slow ? 'The free map server is busy. Still looking…' : 'Searching nearby…'}</div>}
        {here && !loading && visible.length === 0 && (
          <Empty title={failed ? "Couldn't search" : 'Nothing listed nearby'}
            body={failed ? "The free map servers didn't answer. Check your connection, or try again in a minute." : `OpenStreetMap has no ${kind === 'musollah' ? 'musollah' : 'masjid'} listed within 15 km. Use the Qibla tab to pray where you are.`}
            action={failed ? <button class="primary-btn" style={{ marginTop: 14 }} onClick={() => setAttempt((n) => n + 1)}>Try again</button> : undefined} />
        )}
        <ul class="space-list">
          {top.map((sp) => {
            const fri = singapore ? fridayMosqueAt(sp.coordinates) : null
            const walk = walkText(sp.distanceKm)
            return (
              <li>
                <button class="space-row" onClick={() => focus(sp.coordinates)}>
                  {sp.isMusollah ? <House size={20} style={{ color: tint('fajr') }} fill="currentColor" /> : <MoonStar size={20} class="accent" />}
                  <span class="space-text">
                    <span class="space-name">{sp.name}</span>
                    {sp.address && <span class="space-addr">{sp.address}</span>}
                    {fri && <span class="space-chip">2 Friday prayers</span>}
                  </span>
                  <span class="space-dist">
                    <span class="mono">{distanceText(sp.distanceKm)}</span>
                    {walk && <span class="space-walk">{walk}</span>}
                  </span>
                </button>
                <a class="walk" href={directionsURL(sp.coordinates)} target="_blank" rel="noopener noreferrer" aria-label={`Walking directions to ${sp.name}`}><Footprints size={17} /></a>
              </li>
            )
          })}
        </ul>
        {more > 0 && <p class="more-on-map secondary">{more} more within 15 km are on the map. Tap a pin to see its name and directions.</p>}
        {!friday && fridayCard}
        {spaces.length > 0 && <p class="footnote secondary" style={{ marginTop: '14px' }}>Places from OpenStreetMap contributors. Missing one? Anyone can add it at openstreetmap.org.</p>}
      </div>
    </div>
  )
}

/** Singapore only: masjids with a second Friday prayer, nearest first. */
function FridayCard({ from, all, onAll, today, use24, onFocus }: {
  from: Coordinates; all: boolean; onAll: () => void; today: boolean; use24: boolean; onFocus: (c: Coordinates) => void
}) {
  const list = fridayNearest(from)
  const shown = all ? list : list.slice(0, 3)
  const t = clock(FRIDAY_SG.secondSessionFrom, use24)
  const updated = new Date(FRIDAY_SG.sourceUpdated + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const row = (m: FridayMosque & { km: number }) => (
    <li>
      <button class="space-row" onClick={() => onFocus({ latitude: m.lat, longitude: m.lng })}>
        <MoonStar size={20} class="accent" />
        <span class="space-text">
          <span class="space-name">{m.name}</span>
          <span class="space-addr">{m.district}{m.womenSession2 ? '. Space for women in the 2nd prayer' : ''}</span>
        </span>
        <span class="space-dist"><span class="mono">{distanceText(m.km)}</span></span>
      </button>
      <a class="walk" href={directionsURL({ latitude: m.lat, longitude: m.lng })} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${m.name}`}><Footprints size={17} /></a>
    </li>
  )
  return (
    <section class={`friday-card${today ? ' today' : ''}`}>
      <div class="friday-head">
        <CalendarDays size={20} class="accent" />
        <div>
          <h2>{today ? 'Friday prayer today' : 'Friday prayer in Singapore'}</h2>
          <p class="secondary">{FRIDAY_SG.mosques.length} masjids hold a second Friday prayer from {t}, for those who can't make the first one at Zohor.</p>
        </div>
      </div>
      <ul class="space-list">{shown.map(row)}</ul>
      <button class="plain-btn friday-all" onClick={onAll} aria-expanded={all}>
        {all ? 'Show the nearest 3' : `See all ${list.length}`} <ChevronDown size={16} style={{ transform: all ? 'rotate(180deg)' : undefined }} />
      </button>
      <p class="footnote secondary">
        From the Islamic Religious Council of Singapore (MUIS), updated {updated}. No booking needed, except on public holidays. <a href={FRIDAY_SG.sourceUrl} target="_blank" rel="noopener noreferrer">See the MUIS list</a>
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
