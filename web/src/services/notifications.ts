import { isInAsia, placeProfile } from '../core/place'
import { PRAYERS, type Prayer } from '../core/prayer'
import { flag } from '../core/regions'
import type { PrayerDay } from '../core/engine'
import { noonDaysAfter, zoned, zonedTime } from '../core/tz'
import { fridayMosqueAt, inSingapore } from '../core/friday'
import { leaveWords, SECOND_SESSION_FROM } from '../core/jumuahLeave'
import { ALARM_KEY, ALARM_PRAYERS, prayerAlarmTime, sahurRings, sahurTime, wakeUpTime, type AlarmPrayer } from '../core/wakeup'
import { inQuietHours, nudgeAt, windowsOf } from '../core/window'
import { azanUrl, playAzan } from './azan'
import { playAlarm } from './alarmSound'
import { hadithAlertLine, type HadithId } from '../core/hadith'
import { alertLine } from '../core/alertLines'
import { BLESSED_NAME } from '../core/blessed'
import { EXTRA_TIMES, extraMode } from '../core/extraAlerts'
import { blessedNote } from '../core/appWords'
import { earlyMinutes, isAway } from '../core/away'
import { hasAlarm } from '../core/alertMode'
import { store } from './store'
import { tr } from '../core/appWords'
import { ramadanWord } from '../core/ramadanWords'

/**
 * Prayer alerts on the web. A web page cannot schedule an alarm for later the
 * way iOS does (that needs a push server, which this app does not have), so:
 *  - while the app is open (a tab or the installed app window), alerts fire at
 *    the exact time through the service worker's showNotification;
 *  - for alerts when it is closed, the calendar (.ics) export and the official
 *    calendar feeds carry an alarm on every prayer.
 */

export type AlertSupport = 'supported' | 'needs-install' | 'unsupported'

export function alertSupport(): AlertSupport {
  if (typeof window === 'undefined') return 'unsupported'
  // The demo (the website's phone frame) acts as if alerts were allowed, so visitors can tap around.
  if (store.demo) return 'supported'
  if ('Notification' in window) return 'supported'
  // iPhone and iPad Safari only offer notifications to apps added to the Home Screen.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios ? 'needs-install' : 'unsupported'
}

