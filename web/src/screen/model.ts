import { computeFor, type PrayerDay } from '../core/engine'
import { defaultAuthority, type CalendarAnnouncement } from '../core/calendarSanad'
import type { HijriDate } from '../core/hijri'
import { addDays, baseHijri, communityHijri, previewShift } from '../core/season'
import { officialSourceFor, sourceLabel, type OfficialSource } from '../core/official'
import type { Place } from '../core/place'
import { PRAYERS, prayerName, type NamingStyle, type Prayer } from '../core/prayer'
import { FALLBACK_PROFILE, profileFor, profileMethod } from '../core/regions'
import { zoned, zonedTime } from '../core/tz'
import { OBLIGATORY_PRAYERS, type Obligatory, type ScreenConfig, type ScreenLanguage, type ScreenPlace } from './config'

/**
 * What the masjid screen shows, worked out without the DOM: the day's times
 * (official table first, as in the app), iqamah, and which state the screen is
 * in - like a departure board: coming up, azan now, iqamah countdown, in prayer.
 */

export type Row = Partial<Record<Prayer, string>> | null
export type RowLookup = (source: OfficialSource, year: number, month: number, day: number) => Row

export interface ScreenDay {
  day: PrayerDay
  iqamah: Partial<Record<Obligatory, number>>
  friday: boolean
  ramadan: boolean
  /** Ramadan: 10 minutes before Subuh, as MUIS, JAKIM and Kemenag publish it. */
  imsak: number | null
  source: string
  /** The Hijri date as the masjid's authority counts it. */
  hijri: HijriDate
  /** Tarawih this evening (Ramadan nights, including the night before the first fast). */
  tarawih: { at: number | null } | null
  /** Qiyamullail tonight, in the last ten nights. */
  qiyam: number | null
  /** Hari Raya prayer, on 1 Syawal. */
  eid: number | null
  raya: boolean
}

/** Ramadan and Eid announcements the screen has downloaded (data/calendar.json). */
let announcements: CalendarAnnouncement[] = []
export function setScreenAnnouncements(list: CalendarAnnouncement[]): void { announcements = list }

/** The masjid's Hijri date for its civil day, with the committee's preview when on. */
let clock = () => Date.now()
/** The screen's clock (fixed in screenshots), which the preview counts from. */
export function setScreenClock(f: () => number): void { clock = f }
const shiftCache = new Map<string, number>()

export function screenHijri(c: ScreenConfig, y: number, m: number, d: number): HijriDate {
  const g = { year: y, month: m, day: d }
  if (c.ramadan.preview !== 'off') {
    const z = zoned(clock(), c.place?.tz ?? 'UTC')
    const key = `${z.year}-${z.month}-${z.day}-${c.ramadan.preview}`
    let shift = shiftCache.get(key)
    if (shift == null) { shift = previewShift({ year: z.year, month: z.month, day: z.day }, c.ramadan.preview); shiftCache.set(key, shift) }
    return baseHijri(addDays(g, shift))
  }
  return communityHijri(g, c.hijriAdj, announcements, defaultAuthority(c.place?.cc ?? '') ?? null)
}

export function asPlace(p: ScreenPlace): Place {
  return {
    id: 'screen', name: p.name, countryCode: p.cc, countryName: profileFor(p.cc)?.name ?? null,
    timeZoneID: p.tz, coordinates: { latitude: p.lat, longitude: p.lng }, district: p.district ?? null,
  }
}

export function officialSourceForScreen(c: ScreenConfig): OfficialSource | null {
  if (!c.place) return null
  const profile = profileFor(c.place.cc) ?? FALLBACK_PROFILE
  return officialSourceFor(asPlace(c.place), profileMethod(profile), c.zone)
}

function nextCivil(y: number, m: number, d: number): [number, number, number] {
  const t = new Date(Date.UTC(y, m - 1, d + 1))
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]
}

const minutesOf = (hhmm: string): [number, number] => hhmm.split(':').map((x) => parseInt(x, 10)) as [number, number]

