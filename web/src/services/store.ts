import { useEffect, useState } from 'preact/hooks'
import { computeBlessed, type BlessedTime } from '../core/blessed'
import { defaultAuthority, type CalendarAnnouncement, type CalendarDataset, type HijriEvent } from '../core/calendarSanad'
import { computeFor, ordered, type PrayerDay } from '../core/engine'
import { openWindow, type PrayerWindow } from '../core/window'
import { distanceKm, KAABA } from '../core/geo'
import { formatHijriDate, gregorianFromHijri, type HijriDate } from '../core/hijri'
import { MISSED, type FastMark } from '../core/ramadanContent'
import { addDays, authorityDate, baseHijri, civilKey, communityHijri, daysApart, parseCivil, previewShift, seasonFor, type CivilDay, type Season } from '../core/season'
import { masjidProfile, MY_MASJID_RADIUS_KM, parseMasjidLink, type MasjidLink } from '../core/masjidLink'
import { methodWithId, type CalculationMethod } from '../core/methods'
import { longDaysKey, twilightLastsAllNight } from '../core/longDays'
import { musafirStatus, type MusafirRules, type MusafirStatus } from '../core/musafir'
import { officialSourceFor, officialSummary, sourceLabel, type OfficialSource } from '../core/official'
import { isNear, newPlaceId, placeProfile, type Place } from '../core/place'
import { OBLIGATORY, PRAYERS, prayerName, type AsrSchool, type NamingStyle, type Prayer } from '../core/prayer'
import { countryForTimeZone, FALLBACK_PROFILE, methodHere, personalNaming, profileFor, profileMethod, sourceSummary, type CountryProfile } from '../core/regions'
import {
  disagreements, jamaahTimes, mosqueAsr, mosqueMethod, mosqueNear, type MosqueDataset, type MosqueProfile,
} from '../core/sources'
import { dayKey, daysBetween, deviceTimeZone, ymdKey, zoned, zonedTime } from '../core/tz'
export { parseCivil, civilKey }
import { CITIES, nearestCity } from './cities'
import { ensureTable, rowFor, tableFor } from './officialTables'
import { DEFAULT_PREFS, loadPreferences, savePreferences, TODAY_STYLES, type Preferences, type TodayStyle } from './prefs'
import { fetchOK, readJSON, readString, writeJSON, writeString } from './storage'
import { countAppOpen } from './usage'

export type Tab = 'today' | 'qibla' | 'falak' | 'masjid' | 'settings'
export const TABS: Tab[] = ['today', 'qibla', 'falak', 'masjid', 'settings']

export type GpsStatus = 'idle' | 'locating' | 'denied' | 'unavailable' | 'ok'

/** Screenshot / demo mode, from the URL: ?demo&now=2026-10-25T00:49:00%2B08:00&style=list&appearance=dark&tab=today */
export interface Demo {
  now: number | null
  variant: 'home' | 'travel' | 'visitor' | 'makkah'
  more: boolean
  aligned: boolean
  tab: Tab | null
}

const DATA_BASE = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/data/'

class AppStore {
  prefs: Preferences
  demo: Demo | null
  gpsPlace: Place | null = null
  gpsStatus: GpsStatus = 'idle'
  tab: Tab = 'today'
  showJourney = false
  mosques: MosqueDataset = { version: 1, licence: 'CC-BY-4.0', mosques: [] }
  calendar: CalendarDataset = { version: 1, licence: 'CC-BY-4.0', announcements: [] }
  /** A masjid from a screen's QR code, waiting for the user to say yes. */
  pendingMasjid: MasjidLink | null = null
  /** Bumped on every change, so views re-read. */
  revision = 0
  private listeners = new Set<() => void>()
  private dayCache = new Map<string, PrayerDay | null>()
  private watchId: number | null = null

  constructor() {
    this.demo = parseDemo()
    this.prefs = this.demo ? demoPreferences(this.demo) : loadPreferences()
    if (this.demo?.tab) this.tab = this.demo.tab
    const m = readJSON<MosqueDataset>('ptasia.mosques')
    if (m?.mosques) this.mosques = m
    const c = readJSON<CalendarDataset>('ptasia.calendar')
    if (c?.announcements) this.calendar = c
    if (this.demo && new URLSearchParams(location.search).get('masjid') === 'link') this.pendingMasjid = DEMO_MASJID
    if (typeof location !== 'undefined' && !this.demo) {
      this.readMasjidLink()
      window.addEventListener('hashchange', () => { this.readMasjidLink(); this.emit() })
    }
  }

  // MARK: Your masjid

  private readMasjidLink(): void {
    if (location.hash.startsWith('#masjid?')) this.pendingMasjid = parseMasjidLink(location.hash.slice(1))
  }

  private clearMasjidHash(): void {
    if (location.hash.startsWith('#masjid')) history.replaceState(null, '', location.pathname + location.search)
  }

  /** Yes to the masjid from the QR code: its iqamah times show on the Prayer screen from now on. */
  followMasjid(): void {
    const m = this.pendingMasjid
    this.pendingMasjid = null
    if (!this.demo) this.clearMasjidHash()
    if (m) this.update((p) => { p.myMasjid = m }); else this.emit()
  }

