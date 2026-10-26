import { isInAsia, placeProfile } from '../core/place'
import { PRAYERS, type Prayer } from '../core/prayer'
import { flag } from '../core/regions'
import { zoned } from '../core/tz'
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

interface Alert { id: string; title: string; body: string; at: number }

/** The alerts for the next two days, as the iOS scheduler builds them. */
export function upcomingAlerts(now: number): Alert[] {
  const place = store.activePlace
  if (!place || !store.prefs.notificationsEnabled) return []
  const prefs = store.prefs
  const here = isInAsia(place) ? `${place.name} ${flag(placeProfile(place).code)}` : place.name
  const out: Alert[] = []
  for (let offset = 0; offset < 2; offset++) {
    const day = store.day(now + offset * 86_400_000)
    if (!day) continue
    for (const prayer of PRAYERS) {
      if (!prefs.notifyPrayers.includes(prayer)) continue
      const time = day.times[prayer]
      const name = store.name(prayer, time)
      const id = `${day.year}-${day.month}-${day.day}-${prayer}`
      if (prayer === 'sunrise') {
        out.push({ id, title: `${name} · ${store.formatted(time)}`, body: `${store.name('fajr')} has ended. ${here}`, at: time })
        continue
      }
      out.push({ id, title: `${name} · ${store.formatted(time)}`, body: `It's time for ${name} in ${here}`, at: time })
      if (prefs.reminderMinutesBefore > 0) {
        out.push({
          id: `${id}-early`, title: `${name} in ${prefs.reminderMinutesBefore} min`,
          body: `${name} at ${store.formatted(time)} · ${here}`, at: time - prefs.reminderMinutesBefore * 60_000,
        })
      }
    }
  }
  return out.filter((a) => a.at > now).sort((a, b) => a.at - b.at)
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
    }
    scheduleAlerts()
  }, Math.max(0, wait))
}

export async function show(title: string, body: string, tag: string): Promise<void> {
  const options: NotificationOptions = { body, tag, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, badge: `${import.meta.env.BASE_URL}icons/badge-96.png` }
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
