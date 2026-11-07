import type { AlarmSound } from '../core/wakeup'

/**
 * The alarm sounds on the web, made by tools/make_alarm_sounds.py (our own
 * tones, nothing licensed). A web page can only play sound while it is open,
 * and some browsers only after the page has been tapped once.
 */
const files = import.meta.glob('../assets/alarm/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>

const url = (sound: AlarmSound): string | undefined => files[`../assets/alarm/${sound === 'phone' ? 'classic' : sound}.mp3`]

let playing: HTMLAudioElement | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null

/** Rings the alarm, looping for up to `seconds` or until stopped (the page is tapped). */
export function playAlarm(sound: AlarmSound, seconds = 120): void {
  stopAlarm()
  const src = url(sound)
  if (!src) return
  const audio = new Audio(src)
  audio.loop = true
  playing = audio
  audio.play().catch(() => { if (playing === audio) playing = null })
  stopTimer = setTimeout(stopAlarm, seconds * 1000)
  const stop = () => { stopAlarm(); window.removeEventListener('pointerdown', stop); window.removeEventListener('keydown', stop) }
  window.addEventListener('pointerdown', stop, { once: true })
  window.addEventListener('keydown', stop, { once: true })
}

/** A few seconds of a sound, to hear it before choosing. */
export function previewAlarm(sound: AlarmSound): void {
  stopAlarm()
  const src = url(sound)
  if (!src) return
  playing = new Audio(src)
  playing.play().catch(() => { playing = null })
  stopTimer = setTimeout(stopAlarm, 5000)
}

export function isPreviewing(): boolean {
  return !!playing && !playing.paused
}

export function stopAlarm(): void {
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  playing?.pause()
  playing = null
}
