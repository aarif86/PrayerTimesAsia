import { describe, expect, it } from 'vitest'
import { NASAR_GOOGLE_REVIEW, noteLink, noteUrl, reviewLinks } from '../src/ui/Feedback'
import { NATIVE_APPS } from '../src/core/nativeApps'

describe('reviews', () => {
  it('shows a store only once the app is live there, and only that phone\'s store', () => {
    const noApple = { ...NATIVE_APPS, ios: { ...NATIVE_APPS.ios, appStoreId: '' } }
    expect(reviewLinks(null, noApple).map((l) => l.id)).toEqual(['play', 'google'])
    expect(reviewLinks('ios', noApple).map((l) => l.id)).toEqual(['google'])
    expect(reviewLinks(null).map((l) => l.id)).toEqual(['appstore', 'play', 'google'])
    expect(reviewLinks(null, NATIVE_APPS, true).map((l) => l.id)).toEqual(['appstore', 'play', 'google'])
    expect(reviewLinks('ios', NATIVE_APPS, true).map((l) => l.id)).toEqual(['appstore', 'google'])
    expect(reviewLinks('android', NATIVE_APPS, true).map((l) => l.id)).toEqual(['play', 'google'])
    expect(NASAR_GOOGLE_REVIEW).toBe('https://g.page/r/CSq5hZxhRs1BEBM/review')
  })
  it('opens the note page with the form filled in', () => {
    const u = new URL(noteLink('kind', ' Thank you ', 'Version 1', true))
    expect(u.origin + u.pathname).toBe('https://prayertimes.asia/note.html')
    expect(u.searchParams.get('note_is_about')).toBe('A kind word')
    expect(u.searchParams.get('note_to_the_makers')).toBe('Thank you\nYou may share these words on the website, without my name.\n\nVersion 1')
    expect(new URL(noteLink('time', '', null, false)).searchParams.get('note_is_about')).toBe('A prayer time looks wrong')
    expect(new URL(noteLink('idea', '', null, true)).searchParams.get('note_to_the_makers')).toBe('(no words)')
  })
  it('adds the place only when there is one', () => {
    expect(new URL(noteUrl('Suggest a prayer room', 'Place: X', 'X')).searchParams.get('note_masjid_or_place')).toBe('X')
    expect(new URL(noteUrl('An idea', 'Hi')).searchParams.has('note_masjid_or_place')).toBe(false)
  })
})
