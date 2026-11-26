import { AWAY_CHOICES } from './away'
import { OBLIGATORY, type Prayer } from './prayer'
import type { PrayerAlarmTiming, WakeUpTiming } from './wakeup'

/**
 * One choice per prayer in "Alerts and alarms": Off, Notify or Alarm.
 * Same rules in ios Core/AlertMode.swift and android core AlertMode.kt.
 *
 * Nothing new is saved. The choice is read from the settings the app already had:
 * Notify is a prayer in notifyPrayers (with notificationsEnabled), Alarm is that
 * prayer's alarm (wakeUp for Subuh). A prayer can have an alarm and a notification
 * when it begins, which the Alarm page shows as "Notification too".
 */
export type AlertMode = 'off' | 'notify' | 'alarm'
export const ALERT_MODES: readonly AlertMode[] = ['off', 'notify', 'alarm']

/** The settings this reads and changes, so tests can pass a plain object. */
export interface AlertPrefs {
  notificationsEnabled: boolean
  notifyPrayers: Prayer[]
  reminderMinutesBefore: number
  wakeUp: WakeUpTiming | null
  dhuhrAlarm: PrayerAlarmTiming | null
  asrAlarm: PrayerAlarmTiming | null
  maghribAlarm: PrayerAlarmTiming | null
  ishaAlarm: PrayerAlarmTiming | null
  jumuahReminderMinutes: number
  jumuahLeaveAlarm: boolean
  azanSound?: boolean
  awayMinutes?: Record<string, number>
}

/** Syuruk is only a note that Subuh has ended: no alarm for it. */
export function modesFor(prayer: Prayer): AlertMode[] {
  return prayer === 'sunrise' ? ['off', 'notify'] : ['off', 'notify', 'alarm']
}

export function hasAlarm(p: AlertPrefs, prayer: Prayer): boolean {
  switch (prayer) {
    case 'fajr': return p.wakeUp != null
    case 'dhuhr': return p.dhuhrAlarm != null
    case 'asr': return p.asrAlarm != null
    case 'maghrib': return p.maghribAlarm != null
    case 'isha': return p.ishaAlarm != null
    default: return false
  }
}

/** A notification when the prayer begins. */
export function notifies(p: AlertPrefs, prayer: Prayer): boolean {
  return p.notificationsEnabled && p.notifyPrayers.includes(prayer)
}

export function alertMode(p: AlertPrefs, prayer: Prayer): AlertMode {
  if (hasAlarm(p, prayer)) return 'alarm'
  return notifies(p, prayer) ? 'notify' : 'off'
}

function setAlarm(p: AlertPrefs, prayer: Prayer, on: boolean): void {
  switch (prayer) {
    case 'fajr': p.wakeUp = on ? (p.wakeUp ?? 'atFajr') : null; break
    case 'dhuhr': p.dhuhrAlarm = on ? (p.dhuhrAlarm ?? 'atStart') : null; break
    case 'asr': p.asrAlarm = on ? (p.asrAlarm ?? 'atStart') : null; break
    case 'maghrib': p.maghribAlarm = on ? (p.maghribAlarm ?? 'atStart') : null; break
    case 'isha': p.ishaAlarm = on ? (p.ishaAlarm ?? 'atStart') : null; break
  }
}

/** Turn the notification when a prayer begins on or off, leaving its alarm alone. */
export function setNotify(p: AlertPrefs, prayer: Prayer, on: boolean): void {
  if (on) {
    // Alerts were never turned on: the old list (all five) was only a default, so start from this one prayer.
    if (!p.notificationsEnabled) { p.notificationsEnabled = true; p.notifyPrayers = [] }
    if (!p.notifyPrayers.includes(prayer)) p.notifyPrayers = [...p.notifyPrayers, prayer]
  } else {
    p.notifyPrayers = p.notifyPrayers.filter((x) => x !== prayer)
  }
}

/**
 * Change one prayer. Off clears both. Notify clears the alarm. Alarm keeps a
 * notification the prayer already had, so a 30 min tahajjud alarm still leaves the
 * Subuh notification at Subuh. An alarm at the very start takes its place anyway.
 */
export function setAlertMode(p: AlertPrefs, prayer: Prayer, mode: AlertMode): void {
  if (mode === 'off') { setAlarm(p, prayer, false); setNotify(p, prayer, false); return }
  if (mode === 'notify') { setAlarm(p, prayer, false); setNotify(p, prayer, true); return }
  if (prayer === 'sunrise') { setNotify(p, prayer, true); return }
  setAlarm(p, prayer, true)
}

