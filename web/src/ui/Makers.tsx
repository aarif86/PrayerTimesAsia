import { ArrowUpRight, Globe, Heart, Store } from 'lucide-preact'
import { useEffect, useRef } from 'preact/hooks'
import { store } from '../services/store'
import { cardURL, ourCards, type CommunityCard } from '../core/communityCards'
import { Hadith } from './Hadith'
import { Kaaba } from './icons'
import { tr } from '../core/appWords'

/**
 * The app is free and built fisabilillah in Singapore by Ustaz Aarif Raziff and Ustazah Nasibah Hamzah, with Nasar Digital (Nasar Pte Ltd).
 * The cards are our own services and, from time to time, a hand picked halal
 * sponsor for the user's country (data/community-cards.json). No outside ads,
 * nothing tracked: each card just opens the website (Makers.swift).
 */
/** The name of the card space. One place to change it (Makers.swift and Makers.kt have the same). */
export const PICKS_NAME = 'Barakah Picks'

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
  const ref = useRef<HTMLAnchorElement>(null)
  const facts = { id: card.id, kind: card.kind, placement }
  // Seen means at least half the card was really on screen, counted once a day.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { store.countCard('Card.seen', facts); io.disconnect() }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [card.id, placement])
  return (
    <a ref={ref} class={`makers-card glass ${compact ? 'compact' : ''}`} href={cardURL(card, placement)} target="_blank" rel="noopener noreferrer sponsored"
      onClick={() => store.countCard('Card.tapped', facts)}
      aria-label={`${PICKS_NAME}${sponsor ? `, ${tr('makers.sponsored')}` : ''}. ${tr('makers.opens', { name: card.title, site: card.site })}`}>
      <span class="makers-icon"><CardIcon card={card} compact={compact} /></span>
      <span class="makers-text">
        <span class="makers-tag">{sponsor ? `${PICKS_NAME} · ${tr('makers.sponsored')}` : PICKS_NAME}</span>
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
      <h3 class="display" style={{ fontSize: '26px', fontWeight: 700, margin: 0 }}>{tr('makers.title')}</h3>
      <p class="secondary" style={{ margin: 0 }}>
        {tr('makers.body')}
      </p>
      {ourCards(country, new Date()).map((c) => <MakersCard card={c} placement={placement} />)}
    </div>
  )
}
