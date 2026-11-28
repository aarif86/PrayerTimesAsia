/**
 * Builds the pages search engines and AI answer tools read, from the SAME prayer
 * engine and country table the apps use, so a page can never disagree with the app.
 *
 *   cd web && npx vite-node scripts/build-search-pages.ts -- <siteDir> <base>
 *
 *   <siteDir>  the assembled website folder (_site). Pages are written into it.
 *   <base>     "/" on the custom domain, "/PrayerTimesAsia/" on github.io.
 *
 * Writes, in English plus each city's own language (see COUNTRY_LANGS), a list page and one page per city
 * (prayer-times/, ms/waktu-solat/, id/jadwal-sholat/), a plain printable monthly and
 * Ramadan timetable page per city, plus about.html, sitemap.xml and robots.txt.
 *
 * Every city page carries today's times as plain text plus the next 30 days, so
 * nothing depends on a widget. A tiny script swaps in the visitor-day row if the
 * page is older than a day, and the Web workflow rebuilds daily.
 * Public copy rule: no colons or dashes in the sentences.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { computeFor } from '../src/core/engine'
import { qiblaBearing } from '../src/core/geo'
import { ALL_METHODS } from '../src/core/methods'
import { NAMES, type Prayer } from '../src/core/prayer'
import { profileFor, profileMethod } from '../src/core/regions'
import { CITIES } from '../src/services/cities'
import { zoned } from '../src/core/tz'
import { hijriDate } from '../src/core/hijri'
import type { CalculationMethod } from '../src/core/methods'
import { CSS, THEME, TOGGLE } from './site-theme'
import { LOCALES, NO_AUTH_NEW, LOCAL_CITY_NAMES, type NewLang, type Words } from './search-pages-locales'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const [siteDir, baseArg = '/'] = argv
if (!siteDir) throw new Error('usage: build-search-pages.ts <siteDir> <base>')
const BASE = baseArg.endsWith('/') ? baseArg : baseArg + '/'
const DAYS = 30
const ORIGIN = 'https://prayertimes.asia'
const PLAY = 'https://play.google.com/store/apps/details?id=com.prayertimesasia.app'
type Lang = 'en' | 'ms' | 'id' | 'ar' | 'ur' | 'bn' | 'tr' | NewLang
const NEW_CODES = Object.keys(LOCALES) as NewLang[]
const ALL_LANGS: Lang[] = ['en', 'ms', 'id', 'ar', 'ur', 'bn', 'tr', ...NEW_CODES]
/**
 * Every city page is in English plus the language people actually speak there. Malay is only for Malaysia, Singapore and
 * Brunei, Indonesian only for Indonesia. Makkah and Madinah also keep Malay and Indonesian because so many pilgrims
 * from those countries search for them. Cities in countries with no local language here yet (London) are English only.
 */
const COUNTRY_LANGS: Record<string, Lang[]> = {
  SG: ['ms'], MY: ['ms'], BN: ['ms'], ID: ['id'], TH: ['th'], MM: ['my'], NP: ['ne'], PH: ['fil'], VN: ['vi'], KH: ['km'],
  BD: ['bn'], PK: ['ur'], IN: ['hi'], LK: ['si'], JP: ['ja'], KR: ['ko'], HK: ['zh'], SA: ['ms', 'id', 'ar'], AE: ['ar'], TR: ['tr'], GB: [],
}
const hreflang = (l: Lang) => (l === 'zh' ? 'zh-HK' : l)

/** [country, name in the built-in list, name shown on the page]. */
const WANTED: [string, string, string?][] = [
  ['SG', 'Singapore City', 'Singapore'], ['MY', 'Kuala Lumpur'], ['MY', 'Johor Bahru'], ['MY', 'George Town', 'Penang'],
  ['MY', 'Kota Kinabalu'], ['MY', 'Kuching'], ['BN', 'Bandar Seri Begawan'],
  ['ID', 'Jakarta'], ['ID', 'Surabaya'], ['ID', 'Bandung'], ['ID', 'Medan'], ['ID', 'Makassar'], ['ID', 'Yogyakarta'],
  ['TH', 'Bangkok'], ['PH', 'Manila'], ['VN', 'Hanoi'], ['VN', 'Ho Chi Minh City'], ['KH', 'Phnom Penh'],
  ['BD', 'Dhaka'], ['PK', 'Karachi'], ['PK', 'Lahore'], ['IN', 'Mumbai'], ['IN', 'New Delhi', 'Delhi'], ['LK', 'Colombo'],
  ['JP', 'Tokyo'], ['KR', 'Seoul'], ['HK', 'Hong Kong'],
  ['SA', 'Makkah'], ['SA', 'Madinah'], ['AE', 'Dubai'], ['TR', 'Istanbul'], ['GB', 'London'],
  // Added for search, closest to where our users are (Malaysia, Indonesia, the rest of South East Asia).
  ['MY', 'Shah Alam'], ['MY', 'Ipoh'], ['MY', 'Melaka'], ['MY', 'Kota Bharu'], ['MY', 'Kuantan'], ['MY', 'Kuala Terengganu'],
  ['MY', 'Alor Setar'], ['MY', 'Seremban'],
  ['ID', 'Semarang'], ['ID', 'Palembang'], ['ID', 'Denpasar'], ['ID', 'Batam'], ['ID', 'Pekanbaru'], ['ID', 'Banda Aceh'], ['ID', 'Pontianak'],
  ['TH', 'Chiang Mai'], ['MM', 'Yangon'], ['NP', 'Kathmandu'],
]

