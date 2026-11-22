import { useEffect, useState } from 'preact/hooks'

import { readString, writeString } from '../services/storage'

/**
 * "24 masjid screens are on right now" on the setup page, and the TV's side of it.
 *
 * Each TV sends a random ID made on the TV every 15 minutes, with its country, look and
 * screen language (no masjid name, never the city),
 * to the small counter in functions/screens.js. The setup page shows the count, and
 * /app/screen/stats/ shows the history. The line stays hidden when the count can't be read
 * or is zero. `?count=24` shows a made-up number, for screenshots of the design only.
 */
const FUNCTIONS = 'https://asia-southeast1-prayertimes-asia.cloudfunctions.net'
export const COUNT_URL = `${FUNCTIONS}/screenCount`
export const STATS_URL = `${FUNCTIONS}/screenStats`
const PING_URL = `${FUNCTIONS}/screenPing`
export const PING_EVERY_MS = 15 * 60_000
const ID_KEY = 'ptasia.screen.id'

/** This TV's random ID, made once and kept in its browser. */
export function screenId(): string {
  let id = readString(ID_KEY)
  if (!id || !/^[A-Za-z0-9_-]{22,40}$/.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    writeString(ID_KEY, id)
  }
  return id
}

/**
 * "This screen is on." Plain text body, so the browser sends it without an extra check first.
 * Resolves to how far the TV's clock is off from the server, in ms (positive: the TV is behind),
 * or null when it could not tell.
 */
export async function pingScreen(facts: { cc: string | null; look: string; lang: string }): Promise<number | null> {
  if (!navigator.onLine) return null
  try {
    const sent = Date.now()
    const r = await fetch(PING_URL, { method: 'POST', body: JSON.stringify({ id: screenId(), cc: facts.cc ?? undefined, look: facts.look, lang: facts.lang }) })
    const got = Date.now()
    if (!r.ok) return null
    const j = (await r.json()) as { now?: unknown }
    // A slow answer can't tell a clock that is a minute out.
    if (typeof j.now !== 'number' || got - sent > 10_000) return null
    return j.now - (sent + got) / 2
  } catch { return null }
}

/** The TV clock check alone, for screens that are not counted: asks the time and sends nothing about the screen. */
export async function checkClock(): Promise<number | null> {
  if (!navigator.onLine) return null
  try {
    const sent = Date.now()
    const r = await fetch(COUNT_URL, { cache: 'no-store' })
    const got = Date.now()
    if (!r.ok) return null
    const j = (await r.json()) as { now?: unknown }
    if (typeof j.now !== 'number' || got - sent > 10_000) return null
    return j.now - (sent + got) / 2
  } catch { return null }
}

/**
 * The correction to use from a fresh measurement: from 30 seconds out it applies, and once applied it
 * only goes back to none under 10 seconds, so a clock near the line does not flip every check.
 */
export function nextClockFix(current: number, measured: number): number {
  const off = Math.abs(measured)
  if (off >= 30_000 || (current !== 0 && off >= 10_000)) return Math.round(measured)
  return 0
}

const FIX_KEY = 'ptasia.screen.clockFix'
/** Keeps the last correction across the nightly reload. Dropped after a day, or if the TV clock went backwards (a reset). */
export function saveClockFix(fix: number): void { writeString(FIX_KEY, JSON.stringify({ fix, at: Date.now() })) }
export function savedClockFix(now = Date.now()): number {
  try {
    const v = JSON.parse(readString(FIX_KEY) ?? 'null') as { fix?: unknown; at?: unknown } | null
    if (!v || typeof v.fix !== 'number' || typeof v.at !== 'number') return 0
    return now >= v.at && now - v.at < 86_400_000 ? v.fix : 0
  } catch { return 0 }
}

/** More than two minutes out is worth telling the committee about. */
export const CLOCK_WARN_MS = 2 * 60_000

export function useLiveScreenCount(): number | null {
  const demo = new URLSearchParams(location.search).get('count')
  const [n, setN] = useState<number | null>(demo != null && /^\d+$/.test(demo) ? +demo : null)
  useEffect(() => {
    if (demo != null || !COUNT_URL) return
    let stop = false
    const get = () => fetch(COUNT_URL).then((r) => r.ok ? r.json() : null)
      .then((j: { running?: unknown } | null) => { if (!stop && typeof j?.running === 'number' && j.running > 0) setN(j.running) })
      .catch(() => undefined)
    get()
    const id = setInterval(get, 5 * 60_000)
    return () => { stop = true; clearInterval(id) }
  }, [])
  return n
}


