import { ArrowUpRight, Globe } from 'lucide-preact'
import { Kaaba } from './icons'

/**
 * The app is free and built fisabilillah by Nasar Pte Ltd. The only promotion in
 * it is for the makers' own services - no ad networks, nothing tracked: each
 * card just opens the website (Makers.swift).
 */
export type Offer = 'badal' | 'digital'
export const OFFERS: Offer[] = ['badal', 'digital']

const TITLE: Record<Offer, string> = { badal: 'Badal Haji & Umrah', digital: 'NasarDigital' }
const SUBTITLE: Record<Offer, string> = {
  badal: 'Performed in Makkah for loved ones who have passed on or cannot go',
  digital: 'Digital marketing from the team behind this app',
}
const SITE: Record<Offer, string> = { badal: 'Badal.sg', digital: 'nasardigital.com' }
const BASE: Record<Offer, string> = { badal: 'https://badal.sg', digital: 'https://nasardigital.com' }

/** The website, tagged with where in the app it was tapped (same parameters as the iOS app). */
export function offerURL(o: Offer, placement: string): string {
  return `${BASE[o]}/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=${placement}`
}

/** Badal is offered to Singaporeans for now; everyone else sees NasarDigital. */
export const featuredOffer = (country: string): Offer => (country === 'SG' ? 'badal' : 'digital')

export function MakersCard({ offer, placement, compact }: { offer: Offer; placement: string; compact?: boolean }) {
  return (
    <a class={`makers-card glass ${compact ? 'compact' : ''}`} href={offerURL(offer, placement)} target="_blank" rel="noopener noreferrer"
      aria-label={`${TITLE[offer]} - opens ${SITE[offer]}`}>
      <span class="makers-icon">
        {offer === 'badal' ? <Kaaba size={compact ? 15 : 18} /> : <Globe size={compact ? 15 : 17} strokeWidth={2.2} class="accent" />}
      </span>
      <span class="makers-text">
        <span class="makers-title">{TITLE[offer]}</span>
        {!compact && <span class="makers-sub">{SUBTITLE[offer]}</span>}
      </span>
      <span class="makers-site">{SITE[offer]}</span>
      <ArrowUpRight size={13} strokeWidth={2.6} class="accent" />
    </a>
  )
}

export function MakersAbout({ placement }: { placement: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
      <h3 class="display" style={{ fontSize: '26px', fontWeight: 700, margin: 0 }}>Built fisabilillah</h3>
      <p class="secondary" style={{ margin: 0 }}>
        Prayer Times Asia is free, with no ad networks and nothing tracked. It is built and looked after by the team at Nasar Pte Ltd.
      </p>
      {OFFERS.map((o) => <MakersCard offer={o} placement={placement} />)}
    </div>
  )
}
