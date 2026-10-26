/** Small JSON cache in localStorage that never throws (private mode, quota). */
export function readJSON<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export function readString(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeString(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

/** fetch with a timeout; resolves to null on any failure (offline, CORS, HTTP error). */
export async function fetchOK(url: string, timeoutMs = 15000): Promise<Response | null> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    return r.ok ? r : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
