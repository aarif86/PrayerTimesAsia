import { OBLIGATORY } from './prayer'
import type { MosqueProfile } from './sources'

/**
 * "Your masjid": the jamaah (iqamah) rules a masjid screen shares through its
 * QR code. The same query string is read by the web app (in the #hash), the
 * iPhone app and the Android app (prayertimesasia://masjid?...), so keep the
 * format short (a smaller QR scans from further away) and plain:
 *
 *   masjid?n=Masjid%20Al-Firdaus&ll=1.3721,103.9474&tz=Asia/Singapore&cc=SG&i=10,10,10,5,10&j=13:00
 *
 * n  name (up to 80 characters)
 * ll latitude,longitude, 4 decimals (about 10 m)
 * tz IANA time zone
 * cc country code (optional)
 * i  Subuh, Zohor, Asar, Maghrib, Isyak: minutes after the azan ("10"),
 *    a fixed time ("13:15"), or empty when the masjid didn't set one
 * j  Jumu'ah (khutbah) time, optional
 */
export interface MasjidLink {
  name: string
  lat: number
  lng: number
  tz: string
  cc: string | null
  jamaah: Partial<Record<(typeof OBLIGATORY)[number], { after?: number; fixed?: string }>>
  jumuah: string | null
}

/** A masjid that's yours covers your home area, a little wider than the 3 km of a published profile. */
export const MY_MASJID_RADIUS_KM = 10

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/
const pad = (t: string) => { const [h, m] = t.split(':'); return `${h.padStart(2, '0')}:${m}` }

/** Like URLSearchParams, but leaves , / : readable so the QR code stays small. */
const enc = (v: string) => encodeURIComponent(v).replace(/%2C/g, ',').replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%20/g, '+')

export function masjidQuery(m: MasjidLink): string {
  const q: [string, string][] = [
    ['n', m.name.slice(0, 80)],
    ['ll', `${+m.lat.toFixed(4)},${+m.lng.toFixed(4)}`],
    ['tz', m.tz],
  ]
  if (m.cc) q.push(['cc', m.cc])
  q.push(['i', OBLIGATORY.map((p) => {
    const r = m.jamaah[p]
    return r?.fixed ?? (r?.after != null ? String(r.after) : '')
  }).join(',')])
  if (m.jumuah) q.push(['j', m.jumuah])
  return `masjid?${q.map(([k, v]) => `${k}=${enc(v)}`).join('&')}`
}

/** Reads "masjid?..." (or a whole URL or #hash containing it). Anything odd gives null. */
export function parseMasjidLink(text: string): MasjidLink | null {
  const at = text.indexOf('masjid?')
  if (at < 0) return null
  const q = new URLSearchParams(text.slice(at + 'masjid?'.length))
  const name = (q.get('n') ?? '').trim().slice(0, 80)
  const ll = (q.get('ll') ?? '').split(',').map(Number)
  const tz = q.get('tz') ?? ''
  if (!name || ll.length !== 2 || ll.some((x) => !Number.isFinite(x)) || Math.abs(ll[0]) > 90 || Math.abs(ll[1]) > 180) return null
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz)) return null
  const cc = q.get('cc')
  const jamaah: MasjidLink['jamaah'] = {}
  const parts = (q.get('i') ?? '').split(',')
  OBLIGATORY.forEach((p, k) => {
    const v = (parts[k] ?? '').trim()
    if (/^\d{1,2}$/.test(v) && Number(v) <= 60) jamaah[p] = { after: Number(v) }
    else if (HHMM.test(v)) jamaah[p] = { fixed: pad(v) }
  })
  const j = q.get('j') ?? ''
  return {
    name, lat: ll[0], lng: ll[1], tz,
    cc: cc && /^[A-Za-z]{2}$/.test(cc) ? cc.toUpperCase() : null,
    jamaah,
    jumuah: HHMM.test(j) ? pad(j) : null,
  }
}

/** As a mosque profile, so the apps' existing jamaah code shows its times. */
export function masjidProfile(m: MasjidLink): MosqueProfile {
  const jamaah: NonNullable<MosqueProfile['jamaah']> = {}
  for (const [p, r] of Object.entries(m.jamaah)) jamaah[p] = { fixed: r.fixed ?? null, afterMinutes: r.after ?? null }
  return {
    id: 'my-masjid', name: m.name, lat: m.lat, lng: m.lng, country: m.cc ?? '',
    radiusKm: MY_MASJID_RADIUS_KM, fingerprint: null, jamaah, jumuah: m.jumuah,
    source: 'Shared by the masjid screen', verifiedAt: '', grade: 'B',
  }
}
