/**
 * The azan for prayer time alerts on the web. Each voice has up to three
 * files in src/assets/azan/, made by tools/make_azan.sh (see docs/azan-clip-spec.md):
 *   azan-VOICE-short.mp3  the opening takbir only (the default length)
 *   azan-VOICE.mp3        the full azan
 *   azan-VOICE-fajr.mp3   a Fajr azan, played at Fajr when Full is chosen
 * They are picked up at build time. A voice only shows once its files are
 * there, so a slot waiting for permission (see docs/AUDIO_LICENSES.csv) stays
 * hidden until its files are added.
 *
 * A web page can only play sound while it is open, and some browsers only after
 * the page has been tapped once; when the browser refuses, the notification
 * still shows.
 */
const files = import.meta.glob('../assets/azan/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const url = (name: string): string | undefined => files[`../assets/azan/${name}`]

/** Every voice slot, in the order shown. The last four wait for permission. */
export const AZAN_VOICES = ['asim', 'makkah', 'khalaf', 'sudais', 'aqsa', 'egypt', 'madinah'] as const
export type AzanVoice = (typeof AZAN_VOICES)[number]
export const DEFAULT_VOICE: AzanVoice = 'asim'

const shortUrl = (v: string) => url(`azan-${v}-short.mp3`) || url(`azan-${v}.mp3`)
const fullUrl = (v: string) => url(`azan-${v}.mp3`) || url(`azan-${v}-short.mp3`)

/** The voices whose recordings are in the app. */
export const availableVoices = (): AzanVoice[] => AZAN_VOICES.filter((v) => !!shortUrl(v))

/** The chosen voice, or the first one there if it is missing. */
export const voiceOrDefault = (v: string | undefined): AzanVoice | undefined => {
  const all = availableVoices()
  return all.find((x) => x === v) ?? all[0]
}

export const azanAvailable = (): boolean => availableVoices().length > 0

/** True when a voice has both lengths, so the Short or Full choice means something. */
export const hasFull = (v: string): boolean => !!url(`azan-${v}.mp3`)
export const hasFajr = (v: string): boolean => !!url(`azan-${v}-fajr.mp3`)

/** The file to play. Fajr plays the voice's Fajr azan when Full is chosen, otherwise the short call. */
export const azanUrl = (voice: string | undefined, full: boolean, fajr = false): string | undefined => {
  const v = voiceOrDefault(voice)
  if (!v) return undefined
  if (fajr) return (full && url(`azan-${v}-fajr.mp3`)) || shortUrl(v)
  return full ? fullUrl(v) : shortUrl(v)
}

let playing: HTMLAudioElement | null = null

export function playAzan(src: string | undefined, onEnd?: () => void): void {
  if (!src) return
  stopAzan()
  const a = new Audio(src)
  playing = a
  a.onended = () => { if (playing === a) playing = null; onEnd?.() }
  a.play().catch(() => { if (playing === a) playing = null; onEnd?.() })
}

export function stopAzan(): void {
  playing?.pause()
  playing = null
}
