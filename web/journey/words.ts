/**
 * Words for the Journey Prayer Planner page. English first, Malay and Indonesian after.
 * {a} {b} {c} are filled in by the page. Public copy rule kept: plain sentences, no colons or dashes.
 * The Malay and Indonesian lines are drafts that need a native read.
 * The travel prayer card (travelH, travelP) is neutral on purpose and needs the ustaz to check it.
 */
export type JLang = 'en' | 'ms' | 'id'

export interface JWords {
  locale: string
  clock24: boolean
  names: Record<'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string>
  /** The page */
  title: string; desc: string; eyebrow: string; h1: string; lead: string; steps: string; footFollow: string
  home: string; crumb: string; open: string; theme: string; about: string; sources: string; privacy: string; nasar: string
  /** The form */
  flight: string; from: string; to: string; takesOff: string; lands: string; localHint: string; cityHint: string
  cityPlaceholder: string; noCity: string; addFlight: string; removeFlight: string; example: string; clear: string; show: string
  connecting: string
  /** Problems */
  errCity: string; errTimes: string; errTooLong: string; errLayover: string; errWhen: string; errStop: string; noscript: string
  /** Results */
  summary: string; picH: string; picNote: string; rowWhere: string; rowPrayer: string; air: string; ground: string; layover: string
  prayersH: string; noFard: string; begins: string; ends: string; badgeAir: string; badgePart: string; badgeGround: string
  pBefore: string; pAir: string; pLayover: string; pAfter: string; afterTakeoff: string; beforeLanding: string
  qibla: string; qiblaNote: string; startedEarlier: string; continues: string;
  estimateH: string; estimateP: string; travelH: string; travelP: string; appH: string; appP: string; appBtn: string
  print: string; copy: string; copied: string; hours: string; minutes: string
  compass: string[]
}

const EN: JWords = {
  locale: 'en-GB', clock24: false,
  names: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  title: 'Journey Prayer Planner | Prayer Times Asia',
  desc: 'Free planner for flights. Enter your cities and flight times and see which prayer times fall in the air, at the airport or on the ground. Always follow your local religious authority.',
  eyebrow: 'Free tool', h1: 'Journey Prayer Planner',
  lead: 'Flying soon? Enter your cities and flight times and see which prayer times fall before takeoff, in the air, during a stopover and after landing.',
  steps: 'Use the local time of each city, the same as printed on your ticket.',
  footFollow: 'Always follow your local religious authority.',
  home: 'Home', crumb: 'Journey Prayer Planner', open: 'Open the app', theme: 'Switch between light and dark',
  about: 'How we work out the times', sources: 'Where our times come from', privacy: 'Privacy', nasar: 'Built fisabilillah in Singapore by',
  flight: 'Flight {a}', from: 'From', to: 'To', takesOff: 'Takes off', lands: 'Lands', localHint: 'Local time in {a}', cityHint: 'Start typing a city',
  cityPlaceholder: 'Type a city', noCity: 'No city found. Try a bigger city nearby.', addFlight: 'Add a connecting flight', removeFlight: 'Remove this flight',
  example: 'Try an example', clear: 'Start again', show: 'Show my prayer times', connecting: 'Connecting from {a}',
  errCity: 'Please choose a city from the list for every flight.', errTimes: 'Please fill in the takeoff and landing times.',
  errTooLong: 'That flight looks longer than 30 hours. Please check the times.', errLayover: 'The next flight must take off after the one before lands.',
  errWhen: 'Landing must be after takeoff. Please check the times and cities.',
  errStop: 'A stopover can be up to 3 days and a whole trip up to 10 days. Please check the dates.',
  noscript: 'JavaScript is needed for this planner. It runs on your device and sends nothing anywhere.',
  summary: '{a} in the air · {b} from takeoff to landing',
  picH: 'Your journey at a glance', picNote: 'Times along the bar are in your first city. The bar shows where you are and which prayer time is in force.',
  rowWhere: 'Where you are', rowPrayer: 'Prayer time in force', air: 'In the air', ground: 'On the ground', layover: 'Stopover',
  prayersH: 'Your prayers on this journey', noFard: 'No obligatory prayer in this period.',
  begins: 'Time begins', ends: 'Time ends', badgeAir: 'Starts and ends in the air', badgePart: 'Includes time in the air', badgeGround: 'On the ground',
  pBefore: 'On the ground in {a} from {b} until takeoff at {c}', pAir: 'In the air from {a} to {b}', pLayover: 'During your stopover in {a}, from {b} to {c}',
  pAfter: 'On the ground in {a} from landing at {b} until {c}', afterTakeoff: '{a} after takeoff', beforeLanding: '{a} before landing',
  qibla: 'Qibla at that point is about {a} degrees from true north, {b}.', qiblaNote: 'Use the flight map on the seat screen or ask the cabin crew for the direction.',
  startedEarlier: 'Began before you left', continues: 'Carries on after you land',
  estimateH: 'About these times', estimateP: 'Times are worked out by calculation for each city, with the same method the app uses there. In the air the plane is placed on a straight path between the two cities, and the method of the nearer city is used, so those times are an estimate and may be a few minutes off. They can also differ by a minute or two from your local timetable.',
  travelH: 'Prayer while travelling', travelP: 'A traveller may have different options for how to pray, and scholars explain the details differently, including how to treat prayer times in the air. This planner only shows the times. Please ask your own ustaz and follow your local religious authority.',
  appH: 'Take it with you', appP: 'The Prayer Times Asia app is free, with no ads. It has a Journey screen that lists what changes for each prayer when you travel.', appBtn: 'Open the web app',
  print: 'Print or save as PDF', copy: 'Copy a link to this plan', copied: 'Link copied', hours: '{a} h', minutes: '{a} min',
  compass: ['north', 'north east', 'east', 'south east', 'south', 'south west', 'west', 'north west'],
}