  dismissMasjid(): void {
    this.pendingMasjid = null
    if (!this.demo) this.clearMasjidHash()
    this.emit()
  }

  forgetMasjid(): void {
    this.update((p) => { p.myMasjid = null })
  }

  /** Your masjid, when the place shown is within reach of it (not while travelling). */
  get myMasjidHere(): MasjidLink | null {
    const m = this.prefs.myMasjid
    const place = this.activePlace
    if (!m || !place) return null
    return distanceKm({ latitude: m.lat, longitude: m.lng }, place.coordinates) <= MY_MASJID_RADIUS_KM ? m : null
  }

  // MARK: Change

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  emit(): void {
    this.revision++
    this.dayCache.clear()
    for (const fn of this.listeners) fn()
  }

  now(): number {
    return this.demo?.now ?? Date.now()
  }

  /** Change preferences; saved unless in demo mode. */
  update(change: (p: Preferences) => void): void {
    const before = JSON.stringify({ ...this.prefs, prayedLog: null, excusedDays: null })
    const next = structuredClone(this.prefs)
    change(next)
    this.prefs = next
    if (!this.demo) savePreferences(next)
    this.emit()
    const after = JSON.stringify({ ...next, prayedLog: null, excusedDays: null })
    if (before !== after) this.refreshOfficial()
  }

  setTab(tab: Tab): void {
    this.tab = tab
    this.emit()
  }

  // MARK: Where and which rules

  /** Anonymous count of this open, once the place is known (see services/usage.ts). */
  countOpen(version: string): void {
    if (this.demo || !this.prefs.shareUsage || !this.prefs.hasOnboarded) return
    const p = this.activePlace
    countAppOpen(version, { city: p?.name, countryCode: p?.countryCode })
  }

  get activePlace(): Place | null {
    return this.prefs.useGPS ? (this.gpsPlace ?? this.prefs.manualPlace) : this.prefs.manualPlace
  }

  get profile(): CountryProfile {
    const p = this.activePlace
    return p ? placeProfile(p) : FALLBACK_PROFILE
  }

  get method(): CalculationMethod {
    const pinned = methodWithId(this.prefs.methodOverrideID)
    return pinned ? methodHere(pinned, this.profile) : profileMethod(this.profile)
  }

  get isMethodAutomatic(): boolean { return this.prefs.methodOverrideID == null }
  /** Whose times these are, in plain words (official timetable, the authority's method, or a standard one). */
  get sourceSummary(): string { return officialSummary(this.officialSource) ?? sourceSummary(this.profile, this.method, !this.isMethodAutomatic) }
  /** The same in one sentence or two, for the welcome card. */
  get sourceShort(): string { return officialSummary(this.officialSource, true) ?? sourceSummary(this.profile, this.method, !this.isMethodAutomatic, true) }
  get asrSchool(): AsrSchool { return this.prefs.asrOverride ?? this.profile.asr }
  get personalNaming(): NamingStyle { return personalNaming(navigatorLocale()) }
  /** Your names, from your browser's language (English unless it has names in it), not from where you are. */
  get naming(): NamingStyle { return this.prefs.namingOverride ?? this.personalNaming }
  /** The words used where you are (the masjid's signs). */
  get localNaming(): NamingStyle { return this.profile.naming }

  name(p: Prayer, at?: number): string {
    return prayerName(p, this.naming, at != null && this.isFriday(at))
  }

  /** The local word for a prayer, when it differs from yours. */
  localName(p: Prayer, at: number): string | null {
    if (!this.prefs.showLocalNames || this.localNaming === this.naming) return null
    // At home you already know the local words; the hint is for travel.
    if (this.prefs.home && placeProfile(this.prefs.home).code === this.profile.code) return null
    const friday = this.isFriday(at)
    const local = prayerName(p, this.localNaming, friday)
    return local === prayerName(p, this.naming, friday) ? null : local
  }

  get communityAuthority(): string | null {
    if (this.prefs.communityAuthority) return this.prefs.communityAuthority
    const code = (this.prefs.home ? placeProfile(this.prefs.home).code : '') || this.profile.code
    return defaultAuthority(code) ?? null
  }

  get timeZone(): string {
    return this.activePlace?.timeZoneID ?? deviceTimeZone()
  }

  get musafirRules(): MusafirRules {
    return { school: this.asrSchool, thresholdKm: this.asrSchool === 'hanafi' ? 78 : this.prefs.musafirThresholdKm }
  }

  daysHere(now = this.now()): number {
    return this.prefs.arrivedAt ? Math.max(0, Math.floor((now - this.prefs.arrivedAt) / 86_400_000)) : 0
  }

  musafirStatus(now = this.now()): MusafirStatus | null {
    const place = this.activePlace
    // A guessed home never says "traveller" or "home" until the user confirms it.
    if (!place || !this.prefs.homeConfirmed) return null
    return musafirStatus(this.prefs.home?.coordinates, place.coordinates, this.daysHere(now), this.musafirRules)
  }