/** All five main prayers are on Notify (no Off, no Alarm). Sunrise does not count. */
export function allFiveNotify(p: AlertPrefs): boolean {
  return OBLIGATORY.every((x) => alertMode(p, x) === 'notify')
}

/**
 * "Notify me for all 5 prayers": every main prayer that is Off goes to Notify.
 * A prayer on Alarm stays on Alarm. Sunrise is not touched.
 */
export function notifyAllFive(p: AlertPrefs): void {
  // Alerts were never turned on: an old saved list is only a leftover, so start clean (same as setNotify).
  if (!p.notificationsEnabled) { p.notificationsEnabled = true; p.notifyPrayers = [] }
  for (const x of OBLIGATORY) if (!p.notifyPrayers.includes(x)) p.notifyPrayers = [...p.notifyPrayers, x]
}

/** What "Set for all prayers" can do: Off, Notification, Short azan (a notification that plays it) or Alarm. */
export type AllLevel = 'off' | 'notify' | 'azan' | 'alarm'
export const ALL_LEVELS: readonly AllLevel[] = ['off', 'notify', 'azan', 'alarm']

/**
 * "Set for all prayers": one choice for the five main prayers at once.
 * Sunrise and Jumu'ah are not touched. Short azan is a notification, and the
 * azan sound is one setting for the whole app, so Notification turns it off and
 * Short azan turns it on. Fajr (Subuh) is left alone when includeFajr is false,
 * so a Fajr alarm someone set up carefully is never replaced by accident.
 * early: minutes for the single early reminder, or null to leave it as it is.
 */
export function applyToAllFive(p: AlertPrefs, level: AllLevel, early: number | null, includeFajr = true): void {
  for (const x of OBLIGATORY) {
    if (x === 'fajr' && !includeFajr) continue
    setAlertMode(p, x, level === 'azan' ? 'notify' : level)
  }
  if (level === 'notify') p.azanSound = false
  if (level === 'azan') p.azanSound = true
  if (early !== null) {
    p.reminderMinutesBefore = early
    // Away from home the app uses its own minutes for each prayer, so they follow the same choice.
    // A Fajr that has an alarm keeps its own (Off), so the two never ring together.
    const away = early === 0 ? 0 : AWAY_CHOICES.reduce((best, c) => (Math.abs(c - early) < Math.abs(best - early) ? c : best), AWAY_CHOICES[0] as number)
    const next = { ...(p.awayMinutes ?? {}) }
    for (const x of OBLIGATORY) {
      if (x === 'fajr' && (!includeFajr || hasAlarm(p, 'fajr'))) continue
      next[x] = away
    }
    p.awayMinutes = next
  }
}

/** The bell on the Prayer screen: Off, then Notify, then Alarm, then Off again. */
export function nextAlertMode(p: AlertPrefs, prayer: Prayer): AlertMode {
  const modes = modesFor(prayer)
  return modes[(modes.indexOf(alertMode(p, prayer)) + 1) % modes.length]
}

/** Leave for Jumaat, the Friday row: Off, Notify or Alarm, 30 min before unless already set. */
export function fridayMode(p: AlertPrefs): AlertMode {
  if (p.jumuahReminderMinutes <= 0) return 'off'
  return p.jumuahLeaveAlarm ? 'alarm' : 'notify'
}

export const DEFAULT_FRIDAY_MINUTES = 30

export function setFridayMode(p: AlertPrefs, mode: AlertMode): void {
  if (mode === 'off') { p.jumuahReminderMinutes = 0; p.jumuahLeaveAlarm = false; return }
  if (p.jumuahReminderMinutes <= 0) p.jumuahReminderMinutes = DEFAULT_FRIDAY_MINUTES
  p.jumuahLeaveAlarm = mode === 'alarm'
}

/**
 * The one case the single screen could not show truthfully: "Reminder before
 * prayer" on while "Prayer time alerts" was off. Those people were told before each
 * prayer, so the screen shows those prayers as Notify and they now also get the
 * notification at the time. Run on every load; it does nothing a second time.
 */
export function unifyAlerts(p: AlertPrefs): void {
  if (!p.notificationsEnabled && p.reminderMinutesBefore > 0 && p.notifyPrayers.length > 0) p.notificationsEnabled = true
}
