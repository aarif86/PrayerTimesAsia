import { isInAsia, placeProfile } from '../core/place'
import { PRAYERS, type Prayer } from '../core/prayer'
import { flag } from '../core/regions'
import type { PrayerDay } from '../core/engine'
import { zoned } from '../core/tz'
import { sahurRings, sahurTime, wakeUpTime } from '../core/wakeup'
import { playAzan } from './azan'
import { store } from './store'

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
  if ('Notification' in window) return 'supported'
  // iPhone and iPad Safari only offer notifications to apps added to the Home Screen.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios ? 'needs-install' : 'unsupported'
}

export function permission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try { return (await Notification.requestPermission()) === 'granted' } catch { return false }
}

interface Alert { id: string; title: string; body: string; at: number; prayer?: Prayer }

/** The alerts for the next two days, as the iOS scheduler builds them. */
export function upcomingAlerts(now: number): Alert[] {
  const place = store.activePlace
  const prefs = store.prefs
  const early = prefs.reminderMinutesBefore
  const onTime = prefs.notificationsEnabled
  if (!place) return []
  const wake = wakeUps(now, 2).map((w) => ({ id: w.id, title: w.title, body: w.body, at: w.at }))
  const here = isInAsia(place) ? `${place.name} ${flag(placeProfile(place).code)}` : place.name
  const out: Alert[] = []
  for (let offset = 0; offset < 2; offset++) {
    const day = store.day(now + offset * 86_400_000)
    if (!day) continue
    out.push(...ramadanAlerts(day, here))
    if (!onTime && early <= 0) continue
    for (const prayer of PRAYERS) {
      if (!prefs.notifyPrayers.includes(prayer)) continue
      const time = day.times[prayer]
      const name = store.name(prayer, time)
      const id = `${day.year}-${day.month}-${day.day}-${prayer}`
      if (early > 0) {
        // The heads-up before the prayer, on its own switch: for when a meeting
        // or work would otherwise run past the time.
        out.push({
          id: `${id}-early`, title: prayer === 'sunrise' ? `${store.name('fajr')} ends in ${early} min` : `${name} in ${early} min`,
          body: `${name} at ${store.formatted(time)} · ${here}`, at: time - early * 60_000,
        })
      }
      if (!onTime) continue
      if (prayer === 'sunrise') {
        out.push({ id, title: `${name} · ${store.formatted(time)}`, body: `${store.name('fajr')} has ended. ${here}`, at: time })
        continue
      }
      if (prayer === 'maghrib' && store.isRamadanDay(time)) {
        out.push({ id, title: `Time to berbuka · ${name} ${store.formatted(time)}`, body: `Allahumma laka sumtu wa bika amantu wa 'ala rizqika aftartu · ${here}`, at: time, prayer })
        continue
      }
      out.push({ id, title: `${name} · ${store.formatted(time)}`, body: `It's time for ${name} in ${here}`, at: time, prayer })
    }
  }
  return [...out, ...wake].filter((a) => a.at > now).sort((a, b) => a.at - b.at)
}

export interface WakeUp { id: string; title: string; body: string; at: number; sahur: boolean }

/** The Subuh alarm and the sahur alarm for the next `days` days, soonest first (the same plan as the apps). */
export function wakeUps(now: number, days: number, start = 0): WakeUp[] {
  const place = store.activePlace
  const p = store.prefs
  if (!place || (!p.wakeUp && !p.sahurAlarm)) return []
  const fajr = store.name('fajr')
  const out: WakeUp[] = []
  for (let offset = start; offset < start + days; offset++) {
    const day = store.day(now + offset * 86_400_000)
    if (!day) continue
    const key = `${day.year}-${day.month}-${day.day}`
    if (p.sahurAlarm && sahurRings(day, p.sahurDays, place.timeZoneID, p.hijriAdjustment)) {
      out.push({ id: `${key}-sahur`, title: 'Wake up for sahur', body: `${fajr} at ${store.formatted(day.times.fajr)} · ${place.name}`, at: sahurTime(p.sahurAlarm, day), sahur: true })
    }
    if (p.wakeUp) {
      const tahajjud = p.wakeUp === 'fajrMinus30'
      out.push({
        id: `${key}-wake`, title: tahajjud ? 'Wake up for tahajjud' : `Wake up for ${fajr}`,
        body: tahajjud ? `${fajr} at ${store.formatted(day.times.fajr)} · ${place.name}` : `${fajr} ends at ${store.formatted(day.times.sunrise)} · ${place.name}`,
        at: wakeUpTime(p.wakeUp, day), sahur: false,
      })
    }
  }
  return out.filter((w) => w.at > now).sort((a, b) => a.at - b.at)
}

