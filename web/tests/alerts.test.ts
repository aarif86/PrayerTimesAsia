import { beforeEach, describe, expect, it } from 'vitest'
import type { Place } from '../src/core/place'
import { zoned, zonedTime } from '../src/core/tz'
import { decodePreferences, type Preferences } from '../src/services/prefs'
import { store } from '../src/services/store'
import { alarmAtStart, anyAlarm, buildICS, buildWakeICS, nextWakeUp, upcomingAlerts, wakeUps } from '../src/services/notifications'

/**
 * Prayer alerts, reminders and alarms on the web, worked out without a browser:
 * the plan the open app follows, and the calendar files it hands out.
 */

const SG: Place = { id: 't-sg', name: 'Pasir Ris', countryCode: 'SG', countryName: 'Singapore', timeZoneID: 'Asia/Singapore', coordinates: { latitude: 1.3721, longitude: 103.9474 } }
const LONDON: Place = { id: 't-ldn', name: 'London', countryCode: 'GB', countryName: 'United Kingdom', timeZoneID: 'Europe/London', coordinates: { latitude: 51.5074, longitude: -0.1278 } }

function use(place: Place | null, change: Partial<Preferences> = {}) {
  store.prefs = { ...decodePreferences({}), hasOnboarded: true, useGPS: false, manualPlace: place, home: place, homeConfirmed: true, ...change }
  store.emit()
}

const sg = (y: number, m: number, d: number, h: number, min = 0) => zonedTime(y, m, d, h, min, 0, 'Asia/Singapore')
const local = (ms: number, tz: string) => { const z = zoned(ms, tz); return `${z.year}-${z.month}-${z.day} ${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}` }

beforeEach(() => use(SG))

