import { masjidQuery } from '../core/masjidLink'
import { SEASON_PREVIEWS, type SeasonPreview } from '../core/season'
import { NAMING_STYLES, type NamingStyle, type Prayer } from '../core/prayer'

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
 * Six designs, each in Light or Dark (`mode`): Sky (the app's Living Sky, id 'night'), Board (a departure-board list),
 * Bands (coloured bands), Day Dial, Sun Path, and Simple (plain and calm).
 * Old links that say 'day' still work: they open as Sky in Light.
 */
export type ScreenLook = 'night' | 'board' | 'bands' | 'dial' | 'sunpath' | 'simple' | 'surau'
export const LOOKS: readonly ScreenLook[] = ['night', 'board', 'bands', 'dial', 'sunpath', 'simple', 'surau']

/**
 * How the screen is arranged. `full` is the clock and the times across the whole screen (the original designs).
 * The others share the screen between the times and a place for the masjid's slides and notices.
 * Two are for a TV turned on its side (portrait).
 */
export type ScreenLayout = 'full' | 'splitN' | 'split' | 'mirror' | 'strip' | 'big' | 'port' | 'portT'
export const LAYOUTS: readonly ScreenLayout[] = ['full', 'splitN', 'split', 'mirror', 'strip', 'big', 'port', 'portT']
export const PORTRAIT_LAYOUTS: readonly ScreenLayout[] = ['port', 'portT']
/** Layouts with a slim notice bar. Where there is none, the notices take turns with the slides instead. */
export const LAYOUTS_WITH_NOTICE_BAR: readonly ScreenLayout[] = ['full', 'splitN', 'mirror', 'strip', 'port', 'portT']
/** Layouts with a place for slides. */
export const LAYOUTS_WITH_SLIDES: readonly ScreenLayout[] = ['splitN', 'split', 'mirror', 'strip', 'port']

/** One slide: a picture (from a web address) or a few words on a coloured card. Up to MAX_SLIDES take turns. */
export interface ScreenSlide {
  title: string
  text: string
  /** A picture's web address (https). With a picture, the title and text are an optional caption. */
  img: string
  tone: SlideTone
}
export type SlideTone = 'navy' | 'gold' | 'green' | 'light'
export const SLIDE_TONES: readonly SlideTone[] = ['navy', 'gold', 'green', 'light']
export const MAX_SLIDES = 8
export const MAX_SLIDE_TITLE = 50
export const MAX_SLIDE_TEXT = 140
export const MAX_SLIDE_IMG = 300
/** How long each slide stays up. */
export const SLIDE_SECONDS = 12

/** A picture address we will show: https only. Anything else (javascript:, data:, http:) is dropped. */
export function safeImageUrl(v: unknown): string {
  if (typeof v !== 'string') return ''
  const t = v.trim()
  if (t.length > MAX_SLIDE_IMG) return ''
  try {
    const u = new URL(t)
    return u.protocol === 'https:' && !u.username && !u.password ? u.href.length <= MAX_SLIDE_IMG ? u.href : '' : ''
  } catch { return '' }
}
export type ScreenMode = 'dark' | 'light'

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
  /** How the screen is shared between the times and the slides and notices. */
  layout: ScreenLayout
  /** Light or Dark, for any design. */
  mode: ScreenMode
  iqamah: Partial<Record<Obligatory, IqamahRule>>
  /** Print iqamah times beside the azan times (off: the countdown after the azan still runs). */
  showIqamah: boolean
  /** A QR code worshippers scan to see this masjid's iqamah times in the app. */
  showQr: boolean
  /** Khutbah starts, "HH:mm"; Friday's Zohor becomes Jumu'ah. */
  jumuah: string | null
  /** A line for Friday, like the khatib's name and the khutbah language. Shown from Thursday Maghrib to Friday Zohor. */
  fridayNote: string
  notices: string[]
  /** Pictures and cards that take turns beside the times (layouts with a place for slides). */
  slides: ScreenSlide[]
  h24: boolean
  hijriAdj: number
  /** Minutes the screen stays dim after iqamah (prayer in progress). */
  dimMinutes: number
  jumuahDimMinutes: number
  /** Let Prayer Times Asia count this screen (masjid name, city, look; see services/usage.ts). */
  report: boolean
  /** Ramadan and Raya at this masjid. */
  ramadan: RamadanSettings
  /** Parts of the screen the committee turned off. The prayertimes.asia line always stays. */
  hide: ScreenHide
}