/** The next alarm, looking a week ahead (the sahur alarm may be days away). */
export function nextWakeUp(now: number): WakeUp | null {
  if (!store.prefs.wakeUp && !store.prefs.sahurAlarm) return null
  for (let offset = 0; offset < 8; offset++) {
    const first = wakeUps(now, 1, offset)[0]
    if (first) return first
  }
  return null
}

/**
 * Ramadan's own alerts, on their own switches: Imsak (10 minutes before, to
 * finish sahur), Berbuka at Maghrib, and qiyam at the last third of the last ten nights.
 */
export function ramadanAlerts(day: PrayerDay, here: string): Alert[] {
  const prefs = store.prefs
  const out: Alert[] = []
  const id = `${day.year}-${day.month}-${day.day}`
  const season = store.season(day.times.dhuhr)
  if (season.phase === 'ramadan') {
    const imsak = store.imsak(day)
    if (prefs.imsakAlert) {
      out.push({ id: `${id}-imsak`, title: `Imsak in 10 minutes · ${store.formatted(imsak)}`, body: `Finish your sahur. Subuh at ${store.formatted(day.times.fajr)} · ${here}`, at: imsak - 10 * 60_000 })
    }
    // When the Maghrib alert is on it says this itself, so one alert, not two.
    const maghribAlert = prefs.notificationsEnabled && prefs.notifyPrayers.includes('maghrib')
    if (prefs.berbukaAlert && !maghribAlert) {
      out.push({ id: `${id}-berbuka`, title: `Time to berbuka · ${store.formatted(day.times.maghrib)}`, body: `Allahumma laka sumtu wa bika amantu wa 'ala rizqika aftartu. Ramadan day ${season.ramadanDay} · ${here}`, at: day.times.maghrib })
    }
  }
  if (prefs.qiyamAlert && season.lastTen && season.nightTonight) {
    const last = store.blessed(day).find(([b]) => b === 'lastThird')
    if (last) {
      out.push({ id: `${id}-qiyam`, title: `Night ${season.nightTonight} · the last third has begun`, body: season.oddNight ? 'An odd night of the last ten. Seek Lailatul Qadr.' : 'One of the last ten nights of Ramadan.', at: last[1] })
    }
  }
  return out
}

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
      void show(next.title, next.body, next.id)
      if (next.prayer && store.prefs.azanSound) playAzan(next.prayer === 'fajr')
    }
    scheduleAlerts()
  }, Math.max(0, wait))
}

export async function show(title: string, body: string, tag: string): Promise<void> {
  const options: NotificationOptions = { body, tag, requireInteraction: tag.endsWith('-early') || tag.endsWith('-wake') || tag.endsWith('-sahur'), icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, badge: `${import.meta.env.BASE_URL}icons/badge-96.png` }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) { await reg.showNotification(title, options); return }
  } catch { /* fall back below */ }
  try { new Notification(title, options) } catch { /* not allowed here */ }
}

export function testAlert(): void {
  const now = store.now()
  const cur = store.current(now)
  const name = cur ? store.name(cur.prayer, cur.time) : 'Prayer'
  void show(`${name} · test alert`, 'This is how prayer alerts will look on this device.', 'test')
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
    const day = store.day(now + i * 86_400_000)
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
    `X-WR-CALNAME:${esc(`Wake up for ${store.name('fajr')} · ${place.name}`)}`]
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
  save(text, `wake-up-${(store.activePlace?.name ?? 'here').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`)
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

export function downloadICS(): void {
  const text = buildICS()
  if (!text) return
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `prayer-times-${(store.activePlace?.name ?? 'here').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
