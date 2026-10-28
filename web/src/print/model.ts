import { hijriDate, type HijriDate } from '../core/hijri'
import { hijriMonths, type NamingStyle } from '../core/prayer'
import { zoned, zonedTime } from '../core/tz'
import { sanitize, type ScreenConfig, type ScreenLanguage } from '../screen/config'
import { screenDay, type RowLookup, type ScreenDay } from '../screen/model'

/**
 * Printable sheets, worked out without the DOM. They reuse the masjid screen's
 * settings (place, names, iqamah, Jumu'ah), so a committee that set up the TV
 * can print the same times for the notice board, and anyone else just picks a
 * place. Official table first, as everywhere in the app.
 */

export type SheetKind = 'month' | 'ramadan' | 'stickers' | 'tracker'
export const SHEETS: readonly SheetKind[] = ['month', 'ramadan', 'stickers', 'tracker']

export interface PrintOptions {
  sheet: SheetKind
  /** The month shown by month, stickers and tracker. */
  year: number
  month: number
}

export interface SheetDay {
  /** Noon on the day, in the place's zone. */
  ms: number
  year: number
  month: number
  day: number
  /** 0 Sunday … 6 Saturday. */
  weekday: number
  hijri: HijriDate
  times: ScreenDay
}

const noon = (y: number, m: number, d: number, tz: string) => zonedTime(y, m, d, 12, 0, 0, tz)