  get officialSource(): OfficialSource | null {
    const place = this.activePlace
    return place ? officialSourceFor(place, this.method, this.prefs.jakimZoneOverride) : null
  }

  get nearbyMosque(): MosqueProfile | null {
    const place = this.activePlace
    return place ? mosqueNear(this.mosques, place.coordinates) : null
  }

  // MARK: Times

  /**
   * Resolver: official table (A) → nearby mosque's own timetable (B) →
   * calculation with the country's method (D; A for Umm al-Qura, whose
   * published method is exact).
   */
  day(ms: number): PrayerDay | null {
    const place = this.activePlace
    if (!place) return null
    const tz = place.timeZoneID
    const key = dayKey(ms, tz)
    if (this.dayCache.has(key)) return this.dayCache.get(key)!
    const result = this.resolve(ms, place)
    this.dayCache.set(key, result)
    return result
  }

  private resolve(ms: number, place: Place): PrayerDay {
    const tz = place.timeZoneID
    const mosque = mosqueNear(this.mosques, place.coordinates)
    const computed = computeFor(ms, tz, place.coordinates, this.method, this.asrSchool)
    const source = this.officialSource
    const row = source ? rowFor(source, computed.year, computed.month, computed.day) : null
    let result: PrayerDay
    if (source && row && row.fajr && row.dhuhr && row.asr && row.maghrib && row.isha) {
      const times = { ...computed.times }
      for (const p of PRAYERS) {
        if (p === 'asr' && this.asrSchool === 'hanafi') continue // official tables are Shafi'i
        const v = row[p]
        if (!v) continue // the feed has no Syuruk: keep the calculation's
        const [h, m] = v.split(':').map(Number)
        times[p] = zonedTime(computed.year, computed.month, computed.day, h, m, 0, tz)
      }
      result = { ...computed, times, officialSource: sourceLabel(source), grade: 'A', sunriseCalculated: !row.sunrise }
      const mm = mosque ? mosqueMethod(mosque) : null
      if (mosque && mm) {
        const theirs = computeFor(ms, tz, place.coordinates, mm, this.prefs.asrOverride ?? mosqueAsr(mosque) ?? this.asrSchool)
        result.alternate = disagreements(result, theirs)
        result.alternateSource = Object.keys(result.alternate).length ? mosque.name : undefined
      }
    } else if (this.isMethodAutomatic && mosque && mosqueMethod(mosque)) {
      result = computeFor(ms, tz, place.coordinates, mosqueMethod(mosque)!, this.prefs.asrOverride ?? mosqueAsr(mosque) ?? this.asrSchool)
      result.grade = mosque.grade
      result.officialSource = `${mosque.name} timetable`
    } else {
      result = { ...computed, grade: this.method.id === 'ummalqura' ? 'A' : 'D' }
    }
    // Jamaah: your own masjid first, else a published masjid profile here.
    const mine = this.myMasjidHere
    const jamaahFrom = mine ? masjidProfile(mine) : mosque
    if (jamaahFrom) {
      result.mosqueName = jamaahFrom.name
      result.jamaah = jamaahTimes(jamaahFrom, result, tz, this.isFriday(result.times.dhuhr))
    }
    return result
  }

  /** The day after the one containing `ms`. */
  nextDay(day: PrayerDay): PrayerDay | null {
    return this.day(day.times.dhuhr + 86_400_000)
  }

  /** The next obligatory prayer (or sunrise, which ends Subuh) after `now`. */
  next(now: number): { prayer: Prayer; time: number } | null {
    const today = this.day(now)
    if (!today) return null
    const upcoming = ordered(today).find((x) => x.time > now)
    if (upcoming) return upcoming
    const tomorrow = this.day(now + 86_400_000)
    return tomorrow ? { prayer: 'fajr', time: tomorrow.times.fajr } : null
  }

  /** The period we're in: the last time that has passed (Isha carries over past midnight). */
  current(now: number): { prayer: Prayer; time: number } | null {
    const today = this.day(now)
    if (!today) return null
    const passed = ordered(today).filter((x) => x.time <= now).pop()
    if (passed) return passed
    const yesterday = this.day(now - 86_400_000)
    return yesterday ? { prayer: 'isha', time: yesterday.times.isha } : null
  }

  /** The prayer open now and when its time runs out; null between sunrise and Zohor. */
  window(now: number): PrayerWindow | null {
    const today = this.day(now)
    const yesterday = this.day(now - 86_400_000)
    const tomorrow = this.day(now + 86_400_000)
    return today && yesterday && tomorrow ? openWindow(now, yesterday, today, tomorrow) : null
  }

  blessed(day: PrayerDay): [BlessedTime, number][] {
    const place = this.activePlace
    const nextDay = this.nextDay(day)
    if (!place || !nextDay) return []
    return computeBlessed(day, nextDay, place.coordinates, this.isRamadanDay(day.times.dhuhr))
  }