/** The screen's day containing `ms`, in the masjid's own time zone. */
export function screenDay(ms: number, c: ScreenConfig, lookup: RowLookup): ScreenDay | null {
  const place = c.place
  if (!place) return null
  const profile = profileFor(place.cc) ?? FALLBACK_PROFILE
  const method = profileMethod(profile)
  const coords = { latitude: place.lat, longitude: place.lng }
  const day = computeFor(ms, place.tz, coords, method, profile.asr, c.hijriAdj)
  let source = `Calculated · ${method.shortName}`
  const official = officialSourceFor(asPlace(place), method, c.zone)
  const row = official ? lookup(official, day.year, day.month, day.day) : null
  if (official && row && row.fajr && row.dhuhr && row.asr && row.maghrib && row.isha) {
    for (const p of PRAYERS) {
      const v = row[p]
      if (!v) continue // feeds carry no Syuruk: keep the calculation's
      const [h, m] = minutesOf(v)
      day.times[p] = zonedTime(day.year, day.month, day.day, h, m, 0, place.tz)
    }
    day.officialSource = sourceLabel(official)
    day.grade = 'A'
    source = sourceLabel(official)
  }
  const friday = zoned(day.times.dhuhr, place.tz).weekday === 5
  const iqamah: Partial<Record<Obligatory, number>> = {}
  for (const p of OBLIGATORY_PRAYERS) {
    if (p === 'dhuhr' && friday && c.jumuah) {
      const [h, m] = minutesOf(c.jumuah)
      iqamah.dhuhr = Math.max(day.times.dhuhr, zonedTime(day.year, day.month, day.day, h, m, 0, place.tz))
      continue
    }
    const rule = c.iqamah[p]
    if (!rule) continue
    if (rule.fixed) {
      const [h, m] = minutesOf(rule.fixed)
      const at = zonedTime(day.year, day.month, day.day, h, m, 0, place.tz)
      // A fixed time earlier than the azan would be wrong: fall back to the azan.
      iqamah[p] = Math.max(at, day.times[p])
    } else if (rule.after != null) {
      iqamah[p] = day.times[p] + rule.after * 60_000
    }
  }
  const hijri = screenHijri(c, day.year, day.month, day.day)
  const tomorrow = screenHijri(c, ...nextCivil(day.year, day.month, day.day))
  const ramadan = hijri.month === 9
  const at = (hhmm: string, base = 0) => { const [h, m] = minutesOf(hhmm); return zonedTime(day.year, day.month, day.day, h, m, 0, place.tz) + base }
  // Isyak iqamah later in Ramadan, to give time after berbuka.
  if (ramadan && c.ramadan.ishaExtra > 0 && iqamah.isha != null && c.iqamah.isha?.after != null) iqamah.isha += c.ramadan.ishaExtra * 60_000
  // Tarawih the evenings before each fast: from the night before 1 Ramadan to the night before the last.
  const tarawihNight = tomorrow.month === 9
  const tarawih = tarawihNight && c.ramadan.tarawih ? { at: c.ramadan.tarawihAt ? Math.max(at(c.ramadan.tarawihAt), day.times.isha) : null } : null
  // Qiyam: the last ten nights, the night that begins this evening (a time before noon is after midnight).
  const night = tarawihNight ? (hijri.month === 9 ? hijri.day + 1 : 1) : null
  let qiyam: number | null = null
  if (night && night >= 21 && c.ramadan.qiyamAt) {
    const [h] = minutesOf(c.ramadan.qiyamAt)
    qiyam = at(c.ramadan.qiyamAt, h < 12 ? 86_400_000 : 0)
  }
  const raya = hijri.month === 10 && hijri.day === 1
  const eid = raya && c.ramadan.eidAt ? at(c.ramadan.eidAt) : null
  return { day, iqamah, friday, ramadan, imsak: ramadan ? day.times.fajr - 10 * 60_000 : null, source, hijri, tarawih, qiyam, eid, raya }
}

