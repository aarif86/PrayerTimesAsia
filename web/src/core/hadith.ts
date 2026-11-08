/**
 * Short hadith and ayat shown around the app, chosen by Ustaz Aarif Raziff.
 * Every hadith was checked on sunnah.com (reference and grade below). Same text
 * in ios Core/HadithContent.swift and android core HadithContent.kt.
 *
 * People who want a clean app turn them off in Settings, Hadith, or close any
 * one with its ✕.
 */

export type HadithId =
  | 'fixedTimes' | 'coolPrayers' | 'syuruk' | 'river' | 'illness'
  | 'fajrRakaat' | 'nightPrayer' | 'whiteDays' | 'monThu' | 'azan' | 'iftar'

type Words = { en: string; ms: string; id: string }

export interface Hadith {
  id: HadithId
  arabic: string
  meaning: Words
  /** Who said it and who narrated it, in a few words. */
  source: Words
  /** Where to check it, e.g. "Sahih al Bukhari 574". Not shown, kept for review. */
  ref: string
}

const prophet = (book: Words): Words => ({
  en: `The Prophet ﷺ, narrated by ${book.en}`,
  ms: `Sabda Nabi ﷺ, riwayat ${book.ms}`,
  id: `Sabda Nabi ﷺ, riwayat ${book.id}`,
})
const BUKHARI: Words = { en: 'al Bukhari', ms: 'al Bukhari', id: 'al Bukhari' }
const MUSLIM: Words = { en: 'Muslim', ms: 'Muslim', id: 'Muslim' }
const TIRMIDHI: Words = { en: 'at Tirmidhi', ms: 'at Tirmizi', id: 'at Tirmidzi' }