  /**
   * The long summer days note: its key when today's Fajr and Isha come from a
   * high latitude rule (twilight lasts all night) and the note for this place and
   * summer hasn't been closed. Only for calculated times; an official timetable
   * already sets its own.
   */
  longDaysNote(now: number): string | null {
    const place = this.activePlace
    if (!place || this.officialSource) return null
    const { latitude: lat, longitude: lng } = place.coordinates
    const d = this.civil(now)
    if (!twilightLastsAllNight(d.year, d.month, d.day, lat, this.method)) return null
    const key = longDaysKey(d.year, d.month, lat, lng, place.countryCode ?? '')
    return this.prefs.longDaysClosed.includes(key) ? null : key
  }

  closeLongDaysNote(key: string): void {
    this.update((p) => { p.longDaysClosed = [...p.longDaysClosed.filter((k) => k !== key), key].slice(-30) })
  }

  // MARK: Ramadan and Syawal

  /** The local calendar day containing `ms`. */
  civil(ms: number): CivilDay {
    const z = zoned(ms, this.timeZone)
    return { year: z.year, month: z.month, day: z.day }
  }

  /** Days the tester's "Try Ramadan" moves the calendar by (0 when off). */
  get seasonShift(): number {
    return previewShift(this.civil(this.now()), this.prefs.seasonPreview)
  }

  get isSeasonPreview(): boolean { return this.prefs.seasonPreview !== 'off' }

  /** The Hijri date of a civil day as this community counts it (see core/season.ts). */
  hijriOfCivil(g: CivilDay): HijriDate {
    if (this.isSeasonPreview) return baseHijri(addDays(g, this.seasonShift))
    return communityHijri(g, this.prefs.hijriAdjustment, this.calendar.announcements, this.communityAuthority)
  }

  hijriOf(ms: number): HijriDate { return this.hijriOfCivil(this.civil(ms)) }

  hijriLabel(ms: number): string { return formatHijriDate(this.hijriOf(ms), this.naming) }

  isRamadanDay(ms: number): boolean { return this.hijriOf(ms).month === 9 }

  season(ms: number): Season {
    const h = this.hijriOf(ms)
    let nextStart: Season['nextStart'] = null
    const event = h.month === 8 ? '1_ramadan' : h.month === 9 ? '1_syawal' : null
    if (event && h.day >= 27 && !this.isSeasonPreview) {
      const d = authorityDate(this.calendar.announcements, this.communityAuthority, event, h.year)
      if (d && daysApart(this.civil(ms), d.day) >= 0) nextStart = { event, ...d }
    }
    return seasonFor(h, nextStart)
  }

  /** The civil day `days` after the one containing `ms`. */
  civilAfter(ms: number, days: number): CivilDay { return addDays(this.civil(ms), days) }

  /** A civil day's prayer times (noon of that day). */
  dayOfCivil(g: CivilDay): PrayerDay | null {
    return this.day(zonedTime(g.year, g.month, g.day, 12, 0, 0, this.timeZone))
  }

  /** Imsak: 10 minutes before Subuh, as MUIS, JAKIM and Kemenag publish it. */
  imsak(day: PrayerDay): number { return day.times.fajr - 10 * 60_000 }

  /**
   * In Ramadan, the moment to count down to: Imsak before dawn, Berbuka after it.
   * After Maghrib it points at tomorrow's Imsak (if tomorrow is a fast).
   */
  fastingMoment(now: number): { kind: 'imsak' | 'berbuka'; time: number } | null {
    const today = this.day(now)
    if (!today) return null
    if (this.isRamadanDay(now)) {
      const imsak = this.imsak(today)
      if (now < imsak) return { kind: 'imsak', time: imsak }
      if (now < today.times.maghrib) return { kind: 'berbuka', time: today.times.maghrib }
    }
    const tomorrow = this.day(now + 86_400_000)
    if (tomorrow && this.isRamadanDay(tomorrow.times.dhuhr)) return { kind: 'imsak', time: this.imsak(tomorrow) }
    return null
  }

  // Fasting log, kept on this device only.

  fastMark(key: string): FastMark | null { return this.prefs.fastLog[key] ?? null }

  setFast(key: string, mark: FastMark | null): void {
    this.update((p) => {
      if (mark) p.fastLog[key] = mark; else delete p.fastLog[key]
      const keys = Object.keys(p.fastLog).sort()
      if (keys.length > 800) delete p.fastLog[keys[0]]
    })
  }

  toggleDay(list: 'tarawihLog' | 'quranLog', key: string): void {
    this.update((p) => { p[list] = p[list].includes(key) ? p[list].filter((k) => k !== key) : [...p[list], key].sort().slice(-400) })
  }

  /** Every civil day of a Hijri month for this community, from the 1st. */
  monthDays(year: number, month: number): CivilDay[] {
    const est = gregorianFromHijri(year, month, 1)
    if (!est) return []
    const guess = addDays(est, this.isSeasonPreview ? -this.seasonShift : 0)
    let first: CivilDay | null = null
    for (const delta of [0, 1, -1, 2, -2, 3, -3]) {
      const d = addDays(guess, delta)
      const h = this.hijriOfCivil(d)
      if (h.year === year && h.month === month && h.day === 1) { first = d; break }
    }
    if (!first) return []
    const out: CivilDay[] = []
    for (let i = 0; i < 30; i++) {
      const d = addDays(first, i)
      if (this.hijriOfCivil(d).month !== month) break
      out.push(d)
    }
    return out
  }

