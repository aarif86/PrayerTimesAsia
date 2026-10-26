import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '../core/engine'
import { KAABA } from '../core/geo'

/**
 * OpenStreetMap through Leaflet, loaded only when a map is opened. Tiles come
 * from openstreetmap.org itself, which needs no key (it sees the area being
 * looked at, nothing else). In dark mode the same tiles are recoloured night-dark.
 */
export type Leaflet = typeof L

export function createMap(el: HTMLElement, center: Coordinates, dark: boolean, zoom = 14): L.Map {
  const map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: false })
    .setView([center.latitude, center.longitude], zoom)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, className: dark ? 'night-tiles' : '',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  map.attributionControl.setPrefix(false)
  return map
}

export function youMarker(c: Coordinates): L.Marker {
  return L.marker([c.latitude, c.longitude], {
    icon: L.divIcon({ className: 'you-pin', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    keyboard: false, interactive: false,
  })
}

const MASJID_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" fill="currentColor" stroke="none"/></svg>'
const HOUSE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3 2.5 11h2.7v9h5.3v-5.5h3V20h5.3v-9h2.7z"/></svg>'

export function spaceMarker(c: Coordinates, musollah: boolean, title: string): L.Marker {
  return L.marker([c.latitude, c.longitude], {
    title,
    icon: L.divIcon({
      className: `space-pin ${musollah ? 'musollah' : 'masjid'}`,
      html: `<span>${musollah ? HOUSE_SVG : MASJID_SVG}</span>`, iconSize: [30, 30], iconAnchor: [15, 15],
    }),
  })
}

/** The great circle from here to the Ka'bah, as map points. */
export function qiblaPath(from: Coordinates, steps = 96): [number, number][] {
  const rad = Math.PI / 180
  const p1 = from.latitude * rad, l1 = from.longitude * rad
  const p2 = KAABA.latitude * rad, l2 = KAABA.longitude * rad
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2))
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    // Denser near you, where the map is zoomed in.
    const f = (i / steps) ** 2
    const a = Math.sin((1 - f) * d) / Math.sin(d), b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2)
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2)
    const z = a * Math.sin(p1) + b * Math.sin(p2)
    out.push([Math.atan2(z, Math.hypot(x, y)) / rad, Math.atan2(y, x) / rad])
  }
  return out
}

export function addQiblaLine(map: L.Map, from: Coordinates): void {
  L.polyline(qiblaPath(from), { color: '#F2C766', weight: 4, opacity: 0.95 }).addTo(map)
  L.marker([KAABA.latitude, KAABA.longitude], {
    icon: L.divIcon({ className: 'kaaba-pin', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
    interactive: false,
  }).addTo(map)
}

export { L }
