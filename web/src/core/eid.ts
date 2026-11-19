import data from '../../../data/eid-sg.json'
import type { Coordinates } from './engine'
import { distanceKm } from './geo'

/**
 * Hari Raya prayer sessions per Singapore masjid, from the Islamic Religious
 * Council of Singapore (MUIS), typed into data/eid-sg.json when MUIS posts them.
 */
export interface EidSession { time: string; khutbah?: string; women?: boolean }
export interface EidMosque { name: string; lat?: number; lng?: number; sessions: EidSession[]; note?: string }
export interface EidEvent { name: string; date: string; sourceUrl: string; updated: string; mosques: EidMosque[] }

const EVENTS = (data as { events: EidEvent[] }).events

/** For screenshots only (?demo&eid=sample): last Aidiladha's layout with a few masjids. */
export const EID_SAMPLE: EidEvent = {
  name: 'Hari Raya Aidiladha 1447H', date: '2026-05-27', updated: '2026-05-20',
  sourceUrl: 'https://www.muis.gov.sg/community/mosque/hari-raya-aidiladha-1447h-prayers-at-mosques/',
  mosques: [
    { name: 'Al-Ansar', sessions: [{ time: '07:20', khutbah: 'Malay', women: true }, { time: '08:15', khutbah: 'English', women: true }] },
    { name: 'Darul Ghufran', sessions: [{ time: '07:30', khutbah: 'Malay' }, { time: '08:30', khutbah: 'English' }], note: 'Booking needed for the 7:30 AM session' },
    { name: 'Al-Istighfar', sessions: [{ time: '07:20', khutbah: 'Malay', women: true }, { time: '08:15', khutbah: 'English', women: true }] },
    { name: 'Al-Taqua', sessions: [{ time: '07:30', khutbah: 'Malay', women: true }] },
    { name: 'Alkaff Kampung Melayu', sessions: [{ time: '07:20', khutbah: 'Malay' }, { time: '08:15', khutbah: 'English', women: true }] },
  ],
}

/** "Masjid Al-Ansar", "Al-Ansar Mosque" and "Al Ansar" all become "alansar". */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/\b(masjid|mosque|mesjid)\b/g, '').replace(/[^a-z]/g, '')
}

/** The Eid to show now: from 14 days before its date to the end of the day. */
export function currentEid(todayISO: string, sample = false): EidEvent | null {
  const list = sample ? [EID_SAMPLE] : EVENTS
  const t = Date.parse(todayISO + 'T00:00:00Z')
  for (const e of list) {
    const d = Date.parse(e.date + 'T00:00:00Z')
    if (sample || (t <= d && d - t <= 14 * 86_400_000)) return e.mosques.length ? e : null
  }
  return null
}

/** This place's sessions, matched by spot (within 300 m) or by name. */
export function eidAt(e: EidEvent, name: string, c: Coordinates): EidMosque | null {
  const key = nameKey(name)
  for (const m of e.mosques) {
    if (m.lat != null && m.lng != null && distanceKm(c, { latitude: m.lat, longitude: m.lng }) <= 0.3) return m
    if (key && nameKey(m.name) === key) return m
  }
  return null
}