function sheetDay(ms: number, c: ScreenConfig, lookup: RowLookup): SheetDay {
  const tz = c.place!.tz
  const z = zoned(ms, tz)
  return { ms, year: z.year, month: z.month, day: z.day, weekday: z.weekday, hijri: hijriDate(ms, tz, c.hijriAdj), times: screenDay(ms, c, lookup)! }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Every day of a Gregorian month at the configured place. */
export function monthDays(c: ScreenConfig, year: number, month: number, lookup: RowLookup): SheetDay[] {
  if (!c.place) return []
  const out: SheetDay[] = []
  for (let d = 1; d <= daysInMonth(year, month); d++) out.push(sheetDay(noon(year, month, d, c.place.tz), c, lookup))
  return out
}

/**
 * The next Ramadan (or the current one) from `from`, as expected by the Umm
 * al-Qura calendar with the masjid's ±day adjustment. Local announcements decide.
 */
export function ramadanDays(c: ScreenConfig, from: number, lookup: RowLookup): SheetDay[] {
  if (!c.place) return []
  const tz = c.place.tz
  const z = zoned(from, tz)
  let ms = noon(z.year, z.month, z.day, tz)
  // Back up to the first day if Ramadan has already begun.
  while (hijriDate(ms, tz, c.hijriAdj).month === 9) ms -= 86_400_000
  for (let i = 0; i < 400 && hijriDate(ms, tz, c.hijriAdj).month !== 9; i++) ms += 86_400_000
  const out: SheetDay[] = []
  while (hijriDate(ms, tz, c.hijriAdj).month === 9 && out.length < 30) {
    const zz = zoned(ms, tz)
    out.push(sheetDay(noon(zz.year, zz.month, zz.day, tz), c, lookup))
    ms += 86_400_000
  }
  return out
}

/** "Jamadilawal – Jamadilakhir 1448" for the Hijri months a sheet covers. */
export function hijriSpan(days: SheetDay[], style: NamingStyle): string {
  if (!days.length) return ''
  const names = hijriMonths(style)
  const a = days[0].hijri, b = days[days.length - 1].hijri
  const n = (h: HijriDate) => names[h.month - 1]
  if (a.month === b.month) return `${n(a)} ${a.year}`
  return a.year === b.year ? `${n(a)} – ${n(b)} ${b.year}` : `${n(a)} ${a.year} – ${n(b)} ${b.year}`
}

/** "5:41" (the column says which half of the day) or "05:41". */
export function clock(ms: number, tz: string, h24: boolean): string {
  const z = zoned(ms, tz)
  const mm = String(z.minute).padStart(2, '0')
  if (h24) return `${String(z.hour).padStart(2, '0')}:${mm}`
  return `${z.hour % 12 === 0 ? 12 : z.hour % 12}:${mm}`
}

// MARK: Words

export interface PrintWords {
  sheetName: Record<SheetKind, string>
  sheetHint: Record<SheetKind, string>
  date: string; day: string; hijri: string; fast: string; imsak: string; iftar: string
  weekdays: string[]; weekdaysShort: string[]; months: string[]
  official: (source: string) => string
  calculated: (method: string) => string
  ramadanNote: string
  lastTen: string
  iqamah: string; after: (n: number) => string
  scan: string; myMonth: string; colourIn: string; reward: string; stars: string; name: string
  cut: string
}

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MS_MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']
const ID_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export const PRINT_WORDS: Record<ScreenLanguage, PrintWords> = {
  en: {
    sheetName: { month: 'Monthly timetable', ramadan: 'Ramadan timetable', stickers: 'Sticker calendar', tracker: 'Kids\' prayer tracker' },
    sheetHint: {
      month: 'One A4 page for the fridge, the office or the masjid notice board.',
      ramadan: 'Imsak and iftar for every day of Ramadan, with a box to tick each fast.',
      stickers: 'A tile for every day. Print on A4 sticker paper (or plain paper and glue), cut along the dashed lines, and stick today\'s times on the fridge, a planner or a desk.',
      tracker: 'Children colour in a circle after each prayer. Stick it on the wall and count the stars at the end of the month.',
    },
    date: 'Date', day: 'Day', hijri: 'Hijri', fast: 'Fast', imsak: 'Imsak', iftar: 'Iftar',
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: EN_MONTHS,
    official: (s) => `Times: ${s}.`,
    calculated: (m) => `Times calculated with the ${m} method. The official timetable for these dates isn't out yet, so check with your masjid.`,
    ramadanNote: 'The first and last day of Ramadan follow the official announcement; these dates are expected.',
    lastTen: 'Last ten nights',
    iqamah: 'Iqamah', after: (n) => `${n} min after azan`,
    scan: 'Scan for any month\'s sheet', myMonth: 'My prayers in', colourIn: 'Colour in a circle after each prayer', reward: 'My reward', stars: 'Circles coloured', name: 'Name',
    cut: 'Cut along the dashed lines',
  },
  ms: {
    sheetName: { month: 'Jadual bulanan', ramadan: 'Jadual Ramadan', stickers: 'Kalendar pelekat', tracker: 'Carta solat kanak-kanak' },
    sheetHint: {
      month: 'Satu muka surat A4 untuk peti sejuk, pejabat atau papan notis masjid.',
      ramadan: 'Imsak dan berbuka untuk setiap hari Ramadan, dengan kotak untuk menanda setiap puasa.',
      stickers: 'Satu petak untuk setiap hari. Cetak pada kertas pelekat A4 (atau kertas biasa dan gam), gunting di garisan putus-putus, dan lekatkan waktu hari ini di peti sejuk, diari atau meja.',
      tracker: 'Kanak-kanak mewarna satu bulatan selepas setiap solat. Lekatkan di dinding dan kira bintang di hujung bulan.',
    },
    date: 'Tarikh', day: 'Hari', hijri: 'Hijrah', fast: 'Puasa', imsak: 'Imsak', iftar: 'Berbuka',
    weekdays: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],
    weekdaysShort: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'],
    months: MS_MONTHS,
    official: (s) => `Waktu: ${s}.`,
    calculated: (m) => `Waktu dikira dengan kaedah ${m}. Jadual rasmi untuk tarikh ini belum keluar, sila semak dengan masjid anda.`,
    ramadanNote: 'Awal dan akhir Ramadan mengikut pengumuman rasmi; tarikh ini adalah jangkaan.',
    lastTen: 'Sepuluh malam terakhir',
    iqamah: 'Iqamah', after: (n) => `${n} minit selepas azan`,
    scan: 'Imbas untuk jadual bulan lain', myMonth: 'Solatku bulan', colourIn: 'Warnakan satu bulatan selepas setiap solat', reward: 'Hadiahku', stars: 'Bulatan diwarna', name: 'Nama',
    cut: 'Gunting di garisan putus-putus',
  },
  id: {
    sheetName: { month: 'Jadwal bulanan', ramadan: 'Jadwal Ramadan', stickers: 'Kalender stiker', tracker: 'Lembar sholat anak' },
    sheetHint: {
      month: 'Satu halaman A4 untuk kulkas, kantor atau papan pengumuman masjid.',
      ramadan: 'Imsak dan berbuka setiap hari Ramadan, dengan kotak untuk mencentang setiap puasa.',
      stickers: 'Satu kotak untuk setiap hari. Cetak di kertas stiker A4 (atau kertas biasa dan lem), gunting di garis putus-putus, lalu tempel jadwal hari ini di kulkas, agenda atau meja.',
      tracker: 'Anak mewarnai satu lingkaran setiap selesai sholat. Tempel di dinding dan hitung bintangnya di akhir bulan.',
    },
    date: 'Tanggal', day: 'Hari', hijri: 'Hijriah', fast: 'Puasa', imsak: 'Imsak', iftar: 'Berbuka',
    weekdays: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    weekdaysShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    months: ID_MONTHS,
    official: (s) => `Jadwal: ${s}.`,
    calculated: (m) => `Waktu dihitung dengan metode ${m}. Jadwal resmi untuk tanggal ini belum terbit, mohon cek ke masjid Anda.`,
    ramadanNote: 'Awal dan akhir Ramadan mengikuti pengumuman resmi; tanggal ini adalah perkiraan.',
    lastTen: 'Sepuluh malam terakhir',
    iqamah: 'Iqamah', after: (n) => `${n} menit setelah azan`,
    scan: 'Pindai untuk jadwal bulan lain', myMonth: 'Sholatku bulan', colourIn: 'Warnai satu lingkaran setiap selesai sholat', reward: 'Hadiahku', stars: 'Lingkaran diwarnai', name: 'Nama',
    cut: 'Gunting di garis putus-putus',
  },
}

