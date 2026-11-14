import type { ScreenLanguage } from '../screen/config'

/**
 * A short letter a Muslim can hand to an employer or a teacher, explaining the
 * daily prayers: about 10 minutes each, roughly when, and what Friday needs.
 * Plain friendly words with no colons or dashes in the body. Today's times for
 * the chosen place are printed under the text by the sheet.
 */

export type LetterFor = 'work' | 'school'
export const LETTER_FOR: readonly LetterFor[] = ['work', 'school']

export type PaperSize = 'a4' | 'letter'
export const PAPER_SIZES: readonly PaperSize[] = ['a4', 'letter']

export interface LetterText {
  title: string
  /** Before the blank line for the reader's name. */
  dear: string
  /** Paragraphs before the table of today's times. */
  before: string[]
  /** Introduces the table. */
  timesFor: (place: string) => string
  /** Paragraphs after the table. */
  after: string[]
  signOff: string
  /** Labels under the blank lines at the bottom. */
  name: string
  role: string
  date: string
  /** Heading over the table. */
  today: (date: string) => string
  friday: string
}

export interface LetterWords {
  forLabel: Record<LetterFor, string>
  paperLabel: Record<PaperSize, string>
  /** Small print under the letter, where the times are shown. */
  authority: string
  text: Record<LetterFor, LetterText>
}

