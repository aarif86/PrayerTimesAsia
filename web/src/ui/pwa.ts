/** Install prompt (Chrome, Edge, Android), standalone detection, and the phone apps on offer. */
import { appOffer, phonePlatform, safariShowsAppleBanner, type AppOffer } from '../core/nativeApps'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()) })
}

export const canInstall = () => deferred != null

export async function install(): Promise<void> {
  if (!deferred) return
  await deferred.prompt()
  await deferred.userChoice.catch(() => undefined)
  deferred = null
  listeners.forEach((f) => f())
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** The iPhone or Android app to offer on this device, if any. */
export function phoneAppOffer(): AppOffer | null {
  if (typeof navigator === 'undefined') return null
  return appOffer(phonePlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints))
}

/** Hide our own prompt where Safari is already showing Apple's App Store banner. */
export function appBannerShownByBrowser(): boolean {
  return phonePlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) === 'ios' && !isStandalone() && safariShowsAppleBanner(navigator.userAgent)
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined)
  })
}
