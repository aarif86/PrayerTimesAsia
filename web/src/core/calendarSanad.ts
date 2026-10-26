import { gregorianFromHijri, hijriDate } from './hijri'
import type { NamingStyle } from './prayer'

/**
 * The sanad idea applied to the calendar: when Ramadan, Eid and the new year
 * begin, per authority, with the source of each date. Port of CalendarSanad.swift.
 */
export type HijriEvent = '1_ramadan' | '1_syawal' | '10_zulhijjah' | '1_muharram'

export const EVENT_MONTH: Record<HijriEvent, number> = { '1_ramadan': 9, '1_syawal': 10, '10_zulhijjah': 12, '1_muharram': 1 }
export const EVENT_DAY: Record<HijriEvent, number> = { '1_ramadan': 1, '1_syawal': 1, '10_zulhijjah': 10, '1_muharram': 1 }

export function eventTitle(e: HijriEvent, style: NamingStyle): string {
  switch (e) {
    case '1_ramadan': return '1 Ramadan'
    case '1_syawal': return style === 'malay' ? 'Hari Raya Aidilfitri' : style === 'indonesian' ? 'Idul Fitri' : 'Eid al-Fitr'
    case '10_zulhijjah': return style === 'malay' ? 'Hari Raya Aidiladha' : style === 'indonesian' ? 'Idul Adha' : 'Eid al-Adha'
    case '1_muharram': return style === 'malay' || style === 'indonesian' ? 'Awal Muharram' : 'Islamic New Year'
  }
}

export interface CalendarAnnouncement {
  event: HijriEvent
  hijri_year: number
  authority: string
  country: string
  /** "yyyy-MM-dd" (Gregorian, local). */
  date: string
  status: 'expected' | 'announced'
  basis: string
  source_url?: string | null
  announced_at?: string | null
}

export interface CalendarDataset { version: number; licence: string; announcements: CalendarAnnouncement[] }

export function basisLabel(basis: string): string {
  switch (basis) {
    case 'rukyah': return 'moon sighting'
    case 'hisab': return 'calculation'
    case 'umm_al_qura': return 'Umm al-Qura calendar'
    case 'following_other_authority': return 'follows another authority'
    default: return basis
  }
}

export function announcementDate(a: CalendarAnnouncement): { year: number; month: number; day: number } | null {
  const p = a.date.split('-').map((x) => parseInt(x, 10))
  if (p.length !== 3 || p.some(Number.isNaN)) return null
  return { year: p[0], month: p[1], day: p[2] }
}

export interface Authority { id: string; name: string; country: string }

export const AUTHORITIES: Authority[] = [
  { id: 'MUIS', name: 'MUIS (Singapore)', country: 'SG' },
  { id: 'JAKIM', name: 'Penyimpan Mohor Besar Raja-Raja (Malaysia)', country: 'MY' },
  { id: 'KEMENAG', name: 'Kemenag (Indonesia)', country: 'ID' },
  { id: 'MUHAMMADIYAH', name: 'Muhammadiyah (Indonesia)', country: 'ID' },
  { id: 'KHEU', name: 'Ministry of Religious Affairs (Brunei)', country: 'BN' },
  { id: 'CHULARAJMONTRI', name: 'Chularajmontri (Thailand)', country: 'TH' },
  { id: 'KMF', name: 'Korea Muslim Federation', country: 'KR' },
  { id: 'UMMALQURA', name: 'Saudi Arabia (Umm al-Qura / Supreme Court)', country: 'SA' },
  { id: 'DIYANET', name: 'Diyanet (Türkiye)', country: 'TR' },
]

export const defaultAuthority = (country: string) => AUTHORITIES.find((a) => a.country === country)?.id
export const authorityName = (id: string) => AUTHORITIES.find((a) => a.id === id)?.name ?? id

/** The Umm al-Qura Gregorian date for an event: the estimate shown before any announcement. */
export function expectedDate(e: HijriEvent, hijriYear: number) {
  return gregorianFromHijri(hijriYear, EVENT_MONTH[e], EVENT_DAY[e])
}

export interface Upcoming { event: HijriEvent; hijriYear: number }

/** The next `count` events on or after `ms`. */
export function upcomingEvents(ms: number, tz: string, count = 4): Upcoming[] {
  const today = hijriDate(ms, tz)
  const out: Upcoming[] = []
  for (let year = today.year; year <= today.year + 1; year++) {
    for (const event of ['1_muharram', '1_ramadan', '1_syawal', '10_zulhijjah'] as HijriEvent[]) {
      const m = EVENT_MONTH[event], d = EVENT_DAY[event]
      const ahead = year > today.year || (year === today.year && (m > today.month || (m === today.month && d >= today.day)))
      if (ahead) out.push({ event, hijriYear: year })
    }
  }
  return out.slice(0, count)
}