export const LETTER_WORDS: Record<ScreenLanguage, LetterWords> = {
  en: {
    forLabel: { work: 'For my workplace', school: 'For my school' },
    paperLabel: { a4: 'A4', letter: 'US Letter' },
    authority: 'Follow your local religious authority for prayer times.',
    text: {
      work: {
        title: 'About my daily prayers',
        dear: 'Dear',
        before: [
          'I am a Muslim, and I pray five times a day at set times. I am writing to explain what this means at work, and how little time it takes.',
          'Each prayer takes about 10 minutes, including washing before it. I only need a clean, quiet corner where I can stand, bow and kneel. A meeting room, a storeroom or any spare space is fine.',
          'On a normal working day, one or two prayers fall in office hours, usually around midday and in the afternoon. Each prayer has a window of time, so I can pray at a quiet moment and fit it around my work.',
          'On Fridays, Muslim men go to the mosque for a congregational prayer around midday. With travel it takes about 45 minutes to one hour. I would be grateful for a longer lunch break on Fridays, and I am happy to make up the time.',
        ],
        timesFor: (place) => `Here are today's prayer times for ${place}. They move by a few minutes each week through the year.`,
        after: ['Thank you for your understanding. Please feel free to ask me anything about it.'],
        signOff: 'Yours sincerely,',
        name: 'Name', role: 'Team or department', date: 'Date',
        today: (d) => `Prayer times today, ${d}`,
        friday: 'Friday prayer',
      },
      school: {
        title: 'About my daily prayers',
        dear: 'Dear',
        before: [
          'I am a Muslim, and I pray five times a day at set times. I am writing to explain what this means during the school day, and how little time it takes.',
          'Each prayer takes about 10 minutes, including washing before it. I only need a clean, quiet corner where I can stand, bow and kneel. An empty classroom, the library corner or any spare space is fine.',
          'On a normal school day, one or two prayers fall in school hours, usually around midday and in the afternoon. Each prayer has a window of time, so I can often pray during a break and not miss any lessons.',
          'On Fridays, Muslim men and boys go to the mosque for a congregational prayer around midday. With travel it takes about 45 minutes to one hour. I would be grateful to be excused for this time, and I am happy to catch up on anything I miss.',
        ],
        timesFor: (place) => `Here are today's prayer times for ${place}. They move by a few minutes each week through the year.`,
        after: ['Thank you for your understanding. Please feel free to ask me or my family anything about it.'],
        signOff: 'Yours sincerely,',
        name: 'Name', role: 'Class', date: 'Date',
        today: (d) => `Prayer times today, ${d}`,
        friday: 'Friday prayer',
      },
    },
  },
  ms: {
    forLabel: { work: 'Untuk tempat kerja', school: 'Untuk sekolah' },
    paperLabel: { a4: 'A4', letter: 'US Letter' },
    authority: 'Ikut pihak berkuasa agama tempatan anda bagi waktu solat.',
    text: {
      work: {
        title: 'Tentang solat harian saya',
        dear: 'Kepada',
        before: [
          'Saya seorang Muslim dan saya menunaikan solat lima kali sehari pada waktu yang ditetapkan. Surat ini menerangkan maksudnya bagi kerja saya, dan betapa singkat masa yang diperlukan.',
          'Setiap solat mengambil masa kira-kira 10 minit, termasuk berwuduk. Saya hanya memerlukan sudut yang bersih dan tenang untuk berdiri, rukuk dan sujud. Bilik mesyuarat, stor atau mana-mana ruang kosong sudah memadai.',
          'Pada hari kerja biasa, satu atau dua waktu solat jatuh dalam waktu pejabat, iaitu sekitar tengah hari dan petang. Setiap solat mempunyai tempoh waktunya, jadi saya boleh bersolat ketika keadaan tenang tanpa mengganggu tugas saya.',
          'Pada hari Jumaat, lelaki Muslim pergi ke masjid untuk solat Jumaat berjemaah sekitar tengah hari. Termasuk perjalanan, ia mengambil masa kira-kira 45 minit hingga satu jam. Saya amat menghargai jika waktu rehat tengah hari pada hari Jumaat dapat dilanjutkan, dan saya bersedia menggantikan masa tersebut.',
        ],
        timesFor: (place) => `Berikut ialah waktu solat hari ini bagi ${place}. Waktu ini berubah beberapa minit setiap minggu sepanjang tahun.`,
        after: ['Terima kasih atas pengertian tuan atau puan. Sila tanya saya jika ada sebarang soalan.'],
        signOff: 'Yang benar,',
        name: 'Nama', role: 'Bahagian atau jabatan', date: 'Tarikh',
        today: (d) => `Waktu solat hari ini, ${d}`,
        friday: 'Solat Jumaat',
      },
      school: {
        title: 'Tentang solat harian saya',
        dear: 'Kepada',
        before: [
          'Saya seorang Muslim dan saya menunaikan solat lima kali sehari pada waktu yang ditetapkan. Surat ini menerangkan maksudnya pada waktu persekolahan, dan betapa singkat masa yang diperlukan.',
          'Setiap solat mengambil masa kira-kira 10 minit, termasuk berwuduk. Saya hanya memerlukan sudut yang bersih dan tenang untuk berdiri, rukuk dan sujud. Bilik darjah yang kosong, sudut perpustakaan atau mana-mana ruang kosong sudah memadai.',
          'Pada hari persekolahan biasa, satu atau dua waktu solat jatuh dalam waktu sekolah, iaitu sekitar tengah hari dan petang. Setiap solat mempunyai tempoh waktunya, jadi saya selalunya boleh bersolat ketika waktu rehat tanpa tertinggal pelajaran.',
          'Pada hari Jumaat, lelaki dan budak lelaki Muslim pergi ke masjid untuk solat Jumaat berjemaah sekitar tengah hari. Termasuk perjalanan, ia mengambil masa kira-kira 45 minit hingga satu jam. Saya amat menghargai jika saya dibenarkan keluar pada waktu ini, dan saya bersedia mengejar pelajaran yang tertinggal.',
        ],
        timesFor: (place) => `Berikut ialah waktu solat hari ini bagi ${place}. Waktu ini berubah beberapa minit setiap minggu sepanjang tahun.`,
        after: ['Terima kasih atas pengertian cikgu. Sila tanya saya atau keluarga saya jika ada sebarang soalan.'],
        signOff: 'Yang benar,',
        name: 'Nama', role: 'Kelas', date: 'Tarikh',
        today: (d) => `Waktu solat hari ini, ${d}`,
        friday: 'Solat Jumaat',
      },
    },
  },
  id: {
    forLabel: { work: 'Untuk tempat kerja', school: 'Untuk sekolah' },
    paperLabel: { a4: 'A4', letter: 'US Letter' },
    authority: 'Ikuti otoritas keagamaan setempat untuk jadwal sholat.',
    text: {
      work: {
        title: 'Tentang sholat harian saya',
        dear: 'Kepada Yth.',
        before: [
          'Saya seorang Muslim dan saya menunaikan sholat lima kali sehari pada waktu yang sudah ditentukan. Surat ini menjelaskan artinya bagi pekerjaan saya, dan betapa singkat waktu yang dibutuhkan.',
          'Setiap sholat memakan waktu sekitar 10 menit, termasuk berwudhu. Saya hanya membutuhkan sudut yang bersih dan tenang untuk berdiri, rukuk dan sujud. Ruang rapat, gudang atau ruang kosong mana pun sudah cukup.',
          'Pada hari kerja biasa, satu atau dua waktu sholat jatuh di jam kantor, biasanya sekitar tengah hari dan sore. Setiap sholat punya rentang waktunya sendiri, jadi saya bisa sholat saat suasana tenang tanpa mengganggu pekerjaan.',
          'Pada hari Jumat, laki-laki Muslim pergi ke masjid untuk sholat Jumat berjamaah sekitar tengah hari. Termasuk perjalanan, waktunya sekitar 45 menit sampai satu jam. Saya akan sangat berterima kasih jika istirahat siang pada hari Jumat dapat diperpanjang, dan saya bersedia mengganti waktunya.',
        ],
        timesFor: (place) => `Berikut jadwal sholat hari ini untuk ${place}. Waktunya bergeser beberapa menit setiap minggu sepanjang tahun.`,
        after: ['Terima kasih atas pengertian Bapak atau Ibu. Silakan bertanya kepada saya jika ada pertanyaan.'],
        signOff: 'Hormat saya,',
        name: 'Nama', role: 'Bagian atau divisi', date: 'Tanggal',
        today: (d) => `Jadwal sholat hari ini, ${d}`,
        friday: 'Sholat Jumat',
      },
      school: {
        title: 'Tentang sholat harian saya',
        dear: 'Kepada Yth.',
        before: [
          'Saya seorang Muslim dan saya menunaikan sholat lima kali sehari pada waktu yang sudah ditentukan. Surat ini menjelaskan artinya selama jam sekolah, dan betapa singkat waktu yang dibutuhkan.',
          'Setiap sholat memakan waktu sekitar 10 menit, termasuk berwudhu. Saya hanya membutuhkan sudut yang bersih dan tenang untuk berdiri, rukuk dan sujud. Ruang kelas yang kosong, pojok perpustakaan atau ruang kosong mana pun sudah cukup.',
          'Pada hari sekolah biasa, satu atau dua waktu sholat jatuh di jam sekolah, biasanya sekitar tengah hari dan sore. Setiap sholat punya rentang waktunya sendiri, jadi saya biasanya bisa sholat saat istirahat tanpa ketinggalan pelajaran.',
          'Pada hari Jumat, laki-laki dan anak laki-laki Muslim pergi ke masjid untuk sholat Jumat berjamaah sekitar tengah hari. Termasuk perjalanan, waktunya sekitar 45 menit sampai satu jam. Saya akan sangat berterima kasih jika diizinkan keluar pada waktu itu, dan saya bersedia mengejar pelajaran yang tertinggal.',
        ],
        timesFor: (place) => `Berikut jadwal sholat hari ini untuk ${place}. Waktunya bergeser beberapa menit setiap minggu sepanjang tahun.`,
        after: ['Terima kasih atas pengertian Bapak atau Ibu guru. Silakan bertanya kepada saya atau keluarga saya jika ada pertanyaan.'],
        signOff: 'Hormat saya,',
        name: 'Nama', role: 'Kelas', date: 'Tanggal',
        today: (d) => `Jadwal sholat hari ini, ${d}`,
        friday: 'Sholat Jumat',
      },
    },
  },
}

/** Every sentence a reader sees in the letter body, for checks. */
export function letterSentences(t: LetterText, place = 'Pasir Ris', date = '15 November 2026'): string[] {
  return [t.title, t.dear, ...t.before, t.timesFor(place), ...t.after, t.signOff, t.name, t.role, t.date, t.today(date), t.friday]
}