export const HADITH: Record<HadithId, Hadith> = {
  fixedTimes: {
    id: 'fixedTimes',
    arabic: 'إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَٰبًا مَّوْقُوتًا',
    meaning: {
      en: 'Prayer has been set for the believers at fixed times.',
      ms: 'Sesungguhnya solat itu kewajipan yang ditentukan waktunya ke atas orang beriman.',
      id: 'Sesungguhnya salat itu kewajiban yang ditentukan waktunya atas orang beriman.',
    },
    source: { en: 'Surah an Nisa, ayah 103', ms: 'Surah an Nisa, ayat 103', id: 'Surah an Nisa, ayat 103' },
    ref: 'Quran 4:103',
  },
  coolPrayers: {
    id: 'coolPrayers',
    arabic: 'مَنْ صَلَّى الْبَرْدَيْنِ دَخَلَ الْجَنَّةَ',
    meaning: {
      en: 'Whoever prays the two cool prayers, Subuh and Asar, will enter Paradise.',
      ms: 'Sesiapa yang solat dua waktu sejuk, Subuh dan Asar, akan masuk syurga.',
      id: 'Siapa yang salat dua waktu sejuk, Subuh dan Asar, akan masuk surga.',
    },
    source: prophet(BUKHARI),
    ref: 'Sahih al Bukhari 574',
  },
  syuruk: {
    id: 'syuruk',
    arabic: 'لاَ صَلاَةَ بَعْدَ الصُّبْحِ حَتَّى تَرْتَفِعَ الشَّمْسُ',
    meaning: {
      en: 'No prayer after Subuh until the sun has risen. Syuruk is sunrise, when Subuh time ends. It is not a prayer.',
      ms: 'Tiada solat selepas Subuh sehingga matahari naik. Syuruk ialah waktu matahari terbit, tamatnya waktu Subuh. Ia bukan waktu solat.',
      id: 'Tidak ada salat setelah Subuh hingga matahari naik. Syuruk adalah terbit matahari, saat waktu Subuh berakhir. Ia bukan waktu salat.',
    },
    source: prophet(BUKHARI),
    ref: 'Sahih al Bukhari 586',
  },
  river: {
    id: 'river',
    arabic: 'فَذَلِكَ مِثْلُ الصَّلَوَاتِ الْخَمْسِ يَمْحُو اللَّهُ بِهَا الْخَطَايَا',
    meaning: {
      en: 'Like a river at your door you bathe in five times a day. That is like the five prayers. Allah wipes away sins with them.',
      ms: 'Seperti sungai di depan pintu yang kamu mandi lima kali sehari. Begitulah solat lima waktu, Allah menghapuskan dosa dengannya.',
      id: 'Seperti sungai di depan pintu yang kamu mandi lima kali sehari. Begitulah salat lima waktu, Allah menghapus dosa dengannya.',
    },
    source: prophet(BUKHARI),
    ref: 'Sahih al Bukhari 528',
  },
  illness: {
    id: 'illness',
    arabic: 'إِذَا مَرِضَ الْعَبْدُ أَوْ سَافَرَ كُتِبَ لَهُ مِثْلُ مَا كَانَ يَعْمَلُ مُقِيمًا صَحِيحًا',
    meaning: {
      en: 'When a servant falls ill or travels, he gets the reward of what he used to do when well and at home.',
      ms: 'Apabila seseorang sakit atau bermusafir, ditulis baginya pahala seperti amalannya ketika sihat dan bermukim.',
      id: 'Apabila seorang hamba sakit atau bepergian, dicatat baginya pahala seperti amalannya ketika sehat dan bermukim.',
    },
    source: prophet(BUKHARI),
    ref: 'Sahih al Bukhari 2996',
  },
  fajrRakaat: {
    id: 'fajrRakaat',
    arabic: 'رَكْعَتَا الْفَجْرِ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا',
    meaning: {
      en: 'The two rakaat of Fajr are better than the world and all in it.',
      ms: 'Dua rakaat sebelum Subuh lebih baik daripada dunia dan segala isinya.',
      id: 'Dua rakaat sebelum Subuh lebih baik daripada dunia dan seisinya.',
    },
    source: prophet(MUSLIM),
    ref: 'Sahih Muslim 725a',
  },
  nightPrayer: {
    id: 'nightPrayer',
    arabic: 'أَفْضَلُ الصَّلاَةِ بَعْدَ الْفَرِيضَةِ صَلاَةُ اللَّيْلِ',
    meaning: {
      en: 'The best prayer after the fardhu is the night prayer.',
      ms: 'Solat paling utama selepas solat fardhu ialah solat malam.',
      id: 'Salat paling utama setelah salat fardu adalah salat malam.',
    },
    source: prophet(MUSLIM),
    ref: 'Sahih Muslim 1163a',
  },
  whiteDays: {
    id: 'whiteDays',
    arabic: 'صَوْمُ ثَلاَثَةِ أَيَّامٍ صَوْمُ الدَّهْرِ كُلِّهِ',
    meaning: {
      en: 'Fasting three days a month is like fasting the whole year.',
      ms: 'Puasa tiga hari sebulan seperti berpuasa sepanjang tahun.',
      id: 'Puasa tiga hari setiap bulan seperti puasa sepanjang tahun.',
    },
    source: prophet(BUKHARI),
    ref: 'Sahih al Bukhari 1979',
  },
  monThu: {
    id: 'monThu',
    arabic: 'تُعْرَضُ الأَعْمَالُ يَوْمَ الاِثْنَيْنِ وَالْخَمِيسِ فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ',
    meaning: {
      en: 'Deeds are shown on Monday and Thursday, and I love that mine are shown while I am fasting.',
      ms: 'Amalan dibentangkan pada hari Isnin dan Khamis, dan aku suka amalanku dibentangkan ketika aku berpuasa.',
      id: 'Amal diperlihatkan pada hari Senin dan Kamis, dan aku suka amalku diperlihatkan saat aku berpuasa.',
    },
    source: prophet(TIRMIDHI),
    ref: 'Jami at Tirmidhi 747 (Hasan)',
  },
  azan: {
    id: 'azan',
    arabic: 'إِذَا سَمِعْتُمُ النِّدَاءَ فَقُولُوا مِثْلَ مَا يَقُولُ الْمُؤَذِّنُ',
    meaning: {
      en: 'When you hear the azan, say what the muazzin says.',
      ms: 'Apabila kamu mendengar azan, ucapkanlah seperti yang diucapkan muazzin.',
      id: 'Apabila kalian mendengar azan, ucapkanlah seperti yang diucapkan muazin.',
    },
    source: prophet(BUKHARI),
    ref: 'Sahih al Bukhari 611',
  },
  iftar: {
    id: 'iftar',
    arabic: 'مَنْ فَطَّرَ صَائِمًا كَانَ لَهُ مِثْلُ أَجْرِهِ',
    meaning: {
      en: 'Whoever gives iftar to a fasting person gets the same reward as him.',
      ms: 'Sesiapa memberi makan orang berbuka, dia mendapat pahala seperti orang itu.',
      id: 'Siapa yang memberi makan orang berbuka, ia mendapat pahala seperti orang itu.',
    },
    source: prophet(TIRMIDHI),
    ref: 'Jami at Tirmidhi 807 (Sahih)',
  },
}

/** The one line added under an alert, e.g. “When you hear the azan, say what the muazzin says.” al Bukhari */
export function hadithAlertLine(id: HadithId, lang: keyof Words): string {
  const h = HADITH[id]
  const book = h.source[lang].replace(/^.*?(narrated by|riwayat) /, '')
  return `“${h.meaning[lang]}” ${book}`
}