export type Phase =
  /** Waiting for `next` (Syuruk counts: it ends Subuh). */
  | { kind: 'waiting'; current: Prayer | null; next: Prayer; at: number; day: ScreenDay }
  /** Azan has been called; iqamah at `iqamah` (or just "azan now" without one). */
  | { kind: 'azan'; prayer: Obligatory; azan: number; iqamah: number | null; day: ScreenDay }
  /** Iqamah has started: the screen dims until `until`. */
  | { kind: 'prayer'; prayer: Obligatory; until: number; day: ScreenDay }

/** Without an iqamah time, "Azan now" stays up this long. */
export const AZAN_ONLY_MS = 3 * 60_000

export function phaseAt(now: number, c: ScreenConfig, lookup: RowLookup): Phase | null {
  const today = screenDay(now, c, lookup)
  if (!today) return null
  const yesterday = screenDay(now - 86_400_000, c, lookup)!
  // A prayer whose azan or iqamah is in progress takes over the screen. Isyak can run past midnight.
  for (const d of [today, yesterday]) {
    for (const p of OBLIGATORY_PRAYERS) {
      const azan = d.day.times[p]
      if (now < azan) continue
      const iq = d.iqamah[p] ?? null
      const dim = (p === 'dhuhr' && d.friday && c.jumuah ? c.jumuahDimMinutes : c.dimMinutes) * 60_000
      if (iq != null && now < iq) return { kind: 'azan', prayer: p, azan, iqamah: iq, day: d }
      if (iq != null && dim > 0 && now < iq + dim) return { kind: 'prayer', prayer: p, until: iq + dim, day: d }
      if (iq == null && now < azan + AZAN_ONLY_MS) return { kind: 'azan', prayer: p, azan, iqamah: null, day: d }
    }
  }
  const order = PRAYERS.map((p) => ({ p, t: today.day.times[p] }))
  const upcoming = order.find((x) => x.t > now)
  const passed = order.filter((x) => x.t <= now).pop()
  // Syuruk ends Subuh but starts no prayer: nothing is highlighted until Zohor.
  const current = passed && passed.p !== 'sunrise' ? passed.p : null
  if (upcoming) return { kind: 'waiting', current, next: upcoming.p, at: upcoming.t, day: today }
  const tomorrow = screenDay(now + 86_400_000, c, lookup)!
  // After Isyak the grid shows tomorrow's times, with nothing highlighted.
  return { kind: 'waiting', current: null, next: 'fajr', at: tomorrow.day.times.fajr, day: tomorrow }
}

// MARK: Words

export const ARABIC: Record<Prayer, string> = {
  fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء',
}
export const ARABIC_FRIDAY = 'الجمعة'

export function name(p: Prayer, style: NamingStyle, friday: boolean, arabic: boolean): string {
  if (arabic) return p === 'dhuhr' && friday ? ARABIC_FRIDAY : ARABIC[p]
  return prayerName(p, style, friday)
}

export interface Words {
  next: string; iqamah: string; azan: string; iqamahIn: string; silence: string; inPrayer: string
  khutbah: string; imsak: string; iftar: string; ends: (n: string) => string; fullScreen: string
  edit: string; source: string; getApp: string; noPlace: string
  nowTag: string; inTag: (d: string) => string; scan: string
  tarawih: string; afterIsha: string; qiyam: string; eid: string; ramadanDay: (n: number) => string; raya: string; takbir: string; lastTen: string
}

