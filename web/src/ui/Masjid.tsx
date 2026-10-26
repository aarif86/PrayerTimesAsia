import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Footprints, House, Info, Loader2, MoonStar } from 'lucide-preact'
import type { Coordinates } from '../core/engine'
import { distanceKm } from '../core/geo'
import { looksLikePrayerSpace } from '../core/official'
import { fetchOK } from '../services/storage'
import { useStore } from '../services/store'
import { openSheet, Segmented } from './common'
import { tint } from './Dials'

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
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

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

async function searchNearby(center: Coordinates): Promise<PrayerSpace[] | null> {
  const lat = center.latitude.toFixed(4), lng = center.longitude.toFixed(4)
  const cacheKey = `ptasia.masjid.${lat},${lng}`
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) return JSON.parse(cached) as PrayerSpace[]
  } catch { /* ignore */ }
  const q = `[out:json][timeout:25];(nwr["amenity"="place_of_worship"]["religion"="muslim"](around:12000,${lat},${lng}););out center tags 300;`
  for (const base of OVERPASS) {
    const r = await fetchOK(`${base}?data=${encodeURIComponent(q)}`, 25000)
    if (!r) continue
    try {
      const spaces = parseOverpass(await r.json(), center)
      try { sessionStorage.setItem(cacheKey, JSON.stringify(spaces)) } catch { /* ignore */ }
      return spaces
    } catch { /* try the next mirror */ }
  }
  return null
}

function directionsURL(s: PrayerSpace): string {
  const { latitude: la, longitude: lo } = s.coordinates
  const apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
  return apple
    ? `https://maps.apple.com/?daddr=${la},${lo}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}&travelmode=walking`
}

export default function MasjidScreen() {
  const s = useStore()
  const place = s.activePlace
  const [spaces, setSpaces] = useState<PrayerSpace[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [kind, setKind] = useState<Kind>('all')
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<{ api: typeof import('./leafletMap'); map: import('leaflet').Map; layer: import('leaflet').LayerGroup } | null>(null)
  const dark = document.documentElement.dataset.theme !== 'light'

  const visible = useMemo(() => kind === 'all' ? spaces : spaces.filter((x) => (kind === 'musollah') === x.isMusollah), [spaces, kind])
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  useEffect(() => {
    if (!place) return
    let cancelled = false
    setLoading(true); setFailed(false)
    searchNearby(place.coordinates).then((r) => {
      if (cancelled) return
      setLoading(false)
      if (r) setSpaces(r); else { setSpaces([]); setFailed(true) }
    })
    return () => { cancelled = true }
  }, [place?.coordinates.latitude, place?.coordinates.longitude])

  useEffect(() => {
    if (!place || !mapEl.current) return
    let cancelled = false
    import('./leafletMap').then((api) => {
      if (cancelled || !mapEl.current) return
      const m = api.createMap(mapEl.current, place.coordinates, dark, 13)
      api.youMarker(place.coordinates).addTo(m)
      const layer = api.L.layerGroup().addTo(m)
      map.current = { api, map: m, layer }
      draw()
    }).catch(() => undefined)
    return () => { cancelled = true; map.current?.map.remove(); map.current = null }
  }, [place?.coordinates.latitude, place?.coordinates.longitude, dark])

  const draw = () => {
    const m = map.current
    if (!m) return
    m.layer.clearLayers()
    for (const sp of visibleRef.current) m.api.spaceMarker(sp.coordinates, sp.isMusollah, sp.name).addTo(m.layer)
    // Show you and the nearest few, like the iOS map's automatic camera.
    const near = visibleRef.current.slice(0, 8).map((sp) => [sp.coordinates.latitude, sp.coordinates.longitude] as [number, number])
    if (near.length && place) {
      m.map.fitBounds(m.api.L.latLngBounds([[place.coordinates.latitude, place.coordinates.longitude], ...near]), { padding: [36, 36], maxZoom: 15, animate: false })
    }
  }
  useEffect(draw, [visible])

  const focus = (sp: PrayerSpace) => {
    map.current?.map.flyTo([sp.coordinates.latitude, sp.coordinates.longitude], 16, { duration: 0.6 })
    mapEl.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div class="masjid">
      <div class="masjid-map-wrap">
        <div ref={mapEl} class="masjid-map" />
        <div class="masjid-title">
          <span class="spacer" />
          <h1>Masjid &amp; Musollah</h1>
          <span class="spacer" />
          <button class="round-btn info" aria-label="About this app" onClick={() => openSheet({ kind: 'makers', placement: 'masjid' })}><Info size={20} /></button>
        </div>
      </div>
      <div class="page" style={{ paddingTop: '14px' }}>
        <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'masjid', label: 'Masjid' }, { value: 'musollah', label: 'Musollah' }]} />
        {!place && <Empty title="Choose a place" body="Allow location or pick a city on the Prayer tab." />}
        {place && loading && spaces.length === 0 && <div class="masjid-loading"><Loader2 class="spin" size={22} /> Searching nearby…</div>}
        {place && !loading && visible.length === 0 && (
          <Empty title={failed ? "Couldn't search" : 'Nothing listed nearby'}
            body={failed ? 'Searching needs an internet connection.' : `OpenStreetMap has no ${kind === 'musollah' ? 'musollah' : 'masjid'} listed within 15 km. Use the Qibla tab to pray where you are.`} />
        )}
        <ul class="space-list">
          {visible.map((sp) => (
            <li>
              <button class="space-row" onClick={() => focus(sp)}>
                {sp.isMusollah ? <House size={20} style={{ color: tint('fajr') }} fill="currentColor" /> : <MoonStar size={20} class="accent" />}
                <span class="space-text">
                  <span class="space-name">{sp.name}</span>
                  {sp.address && <span class="space-addr">{sp.address}</span>}
                </span>
                <span class="space-dist mono">{sp.distanceKm < 1 ? `${Math.round(sp.distanceKm * 1000)} m` : `${sp.distanceKm.toFixed(1)} km`}</span>
              </button>
              <a class="walk" href={directionsURL(sp)} target="_blank" rel="noopener noreferrer" aria-label={`Walking directions to ${sp.name}`}><Footprints size={17} /></a>
            </li>
          ))}
        </ul>
        {spaces.length > 0 && <p class="footnote secondary" style={{ marginTop: '12px' }}>Places from OpenStreetMap contributors. Missing one? Anyone can add it at openstreetmap.org.</p>}
      </div>
    </div>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div class="empty">
      <MoonStar size={40} strokeWidth={1.4} style={{ opacity: 0.6 }} />
      <div class="headline">{title}</div>
      <div class="subhead secondary">{body}</div>
    </div>
  )
}
