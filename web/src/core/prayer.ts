/**
 * The six daily times shown in the app. `sunrise` (Syuruk) is not a prayer,
 * it marks the end of Subuh - shown, but never notified as a prayer.
 */
export type Prayer = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export const PRAYERS: readonly Prayer[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
export const OBLIGATORY: readonly Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export const isObligatory = (p: Prayer): boolean => p !== 'sunrise'

/**
 * How prayer names are spelled. The app uses *your* words (from your home, or
 * your browser) wherever you are, and shows the local word when you travel.
 * The value 'arabic' is kept for International so old saved choices decode.
 */
export type NamingStyle = 'arabic' | 'malay' | 'indonesian' | 'southAsian' | 'turkish'

export const NAMING_STYLES: readonly NamingStyle[] = ['arabic', 'malay', 'indonesian', 'southAsian', 'turkish']

export const NAMING_LANGUAGE: Record<NamingStyle, string> = {
  arabic: 'International',
  malay: 'Malay',
  indonesian: 'Indonesian',
  southAsian: 'South Asian',
  turkish: 'Turkish',
}

export const NAMING_LABEL: Record<NamingStyle, string> = {
  arabic: 'International (Fajr, Dhuhr, Asr, Isha)',
  malay: 'Malay (Subuh, Zohor, Asar, Isyak)',
  indonesian: 'Indonesian (Subuh, Dzuhur, Ashar, Isya)',
  southAsian: 'South Asian (Fajr, Zuhr, Asr, Isha)',
  turkish: 'Turkish (Sabah, Öğle, İkindi, Yatsı)',
}

/** Spellings follow each authority's own timetable. */
export const NAMES: Record<NamingStyle, Record<Prayer, string>> = {
  arabic: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  malay: { fajr: 'Subuh', sunrise: 'Syuruk', dhuhr: 'Zohor', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak' },
  indonesian: { fajr: 'Subuh', sunrise: 'Terbit', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' },
  southAsian: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Zuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  turkish: { fajr: 'Sabah', sunrise: 'Güneş', dhuhr: 'Öğle', asr: 'İkindi', maghrib: 'Akşam', isha: 'Yatsı' },
}

const FRIDAY: Record<NamingStyle, string> = {
  malay: 'Jumaat', indonesian: 'Jumat', turkish: 'Cuma', arabic: "Jumu'ah", southAsian: "Jumu'ah",
}

export function prayerName(p: Prayer, style: NamingStyle, isFriday = false): string {
  if (p === 'dhuhr' && isFriday) return FRIDAY[style]
  return NAMES[style][p]
}

export function hijriMonths(style: NamingStyle): string[] {
  return style === 'malay' || style === 'indonesian'
    ? ['Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir',
      'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah']
    : ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah',
      'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah']
}

/** Shafi'i/Maliki/Hanbali (shadow = object) or Hanafi (shadow = twice the object). */
export type AsrSchool = 'standard' | 'hanafi'
export const shadowFactor = (s: AsrSchool): number => (s === 'hanafi' ? 2 : 1)
export const asrLabel = (s: AsrSchool): string => (s === 'hanafi' ? 'Hanafi' : "Shafi'i (standard)")
