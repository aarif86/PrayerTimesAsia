import type { HijriDate } from './hijri'
import type { NamingStyle } from './prayer'

/**
 * The days of the Islamic year that people look up most, for the Hijri month
 * calendar (tap the date on the Prayer screen). Reference only. The app never
 * tells anyone what to do on these days; the user's local religious authority does.
 *
 * Same list in ios Core/IslamicDays.swift and android core IslamicDays.kt.
 */
export type IslamicDayKind =
  | 'newYear' | 'tasua' | 'ashura' | 'maulid' | 'rejabStart' | 'israMikraj' | 'nisfuSyaaban'
  | 'sightingRamadan' | 'sightingSyawal' | 'zulhijjahTen' | 'tarwiyah'
  | 'ramadanStart' | 'nuzulQuran' | 'lastTen' | 'aidilfitri'
  | 'arafah' | 'aidiladha' | 'tasyrik' | 'whiteDay'

export interface IslamicDay { kind: IslamicDayKind; major: boolean }

/** Key days of a Hijri date, most important first. White days (13 to 15) are a quiet extra. */
export function islamicDaysOf(h: HijriDate): IslamicDay[] {
  const out: IslamicDay[] = []
  const add = (kind: IslamicDayKind, major = true) => out.push({ kind, major })
  const { month: m, day: d } = h
  if (m === 1 && d === 1) add('newYear')
  if (m === 1 && d === 9) add('tasua')
  if (m === 1 && d === 10) add('ashura')
  if (m === 3 && d === 12) add('maulid')
  if (m === 7 && d === 1) add('rejabStart')
  if (m === 7 && d === 27) add('israMikraj')
  if (m === 8 && d === 15) add('nisfuSyaaban')
  if (m === 8 && d === 29) add('sightingRamadan')
  if (m === 9 && d === 1) add('ramadanStart')
  if (m === 9 && d === 17) add('nuzulQuran')
  if (m === 9 && d >= 21) add('lastTen', false)
  if (m === 9 && d === 29) add('sightingSyawal')
  if (m === 10 && d === 1) add('aidilfitri')
  if (m === 12 && d >= 1 && d <= 7) add('zulhijjahTen', false)
  if (m === 12 && d === 8) add('tarwiyah')
  if (m === 12 && d === 9) add('arafah')
  if (m === 12 && d === 10) add('aidiladha')
  if (m === 12 && d >= 11 && d <= 13) add('tasyrik', false)
  // The white days, except in Zulhijjah where 13 is a day of Tasyrik.
  if (d >= 13 && d <= 15 && !(m === 12 && d === 13) && m !== 9) add('whiteDay', false)
  return out
}

type Lang = 'en' | 'ms' | 'id'
const lang = (s: NamingStyle): Lang => (s === 'malay' ? 'ms' : s === 'indonesian' ? 'id' : 'en')

