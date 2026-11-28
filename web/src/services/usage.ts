import { fetchOK, readJSON, readString, writeJSON, writeString } from './storage'

/**
 * Anonymous usage counts, sent to TelemetryDeck (privacy-first, no cookies, no
 * IP addresses stored). The same events, with the same names, come from the
 * iPhone and Android apps, so one dashboard shows everything. See docs/analytics.md.
 *
 * What is sent: a random ID made on this device (not linked to a person), the
 * platform and app version, and the city and country of the place in use
 * (never coordinates). The masjid screen also sends the masjid's name and look.
 * Nothing is sent until config/analytics.json has an App ID, when the user has
 * turned counting off, in demo mode, or when the browser asks sites not to track
 * (Global Privacy Control).
 */

const CONFIG_URL = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/config/analytics.json'
const ENDPOINT = 'https://nom.telemetrydeck.com/v2/'
const CONFIG_KEY = 'ptasia.usage.config'
const ID_KEY = 'ptasia.usage.id'
const OPENED_KEY = 'ptasia.usage.opened'
const CONFIG_MAX_AGE = 12 * 3_600_000
/** App opens closer together than this count once. */
export const OPEN_GAP_MS = 60 * 60_000
/** A masjid screen checks in on start and then every six hours. */
export const SCREEN_EVERY_MS = 6 * 3_600_000

export interface UsageConfig { telemetryDeckAppID: string; enabled: boolean }
interface CachedConfig extends UsageConfig { fetchedAt: number }

export type UsageEvent = 'App.installed' | 'App.opened' | 'Screen.running' | 'Screen.paired' | 'Card.seen' | 'Card.tapped' | 'App.daySummary'
export type Payload = Record<string, string | number | boolean>

export interface Signal {
  appID: string
  clientUser: string
  type: UsageEvent
  isTestMode: boolean
  payload: Payload
}

export interface Where { city?: string | null; countryCode?: string | null }

/** Shared keys for every event (the iPhone and Android apps use the same ones). */
export function basePayload(platform: 'web' | 'screen', version: string, where: Where, language: string): Payload {
  const out: Payload = {
    'App.platform': platform,
    'App.version': version,
    'App.language': language.slice(0, 2).toLowerCase(),
    // TelemetryDeck's own keys, so its ready-made charts (versions, regions) fill in too.
    'TelemetryDeck.AppInfo.version': version,
    'TelemetryDeck.Device.platform': 'Web',
    'TelemetryDeck.RunContext.locale': language,
  }
  const cc = where.countryCode?.toUpperCase()
  if (cc && /^[A-Z]{2}$/.test(cc)) { out['Place.country'] = cc; out['TelemetryDeck.UserPreference.region'] = cc }
  const city = cleanCity(where.city)
  if (city) out['Place.city'] = city
  return out
}

/** A place name fit to count: not the "Current location" placeholder, and short. */
export function cleanCity(name: string | null | undefined): string | null {
  const t = (name ?? '').trim()
  if (!t || t === 'Current location') return null
  return t.slice(0, 60)
}

export function makeSignal(config: UsageConfig, clientUser: string, type: UsageEvent, payload: Payload, testMode: boolean): Signal | null {
  if (!config.enabled || !config.telemetryDeckAppID.trim()) return null
  return { appID: config.telemetryDeckAppID.trim(), clientUser, type, isTestMode: testMode, payload }
}

/** Whether a new app open should be counted, given when the last one was. */
export function shouldCountOpen(lastOpened: number | null, now: number): boolean {
  return lastOpened == null || now - lastOpened >= OPEN_GAP_MS
}

// MARK: Sending (browser only)

function decodeConfig(raw: unknown): UsageConfig | null {
  const r = raw as Partial<UsageConfig> | null
  if (!r || typeof r !== 'object') return null
  return { telemetryDeckAppID: typeof r.telemetryDeckAppID === 'string' ? r.telemetryDeckAppID : '', enabled: r.enabled !== false }
}