const slug = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const write = (path: string, body: string) => {
  const full = join(siteDir, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

// ---- the engine inputs for each city, kept so every language and timetable page uses the same numbers -------------------
interface City2 {
  name: string; slug: string; country: string; tz: string; lat: number; lng: number
  methodName: string; fajr: number; isha: number | null; ishaInterval: number | null
  authority: string; sourceKind: string; note: string; naming: Record<Lang, Record<Prayer, string>>
  qibla: number; coords: { latitude: number; longitude: number }; method: CalculationMethod; asr: 'standard' | 'hanafi'
}

const now = Date.now()
const BUILT = new Date(now).toISOString().slice(0, 10)
const cities: City2[] = WANTED.map(([cc, listName, shown]) => {
  const p = CITIES.find((c) => c.countryCode === cc && c.name === listName)
  if (!p) throw new Error(`City missing from the built-in list: ${cc} ${listName}`)
  const profile = profileFor(cc)!
  const method = profileMethod(profile)
  const nm = shown ?? p.name
  return {
    name: nm, slug: slug(nm), country: cc, tz: p.timeZoneID, lat: p.coordinates.latitude, lng: p.coordinates.longitude,
    methodName: method.name.replace(' · ', ', '), fajr: method.fajrAngle, isha: method.ishaAngle, ishaInterval: method.ishaInterval,
    authority: profile.authority ?? '', sourceKind: profile.source, note: profile.note ?? '',
    // English pages show the country's own names next to the English ones ("Fajr (Subuh)"), Malay and Indonesian use their own.
    naming: { en: NAMES[profile.naming], ms: NAMES.malay, id: NAMES.indonesian, ar: NAMES.arabicScript, ur: NAMES.urdu, bn: NAMES.bengali, tr: NAMES.turkish, ...Object.fromEntries(NEW_CODES.map((k) => [k, LOCALES[k].names])) } as City2['naming'],
    qibla: Math.round(qiblaBearing(p.coordinates)), coords: p.coordinates, method, asr: profile.asr,
  }
})

type Times = Record<Prayer, number>
const timesAt = (c: City2, ms: number): Times => computeFor(ms, c.tz, c.coords, c.method, c.asr).times as Times

// ---- language bits -----------------------------------------------------------------------------------------------------
const LOCALE = { en: 'en-GB', ms: 'ms-MY', id: 'id-ID', ar: 'ar-u-ca-gregory-nu-latn', ur: 'ur-PK-u-nu-latn', bn: 'bn-BD-u-nu-latn', tr: 'tr-TR', ...Object.fromEntries(NEW_CODES.map((k) => [k, LOCALES[k].locale])) } as Record<Lang, string>
const NATIVE = { en: 'EN', ms: 'MS', id: 'ID', ar: 'العربية', ur: 'اردو', bn: 'বাংলা', tr: 'TR', ...Object.fromEntries(NEW_CODES.map((k) => [k, LOCALES[k].native])) } as Record<Lang, string>
const RTL: Lang[] = ['ar', 'ur']
const langsFor = (c: City2): Lang[] => ALL_LANGS.filter((l) => l === 'en' || (COUNTRY_LANGS[c.country] ?? []).includes(l))
const inLang = (c: City2, l: Lang) => langsFor(c).includes(l)
const BASE_DIR = { en: 'prayer-times', ms: 'ms/waktu-solat', id: 'id/jadwal-sholat', ar: 'ar/mawaqit-alsalat', ur: 'ur/namaz-ke-auqat', bn: 'bn/namajer-somoy', tr: 'tr/namaz-vakitleri', ...Object.fromEntries(NEW_CODES.map((k) => [k, LOCALES[k].dir])) } as Record<Lang, string>
const PRINT_DIR = { en: 'printable-timetables', ms: 'ms/jadual-cetak', id: 'id/jadwal-cetak', ar: 'ar/jadwal-lil-tibaa', ur: 'ur/chapai-ka-jadwal', bn: 'bn/print-somoysuchi', tr: 'tr/yazdirilabilir-vakitler', ...Object.fromEntries(NEW_CODES.map((k) => [k, LOCALES[k].print])) } as Record<Lang, string>
// The new local languages have no home page of their own yet, so their logo and breadcrumb go to the English home page.
const HOME = { en: '', ms: 'ms/', id: 'id/', ar: 'ar/', ur: 'ur/', bn: 'bn/', tr: 'tr/', ...Object.fromEntries(NEW_CODES.map((k) => [k, ''])) } as Record<Lang, string>
const cityPath = (l: Lang, c: City2) => `${BASE_DIR[l]}/${c.slug}/`
const printPath = (l: Lang, c: City2) => `${PRINT_DIR[l]}/${c.slug}/`
const LOCAL_NAMES: Record<string, Partial<Record<Lang, string>>> = {
  penang: { ms: 'Pulau Pinang', id: 'Pulau Pinang' }, makkah: { ar: 'مكة المكرمة' }, madinah: { ar: 'المدينة المنورة' }, dubai: { ar: 'دبي' },
  karachi: { ur: 'کراچی' }, lahore: { ur: 'لاہور' }, dhaka: { bn: 'ঢাকা' }, istanbul: { tr: 'İstanbul' },
}
const cityName = (c: City2, l: Lang) => LOCAL_NAMES[c.slug]?.[l] ?? (LOCAL_CITY_NAMES[c.slug] as Partial<Record<Lang, string>> | undefined)?.[l] ?? c.name
const countryName = (cc: string, l: Lang) => {
  try { return new Intl.DisplayNames([LOCALE[l]], { type: 'region' }).of(cc) ?? cc } catch { return cc }
}
const compassWords = {
  en: ['north', 'north east', 'east', 'south east', 'south', 'south west', 'west', 'north west'],
  ms: ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'],
  id: ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'],
  ar: ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'],
  ur: ['شمال', 'شمال مشرق', 'مشرق', 'جنوب مشرق', 'جنوب', 'جنوب مغرب', 'مغرب', 'شمال مغرب'],
  bn: ['উত্তর', 'উত্তর পূর্ব', 'পূর্ব', 'দক্ষিণ পূর্ব', 'দক্ষিণ', 'দক্ষিণ পশ্চিম', 'পশ্চিম', 'উত্তর পশ্চিম'],
  tr: ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'],
  ...Object.fromEntries(NEW_CODES.map((k) => [k, LOCALES[k].compass])),
} as Record<Lang, string[]>
const compass = (deg: number, l: Lang) => compassWords[l][Math.round(deg / 45) % 8]

/** The clock the way people write it there. English and Malay use 12 hours, Indonesian uses 24 hours. */
function clock(ms: number, tz: string, l: Lang): string {
  const z = zoned(ms, tz)
  const mm = String(z.minute).padStart(2, '0')
  if (l === 'id') return `${String(z.hour).padStart(2, '0')}.${mm}`
  if (l === 'tr') return `${String(z.hour).padStart(2, '0')}:${mm}`
  if (l in LOCALES) {
    if (LOCALES[l as NewLang].clock === 'h24') return `${String(z.hour).padStart(2, '0')}:${mm}`
    return `${z.hour % 12 === 0 ? 12 : z.hour % 12}:${mm} ${z.hour < 12 ? 'AM' : 'PM'}`
  }
  const h12 = z.hour % 12 === 0 ? 12 : z.hour % 12
  if (l === 'en') return `${h12}:${mm} ${z.hour < 12 ? 'am' : 'pm'}`
  if (l === 'ar') return `${h12}:${mm} ${z.hour < 12 ? 'ص' : 'م'}`
  if (l === 'ur' || l === 'bn') return `${h12}:${mm} ${z.hour < 12 ? 'AM' : 'PM'}`
  const part = z.hour < 12 ? 'pg' : z.hour < 15 ? 'tgh' : z.hour < 19 ? 'ptg' : 'mlm'
  return `${h12}:${mm} ${part}`
}
const isoDay = (ms: number, tz: string) => { const z = zoned(ms, tz); return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}` }
// The standard Sinhala month list names the poya days (Nov is "ඉල්"), not the calendar months people read, so Sinhala dates use these.
const SI_MONTHS = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්']
const fmtDate = (ms: number, tz: string, l: Lang, o: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat(LOCALE[l], { timeZone: tz, ...o })
  if (l !== 'si' || !o.month) return f.format(ms)
  const mi = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(ms)) - 1
  return f.formatToParts(ms).map((p) => (p.type === 'month' ? SI_MONTHS[mi] : p.value)).join('')
}
const longDate = (ms: number, tz: string, l: Lang) => fmtDate(ms, tz, l, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const FAST_UNITS = { en: [' h ', ' m'], ms: [' j ', ' m'], id: [' j ', ' m'], ar: [' س ', ' د'], ur: [' گھنٹے ', ' منٹ'], bn: [' ঘণ্টা ', ' মিনিট'], tr: [' sa ', ' dk'], ...Object.fromEntries(NEW_CODES.map((k) => [k, LOCALES[k].fastUnits])) } as Record<Lang, [string, string]>
const fastLen = (a: number, b: number, l: Lang) => { const m = Math.round((b - a) / 60000); return `${Math.floor(m / 60)}${FAST_UNITS[l][0]}${m % 60}${FAST_UNITS[l][1]}` }

const ENGLISH: Record<Prayer, string> = NAMES.arabic
const prayers: Prayer[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
/** English pages show the local name next to the English one. */
const nameOf = (c: City2, k: Prayer, l: Lang) => (l === 'en' ? (c.naming.en[k] === ENGLISH[k] ? ENGLISH[k] : `${ENGLISH[k]} (${c.naming.en[k]})`) : c.naming[l][k])
const leadOf = (c: City2, k: Prayer, l: Lang) => c.naming[l][k]

// ---- words. English first, Malay and Indonesian after. No colons or dashes in sentences (owner rule). ----------------------
const W = {
  en: {
    home: 'Home', crumb: 'Prayer times', open: 'Open the app', play: 'Get it on Google Play', nasar: 'Built fisabilillah in Singapore by',
    title: (n) => `Prayer times in ${n} today | Fajr, Dhuhr, Asr, Maghrib, Isha`,
    descPre: (n, d) => `Prayer times in ${n} today, ${d}.`, h1: (n) => `Prayer times in ${n} today`,
    stale: "These times are older than a month. Open the app for today's times.", local: (p) => `All times are local time in ${p}.`,
    table: (a) => `The official timetable comes from ${a}. The times on this page are worked out with the same method and sit within about 2 minutes of it, never earlier. The Prayer Times Asia app shows the official timetable itself when you are online.`,
    authority: (a) => `The app follows ${a} and works out the times with that authority's own method.`,
    none: (note) => `There is no single national authority whose timetable the app can read here, so it uses what most masjids use. ${note}`.trim(),
    faqH: (n) => `Questions about prayer times in ${n}`, howH: 'How these times are worked out', source: 'Source', methodLbl: 'Method', placeLbl: 'Place',
    moreAbout: 'Read more about how we work out the times', caution: 'Masjids can differ by a few minutes, so please follow your local religious authority.',
    ishaDeg: (n) => `${n} degrees`, ishaMin: (n) => `${n} minutes after Maghrib`, shafii: "Shafi'i", hanafi: 'Hanafi',
    daysH: (n) => `Prayer times in ${n} for the next 30 days`, showDays: 'Show the 30 day timetable', dateCol: 'Date', othersH: 'Other cities', built: 'Page built',
    printH: 'Print this timetable', printLead: (n) => `Monthly and Ramadan timetables for ${n}, ready to print or save as PDF.`, btnMonthly: 'Printable timetable', btnRamadan: 'Ramadan timetable',
    follow: 'Always follow your local religious authority.', about: 'How we work out the times', sources: 'Where our times come from', privacy: 'Privacy', allCities: 'All cities',
    ptTitle: 'Prayer times by city | Prayer Times Asia', ptDesc: (n) => `Today's prayer times for ${n} cities across Asia and the world, with the method and source explained for each.`,
    ptH1: 'Prayer times by city', ptLead: "Pick a city to see today's prayer times and the next 30 days, with the method and source written out. For your exact spot, open the free app.", ptFoot: 'The app covers 143 countries and works offline.',
    prTitle: (n) => `Printable prayer timetable for ${n} | Monthly and Ramadan`, prDesc: (n) => `Free printable monthly and Ramadan prayer timetable for ${n}, with the source, method and fast length written on it. Print it or save it as PDF.`,
    prH1: (n) => `Printable prayer timetable for ${n}`, prLead: (n) => `Free monthly and Ramadan timetables for ${n}. Print them or save as PDF. Each one says where the times come from. Please follow your local religious authority.`,
    prSource: 'Where these times come from', prMonthly: 'Monthly timetable', prRamadan: 'Ramadan timetable',
    prRamadanNote: (d, y) => `Ramadan ${y} is expected to start around ${d}, worked out from the Umm al-Qura calendar. Your local authority announces the real start, so please follow it.`,
    prFastNote: 'Fast length is counted from Fajr to Maghrib.', prPrint: 'Print this page', prApp: 'Open the app to print for your exact spot',
    prAppNote: 'Not your city? The free app can print a timetable for your exact spot.', day: 'Day', fast: 'Fast', back: 'Back to the city page', printBadge: 'Printable',
    hubTitle: 'Printable prayer timetables by city | Prayer Times Asia', hubDesc: (n) => `Free printable monthly and Ramadan prayer timetables for ${n} cities, each with its source written on it.`,
    hubH1: 'Printable prayer timetables', hubLead: 'Free monthly and Ramadan timetables you can print or save as PDF. Each one says where the times come from. Please follow your local religious authority.',
    pick: 'Pick your city', cityBadge: 'Prayer times', theme: 'Switch between light and dark',
  },
  ms: {
    home: 'Utama', crumb: 'Waktu solat', open: 'Buka aplikasi', play: 'Muat turun di Google Play', nasar: 'Dibina fisabilillah di Singapura oleh',
    title: (n) => `Waktu solat di ${n} hari ini | Subuh, Zohor, Asar, Maghrib, Isyak`,
    descPre: (n, d) => `Waktu solat di ${n} hari ini, ${d}.`, h1: (n) => `Waktu solat di ${n} hari ini`,
    stale: 'Waktu ini sudah lebih sebulan. Buka aplikasi untuk waktu hari ini.', local: (p) => `Semua waktu ialah waktu tempatan di ${p}.`,
    table: (a) => `Jadual rasmi datang daripada ${a}. Waktu di laman ini dikira dengan kaedah yang sama dan berbeza dalam lingkungan 2 minit, tidak pernah lebih awal. Aplikasi Prayer Times Asia menunjukkan jadual rasmi itu sendiri apabila anda berada dalam talian.`,
    authority: (a) => `Aplikasi mengikut ${a} dan mengira waktu dengan kaedah pihak berkuasa itu sendiri.`,
    none: () => 'Tiada pihak berkuasa kebangsaan yang jadualnya boleh dibaca oleh aplikasi di sini, jadi aplikasi menggunakan kaedah yang digunakan oleh kebanyakan masjid.',
    faqH: (n) => `Soalan lazim tentang waktu solat di ${n}`, howH: 'Bagaimana waktu ini dikira', source: 'Sumber', methodLbl: 'Kaedah', placeLbl: 'Tempat',
    moreAbout: 'Baca lebih lanjut tentang cara kami mengira waktu', caution: 'Waktu di masjid boleh berbeza beberapa minit, jadi sila ikut pihak berkuasa agama tempatan anda.',
    ishaDeg: (n) => `${n} darjah`, ishaMin: (n) => `${n} minit selepas Maghrib`, shafii: 'Syafie', hanafi: 'Hanafi',
    daysH: (n) => `Waktu solat di ${n} untuk 30 hari akan datang`, showDays: 'Tunjukkan jadual 30 hari', dateCol: 'Tarikh', othersH: 'Bandar lain', built: 'Halaman dibina pada',
    printH: 'Cetak jadual ini', printLead: (n) => `Jadual bulanan dan jadual Ramadan untuk ${n}, sedia untuk dicetak atau disimpan sebagai PDF.`, btnMonthly: 'Jadual untuk dicetak', btnRamadan: 'Jadual Ramadan',
    follow: 'Sentiasa ikut pihak berkuasa agama tempatan anda.', about: 'Cara kami mengira waktu', sources: 'Sumber waktu kami', privacy: 'Privasi', allCities: 'Semua bandar',
    ptTitle: 'Waktu solat mengikut bandar | Prayer Times Asia', ptDesc: (n) => `Waktu solat hari ini untuk ${n} bandar di Asia dan seluruh dunia, dengan kaedah dan sumber dijelaskan untuk setiap bandar.`,
    ptH1: 'Waktu solat mengikut bandar', ptLead: 'Pilih bandar untuk melihat waktu solat hari ini dan 30 hari akan datang, lengkap dengan kaedah dan sumbernya. Untuk tempat anda yang tepat, buka aplikasi percuma kami.', ptFoot: 'Aplikasi meliputi 143 negara dan boleh digunakan tanpa talian.',
    prTitle: (n) => `Jadual waktu solat untuk dicetak di ${n} | Bulanan dan Ramadan`, prDesc: (n) => `Jadual waktu solat bulanan dan Ramadan percuma untuk dicetak di ${n}, lengkap dengan sumber, kaedah dan tempoh berpuasa. Cetak atau simpan sebagai PDF.`,
    prH1: (n) => `Jadual waktu solat untuk dicetak di ${n}`, prLead: (n) => `Jadual bulanan dan jadual Ramadan percuma untuk ${n}. Cetak atau simpan sebagai PDF. Setiap jadual menyatakan sumber waktunya. Sila ikut pihak berkuasa agama tempatan anda.`,
    prSource: 'Sumber waktu ini', prMonthly: 'Jadual bulanan', prRamadan: 'Jadual Ramadan',
    prRamadanNote: (d, y) => `Ramadan ${y} dijangka bermula sekitar ${d}, berdasarkan kalendar Umm al-Qura. Pihak berkuasa agama tempatan anda mengumumkan permulaan sebenar, jadi sila ikut pengumuman itu.`,
    prFastNote: 'Tempoh berpuasa dikira dari Subuh hingga Maghrib.', prPrint: 'Cetak halaman ini', prApp: 'Buka aplikasi untuk mencetak bagi tempat anda yang tepat',
    prAppNote: 'Bukan bandar anda? Aplikasi percuma boleh mencetak jadual untuk tempat anda yang tepat.', day: 'Hari', fast: 'Puasa', back: 'Kembali ke halaman bandar', printBadge: 'Boleh dicetak',
    hubTitle: 'Jadual waktu solat untuk dicetak mengikut bandar | Prayer Times Asia', hubDesc: (n) => `Jadual waktu solat bulanan dan Ramadan percuma untuk dicetak bagi ${n} bandar, setiap satu dengan sumbernya.`,
    hubH1: 'Jadual waktu solat untuk dicetak', hubLead: 'Jadual bulanan dan Ramadan percuma yang boleh dicetak atau disimpan sebagai PDF. Setiap jadual menyatakan sumber waktunya. Sila ikut pihak berkuasa agama tempatan anda.',
    pick: 'Pilih bandar anda', cityBadge: 'Waktu solat', theme: 'Tukar antara cerah dan gelap',
  },
  id: {
    home: 'Beranda', crumb: 'Jadwal sholat', open: 'Buka aplikasi', play: 'Unduh di Google Play', nasar: 'Dibuat fisabilillah di Singapura oleh',
    title: (n) => `Jadwal sholat ${n} hari ini | Subuh, Dzuhur, Ashar, Maghrib, Isya`,
    descPre: (n, d) => `Jadwal sholat ${n} hari ini, ${d}.`, h1: (n) => `Jadwal sholat ${n} hari ini`,
    stale: 'Jadwal ini sudah lebih dari sebulan. Buka aplikasi untuk jadwal hari ini.', local: (p) => `Semua waktu adalah waktu setempat di ${p}.`,
    table: (a) => `Jadwal resmi berasal dari ${a}. Waktu di halaman ini dihitung dengan metode yang sama dan selisihnya sekitar 2 menit, tidak pernah lebih awal. Aplikasi Prayer Times Asia menampilkan jadwal resmi itu sendiri saat Anda online.`,
    authority: (a) => `Aplikasi mengikuti ${a} dan menghitung waktu dengan metode lembaga itu sendiri.`,
    none: () => 'Tidak ada otoritas nasional yang jadwalnya bisa dibaca aplikasi di sini, jadi aplikasi memakai metode yang dipakai kebanyakan masjid.',
    faqH: (n) => `Pertanyaan tentang jadwal sholat ${n}`, howH: 'Cara waktu ini dihitung', source: 'Sumber', methodLbl: 'Metode', placeLbl: 'Tempat',
    moreAbout: 'Baca selengkapnya tentang cara kami menghitung waktu', caution: 'Waktu di masjid bisa berbeda beberapa menit, jadi silakan ikuti otoritas agama setempat Anda.',
    ishaDeg: (n) => `${n} derajat`, ishaMin: (n) => `${n} menit setelah Maghrib`, shafii: "Syafi'i", hanafi: 'Hanafi',
    daysH: (n) => `Jadwal sholat ${n} untuk 30 hari ke depan`, showDays: 'Tampilkan jadwal 30 hari', dateCol: 'Tanggal', othersH: 'Kota lain', built: 'Halaman dibuat pada',
    printH: 'Cetak jadwal ini', printLead: (n) => `Jadwal bulanan dan jadwal Ramadan untuk ${n}, siap dicetak atau disimpan sebagai PDF.`, btnMonthly: 'Jadwal untuk dicetak', btnRamadan: 'Jadwal Ramadan',
    follow: 'Selalu ikuti otoritas agama setempat Anda.', about: 'Cara kami menghitung waktu', sources: 'Sumber waktu kami', privacy: 'Privasi', allCities: 'Semua kota',
    ptTitle: 'Jadwal sholat per kota | Prayer Times Asia', ptDesc: (n) => `Jadwal sholat hari ini untuk ${n} kota di Asia dan dunia, dengan metode dan sumber dijelaskan untuk setiap kota.`,
    ptH1: 'Jadwal sholat per kota', ptLead: 'Pilih kota untuk melihat jadwal sholat hari ini dan 30 hari ke depan, lengkap dengan metode dan sumbernya. Untuk lokasi Anda yang tepat, buka aplikasi gratis kami.', ptFoot: 'Aplikasi mencakup 143 negara dan bisa dipakai tanpa internet.',
    prTitle: (n) => `Jadwal sholat ${n} untuk dicetak | Bulanan dan Ramadan`, prDesc: (n) => `Jadwal sholat bulanan dan Ramadan gratis untuk dicetak di ${n}, lengkap dengan sumber, metode, dan lama berpuasa. Cetak atau simpan sebagai PDF.`,
    prH1: (n) => `Jadwal sholat ${n} untuk dicetak`, prLead: (n) => `Jadwal bulanan dan jadwal Ramadan gratis untuk ${n}. Cetak atau simpan sebagai PDF. Setiap jadwal menyebut sumber waktunya. Silakan ikuti otoritas agama setempat Anda.`,
    prSource: 'Sumber waktu ini', prMonthly: 'Jadwal bulanan', prRamadan: 'Jadwal Ramadan',
    prRamadanNote: (d, y) => `Ramadan ${y} diperkirakan mulai sekitar ${d}, berdasarkan kalender Umm al-Qura. Otoritas agama setempat Anda yang mengumumkan awal yang sebenarnya, jadi silakan ikuti pengumuman itu.`,
    prFastNote: 'Lama berpuasa dihitung dari Subuh sampai Maghrib.', prPrint: 'Cetak halaman ini', prApp: 'Buka aplikasi untuk mencetak di lokasi Anda yang tepat',
    prAppNote: 'Bukan kota Anda? Aplikasi gratis bisa mencetak jadwal untuk lokasi Anda yang tepat.', day: 'Hari', fast: 'Puasa', back: 'Kembali ke halaman kota', printBadge: 'Bisa dicetak',
    hubTitle: 'Jadwal sholat untuk dicetak per kota | Prayer Times Asia', hubDesc: (n) => `Jadwal sholat bulanan dan Ramadan gratis untuk dicetak di ${n} kota, masing-masing dengan sumbernya.`,
    hubH1: 'Jadwal sholat untuk dicetak', hubLead: 'Jadwal bulanan dan Ramadan gratis yang bisa dicetak atau disimpan sebagai PDF. Setiap jadwal menyebut sumber waktunya. Silakan ikuti otoritas agama setempat Anda.',
    pick: 'Pilih kota Anda', cityBadge: 'Jadwal sholat', theme: 'Ganti antara terang dan gelap',
  },
} as unknown as Record<Lang, Words>
for (const k of NEW_CODES) W[k] = LOCALES[k].w

