import type { NamingStyle, Prayer } from '../core/prayer'

/**
 * A masjid screen's settings. They travel in the link's #hash (never sent to a
 * server) and are kept in the TV's browser, so the screen comes back by itself
 * after a power cut.
 */
export type Obligatory = Exclude<Prayer, 'sunrise'>
export const OBLIGATORY_PRAYERS: readonly Obligatory[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

/** Iqamah: minutes after the azan, or a fixed "HH:mm". */
export interface IqamahRule { after?: number; fixed?: string }

export type ScreenLanguage = 'en' | 'ms' | 'id'

/**
 * Night (dark, the default), Day (light, for bright halls), Board (a departure-board list),
 * and three from the app's Prayer screen styles: Bands (coloured bands), Dial (the Day Dial)
 * and Sun Path (the sun's arc over the day).
 */
export type ScreenLook = 'night' | 'day' | 'board' | 'bands' | 'dial' | 'sunpath'
export const LOOKS: readonly ScreenLook[] = ['night', 'day', 'board', 'bands', 'dial', 'sunpath']

export interface ScreenPlace {
  name: string
  lat: number
  lng: number
  tz: string
  cc: string | null
  /** Regency / city, for the Kemenag timetable in Indonesia. */
  district?: string | null
}

export interface ScreenConfig {
  v: 1
  name: string
  place: ScreenPlace | null
  /** JAKIM zone, when the nearest one isn't the masjid's. */
  zone?: string | null
  names: NamingStyle
  /** Switch prayer names with Arabic every few seconds. */
  arabic: boolean
  lang: ScreenLanguage
  look: ScreenLook
  iqamah: Partial<Record<Obligatory, IqamahRule>>
  /** Khutbah starts, "HH:mm"; Friday's Zohor becomes Jumu'ah. */
  jumuah: string | null
  notices: string[]
  h24: boolean
  hijriAdj: number
  /** Minutes the screen stays dim after iqamah (prayer in progress). */
  dimMinutes: number
  jumuahDimMinutes: number
}

export const DEFAULT_CONFIG: ScreenConfig = {
  v: 1,
  name: '',
  place: null,
  zone: null,
  names: 'arabic',
  arabic: false,
  lang: 'en',
  look: 'night',
  iqamah: { fajr: { after: 10 }, dhuhr: { after: 10 }, asr: { after: 10 }, maghrib: { after: 5 }, isha: { after: 10 } },
  jumuah: null,
  notices: [],
  h24: false,
  hijriAdj: 0,
  dimMinutes: 10,
  jumuahDimMinutes: 40,
}

/** Shown in the setup preview until the committee chooses the masjid's location. */
export const EXAMPLE_PLACE: ScreenPlace = { name: 'Pasir Ris', lat: 1.3721, lng: 103.9474, tz: 'Asia/Singapore', cc: 'SG', district: null }

export const MAX_NOTICES = 8
export const MAX_NOTICE_LENGTH = 160

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function isHHMM(s: unknown): s is string {
  return typeof s === 'string' && HHMM.test(s)
}

/** "10" → 10 minutes after azan; "13:15" → fixed; anything else → none. */
export function parseIqamah(text: string): IqamahRule | null {
  const t = text.trim().replace('.', ':')
  if (/^\d{1,2}$/.test(t)) {
    const n = parseInt(t, 10)
    return n >= 0 && n <= 60 ? { after: n } : null
  }
  if (isHHMM(t)) {
    const [h, m] = t.split(':')
    return { fixed: `${h.padStart(2, '0')}:${m}` }
  }
  return null
}

export function iqamahText(rule: IqamahRule | undefined): string {
  if (!rule) return ''
  if (rule.fixed) return rule.fixed
  return rule.after != null ? String(rule.after) : ''
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback

const NAMING: readonly NamingStyle[] = ['arabic', 'malay', 'indonesian', 'southAsian', 'turkish']

/** Accepts anything (an old or hand-edited link) and returns a safe config. */
export function sanitize(raw: unknown): ScreenConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: ScreenConfig = structuredClone(DEFAULT_CONFIG)
  if (typeof r.name === 'string') out.name = r.name.slice(0, 80)
  const p = r.place as Record<string, unknown> | null | undefined
  if (p && typeof p.lat === 'number' && typeof p.lng === 'number' && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && typeof p.tz === 'string') {
    out.place = {
      name: typeof p.name === 'string' ? p.name.slice(0, 80) : '',
      lat: p.lat, lng: p.lng, tz: p.tz,
      cc: typeof p.cc === 'string' ? p.cc.toUpperCase().slice(0, 2) : null,
      district: typeof p.district === 'string' ? p.district.slice(0, 80) : null,
    }
  }
  if (typeof r.zone === 'string' && /^[A-Z]{3}\d{2}$/.test(r.zone)) out.zone = r.zone
  if (NAMING.includes(r.names as NamingStyle)) out.names = r.names as NamingStyle
  out.arabic = r.arabic === true
  if (r.lang === 'en' || r.lang === 'ms' || r.lang === 'id') out.lang = r.lang
  if (LOOKS.includes(r.look as ScreenLook)) out.look = r.look as ScreenLook
  if (r.iqamah && typeof r.iqamah === 'object') {
    out.iqamah = {}
    for (const prayer of OBLIGATORY_PRAYERS) {
      const rule = (r.iqamah as Record<string, IqamahRule | undefined>)[prayer]
      if (rule && isHHMM(rule.fixed)) out.iqamah[prayer] = { fixed: rule.fixed }
      else if (rule && typeof rule.after === 'number' && rule.after >= 0 && rule.after <= 60) out.iqamah[prayer] = { after: Math.round(rule.after) }
    }
  }
  out.jumuah = isHHMM(r.jumuah) ? r.jumuah : null
  if (Array.isArray(r.notices)) {
    out.notices = r.notices.filter((n): n is string => typeof n === 'string')
      .map((n) => n.trim().slice(0, MAX_NOTICE_LENGTH)).filter(Boolean).slice(0, MAX_NOTICES)
  }
  out.h24 = r.h24 === true
  out.hijriAdj = clamp(r.hijriAdj, -2, 2, 0)
  out.dimMinutes = clamp(r.dimMinutes, 0, 30, DEFAULT_CONFIG.dimMinutes)
  out.jumuahDimMinutes = clamp(r.jumuahDimMinutes, 0, 90, DEFAULT_CONFIG.jumuahDimMinutes)
  return out
}

/** Config → URL-safe text for the link's #hash (UTF-8, base64url). */
export function encodeConfig(c: ScreenConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeConfig(text: string): ScreenConfig | null {
  try {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    return sanitize(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}

/** The `c=` value from a location hash like "#c=eyJ2Ijox...". */
export function configFromHash(hash: string): ScreenConfig | null {
  const m = /(?:^#|&)c=([A-Za-z0-9_-]+)/.exec(hash)
  return m ? decodeConfig(m[1]) : null
}