// MARK: Link

/** The print page's #hash: the screen's settings plus the sheet and month. */
export function printHash(c: ScreenConfig, o: Partial<PrintOptions>, encode: (c: ScreenConfig) => string): string {
  const parts = [`c=${encode(c)}`]
  if (o.sheet) parts.push(`sheet=${o.sheet}`)
  if (o.year && o.month) parts.push(`m=${o.year}-${String(o.month).padStart(2, '0')}`)
  return `#${parts.join('&')}`
}

export function optionsFromHash(hash: string, now: number, tz: string): PrintOptions {
  const sheet = /(?:^#|&)sheet=([a-z]+)/.exec(hash)?.[1] as SheetKind | undefined
  const m = /(?:^#|&)m=(\d{4})-(\d{2})/.exec(hash)
  const z = zoned(now, tz)
  const month = m ? parseInt(m[2], 10) : z.month
  return {
    sheet: sheet && SHEETS.includes(sheet) ? sheet : 'month',
    year: m && month >= 1 && month <= 12 ? parseInt(m[1], 10) : z.year,
    month: month >= 1 && month <= 12 ? month : z.month,
  }
}

/**
 * The short link in a sheet's QR code: just the place, words and title, so the
 * code stays small enough to scan from a fridge door. Opens this month's sheet.
 *
 *   #ll=1.3721,103.9474&tz=Asia/Singapore&cc=SG&n=malay&l=en&t=Masjid+Al-Falah&sheet=month
 */
export function shortHash(c: ScreenConfig, sheet: SheetKind): string {
  const p = c.place!
  const q = new URLSearchParams({ ll: `${+p.lat.toFixed(4)},${+p.lng.toFixed(4)}`, tz: p.tz })
  if (p.cc) q.set('cc', p.cc)
  if (p.district) q.set('d', p.district)
  q.set('n', c.names)
  if (c.lang !== 'en') q.set('l', c.lang)
  if (c.h24) q.set('h', '24')
  q.set('pn', p.name)
  if (c.name) q.set('t', c.name)
  q.set('sheet', sheet)
  return `#${q.toString().replace(/%2C/g, ',').replace(/%2F/g, '/')}`
}

export function configFromShortHash(hash: string): ScreenConfig | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const ll = (q.get('ll') ?? '').split(',').map(Number)
  if (ll.length !== 2) return null
  const c = sanitize({
    name: q.get('t') ?? '', names: q.get('n'), lang: q.get('l') ?? 'en', h24: q.get('h') === '24',
    place: { name: q.get('pn') ?? '', lat: ll[0], lng: ll[1], tz: q.get('tz'), cc: q.get('cc'), district: q.get('d') },
  })
  return c.place ? c : null
}