const MS: JWords = {
  locale: 'ms-MY', clock24: false,
  names: { fajr: 'Subuh', sunrise: 'Syuruk', dhuhr: 'Zohor', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak' },
  title: 'Perancang Solat Perjalanan | Prayer Times Asia',
  desc: 'Perancang percuma untuk penerbangan. Masukkan bandar dan masa penerbangan anda, dan lihat waktu solat yang jatuh di udara, di lapangan terbang atau di darat. Sentiasa ikut pihak berkuasa agama tempatan anda.',
  eyebrow: 'Alat percuma', h1: 'Perancang Solat Perjalanan',
  lead: 'Akan terbang tidak lama lagi? Masukkan bandar dan masa penerbangan anda, dan lihat waktu solat yang jatuh sebelum berlepas, di udara, semasa transit dan selepas mendarat.',
  steps: 'Gunakan waktu tempatan setiap bandar, sama seperti yang tercetak pada tiket anda.',
  footFollow: 'Sentiasa ikut pihak berkuasa agama tempatan anda.',
  home: 'Utama', crumb: 'Perancang Solat Perjalanan', open: 'Buka aplikasi', theme: 'Tukar antara cerah dan gelap',
  about: 'Cara kami mengira waktu', sources: 'Sumber waktu kami', privacy: 'Privasi', nasar: 'Dibina fisabilillah di Singapura oleh',
  flight: 'Penerbangan {a}', from: 'Dari', to: 'Ke', takesOff: 'Berlepas', lands: 'Mendarat', localHint: 'Waktu tempatan di {a}', cityHint: 'Mula menaip nama bandar',
  cityPlaceholder: 'Taip nama bandar', noCity: 'Bandar tidak ditemui. Cuba bandar yang lebih besar berdekatan.', addFlight: 'Tambah penerbangan sambungan', removeFlight: 'Buang penerbangan ini',
  example: 'Cuba satu contoh', clear: 'Mula semula', show: 'Tunjukkan waktu solat saya', connecting: 'Sambungan dari {a}',
  errCity: 'Sila pilih bandar daripada senarai untuk setiap penerbangan.', errTimes: 'Sila isi masa berlepas dan masa mendarat.',
  errTooLong: 'Penerbangan itu nampaknya lebih 30 jam. Sila semak masa.', errLayover: 'Penerbangan seterusnya mesti berlepas selepas penerbangan sebelumnya mendarat.',
  errWhen: 'Masa mendarat mesti selepas masa berlepas. Sila semak masa dan bandar.',
  errStop: 'Transit boleh sehingga 3 hari dan seluruh perjalanan sehingga 10 hari. Sila semak tarikh.',
  noscript: 'JavaScript diperlukan untuk perancang ini. Ia berjalan pada peranti anda dan tidak menghantar apa-apa ke mana-mana.',
  summary: '{a} di udara · {b} dari berlepas hingga mendarat',
  picH: 'Perjalanan anda sekilas pandang', picNote: 'Masa pada bar ialah waktu di bandar pertama anda. Bar menunjukkan di mana anda berada dan waktu solat yang sedang berjalan.',
  rowWhere: 'Anda berada di', rowPrayer: 'Waktu solat sedang berjalan', air: 'Di udara', ground: 'Di darat', layover: 'Transit',
  prayersH: 'Solat anda sepanjang perjalanan', noFard: 'Tiada solat fardu dalam tempoh ini.',
  begins: 'Waktu bermula', ends: 'Waktu tamat', badgeAir: 'Bermula dan tamat di udara', badgePart: 'Termasuk masa di udara', badgeGround: 'Di darat',
  pBefore: 'Di darat di {a} dari {b} hingga berlepas pada {c}', pAir: 'Di udara dari {a} hingga {b}', pLayover: 'Semasa transit di {a}, dari {b} hingga {c}',
  pAfter: 'Di darat di {a} dari mendarat pada {b} hingga {c}', afterTakeoff: '{a} selepas berlepas', beforeLanding: '{a} sebelum mendarat',
  qibla: 'Kiblat pada titik itu kira-kira {a} darjah dari utara sebenar, {b}.', qiblaNote: 'Gunakan peta penerbangan pada skrin tempat duduk atau tanya anak kapal untuk arahnya.',
  startedEarlier: 'Bermula sebelum anda bertolak', continues: 'Berterusan selepas anda mendarat', 
  estimateH: 'Tentang waktu ini', estimateP: 'Waktu dikira untuk setiap bandar, dengan kaedah yang sama seperti aplikasi di sana. Di udara, pesawat diletakkan pada laluan lurus antara dua bandar, dan kaedah bandar yang lebih dekat digunakan, jadi waktu itu hanya anggaran dan mungkin berbeza beberapa minit. Ia juga boleh berbeza seminit dua daripada jadual tempatan anda.',
  travelH: 'Solat semasa bermusafir', travelP: 'Seorang musafir mungkin ada pilihan cara solat yang berbeza, dan para ulama menjelaskan perinciannya dengan cara yang berbeza, termasuk cara menilai waktu solat di udara. Perancang ini hanya menunjukkan waktu. Sila tanya ustaz anda dan ikut pihak berkuasa agama tempatan anda.',
  appH: 'Bawa bersama anda', appP: 'Aplikasi Prayer Times Asia percuma, tanpa iklan. Ada skrin Perjalanan yang menyenaraikan apa yang berubah bagi setiap solat apabila anda bermusafir.', appBtn: 'Buka aplikasi web',
  print: 'Cetak atau simpan sebagai PDF', copy: 'Salin pautan rancangan ini', copied: 'Pautan disalin', hours: '{a} j', minutes: '{a} min',
  compass: ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'],
}

const ID: JWords = {
  locale: 'id-ID', clock24: true,
  names: { fajr: 'Subuh', sunrise: 'Terbit', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' },
  title: 'Perencana Salat Perjalanan | Prayer Times Asia',
  desc: 'Perencana gratis untuk penerbangan. Masukkan kota dan jam penerbangan Anda, lalu lihat waktu salat yang jatuh di udara, di bandara, atau di darat. Selalu ikuti otoritas agama setempat Anda.',
  eyebrow: 'Alat gratis', h1: 'Perencana Salat Perjalanan',
  lead: 'Akan terbang? Masukkan kota dan jam penerbangan Anda, lalu lihat waktu salat yang jatuh sebelum lepas landas, di udara, saat transit, dan setelah mendarat.',
  steps: 'Gunakan jam setempat tiap kota, sama seperti yang tertera pada tiket Anda.',
  footFollow: 'Selalu ikuti otoritas agama setempat Anda.',
  home: 'Beranda', crumb: 'Perencana Salat Perjalanan', open: 'Buka aplikasi', theme: 'Ganti antara terang dan gelap',
  about: 'Cara kami menghitung waktu', sources: 'Sumber waktu kami', privacy: 'Privasi', nasar: 'Dibuat fisabilillah di Singapura oleh',
  flight: 'Penerbangan {a}', from: 'Dari', to: 'Ke', takesOff: 'Lepas landas', lands: 'Mendarat', localHint: 'Jam setempat di {a}', cityHint: 'Mulai ketik nama kota',
  cityPlaceholder: 'Ketik nama kota', noCity: 'Kota tidak ditemukan. Coba kota yang lebih besar di dekatnya.', addFlight: 'Tambah penerbangan lanjutan', removeFlight: 'Hapus penerbangan ini',
  example: 'Coba contoh', clear: 'Mulai lagi', show: 'Tampilkan waktu salat saya', connecting: 'Lanjutan dari {a}',
  errCity: 'Silakan pilih kota dari daftar untuk setiap penerbangan.', errTimes: 'Silakan isi jam lepas landas dan jam mendarat.',
  errTooLong: 'Penerbangan itu tampaknya lebih dari 30 jam. Silakan periksa jamnya.', errLayover: 'Penerbangan berikutnya harus lepas landas setelah penerbangan sebelumnya mendarat.',
  errWhen: 'Jam mendarat harus setelah jam lepas landas. Silakan periksa jam dan kotanya.',
  errStop: 'Transit bisa sampai 3 hari dan seluruh perjalanan sampai 10 hari. Silakan periksa tanggalnya.',
  noscript: 'JavaScript diperlukan untuk perencana ini. Perencana ini berjalan di perangkat Anda dan tidak mengirim apa pun ke mana pun.',
  summary: '{a} di udara · {b} dari lepas landas sampai mendarat',
  picH: 'Perjalanan Anda sekilas', picNote: 'Jam pada bilah adalah jam di kota pertama Anda. Bilah menunjukkan di mana Anda berada dan waktu salat yang sedang berjalan.',
  rowWhere: 'Posisi Anda', rowPrayer: 'Waktu salat yang berjalan', air: 'Di udara', ground: 'Di darat', layover: 'Transit',
  prayersH: 'Salat Anda selama perjalanan', noFard: 'Tidak ada salat wajib pada periode ini.',
  begins: 'Waktu mulai', ends: 'Waktu berakhir', badgeAir: 'Mulai dan berakhir di udara', badgePart: 'Termasuk waktu di udara', badgeGround: 'Di darat',
  pBefore: 'Di darat di {a} dari {b} sampai lepas landas pukul {c}', pAir: 'Di udara dari {a} sampai {b}', pLayover: 'Saat transit di {a}, dari {b} sampai {c}',
  pAfter: 'Di darat di {a} sejak mendarat pukul {b} sampai {c}', afterTakeoff: '{a} setelah lepas landas', beforeLanding: '{a} sebelum mendarat',
  qibla: 'Kiblat di titik itu sekitar {a} derajat dari utara sejati, {b}.', qiblaNote: 'Gunakan peta penerbangan di layar kursi atau tanyakan arahnya kepada awak kabin.',
  startedEarlier: 'Mulai sebelum Anda berangkat', continues: 'Berlanjut setelah Anda mendarat',
  estimateH: 'Tentang waktu ini', estimateP: 'Waktu dihitung untuk setiap kota, dengan metode yang sama seperti aplikasi di sana. Di udara, pesawat diletakkan pada jalur lurus antara dua kota, dan metode kota yang lebih dekat dipakai, jadi waktunya hanya perkiraan dan bisa selisih beberapa menit. Waktunya juga bisa selisih satu dua menit dari jadwal setempat Anda.',
  travelH: 'Salat saat bepergian', travelP: 'Seorang musafir mungkin memiliki pilihan cara salat yang berbeda, dan para ulama menjelaskan rinciannya secara berbeda, termasuk cara menilai waktu salat di udara. Perencana ini hanya menunjukkan waktu. Silakan tanya ustaz Anda dan ikuti otoritas agama setempat Anda.',
  appH: 'Bawa bersama Anda', appP: 'Aplikasi Prayer Times Asia gratis, tanpa iklan. Ada layar Perjalanan yang mencantumkan apa yang berubah untuk setiap salat saat Anda bepergian.', appBtn: 'Buka aplikasi web',
  print: 'Cetak atau simpan sebagai PDF', copy: 'Salin tautan rencana ini', copied: 'Tautan disalin', hours: '{a} j', minutes: '{a} mnt',
  compass: ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'],
}

export const JOURNEY_WORDS: Record<JLang, JWords> = { en: EN, ms: MS, id: ID }
export const JOURNEY_DIR: Record<JLang, string> = { en: 'journey-planner', ms: 'ms/perancang-perjalanan', id: 'id/perencana-perjalanan' }
