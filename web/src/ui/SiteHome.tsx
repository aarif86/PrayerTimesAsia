import { House } from 'lucide-preact'
import { isStandalone } from './pwa'

/**
 * A small house button back to the website's home page, on every tab of the web app.
 * Only in a browser tab: the installed app has no website around it, and big screens
 * already show the "prayertimes.asia" pill beside the app.
 */
export function SiteHomeButton({ class: cls = '' }: { class?: string }) {
  if (isStandalone()) return null
  return (
    <a class={`round-btn home-site-btn ${cls}`} href="../" aria-label="Back to the Prayer Times Asia website" title="Website home">
      <House size={17} />
    </a>
  )
}