describe('prayer alerts', () => {
  it('gives nothing until there is a place', () => {
    use(null, { notificationsEnabled: true })
    expect(upcomingAlerts(sg(2026, 11, 16, 9))).toEqual([])
    expect(wakeUps(sg(2026, 11, 16, 9), 2)).toEqual([])
    expect(buildICS()).toBeNull()
    expect(buildWakeICS()).toBeNull()
  })

  it('gives nothing when every alert is off', () => {
    expect(upcomingAlerts(sg(2026, 11, 16, 9))).toEqual([])
  })

  it('lists the coming prayers in order, all in the future, each once', () => {
    use(SG, { notificationsEnabled: true })
    const now = sg(2026, 11, 16, 9)
    const list = upcomingAlerts(now)
    expect(list.length).toBeGreaterThanOrEqual(8)
    expect(list.every((a) => a.at > now)).toBe(true)
    expect(list.map((a) => a.at)).toEqual([...list.map((a) => a.at)].sort((a, b) => a - b))
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
    // Today's Subuh has passed; the next alert is Zohor, then Asar.
    expect(list[0].id).toBe('2026-11-16-dhuhr')
    expect(list[1].id).toBe('2026-11-16-asr')
  })

  it('still has tomorrow\'s Subuh just before midnight, and after it', () => {
    use(SG, { notificationsEnabled: true })
    const before = upcomingAlerts(sg(2026, 11, 16, 23, 59))
    expect(before[0].id).toBe('2026-11-17-fajr')
    const after = upcomingAlerts(sg(2026, 11, 17, 0, 1))
    expect(after[0].id).toBe('2026-11-17-fajr')
  })

  it('crosses the end of a month and a year', () => {
    use(SG, { notificationsEnabled: true })
    expect(upcomingAlerts(sg(2026, 12, 31, 22))[0].id).toBe('2027-1-1-fajr')
  })

  it('only alerts the prayers that are switched on', () => {
    use(SG, { notificationsEnabled: true, notifyPrayers: ['fajr', 'maghrib'] })
    const ids = upcomingAlerts(sg(2026, 11, 16, 9)).map((a) => a.id.split('-').slice(3).join('-'))
    expect(new Set(ids)).toEqual(new Set(['fajr', 'maghrib']))
  })

  it('sends the reminder before the prayer at the right minute, even with the on time alert off', () => {
    use(SG, { notificationsEnabled: false, reminderMinutesBefore: 15 })
    const list = upcomingAlerts(sg(2026, 11, 16, 9))
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((a) => a.id.endsWith('-early'))).toBe(true)
    const day = store.day(sg(2026, 11, 16, 12))!
    const zohor = list.find((a) => a.id === '2026-11-16-dhuhr-early')!
    expect(zohor.at).toBe(day.times.dhuhr - 15 * 60_000)
    expect(zohor.title).toMatch(/in 15 min$/)
  })

  it('reminds before Jumaat on Fridays only', () => {
    use(SG, { jumuahReminderMinutes: 30 })
    const fri = upcomingAlerts(sg(2026, 11, 20, 6)) // Friday
    const j = fri.find((a) => a.id.endsWith('-jumuah'))!
    expect(j.id).toBe('2026-11-20-jumuah')
    expect(j.at).toBe(store.day(sg(2026, 11, 20, 12))!.times.dhuhr - 30 * 60_000)
    expect(upcomingAlerts(sg(2026, 11, 17, 6)).some((a) => a.id.endsWith('-jumuah'))).toBe(false)
  })

  it('goes quiet in quiet hours across midnight, but Subuh keeps its sound', () => {
    use(SG, { notificationsEnabled: true, quietHours: true, quietFrom: 20 * 60, quietTo: 6 * 60 })
    const list = upcomingAlerts(sg(2026, 11, 16, 9))
    const isyak = list.find((a) => a.id === '2026-11-16-isha')!
    const subuh = list.find((a) => a.id === '2026-11-17-fajr')!
    const zohor = list.find((a) => a.id === '2026-11-16-dhuhr')!
    expect(isyak.silent).toBe(true)
    expect(subuh.silent).toBe(false)
    expect(zohor.silent).toBe(false)
  })

  it('buzzes only, everything, when Buzz only is on', () => {
    use(SG, { notificationsEnabled: true, buzzOnly: true })
    expect(upcomingAlerts(sg(2026, 11, 16, 9)).every((a) => a.silent)).toBe(true)
  })

  it('does not ring twice when an alarm is set at the start of a prayer', () => {
    use(SG, { notificationsEnabled: true, wakeUp: 'atFajr', asrAlarm: 'atStart' })
    expect(alarmAtStart('fajr')).toBe(true)
    expect(alarmAtStart('asr')).toBe(true)
    expect(alarmAtStart('dhuhr')).toBe(false)
    const ids = upcomingAlerts(sg(2026, 11, 16, 9)).map((a) => a.id)
    expect(ids).toContain('2026-11-17-wake')
    expect(ids).not.toContain('2026-11-17-fajr')
    expect(ids).toContain('2026-11-16-asr-alarm')
    expect(ids).not.toContain('2026-11-16-asr')
    expect(ids).toContain('2026-11-16-dhuhr')
  })

  it('keeps every day once around a clock change (London, end of summer time)', () => {
    use(LONDON, { notificationsEnabled: true })
    // 00:30 on Sunday 25 October 2026, the 25 hour day in London.
    const now = zonedTime(2026, 10, 25, 0, 30, 0, 'Europe/London')
    const list = upcomingAlerts(now)
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
    const days = new Set(list.map((a) => a.id.split('-').slice(0, 3).join('-')))
    expect(days).toContain('2026-10-25')
    expect(days).toContain('2026-10-26')
    // Subuh stays at a sensible local hour on both sides of the change.
    for (const a of list.filter((x) => x.id.endsWith('-fajr'))) {
      const h = zoned(a.at, 'Europe/London').hour
      expect(h).toBeGreaterThanOrEqual(4)
      expect(h).toBeLessThanOrEqual(7)
    }
  })

  it('keeps every day once around the start of summer time too', () => {
    use(LONDON, { notificationsEnabled: true })
    const now = zonedTime(2027, 3, 27, 23, 30, 0, 'Europe/London')
    const list = upcomingAlerts(now)
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
    expect(list[0].id).toBe('2027-3-28-fajr')
  })
})

