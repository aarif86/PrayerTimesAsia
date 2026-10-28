import { describe, expect, it } from 'vitest'
import { masjidQuery, parseMasjidLink } from '../src/core/masjidLink'
import cases from '../../testdata/masjid-links.json'

/** testdata/masjid-links.json is shared with the iPhone and Android tests. */
describe('Masjid links (QR code on the masjid screen)', () => {
  for (const c of cases.valid) {
    it(`reads ${c.expected.name}`, () => {
      expect(parseMasjidLink(c.link)).toEqual(c.expected)
    })
    it(`writes and reads back ${c.expected.name}`, () => {
      const m = parseMasjidLink(c.link)!
      expect(parseMasjidLink(masjidQuery(m))).toEqual(m)
    })
  }
  for (const link of cases.invalid) {
    it(`refuses ${link}`, () => expect(parseMasjidLink(link)).toBeNull())
  }
})
