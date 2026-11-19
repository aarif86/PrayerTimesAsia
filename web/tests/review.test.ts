import { describe, expect, it } from 'vitest'
import { NASAR_GOOGLE_REVIEW, noteEmail, reviewLinks } from '../src/ui/Feedback'
import { NATIVE_APPS } from '../src/core/nativeApps'

describe('reviews', () => {
  it('shows a store only once the app is live there, and only that phone\'s store', () => {
    expect(reviewLinks(null).map((l) => l.id)).toEqual(['google'])
    expect(reviewLinks(null, NATIVE_APPS, true).map((l) => l.id)).toEqual(['appstore', 'play', 'google'])
    expect(reviewLinks('ios', NATIVE_APPS, true).map((l) => l.id)).toEqual(['appstore', 'google'])
    expect(reviewLinks('android', NATIVE_APPS, true).map((l) => l.id)).toEqual(['play', 'google'])
    expect(NASAR_GOOGLE_REVIEW).toBe('https://g.page/r/CSq5hZxhRs1BEBM/review')
  })
  it('turns a note into the same email as the phone apps', () => {
    expect(noteEmail('kind', ' Thank you ', 'Version 1', true)).toEqual({
      subject: 'A kind word | Prayer Times Asia',
      body: 'Thank you\n\nYou may share these words on the website, without my name.\n\nVersion 1\n',
    })
    expect(noteEmail('idea', '', null, true).body).toBe('(no words)\n')
  })
})
