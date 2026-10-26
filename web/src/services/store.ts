import { useEffect, useState } from 'preact/hooks'
import { computeBlessed, type BlessedTime } from '../core/blessed'
import { defaultAuthority, type CalendarAnnouncement, type CalendarDataset, type HijriEvent } from '../core/calendarSanad'
import { computeFor, ordered, type PrayerDay } from '../core/engine'
import { KAABA } from '../core/geo'
import { isRamadan } from '../core/hijri'
import { methodWithId, type CalculationMethod } from '../core/methods'
import { musafirStatus, type MusafirRules, type MusafirStatus } from '../core/musafir'
import { officialSourceFor, sourceLabel, type OfficialSource } from '../core/official'
import { isNear, newPlaceId, placeProfile, type Place } from '../core/place'
import { OBLIGATORY, PRAYERS, prayerName, type AsrSchool, type NamingStyle, type Prayer } from '../core/prayer'
import { countryForTimeZone, FALLBACK_PROFILE, personalNaming, profileFor, profileMethod, type CountryProfile } from '../core/regions'
import {
  disagreements, jamaahTimes, mosqueAsr, mosqueMethod, mosqueNear, type MosqueDataset, type MosqueProfile,
} from '../core/sources'
import { dayKey, daysBetween, deviceTimeZone, zoned, zonedTime } from '../core/tz'
import { nearestCity } from './cities'
import { ensureTable, rowFor, tableFor } from './officialTables'
import { DEFAULT_PREFS, loadPreferences, savePreferences, type Preferences, type TodayStyle } from './prefs'
import { fetchOK, readJSON, readString, writeJSON, writeString } from './storage'

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

  get activePlace(): Place | null {
    return this.prefs.useGPS ? (this.gpsPlace ?? this.prefs.manualPlace) : this.prefs.manualPlace
  }

  get profile(): CountryProfile {
    const p = this.activePlace
    return p ? placeProfile(p) : FALLBACK_PROFILE
  }

  get method(): CalculationMethod {
    return methodWithId(this.prefs.methodOverrideID) ?? profileMethod(this.profile)
  }

  get isMethodAutomatic(): boolean { return this.prefs.methodOverrideID == null }
  get asrSchool(): AsrSchool { return this.prefs.asrOverride ?? this.profile.asr }
  get personalNaming(): NamingStyle { return personalNaming(this.prefs.home?.countryCode, navigatorLocale()) }
  /** Your names - from your home or your browser, not from where you are. */
  get naming(): NamingStyle { return this.prefs.namingOverride ?? this.personalNaming }
  /** The words used where you are (the masjid's signs). */
  get localNaming(): NamingStyle { return this.profile.naming }

  name(p: Prayer, at?: number): string {
    return prayerName(p, this.naming, at != null && this.isFriday(at))
  }

  /** The local word for a prayer, when it differs from yours. */
  localName(p: Prayer, at: number): string | null {
    if (!this.prefs.showLocalNames || this.localNaming === this.naming) return null
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
    if (!place) return null
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
    if (mosque) {
      result.mosqueName = mosque.name
      result.jamaah = jamaahTimes(mosque, result, tz, this.isFriday(result.times.dhuhr))
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

  blessed(day: PrayerDay): [BlessedTime, number][] {
    const place = this.activePlace
    const nextDay = this.nextDay(day)
    if (!place || !nextDay) return []
    const ramadan = isRamadan(day.times.dhuhr, this.timeZone, this.prefs.hijriAdjustment)
    return computeBlessed(day, nextDay, place.coordinates, ramadan)
  }

  formatted(ms: number): string {
    const p = this.timeParts(ms)
    return p.suffix ? `${p.time} ${p.suffix}` : p.time
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

  isExcused(ms: number): boolean { return this.prefs.excusedDays.includes(this.dayKey(ms)) }

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
      const complete = this.prefs.excusedDays.includes(key) || (this.prefs.prayedLog[key]?.length ?? 0) >= OBLIGATORY.length
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

  setHome(place: Place): void {
    this.update((p) => { p.home = place })
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
    if (stale('ptasia.calendar.at', 3 * 3_600_000)) {
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
  p.manualPlace = PASIR_RIS
  p.lastCountryCode = 'SG'
  p.trackerEnabled = true
  for (let back = 1; back <= 3; back++) {
    p.prayedLog[dayKey(now - back * 86_400_000, 'Asia/Singapore')] = [...OBLIGATORY]
  }
  const appearance = q.get('appearance')
  p.appearance = appearance === 'light' || appearance === 'dark' || appearance === 'system' ? appearance : 'dark'
  const style = q.get('style') as TodayStyle | null
  if (style && ['list', 'centre', 'dial', 'sunPath', 'bands'].includes(style)) p.todayStyle = style
  if (q.get('alerts') === 'on') { p.notificationsEnabled = true; p.alertsPromptDismissed = true }
  p.appPromptDismissed = q.get('appprompt') !== 'on'
  if (demo.variant === 'visitor') {
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
    p.arrivalBannerDismissed = false
    p.trip = [
      { countryCode: 'VN', countryName: 'Vietnam', placeName: 'Hoàn Kiếm', arrived: now },
      { countryCode: 'SG', countryName: 'Singapore', placeName: 'Pasir Ris', arrived: now - 86_400_000 * 30 },
    ]
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
