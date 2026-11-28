/**
 * Builds the pages search engines and AI answer tools read, from the SAME prayer
 * engine and country table the apps use, so a page can never disagree with the app.
 *
 *   cd web && npx vite-node scripts/build-search-pages.ts -- <siteDir> <base>
 *
 *   <siteDir>  the assembled website folder (_site). Pages are written into it.
 *   <base>     "/" on the custom domain, "/PrayerTimesAsia/" on github.io.
 *
 * Writes, in English, Malay and Indonesian, a list page and one page per city
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

const argv = process.argv.slice(2).filter((a) => a !== '--')
const [siteDir, baseArg = '/'] = argv
if (!siteDir) throw new Error('usage: build-search-pages.ts <siteDir> <base>')
const BASE = baseArg.endsWith('/') ? baseArg : baseArg + '/'
const DAYS = 30
const ORIGIN = 'https://prayertimes.asia'
const PLAY = 'https://play.google.com/store/apps/details?id=com.prayertimesasia.app'
type Lang = 'en' | 'ms' | 'id'
const LANGS: Lang[] = ['en', 'ms', 'id']

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
    naming: { en: NAMES[profile.naming], ms: NAMES.malay, id: NAMES.indonesian },
    qibla: Math.round(qiblaBearing(p.coordinates)), coords: p.coordinates, method, asr: profile.asr,
  }
})

type Times = Record<Prayer, number>
const timesAt = (c: City2, ms: number): Times => computeFor(ms, c.tz, c.coords, c.method, c.asr).times as Times

// ---- language bits -----------------------------------------------------------------------------------------------------
const LOCALE: Record<Lang, string> = { en: 'en-GB', ms: 'ms-MY', id: 'id-ID' }
const BASE_DIR: Record<Lang, string> = { en: 'prayer-times', ms: 'ms/waktu-solat', id: 'id/jadwal-sholat' }
const PRINT_DIR: Record<Lang, string> = { en: 'printable-timetables', ms: 'ms/jadual-cetak', id: 'id/jadwal-cetak' }
const HOME: Record<Lang, string> = { en: '', ms: 'ms/', id: 'id/' }
const cityPath = (l: Lang, c: City2) => `${BASE_DIR[l]}/${c.slug}/`
const printPath = (l: Lang, c: City2) => `${PRINT_DIR[l]}/${c.slug}/`
const cityName = (c: City2, l: Lang) => (c.slug === 'penang' && l !== 'en' ? 'Pulau Pinang' : c.name)
const countryName = (cc: string, l: Lang) => {
  try { return new Intl.DisplayNames([LOCALE[l]], { type: 'region' }).of(cc) ?? cc } catch { return cc }
}
const compassWords: Record<Lang, string[]> = {
  en: ['north', 'north east', 'east', 'south east', 'south', 'south west', 'west', 'north west'],
  ms: ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'],
  id: ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'],
}
const compass = (deg: number, l: Lang) => compassWords[l][Math.round(deg / 45) % 8]

/** The clock the way people write it there. English and Malay use 12 hours, Indonesian uses 24 hours. */
function clock(ms: number, tz: string, l: Lang): string {
  const z = zoned(ms, tz)
  const mm = String(z.minute).padStart(2, '0')
  if (l === 'id') return `${String(z.hour).padStart(2, '0')}.${mm}`
  const h12 = z.hour % 12 === 0 ? 12 : z.hour % 12
  if (l === 'en') return `${h12}:${mm} ${z.hour < 12 ? 'am' : 'pm'}`
  const part = z.hour < 12 ? 'pg' : z.hour < 15 ? 'tgh' : z.hour < 19 ? 'ptg' : 'mlm'
  return `${h12}:${mm} ${part}`
}
const isoDay = (ms: number, tz: string) => { const z = zoned(ms, tz); return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}` }
const fmtDate = (ms: number, tz: string, l: Lang, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE[l], { timeZone: tz, ...o }).format(ms)
const longDate = (ms: number, tz: string, l: Lang) => fmtDate(ms, tz, l, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fastLen = (a: number, b: number, l: Lang) => { const m = Math.round((b - a) / 60000); return `${Math.floor(m / 60)}${l === 'en' ? ' h ' : ' j '}${m % 60} m` }

const ENGLISH: Record<Prayer, string> = NAMES.arabic
const prayers: Prayer[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
/** English pages show the local name next to the English one. */
const nameOf = (c: City2, k: Prayer, l: Lang) => (l === 'en' ? (c.naming.en[k] === ENGLISH[k] ? ENGLISH[k] : `${ENGLISH[k]} (${c.naming.en[k]})`) : c.naming[l][k])
const leadOf = (c: City2, k: Prayer, l: Lang) => c.naming[l][k]

// ---- words. English first, Malay and Indonesian after. No colons or dashes in sentences (owner rule). ----------------------
interface Words {
  home: string; crumb: string; open: string; play: string; nasar: string
  title(n: string): string; descPre(n: string, d: string): string; h1(n: string): string
  stale: string; local(p: string): string; table(a: string): string; authority(a: string): string; none(note: string): string
  faqH(n: string): string; howH: string; source: string; methodLbl: string; placeLbl: string; moreAbout: string; caution: string
  ishaDeg(n: number): string; ishaMin(n: number): string; shafii: string; hanafi: string
  daysH(n: string): string; showDays: string; dateCol: string; othersH: string; built: string
  printH: string; printLead(n: string): string; btnMonthly: string; btnRamadan: string
  follow: string; about: string; sources: string; privacy: string; allCities: string
  ptTitle: string; ptDesc(n: number): string; ptH1: string; ptLead: string; ptFoot: string
  prTitle(n: string): string; prDesc(n: string): string; prH1(n: string): string; prLead(n: string): string
  prSource: string; prMonthly: string; prRamadan: string; prRamadanNote(d: string, y: number): string; prFastNote: string
  prPrint: string; prApp: string; prAppNote: string; day: string; fast: string; back: string; printBadge: string
  hubTitle: string; hubDesc(n: number): string; hubH1: string; hubLead: string; pick: string; cityBadge: string; theme: string
}
const W: Record<Lang, Words> = {
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
}

/** The five questions on each city page, in each language. Plain sentences, no colons or dashes. */
function faqFor(c: City2, l: Lang, T: Record<Prayer, string>, official: string, ishaRule: string, asrName: string): [string, string][] {
  const n = cityName(c, l)
  const f = leadOf(c, 'fajr', l), m = leadOf(c, 'maghrib', l)
  const all = prayers.map((k) => `${nameOf(c, k, l)} ${T[k]}`)
  const allTxt = all.slice(0, -1).join(', ') + (l === 'en' ? ' and ' : l === 'ms' ? ' dan ' : ' dan ') + all[all.length - 1]
  const dir = compass(c.qibla, l)
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
  return [
    [`What time is ${f} in ${n} today?`, `${f} in ${n} today is at ${T.fajr}. Sunrise is at ${T.sunrise}, so ${f} ends then.`],
    [`What time is ${m} in ${n} today?`, `${m} in ${n} today is at ${T.maghrib}. This is also the time to break the fast during Ramadan.`],
    [`What are all the prayer times in ${n} today?`, `${allTxt}. Times are in local time for ${n}.`],
    [`Which method are the prayer times in ${n} based on?`, `${c.methodName}, with Fajr at ${c.fajr} degrees and Isha at ${ishaRule}. Asr uses the ${asrName} school. ${official}`],
    [`Which way is the qibla from ${n}?`, `The qibla from ${n} is about ${c.qibla} degrees clockwise from north, towards the ${dir}. The app shows it live on your phone.`],
  ]
}

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
const authName = (c: City2, l: Lang) => {
  if (l === 'en') return c.authority || 'Most masjids in the region'
  if (!c.authority) return l === 'ms' ? 'Kebanyakan masjid di rantau ini' : 'Kebanyakan masjid di kawasan ini'
  return AUTH.find(([re]) => re.test(c.authority))?.[1][l] ?? c.authority
}

// ---- the look: the same tokens as the home page (night sky, rounded type, gold gradient, light mode) -----------------------
const CSS = `
  :root{--night:#0b0f2a;--card:rgba(255,255,255,.05);--line:rgba(255,255,255,.10);--text:#eef0fa;--muted:#a9b2d6;--gold:#f2c063;--ember:#f39a4a;--radius:22px;color-scheme:dark;
    --font:ui-rounded,"SF Pro Rounded","Nunito",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  :root[data-theme=light]{--night:#F2EEE9;--card:#fff;--line:rgba(21,26,69,.13);--text:#151A45;--muted:#4c5380;--gold:#8a5a00;color-scheme:light}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%;overflow-x:clip}
  body{margin:0;background:var(--night);color:var(--text);font-family:var(--font);font-size:17px;line-height:1.6;overflow-x:clip}
  body::before{content:"";position:fixed;inset:0;z-index:-1;background:
    radial-gradient(1px 1px at 12% 18%,#fff8 50%,transparent 51%),radial-gradient(1px 1px at 72% 9%,#fff6 50%,transparent 51%),
    radial-gradient(1.5px 1.5px at 85% 32%,#fff7 50%,transparent 51%),radial-gradient(1px 1px at 33% 42%,#fff5 50%,transparent 51%),
    radial-gradient(1px 1px at 58% 66%,#fff5 50%,transparent 51%),radial-gradient(1.5px 1.5px at 22% 78%,#fff6 50%,transparent 51%),
    radial-gradient(60% 50% at 80% 0%,#2a2f78 0%,transparent 70%),radial-gradient(50% 40% at 0% 100%,#3a1f52 0%,transparent 70%),var(--night)}
  :root[data-theme=light] body::before{background:radial-gradient(50% 40% at 85% 0%,#f7bd8f90,transparent 70%),radial-gradient(40% 35% at 0% 100%,#e2b65a60,transparent 70%),var(--night)}
  a{color:var(--gold)}
  .wrap{max-width:900px;margin:0 auto;padding:0 20px}
  header.top{position:sticky;top:0;z-index:10;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(11,15,42,.72);border-bottom:1px solid var(--line)}
  :root[data-theme=light] header.top{background:rgba(242,238,233,.85)}
  header.top .wrap{display:flex;align-items:center;justify-content:space-between;height:62px;gap:10px}
  .brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-weight:800;white-space:nowrap}
  .brand img{width:34px;height:34px;border-radius:9px}
  .tr{display:flex;align-items:center;gap:8px}
  .langs{display:flex;gap:4px}.langs a{border:1px solid var(--line);border-radius:999px;padding:6px 11px;font-size:.78rem;font-weight:800;letter-spacing:.04em;color:var(--muted);text-decoration:none;min-height:34px;display:inline-flex;align-items:center}
  .langs a[aria-current]{background:var(--card);color:var(--text);border-color:var(--gold)}
  .mode{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--gold);cursor:pointer;font-size:1.05rem}
  .btn{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f2c063,#f39a4a);color:#1b1230;font-weight:800;border-radius:999px;padding:12px 20px;min-height:46px;text-decoration:none;margin:4px 8px 4px 0}
  .btn.o{background:var(--card);color:var(--text);border:1px solid var(--line)}
  .btn.sm{padding:8px 14px;min-height:40px;font-size:.9rem;margin:0}
  @media(max-width:520px){.tr .btn.sm{display:none}}
  h1{font-size:clamp(1.9rem,5.5vw,2.8rem);font-weight:800;margin:30px 0 6px;letter-spacing:-.01em;line-height:1.15}
  h2{font-size:1.35rem;font-weight:800;margin:36px 0 10px}
  .eyebrow{display:inline-block;font-size:.8rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-top:26px}
  .date{color:var(--muted);margin:0 0 14px}.lead{color:var(--muted);font-size:1.08rem}
  .times{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:18px 0 6px;padding:0;list-style:none}
  .times li{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px}
  .times b{display:block;color:var(--muted);font-weight:700;font-size:.9rem}
  .times span{font-size:1.55rem;font-weight:800;color:var(--gold);white-space:nowrap}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px 20px;margin:14px 0}
  .card p{margin:6px 0}
  table{width:100%;border-collapse:collapse;font-size:.92rem}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
  th{color:var(--muted);font-weight:700}
  tr.now td{color:var(--gold);font-weight:800}
  .scroll{overflow-x:auto;border:1px solid var(--line);border-radius:18px;margin:10px 0;background:var(--card)}
  details{margin:10px 0}summary{cursor:pointer;font-weight:700}
  dt{font-weight:800;margin-top:16px}dd{margin:4px 0 0;color:var(--muted)}
  .links{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
  .links a{display:inline-block;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 15px;text-decoration:none;color:var(--text);font-size:.95rem}
  footer{color:var(--muted);padding:34px 0 70px;margin-top:50px;border-top:1px solid var(--line);font-size:.92rem}
  footer a{color:var(--muted)}
  footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px}
  @media print{
    body{background:#fff!important;color:#000!important;font-size:11pt}body::before,header.top,footer,.noprint,.cta{display:none!important}
    .card,.scroll,.times li{background:#fff!important;border:1px solid #999!important;color:#000!important}
    .times span,tr.now td,a,.eyebrow{color:#000!important}th,.date,.lead,dd{color:#333!important}
    table{font-size:9pt}th,td{padding:3px 5px;border-bottom:1px solid #bbb}
    h2{break-after:avoid}table,.card{break-inside:avoid}.print-only{display:block!important}
  }
  .print-only{display:none}
`
const THEME = `<script>(function(){var t=null;try{t=localStorage.getItem('pta-theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)})()</script>`
const TOGGLE = `<script>(function(){var b=document.querySelector('.mode');if(!b)return;b.hidden=false;function paint(){b.textContent=document.documentElement.getAttribute('data-theme')==='light'?'\\u2600':'\\u263E'}paint();b.addEventListener('click',function(){var t=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('pta-theme',t)}catch(e){}paint()})})()</script>`

function shell(o: { title: string; desc: string; path: string; depth: number; body: string; ld: object[]; extra?: string; lang?: Lang; alts?: Partial<Record<Lang, string>> }): string {
  const l: Lang = o.lang ?? 'en'
  const w = W[l]
  const up = '../'.repeat(o.depth)
  const alts = o.alts
  return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0b0f2a" />
<meta name="color-scheme" content="dark light" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}" />
<link rel="canonical" href="${ORIGIN}/${o.path}" />
${alts ? LANGS.filter((x) => alts[x]).map((x) => `<link rel="alternate" hreflang="${x}" href="${ORIGIN}/${alts[x]}" />`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}/${alts.en}" />` : ''}
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
<header class="top"><div class="wrap"><a class="brand" href="${BASE}${HOME[l]}"><img src="${up}img/icon-96.webp" alt="" width="34" height="34" />Prayer Times Asia</a>
<div class="tr">${alts ? `<nav class="langs" aria-label="Language">${LANGS.filter((x) => alts[x]).map((x) => `<a href="${BASE}${alts[x]}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="page"' : ''}>${x.toUpperCase()}</a>`).join('')}</nav>` : ''}
<button class="mode" type="button" hidden aria-label="${esc(w.theme)}"></button><a class="btn sm" href="${BASE}app/">${esc(w.open)}</a></div></div></header>
<main class="wrap">
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
const siteLd = (l: Lang) => ({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${ORIGIN}/#site`, url: `${ORIGIN}/`, name: 'Prayer Times Asia', publisher: { '@id': `${ORIGIN}/#org` }, inLanguage: l })

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
  document.querySelectorAll('[data-date]').forEach(function(e){e.textContent=new Intl.DateTimeFormat(${JSON.stringify(LOCALE[l])},{timeZone:${JSON.stringify(c.tz)},weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())});
  document.querySelectorAll('tbody tr[data-d]').forEach(function(e){e.className=e.getAttribute('data-d')===d?'now':''});
}catch(e){}})();
</script>`

const alts = (f: (l: Lang) => string): Record<Lang, string> => ({ en: f('en'), ms: f('ms'), id: f('id') })
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
  const others = [...cities.filter((o) => o.country === c.country && o !== c), ...cities.filter((o) => o.country !== c.country)]
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
  <p>${esc(w.methodLbl)} ${esc(c.methodName)}, ${l === 'en' ? 'Fajr' : 'Subuh'} ${c.fajr}${l === 'id' ? ' derajat' : l === 'ms' ? ' darjah' : ' degrees'}, ${l === 'en' ? 'Isha' : l === 'ms' ? 'Isyak' : 'Isya'} ${esc(ishaRule)}, ${l === 'id' ? 'Ashar' : l === 'ms' ? 'Asar' : 'Asr'} ${esc(asrName)}</p>
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
    extra: dayScript(c, l, rows), alts: alts((x) => cityPath(x, c)),
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
    lang: l, title: w.prTitle(n), desc: w.prDesc(n), path: printPath(l, c), depth: printPath(l, c).split('/').length - 1, body, alts: alts((x) => printPath(x, c)),
    ld: [orgLd, siteLd(l), { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[w.home, `${ORIGIN}/${HOME[l]}`], [w.printBadge, `${ORIGIN}/${PRINT_DIR[l]}/`], [n, `${ORIGIN}/${printPath(l, c)}`]].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) }],
  })
}

// ---- write the pages ----------------------------------------------------------------------------------------------------------
const byCountry = (l: Lang, link: (c: City2) => string) => [...new Set(cities.map((c) => c.country))].map((cc) => `<h2>${esc(countryName(cc, l))}</h2>
<ul class="links">${cities.filter((c) => c.country === cc).map((c) => `<li><a href="${BASE}${link(c)}">${esc(cityName(c, l))}</a></li>`).join('')}</ul>`).join('\n')

for (const l of LANGS) {
  const w = W[l]
  for (const c of cities) {
    write(`${cityPath(l, c)}index.html`, cityPage(c, l))
    write(`${printPath(l, c)}index.html`, printablePage(c, l))
  }
  write(`${BASE_DIR[l]}/index.html`, shell({
    lang: l, title: w.ptTitle, desc: w.ptDesc(cities.length), path: `${BASE_DIR[l]}/`, depth: BASE_DIR[l].split('/').length, alts: alts((x) => `${BASE_DIR[x]}/`),
    ld: [orgLd, siteLd(l), { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: cities.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: cityName(c, l), url: `${ORIGIN}/${cityPath(l, c)}` })) }],
    body: `
<h1>${esc(w.ptH1)}</h1>
<p class="lead">${esc(w.ptLead)}</p>
<div class="cta"><a class="btn" href="${BASE}app/">${esc(w.open)}</a><a class="btn o" href="${PLAY}">${esc(w.play)}</a><a class="btn o" href="${BASE}${PRINT_DIR[l]}/">${esc(w.hubH1)}</a></div>
${byCountry(l, (c) => cityPath(l, c))}
<p class="date">${esc(w.ptFoot)}</p>`,
  }))
  write(`${PRINT_DIR[l]}/index.html`, shell({
    lang: l, title: w.hubTitle, desc: w.hubDesc(cities.length), path: `${PRINT_DIR[l]}/`, depth: PRINT_DIR[l].split('/').length, alts: alts((x) => `${PRINT_DIR[x]}/`),
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
const altOf = (f: (l: Lang) => string) => LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN}/${f(l)}"/>`).join('')
const plain = ['about.html', 'sources.html', 'whatsnew.html', 'credits.html', 'ms/credits.html', 'id/credits.html', 'press.html', 'ramadan.html', 'privacy.html', 'terms.html', 'join.html', 'masjid.html', 'app/']
  .filter((p) => (p.endsWith('/') ? has(`${p}index.html`) : has(p)))
const entries: string[] = [
  ...homeLangs.map((h) => `<url><loc>${ORIGIN}/${h}</loc><lastmod>${BUILT}</lastmod>${homeAlt}</url>`),
  ...plain.map((p) => `<url><loc>${ORIGIN}/${p}</loc><lastmod>${BUILT}</lastmod></url>`),
  ...LANGS.map((l) => `<url><loc>${ORIGIN}/${BASE_DIR[l]}/</loc><lastmod>${BUILT}</lastmod>${altOf((x) => `${BASE_DIR[x]}/`)}</url>`),
  ...LANGS.map((l) => `<url><loc>${ORIGIN}/${PRINT_DIR[l]}/</loc><lastmod>${BUILT}</lastmod>${altOf((x) => `${PRINT_DIR[x]}/`)}</url>`),
  ...cities.flatMap((c) => LANGS.flatMap((l) => [
    `<url><loc>${ORIGIN}/${cityPath(l, c)}</loc><lastmod>${BUILT}</lastmod>${altOf((x) => cityPath(x, c))}</url>`,
    `<url><loc>${ORIGIN}/${printPath(l, c)}</loc><lastmod>${BUILT}</lastmod>${altOf((x) => printPath(x, c))}</url>`,
  ])),
]
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`)
console.log(`Search pages built: ${cities.length} cities x ${LANGS.length} languages, printable timetables, about, sitemap with ${entries.length} addresses`)