export interface ScreenHide {
  /** Today's date (Gregorian). */
  date: boolean
  /** The Islamic (Hijri) date and month. */
  hijri: boolean
  /** The big clock. */
  clock: boolean
  /** The row of prayer times (the waktu). */
  times: boolean
  /** "in 6h 59m" before the next prayer. The iqamah countdown after the azan is set in the iqamah boxes. */
  countdown: boolean
  /** The "Official · MUIS" label in the footer. */
  source: boolean
  /** The line counting down to the next big date (1 Ramadan, both Eids, the Islamic New Year, Mawlid). */
  occasion: boolean
  /** On the two days a year the sun passes over the Kaaba, the moment it does, for checking the qibla by the sun. */
  kaaba: boolean
}

export const HIDE_KEYS: readonly (keyof ScreenHide)[] = ['date', 'hijri', 'clock', 'times', 'countdown', 'source', 'occasion', 'kaaba']
export const NO_HIDE: ScreenHide = { date: false, hijri: false, clock: false, times: false, countdown: false, source: false, occasion: false, kaaba: false }

export interface RamadanSettings {
  /** Extra minutes before Isyak iqamah in Ramadan (when the iqamah is "minutes after azan"). */
  ishaExtra: number
  /** Show "Tarawih after Isyak" (or at a time) in Ramadan. */
  tarawih: boolean
  /** Tarawih starts at, "HH:mm"; empty means straight after Isyak. */
  tarawihAt: string | null
  /** Qiyamullail in the last ten nights, "HH:mm" (after midnight is the same night). */
  qiyamAt: string | null
  /** Hari Raya Aidilfitri prayer, "HH:mm". */
  eidAt: string | null
  /** For trying the screen before Ramadan: pretend today is a Ramadan or Raya day. */
  preview: SeasonPreview
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
  layout: 'full',
  mode: 'dark',
  iqamah: { fajr: { after: 10 }, dhuhr: { after: 10 }, asr: { after: 10 }, maghrib: { after: 5 }, isha: { after: 10 } },
  showIqamah: false,
  showQr: true,
  jumuah: null,
  fridayNote: '',
  notices: [],
  slides: [],
  h24: false,
  hijriAdj: 0,
  dimMinutes: 10,
  jumuahDimMinutes: 40,
  report: true,
  ramadan: { ishaExtra: 0, tarawih: true, tarawihAt: null, qiyamAt: null, eidAt: null, preview: 'off' },
  hide: { ...NO_HIDE },
}

/** Shown in the setup preview until the committee chooses the masjid's location. */
export const EXAMPLE_PLACE: ScreenPlace = { name: 'Pasir Ris', lat: 1.3721, lng: 103.9474, tz: 'Asia/Singapore', cc: 'SG', district: null }

export const MAX_NOTICES = 8
export const MAX_NOTICE_LENGTH = 160
export const MAX_FRIDAY_NOTE = 100

/** Notices a committee often needs, one tap each in the setup page. */
export const READY_NOTICES: readonly string[] = [
  'Solat jenazah after Zohor today',
  'Solat jenazah after Asar today',
  'Kuliah after Maghrib tonight',
  'Please keep the corridors clear',
  'Please park only in the marked lots',
  'Lost and found at the masjid office',
]

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function isHHMM(s: unknown): s is string {
  return typeof s === 'string' && HHMM.test(s)
}

