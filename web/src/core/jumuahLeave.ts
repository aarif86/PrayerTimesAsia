import { FRIDAY_SG } from './friday'
import type { Lang3 } from './ramadanContent'

/**
 * "Leave for Jumaat": a Friday reminder to get ready and leave for the masjid.
 * Same choices and words in ios Core/JumuahLeave.swift and android core JumuahLeave.kt.
 */

/** Minutes before Jumaat. 0 is off. */
export const JUMUAH_LEAVE_CHOICES = [0, 15, 30, 45, 60, 120]

/** First session at Zohor, or the second one some Singapore masjids hold from 2 PM. */
export type JumuahSession = 'first' | 'second'

/** "14:00", from the Islamic Religious Council of Singapore (MUIS) list in data/friday-sg.json. */
export const SECOND_SESSION_FROM = FRIDAY_SG.secondSessionFrom

/** The older choices 20 and 90 move up to 30 and 120, so the reminder still comes early enough. Anything else is off. */
export function snapLeaveMinutes(m: unknown): number {
  if (m === 20) return 30
  if (m === 90) return 120
  return typeof m === 'number' && JUMUAH_LEAVE_CHOICES.includes(m) ? m : 0
}

/** "15 min", "1 hour", "2 hours" in the alert's language. */
export function leaveSpan(minutes: number, lang: Lang3): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60
    if (lang === 'en') return h === 1 ? '1 hour' : `${h} hours`
    return `${h} jam`
  }
  return lang === 'en' ? `${minutes} min` : lang === 'ms' ? `${minutes} minit` : `${minutes} menit`
}

/** The picker label: "Off", "15 min before", "1 hour before", "2 hours before". */
export function leaveChoiceLabel(minutes: number): string {
  return minutes === 0 ? 'Off' : `${leaveSpan(minutes, 'en')} before`
}

/**
 * The words of the reminder. `name` is the Friday prayer's name in the user's
 * naming ("Jumaat"), `at` the start time already formatted, `where` the masjid
 * when the time comes from it.
 */
export function leaveWords(lang: Lang3, minutes: number, name: string, second: boolean, at: string, where: string | null): { title: string; body: string } {
  const span = leaveSpan(minutes, lang)
  if (lang === 'ms') {
    const solat = `solat ${name}${second ? ' sesi kedua' : ''}`
    return {
      title: `Masa untuk bertolak ke ${solat}`,
      body: `${second ? 'Sesi kedua solat' : 'Solat'} ${name}${where ? ` di ${where}` : ''} bermula pada ${at}, ${span} lagi.`,
    }
  }
  if (lang === 'id') {
    const salat = `salat ${name}${second ? ' sesi kedua' : ''}`
    return {
      title: `Saatnya berangkat untuk ${salat}`,
      body: `${second ? 'Sesi kedua salat' : 'Salat'} ${name}${where ? ` di ${where}` : ''} dimulai pukul ${at}, ${span} lagi.`,
    }
  }
  return {
    title: `Time to leave for ${second ? 'the second ' : ''}${name}`,
    body: `${second ? 'The second ' : ''}${name}${where ? ` at ${where}` : ''} starts ${second ? 'from' : 'at'} ${at}, ${span} from now.`,
  }
}