// Arabic, Urdu, Bengali and Turkish. The other local languages (Thai to Sinhala) are in search-pages-locales.ts.
Object.assign(W, {
  ar: {
    home: 'الرئيسية', crumb: 'مواقيت الصلاة', open: 'افتح التطبيق', play: 'حمّله من Google Play', nasar: 'صُنع ابتغاء وجه الله في سنغافورة بواسطة',
    title: (n: string) => `مواقيت الصلاة في ${n} اليوم | الفجر والظهر والعصر والمغرب والعشاء`,
    descPre: (n: string, d: string) => `مواقيت الصلاة في ${n} اليوم، ${d}.`, h1: (n: string) => `مواقيت الصلاة في ${n} اليوم`,
    stale: 'هذه المواقيت أقدم من شهر. افتح التطبيق لمعرفة مواقيت اليوم.', local: (p: string) => `جميع الأوقات بالتوقيت المحلي في ${p}.`,
    table: (a: string) => `الجدول الرسمي صادر عن ${a}. تُحسب الأوقات في هذه الصفحة بالطريقة نفسها وتقع ضمن دقيقتين تقريبًا منه، ولا تكون أبكر منه أبدًا. يعرض تطبيق Prayer Times Asia الجدول الرسمي نفسه عند اتصالك بالإنترنت.`,
    authority: (a: string) => `يتبع التطبيق ${a} ويحسب الأوقات بطريقة هذه الجهة نفسها.`,
    none: () => 'لا توجد جهة وطنية واحدة يستطيع التطبيق قراءة جدولها هنا، لذلك يستخدم ما تستخدمه أغلب المساجد.',
    faqH: (n: string) => `أسئلة عن مواقيت الصلاة في ${n}`, howH: 'كيف تُحسب هذه الأوقات', source: 'المصدر', methodLbl: 'الطريقة', placeLbl: 'المكان',
    moreAbout: 'اقرأ المزيد عن طريقة حساب الأوقات', caution: 'قد تختلف المساجد ببضع دقائق، لذا يُرجى اتباع الجهة الدينية المحلية.',
    ishaDeg: (n: number) => `${n} درجة`, ishaMin: (n: number) => `${n} دقيقة بعد المغرب`, shafii: 'الشافعي', hanafi: 'الحنفي',
    daysH: (n: string) => `مواقيت الصلاة في ${n} للثلاثين يومًا القادمة`, showDays: 'اعرض جدول 30 يومًا', dateCol: 'التاريخ', othersH: 'مدن أخرى', built: 'تاريخ بناء الصفحة',
    printH: 'اطبع هذا الجدول', printLead: (n: string) => `جداول شهرية وجدول رمضان لمدينة ${n}، جاهزة للطباعة أو الحفظ بصيغة PDF.`, btnMonthly: 'جدول للطباعة', btnRamadan: 'جدول رمضان',
    follow: 'اتبع دائمًا الجهة الدينية المحلية.', about: 'كيف نحسب الأوقات', sources: 'من أين تأتي أوقاتنا', privacy: 'الخصوصية', allCities: 'كل المدن',
    ptTitle: 'مواقيت الصلاة حسب المدينة | Prayer Times Asia', ptDesc: () => 'مواقيت الصلاة اليوم في مدن آسيا والعالم، مع شرح الطريقة والمصدر لكل مدينة.',
    ptH1: 'مواقيت الصلاة حسب المدينة', ptLead: 'اختر مدينة لترى مواقيت اليوم والأيام الثلاثين القادمة مع كتابة الطريقة والمصدر. لموقعك بالضبط افتح التطبيق المجاني.', ptFoot: 'يغطي التطبيق 143 دولة ويعمل بدون إنترنت.',
    prTitle: (n: string) => `جدول مواقيت الصلاة للطباعة في ${n} | شهري ورمضان`, prDesc: (n: string) => `جدول مواقيت الصلاة الشهري ورمضان للطباعة مجانًا في ${n}، مع المصدر والطريقة ومدة الصيام. اطبعه أو احفظه بصيغة PDF.`,
    prH1: (n: string) => `جدول مواقيت الصلاة للطباعة في ${n}`, prLead: (n: string) => `جداول شهرية وجدول رمضان مجانية لمدينة ${n}. اطبعها أو احفظها بصيغة PDF. يذكر كل جدول مصدر أوقاته. يُرجى اتباع الجهة الدينية المحلية.`,
    prSource: 'من أين تأتي هذه الأوقات', prMonthly: 'الجدول الشهري', prRamadan: 'جدول رمضان',
    prRamadanNote: (d: string, y: number) => `يُتوقع أن يبدأ رمضان ${y} نحو ${d}، بحسب تقويم أم القرى. تعلن الجهة المحلية بداية الشهر الفعلية، لذا يُرجى اتباعها.`,
    prFastNote: 'تُحسب مدة الصيام من الفجر إلى المغرب.', prPrint: 'اطبع هذه الصفحة', prApp: 'افتح التطبيق للطباعة لموقعك بالضبط',
    prAppNote: 'ليست مدينتك؟ يمكن للتطبيق المجاني طباعة جدول لموقعك بالضبط.', day: 'اليوم', fast: 'الصيام', back: 'العودة إلى صفحة المدينة', printBadge: 'للطباعة',
    hubTitle: 'جداول مواقيت الصلاة للطباعة حسب المدينة | Prayer Times Asia', hubDesc: () => 'جداول مواقيت الصلاة الشهرية ورمضان مجانية للطباعة، ومصدر كل جدول مكتوب عليه.',
    hubH1: 'جداول مواقيت الصلاة للطباعة', hubLead: 'جداول شهرية وجدول رمضان مجانية للطباعة أو الحفظ بصيغة PDF. يذكر كل جدول مصدر أوقاته. يُرجى اتباع الجهة الدينية المحلية.',
    pick: 'اختر مدينتك', cityBadge: 'مواقيت الصلاة', theme: 'التبديل بين الفاتح والداكن',
  },
  ur: {
    home: 'ہوم', crumb: 'نماز کے اوقات', open: 'ایپ کھولیں', play: 'Google Play سے حاصل کریں', nasar: 'فی سبیل اللہ سنگاپور میں بنایا گیا، از',
    title: (n: string) => `${n} میں آج نماز کے اوقات | فجر، ظہر، عصر، مغرب، عشاء`,
    descPre: (n: string, d: string) => `${n} میں آج نماز کے اوقات، ${d}۔`, h1: (n: string) => `${n} میں آج نماز کے اوقات`,
    stale: 'یہ اوقات ایک مہینے سے پرانے ہیں۔ آج کے اوقات کے لیے ایپ کھولیں۔', local: (p: string) => `تمام اوقات ${p} کے مقامی وقت کے مطابق ہیں۔`,
    table: (a: string) => `سرکاری جدول ${a} کی طرف سے آتا ہے۔ اس صفحے کے اوقات اسی طریقے سے نکالے گئے ہیں اور اس سے تقریباً 2 منٹ کے اندر رہتے ہیں، کبھی پہلے نہیں۔ آن لائن ہونے پر Prayer Times Asia ایپ خود سرکاری جدول دکھاتی ہے۔`,
    authority: (a: string) => `ایپ ${a} کی پیروی کرتی ہے اور اسی ادارے کے طریقے سے اوقات نکالتی ہے۔`,
    none: () => 'یہاں کوئی ایک قومی ادارہ نہیں جس کا جدول ایپ پڑھ سکے، اس لیے ایپ وہ طریقہ استعمال کرتی ہے جو زیادہ تر مساجد استعمال کرتی ہیں۔',
    faqH: (n: string) => `${n} میں نماز کے اوقات کے بارے میں سوالات`, howH: 'یہ اوقات کیسے نکالے جاتے ہیں', source: 'ماخذ', methodLbl: 'طریقہ', placeLbl: 'مقام',
    moreAbout: 'اوقات نکالنے کے طریقے کے بارے میں مزید پڑھیں', caution: 'مساجد میں چند منٹ کا فرق ہو سکتا ہے، اس لیے براہ کرم اپنے مقامی مذہبی ادارے کی پیروی کریں۔',
    ishaDeg: (n: number) => `${n} ڈگری`, ishaMin: (n: number) => `مغرب کے ${n} منٹ بعد`, shafii: 'شافعی', hanafi: 'حنفی',
    daysH: (n: string) => `${n} میں اگلے 30 دن کے نماز کے اوقات`, showDays: '30 دن کا جدول دکھائیں', dateCol: 'تاریخ', othersH: 'دوسرے شہر', built: 'صفحہ تیار ہونے کی تاریخ',
    printH: 'یہ جدول پرنٹ کریں', printLead: (n: string) => `${n} کے ماہانہ اور رمضان کے جدول، پرنٹ یا PDF محفوظ کرنے کے لیے تیار۔`, btnMonthly: 'پرنٹ کا جدول', btnRamadan: 'رمضان کا جدول',
    follow: 'ہمیشہ اپنے مقامی مذہبی ادارے کی پیروی کریں۔', about: 'ہم اوقات کیسے نکالتے ہیں', sources: 'ہمارے اوقات کہاں سے آتے ہیں', privacy: 'پرائیویسی', allCities: 'تمام شہر',
    ptTitle: 'شہر کے مطابق نماز کے اوقات | Prayer Times Asia', ptDesc: () => 'ایشیا اور دنیا کے شہروں میں آج کے نماز کے اوقات، ہر شہر کے لیے طریقہ اور ماخذ کی وضاحت کے ساتھ۔',
    ptH1: 'شہر کے مطابق نماز کے اوقات', ptLead: 'آج اور اگلے 30 دن کے اوقات دیکھنے کے لیے شہر چنیں، طریقہ اور ماخذ لکھے ہوئے ہیں۔ اپنی درست جگہ کے لیے مفت ایپ کھولیں۔', ptFoot: 'ایپ 143 ممالک کا احاطہ کرتی ہے اور آف لائن بھی چلتی ہے۔',
    prTitle: (n: string) => `${n} میں پرنٹ کے لیے نماز کے اوقات کا جدول | ماہانہ اور رمضان`, prDesc: (n: string) => `${n} کے لیے مفت ماہانہ اور رمضان کے نماز کے جدول، ماخذ، طریقہ اور روزے کی مدت کے ساتھ۔ پرنٹ کریں یا PDF محفوظ کریں۔`,
    prH1: (n: string) => `${n} میں پرنٹ کے لیے نماز کے اوقات کا جدول`, prLead: (n: string) => `${n} کے لیے مفت ماہانہ اور رمضان کے جدول۔ پرنٹ کریں یا PDF محفوظ کریں۔ ہر جدول بتاتا ہے کہ اوقات کہاں سے آتے ہیں۔ براہ کرم اپنے مقامی مذہبی ادارے کی پیروی کریں۔`,
    prSource: 'یہ اوقات کہاں سے آتے ہیں', prMonthly: 'ماہانہ جدول', prRamadan: 'رمضان کا جدول',
    prRamadanNote: (d: string, y: number) => `رمضان ${y} کے تقریباً ${d} کو شروع ہونے کی توقع ہے، ام القریٰ کیلنڈر کے مطابق۔ اصل آغاز کا اعلان آپ کا مقامی ادارہ کرتا ہے، اس لیے اسی کی پیروی کریں۔`,
    prFastNote: 'روزے کی مدت فجر سے مغرب تک گنی جاتی ہے۔', prPrint: 'یہ صفحہ پرنٹ کریں', prApp: 'اپنی درست جگہ کے لیے پرنٹ کرنے ایپ کھولیں',
    prAppNote: 'آپ کا شہر نہیں؟ مفت ایپ آپ کی درست جگہ کا جدول پرنٹ کر سکتی ہے۔', day: 'دن', fast: 'روزہ', back: 'شہر کے صفحے پر واپس', printBadge: 'پرنٹ کے لیے',
    hubTitle: 'شہر کے مطابق پرنٹ کے لیے نماز کے جدول | Prayer Times Asia', hubDesc: () => 'مفت ماہانہ اور رمضان کے نماز کے جدول، ہر ایک پر اس کا ماخذ لکھا ہوا۔',
    hubH1: 'پرنٹ کے لیے نماز کے جدول', hubLead: 'مفت ماہانہ اور رمضان کے جدول جو پرنٹ یا PDF کیے جا سکتے ہیں۔ ہر جدول بتاتا ہے کہ اوقات کہاں سے آتے ہیں۔ براہ کرم اپنے مقامی مذہبی ادارے کی پیروی کریں۔',
    pick: 'اپنا شہر چنیں', cityBadge: 'نماز کے اوقات', theme: 'روشن اور تاریک کے درمیان تبدیل کریں',
  },
  bn: {
    home: 'হোম', crumb: 'নামাজের সময়', open: 'অ্যাপ খুলুন', play: 'Google Play থেকে নিন', nasar: 'ফি সাবিলিল্লাহ সিঙ্গাপুরে তৈরি, নির্মাতা',
    title: (n: string) => `${n}-এ আজকের নামাজের সময় | ফজর, জোহর, আসর, মাগরিব, এশা`,
    descPre: (n: string, d: string) => `${n}-এ আজকের নামাজের সময়, ${d}।`, h1: (n: string) => `${n}-এ আজকের নামাজের সময়`,
    stale: 'এই সময়সূচি এক মাসের বেশি পুরনো। আজকের সময়ের জন্য অ্যাপ খুলুন।', local: (p: string) => `সব সময় ${p}-এর স্থানীয় সময়।`,
    table: (a: string) => `সরকারি সময়সূচি এসেছে ${a} থেকে। এই পাতার সময় একই পদ্ধতিতে হিসাব করা এবং এর থেকে প্রায় 2 মিনিটের মধ্যে থাকে, কখনও আগে নয়। অনলাইনে থাকলে Prayer Times Asia অ্যাপ নিজেই সরকারি সময়সূচি দেখায়।`,
    authority: (a: string) => `অ্যাপ ${a} অনুসরণ করে এবং সেই প্রতিষ্ঠানের নিজস্ব পদ্ধতিতে সময় হিসাব করে।`,
    none: () => 'এখানে এমন কোনো একক জাতীয় কর্তৃপক্ষ নেই যার সময়সূচি অ্যাপ পড়তে পারে, তাই অ্যাপ বেশির ভাগ মসজিদ যা ব্যবহার করে তা ব্যবহার করে।',
    faqH: (n: string) => `${n}-এ নামাজের সময় নিয়ে প্রশ্ন`, howH: 'এই সময় কীভাবে হিসাব করা হয়', source: 'উৎস', methodLbl: 'পদ্ধতি', placeLbl: 'স্থান',
    moreAbout: 'আমরা কীভাবে সময় হিসাব করি তা আরও পড়ুন', caution: 'মসজিদে কয়েক মিনিটের তফাত হতে পারে, তাই অনুগ্রহ করে আপনার স্থানীয় ধর্মীয় কর্তৃপক্ষকে অনুসরণ করুন।',
    ishaDeg: (n: number) => `${n} ডিগ্রি`, ishaMin: (n: number) => `মাগরিবের ${n} মিনিট পরে`, shafii: 'শাফেয়ি', hanafi: 'হানাফি',
    daysH: (n: string) => `${n}-এ আগামী 30 দিনের নামাজের সময়`, showDays: '30 দিনের সময়সূচি দেখান', dateCol: 'তারিখ', othersH: 'অন্যান্য শহর', built: 'পাতা তৈরির তারিখ',
    printH: 'এই সময়সূচি ছাপুন', printLead: (n: string) => `${n}-এর মাসিক ও রমজানের সময়সূচি, ছাপার বা PDF করার জন্য প্রস্তুত।`, btnMonthly: 'ছাপার সময়সূচি', btnRamadan: 'রমজানের সময়সূচি',
    follow: 'সবসময় আপনার স্থানীয় ধর্মীয় কর্তৃপক্ষকে অনুসরণ করুন।', about: 'আমরা কীভাবে সময় হিসাব করি', sources: 'আমাদের সময় কোথা থেকে আসে', privacy: 'গোপনীয়তা', allCities: 'সব শহর',
    ptTitle: 'শহর অনুযায়ী নামাজের সময় | Prayer Times Asia', ptDesc: () => 'এশিয়া ও বিশ্বের শহরের আজকের নামাজের সময়, প্রতিটির পদ্ধতি ও উৎস ব্যাখ্যাসহ।',
    ptH1: 'শহর অনুযায়ী নামাজের সময়', ptLead: 'আজ ও আগামী 30 দিনের সময় দেখতে একটি শহর বেছে নিন, পদ্ধতি ও উৎস লেখা আছে। আপনার ঠিক জায়গার জন্য বিনামূল্যের অ্যাপ খুলুন।', ptFoot: 'অ্যাপটি 143টি দেশ জুড়ে এবং অফলাইনেও চলে।',
    prTitle: (n: string) => `${n}-এ ছাপার জন্য নামাজের সময়সূচি | মাসিক ও রমজান`, prDesc: (n: string) => `${n}-এর জন্য বিনামূল্যে ছাপার উপযোগী মাসিক ও রমজানের নামাজের সময়সূচি, উৎস, পদ্ধতি ও রোজার দৈর্ঘ্যসহ। ছাপুন বা PDF করে রাখুন।`,
    prH1: (n: string) => `${n}-এ ছাপার জন্য নামাজের সময়সূচি`, prLead: (n: string) => `${n}-এর জন্য বিনামূল্যে মাসিক ও রমজানের সময়সূচি। ছাপুন বা PDF করে রাখুন। প্রতিটি সময়সূচি বলে দেয় সময়গুলো কোথা থেকে এসেছে। অনুগ্রহ করে আপনার স্থানীয় ধর্মীয় কর্তৃপক্ষকে অনুসরণ করুন।`,
    prSource: 'এই সময়গুলো কোথা থেকে এসেছে', prMonthly: 'মাসিক সময়সূচি', prRamadan: 'রমজানের সময়সূচি',
    prRamadanNote: (d: string, y: number) => `রমজান ${y} আনুমানিক ${d} নাগাদ শুরু হবে বলে ধরা হচ্ছে, উম্মুল কুরা ক্যালেন্ডার অনুযায়ী। আসল শুরুর ঘোষণা আপনার স্থানীয় কর্তৃপক্ষ দেয়, তাই তাদের অনুসরণ করুন।`,
    prFastNote: 'রোজার দৈর্ঘ্য ফজর থেকে মাগরিব পর্যন্ত গোনা হয়।', prPrint: 'এই পাতা ছাপুন', prApp: 'আপনার ঠিক জায়গার জন্য ছাপতে অ্যাপ খুলুন',
    prAppNote: 'আপনার শহর নয়? বিনামূল্যের অ্যাপ আপনার ঠিক জায়গার সময়সূচি ছাপতে পারে।', day: 'দিন', fast: 'রোজা', back: 'শহরের পাতায় ফিরে যান', printBadge: 'ছাপার জন্য',
    hubTitle: 'শহর অনুযায়ী ছাপার জন্য নামাজের সময়সূচি | Prayer Times Asia', hubDesc: () => 'বিনামূল্যে মাসিক ও রমজানের ছাপার উপযোগী নামাজের সময়সূচি, প্রতিটিতে উৎস লেখা।',
    hubH1: 'ছাপার জন্য নামাজের সময়সূচি', hubLead: 'বিনামূল্যে মাসিক ও রমজানের সময়সূচি যা ছাপা বা PDF করা যায়। প্রতিটি সময়সূচি বলে দেয় সময়গুলো কোথা থেকে এসেছে। অনুগ্রহ করে আপনার স্থানীয় ধর্মীয় কর্তৃপক্ষকে অনুসরণ করুন।',
    pick: 'আপনার শহর বেছে নিন', cityBadge: 'নামাজের সময়', theme: 'হালকা ও গাঢ়ের মধ্যে বদলান',
  },
  tr: {
    home: 'Ana sayfa', crumb: 'Namaz vakitleri', open: 'Uygulamayı aç', play: "Google Play'den indir", nasar: 'Singapur’da Allah rızası için yapıldı, yapımcı',
    title: (n: string) => `${n} bugün namaz vakitleri | Sabah, Öğle, İkindi, Akşam, Yatsı`,
    descPre: (n: string, d: string) => `${n} bugün namaz vakitleri, ${d}.`, h1: (n: string) => `${n} bugün namaz vakitleri`,
    stale: 'Bu vakitler bir aydan eski. Bugünün vakitleri için uygulamayı açın.', local: (p: string) => `Tüm saatler ${p} yerel saatidir.`,
    table: (a: string) => `Resmî vakit cetveli ${a} tarafından yayımlanır. Bu sayfadaki vakitler aynı yöntemle hesaplanır ve cetvelden yaklaşık 2 dakika içinde kalır, asla daha erken değildir. Prayer Times Asia uygulaması çevrimiçiyken resmî cetvelin kendisini gösterir.`,
    authority: (a: string) => `Uygulama ${a} kurumunu izler ve vakitleri o kurumun kendi yöntemiyle hesaplar.`,
    none: () => 'Burada uygulamanın okuyabileceği tek bir ulusal kurum yok, bu yüzden çoğu caminin kullandığı yöntemi kullanır.',
    faqH: (n: string) => `${n} namaz vakitleri hakkında sorular`, howH: 'Bu vakitler nasıl hesaplanır', source: 'Kaynak', methodLbl: 'Yöntem', placeLbl: 'Yer',
    moreAbout: 'Vakitleri nasıl hesapladığımız hakkında daha fazla okuyun', caution: 'Camiler arasında birkaç dakika fark olabilir, bu yüzden lütfen yerel dinî otoritenizi izleyin.',
    ishaDeg: (n: number) => `${n} derece`, ishaMin: (n: number) => `Akşamdan ${n} dakika sonra`, shafii: 'Şafii', hanafi: 'Hanefi',
    daysH: (n: string) => `${n} için önümüzdeki 30 günün namaz vakitleri`, showDays: '30 günlük cetveli göster', dateCol: 'Tarih', othersH: 'Diğer şehirler', built: 'Sayfa oluşturulma tarihi',
    printH: 'Bu cetveli yazdırın', printLead: (n: string) => `${n} için aylık ve Ramazan cetvelleri, yazdırmaya veya PDF olarak kaydetmeye hazır.`, btnMonthly: 'Yazdırılabilir cetvel', btnRamadan: 'Ramazan cetveli',
    follow: 'Her zaman yerel dinî otoritenizi izleyin.', about: 'Vakitleri nasıl hesaplıyoruz', sources: 'Vakitlerimiz nereden geliyor', privacy: 'Gizlilik', allCities: 'Tüm şehirler',
    ptTitle: 'Şehre göre namaz vakitleri | Prayer Times Asia', ptDesc: () => 'Asya ve dünyadaki şehirler için bugünün namaz vakitleri, her biri için yöntem ve kaynak açıklamasıyla.',
    ptH1: 'Şehre göre namaz vakitleri', ptLead: 'Bugünün ve önümüzdeki 30 günün vakitlerini görmek için bir şehir seçin, yöntem ve kaynak yazılıdır. Tam konumunuz için ücretsiz uygulamayı açın.', ptFoot: 'Uygulama 143 ülkeyi kapsar ve çevrimdışı çalışır.',
    prTitle: (n: string) => `${n} için yazdırılabilir namaz vakitleri | Aylık ve Ramazan`, prDesc: (n: string) => `${n} için ücretsiz yazdırılabilir aylık ve Ramazan namaz cetveli, kaynak, yöntem ve oruç süresiyle birlikte. Yazdırın veya PDF olarak kaydedin.`,
    prH1: (n: string) => `${n} için yazdırılabilir namaz cetveli`, prLead: (n: string) => `${n} için ücretsiz aylık ve Ramazan cetvelleri. Yazdırın veya PDF olarak kaydedin. Her cetvel vakitlerin nereden geldiğini söyler. Lütfen yerel dinî otoritenizi izleyin.`,
    prSource: 'Bu vakitler nereden geliyor', prMonthly: 'Aylık cetvel', prRamadan: 'Ramazan cetveli',
    prRamadanNote: (d: string, y: number) => `Ramazan ${y} yılının yaklaşık ${d} tarihinde başlaması bekleniyor, Ümmülkura takvimine göre. Gerçek başlangıcı yerel otoriteniz duyurur, bu yüzden onu izleyin.`,
    prFastNote: 'Oruç süresi sabah vaktinden akşam vaktine kadar sayılır.', prPrint: 'Bu sayfayı yazdır', prApp: 'Tam konumunuz için yazdırmak üzere uygulamayı açın',
    prAppNote: 'Şehriniz değil mi? Ücretsiz uygulama tam konumunuz için cetvel yazdırabilir.', day: 'Gün', fast: 'Oruç', back: 'Şehir sayfasına dön', printBadge: 'Yazdırılabilir',
    hubTitle: 'Şehre göre yazdırılabilir namaz cetvelleri | Prayer Times Asia', hubDesc: () => 'Ücretsiz yazdırılabilir aylık ve Ramazan namaz cetvelleri, her birinde kaynağı yazılı.',
    hubH1: 'Yazdırılabilir namaz cetvelleri', hubLead: 'Yazdırabileceğiniz veya PDF olarak kaydedebileceğiniz ücretsiz aylık ve Ramazan cetvelleri. Her cetvel vakitlerin nereden geldiğini söyler. Lütfen yerel dinî otoritenizi izleyin.',
    pick: 'Şehrinizi seçin', cityBadge: 'Namaz vakitleri', theme: 'Açık ve koyu arasında geçiş yap',
  },
})

