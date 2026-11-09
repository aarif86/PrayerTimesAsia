/**
 * The six daily times shown in the app. `sunrise` (Syuruk) is not a prayer,
 * it marks the end of Subuh - shown, but never notified as a prayer.
 */
export type Prayer = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export const PRAYERS: readonly Prayer[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
export const OBLIGATORY: readonly Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export const isObligatory = (p: Prayer): boolean => p !== 'sunrise'

/**
 * How prayer names are spelled. The app uses *your* words (from your phone's
 * language, your home, or your browser) wherever you are, and shows the local
 * word when you travel. The value 'arabic' is kept for International so old
 * saved choices decode; 'arabicScript' is the names written in Arabic.
 * New languages need a native speaker's check before launch.
 */
export type NamingStyle =
  | 'arabic' | 'malay' | 'indonesian' | 'southAsian' | 'turkish'
  | 'arabicScript' | 'urdu' | 'bengali' | 'french'

export const NAMING_STYLES: readonly NamingStyle[] = [
  'arabic', 'malay', 'indonesian', 'southAsian', 'turkish', 'arabicScript', 'urdu', 'bengali', 'french',
]

export const NAMING_LANGUAGE: Record<NamingStyle, string> = {
  arabic: 'English',
  malay: 'Malay',
  indonesian: 'Indonesian',
  southAsian: 'South Asian',
  turkish: 'Turkish',
  arabicScript: 'Arabic',
  urdu: 'Urdu',
  bengali: 'Bangla',
  french: 'French',
}

export const NAMING_LABEL: Record<NamingStyle, string> = {
  arabic: 'English (Fajr, Dhuhr, Asr, Isha)',
  malay: 'Malay (Subuh, Zohor, Asar, Isyak)',
  indonesian: 'Indonesian (Subuh, Dzuhur, Ashar, Isya)',
  southAsian: 'South Asian (Fajr, Zuhr, Asr, Isha)',
  turkish: 'Turkish (Sabah, Öğle, İkindi, Yatsı)',
  arabicScript: 'Arabic (الفجر، الظهر، العصر)',
  urdu: 'Urdu (فجر، ظہر، عصر)',
  bengali: 'Bangla (ফজর, যোহর, আসর)',
  french: 'French (Fajr, Dhohr, Asr, Icha)',
}

/** Names written right to left. English sentences use International names instead. */
export const isRightToLeft = (s: NamingStyle): boolean => s === 'arabicScript' || s === 'urdu'

/** Spellings follow each authority's own timetable. */
export const NAMES: Record<NamingStyle, Record<Prayer, string>> = {
  arabic: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  malay: { fajr: 'Subuh', sunrise: 'Syuruk', dhuhr: 'Zohor', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak' },
  indonesian: { fajr: 'Subuh', sunrise: 'Terbit', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' },
  southAsian: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Zuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  turkish: { fajr: 'Sabah', sunrise: 'Güneş', dhuhr: 'Öğle', asr: 'İkindi', maghrib: 'Akşam', isha: 'Yatsı' },
  arabicScript: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
  urdu: { fajr: 'فجر', sunrise: 'طلوع آفتاب', dhuhr: 'ظہر', asr: 'عصر', maghrib: 'مغرب', isha: 'عشاء' },
  bengali: { fajr: 'ফজর', sunrise: 'সূর্যোদয়', dhuhr: 'যোহর', asr: 'আসর', maghrib: 'মাগরিব', isha: 'এশা' },
  french: { fajr: 'Fajr', sunrise: 'Chourouq', dhuhr: 'Dhohr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Icha' },
}

const FRIDAY: Record<NamingStyle, string> = {
  malay: 'Jumaat', indonesian: 'Jumat', turkish: 'Cuma', arabic: "Jumu'ah", southAsian: "Jumu'ah",
  arabicScript: 'الجمعة', urdu: 'جمعہ', bengali: 'জুমা', french: 'Joumou\'a',
}

export function prayerName(p: Prayer, style: NamingStyle, isFriday = false): string {
  if (p === 'dhuhr' && isFriday) return FRIDAY[style]
  return NAMES[style][p]
}

const HIJRI_MONTHS: Record<'malay' | 'international' | 'turkish' | 'arabicScript' | 'urdu' | 'bengali' | 'french', string[]> = {
  malay: ['Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir',
    'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah'],
  international: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah',
    'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah'],
  turkish: ['Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir', 'Cemaziyelevvel', 'Cemaziyelahir',
    'Recep', 'Şaban', 'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce'],
  arabicScript: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
  urdu: ['محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی', 'جمادی الاول', 'جمادی الثانی',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذوالقعدہ', 'ذوالحجہ'],
  bengali: ['মহররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি', 'জমাদিউল আউয়াল', 'জমাদিউস সানি',
    'রজব', 'শাবান', 'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ'],
  french: ['Mouharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Joumada al-Oula', 'Joumada al-Akhira',
    'Rajab', 'Chaabane', 'Ramadan', 'Chawwal', 'Dhou al-Qida', 'Dhou al-Hijja'],
}

export function hijriMonths(style: NamingStyle): string[] {
  switch (style) {
    case 'malay': case 'indonesian': return HIJRI_MONTHS.malay
    case 'turkish': case 'arabicScript': case 'urdu': case 'bengali': case 'french': return HIJRI_MONTHS[style]
    default: return HIJRI_MONTHS.international
  }
}

/** Shafi'i/Maliki/Hanbali (shadow = object) or Hanafi (shadow = twice the object). */
export type AsrSchool = 'standard' | 'hanafi'
export const shadowFactor = (s: AsrSchool): number => (s === 'hanafi' ? 2 : 1)
export const asrLabel = (s: AsrSchool): string => (s === 'hanafi' ? 'Hanafi' : "Shafi'i (standard)")