export const WORDS: Record<ScreenLanguage, Words> = {
  en: {
    next: 'Next', iqamah: 'Iqamah', azan: 'Azan', iqamahIn: 'Iqamah in', silence: 'Please silence your phone',
    inPrayer: 'Prayer in progress', khutbah: 'Khutbah', imsak: 'Imsak', iftar: 'Iftar', ends: (n) => `${n} ends`,
    fullScreen: 'Press OK or click for full screen', edit: 'Edit screen', source: 'Times', getApp: 'Prayer times on your phone',
    noPlace: 'Choose the masjid\'s location to show prayer times.',
    nowTag: 'Now', inTag: (d) => `in ${d}`, scan: 'Scan for iqamah times',
    tarawih: 'Tarawih', afterIsha: 'after Isyak', qiyam: 'Qiyamullail', eid: 'Hari Raya prayer', ramadanDay: (n) => `Ramadan day ${n}`,
    raya: 'Selamat Hari Raya Aidilfitri', takbir: 'Allahu akbar, Allahu akbar, Allahu akbar, la ilaha illallahu wallahu akbar, Allahu akbar wa lillahil hamd', lastTen: 'The last ten nights',
  },
  ms: {
    next: 'Seterusnya', iqamah: 'Iqamah', azan: 'Azan', iqamahIn: 'Iqamah dalam', silence: 'Sila senyapkan telefon bimbit anda',
    inPrayer: 'Solat sedang didirikan', khutbah: 'Khutbah', imsak: 'Imsak', iftar: 'Berbuka', ends: (n) => `Tamat ${n}`,
    fullScreen: 'Tekan OK atau klik untuk skrin penuh', edit: 'Ubah skrin', source: 'Waktu', getApp: 'Waktu solat di telefon anda',
    noPlace: 'Pilih lokasi masjid untuk memaparkan waktu solat.',
    nowTag: 'Sekarang', inTag: (d) => `${d} lagi`, scan: 'Imbas untuk waktu iqamah',
    tarawih: 'Tarawih', afterIsha: 'selepas Isyak', qiyam: 'Qiamullail', eid: 'Solat Sunat Aidilfitri', ramadanDay: (n) => `${n} Ramadan`,
    raya: 'Selamat Hari Raya Aidilfitri', takbir: 'Allahu akbar, Allahu akbar, Allahu akbar, la ilaha illallahu wallahu akbar, Allahu akbar wa lillahil hamd', lastTen: 'Sepuluh malam terakhir',
  },
  id: {
    next: 'Berikutnya', iqamah: 'Iqamah', azan: 'Azan', iqamahIn: 'Iqamah dalam', silence: 'Mohon nonaktifkan nada dering ponsel',
    inPrayer: 'Sholat sedang berlangsung', khutbah: 'Khutbah', imsak: 'Imsak', iftar: 'Berbuka', ends: (n) => `Akhir ${n}`,
    fullScreen: 'Tekan OK atau klik untuk layar penuh', edit: 'Ubah layar', source: 'Jadwal', getApp: 'Jadwal sholat di ponsel Anda',
    noPlace: 'Pilih lokasi masjid untuk menampilkan jadwal sholat.',
    nowTag: 'Sekarang', inTag: (d) => `${d} lagi`, scan: 'Pindai untuk jadwal iqamah',
    tarawih: 'Tarawih', afterIsha: 'setelah Isya', qiyam: 'Qiyamul lail', eid: 'Sholat Idul Fitri', ramadanDay: (n) => `${n} Ramadan`,
    raya: 'Selamat Hari Raya Idul Fitri', takbir: 'Allahu akbar, Allahu akbar, Allahu akbar, la ilaha illallahu wallahu akbar, Allahu akbar wa lillahil hamd', lastTen: 'Sepuluh malam terakhir',
  },
}

const LOCALE: Record<ScreenLanguage, string> = { en: 'en-GB', ms: 'ms-MY', id: 'id-ID' }

export function gregorianDate(ms: number, tz: string, lang: ScreenLanguage): string {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms))
  } catch {
    return new Date(ms).toDateString()
  }
}

/** "5:35" + "am", or "05:35" in 24-hour. */
export function clockParts(ms: number, tz: string, h24: boolean, seconds = false): { time: string; suffix: string | null } {
  const z = zoned(ms, tz)
  const mm = String(z.minute).padStart(2, '0')
  const ss = seconds ? `:${String(z.second).padStart(2, '0')}` : ''
  if (h24) return { time: `${String(z.hour).padStart(2, '0')}:${mm}${ss}`, suffix: null }
  const h = z.hour % 12 === 0 ? 12 : z.hour % 12
  return { time: `${h}:${mm}${ss}`, suffix: z.hour < 12 ? 'AM' : 'PM' }
}

/** "4h 39m" or "40m", as the app writes time left (rounded up to the minute). */
export function shortLeft(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** "1:02:09" or "12:09", rounded up so it reaches 0:00 at the moment itself. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}