  /** This Ramadan's fasts: how many kept, missed (by reason) and still to replace. */
  fastSummary(hijriYear: number, now = this.now()): { days: CivilDay[]; fasted: number; missed: number; replaced: number; owed: number; syawal: number } {
    const days = this.monthDays(hijriYear, 9)
    const todayKey = civilKey(this.civil(now))
    let fasted = 0, missed = 0
    for (const d of days) {
      const k = civilKey(d)
      if (k > todayKey) break
      const m = this.prefs.fastLog[k]
      if (m === 'fasted') fasted++
      else if (m && MISSED.includes(m)) missed++
    }
    const last = days[days.length - 1]
    const after = last ? civilKey(last) : todayKey
    // Replaced fasts and Syawal fasts are counted after this Ramadan, until the next one.
    const nextStart = this.monthDays(hijriYear + 1, 9)[0]
    const until = nextStart ? civilKey(nextStart) : '9999'
    let replaced = 0, syawal = 0
    const syawalDays = new Set(this.monthDays(hijriYear, 10).map(civilKey))
    for (const [k, m] of Object.entries(this.prefs.fastLog)) {
      if (k <= after || k >= until) continue
      if (m === 'qadha') replaced++
      if (m === 'syawal' && syawalDays.has(k)) syawal++
    }
    return { days, fasted, missed, replaced, owed: Math.max(0, missed - replaced), syawal }
  }

  /** Raya prayer time at your masjid, when its screen has one. */
  get eidPrayer(): string | null {
    return this.myMasjidHere?.eid ?? null
  }

  formatted(ms: number): string {
    const p = this.timeParts(ms)
    return p.suffix ? `${p.time} ${p.suffix}` : p.time
  }

  /** A time of day given as minutes past midnight, "11:00 PM" or "23:00". */
  clock(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24, m = String(minutes % 60).padStart(2, '0')
    if (this.prefs.use24Hour) return `${String(h).padStart(2, '0')}:${m}`
    return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
  }

  /** "5:29" and "AM" separately, so the suffix can be set smaller on the same line. */
  timeParts(ms: number): { time: string; suffix: string | null } {
    const z = zoned(ms, this.timeZone)
    const mm = String(z.minute).padStart(2, '0')
    if (this.prefs.use24Hour) return { time: `${String(z.hour).padStart(2, '0')}:${mm}`, suffix: null }
    const h12 = z.hour % 12 === 0 ? 12 : z.hour % 12
    return { time: `${h12}:${mm}`, suffix: z.hour < 12 ? 'AM' : 'PM' }
  }

  isFriday(ms: number): boolean {
    return zoned(ms, this.timeZone).weekday === 5
  }

  // MARK: Prayer tracker

  dayKey(ms: number): string { return dayKey(ms, this.timeZone) }

  isPrayed(p: Prayer, ms: number): boolean {
    return this.prefs.prayedLog[this.dayKey(ms)]?.includes(p) ?? false
  }

  togglePrayed(p: Prayer, ms: number): void {
    const key = this.dayKey(ms)
    this.update((prefs) => {
      const set = new Set(prefs.prayedLog[key] ?? [])
      if (set.has(p)) set.delete(p); else set.add(p)
      if (set.size) prefs.prayedLog[key] = [...set]; else delete prefs.prayedLog[key]
      const keys = Object.keys(prefs.prayedLog).sort()
      if (keys.length > 400) delete prefs.prayedLog[keys[0]]
    })
  }

  isExcused(ms: number): boolean { return this.isExcusedKey(this.dayKey(ms)) }

  /** Marked excused on its own, or inside a pause (from the day it began; days ahead aren't counted yet). */
  isExcusedKey(key: string): boolean {
    const since = this.prefs.trackerPausedSince
    return this.prefs.excusedDays.includes(key) || (!!since && key >= since && key <= this.dayKey(this.now()))
  }

  /** How a day went: prayers ticked and whether it was excused. */
  trackerDay(key: string): { prayed: number; excused: boolean } {
    return { prayed: (this.prefs.prayedLog[key] ?? []).filter((p) => OBLIGATORY.includes(p)).length, excused: this.isExcusedKey(key) }
  }

  get trackerPaused(): boolean { return !!this.prefs.trackerPausedSince }

  /** Pause for haid, nifas or illness: today and every day until it's ended count as excused, so the streak waits. */
  pauseTracker(ms: number): void {
    const key = this.dayKey(ms)
    this.update((p) => { p.trackerPausedSince = key })
  }

  /** End the pause: the paused days are kept as excused days, today included. */
  endTrackerPause(ms: number): void {
    const since = this.prefs.trackerPausedSince
    if (!since) return
    const today = this.dayKey(ms)
    this.update((p) => {
      p.excusedDays = [...new Set([...p.excusedDays, ...daysFrom(since, today)])].sort()
      p.trackerPausedSince = null
    })
  }

