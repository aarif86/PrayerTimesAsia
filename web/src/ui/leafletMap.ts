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

export function youMarker(c: Coordinates, beam = false): L.Marker {
  const html = beam ? '<i class="you-glow"></i><i class="you-beam"></i><i class="you-still"></i><span></span>' : '<span></span>'
  return L.marker([c.latitude, c.longitude], {
    icon: L.divIcon({ className: `you-pin${beam ? ' beaming' : ''}`, html, iconSize: [18, 18], iconAnchor: [9, 9] }),
    keyboard: false, interactive: false, zIndexOffset: 1000,
  })
}

/**
 * Rings around you at these distances, each labelled on the ring below its right
 * hand side (lined up like a ruler) and drawn over the pins, so a pin inside the
 * first ring reads as near and one past the last as far.
 */
export function distanceRings(c: Coordinates, rings: { km: number; label: string }[], labelAngle = 35): L.LayerGroup {
  const group = L.layerGroup()
  const a = labelAngle * Math.PI / 180
  rings.forEach(({ km, label }, i) => {
    L.circle([c.latitude, c.longitude], {
      radius: km * 1000, interactive: false, className: `dist-ring${i === 0 ? ' first' : ''}`,
      weight: 1.5, dashArray: '5 7', fill: i === 0,
    }).addTo(group)
    const lat = c.latitude - km * Math.sin(a) / 111.2
    const lng = c.longitude + km * Math.cos(a) / (111.2 * Math.max(0.2, Math.cos(c.latitude * Math.PI / 180)))
    L.marker([lat, lng], {
      icon: L.divIcon({ className: 'ring-label', html: `<span>${label}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
      interactive: false, keyboard: false, zIndexOffset: 900,
    }).addTo(group)
  })
  return group
}

const MASJID_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 13.2C6.2 9.6 9 7.8 12 5.8c3 2 5.8 3.8 5.8 7.4"/><path d="M12 5.8V3.4"/><path d="M4.8 13.2h14.4v7.3H4.8z"/><path d="M10.4 20.5v-2.9a1.6 1.6 0 0 1 3.2 0v2.9"/><path d="M2.8 20.5h18.4"/></svg>'
const HOUSE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3 2.5 11h2.7v9h5.3v-5.5h3V20h5.3v-9h2.7z"/></svg>'

export function spaceMarker(c: Coordinates, musollah: boolean, title: string, k = 0): L.Marker {
  return L.marker([c.latitude, c.longitude], {
    title,
    icon: L.divIcon({
      className: `space-pin ${musollah ? 'musollah' : 'masjid'} pk${k % 6}`,
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