/** The five questions on each city page, in each language. Plain sentences, no colons or dashes. */
function faqFor(c: City2, l: Lang, T: Record<Prayer, string>, official: string, ishaRule: string, asrName: string): [string, string][] {
  const n = cityName(c, l)
  const f = leadOf(c, 'fajr', l), m = leadOf(c, 'maghrib', l)
  const all = prayers.map((k) => `${nameOf(c, k, l)} ${T[k]}`)
  const AND = { en: ' and ', ms: ' dan ', id: ' dan ', ar: ' و', ur: ' اور ', bn: ' এবং ', tr: ' ve ' } as Record<Lang, string>
  const loc = l in LOCALES ? LOCALES[l as NewLang] : null
  const allTxt = loc ? all.slice(0, -1).join(loc.listSep === '' ? '、' : ', ') + loc.list + all[all.length - 1] : all.slice(0, -1).join(l === 'ar' ? '، ' : ', ') + AND[l] + all[all.length - 1]
  const dir = compass(c.qibla, l)
  if (loc) return loc.faq({ n, f, m, T, allTxt, methodName: c.methodName, fajr: c.fajr, ishaRule, asrName, official, qibla: c.qibla, dir })
  if (l === 'ms') return [
    [`Pukul berapa ${f} di ${n} hari ini?`, `${f} di ${n} hari ini pada ${T.fajr}. Syuruk pada ${T.sunrise}, maka waktu Subuh tamat ketika itu.`],
    [`Pukul berapa ${m} di ${n} hari ini?`, `${m} di ${n} hari ini pada ${T.maghrib}. Ini juga waktu berbuka puasa pada bulan Ramadan.`],
    [`Apakah semua waktu solat di ${n} hari ini?`, `${allTxt}. Semua waktu ialah waktu tempatan di ${n}.`],
    [`Apakah kaedah yang digunakan untuk waktu solat di ${n}?`, `${c.methodName}, dengan Subuh pada ${c.fajr} darjah dan Isyak pada ${ishaRule}. Asar menggunakan mazhab ${asrName}. ${official}`],
    [`Ke arah mana kiblat dari ${n}?`, `Kiblat dari ${n} kira-kira ${c.qibla} darjah mengikut arah jam dari utara, iaitu ke arah ${dir}. Aplikasi menunjukkannya terus pada telefon anda.`],
  ]
  if (l === 'id') return [
    [`Jam berapa Subuh di ${n} hari ini?`, `Subuh di ${n} hari ini pukul ${T.fajr}. Matahari terbit pukul ${T.sunrise}, jadi waktu Subuh berakhir saat itu.`],
    [`Jam berapa Maghrib di ${n} hari ini?`, `Maghrib di ${n} hari ini pukul ${T.maghrib}. Ini juga waktu berbuka puasa saat Ramadan.`],
    [`Apa saja waktu sholat di ${n} hari ini?`, `${allTxt}. Semua waktu adalah waktu setempat di ${n}.`],
    [`Metode apa yang dipakai untuk jadwal sholat di ${n}?`, `${c.methodName}, dengan Subuh pada ${c.fajr} derajat dan Isya pada ${ishaRule}. Ashar memakai mazhab ${asrName}. ${official}`],
    [`Ke arah mana kiblat dari ${n}?`, `Kiblat dari ${n} sekitar ${c.qibla} derajat searah jarum jam dari utara, yaitu ke arah ${dir}. Aplikasi menunjukkannya langsung di ponsel Anda.`],
  ]
  if (l === 'ar') return [
    [`ما موعد ${f} في ${n} اليوم؟`, `موعد ${f} في ${n} اليوم هو ${T.fajr}. تشرق الشمس في ${T.sunrise}، فينتهي وقت الفجر حينها.`],
    [`ما موعد ${m} في ${n} اليوم؟`, `موعد ${m} في ${n} اليوم هو ${T.maghrib}. وهو أيضًا وقت الإفطار في رمضان.`],
    [`ما هي أوقات الصلاة كلها في ${n} اليوم؟`, `${allTxt}. الأوقات بالتوقيت المحلي في ${n}.`],
    [`ما الطريقة المعتمدة لمواقيت الصلاة في ${n}؟`, `${c.methodName}، مع الفجر عند ${c.fajr} درجة والعشاء عند ${ishaRule}. يعتمد العصر المذهب ${asrName}. ${official}`],
    [`في أي اتجاه القبلة من ${n}؟`, `القبلة من ${n} نحو ${c.qibla} درجة باتجاه عقارب الساعة من الشمال، أي نحو ${dir}. يعرضها التطبيق مباشرة على هاتفك.`],
  ]
  if (l === 'ur') return [
    [`${n} میں آج ${f} کا وقت کیا ہے؟`, `${n} میں آج ${f} کا وقت ${T.fajr} ہے۔ طلوع آفتاب ${T.sunrise} پر ہوتا ہے، اس لیے ${f} کا وقت تب ختم ہو جاتا ہے۔`],
    [`${n} میں آج ${m} کا وقت کیا ہے؟`, `${n} میں آج ${m} کا وقت ${T.maghrib} ہے۔ رمضان میں یہی افطار کا وقت بھی ہے۔`],
    [`${n} میں آج نماز کے تمام اوقات کیا ہیں؟`, `${allTxt}۔ تمام اوقات ${n} کے مقامی وقت کے مطابق ہیں۔`],
    [`${n} میں نماز کے اوقات کس طریقے پر مبنی ہیں؟`, `${c.methodName}، فجر ${c.fajr} ڈگری اور عشاء ${ishaRule} پر۔ عصر ${asrName} مسلک کے مطابق ہے۔ ${official}`],
    [`${n} سے قبلہ کس طرف ہے؟`, `${n} سے قبلہ شمال سے گھڑی کی سمت میں تقریباً ${c.qibla} ڈگری پر ہے، یعنی ${dir} کی طرف۔ ایپ اسے آپ کے فون پر براہ راست دکھاتی ہے۔`],
  ]
  if (l === 'bn') return [
    [`${n}-এ আজ ${f}-এর সময় কখন?`, `${n}-এ আজ ${f}-এর সময় ${T.fajr}। সূর্যোদয় ${T.sunrise}-এ, তাই তখন ${f}-এর সময় শেষ হয়।`],
    [`${n}-এ আজ ${m}-এর সময় কখন?`, `${n}-এ আজ ${m}-এর সময় ${T.maghrib}। রমজানে এটিই ইফতারের সময়।`],
    [`${n}-এ আজ নামাজের সব সময় কী কী?`, `${allTxt}। সব সময় ${n}-এর স্থানীয় সময়।`],
    [`${n}-এ নামাজের সময় কোন পদ্ধতিতে হিসাব করা হয়?`, `${c.methodName}, ফজর ${c.fajr} ডিগ্রিতে এবং এশা ${ishaRule}। আসর ${asrName} মাযহাব অনুযায়ী। ${official}`],
    [`${n} থেকে কিবলা কোন দিকে?`, `${n} থেকে কিবলা উত্তর থেকে ঘড়ির কাঁটার দিকে প্রায় ${c.qibla} ডিগ্রিতে, অর্থাৎ ${dir} দিকে। অ্যাপ এটি আপনার ফোনে সরাসরি দেখায়।`],
  ]
  if (l === 'tr') return [
    [`${n} bugün ${f} vakti ne zaman?`, `${n} bugün ${f} vakti ${T.fajr}. Güneş ${T.sunrise} saatinde doğar, bu yüzden ${f} vakti o zaman biter.`],
    [`${n} bugün ${m} vakti ne zaman?`, `${n} bugün ${m} vakti ${T.maghrib}. Ramazan'da iftar vakti de budur.`],
    [`${n} bugün tüm namaz vakitleri nelerdir?`, `${allTxt}. Saatler ${n} yerel saatidir.`],
    [`${n} namaz vakitleri hangi yönteme dayanır?`, `${c.methodName}, sabah ${c.fajr} derece ve yatsı ${ishaRule}. İkindi ${asrName} mezhebine göre hesaplanır. ${official}`],
    [`${n} şehrinden kıble hangi yönde?`, `${n} şehrinden kıble kuzeyden saat yönünde yaklaşık ${c.qibla} derecedir, yani ${dir} yönüdür. Uygulama bunu telefonunuzda canlı gösterir.`],
  ]
  return [
    [`What time is ${f} in ${n} today?`, `${f} in ${n} today is at ${T.fajr}. Sunrise is at ${T.sunrise}, so ${f} ends then.`],
    [`What time is ${m} in ${n} today?`, `${m} in ${n} today is at ${T.maghrib}. This is also the time to break the fast during Ramadan.`],
    [`What are all the prayer times in ${n} today?`, `${allTxt}. Times are in local time for ${n}.`],
    [`Which method are the prayer times in ${n} based on?`, `${c.methodName}, with Fajr at ${c.fajr} degrees and Isha at ${ishaRule}. Asr uses the ${asrName} school. ${official}`],
    [`Which way is the qibla from ${n}?`, `The qibla from ${n} is about ${c.qibla} degrees clockwise from north, towards the ${dir}. The app shows it live on your phone.`],
  ]
}

