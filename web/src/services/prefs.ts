import type { MasjidLink } from '../core/masjidLink'
import type { Place } from '../core/place'
import type { FastMark } from '../core/ramadanContent'
import { SEASON_PREVIEWS, type SeasonPreview } from '../core/season'
import { NAMING_STYLES, OBLIGATORY, type AsrSchool, type NamingStyle, type Prayer } from '../core/prayer'
import {
  ALARM_SOUNDS, DEFAULT_SAHUR_DAYS, PRAYER_ALARM_TIMINGS, SAHUR_DAYS, SAHUR_TIMINGS, WAKE_UP_TIMINGS,
  type AlarmSound, type PrayerAlarmTiming, type SahurDay, type SahurTiming, type WakeUpTiming,
} from '../core/wakeup'

export type Appearance = 'system' | 'light' | 'dark'
export const APPEARANCES: Appearance[] = ['system', 'light', 'dark']
export const APPEARANCE_LABEL: Record<Appearance, string> = {
  system: 'Automatic (follows the sky)', light: 'Light', dark: 'Dark',
}

/** How the Prayer screen shows the day (same order as the iOS TodayStyle). */
export type TodayStyle = 'list' | 'centre' | 'dial' | 'sunPath' | 'bands' | 'simple'
export const TODAY_STYLES: TodayStyle[] = ['centre', 'list', 'dial', 'sunPath', 'bands', 'simple']
export const TODAY_STYLE_LABEL: Record<TodayStyle, string> = {
  list: 'Side Dial', centre: 'Centre Dial', dial: 'Day Dial', sunPath: 'Sun Path', bands: 'Colour Bands', simple: 'Big and Simple',
}

export interface TripStop { countryCode: string; countryName: string; placeName: string; arrived: number }

/**
 * Everything the user chooses, kept in this browser only. `null` overrides mean
 * "automatic for the country I'm in" - the travel-mode behaviour.
 */
export interface Preferences {
  hasOnboarded: boolean
  useGPS: boolean
  manualPlace: Place | null
  savedPlaces: Place[]
  home: Place | null
  methodOverrideID: string | null
  asrOverride: AsrSchool | null
  namingOverride: NamingStyle | null
  use24Hour: boolean
  hijriAdjustment: number
  notificationsEnabled: boolean
  notifyPrayers: Prayer[]
  /** Minutes before each chosen prayer for "Reminder before prayer"; 0 = off. Separate from the alert at the time itself. */
  reminderMinutesBefore: number
  /** Prayer time alerts play the azan (a Subuh azan at Subuh) when the app has the recordings - see services/azan.ts. */
  azanSound: boolean
  musafirThresholdKm: number
  jakimZoneOverride: string | null
  lastCountryCode: string | null
  arrivedAt: number | null
  arrivalBannerDismissed: boolean
  /** The big "Musafir" line was closed for this trip; the luggage button stays with the other buttons. Reset on each new arrival. */
  musafirChipDismissed: boolean
  trip: TripStop[]
  trackerEnabled: boolean
  prayedLog: Record<string, Prayer[]>
  excusedDays: string[]
  /** "yyyy-MM-dd" the tracker was paused (haid, nifas, illness); every day from then until it is ended counts as excused. */
  trackerPausedSince: string | null
  /** The Subuh alarm; null = off. On the web it rings only while the app is open (or through the calendar file). */
  wakeUp: WakeUpTiming | null
  /** The earlier sahur alarm; null = off. Rings only on `sahurDays`. */
  sahurAlarm: SahurTiming | null
  sahurDays: SahurDay[]
  /** Alarms for the other prayers (null = off), and the sound every alarm plays. */
  dhuhrAlarm: PrayerAlarmTiming | null
  asrAlarm: PrayerAlarmTiming | null
  maghribAlarm: PrayerAlarmTiming | null
  ishaAlarm: PrayerAlarmTiming | null
  alarmSound: AlarmSound
  communityAuthority: string | null
  appearance: Appearance
  todayStyle: TodayStyle
  showOffers: boolean
  musafirEnabled: boolean
  showLocalNames: boolean
  alertsPromptDismissed: boolean
  appPromptDismissed: boolean
  /** The masjid whose iqamah times show on the Prayer screen, from its screen's QR code. */
  myMasjid: MasjidLink | null
  /** Anonymous usage counts (city and country, never coordinates). See services/usage.ts. */
  shareUsage: boolean
  // Ramadan and Syawal
  /** For testers: pretend today is a day in Ramadan or Syawal. Never moved to another phone. */
  seasonPreview: SeasonPreview
  /** "Imsak in 10 minutes" in Ramadan. */
  imsakAlert: boolean
  /** "Time to berbuka" at Maghrib in Ramadan. */
  berbukaAlert: boolean
  /** The last ten nights: a gentle alert at the last third of the night. */
  qiyamAlert: boolean
  /** Ramadan screen: a juz a day to finish the Quran in the month. */
  khatamPlan: boolean
  /** "yyyy-MM-dd" to how that day's fast went (fasted, a reason it was missed, a replaced or Syawal fast). */
  fastLog: Record<string, FastMark>
  /** Days Tarawih was prayed. */
  tarawihLog: string[]
  /** Days the day's juz was read. */
  quranLog: string[]
  /** Hijri years zakat fitrah was paid. */
  zakatPaid: number[]
  /** Tracker users: one nudge before a prayer's time runs out, if it isn't ticked. */
  windowNudge: boolean
  /** Alerts go silent (buzz only) between these minutes past midnight; Subuh still rings. */
  quietHours: boolean
  quietFrom: number
  quietTo: number
  /** Every alert buzzes only, never a sound. */
  buzzOnly: boolean
  /** Bigger text everywhere, for older eyes. */
  largeText: boolean
  /** Fridays: a reminder this many minutes before Jumaat (0 = off). */
  jumuahReminderMinutes: number
}