const NAMES: Record<IslamicDayKind, Record<Lang, string>> = {
  newYear: { en: 'Islamic New Year', ms: 'Awal Muharram', id: 'Tahun Baru Islam' },
  tasua: { en: "Day of Tasu'a", ms: "Hari Tasu'a", id: "Hari Tasu'a" },
  ashura: { en: 'Day of Ashura', ms: 'Hari Asyura', id: 'Hari Asyura' },
  rejabStart: { en: 'Rajab begins, a sacred month', ms: 'Awal Rejab, bulan haram', id: 'Awal Rajab, bulan haram' },
  sightingRamadan: { en: 'Moon sighting for Ramadan', ms: 'Rukyah awal Ramadan', id: 'Rukyatul hilal Ramadan' },
  sightingSyawal: { en: 'Moon sighting for Shawwal', ms: 'Rukyah awal Syawal', id: 'Rukyatul hilal Syawal' },
  zulhijjahTen: { en: 'First ten days of Dhul Hijjah', ms: 'Sepuluh hari awal Zulhijjah', id: 'Sepuluh hari awal Zulhijjah' },
  tarwiyah: { en: 'Day of Tarwiyah', ms: 'Hari Tarwiyah', id: 'Hari Tarwiyah' },
  maulid: { en: "Prophet Muhammad's Birthday", ms: 'Maulidur Rasul', id: 'Maulid Nabi' },
  israMikraj: { en: "Isra and Mi'raj", ms: 'Israk dan Mikraj', id: "Isra Mi'raj" },
  nisfuSyaaban: { en: "Middle of Sha'ban", ms: 'Nisfu Syaaban', id: "Nisfu Sya'ban" },
  ramadanStart: { en: 'First day of Ramadan', ms: 'Awal Ramadan', id: 'Awal Ramadan' },
  nuzulQuran: { en: 'Nuzul al-Quran', ms: 'Nuzul al-Quran', id: 'Nuzulul Quran' },
  lastTen: { en: 'Last ten nights', ms: 'Sepuluh malam terakhir', id: 'Sepuluh malam terakhir' },
  aidilfitri: { en: 'Eid al-Fitr', ms: 'Hari Raya Aidilfitri', id: 'Idulfitri' },
  arafah: { en: 'Day of Arafah', ms: 'Hari Arafah', id: 'Hari Arafah' },
  aidiladha: { en: 'Eid al-Adha', ms: 'Hari Raya Aidiladha', id: 'Iduladha' },
  tasyrik: { en: 'Days of Tashriq', ms: 'Hari Tasyrik', id: 'Hari Tasyrik' },
  whiteDay: { en: 'White days', ms: 'Hari putih', id: 'Ayyamul bidh' },
}

export const islamicDayName = (k: IslamicDayKind, s: NamingStyle): string => NAMES[k][lang(s)]

/** Short names that fit inside a calendar day. */
const SHORT: Partial<Record<IslamicDayKind, Record<Lang, string>>> = {
  newYear: { en: 'New Year', ms: 'Maal Hijrah', id: 'Tahun Baru' },
  tasua: { en: "Tasu'a", ms: "Tasu'a", id: "Tasu'a" },
  ashura: { en: 'Ashura', ms: 'Asyura', id: 'Asyura' },
  rejabStart: { en: 'Rajab', ms: 'Awal Rejab', id: 'Awal Rajab' },
  sightingRamadan: { en: 'Moon sighting', ms: 'Rukyah', id: 'Rukyat' },
  sightingSyawal: { en: 'Moon sighting', ms: 'Rukyah', id: 'Rukyat' },
  tarwiyah: { en: 'Tarwiyah', ms: 'Tarwiyah', id: 'Tarwiyah' },
  maulid: { en: 'Mawlid', ms: 'Maulid', id: 'Maulid' },
  israMikraj: { en: "Isra Mi'raj", ms: 'Israk Mikraj', id: "Isra Mi'raj" },
  nisfuSyaaban: { en: "Nisfu Sha'ban", ms: 'Nisfu Syaaban', id: "Nisfu Sya'ban" },
  ramadanStart: { en: 'Ramadan', ms: 'Awal Ramadan', id: 'Awal Ramadan' },
  nuzulQuran: { en: 'Nuzul Quran', ms: 'Nuzul Quran', id: 'Nuzulul Quran' },
  aidilfitri: { en: 'Eid al-Fitr', ms: 'Aidilfitri', id: 'Idulfitri' },
  arafah: { en: 'Arafah', ms: 'Arafah', id: 'Arafah' },
  aidiladha: { en: 'Eid al-Adha', ms: 'Aidiladha', id: 'Iduladha' },
}
export const islamicDayShort = (k: IslamicDayKind, s: NamingStyle): string => SHORT[k]?.[lang(s)] ?? NAMES[k][lang(s)]