export function permission(): NotificationPermission | 'unsupported' {
  if (store.demo) return 'granted'
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

export async function requestPermission(): Promise<boolean> {
  if (store.demo) return true
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try { return (await Notification.requestPermission()) === 'granted' } catch { return false }
}

interface Alert {
  id: string; title: string; body: string; at: number; prayer?: Prayer
  /** Buzz only: quiet hours or the "buzz only" switch. */
  silent?: boolean
  /** A nudge that is dropped if the prayer is ticked before it fires. */
  unlessPrayed?: { prayer: Prayer; at: number }
}

/** Minutes past local midnight. */
function minuteOfDay(ms: number, tz: string): number {
  const z = zoned(ms, tz)
  return z.hour * 60 + z.minute
}

/** Quiet hours and "buzz only": Subuh always keeps its sound, it is a wake up. */
export function isSilent(at: number, prayer: Prayer | undefined, tz: string): boolean {
  const prefs = store.prefs
  if (prefs.buzzOnly) return true
  if (prayer === 'fajr') return false
  return prefs.quietHours && inQuietHours(minuteOfDay(at, tz), prefs.quietFrom, prefs.quietTo)
}

/** Singapore's choice of the second Friday session applies only while the place shown is in Singapore. */
export function secondJumuahHere(): boolean {
  const place = store.activePlace
  return store.prefs.jumuahSession === 'second' && !!place && inSingapore(place.coordinates, place.countryCode)
}

/**
 * When Jumaat starts on this Friday, for the "Leave for Jumaat" reminder: your
 * masjid's own Jumaat time when it has one, else the start of Zohor. In
 * Singapore you can pick the second session instead, from 2 PM.
 */
export function jumuahStart(day: PrayerDay): { at: number; second: boolean; where: string | null } {
  if (secondJumuahHere()) {
    const [h, m] = SECOND_SESSION_FROM.split(':').map((x) => parseInt(x, 10))
    const mine = store.myMasjidHere
    const where = mine && fridayMosqueAt({ latitude: mine.lat, longitude: mine.lng }) ? mine.name : null
    return { at: zonedTime(day.year, day.month, day.day, h, m, 0, store.timeZone), second: true, where }
  }
  const at = day.jamaah.dhuhr ?? day.times.dhuhr
  return { at, second: false, where: day.jamaah.dhuhr && day.mosqueName ? day.mosqueName : null }
}

/** The coming Friday's reminder (today's while it is still ahead): when it comes and when Jumaat starts. */
export function nextJumuahLeave(now: number): { leave: number; start: number; second: boolean } | null {
  const minutes = store.prefs.jumuahReminderMinutes
  if (minutes <= 0 || !store.activePlace) return null
  for (let offset = 0; offset < 8; offset++) {
    const day = store.day(noonDaysAfter(now, offset, store.timeZone))
    if (!day || !store.isFriday(day.times.dhuhr)) continue
    const j = jumuahStart(day)
    const leave = j.at - minutes * 60_000
    if (leave > now) return { leave, start: j.at, second: j.second }
  }
  return null
}

/** The alerts for the next two days, as the iOS scheduler builds them. */
export function upcomingAlerts(now: number): Alert[] {
  const place = store.activePlace
  const prefs = store.prefs
  const atHome = prefs.reminderMinutesBefore
  const onTime = prefs.notificationsEnabled
  if (!place) return []
  const away = isAway(prefs.home, prefs.homeConfirmed, place)
  const anyEarly = atHome > 0 || (away && prefs.awayReminder && Object.values(prefs.awayMinutes).some((m) => m > 0))
  const wake = wakeUps(now, 2).map((w) => ({ id: w.id, title: w.title, body: w.body, at: w.at }))
  const nudges = prefs.trackerEnabled && prefs.windowNudge && !store.trackerPaused
  const jumuah = prefs.jumuahReminderMinutes
  const tz = place.timeZoneID
  const here = isInAsia(place) ? `${place.name} ${flag(placeProfile(place).code)}` : place.name
  const out: Alert[] = []
  for (let offset = -1; offset < 2; offset++) {
    const day = store.day(noonDaysAfter(now, offset, tz))
    const nextDay = store.day(noonDaysAfter(now, offset + 1, tz))
    if (!day) continue
    if (nudges && nextDay) {
      for (const w of windowsOf(day, nextDay)) {
        if (!prefs.notifyPrayers.includes(w.prayer)) continue
        if (w.prayer === 'isha') continue // open until Subuh: a nudge then would only disturb sleep
        const at = nudgeAt(w)
        const name = store.name(w.prayer, w.start)
        const left = Math.round((w.end - at) / 60_000)
        out.push({
          id: `${day.year}-${day.month}-${day.day}-${w.prayer}-nudge`,
          title: tr('notify.nudgeTitle', { name, n: left }),
          body: tr('notify.nudgeBody', { name, time: store.formatted(w.end) }),
          at, silent: isSilent(at, w.prayer, tz), unlessPrayed: { prayer: w.prayer, at: w.start },
        })
      }
    }
    if (offset < 0) continue
    out.push(...ramadanAlerts(day, here))
    // Rung as an alarm instead (wakeUps) when Ring as an alarm is on.
    if (jumuah > 0 && !prefs.jumuahLeaveAlarm && store.isFriday(day.times.dhuhr)) {
      const j = jumuahStart(day)
      const at = j.at - jumuah * 60_000
      const name = store.name('dhuhr', day.times.dhuhr)
      out.push({
        id: `${day.year}-${day.month}-${day.day}-jumuah`, ...leaveWords(store.appLang, jumuah, name, j.second, store.formatted(j.at), j.where),
        at, silent: isSilent(at, 'dhuhr', tz),
      })
    }
    for (const [b, at] of store.blessed(day)) {
      if (!(EXTRA_TIMES as readonly string[]).includes(b) || extraMode(prefs, b as 'dhuha') !== 'notify') continue
      // The last ten nights already have their own qiyam alert at this time: one alert, not two.
      if (b === 'lastThird' && prefs.qiyamAlert && store.season(day.times.dhuhr).lastTen) continue
      const name = BLESSED_NAME[b]
      out.push({ id: `${day.year}-${day.month}-${day.day}-${b}`, title: `${name} · ${store.formatted(at)}`, body: blessedNote(b), at, silent: isSilent(at, b === 'dhuha' ? 'dhuhr' : 'isha', tz) })
    }
    if (!onTime && !anyEarly) continue
    for (const prayer of PRAYERS) {
      if (!prefs.notifyPrayers.includes(prayer)) continue
      const time = day.times[prayer]
      const name = store.name(prayer, time)
      const id = `${day.year}-${day.month}-${day.day}-${prayer}`
      const silent = isSilent(time, prayer, tz)
      // One early reminder per prayer: the away choice when away from home, else the at-home choice.
      const early = earlyMinutes(prayer, away, prefs.awayReminder, prefs.awayMinutes, atHome, hasAlarm(prefs, prayer))
      if (early > 0) {
        // The heads-up before the prayer, on its own switch: for when a meeting
        // or work would otherwise run past the time.
        out.push({
          id: `${id}-early`, title: prayer === 'sunrise' ? tr('notify.endsIn', { name: store.name('fajr'), n: early }) : early === 60 ? tr('notify.nameInHour', { name }) : tr('notify.nameIn', { name, n: early }),
          body: tr(away && prayer !== 'sunrise' ? 'notify.nameAtAway' : 'notify.nameAt', { name, time: store.formatted(time) }), at: time - early * 60_000, silent: isSilent(time - early * 60_000, prayer, tz),
        })
      }
      if (!onTime) continue
      // An alarm at the same minute rings instead, so it doesn't sound twice.
      if (alarmAtStart(prayer)) continue
      if (prayer === 'sunrise') {
        out.push({ id, title: `${name} · ${store.formatted(time)}`, body: tr('notify.ended', { name: store.name('fajr') }), at: time, silent })
        continue
      }
      if (prayer === 'maghrib' && store.isRamadanDay(time)) {
        out.push({ id, title: tr('notify.iftarName', { name, time: store.formatted(time) }), body: tr('notify.breakFast'), at: time, prayer, silent })
        continue
      }
      out.push({ id, title: `${name} · ${store.formatted(time)}`, body: alertLine(store.appLang, prayer, store.isFriday(time), day.year, day.month, day.day, name), at: time, prayer, silent })
    }
  }
  return [...out, ...wake].filter((a) => a.at > now).sort((a, b) => a.at - b.at)
}


/** "\n“...” al Bukhari" under a wake-up alert, or nothing when Settings, Hadith, alerts is off. */
function alertHadith(id: HadithId): string {
  return store.prefs.hadithInAlerts ? `\n${hadithAlertLine(id, store.appLang)}` : ''
}

export interface WakeUp { id: string; title: string; body: string; at: number; sahur: boolean; prayer?: AlarmPrayer }

/** Is any alarm on: Subuh, sahur or one of the other prayers? */
export function anyAlarm(p = store.prefs): boolean {
  return !!(p.wakeUp || p.sahurAlarm || EXTRA_TIMES.some((b) => extraMode(p, b) === 'alarm') || ALARM_PRAYERS.some((x) => p[ALARM_KEY[x]]) || (p.jumuahLeaveAlarm && p.jumuahReminderMinutes > 0))
}

/** Does this prayer have an alarm at the very start, which stands in for its alert? */
export function alarmAtStart(prayer: string, p = store.prefs): boolean {
  if (prayer === 'fajr') return p.wakeUp === 'atFajr'
  return (ALARM_PRAYERS as readonly string[]).includes(prayer) && p[ALARM_KEY[prayer as AlarmPrayer]] === 'atStart'
}

/** Every alarm (Subuh, sahur and the other prayers) for the next `days` days, soonest first (the same plan as the apps). */
export function wakeUps(now: number, days: number, start = 0): WakeUp[] {
  const place = store.activePlace
  const p = store.prefs
  if (!place || !anyAlarm(p)) return []
  const fajr = store.name('fajr')
  const out: WakeUp[] = []
  for (let offset = start; offset < start + days; offset++) {
    const day = store.day(noonDaysAfter(now, offset, place.timeZoneID))
    if (!day) continue
    const key = `${day.year}-${day.month}-${day.day}`
    if (p.sahurAlarm && sahurRings(day, p.sahurDays, place.timeZoneID, p.hijriAdjustment)) {
      out.push({ id: `${key}-sahur`, title: tr('notify.wakeSahur'), body: tr('notify.atPlace', { name: fajr, time: store.formatted(day.times.fajr), place: place.name }), at: sahurTime(p.sahurAlarm, day), sahur: true })
    }
    if (p.wakeUp) {
      const tahajjud = p.wakeUp === 'fajrMinus30'
      out.push({
        id: `${key}-wake`, title: tahajjud ? tr('notify.wakeTahajjud') : tr('notify.wakeFor', { name: fajr }),
        body: tahajjud ? `${tr('notify.atPlace', { name: fajr, time: store.formatted(day.times.fajr), place: place.name })}${alertHadith('nightPrayer')}` : `${tr('notify.endsAtPlace', { name: fajr, time: store.formatted(day.times.sunrise), place: place.name })}${alertHadith('fajrRakaat')}`,
        at: wakeUpTime(p.wakeUp, day), sahur: false,
      })
    }
    const ends: Record<AlarmPrayer, number> = { dhuhr: day.times.asr, asr: day.times.maghrib, maghrib: day.times.isha, isha: day.times.isha }
    for (const prayer of ALARM_PRAYERS) {
      const t = p[ALARM_KEY[prayer]]
      if (!t) continue
      const begins = day.times[prayer]
      const name = store.name(prayer, begins)
      const end = ends[prayer]
      out.push({
        id: `${key}-${prayer}-alarm`,
        title: t === 'endMinus30' ? tr('notify.endsIn', { name, n: 30 }) : tr('notify.timeFor', { name }),
        body: prayer === 'isha' ? tr('notify.beganAt', { name, time: store.formatted(begins), place: place.name }) : tr('notify.openUntil', { name, time: store.formatted(end), place: place.name }),
        at: prayerAlarmTime(t, begins, end), sahur: false, prayer,
      })
    }
    // Dhuha, the middle of the night and the last third, when set to Alarm.
    for (const [b, at] of store.blessed(day)) {
      if (!(EXTRA_TIMES as readonly string[]).includes(b) || extraMode(p, b as 'dhuha') !== 'alarm') continue
      const name = BLESSED_NAME[b]
      out.push({ id: `${key}-${b}-alarm`, title: tr('notify.timeFor', { name }), body: `${blessedNote(b)} · ${store.formatted(at)} · ${place.name}`, at, sahur: false })
    }
    // Leave for Jumaat, when it rings as an alarm.
    if (p.jumuahLeaveAlarm && p.jumuahReminderMinutes > 0 && store.isFriday(day.times.dhuhr)) {
      const j = jumuahStart(day)
      const w = leaveWords(store.appLang, p.jumuahReminderMinutes, store.name('dhuhr', day.times.dhuhr), j.second, store.formatted(j.at), j.where)
      out.push({ id: `${key}-jumuah-alarm`, ...w, at: j.at - p.jumuahReminderMinutes * 60_000, sahur: false })
    }
  }
  return out.filter((w) => w.at > now).sort((a, b) => a.at - b.at)
}

/** The next alarm, looking a week ahead (the sahur alarm may be days away). */
export function nextWakeUp(now: number): WakeUp | null {
  if (!anyAlarm()) return null
  for (let offset = 0; offset < 8; offset++) {
    const first = wakeUps(now, 1, offset)[0]
    if (first) return first
  }
  return null
}

/**
 * Ramadan's own alerts, on their own switches: Imsak (10 minutes before, to
 * finish sahur), iftar at Maghrib, and qiyam at the last third of the last ten nights.
 */
export function ramadanAlerts(day: PrayerDay, here: string): Alert[] {
  const prefs = store.prefs
  const out: Alert[] = []
  const id = `${day.year}-${day.month}-${day.day}`
  const season = store.season(day.times.dhuhr)
  if (season.phase === 'ramadan') {
    const imsak = store.imsak(day)
    if (prefs.imsakAlert) {
      out.push({ id: `${id}-imsak`, title: tr('notify.imsakIn', { time: store.formatted(imsak) }), body: tr('notify.finishSahur', { name: store.name('fajr'), time: store.formatted(day.times.fajr), place: here }), at: imsak - 10 * 60_000, silent: isSilent(imsak - 10 * 60_000, 'fajr', store.activePlace?.timeZoneID ?? 'UTC') })
    }
    // When the Maghrib alert is on it says this itself, so one alert, not two.
    const maghribAlert = prefs.notificationsEnabled && prefs.notifyPrayers.includes('maghrib')
    if (prefs.berbukaAlert && !maghribAlert) {
      out.push({ id: `${id}-berbuka`, title: tr('notify.iftar', { time: store.formatted(day.times.maghrib) }), body: `${tr('notify.breakFast')}. ${ramadanWord(store.appLang, 'ramadanDay', { n: season.ramadanDay ?? '' })} · ${here}`, at: day.times.maghrib, silent: isSilent(day.times.maghrib, 'maghrib', store.activePlace?.timeZoneID ?? 'UTC') })
    }
  }
  if (prefs.qiyamAlert && season.lastTen && season.nightTonight) {
    const last = store.blessed(day).find(([b]) => b === 'lastThird')
    if (last) {
      out.push({ id: `${id}-qiyam`, title: tr('notify.qiyamTitle', { night: season.nightTonight }), body: tr(season.oddNight ? 'notify.qiyamOdd' : 'notify.qiyamEven'), at: last[1], silent: isSilent(last[1], 'isha', store.activePlace?.timeZoneID ?? 'UTC') })
    }
  }
  return out
}

const isAlarm = (id: string): boolean => id.endsWith('-wake') || id.endsWith('-sahur') || id.endsWith('-alarm')

let timer: ReturnType<typeof setTimeout> | null = null
const fired = new Set<string>()

/** Arms a timer for the next alert; called whenever times or settings change and every minute. */
export function scheduleAlerts(): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (store.demo || permission() !== 'granted') return
  const now = Date.now()
  const next = upcomingAlerts(now).find((a) => !fired.has(a.id))
  if (!next) return
  // Timers drift while a tab sleeps; re-arm at most every minute and fire within 60 s of the time.
  const wait = Math.min(next.at - now, 60_000)
  timer = setTimeout(() => {
    const t = Date.now()
    if (t >= next.at && t - next.at < 60_000 && !fired.has(next.id)) {
      fired.add(next.id)
      const done = next.unlessPrayed && (store.isPrayed(next.unlessPrayed.prayer, next.unlessPrayed.at) || store.isExcused(next.unlessPrayed.at))
      if (!done) {
        void show(next.title, next.body, next.id, next.silent)
        if (isAlarm(next.id)) playAlarm(store.prefs.alarmSound)
        else if (next.prayer && store.prefs.azanSound && !next.silent) playAzan(azanUrl(store.prefs.azanVoice, store.prefs.azanFull, next.prayer === 'fajr'))
      }
    }
    scheduleAlerts()
  }, Math.max(0, wait))
}

