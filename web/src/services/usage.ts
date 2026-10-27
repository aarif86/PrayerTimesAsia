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

export type UsageEvent = 'App.installed' | 'App.opened' | 'Screen.running'
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