/** A prayer name for running text: English pages use the English name, the others their own. */
const pname = (c: City2, k: Prayer, l: Lang) => (l === 'en' ? ENGLISH[k] : c.naming[l][k])

/** The authority's name in the page language (the profile text is English). */
const AUTH: [RegExp, Record<'ms' | 'id', string>][] = [
  [/^JAKIM/, { ms: 'JAKIM e-Solat, untuk zon negeri anda', id: 'JAKIM e-Solat, untuk zona negeri Anda' }],
  [/^Kemenag/, { ms: 'Kemenag, Kementerian Agama Indonesia', id: 'Kemenag, Kementerian Agama' }],
  [/^MUIS/, { ms: 'MUIS, Majlis Ugama Islam Singapura', id: 'MUIS, Majelis Ugama Islam Singapura' }],
  [/^the Ministry of Religious Affairs, Brunei/, { ms: 'Kementerian Hal Ehwal Ugama Brunei', id: 'Kementerian Urusan Agama Brunei' }],
  [/^Umm al-Qura/, { ms: 'Umm al-Qura, kalendar rasmi Arab Saudi yang diikuti Haramain di Makkah dan Madinah', id: 'Umm al-Qura, kalender resmi Arab Saudi yang diikuti Haramain di Makkah dan Madinah' }],
  [/^the UAE/, { ms: 'Pihak Berkuasa Am Hal Ehwal Islam dan Wakaf UAE', id: 'Otoritas Umum Urusan Islam dan Wakaf UEA' }],
  [/^Diyanet/, { ms: 'Diyanet, Presidensi Hal Ehwal Agama Turkiye', id: 'Diyanet, Kepresidenan Urusan Agama Turkiye' }],
]
const AUTH2: [RegExp, Partial<Record<Lang, string>>][] = [
  [/^Umm al-Qura/, { ar: 'أم القرى، التقويم الرسمي للمملكة العربية السعودية الذي يتبعه الحرمان في مكة والمدينة' }],
  [/^the UAE/, { ar: 'الهيئة العامة للشؤون الإسلامية والأوقاف في الإمارات' }],
  [/^Diyanet/, { tr: 'Diyanet, Türkiye Diyanet İşleri Başkanlığı' }],
]
const NO_AUTH = { en: 'Most masjids in the region', ms: 'Kebanyakan masjid di rantau ini', id: 'Kebanyakan masjid di kawasan ini', ar: 'أغلب المساجد في المنطقة', ur: 'خطے کی زیادہ تر مساجد', bn: 'এই অঞ্চলের বেশির ভাগ মসজিদ', tr: 'Bölgedeki çoğu cami', ...NO_AUTH_NEW } as Record<Lang, string>
const authName = (c: City2, l: Lang) => {
  if (l === 'en') return c.authority || NO_AUTH.en
  if (!c.authority) return NO_AUTH[l]
  return (l === 'ms' || l === 'id' ? AUTH.find(([re]) => re.test(c.authority))?.[1][l] : AUTH2.find(([re]) => re.test(c.authority))?.[1][l]) ?? c.authority
}

