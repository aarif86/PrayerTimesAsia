import { useEffect, useState } from 'preact/hooks'

/**
 * "24 masjid screens are on right now" on the setup page.
 *
 * Not switched on yet: it needs a small counter on the server (see docs/masjid-screen.md,
 * "Live screen count"). Until COUNT_URL is set the line stays hidden. `?count=24` shows
 * a made-up number, for screenshots of the design only.
 */
export const COUNT_URL = ''

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
