import type { PrayerDay } from './engine'
import { hijriDate } from './hijri'
import { prayerName, type NamingStyle } from './prayer'

/**
 * Wake up for Subuh: the Subuh alarm and the earlier sahur alarm, the same
 * choices as the iPhone and Android apps (WakeUpTiming, SahurTiming, SahurDay).
 * "Allahumma barik li ummati fi bukuriha" (Abu Dawud, Tirmidhi).
 */

/** When the Subuh alarm rings, in the order of the night. */
export type WakeUpTiming = 'fajrMinus30' | 'atFajr' | 'fajrPlus15' | 'sunriseMinus30' | 'sunriseMinus15'
export const WAKE_UP_TIMINGS: readonly WakeUpTiming[] = ['fajrMinus30', 'atFajr', 'fajrPlus15', 'sunriseMinus30', 'sunriseMinus15']

/** The second, earlier alarm for sahur (or a longer night prayer). */
export type SahurTiming = 'fajrMinus60' | 'fajrMinus90' | 'fajrMinus120'
export const SAHUR_TIMINGS: readonly SahurTiming[] = ['fajrMinus60', 'fajrMinus90', 'fajrMinus120']
const SAHUR_MINUTES: Record<SahurTiming, number> = { fajrMinus60: 60, fajrMinus90: 90, fajrMinus120: 120 }

/** Which mornings the sahur alarm rings. */
export type SahurDay = 'ramadan' | 'monThu' | 'whiteDays' | 'everyDay'
export const SAHUR_DAYS: readonly SahurDay[] = ['ramadan', 'monThu', 'whiteDays', 'everyDay']
export const DEFAULT_SAHUR_DAYS: SahurDay[] = ['ramadan', 'monThu']
export const SAHUR_DAY_LABEL: Record<SahurDay, string> = {
  ramadan: 'Ramadan',
  monThu: 'Mondays and Thursdays',
  whiteDays: 'White days (13, 14 and 15 of the Hijri month)',
  everyDay: 'Every day',
}

export function wakeUpLabel(t: WakeUpTiming, naming: NamingStyle): string {
  const fajr = prayerName('fajr', naming)
  const sunrise = prayerName('sunrise', naming)
  switch (t) {
    case 'fajrMinus30': return `30 min before ${fajr} for tahajjud`
    case 'atFajr': return `At ${fajr}`
    case 'fajrPlus15': return `15 min after ${fajr} begins`
    case 'sunriseMinus30': return `30 min before ${sunrise}`
    case 'sunriseMinus15': return `15 min before ${sunrise}`
  }
}

export function wakeUpTime(t: WakeUpTiming, day: PrayerDay): number {
  const m = 60_000
  switch (t) {
    case 'fajrMinus30': return day.times.fajr - 30 * m
    case 'atFajr': return day.times.fajr
    case 'fajrPlus15': return day.times.fajr + 15 * m
    case 'sunriseMinus30': return day.times.sunrise - 30 * m
    case 'sunriseMinus15': return day.times.sunrise - 15 * m
  }
}

export function sahurLabel(t: SahurTiming, naming: NamingStyle): string {
  const fajr = prayerName('fajr', naming)
  switch (t) {
    case 'fajrMinus60': return `1 hour before ${fajr}`
    case 'fajrMinus90': return `1 hour 30 min before ${fajr}`
    case 'fajrMinus120': return `2 hours before ${fajr}`
  }
}

export function sahurTime(t: SahurTiming, day: PrayerDay): number {
  return day.times.fajr - SAHUR_MINUTES[t] * 60_000
}

/** Does the sahur alarm ring before Subuh on this day? */
export function sahurRings(day: PrayerDay, days: readonly SahurDay[], tz: string, hijriAdjustment: number): boolean {
  if (days.includes('everyDay')) return true
  if (days.includes('monThu')) {
    const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay() // 0 = Sunday
    if (weekday === 1 || weekday === 4) return true
  }
  if (days.includes('ramadan') || days.includes('whiteDays')) {
    const h = hijriDate(day.times.dhuhr, tz, hijriAdjustment)
    if (days.includes('ramadan') && h.month === 9) return true
    // Not on 13 Zulhijjah, a day of Tashreeq when fasting is not allowed.
    if (days.includes('whiteDays') && h.day >= 13 && h.day <= 15 && !(h.month === 12 && h.day === 13)) return true
  }
  return false
}
