import { ArrowUpRight, Globe, Heart, Store } from 'lucide-preact'
import { cardURL, ourCards, type CommunityCard } from '../core/communityCards'
import { Hadith } from './Hadith'
import { Kaaba } from './icons'

/**
 * The app is free and built fisabilillah in Singapore by Ustaz Aarif Raziff and Nasar Digital (Nasar Pte Ltd).
 * The cards are our own services and, from time to time, a hand picked halal
 * sponsor for the user's country (data/community-cards.json). No ad networks,
 * nothing tracked: each card just opens the website (Makers.swift).
 */
function CardIcon({ card, compact }: { card: CommunityCard; compact?: boolean }) {
  const size = compact ? 15 : 17
  switch (card.icon) {
    case 'kaaba': return <Kaaba size={compact ? 15 : 18} />
    case 'shop': return <Store size={size} strokeWidth={2.2} class="accent" />
    case 'heart': return <Heart size={size} strokeWidth={2.2} class="accent" />
    default: return <Globe size={size} strokeWidth={2.2} class="accent" />
  }
}

export function MakersCard({ card, placement, compact }: { card: CommunityCard; placement: string; compact?: boolean }) {
  const sponsor = card.kind === 'sponsor'
  return (
    <a class={`makers-card glass ${compact ? 'compact' : ''}`} href={cardURL(card, placement)} target="_blank" rel="noopener noreferrer sponsored"
      aria-label={`${sponsor ? 'Sponsored. ' : ''}${card.title}, opens ${card.site}`}>
      <span class="makers-icon"><CardIcon card={card} compact={compact} /></span>
      <span class="makers-text">
        {sponsor && <span class="makers-tag">Sponsored</span>}
        <span class="makers-title">{card.title}</span>
        {!compact && <span class="makers-sub">{card.subtitle}</span>}
      </span>
      <span class="makers-site">{card.site}</span>
      <ArrowUpRight size={13} strokeWidth={2.6} class="accent" />
    </a>
  )
}

export function MakersAbout({ placement, country }: { placement: string; country: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
      <Hadith id="fixedTimes" tag="Al Quran" />
      <h3 class="display" style={{ fontSize: '26px', fontWeight: 700, margin: 0 }}>Built fisabilillah</h3>
      <p class="secondary" style={{ margin: 0 }}>
        Prayer Times Asia is free, with no ad networks and nothing tracked. It is built and looked after by Ustaz Aarif Raziff and the team at Nasar Digital (Nasar Pte Ltd).
      </p>
      {ourCards(country, new Date()).map((c) => <MakersCard card={c} placement={placement} />)}
    </div>
  )
}
