import { describe, expect, it } from 'vitest'
import data from '../../data/community-cards.json'
import { COMMUNITY_CARDS } from '../src/core/communityCardsData'
import { cardOfTheDay, cardsFor, cardURL, dayNumber, ourCards, type CommunityCard } from '../src/core/communityCards'

const card = (id: string, countries: string[], extra: Partial<CommunityCard> = {}): CommunityCard =>
  ({ id, kind: 'ours', countries, title: id, subtitle: id, site: `${id}.com`, url: `https://${id}.com`, icon: 'globe', ...extra })

describe('Community cards (docs/community-cards.md)', () => {
  it('the app has the cards in data/community-cards.json (run tools/build_community_cards.py after editing it)', () => {
    expect(COMMUNITY_CARDS.map((c) => c.id)).toEqual(data.cards.map((c) => c.id))
  })

  it('shows Badal and NasarDigital in every country, one a day in turn', () => {
    for (const country of ['SG', 'MY', 'ID', 'VN', 'GB']) {
      expect(cardsFor(country, new Date(2026, 10, 17)).map((c) => c.id)).toEqual(['badal', 'digital'])
    }
    const a = cardOfTheDay('SG', new Date(2026, 10, 17, 23, 59))!.id
    const b = cardOfTheDay('SG', new Date(2026, 10, 18, 0, 1))!.id
    expect(a).not.toBe(b)
    expect(cardOfTheDay('SG', new Date(2026, 10, 19))!.id).toBe(a)
  })

  it('gives each country its own cards plus the ones for everywhere', () => {
    const all = [card('everywhere', ['*']), card('sgshop', ['SG']), card('myshop', ['MY', 'BN'])]
    const d = new Date(2026, 10, 17)
    expect(cardsFor('SG', d, all).map((c) => c.id)).toEqual(['everywhere', 'sgshop'])
    expect(cardsFor('BN', d, all).map((c) => c.id)).toEqual(['everywhere', 'myshop'])
    expect(cardsFor('FR', d, all).map((c) => c.id)).toEqual(['everywhere'])
  })

  it('shows a paid card only between its from and until days', () => {
    const all = [card('paid', ['SG'], { kind: 'sponsor', from: '2026-12-01', until: '2026-12-31' })]
    expect(cardsFor('SG', new Date(2026, 10, 30, 23), all)).toEqual([])
    expect(cardsFor('SG', new Date(2026, 11, 1, 0, 5), all)).toHaveLength(1)
    expect(cardsFor('SG', new Date(2026, 11, 31, 23), all)).toHaveLength(1)
    expect(cardsFor('SG', new Date(2027, 0, 1, 0, 5), all)).toEqual([])
    expect(cardOfTheDay('SG', new Date(2027, 0, 2), all)).toBeNull()
  })

  it('lists only our own cards in Settings', () => {
    expect(ourCards('SG', new Date()).every((c) => c.kind === 'ours')).toBe(true)
  })

  it('counts days by the phone\'s own calendar', () => {
    expect(dayNumber(new Date(1970, 0, 2, 0, 0))).toBe(1)
    expect(dayNumber(new Date(2026, 10, 17, 23, 59)) + 1).toBe(dayNumber(new Date(2026, 10, 18, 0, 0)))
  })

  it('tags the link with where it was tapped, the same as the phone apps', () => {
    expect(cardURL(COMMUNITY_CARDS[0], 'prayer')).toBe('https://badal.sg/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=prayer')
    expect(cardURL(card('x', ['*'], { url: 'https://x.com/shop?id=1' }), 'settings')).toBe('https://x.com/shop?id=1&utm_source=prayertimesasia&utm_medium=app&utm_campaign=settings')
  })
})

describe('Barakah Picks counts (docs/community-cards.md)', async () => {
  const { cardPayload, shouldCountSeen } = await import('../src/services/usage')
  it('counts a card as seen once a day per device', () => {
    expect(shouldCountSeen(null, 'badal', '2026-11-17')).toBe(true)
    expect(shouldCountSeen({ badal: '2026-11-17' }, 'badal', '2026-11-17')).toBe(false)
    expect(shouldCountSeen({ badal: '2026-11-17' }, 'digital', '2026-11-17')).toBe(true)
    expect(shouldCountSeen({ badal: '2026-11-16' }, 'badal', '2026-11-17')).toBe(true)
  })
  it('sends the card and the usual anonymous keys, never coordinates', () => {
    const p = cardPayload('1.0.0', { city: 'Pasir Ris', countryCode: 'sg' }, 'en-SG', { id: 'badal', kind: 'ours', placement: 'prayer' })
    expect(p['Card.id']).toBe('badal')
    expect(p['Card.kind']).toBe('ours')
    expect(p['Card.placement']).toBe('prayer')
    expect(p['Place.country']).toBe('SG')
    expect(Object.keys(p).some((k) => /latitude|longitude|coord|\.(lat|lng)$/i.test(k))).toBe(false)
  })
})