// ---- the look: the same tokens as the home page (night sky, rounded type, gold gradient, light mode) -----------------------
function shell(o: { title: string; desc: string; path: string; depth: number; body: string; ld: object[]; extra?: string; lang?: Lang; alts?: Partial<Record<Lang, string>> }): string {
  // (language switch below shows only the languages this page exists in)
  const l: Lang = o.lang ?? 'en'
  const w = W[l]
  const up = '../'.repeat(o.depth)
  const alts = o.alts
  return `<!doctype html>
<html lang="${hreflang(l)}"${RTL.includes(l) ? ' dir="rtl"' : ''}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0b0f2a" />
<meta name="color-scheme" content="dark light" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}" />
<link rel="canonical" href="${ORIGIN}/${o.path}" />
${alts ? ALL_LANGS.filter((x) => alts[x]).map((x) => `<link rel="alternate" hreflang="${hreflang(x)}" href="${ORIGIN}/${alts[x]}" />`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}/${alts.en}" />` : ''}
<link rel="icon" type="image/png" sizes="32x32" href="${up}img/favicon-32.png" />
<link rel="apple-touch-icon" href="${up}img/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Prayer Times Asia" />
<meta property="og:title" content="${esc(o.title)}" />
<meta property="og:description" content="${esc(o.desc)}" />
<meta property="og:url" content="${ORIGIN}/${o.path}" />
<meta property="og:image" content="${ORIGIN}/img/share.png" />
<meta name="twitter:card" content="summary_large_image" />
<style>${CSS}</style>
${THEME}
${o.ld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="${BASE}${HOME[l]}"><img src="${up}img/icon-96.webp" alt="" width="34" height="34" /><span class="bt">Prayer Times Asia</span></a>
<div class="tr">${alts ? `<nav class="langs" aria-label="Language">${ALL_LANGS.filter((x) => alts[x]).map((x) => `<a href="${BASE}${alts[x]}" hreflang="${hreflang(x)}" lang="${hreflang(x)}"${x === l ? ' aria-current="page"' : ''}>${NATIVE[x]}</a>`).join('')}</nav>` : ''}
<button class="mode" type="button" hidden aria-label="${esc(w.theme)}"></button><a class="btn sm" href="${BASE}app/">${esc(w.open)}</a></div></div></header>
<main class="wrap">
<div class="print-only printbrand"><img src="${up}img/icon-96.webp" alt="" width="28" height="28" /> Prayer Times Asia · prayertimes.asia</div>
${o.body}
</main>
<footer><div class="wrap"><div>${esc(w.follow)} <a href="${BASE}about.html">${esc(w.about)}</a> · <a href="${BASE}sources.html">${esc(w.sources)}</a> · <a href="${BASE}${BASE_DIR[l]}/">${esc(w.allCities)}</a> · <a href="${BASE}privacy.html">${esc(w.privacy)}</a></div>
<div>${esc(w.nasar)} <a href="https://nasardigital.com/">Nasar Digital</a></div></div></footer>
${TOGGLE}
${o.extra ?? ''}
</body>
</html>
`
}

const orgLd = {
  '@context': 'https://schema.org', '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'Prayer Times Asia', url: `${ORIGIN}/`,
  logo: `${ORIGIN}/img/icon-192.png`, email: 'salam@prayertimes.asia',
  founder: [{ '@type': 'Person', name: 'Ustaz Aarif Raziff' }, { '@type': 'Person', name: 'Ustazah Nasibah Hamzah' }],
  sameAs: [PLAY],
}
const siteLd = (l: Lang) => ({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${ORIGIN}/#site`, url: `${ORIGIN}/`, name: 'Prayer Times Asia', publisher: { '@id': `${ORIGIN}/#org` }, inLanguage: hreflang(l) })

