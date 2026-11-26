/**
 * The azan for prayer time alerts on the web, in two lengths made from one
 * recording by tools/make_azan.sh (see docs/azan-clip-spec.md):
 *   src/assets/azan/azan-short.mp3  the opening takbir only, about 12 seconds (the default)
 *   src/assets/azan/azan.mp3        the full azan
 * They are picked up at build time, so before they are added the switch stays
 * hidden and nothing plays.
 *
 * Fajr always uses the short call: the full recording is the ordinary azan,
 * without the Fajr line. An azan-subuh.mp3, if one is ever added, is used for
 * Fajr instead.
 *
 * A web page can only play sound while it is open, and some browsers only after
 * the page has been tapped once; when the browser refuses, the notification
 * still shows.
 */
const files = import.meta.glob('../assets/azan/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const url = (name: string): string | undefined => files[`../assets/azan/${name}`]

export const azanAvailable = (): boolean => !!(url('azan-short.mp3') || url('azan.mp3'))

/** True when both lengths are there, so the Short or Full choice is worth showing. */
export const hasBothLengths = (): boolean => !!(url('azan-short.mp3') && url('azan.mp3'))

/** The file for a length, falling back to the other length if only one is there. */
export const azanUrl = (full: boolean): string | undefined =>
  full ? url('azan.mp3') || url('azan-short.mp3') : url('azan-short.mp3') || url('azan.mp3')

let playing: HTMLAudioElement | null = null

/** Plays the azan: at Fajr the Fajr recording or the short call, otherwise the chosen length. */
export function playAzan(subuh: boolean, full: boolean, onEnd?: () => void): void {
  const src = subuh ? url('azan-subuh.mp3') || azanUrl(false) : azanUrl(full)
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