  toggleExcused(ms: number): void {
    const key = this.dayKey(ms)
    this.update((p) => {
      p.excusedDays = p.excusedDays.includes(key) ? p.excusedDays.filter((k) => k !== key) : [...p.excusedDays, key]
    })
  }

  /** Consecutive days with all five prayers marked (or excused); an unfinished today doesn't break it. */
  streak(now = this.now()): number {
    let count = 0
    for (let i = 0; i < 400; i++) {
      const key = this.dayKey(now - i * 86_400_000)
      const complete = this.isExcusedKey(key) || (this.prefs.prayedLog[key]?.length ?? 0) >= OBLIGATORY.length
      if (complete) count++
      else if (i > 0) break
    }
    return count
  }

  // MARK: Places and travel

  /** Ask the browser for a position. The coordinates stay in this browser. */
  locate(): void {
    if (this.demo) return
    if (!('geolocation' in navigator)) { this.gpsStatus = 'unavailable'; this.emit(); return }
    this.gpsStatus = 'locating'
    this.emit()
    const onFix = (pos: GeolocationPosition) => this.handleFix(pos.coords.latitude, pos.coords.longitude)
    const onError = (err: GeolocationPositionError) => {
      this.gpsStatus = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'
      this.emit()
    }
    navigator.geolocation.getCurrentPosition(onFix, onError, { enableHighAccuracy: false, maximumAge: 300_000, timeout: 20_000 })
    if (this.watchId == null) {
      this.watchId = navigator.geolocation.watchPosition(onFix, () => { /* keep the last fix */ }, { maximumAge: 300_000 })
    }
  }

  private handleFix(lat: number, lng: number): void {
    if (this.gpsPlace && Math.abs(this.gpsPlace.coordinates.latitude - lat) < 0.005 &&
      Math.abs(this.gpsPlace.coordinates.longitude - lng) < 0.005 && this.gpsStatus === 'ok') return
    const tz = deviceTimeZone()
    const city = nearestCity(lat, lng, 25)
    const wide = nearestCity(lat, lng, 150)
    const code = wide?.countryCode ?? countryForTimeZone(tz) ?? null
    const place: Place = {
      id: 'gps',
      name: city?.name ?? 'Current location',
      region: city?.region ?? null,
      countryCode: code,
      countryName: profileFor(code)?.name ?? wide?.countryName ?? null,
      timeZoneID: tz,
      coordinates: { latitude: lat, longitude: lng },
      district: city?.district ?? null,
    }
    this.gpsPlace = place
    this.gpsStatus = 'ok'
    if (this.prefs.useGPS) this.arrived(place)
    else this.emit()
    this.refreshOfficial()
  }

  useGPS(): void {
    this.update((p) => { p.useGPS = true })
    this.locate()
    if (this.gpsPlace) this.arrived(this.gpsPlace)
  }

  choose(place: Place): void {
    const chosen = { ...place, id: place.id || newPlaceId() }
    this.update((p) => {
      p.manualPlace = chosen
      p.useGPS = false
      if (!p.savedPlaces.some((s) => isNear(s, chosen))) p.savedPlaces = [chosen, ...p.savedPlaces].slice(0, 20)
    })
    this.arrived(chosen)
  }

  /** Home, picked by the user. Also counts as saying "this is home". */
  setHome(place: Place): void {
    this.update((p) => { p.home = place; p.homeConfirmed = true })
  }

  /** "Yes, this is home" for the home the app guessed. */
  confirmHome(): void {
    this.update((p) => { p.homeConfirmed = true })
  }

  /** Travel mode: notice a new country, remember when we got here, show the welcome card. */
  private arrived(place: Place): void {
    this.update((p) => {
      if (!p.home && place.countryCode && place.name !== 'Current location') p.home = place
      const code = place.countryCode
      if (code && code !== p.lastCountryCode) {
        const firstEver = p.lastCountryCode == null
        p.lastCountryCode = code
        p.arrivedAt = this.now()
        p.musafirChipDismissed = false
        p.arrivalBannerDismissed = firstEver
        p.trip = [{ countryCode: code, countryName: place.countryName ?? code, placeName: place.name, arrived: this.now() }, ...p.trip].slice(0, 30)
      }
    })
  }

  // MARK: Data

  /** Downloads this year's official table for where you are (and next year's in December). */
  refreshOfficial(): void {
    const source = this.officialSource
    if (!source) return
    const z = zoned(this.now(), this.timeZone)
    const years = z.month === 12 ? [z.year, z.year + 1] : [z.year]
    for (const y of years) {
      ensureTable(source, y, this.timeZone).then((changed) => { if (changed) this.emit() })
    }
  }

  hasTable(): boolean {
    const source = this.officialSource
    return !!source && !!tableFor(source, zoned(this.now(), this.timeZone).year)
  }

  tableVia(): 'authority' | 'feed' | null {
    const source = this.officialSource
    return source ? tableFor(source, zoned(this.now(), this.timeZone).year)?.via ?? null : null
  }