export const DEFAULT_PREFS: Preferences = {
  hasOnboarded: false,
  useGPS: true,
  manualPlace: null,
  savedPlaces: [],
  home: null,
  methodOverrideID: null,
  asrOverride: null,
  namingOverride: null,
  use24Hour: false,
  hijriAdjustment: 0,
  notificationsEnabled: false,
  notifyPrayers: [...OBLIGATORY],
  reminderMinutesBefore: 0,
  azanSound: true,
  musafirThresholdKm: 81,
  jakimZoneOverride: null,
  lastCountryCode: null,
  arrivedAt: null,
  arrivalBannerDismissed: true,
  musafirChipDismissed: false,
  trip: [],
  trackerEnabled: false,
  prayedLog: {},
  excusedDays: [],
  trackerPausedSince: null,
  wakeUp: null,
  sahurAlarm: null,
  sahurDays: [...DEFAULT_SAHUR_DAYS],
  dhuhrAlarm: null,
  asrAlarm: null,
  maghribAlarm: null,
  ishaAlarm: null,
  alarmSound: 'classic',
  communityAuthority: null,
  appearance: 'system',
  todayStyle: 'centre',
  showOffers: true,
  musafirEnabled: false,
  showLocalNames: true,
  alertsPromptDismissed: false,
  appPromptDismissed: false,
  myMasjid: null,
  shareUsage: true,
  seasonPreview: 'off',
  imsakAlert: true,
  berbukaAlert: true,
  qiyamAlert: false,
  khatamPlan: false,
  fastLog: {},
  tarawihLog: [],
  quranLog: [],
  zakatPaid: [],
  windowNudge: true,
  quietHours: false,
  quietFrom: 23 * 60,
  quietTo: 6 * 60,
  buzzOnly: false,
  largeText: false,
  jumuahReminderMinutes: 0,
}

const NULLABLE = new Set<keyof Preferences>([
  'manualPlace', 'home', 'methodOverrideID', 'asrOverride', 'namingOverride', 'jakimZoneOverride',
  'lastCountryCode', 'arrivedAt', 'communityAuthority', 'myMasjid', 'trackerPausedSince', 'wakeUp', 'sahurAlarm',
  'dhuhrAlarm', 'asrAlarm', 'maghribAlarm', 'ishaAlarm',
])

const ENUMS: Partial<Record<keyof Preferences, readonly string[]>> = {
  appearance: ['system', 'light', 'dark'],
  todayStyle: ['list', 'centre', 'dial', 'sunPath', 'bands', 'simple'],
  asrOverride: ['standard', 'hanafi'],
  namingOverride: NAMING_STYLES,
  seasonPreview: SEASON_PREVIEWS,
  wakeUp: WAKE_UP_TIMINGS,
  sahurAlarm: SAHUR_TIMINGS,
  dhuhrAlarm: PRAYER_ALARM_TIMINGS,
  asrAlarm: PRAYER_ALARM_TIMINGS,
  maghribAlarm: PRAYER_ALARM_TIMINGS,
  ishaAlarm: PRAYER_ALARM_TIMINGS,
  alarmSound: ALARM_SOUNDS,
}

