/**
 * The azan for prayer time alerts on the web. The recordings sit in
 * src/assets/azan/ as azan.mp3 and azan-subuh.mp3, made from one source
 * recording by tools/make_azan.sh. They are picked up at build time, so before
 * they are added the switch stays hidden and nothing plays.
 *
 * A web page can only play sound while it is open, and some browsers only after
 * the page has been tapped once; when the browser refuses, the notification
 * still shows.
 */
const files = import.meta.glob('../assets/azan/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const url = (name: string): string | undefined => files[`../assets/azan/${name}`]

export const azanAvailable = (): boolean => !!url('azan.mp3')

let playing: HTMLAudioElement | null = null

export function playAzan(subuh: boolean): void {
  const src = (subuh && url('azan-subuh.mp3')) || url('azan.mp3')
  if (!src) return
  stopAzan()
  playing = new Audio(src)
  playing.play().catch(() => { playing = null })
}

export function stopAzan(): void {
  playing?.pause()
  playing = null
}