async function loadConfig(): Promise<UsageConfig | null> {
  const cached = readJSON<CachedConfig>(CONFIG_KEY)
  if (cached && Date.now() - cached.fetchedAt < CONFIG_MAX_AGE) return decodeConfig(cached)
  const r = await fetchOK(CONFIG_URL)
  const fresh = r ? decodeConfig(await r.json().catch(() => null)) : null
  if (fresh) { writeJSON(CONFIG_KEY, { ...fresh, fetchedAt: Date.now() }); return fresh }
  return cached ? decodeConfig(cached) : null
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** This browser's random ID; `fresh` is true the first time (a new install). */
function deviceId(): { id: string; fresh: boolean } {
  const saved = readString(ID_KEY)
  if (saved) return { id: saved, fresh: false }
  const id = randomId()
  writeString(ID_KEY, id)
  return { id, fresh: true }
}

export function browserBlocksTracking(): boolean {
  return (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}

const isTestHost = () => /^(localhost|127\.|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/.test(location.hostname)

/** Sends the events if counting is on; never throws and never delays the app. */
async function send(types: UsageEvent[], payload: Payload, id: string): Promise<void> {
  try {
    if (browserBlocksTracking()) return
    const config = await loadConfig()
    if (!config) return
    const signals = types.map((t) => makeSignal(config, id, t, payload, isTestHost())).filter((s): s is Signal => !!s)
    if (!signals.length) return
    await fetch(ENDPOINT, {
      method: 'POST', body: JSON.stringify(signals), keepalive: true,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }, credentials: 'omit', referrerPolicy: 'no-referrer',
    })
  } catch { /* offline or blocked: counting is best-effort */ }
}

/** Counts this app open (and the first ever as an install), at most once an hour. */
export function countAppOpen(version: string, where: Where): void {
  const now = Date.now()
  const last = readJSON<number>(OPENED_KEY)
  if (!shouldCountOpen(last, now)) return
  writeJSON(OPENED_KEY, now)
  const { id, fresh } = deviceId()
  const payload = basePayload('web', version, where, navigator.language || 'en')
  payload['Web.installedToHomeScreen'] = matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  payload['Web.phone'] = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  void send(fresh ? ['App.installed', 'App.opened'] : ['App.opened'], payload, id)
}

export interface ScreenFacts {
  masjid: string
  city: string | null
  countryCode: string | null
  look: string
  language: string
}

/** The masjid screen's check-in: which masjid, where, and how it looks. */
export function screenPayload(version: string, s: ScreenFacts, portrait: boolean): Payload {
  const payload = basePayload('screen', version, { city: s.city, countryCode: s.countryCode }, s.language)
  payload['Masjid.name'] = s.masjid.trim().slice(0, 80) || '(no name)'
  payload['Screen.look'] = s.look
  payload['Screen.language'] = s.language
  payload['Screen.orientation'] = portrait ? 'portrait' : 'landscape'
  return payload
}

/**
 * Counts a running masjid screen. It has its own random ID, kept on that TV,
 * so two screens at one masjid count as two.
 */
export function countScreenRunning(version: string, s: ScreenFacts): void {
  let id = readString(SCREEN_ID_KEY)
  const fresh = !id
  if (!id) { id = randomId(); writeString(SCREEN_ID_KEY, id) }
  const payload = screenPayload(version, s, innerHeight > innerWidth)
  void send(fresh ? ['App.installed', 'Screen.running'] : ['Screen.running'], payload, id)
}

const SCREEN_ID_KEY = 'ptasia.usage.screen'

// MARK: Barakah Picks counts (docs/community-cards.md)

const CARD_SEEN_KEY = 'ptasia.usage.cardSeen'

export interface CardFacts { id: string; kind: string; placement: string }

/** What a card count says: which card, where in the app, and the usual app keys. */
export function cardPayload(version: string, where: Where, language: string, card: CardFacts): Payload {
  const payload = basePayload('web', version, where, language)
  payload['Card.id'] = card.id
  payload['Card.kind'] = card.kind
  payload['Card.placement'] = card.placement
  return payload
}

/** A card counts as seen once a day on each device, however often it scrolls past. */
export function shouldCountSeen(seen: Record<string, string> | null, cardId: string, today: string): boolean {
  return seen?.[cardId] !== today
}

/**
 * Counts a Barakah Picks card seen on screen (once a day) or tapped. Only the
 * card and the usual anonymous keys are sent, never who tapped. The caller
 * checks Settings first, the same as for app opens.
 */
export function countCard(event: 'Card.seen' | 'Card.tapped', version: string, where: Where, card: CardFacts, today: string): void {
  if (event === 'Card.seen') {
    const seen = readJSON<Record<string, string>>(CARD_SEEN_KEY)
    if (!shouldCountSeen(seen, card.id, today)) return
    // Keep only today's marks so the record stays tiny.
    const next: Record<string, string> = Object.fromEntries(Object.entries(seen ?? {}).filter(([, d]) => d === today))
    next[card.id] = today
    writeJSON(CARD_SEEN_KEY, next)
  }
  const { id } = deviceId()
  void send([event], cardPayload(version, where, navigator.language || 'en', card), id)
}

// MARK: A day's use, sent once the next day (App.daySummary)

/**
 * How long the app was on screen today, how many times it was opened and which
 * screens were used. Kept on the device and sent as ONE count the next time the
 * app opens on a later day, so a whole day costs one event. Same rules in
 * UsageCounter.swift and UsageCounter.kt.
 */
export interface DayTally { day: string; seconds: number; opens: number; screens: string[]; actions?: string[] }

/** One stretch on screen counts at most this long (a phone left open on a table). */
export const MAX_STRETCH_S = 2 * 3600
export const SCREENS = ['prayer', 'qibla', 'falak', 'masjid', 'settings'] as const
/** Things done today worth knowing about, each sent as true or false (Did.qiblaCompass ...). Same list on the phones. */
export const ACTIONS = ['qiblaCompass', 'qiblaFaced', 'falakShadow', 'falakLevel', 'falakAR'] as const

export const emptyTally = (day: string): DayTally => ({ day, seconds: 0, opens: 0, screens: [], actions: [] })

/** Starts today's tally, handing back yesterday's (or older) if it has anything to send. */
export function rollTally(t: DayTally | null, today: string): { tally: DayTally; finished: DayTally | null } {
  if (t && t.day === today) return { tally: t, finished: null }
  return { tally: emptyTally(today), finished: t && (t.seconds > 0 || t.opens > 0) ? t : null }
}

export function addStretch(t: DayTally, seconds: number): DayTally {
  const s = Math.max(0, Math.min(MAX_STRETCH_S, Math.round(seconds)))
  return { ...t, seconds: t.seconds + s }
}

export function addScreen(t: DayTally, screen: string): DayTally {
  return t.screens.includes(screen) ? t : { ...t, screens: [...t.screens, screen] }
}

/** Rough bands for easy charts, next to the exact minutes. */
export function minutesBand(minutes: number): string {
  if (minutes < 1) return 'under 1'
  if (minutes < 5) return '1 to 5'
  if (minutes < 15) return '5 to 15'
  if (minutes < 30) return '15 to 30'
  if (minutes < 60) return '30 to 60'
  return 'over 60'
}

export function addAction(t: DayTally, action: string): DayTally {
  const have = t.actions ?? []
  return have.includes(action) ? t : { ...t, actions: [...have, action] }
}

/**
 * How the app is set up today, as short words and yes or no (never anything typed
 * by the person, never a place). Sent once a day inside App.daySummary. The same
 * keys come from the iPhone and Android apps.
 */
export interface SettingsFacts {
  look: string
  theme: string
  /** The app language the person picked, or 'auto' for the phone's own. */
  language: string
  /** How many of the five prayers have an alert (0 when alerts are off). */
  alertPrayers: number
  azanSound: boolean
  azanVoice: string
  azanLength: 'short' | 'full'
  ownAzan: boolean
  /** How many alarms are set (Subuh, sahur, other prayers). */
  alarms: number
  largeText: boolean
  tracker: boolean
  myMasjid: boolean
  /** Home screen widgets in use (phones only). */
  widgets: number
}

export function settingsPayload(f: SettingsFacts): Payload {
  return {
    'Pref.look': f.look, 'Pref.theme': f.theme, 'Pref.language': f.language,
    'Pref.alertPrayers': f.alertPrayers, 'Pref.alertsOn': f.alertPrayers > 0,
    'Pref.azanSound': f.azanSound, 'Pref.azanVoice': f.azanVoice, 'Pref.azanLength': f.azanLength, 'Pref.ownAzan': f.ownAzan,
    'Pref.alarms': f.alarms, 'Pref.largeText': f.largeText, 'Pref.tracker': f.tracker, 'Pref.myMasjid': f.myMasjid, 'Pref.widgets': f.widgets,
  }
}

export function dayPayload(base: Payload, t: DayTally, facts?: SettingsFacts): Payload {
  const minutes = Math.round(t.seconds / 60)
  const out: Payload = { ...base, 'Day.date': t.day, 'Day.minutes': minutes, 'Day.minutesBand': minutesBand(t.seconds / 60), 'Day.opens': t.opens, 'Day.screens': [...t.screens].sort().join(',') }
  for (const s of SCREENS) out[`Used.${s}`] = t.screens.includes(s)
  for (const a of ACTIONS) out[`Did.${a}`] = (t.actions ?? []).includes(a)
  if (facts) Object.assign(out, settingsPayload(facts))
  return out
}

const TALLY_KEY = 'ptasia.usage.day'
let activeSince: number | null = null
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function saveStretch(): void {
  if (activeSince == null) return
  const now = Date.now()
  const t = rollTally(readJSON<DayTally>(TALLY_KEY), localDay()).tally
  writeJSON(TALLY_KEY, addStretch(t, (now - activeSince) / 1000))
  activeSince = now
}

/**
 * The app came on screen. Counts one open for today, starts the clock and, on
 * the first open of a new day, sends the last day's summary. The caller checks
 * Settings first.
 */
export function tallyStart(version: string, where: Where, facts?: SettingsFacts): void {
  const { tally, finished } = rollTally(readJSON<DayTally>(TALLY_KEY), localDay())
  writeJSON(TALLY_KEY, { ...tally, opens: tally.opens + 1 })
  activeSince = Date.now()
  if (finished) {
    const { id } = deviceId()
    void send(['App.daySummary'], dayPayload(basePayload('web', version, where, navigator.language || 'en'), finished, facts), id)
  }
}

/** The app left the screen: adds the time since it came on. */
export function tallyStop(): void {
  saveStretch()
  activeSince = null
}

/** A screen (tab) was used today. */
export function tallyScreen(screen: string): void {
  const t = rollTally(readJSON<DayTally>(TALLY_KEY), localDay()).tally
  writeJSON(TALLY_KEY, addScreen(t, screen))
}

/** Something worth knowing was done today (Did.qiblaCompass ...). The caller checks Settings first. */
export function tallyAction(action: string): void {
  const t = rollTally(readJSON<DayTally>(TALLY_KEY), localDay()).tally
  writeJSON(TALLY_KEY, addAction(t, action))
}

// MARK: A TV paired with a phone

/** The masjid screen was paired (once per pairing), so setup success can be told from drop-off. */
export function countScreenPaired(version: string, s: ScreenFacts): void {
  let id = readString(SCREEN_ID_KEY)
  if (!id) { id = randomId(); writeString(SCREEN_ID_KEY, id) }
  void send(['Screen.paired'], screenPayload(version, s, innerHeight > innerWidth), id)
}
