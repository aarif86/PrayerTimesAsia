/**
 * Long summer days far from the equator (students abroad, travellers).
 *
 * In summer at high latitudes the sky never gets as dark as the method's Fajr
 * or Isha angle, so the engine's high latitude rule sets those two times
 * instead (engine.ts highLatitude). This file only notices that it happens, to
 * show a short closable note. It never changes a time.
 *
 * Same rules in ios Core/LongDays.swift and android core LongDays.kt.
 */
import { julianDay, sun } from './astro'
import type { CalculationMethod } from './methods'
import type { Lang3 } from './ramadanContent'

/**
 * True when, on this date, the sun at its lowest in the night stays above the
 * method's Fajr or Isha angle (twilight never ends), so a high latitude rule sets
 * Fajr and Isha. Uses the sun at local midnight; the day's change is far too
 * small to matter.
 */
export function twilightLastsAllNight(year: number, month: number, day: number, lat: number, method: CalculationMethod): boolean {
  if (Math.abs(lat) < 40) return false
  const { declination } = sun(julianDay(year, month, day) + 0.5)
  const lowest = Math.abs(lat + declination) - 90
  const angle = Math.max(method.fajrAngle, method.ishaAngle ?? 0)
  return lowest > -angle
}

/**
 * Which note this is, so it shows once per place and summer: the country, the
 * place rounded to whole degrees, and the summer's year. A southern summer
 * (October to March) counts as the year it began in.
 */
export function longDaysKey(year: number, month: number, lat: number, lng: number, countryCode: string): string {
  const summer = lat >= 0 ? year : month <= 6 ? year - 1 : year
  return `${countryCode || 'xx'}:${Math.round(lat)}:${Math.round(lng)}:${summer}`
}

export interface LongDaysWords { title: string; body: (fajr: string, isha: string) => string; close: string }

/** DRAFT wording, waiting for the owner's approval. */
export const LONG_DAYS_WORDS: Record<Lang3, LongDaysWords> = {
  en: {
    title: 'Long summer days here',
    body: (fajr, isha) => `In summer the sky here never gets fully dark, so ${fajr} comes very early and ${isha} very late. The app uses a twilight rule for these two times, which is why they may look unusual. Please follow the timetable of your local masjid and your local religious authority.`,
    close: 'Close',
  },
  ms: {
    title: 'Siang yang panjang pada musim panas',
    body: (fajr, isha) => `Pada musim panas, langit di sini tidak gelap sepenuhnya, jadi waktu ${fajr} sangat awal dan waktu ${isha} sangat lewat. Aplikasi menggunakan kaedah khas untuk dua waktu ini, sebab itu ia mungkin kelihatan luar biasa. Sila ikut jadual masjid berhampiran dan pihak berkuasa agama tempatan anda.`,
    close: 'Tutup',
  },
  id: {
    title: 'Siang yang panjang di musim panas',
    body: (fajr, isha) => `Di musim panas, langit di sini tidak pernah gelap sepenuhnya, sehingga waktu ${fajr} sangat awal dan waktu ${isha} sangat larut. Aplikasi memakai aturan khusus untuk dua waktu ini, karena itu waktunya bisa terlihat tidak biasa. Ikuti jadwal masjid setempat dan otoritas keagamaan setempat Anda.`,
    close: 'Tutup',
  },
}