// ---- data per city ------------------------------------------------------------------------------------------------------
interface Row { d: string; t: Record<Prayer, string> }
const rowsFor = (c: City2, l: Lang): Row[] => {
  const out: Row[] = []
  for (let i = 0; i < DAYS; i++) {
    const ms = now + i * 86400000
    const t = timesAt(c, ms)
    out.push({ d: isoDay(ms, c.tz), t: Object.fromEntries(prayers.map((k) => [k, clock(t[k], c.tz, l)])) as Record<Prayer, string> })
  }
  return out
}

/** Swaps in the visitor's day if the page was built on an earlier day. Nothing else on the page needs JavaScript. */
const dayScript = (c: City2, l: Lang, rows: Row[]) => `<script type="application/json" id="days">${JSON.stringify(rows)}</script>
<script>
(function(){try{
  var rows=JSON.parse(document.getElementById('days').textContent);
  var d=new Intl.DateTimeFormat('en-CA',{timeZone:${JSON.stringify(c.tz)}}).format(new Date());
  var i=-1;rows.forEach(function(r,n){if(r.d===d)i=n});
  if(i<0){document.querySelectorAll('[data-stale]').forEach(function(e){e.hidden=false});return}
  var r=rows[i];
  document.querySelectorAll('[data-t]').forEach(function(e){e.textContent=r.t[e.getAttribute('data-t')]});
  document.querySelectorAll('[data-date]').forEach(function(e){e.textContent=(function(){var f=new Intl.DateTimeFormat(${JSON.stringify(LOCALE[l])},{timeZone:${JSON.stringify(c.tz)},weekday:'long',day:'numeric',month:'long',year:'numeric'}),n=new Date();${l === 'si' ? `var M=${JSON.stringify(SI_MONTHS)},mi=Number(new Intl.DateTimeFormat('en-US',{timeZone:${JSON.stringify(c.tz)},month:'numeric'}).format(n))-1;return f.formatToParts(n).map(function(p){return p.type==='month'?M[mi]:p.value}).join('')` : 'return f.format(n)'}})()});
  document.querySelectorAll('tbody tr[data-d]').forEach(function(e){e.className=e.getAttribute('data-d')===d?'now':''});
}catch(e){}})();
</script>`

const alts = (langs: Lang[], f: (l: Lang) => string): Partial<Record<Lang, string>> => Object.fromEntries(langs.map((l) => [l, f(l)]))
const crumbs = (l: Lang, w: Words, last: string) => `<nav aria-label="Breadcrumb" class="date"><a href="${BASE}${HOME[l]}">${esc(w.home)}</a> / <a href="${BASE}${BASE_DIR[l]}/">${esc(w.crumb)}</a> / ${esc(last)}</nav>`
const placeOf = (c: City2, l: Lang) => { const n = cityName(c, l), cn = countryName(c.country, l); return n === cn ? n : `${n}, ${cn}` }

function cityPage(c: City2, l: Lang): string {
  const w = W[l]
  const n = cityName(c, l)
  const rows = rowsFor(c, l)
  const T = rows[0].t
  const ishaRule = c.isha != null ? w.ishaDeg(c.isha) : w.ishaMin(c.ishaInterval ?? 0)
  const asrName = c.asr === 'hanafi' ? w.hanafi : w.shafii
  const official = c.sourceKind === 'table' ? w.table(authName(c, l)) : c.sourceKind === 'authority' ? w.authority(authName(c, l)) : w.none(l === 'en' ? c.note : '')
  const span = (k: Prayer) => `<span data-t="${k}">${T[k]}</span>`
  const faq = faqFor(c, l, T, official, ishaRule, asrName)
  // The same answers with live spans, so the visitor-day script updates them too.
  const faqLive = faqFor(c, l, Object.fromEntries(prayers.map((k) => [k, `\u0001${k}\u0002`])) as Record<Prayer, string>, official, ishaRule, asrName)
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
  const pool = cities.filter((o) => inLang(o, l))
  const others = [...pool.filter((o) => o.country === c.country && o !== c), ...pool.filter((o) => o.country !== c.country)]
  const descParts = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => `${leadOf(c, k as Prayer, l)} ${T[k as Prayer]}`).join(', ')
  const body = `
<span class="eyebrow">${esc(w.cityBadge)}</span>
${crumbs(l, w, n)}
<h1>${esc(w.h1(n))}</h1>
<p class="date" data-date>${esc(longDate(now, c.tz, l))}</p>
<p class="lead" data-stale hidden>${esc(w.stale)}</p>
<ul class="times">
${prayers.map((k) => `  <li><b>${esc(nameOf(c, k, l))}</b><span data-t="${k}">${T[k]}</span></li>`).join('\n')}
</ul>
<p class="lead">${esc(w.local(placeOf(c, l)))} ${esc(official)}</p>
<div class="cta"><a class="btn" href="${BASE}app/">${esc(w.open)}</a><a class="btn o" href="${PLAY}">${esc(w.play)}</a></div>

<div class="card">
  <p><b>${esc(w.printH)}</b></p>
  <p>${esc(w.printLead(n))}</p>
  <a class="btn sm" href="${BASE}${printPath(l, c)}">${esc(w.btnMonthly)}</a> <a class="btn sm o" href="${BASE}${printPath(l, c)}#ramadan">${esc(w.btnRamadan)}</a>
</div>

<h2>${esc(w.faqH(n))}</h2>
<dl>
${faqLive.map(([q, a]) => `<dt>${esc(q).replace(/\u0001(\w+)\u0002/g, (_x, k) => span(k as Prayer))}</dt><dd>${esc(a).replace(/\u0001(\w+)\u0002/g, (_x, k) => span(k as Prayer))}</dd>`).join('\n')}
</dl>

<h2>${esc(w.howH)}</h2>
<div class="card">
  <p>${esc(w.source)} ${esc(authName(c, l))}</p>
  <p>${esc(w.methodLbl)} ${esc(c.methodName)}, ${esc(pname(c, 'fajr', l))} ${esc(w.ishaDeg(c.fajr))}, ${esc(pname(c, 'isha', l))} ${esc(ishaRule)}, ${esc(pname(c, 'asr', l))} ${esc(asrName)}</p>
  <p>${esc(w.placeLbl)} ${esc(n)}, ${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}, ${esc(c.tz)}</p>
  <p><a href="${BASE}about.html">${esc(w.moreAbout)}</a>. ${esc(w.caution)}</p>
</div>

<h2>${esc(w.daysH(n))}</h2>
<details>
<summary>${esc(w.showDays)}</summary>
<div class="scroll"><table><thead><tr><th>${esc(w.dateCol)}</th>${prayers.map((k) => `<th>${esc(leadOf(c, k, l))}</th>`).join('')}</tr></thead><tbody>
${rows.map((r, i) => `<tr data-d="${r.d}"${i === 0 ? ' class="now"' : ''}><td>${r.d}</td>${prayers.map((k) => `<td>${r.t[k]}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></div>
</details>

<h2>${esc(w.othersH)}</h2>
<ul class="links">
${others.map((o) => `  <li><a href="${BASE}${cityPath(l, o)}">${esc(cityName(o, l))}</a></li>`).join('\n')}
</ul>
<p class="date">${esc(w.built)} ${BUILT}.</p>`
  return shell({
    lang: l, title: w.title(n), desc: `${w.descPre(n, longDate(now, c.tz, l))} ${descParts}.`, path: cityPath(l, c), depth: cityPath(l, c).split('/').length - 1, body,
    extra: dayScript(c, l, rows), alts: alts(langsFor(c), (x) => cityPath(x, c)),
    ld: [orgLd, siteLd(l), faqLd, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [[w.home, `${ORIGIN}/${HOME[l]}`], [w.crumb, `${ORIGIN}/${BASE_DIR[l]}/`], [n, `${ORIGIN}/${cityPath(l, c)}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
    }],
  })
}

// ---- printable timetables ---------------------------------------------------------------------------------------------------
/** The first day of the next Ramadan from today, by the Umm al-Qura calendar (the local announcement decides). */
function ramadanFrom(c: City2): number[] {
  let ms = now
  const month = (x: number) => hijriDate(x, c.tz, 0).month
  while (month(ms) === 9) ms -= 86400000
  for (let i = 0; i < 400 && month(ms) !== 9; i++) ms += 86400000
  const out: number[] = []
  while (month(ms) === 9 && out.length < 30) { out.push(ms); ms += 86400000 }
  return out
}
/** Noon-ish moments for every day of a calendar month in the city's zone. */
function monthMoments(c: City2, offset: number): number[] {
  const z = zoned(now, c.tz)
  const first = Date.UTC(z.year, z.month - 1 + offset, 1, 12)
  const out: number[] = []
  const m0 = new Date(first).getUTCMonth()
  for (let ms = first; new Date(ms).getUTCMonth() === m0; ms += 86400000) out.push(ms)
  return out
}

function printablePage(c: City2, l: Lang): string {
  const w = W[l]
  const n = cityName(c, l)
  const official = c.sourceKind === 'table' ? w.table(authName(c, l)) : c.sourceKind === 'authority' ? w.authority(authName(c, l)) : w.none(l === 'en' ? c.note : '')
  const ishaRule = c.isha != null ? w.ishaDeg(c.isha) : w.ishaMin(c.ishaInterval ?? 0)
  const head = `<tr><th>${esc(w.dateCol)}</th>${prayers.map((k) => `<th>${esc(leadOf(c, k, l))}</th>`).join('')}</tr>`
  const month = (offset: number) => {
    const days = monthMoments(c, offset)
    return `<h2>${esc(w.prMonthly)} ${esc(fmtDate(days[0], c.tz, l, { month: 'long', year: 'numeric' }))}</h2>
<div class="scroll"><table><thead>${head}</thead><tbody>
${days.map((ms) => { const t = timesAt(c, ms); return `<tr><td>${esc(fmtDate(ms, c.tz, l, { weekday: 'short', day: 'numeric', month: 'short' }))}</td>${prayers.map((k) => `<td>${clock(t[k], c.tz, l)}</td>`).join('')}</tr>` }).join('\n')}
</tbody></table></div>`
  }
  const ram = ramadanFrom(c)
  const ramYear = ram.length ? hijriDate(ram[0], c.tz, 0).year : 0
  const ramTable = ram.length ? `<h2 id="ramadan">${esc(w.prRamadan)} ${ramYear}</h2>
<p class="lead">${esc(w.prRamadanNote(fmtDate(ram[0], c.tz, l, { day: 'numeric', month: 'long', year: 'numeric' }), ramYear))}</p>
<div class="scroll"><table><thead><tr><th>${esc(w.day)}</th><th>${esc(w.dateCol)}</th>${prayers.map((k) => `<th>${esc(leadOf(c, k, l))}</th>`).join('')}<th>${esc(w.fast)}</th></tr></thead><tbody>
${ram.map((ms, i) => { const t = timesAt(c, ms); return `<tr><td>${i + 1}</td><td>${esc(fmtDate(ms, c.tz, l, { weekday: 'short', day: 'numeric', month: 'short' }))}</td>${prayers.map((k) => `<td>${clock(t[k], c.tz, l)}</td>`).join('')}<td>${fastLen(t.fajr, t.maghrib, l)}</td>` + '</tr>' }).join('\n')}
</tbody></table></div>
<p class="date">${esc(w.prFastNote)}</p>` : ''
  const body = `
<span class="eyebrow">${esc(w.printBadge)}</span>
${crumbs(l, w, n)}
<h1>${esc(w.prH1(n))}</h1>
<p class="lead">${esc(w.prLead(n))}</p>
<div class="cta noprint"><button class="btn" type="button" onclick="window.print()">${esc(w.prPrint)}</button><a class="btn o" href="${BASE}app/print/">${esc(w.prApp)}</a></div>
<div class="card">
  <p><b>${esc(w.prSource)}</b></p>
  <p>${esc(official)}</p>
  <p>${esc(w.methodLbl)} ${esc(c.methodName)}, ${esc(ishaRule)}. ${esc(w.caution)}</p>
</div>
${month(0)}
${month(1)}
${ramTable}
<p class="lead noprint">${esc(w.prAppNote)}</p>
<p class="noprint"><a href="${BASE}${cityPath(l, c)}">${esc(w.back)}</a></p>
<p class="print-only">prayertimes.asia ${esc(w.follow)}</p>
<p class="date">${esc(w.built)} ${BUILT}.</p>`
  return shell({
    lang: l, title: w.prTitle(n), desc: w.prDesc(n), path: printPath(l, c), depth: printPath(l, c).split('/').length - 1, body, alts: alts(langsFor(c), (x) => printPath(x, c)),
    ld: [orgLd, siteLd(l), { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[w.home, `${ORIGIN}/${HOME[l]}`], [w.printBadge, `${ORIGIN}/${PRINT_DIR[l]}/`], [n, `${ORIGIN}/${printPath(l, c)}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) }],
  })
}

// ---- write the pages ----------------------------------------------------------------------------------------------------------
const listLangs = (_l: Lang): Lang[] => ALL_LANGS.filter((x) => cities.some((c) => inLang(c, x)))
const byCountry = (l: Lang, link: (c: City2) => string) => [...new Set(cities.filter((c) => inLang(c, l)).map((c) => c.country))].map((cc) => `<h2>${esc(countryName(cc, l))}</h2>
<ul class="links">${cities.filter((c) => c.country === cc && inLang(c, l)).map((c) => `<li><a href="${BASE}${link(c)}">${esc(cityName(c, l))}</a></li>`).join('')}</ul>`).join('\n')

for (const l of ALL_LANGS) {
  const w = W[l]
  const here = cities.filter((c) => inLang(c, l))
  for (const c of here) {
    write(`${cityPath(l, c)}index.html`, cityPage(c, l))
    write(`${printPath(l, c)}index.html`, printablePage(c, l))
  }
  write(`${BASE_DIR[l]}/index.html`, shell({
    lang: l, title: w.ptTitle, desc: w.ptDesc(here.length), path: `${BASE_DIR[l]}/`, depth: BASE_DIR[l].split('/').length, alts: alts(listLangs(l), (x) => `${BASE_DIR[x]}/`),
    ld: [orgLd, siteLd(l), { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: here.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: cityName(c, l), url: `${ORIGIN}/${cityPath(l, c)}` })) }],
    body: `
<h1>${esc(w.ptH1)}</h1>
<p class="lead">${esc(w.ptLead)}</p>
<div class="cta"><a class="btn" href="${BASE}app/">${esc(w.open)}</a><a class="btn o" href="${PLAY}">${esc(w.play)}</a><a class="btn o" href="${BASE}${PRINT_DIR[l]}/">${esc(w.hubH1)}</a></div>
${byCountry(l, (c) => cityPath(l, c))}
<p class="date">${esc(w.ptFoot)}</p>`,
  }))
  write(`${PRINT_DIR[l]}/index.html`, shell({
    lang: l, title: w.hubTitle, desc: w.hubDesc(here.length), path: `${PRINT_DIR[l]}/`, depth: PRINT_DIR[l].split('/').length, alts: alts(listLangs(l), (x) => `${PRINT_DIR[x]}/`),
    ld: [orgLd, siteLd(l)],
    body: `
<span class="eyebrow">${esc(w.printBadge)}</span>
<h1>${esc(w.hubH1)}</h1>
<p class="lead">${esc(w.hubLead)}</p>
<div class="cta"><a class="btn" href="${BASE}app/print/">${esc(w.prApp)}</a></div>
<h2>${esc(w.pick)}</h2>
${byCountry(l, (c) => printPath(l, c))}`,
  }))
}