describe('alarms', () => {
  it('knows when no alarm is on', () => {
    expect(anyAlarm()).toBe(false)
    expect(nextWakeUp(sg(2026, 11, 16, 9))).toBeNull()
  })

  it('rings the Subuh alarm 30 minutes before Subuh for tahajjud', () => {
    use(SG, { wakeUp: 'fajrMinus30' })
    const w = nextWakeUp(sg(2026, 11, 16, 9))!
    expect(w.id).toBe('2026-11-17-wake')
    expect(w.at).toBe(store.day(sg(2026, 11, 17, 12))!.times.fajr - 30 * 60_000)
    expect(w.title).toBe('Wake up for tahajjud')
  })

  it('finds the next sahur alarm days ahead, on a Monday or Thursday', () => {
    use(SG, { sahurAlarm: 'fajrMinus60', sahurDays: ['monThu'] })
    // Friday 20 November 2026: the next Monday is the 23rd.
    const w = nextWakeUp(sg(2026, 11, 20, 9))!
    expect(w.sahur).toBe(true)
    expect(local(w.at, 'Asia/Singapore').startsWith('2026-11-23')).toBe(true)
  })

  it('puts the 30 minutes before the end alarm before the next prayer', () => {
    use(SG, { asrAlarm: 'endMinus30' })
    const w = wakeUps(sg(2026, 11, 16, 9), 1).find((x) => x.prayer === 'asr')!
    expect(w.at).toBe(store.day(sg(2026, 11, 16, 12))!.times.maghrib - 30 * 60_000)
    expect(w.title).toMatch(/ends in 30 min$/)
  })

  it('lists a month of alarms with one a day per alarm', () => {
    use(SG, { wakeUp: 'atFajr' })
    const list = wakeUps(sg(2026, 11, 16, 3), 30)
    expect(list).toHaveLength(30)
    expect(new Set(list.map((w) => w.id)).size).toBe(30)
  })
})

describe('calendar files', () => {
  it('has one event per prayer per day, with an alarm on each', () => {
    use(SG, { reminderMinutesBefore: 10 })
    const ics = buildICS(7)!
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(35)
    expect(ics.match(/END:VEVENT/g)).toHaveLength(35)
    expect(ics.match(/TRIGGER:-PT10M/g)).toHaveLength(35)
    const uids = ics.match(/^UID:.*$/gm)!
    expect(new Set(uids).size).toBe(uids.length)
  })

  it('has only Zohor and Asar in the work calendar', () => {
    const ics = buildICS(5, ['dhuhr', 'asr'])!
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(10)
    expect(ics).not.toMatch(/-fajr-/)
  })

  it('escapes commas in a place name', () => {
    use({ ...SG, name: 'Bedok, East' })
    expect(buildICS(1)!).toContain('X-WR-CALNAME:Prayer times · Bedok\\, East')
  })

  it('puts every alarm in the alarm calendar', () => {
    use(SG, { wakeUp: 'atFajr', maghribAlarm: 'atStart' })
    const ics = buildWakeICS(10)!
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThanOrEqual(19)
  })
})

describe('next and current prayer around the clock change', () => {
  it('steps one calendar day at a time on 23 and 25 hour days', async () => {
    const { noonDaysAfter } = await import('../src/core/tz')
    const L = 'Europe/London'
    // 00:30 on the 25 hour day: the next day is the 26th, not later the same day.
    expect(local(noonDaysAfter(zonedTime(2026, 10, 25, 0, 30, 0, L), 1, L), L)).toBe('2026-10-26 12:00')
    // 23:30 before the 23 hour day: the next day is the 28th, not skipped.
    expect(local(noonDaysAfter(zonedTime(2027, 3, 27, 23, 30, 0, L), 1, L), L)).toBe('2027-3-28 12:00')
    expect(local(noonDaysAfter(zonedTime(2027, 3, 29, 0, 30, 0, L), -1, L), L)).toBe('2027-3-28 12:00')
    expect(local(noonDaysAfter(zonedTime(2026, 12, 31, 23, 0, 0, 'Asia/Singapore'), 1, 'Asia/Singapore'), 'Asia/Singapore')).toBe('2027-1-1 12:00')
  })

  it('shows last night\'s Isyak, not an older one, just after midnight after the clocks go forward', () => {
    use(LONDON)
    const now = zonedTime(2027, 3, 29, 0, 30, 0, 'Europe/London')
    const cur = store.current(now)!
    expect(cur.prayer).toBe('isha')
    expect(local(cur.time, 'Europe/London').startsWith('2027-3-28')).toBe(true)
  })

  it('shows tomorrow\'s Subuh after Isyak on the long day when the clocks go back', () => {
    use(LONDON)
    const now = zonedTime(2026, 10, 25, 23, 30, 0, 'Europe/London')
    const next = store.next(now)!
    expect(next.prayer).toBe('fajr')
    expect(local(next.time, 'Europe/London').startsWith('2026-10-26')).toBe(true)
  })

  it('counts the prayer streak over the clock change without skipping a day', () => {
    const L = 'Europe/London'
    const days = ['2027-03-26', '2027-03-27', '2027-03-28', '2027-03-29']
    use(LONDON, { trackerEnabled: true, prayedLog: Object.fromEntries(days.map((d) => [d, ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']])) })
    expect(store.streak(zonedTime(2027, 3, 29, 0, 30, 0, L))).toBe(4)
  })
})