/** The short links (functions/screens.js): the settings are kept under a 9 letter code, so the link on the TV stays short. */
const LINK_SAVE_URL = `${FUNCTIONS}/screenLinkSave`
const LINK_URL = `${FUNCTIONS}/screenLink`

/** Saves the settings (the same text that follows `#c=`) and returns their short code, or null when it can't. */
export async function saveShortLink(encoded: string): Promise<string | null> {
  try {
    const r = await fetch(LINK_SAVE_URL, { method: 'POST', body: JSON.stringify({ c: encoded }) })
    if (!r.ok) return null
    const j = (await r.json()) as { code?: unknown }
    return typeof j.code === 'string' && /^[A-Za-z0-9]{9}$/.test(j.code) ? j.code : null
  } catch { return null }
}

/** The settings text for a short code, or null when it can't be read. */
export async function loadShortLink(code: string): Promise<string | null> {
  try {
    const r = await fetch(`${LINK_URL}?code=${encodeURIComponent(code)}`)
    if (!r.ok) return null
    const j = (await r.json()) as { c?: unknown }
    return typeof j.c === 'string' ? j.c : null
  } catch { return null }
}


/**
 * Pairing a TV with a phone, like signing in to a TV app (functions/screens.js). The TV shows a 6 letter code,
 * the phone sends the settings for that code, and the TV picks them up. Later changes from the phone reach the TV
 * without a new link. The TV holds `tvKey`, the phone holds `editKey`.
 */
const PAIR = `${FUNCTIONS}/screenPair`
export const PAIR_CODE_RE = /^[A-Z2-9]{6}$/
/** What a person typed, tidied the same way the server does: capitals, no spaces or dashes. */
export const tidyPairCode = (v: string): string => v.toUpperCase().replace(/[\s-]/g, '')

const post = async (path: string, body: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> => {
  try {
    const r = await fetch(`${PAIR}${path}`, { method: 'POST', body: JSON.stringify(body) })
    return { ok: r.ok, status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> }
  } catch { return { ok: false, status: 0, json: {} } }
}

export interface PairWait { code: string; tvKey: string; rev: number; startedAt: number }

/** The TV asks for a code to show. */
export async function pairStart(): Promise<PairWait | null> {
  const r = await post('Start', {})
  const j = r.json
  if (!r.ok || typeof j.code !== 'string' || typeof j.tvKey !== 'string' || !PAIR_CODE_RE.test(j.code)) return null
  return { code: j.code, tvKey: j.tvKey, rev: 0, startedAt: Date.now() }
}

/** The TV asks whether settings have arrived. `gone` means the code ran out or is not known. */
export async function pairSync(code: string, tvKey: string, rev: number): Promise<{ rev: number; c: string | null } | 'gone' | null> {
  try {
    const r = await fetch(`${PAIR}Sync?code=${encodeURIComponent(code)}&key=${encodeURIComponent(tvKey)}&rev=${rev}`, { cache: 'no-store' })
    if (r.status === 404 || r.status === 410) return 'gone'
    if (!r.ok) return null
    const j = (await r.json()) as { rev?: unknown; c?: unknown }
    return { rev: typeof j.rev === 'number' ? j.rev : rev, c: typeof j.c === 'string' ? j.c : null }
  } catch { return null }
}

/** The phone sends the settings to the TV that shows `code`. Returns the key to change them later, or why not. */
export async function pairClaim(code: string, encoded: string): Promise<{ editKey: string } | 'bad' | 'busy' | 'offline'> {
  const r = await post('Claim', { code, c: encoded })
  if (r.ok && typeof r.json.editKey === 'string') return { editKey: r.json.editKey }
  if (r.status === 0) return 'offline'
  return r.status === 429 ? 'busy' : 'bad'
}

/** The phone changes the settings of a TV it paired with before. */
export async function pairUpdate(code: string, editKey: string, encoded: string): Promise<'ok' | 'forgotten' | 'busy' | 'offline'> {
  const r = await post('Update', { code, editKey, c: encoded })
  if (r.ok) return 'ok'
  if (r.status === 0) return 'offline'
  return r.status === 429 ? 'busy' : 'forgotten'
}