/** Words for the calendar sheet, in the user's language. No colons or dashes. */
export const HIJRI_CAL_WORDS: Record<Lang, {
  title: string; today: string; months: string[]; and: string; keyDays: string; none: string; week: string[]
  note: (authority: string | null) => string; notePublished: (authority: string) => string; adjust: string; adjustNone: string
  earlier: string; later: string; dayOff: string; print: string
}> = {
  en: {
    title: 'Hijri calendar', today: 'Today', and: 'and',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], keyDays: 'This month', none: 'No special days this month.',
    week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    note: (a) => a
      ? `Ramadan and Eid al-Fitr follow ${a} once announced. Other days are worked out ahead and can be a day apart from your area. Follow your local religious authority.`
      : 'Dates are worked out ahead and can be a day apart from your area. Follow your local religious authority.',
    notePublished: (a) => `These dates follow the ${a} Islamic calendar. Ramadan and Eid follow its announcement. Follow your local religious authority.`,
    print: 'Print the whole year', adjust: 'Move the Hijri date', adjustNone: 'Not moved', earlier: 'One day earlier', later: 'One day later', dayOff: 'day',
  },
  ms: {
    title: 'Kalendar Hijrah', today: 'Hari ini', and: 'dan',
    months: ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'], keyDays: 'Bulan ini', none: 'Tiada hari kebesaran bulan ini.',
    week: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'],
    note: (a) => a
      ? `Ramadan dan Aidilfitri mengikut ${a} sebaik sahaja diumumkan. Tarikh lain dikira lebih awal dan mungkin berbeza sehari di tempat anda. Ikutlah pihak berkuasa agama tempatan anda.`
      : 'Tarikh dikira lebih awal dan mungkin berbeza sehari di tempat anda. Ikutlah pihak berkuasa agama tempatan anda.',
    notePublished: (a) => `Tarikh ini mengikut takwim Islam ${a}. Ramadan dan Hari Raya mengikut pengumumannya. Ikutlah pihak berkuasa agama tempatan anda.`,
    print: 'Cetak kalendar setahun', adjust: 'Anjak tarikh Hijrah', adjustNone: 'Tidak dianjak', earlier: 'Sehari lebih awal', later: 'Sehari lebih lewat', dayOff: 'hari',
  },
  id: {
    title: 'Kalender Hijriah', today: 'Hari ini', and: 'dan',
    months: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'], keyDays: 'Bulan ini', none: 'Tidak ada hari besar bulan ini.',
    week: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    note: (a) => a
      ? `Awal Ramadan dan Idulfitri mengikuti ${a} setelah diumumkan. Tanggal lain dihitung lebih dulu dan bisa berbeda sehari di daerah Anda. Ikuti otoritas keagamaan setempat.`
      : 'Tanggal dihitung lebih dulu dan bisa berbeda sehari di daerah Anda. Ikuti otoritas keagamaan setempat.',
    notePublished: (a) => `Tanggal ini mengikuti kalender Islam ${a}. Awal Ramadan dan Lebaran mengikuti pengumumannya. Ikuti otoritas keagamaan setempat.`,
    print: 'Cetak kalender setahun', adjust: 'Geser tanggal Hijriah', adjustNone: 'Tidak digeser', earlier: 'Sehari lebih awal', later: 'Sehari lebih lambat', dayOff: 'hari',
  },
}

export const hijriCalWords = (s: NamingStyle) => HIJRI_CAL_WORDS[lang(s)]

/** Hijri month names short enough for a calendar day (English and Malay/Indonesian; others use the full name). */
export function hijriMonthShort(month: number, s: NamingStyle, full: string): string {
  const en = ['Muharram', 'Safar', 'Rabi I', 'Rabi II', 'Jumada I', 'Jumada II', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah']
  const ms = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jamadil Awal', 'Jamadil Akhir', 'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah']
  const i = Math.max(0, Math.min(11, month - 1))
  return s === 'malay' ? ms[i] : ['indonesian', 'turkish', 'arabicScript', 'urdu', 'bengali', 'french'].includes(s) ? full : en[i]
}
