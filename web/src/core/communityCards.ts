/**
 * The small cards under Show more on the Prayer screen and in Settings.
 * No ad networks, nothing tracked: each card is a plain link. The list lives in
 * data/community-cards.json (one copy for all three apps, every card approved by
 * hand against docs/community-cards.md). Same rules as CommunityCards.swift and
 * CommunityCards.kt.
 */
import { COMMUNITY_CARDS } from './communityCardsData'

export type CommunityCard = {
  id: string
  /** ours = the makers' own services; sponsor = a paid community card, shown with a Sponsored tag. */
  kind: 'ours' | 'sponsor'
  /** Two letter country codes, or '*' for everywhere. */
  countries: string[]
  title: string
  subtitle: string
  site: string
  url: string
  icon: 'kaaba' | 'globe' | 'shop' | 'heart'
  /** First and last day shown (YYYY-MM-DD, the phone's own date). */
  from?: string
  until?: string
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Days since 1 January 1970 by the phone's own calendar, so the card changes at local midnight. */
export const dayNumber = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)

/** Every card for this country today: its own cards plus the ones for everywhere, in list order. */
export function cardsFor(country: string, date: Date, all: CommunityCard[] = COMMUNITY_CARDS): CommunityCard[] {
  const today = ymd(date)
  return all.filter((c) =>
    (c.countries.includes('*') || c.countries.includes(country)) &&
    (!c.from || c.from <= today) && (!c.until || today <= c.until))
}

/** Today's one card on the Prayer screen. It moves to the next one each day. */
export function cardOfTheDay(country: string, date: Date, all: CommunityCard[] = COMMUNITY_CARDS): CommunityCard | null {
  const pool = cardsFor(country, date, all)
  return pool.length ? pool[dayNumber(date) % pool.length] : null
}

/** The makers' own cards, listed in Settings. */
export const ourCards = (country: string, date: Date) => cardsFor(country, date).filter((c) => c.kind === 'ours')

/** The website, tagged with where in the app it was tapped (same parameters as the iOS app). */
export function cardURL(c: CommunityCard, placement: string): string {
  const sep = c.url.includes('?') ? '&' : (c.url.endsWith('/') ? '?' : '/?')
  return `${c.url}${sep}utm_source=prayertimesasia&utm_medium=app&utm_campaign=${placement}`
}