export async function show(title: string, body: string, tag: string, silent = false): Promise<void> {
  const options: NotificationOptions = { body, tag, silent, requireInteraction: tag.endsWith('-early') || isAlarm(tag), icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, badge: `${import.meta.env.BASE_URL}icons/badge-96.png` }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) { await reg.showNotification(title, options); return }
  } catch { /* fall back below */ }
  try { new Notification(title, options) } catch { /* not allowed here */ }
}

/** The test alert arrives a few seconds after the tap, so the person can lock the screen first. */
export const TEST_ALERT_DELAY_MS = 3000

/** Sends a sample alert in a few seconds, the way a real one arrives. Says 'blocked' when the browser will not show alerts. */
export async function testAlert(): Promise<'sent' | 'blocked'> {
  if (alertSupport() !== 'supported' || !(await requestPermission())) return 'blocked'
  const now = store.now()
  const cur = store.current(now)
  const name = cur ? store.name(cur.prayer, cur.time) : 'Prayer'
  setTimeout(() => {
    const quiet = store.prefs.buzzOnly
    void show(tr('notify.testTitle', { name }), tr('notify.testBody'), 'test', quiet)
    if (store.prefs.azanSound && !quiet) playAzan(azanUrl(store.prefs.azanVoice, store.prefs.azanFull))
  }, TEST_ALERT_DELAY_MS)
  return 'sent'
}