  /** Masjid timetables (Grade B) and Ramadan/Eid announcements from the public repo. */
  async refreshData(): Promise<void> {
    if (this.demo) return
    const stale = (key: string, maxAge: number) => Date.now() - parseInt(readString(key) ?? '0', 10) > maxAge
    if (stale('ptasia.mosques.at', 86_400_000)) {
      const r = await fetchOK(`${DATA_BASE}mosques.json`)
      if (r) {
        try {
          const data = (await r.json()) as MosqueDataset
          if (Array.isArray(data.mosques)) { this.mosques = data; writeJSON('ptasia.mosques', data); writeString('ptasia.mosques.at', String(Date.now())); this.emit() }
        } catch { /* keep the cached copy */ }
      }
    }
    // Around moon sighting nights, look for the announcement every 10 minutes.
    const h = this.hijriOf(this.now())
    const sighting = (h.month === 8 || h.month === 9) && h.day >= 28
    if (stale('ptasia.calendar.at', sighting ? 10 * 60_000 : 3 * 3_600_000)) {
      const r = await fetchOK(`${DATA_BASE}calendar.json`)
      if (r) {
        try {
          const data = (await r.json()) as CalendarDataset
          if (Array.isArray(data.announcements)) { this.calendar = data; writeJSON('ptasia.calendar', data); writeString('ptasia.calendar.at', String(Date.now())); this.emit() }
        } catch { /* keep the cached copy */ }
      }
    }
  }

  announcements(event: HijriEvent, hijriYear: number): CalendarAnnouncement[] {
    return this.calendar.announcements.filter((a) => a.event === event && a.hijri_year === hijriYear)
  }

  /** Where the user lives, for which offer is relevant: home country, else where they are now. */
  get offerCountry(): string {
    return this.prefs.home?.countryCode ?? this.profile.code
  }
}

function navigatorLocale(): string {
  // A language picked on our website (same address) comes first, then the browser's.
  try {
    const site = localStorage.getItem('pta-lang')
    if (site && site !== 'en') return site
  } catch { /* storage blocked */ }
  try { return navigator.language || 'en' } catch { return 'en' }
}

function parseDemo(): Demo | null {
  if (typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search)
  if (!q.has('demo')) return null
  const nowParam = q.get('now')
  const parsed = nowParam ? Date.parse(nowParam) : NaN
  const variant = q.get('demo')
  const tab = q.get('tab') as Tab | null
  return {
    now: Number.isNaN(parsed) ? null : parsed,
    variant: variant === 'travel' || variant === 'visitor' || variant === 'makkah' ? variant : 'home',
    more: q.get('more') === '1',
    aligned: q.get('aligned') === '1',
    tab: tab && ['today', 'qibla', 'falak', 'masjid', 'settings'].includes(tab) ? tab : null,
  }
}

/** For screenshots only: a made-up masjid in Pasir Ris with typical iqamah gaps. */
const DEMO_MASJID: MasjidLink = {
  name: 'Example Masjid, Pasir Ris', lat: 1.3735, lng: 103.9490, tz: 'Asia/Singapore', cc: 'SG',
  jamaah: { fajr: { after: 15 }, dhuhr: { after: 10 }, asr: { after: 10 }, maghrib: { after: 5 }, isha: { after: 10 } },
  jumuah: '13:00',
}

const PASIR_RIS: Place = {
  id: 'demo-pasir-ris', name: 'Pasir Ris', region: null, countryCode: 'SG', countryName: 'Singapore',
  timeZoneID: 'Asia/Singapore', coordinates: { latitude: 1.3721, longitude: 103.9474 },
}