/**
 * Field by field with defaults, so adding a preference in an update never throws
 * away the ones a user already set (same rule as the iOS Preferences decoder).
 */
export function decodePreferences(raw: unknown): Preferences {
  const out: Preferences = structuredClone(DEFAULT_PREFS)
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const key of Object.keys(DEFAULT_PREFS) as (keyof Preferences)[]) {
    if (!(key in r)) continue
    const v = r[key]
    const d = DEFAULT_PREFS[key]
    if (v === null) { if (NULLABLE.has(key)) (out as unknown as Record<string, unknown>)[key] = null; continue }
    const allowed = ENUMS[key]
    if (allowed && !(typeof v === 'string' && allowed.includes(v))) continue
    if (NULLABLE.has(key) && d === null) {
      // Nullable values: accept the right primitive or an object (places).
      if ((key === 'manualPlace' || key === 'home') && !isPlace(v)) continue
      if (key === 'arrivedAt' && typeof v !== 'number') continue
      if (key === 'myMasjid' && !isMasjid(v)) continue
      if (['methodOverrideID', 'jakimZoneOverride', 'lastCountryCode', 'communityAuthority'].includes(key) && typeof v !== 'string') continue
      if (key === 'trackerPausedSince' && !(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))) continue
      ;(out as unknown as Record<string, unknown>)[key] = v
      continue
    }
    if (Array.isArray(d)) {
      if (!Array.isArray(v)) continue
      if (key === 'savedPlaces') (out as unknown as Record<string, unknown>)[key] = v.filter(isPlace)
      else if (key === 'sahurDays') (out as unknown as Record<string, unknown>)[key] = SAHUR_DAYS.filter((d) => v.includes(d))
      else (out as unknown as Record<string, unknown>)[key] = v
      continue
    }
    if (typeof d === 'object') { if (typeof v === 'object' && !Array.isArray(v)) (out as unknown as Record<string, unknown>)[key] = v; continue }
    if (typeof v === typeof d) (out as unknown as Record<string, unknown>)[key] = v
  }
  // Minutes past midnight must be a real time of day.
  for (const k of ['quietFrom', 'quietTo'] as const) if (!Number.isInteger(out[k]) || out[k] < 0 || out[k] >= 1440) out[k] = DEFAULT_PREFS[k]
  if (!JUMUAH_REMINDER_CHOICES.includes(out.jumuahReminderMinutes)) out.jumuahReminderMinutes = 0
  // Isyak is open until Subuh: it has no "before it ends" alarm.
  if (out.ishaAlarm === 'endMinus30') out.ishaAlarm = null
  return out
}

function isMasjid(v: unknown): v is MasjidLink {
  const m = v as MasjidLink
  return !!m && typeof m === 'object' && typeof m.name === 'string' && typeof m.lat === 'number' &&
    typeof m.lng === 'number' && typeof m.tz === 'string' && !!m.jamaah && typeof m.jamaah === 'object'
}

function isPlace(v: unknown): v is Place {
  const p = v as Place
  return !!p && typeof p === 'object' && typeof p.name === 'string' && typeof p.timeZoneID === 'string' &&
    !!p.coordinates && typeof p.coordinates.latitude === 'number' && typeof p.coordinates.longitude === 'number'
}

const KEY = 'ptasia.preferences.v1'

export function loadPreferences(): Preferences {
  try {
    const s = localStorage.getItem(KEY)
    return s ? decodePreferences(JSON.parse(s)) : structuredClone(DEFAULT_PREFS)
  } catch {
    return structuredClone(DEFAULT_PREFS)
  }
}

export function savePreferences(p: Preferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode: keep in memory */ }
}

/** "Reminder before prayer": on at 15 minutes, any of these to choose from. */
export const DEFAULT_REMINDER_MINUTES = 15
export const REMINDER_CHOICES = [5, 10, 15, 20, 30, 45, 60]

/** "Leave for Jumaat": how long before the khutbah. 0 is off. */
export const JUMUAH_REMINDER_CHOICES = [0, 20, 30, 45, 60, 90]