/** "10" → 10 minutes after azan; "13:15" → fixed; anything else → none. */
export function parseIqamah(text: string): IqamahRule | null {
  const t = text.trim().replace(/[.,]/, ':')
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

const NAMING: readonly NamingStyle[] = NAMING_STYLES

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
  else if (r.look === 'day') { out.look = 'night'; out.mode = 'light' }
  if (r.mode === 'dark' || r.mode === 'light') out.mode = r.mode
  if (LAYOUTS.includes(r.layout as ScreenLayout)) out.layout = r.layout as ScreenLayout
  if (r.iqamah && typeof r.iqamah === 'object') {
    out.iqamah = {}
    for (const prayer of OBLIGATORY_PRAYERS) {
      const rule = (r.iqamah as Record<string, IqamahRule | undefined>)[prayer]
      if (rule && isHHMM(rule.fixed)) out.iqamah[prayer] = { fixed: rule.fixed }
      else if (rule && typeof rule.after === 'number' && rule.after >= 0 && rule.after <= 60) out.iqamah[prayer] = { after: Math.round(rule.after) }
    }
  }
  out.showIqamah = r.showIqamah === true
  out.showQr = r.showQr !== false
  out.jumuah = isHHMM(r.jumuah) ? r.jumuah : null
  if (typeof r.fridayNote === 'string') out.fridayNote = r.fridayNote.trim().slice(0, MAX_FRIDAY_NOTE)
  if (Array.isArray(r.notices)) {
    out.notices = r.notices.filter((n): n is string => typeof n === 'string')
      .map((n) => n.trim().slice(0, MAX_NOTICE_LENGTH)).filter(Boolean).slice(0, MAX_NOTICES)
  }
  if (Array.isArray(r.slides)) {
    out.slides = r.slides.flatMap((raw): ScreenSlide[] => {
      if (!raw || typeof raw !== 'object') return []
      const x = raw as Record<string, unknown>
      const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
      const slide: ScreenSlide = {
        title: str(x.title, MAX_SLIDE_TITLE), text: str(x.text, MAX_SLIDE_TEXT), img: safeImageUrl(x.img),
        tone: SLIDE_TONES.includes(x.tone as SlideTone) ? x.tone as SlideTone : 'navy',
      }
      return slide.title || slide.text || slide.img ? [slide] : []
    }).slice(0, MAX_SLIDES)
  }
  out.h24 = r.h24 === true
  out.hijriAdj = clamp(r.hijriAdj, -2, 2, 0)
  out.dimMinutes = clamp(r.dimMinutes, 0, 30, DEFAULT_CONFIG.dimMinutes)
  out.jumuahDimMinutes = clamp(r.jumuahDimMinutes, 0, 90, DEFAULT_CONFIG.jumuahDimMinutes)
  // Links made before this setting existed count, like new ones.
  out.report = r.report !== false
  const rm = (r.ramadan && typeof r.ramadan === 'object' ? r.ramadan : {}) as Record<string, unknown>
  out.ramadan = {
    ishaExtra: clamp(rm.ishaExtra, 0, 60, 0),
    tarawih: rm.tarawih !== false,
    tarawihAt: isHHMM(rm.tarawihAt) ? rm.tarawihAt : null,
    qiyamAt: isHHMM(rm.qiyamAt) ? rm.qiyamAt : null,
    eidAt: isHHMM(rm.eidAt) ? rm.eidAt : null,
    preview: SEASON_PREVIEWS.includes(rm.preview as SeasonPreview) ? rm.preview as SeasonPreview : 'off',
  }
  const hd = (r.hide && typeof r.hide === 'object' ? r.hide : {}) as Record<string, unknown>
  for (const k of HIDE_KEYS) out.hide[k] = hd[k] === true
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

/** The short code from a hash like "#k=k3x9Qm2aB" (9 letters and numbers), or null. */
export function shortCodeFromHash(hash: string): string | null {
  const m = /(?:^#|&)k=([A-Za-z0-9]{9})(?:&|$)/.exec(hash)
  return m ? m[1] : null
}

/** The pairing code from a hash like "#pair=K7M3QX" (the QR code on the TV), or null. */
export function pairCodeFromHash(hash: string): string | null {
  const m = /(?:^#|&)pair=([A-Za-z2-9]{6})(?:&|$)/.exec(hash)
  return m ? m[1].toUpperCase() : null
}

/** "#tv": show the pairing code, whatever the device. (The shared address prayertimes.asia/tv picks by device; /masjid and /app/screen/ still work.) */
export const isTvHash = (hash: string): boolean => /(?:^#|&)tv(?:&|$)/.test(hash)

/** Smart TVs, TV sticks and boxes say so in their browser name. A TV that does not is one tap away from the pairing code. */
export const looksLikeTv = (ua: string): boolean =>
  /smart-?tv|hbbtv|tizen|web0s|webos|netcast|bravia|crkey|googletv|android tv|appletv|roku|viera|vidaa|philipstv|opera tv|playstation|xbox/i.test(ua) || /\bAFT[A-Z0-9]+\b/.test(ua)

/** The `c=` value from a location hash like "#c=eyJ2Ijox...". */
export function configFromHash(hash: string): ScreenConfig | null {
  const m = /(?:^#|&)c=([A-Za-z0-9_-]+)/.exec(hash)
  return m ? decodeConfig(m[1]) : null
}

/** The web app with this masjid's iqamah rules, for worshippers to scan (core/masjidLink.ts). */
export function masjidAppLink(c: ScreenConfig, at: string = location.href): string | null {
  if (!c.place) return null
  // From /app/screen/ the app is one folder up. prayertimes.asia/tv serves the same page, where the app is at ../app/.
  const page = at.split('#')[0].split('?')[0]
  const app = /\/tv\/?$/.test(page) ? new URL('../app/', page.endsWith('/') ? page : `${page}/`) : new URL('../', page)
  return `${app.origin}${app.pathname}#${masjidQuery({
    name: c.name || c.place.name, lat: c.place.lat, lng: c.place.lng, tz: c.place.tz, cc: c.place.cc,
    jamaah: c.iqamah, jumuah: c.jumuah, eid: c.ramadan.eidAt,
  })}`
}
