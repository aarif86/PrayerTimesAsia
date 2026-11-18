import type { Lang3 } from './ramadanContent'

/**
 * The quick guide new users see once, after choosing their location (and again
 * from Settings). English, Malay (bahasa baku) and Indonesian. Plain words, no
 * colons or dashes, the same rule as the website.
 */
export type GuideCardId = 'prayer' | 'alerts' | 'qibla' | 'masjid' | 'travel' | 'falak' | 'yours'
export const GUIDE_CARDS: GuideCardId[] = ['prayer', 'alerts', 'qibla', 'masjid', 'travel', 'falak', 'yours']

/** Which tab each card lives on, so the little tab bar under the card can light it up. */
export const GUIDE_TAB: Record<GuideCardId, 'today' | 'qibla' | 'falak' | 'masjid' | 'settings'> = {
  prayer: 'today', alerts: 'today', qibla: 'qibla', masjid: 'masjid', travel: 'today', falak: 'falak', yours: 'settings',
}

interface Card { title: string; body: string }
interface Words {
  hello: string
  cards: Record<GuideCardId, Card>
  skip: string; next: string; back: string; start: string
  again: string
  of: string
  label: string
}

export const GUIDE_WORDS: Record<Lang3, Words> = {
  en: {
    hello: 'Assalamualaikum. A quick look around.',
    cards: {
      prayer: {
        title: 'Your prayer times',
        body: 'The next prayer is always at the top, with the time left to pray. Use the arrows to see other days. The round button changes how your day looks.',
      },
      alerts: {
        title: 'Never miss a prayer',
        body: 'Tap the bell beside any prayer to be told when it comes in. Tap the alarm clock to wake up for Subuh. More alarms and reminders are in Settings.',
      },
      qibla: {
        title: 'Face the Qibla',
        body: 'Open Qibla and hold your phone flat, away from metal. The compass lights up when you face the Kaabah. There is a map too, if the compass is unsure.',
      },
      masjid: {
        title: 'Masjids near you',
        body: 'See the masjids and musollahs around you, and get directions to the one you choose.',
      },
      travel: {
        title: 'Made for travel',
        body: 'Prayer times change by themselves when you land in a new country. Turn on Musafir in Settings and the luggage button shows when you may shorten and combine prayers.',
      },
      falak: {
        title: 'Falak, the old way',
        body: 'Read the time and the Qibla from the shadow of the sun, as the muwaqqit did. No signal needed. Never look at the sun itself.',
      },
      yours: {
        title: 'Make it yours',
        body: 'Tap the date for Ramadan and Eid. In Settings you can change the look, the alarms and how times are worked out. Times follow each country\'s official method. Always follow your local religious authority.',
      },
    },
    skip: 'Skip', next: 'Next', back: 'Back', start: 'Start',
    again: 'You can open this guide again in Settings.',
    of: '{n} of {t}',
    label: 'Quick guide',
  },
  ms: {
    hello: 'Assalamualaikum. Mari lihat sepintas lalu.',
    cards: {
      prayer: {
        title: 'Waktu solat anda',
        body: 'Solat yang seterusnya sentiasa di bahagian atas, bersama baki masa untuk menunaikannya. Tekan anak panah untuk melihat hari lain. Butang bulat menukar paparan hari anda.',
      },
      alerts: {
        title: 'Jangan terlepas solat',
        body: 'Tekan loceng di sebelah mana-mana solat untuk menerima makluman apabila masuk waktu. Tekan jam loceng untuk bangun Subuh. Penggera dan peringatan lain ada di Tetapan.',
      },
      qibla: {
        title: 'Menghadap kiblat',
        body: 'Buka Kiblat dan pegang telefon anda secara mendatar, jauh daripada logam. Kompas akan menyala apabila anda menghadap Kaabah. Peta juga disediakan jika kompas kurang pasti.',
      },
      masjid: {
        title: 'Masjid berdekatan',
        body: 'Lihat masjid dan surau di sekitar anda, berserta arah perjalanan ke tempat yang anda pilih.',
      },
      travel: {
        title: 'Sesuai untuk musafir',
        body: 'Waktu solat bertukar dengan sendiri apabila anda tiba di negara baharu. Hidupkan Musafir di Tetapan, dan butang bagasi akan menunjukkan bila anda boleh melakukan solat jamak dan qasar.',
      },
      falak: {
        title: 'Falak cara lama',
        body: 'Baca waktu dan arah kiblat daripada bayang matahari, seperti yang dilakukan oleh muwaqqit. Tidak memerlukan isyarat. Jangan sekali-kali melihat matahari.',
      },
      yours: {
        title: 'Ikut citarasa anda',
        body: 'Tekan tarikh untuk melihat tarikh Ramadan dan Hari Raya. Di Tetapan, anda boleh menukar paparan, penggera dan cara waktu dikira. Waktu mengikut kaedah rasmi setiap negara. Sentiasa ikuti pihak berkuasa agama tempatan anda.',
      },
    },
    skip: 'Langkau', next: 'Seterusnya', back: 'Kembali', start: 'Mula',
    again: 'Panduan ini boleh dibuka semula di Tetapan.',
    of: '{n} daripada {t}',
    label: 'Panduan ringkas',
  },
  id: {
    hello: 'Assalamualaikum. Mari lihat sekilas.',
    cards: {
      prayer: {
        title: 'Waktu salat Anda',
        body: 'Salat berikutnya selalu ada di bagian atas, bersama sisa waktu untuk menunaikannya. Ketuk panah untuk melihat hari lain. Tombol bulat mengubah tampilan hari Anda.',
      },
      alerts: {
        title: 'Jangan lewatkan salat',
        body: 'Ketuk lonceng di samping salat mana pun untuk mendapat pemberitahuan saat waktunya tiba. Ketuk jam weker untuk bangun Subuh. Alarm dan pengingat lainnya ada di Pengaturan.',
      },
      qibla: {
        title: 'Menghadap kiblat',
        body: 'Buka Kiblat dan pegang ponsel Anda mendatar, jauh dari logam. Kompas akan menyala saat Anda menghadap Kakbah. Ada juga peta jika kompas kurang yakin.',
      },
      masjid: {
        title: 'Masjid terdekat',
        body: 'Lihat masjid dan musala di sekitar Anda, lengkap dengan petunjuk arah ke tempat yang Anda pilih.',
      },
      travel: {
        title: 'Siap untuk perjalanan',
        body: 'Waktu salat berganti sendiri saat Anda tiba di negara baru. Nyalakan Musafir di Pengaturan, dan tombol koper akan menunjukkan kapan Anda boleh menjamak dan mengqasar salat.',
      },
      falak: {
        title: 'Falak cara lama',
        body: 'Baca waktu dan arah kiblat dari bayangan matahari, seperti para muwaqqit dahulu. Tanpa sinyal. Jangan pernah menatap matahari secara langsung.',
      },
      yours: {
        title: 'Atur sesuai keinginan',
        body: 'Ketuk tanggal untuk melihat Ramadan dan Idulfitri. Di Pengaturan, Anda bisa mengubah tampilan, alarm, dan cara waktu dihitung. Waktu mengikuti metode resmi tiap negara. Selalu ikuti otoritas agama setempat Anda.',
      },
    },
    skip: 'Lewati', next: 'Lanjut', back: 'Kembali', start: 'Mulai',
    again: 'Panduan ini bisa dibuka lagi di Pengaturan.',
    of: '{n} dari {t}',
    label: 'Panduan singkat',
  },
}

/** The guide's first language: the prayer names' language if it is Malay or Indonesian, else the device's. */
export function guideLang(naming: Lang3, locale: string): Lang3 {
  if (naming !== 'en') return naming
  const l = locale.toLowerCase()
  if (l.startsWith('ms')) return 'ms'
  if (l.startsWith('id') || l.startsWith('in')) return 'id'
  return 'en'
}