/** The iOS demo launch modes: home in Singapore, a visitor in KL, just landed in Hanoi, or Makkah. */
function demoPreferences(demo: Demo): Preferences {
  const q = new URLSearchParams(location.search)
  const p: Preferences = structuredClone(DEFAULT_PREFS)
  const now = demo.now ?? Date.now()
  p.hasOnboarded = true
  p.useGPS = false
  p.home = PASIR_RIS
  p.homeConfirmed = true
  p.manualPlace = PASIR_RIS
  p.lastCountryCode = 'SG'
  p.trackerEnabled = true
  for (let back = 1; back <= 3; back++) {
    p.prayedLog[dayKey(now - back * 86_400_000, 'Asia/Singapore')] = [...OBLIGATORY]
  }
  // ?tracker=month (a month of history) or ?tracker=paused (the same, paused two days ago).
  const tracker = q.get('tracker')
  if (tracker === 'month' || tracker === 'paused') {
    const pattern = [5, 5, 4, 5, 5, 3, 5, 5, 5, 2, 5, 5, 4, 5, 5, 5, 5, 4, 5, 5, 5, 3, 5, 5, 5, 5]
    for (let back = 1; back <= 30; back++) {
      const key = dayKey(now - back * 86_400_000, 'Asia/Singapore')
      if (back >= 12 && back <= 17) { p.excusedDays.push(key); continue }
      const n = pattern[back % pattern.length]
      p.prayedLog[key] = OBLIGATORY.slice(0, n)
    }
    p.prayedLog[dayKey(now, 'Asia/Singapore')] = OBLIGATORY.slice(0, 1)
    if (tracker === 'paused') p.trackerPausedSince = dayKey(now - 2 * 86_400_000, 'Asia/Singapore')
  }
  // ?season=ramadan (or sighting, lastTen, raya, syawal): the tester's Ramadan preview, with some fasts marked.
  const season = q.get('season') as Exclude<Preferences['seasonPreview'], 'off'> | null
  if (season && ['sighting', 'ramadan', 'lastTen', 'raya', 'syawal'].includes(season)) {
    p.seasonPreview = season
    const marks: FastMark[] = ['fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'period', 'period', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'travel', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted', 'fasted']
    const back = { sighting: 0, ramadan: 11, lastTen: 25, raya: 30, syawal: 37 }[season]
    for (let i = 1; i <= back && i <= 30; i++) {
      const k = dayKey(now - i * 86_400_000, 'Asia/Singapore')
      const m = marks[(back - i) % marks.length]
      if (season === 'syawal' && i < 7) { if (i === 2 || i === 4) p.fastLog[k] = 'syawal'; continue }
      p.fastLog[k] = m
    }
    p.tarawihLog = [dayKey(now - 86_400_000, 'Asia/Singapore')]
    p.khatamPlan = season === 'ramadan' || season === 'lastTen'
  }
  const appearance = q.get('appearance')
  p.appearance = appearance === 'light' || appearance === 'dark' || appearance === 'system' ? appearance : 'dark'
  const style = q.get('style') as TodayStyle | null
  if (style && TODAY_STYLES.includes(style)) p.todayStyle = style
  if (q.get('alerts') === 'on') { p.notificationsEnabled = true; p.alertsPromptDismissed = true }
  p.appPromptDismissed = q.get('appprompt') !== 'on'
  if (q.get('masjid') === 'on') p.myMasjid = DEMO_MASJID
  if (q.get('large') === '1') p.largeText = true
  if (demo.variant === 'visitor') {
    p.homeConfirmed = true
    p.home = { id: 'demo-sydney', name: 'Sydney', countryCode: 'AU', countryName: 'Australia', timeZoneID: 'Australia/Sydney', coordinates: { latitude: -33.8688, longitude: 151.2093 } }
    p.manualPlace = { id: 'demo-kl', name: 'Kuala Lumpur', countryCode: 'MY', countryName: 'Malaysia', timeZoneID: 'Asia/Kuala_Lumpur', coordinates: { latitude: 3.139, longitude: 101.6869 } }
    p.lastCountryCode = 'MY'
    p.trackerEnabled = false
  }
  if (demo.variant === 'makkah') {
    p.manualPlace = { id: 'demo-makkah', name: 'Makkah', countryCode: 'SA', countryName: 'Saudi Arabia', timeZoneID: 'Asia/Riyadh', coordinates: KAABA }
    p.lastCountryCode = 'SA'
    p.musafirEnabled = true
  }
  if (demo.variant === 'travel') {
    p.manualPlace = { id: 'demo-hanoi', name: 'Hoàn Kiếm', region: 'Hanoi', countryCode: 'VN', countryName: 'Vietnam', timeZoneID: 'Asia/Ho_Chi_Minh', coordinates: { latitude: 21.0285, longitude: 105.8542 } }
    p.lastCountryCode = 'VN'
    p.musafirEnabled = true
    p.arrivedAt = now
    p.musafirChipDismissed = false
    p.arrivalBannerDismissed = false
    p.trip = [
      { countryCode: 'VN', countryName: 'Vietnam', placeName: 'Hoàn Kiếm', arrived: now },
      { countryCode: 'SG', countryName: 'Singapore', placeName: 'Pasir Ris', arrived: now - 86_400_000 * 30 },
    ]
  }
  // ?city=city-gb-london: just landed in any built-in city (worldwide screenshots).
  const city = CITIES.find((c) => c.id === q.get('city'))
  if (city) {
    p.manualPlace = city
    p.lastCountryCode = city.countryCode ?? null
    p.musafirEnabled = true
    p.arrivedAt = now
    p.musafirChipDismissed = false
    p.arrivalBannerDismissed = false
  }
  return p
}

export const store = new AppStore()

/** Re-render when the store changes. */
export function useStore(): AppStore {
  const [, setRev] = useState(store.revision)
  useEffect(() => store.subscribe(() => setRev(store.revision)), [])
  return store
}

/** The clock: real time, or the demo's fixed instant. Ticks every second. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(store.now())
  useEffect(() => {
    if (store.demo?.now != null) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return store.demo?.now ?? now
}

export type { AppStore }
export { daysBetween }

/** Every "yyyy-MM-dd" from `from` to `to`, both included (at most a year). */
export function daysFrom(from: string, to: string): string[] {
  const out: string[] = []
  const [y, m, d] = from.split('-').map(Number)
  for (let i = 0; i < 366; i++) {
    const t = new Date(Date.UTC(y, m - 1, d + i))
    const key = ymdKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
    if (key > to) break
    out.push(key)
  }
  return out
}
