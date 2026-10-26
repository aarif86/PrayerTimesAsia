import { useEffect, useRef, useState } from 'preact/hooks'
import { Map as MapIcon } from 'lucide-preact'
import { compassPoint, qiblaBearing } from '../core/geo'
import { store } from '../services/store'
import { Sheet } from './common'

/** "Qibla on the map": the line to the Ka'bah over the streets around you - works with no compass at all. */
export function QiblaMapButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button class="plain-btn" onClick={() => setOpen(true)}><MapIcon size={16} />Show the qibla on a map</button>
      {open && <Sheet title="Qibla on the map" full onDone={() => setOpen(false)}><QiblaMapView /></Sheet>}
    </>
  )
}

function QiblaMapView() {
  const el = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const place = store.activePlace
  useEffect(() => {
    if (!place || !el.current) return
    let map: { remove: () => void } | null = null
    let cancelled = false
    import('./leafletMap').then((m) => {
      if (cancelled || !el.current) return
      const lmap = m.createMap(el.current, place.coordinates, document.documentElement.dataset.theme !== 'light', 17)
      m.youMarker(place.coordinates).addTo(lmap)
      m.addQiblaLine(lmap, place.coordinates)
      map = lmap
    }).catch(() => setFailed(true))
    return () => { cancelled = true; map?.remove() }
  }, [])
  if (!place) return null
  const bearing = qiblaBearing(place.coordinates)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: 'calc(100% - 60px)' }}>
      <p class="subhead" style={{ margin: 0 }}>
        The gold line runs from {place.name} to the Ka'bah: {Math.round(bearing)}° {compassPoint(bearing)} from true north. Line yourself up with a street or
        building edge that runs the same way.
      </p>
      <div ref={el} class="map-box" style={{ flex: 1, minHeight: '320px' }} />
      {failed && <p class="footnote secondary">The map needs an internet connection.</p>}
    </div>
  )
}