// About and method
const methodRows = ALL_METHODS.map((m) => `<tr><td>${esc(m.name.replace(' · ', ', '))}</td><td>${m.fajrAngle}</td><td>${m.ishaAngle != null ? m.ishaAngle : (m.ishaInterval ?? 0) + ' min after Maghrib'}</td></tr>`).join('\n')
write('about.html', shell({
  title: 'About Prayer Times Asia and how we work out prayer times',
  desc: 'Who makes Prayer Times Asia, which authorities and calculation methods the times follow, and why you should always follow your local religious authority.',
  path: 'about.html', depth: 0,
  ld: [orgLd, siteLd('en'), { '@context': 'https://schema.org', '@type': 'AboutPage', url: `${ORIGIN}/about.html`, name: 'About Prayer Times Asia', about: { '@id': `${ORIGIN}/#org` } }],
  body: `
<h1>About Prayer Times Asia and how we work out the times</h1>
<p class="lead">Prayer Times Asia is a free prayer times and qibla app for Muslims in Asia and everywhere else. It has no outside ads, no account and no tracking. It was built by Ustaz Aarif Raziff and Ustazah Nasibah Hamzah with Nasar Digital after a family trip where none of their prayer apps worked.</p>

<h2>Our rule, your local authority first</h2>
<p>Where a country's religious authority publishes a timetable, the app shows that timetable. Where an authority publishes its method but not a timetable the app can read, the app works out the times the same way the authority does. Only where there is no national authority does the app use the method most masjids there use, and it tells you so. The full list for every country is on <a href="${BASE}sources.html">Where our times come from</a>.</p>
<ul>
<li>Singapore follows MUIS, the Islamic Religious Council of Singapore.</li>
<li>Malaysia follows JAKIM e-Solat for your state zone.</li>
<li>Indonesia follows Kemenag, the Ministry of Religious Affairs.</li>
<li>Brunei follows the Ministry of Religious Affairs, Brunei.</li>
</ul>

<h2>How the calculation works</h2>
<p>The app works out where the sun is for your exact spot, then finds the moment it reaches the angle each authority uses for Fajr and Isha. Asr is when the shadow of an object grows to one length (Shafi'i, Maliki, Hanbali) or two lengths (Hanafi) of the object plus its noon shadow. Maghrib is at sunset. We round up to the next minute and add the small precaution minutes each authority uses, so a time is never earlier than the official one. We checked the offline results against the full official 2026 timetables for Singapore, Malaysia and Indonesia, and they sit within about 2 minutes, never earlier.</p>
<div class="scroll"><table><thead><tr><th>Method</th><th>Fajr angle</th><th>Isha angle</th></tr></thead><tbody>
${methodRows}
</tbody></table></div>

<h2>Please check with your masjid</h2>
<p>Prayer times can differ by a few minutes between authorities and masjids. Prayer Times Asia is a helper and not a replacement for your local religious authority or your masjid. When they differ, follow them.</p>

<h2>Prayer times by city</h2>
<p><a href="${BASE}prayer-times/">See today's times for ${cities.length} cities</a>, each with its method and source written out.</p>
<div class="cta"><a href="${BASE}app/">Open the web app</a><a href="${PLAY}">Get it on Google Play</a></div>
<p>Questions or corrections are welcome at <a href="mailto:salam@prayertimes.asia">salam@prayertimes.asia</a>.</p>`,
}))

// robots and sitemap
write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`)

const has = (p: string) => existsSync(join(siteDir, p))
const homeLangs = ['', 'ms/', 'id/', 'ar/', 'ur/', 'bn/', 'tr/', 'fr/'].filter((p) => has(p === '' ? 'index.html' : `${p}index.html`))
const homeAlt = homeLangs.map((h) => `<xhtml:link rel="alternate" hreflang="${h === '' ? 'en' : h.replace('/', '')}" href="${ORIGIN}/${h}"/>`).join('')
const altOf = (langs: Lang[], f: (l: Lang) => string) => langs.map((l) => `<xhtml:link rel="alternate" hreflang="${hreflang(l)}" href="${ORIGIN}/${f(l)}"/>`).join('')
const plain = ['about.html', 'sources.html', 'whatsnew.html', 'credits.html', 'ms/credits.html', 'id/credits.html', 'press.html', 'ramadan.html', 'privacy.html', 'terms.html', 'join.html', 'masjid.html', 'journey-planner/', 'ms/perancang-perjalanan/', 'id/perencana-perjalanan/', 'app/']
  .filter((p) => (p.endsWith('/') ? has(`${p}index.html`) : has(p)))
const entries: string[] = [
  ...homeLangs.map((h) => `<url><loc>${ORIGIN}/${h}</loc><lastmod>${BUILT}</lastmod>${homeAlt}</url>`),
  ...plain.map((p) => `<url><loc>${ORIGIN}/${p}</loc><lastmod>${BUILT}</lastmod></url>`),
  ...ALL_LANGS.map((l) => `<url><loc>${ORIGIN}/${BASE_DIR[l]}/</loc><lastmod>${BUILT}</lastmod>${altOf(ALL_LANGS, (x) => `${BASE_DIR[x]}/`)}</url>`),
  ...ALL_LANGS.map((l) => `<url><loc>${ORIGIN}/${PRINT_DIR[l]}/</loc><lastmod>${BUILT}</lastmod>${altOf(ALL_LANGS, (x) => `${PRINT_DIR[x]}/`)}</url>`),
  ...cities.flatMap((c) => langsFor(c).flatMap((l) => [
    `<url><loc>${ORIGIN}/${cityPath(l, c)}</loc><lastmod>${BUILT}</lastmod>${altOf(langsFor(c), (x) => cityPath(x, c))}</url>`,
    `<url><loc>${ORIGIN}/${printPath(l, c)}</loc><lastmod>${BUILT}</lastmod>${altOf(langsFor(c), (x) => printPath(x, c))}</url>`,
  ])),
]
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`)
console.log(`Search pages built: ${cities.length} cities in English and local languages, printable timetables, about, sitemap with ${entries.length} addresses`)