/** Local times "HH:mm" for a calendar description. */
function hm(ms: number, tz: string): string {
  const z = zoned(ms, tz)
  return `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`
}

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

/**
 * An .ics with the next `days` days of the times shown in the app, each with an
 * alarm at the time (and the early reminder, if set). Calendars on every phone
 * ring these even when the browser is closed.
 */
export function buildICS(days = 30, prayers: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']): string | null {
  const place = store.activePlace
  if (!place) return null
  const tz = place.timeZoneID
  const now = store.now()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prayer Times Asia//Web//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`Prayer times · ${place.name}`)}`]
  const early = store.prefs.reminderMinutesBefore
  for (let i = 0; i < days; i++) {
    const day = store.day(noonDaysAfter(now, i, tz))
    if (!day) continue
    for (const p of prayers) {
      const t = day.times[p]
      const name = store.name(p, t)
      const source = day.officialSource ?? `${store.method.shortName} method`
      lines.push('BEGIN:VEVENT', `UID:web-${day.year}-${day.month}-${day.day}-${p}-${place.coordinates.latitude.toFixed(3)}@prayertimes.asia`,
        `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(t)}`, 'DURATION:PT15M', `SUMMARY:${esc(name)}`,
        `DESCRIPTION:${esc(`${name} begins ${hm(t, tz)} in ${place.name}. Source: ${source}.`)}`, 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(name)}`, 'TRIGGER:PT0M', 'END:VALARM')
      if (early > 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${name} in ${early} min`)}`, `TRIGGER:-PT${early}M`, 'END:VALARM')
      lines.push('END:VEVENT')
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/**
 * The next `days` days of wake-up alarms as calendar events, each with an alarm
 * at its time. A phone's calendar rings these even when the browser is closed,
 * so this is how the web app gives a real wake-up.
 */
export function buildWakeICS(days = 30): string | null {
  const place = store.activePlace
  if (!place) return null
  const now = store.now()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prayer Times Asia//Web//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`Prayer alarms · ${place.name}`)}`]
  for (const w of wakeUps(now, days)) {
    lines.push('BEGIN:VEVENT', `UID:web-${w.id}-${place.coordinates.latitude.toFixed(3)}@prayertimes.asia`,
      `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(w.at)}`, 'DURATION:PT10M', `SUMMARY:${esc(w.title)}`,
      `DESCRIPTION:${esc(w.body)}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(w.title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

export function downloadWakeICS(): void {
  const text = buildWakeICS()
  if (!text) return
  save(text, `prayer-alarms-${(store.activePlace?.name ?? 'here').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`)
}

function save(text: string, name: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** The two prayers that fall in office or school hours. */
export const WORK_PRAYERS: Prayer[] = ['dhuhr', 'asr']

export function downloadICS(prayers?: Prayer[]): void {
  const text = buildICS(30, prayers)
  if (!text) return
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `prayer-times-${prayers ? 'work-' : ''}${(store.activePlace?.name ?? 'here').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
