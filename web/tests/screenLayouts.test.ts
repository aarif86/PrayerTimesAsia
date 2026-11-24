import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, LAYOUTS, LOOKS, MAX_SLIDES, decodeConfig, encodeConfig, masjidAppLink, safeImageUrl, sanitize, type ScreenConfig } from '../src/screen/config'
import { effectiveLayout, stageItems } from '../src/screen/Layouts'
import { WORDS } from '../src/screen/model'

const SG: ScreenConfig = { ...DEFAULT_CONFIG, place: { name: 'Pasir Ris', lat: 1.3721, lng: 103.9474, tz: 'Asia/Singapore', cc: 'SG', district: null } }
const slide = (n: number) => ({ title: `T${n}`, text: `Words ${n}`, img: '', tone: 'gold' as const })

describe('screen layouts and looks', () => {
  it('has eight layouts and seven looks, and old links open as the full clock', () => {
    expect(LAYOUTS).toHaveLength(8)
    expect(LOOKS).toContain('surau')
    expect(sanitize({ look: 'board' }).layout).toBe('full')
    expect(sanitize({ layout: 'splitN', look: 'surau' })).toMatchObject({ layout: 'splitN', look: 'surau' })
    expect(sanitize({ layout: 'nonsense' }).layout).toBe('full')
  })

  it('keeps layout, look and slides through the link', () => {
    const c = { ...SG, layout: 'mirror' as const, look: 'surau' as const, slides: [slide(1), { title: '', text: '', img: 'https://example.org/p.jpg', tone: 'navy' as const }] }
    expect(decodeConfig(encodeConfig(c))).toMatchObject({ layout: 'mirror', look: 'surau', slides: c.slides })
  })
})

describe('slides', () => {
  it('keeps at most eight, drops empty ones and clips long words', () => {
    const many = Array.from({ length: 12 }, (_, i) => slide(i))
    expect(sanitize({ slides: many }).slides).toHaveLength(MAX_SLIDES)
    expect(sanitize({ slides: [{}, { title: '  ' }, 'x', null, slide(1)] }).slides).toHaveLength(1)
    expect(sanitize({ slides: [{ text: 'x'.repeat(500) }] }).slides[0].text).toHaveLength(140)
    expect(sanitize({ slides: [{ text: 'a', tone: 'pink' }] }).slides[0].tone).toBe('navy')
  })

  it('only shows pictures from https addresses', () => {
    expect(safeImageUrl('https://example.org/poster.png')).toBe('https://example.org/poster.png')
    for (const bad of ['http://example.org/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//example.org/a.png', 'https://user:pw@example.org/a.png', '', 5, null, `https://example.org/${'a'.repeat(400)}`]) {
      expect(safeImageUrl(bad)).toBe('')
    }
    expect(sanitize({ slides: [{ title: 'Hi', img: 'javascript:alert(1)' }] }).slides[0].img).toBe('')
  })

  it('puts notices among the slides only where there is no notice bar', () => {
    const c = { ...SG, slides: [slide(1)], notices: ['Notice A'], showQr: false }
    expect(stageItems(c, 'splitN', null).map((i) => i.kind)).toEqual(['slide'])
    expect(stageItems(c, 'split', null).map((i) => i.kind)).toEqual(['slide', 'notice'])
    expect(stageItems(c, 'big', null).map((i) => i.kind)).toEqual(['notice'])
    expect(stageItems({ ...c, slides: [], notices: [] }, 'splitN', null).map((i) => i.kind)).toEqual(['welcome'])
    expect(stageItems({ ...c, showQr: true }, 'strip', null).map((i) => i.kind)).toEqual(['slide', 'qr'])
  })
})

describe('turning the screen', () => {
  it('swaps wide and portrait layouts to fit the screen', () => {
    expect(effectiveLayout('full', true)).toBe('full')
    expect(effectiveLayout('splitN', true)).toBe('port')
    expect(effectiveLayout('port', false)).toBe('splitN')
    expect(effectiveLayout('portT', false)).toBe('split')
    expect(effectiveLayout('portT', true)).toBe('portT')
    expect(effectiveLayout('big', true)).toBe('big')
    expect(effectiveLayout('mirror', false)).toBe('mirror')
  })
})

describe('the shared address /tv', () => {
  it('points the QR code at the app from /tv/ as well as from /app/screen/', () => {
    const c = { ...SG, name: 'Masjid Ujian' }
    expect(masjidAppLink(c, 'https://prayertimes.asia/tv/#pair=ABC234')!.startsWith('https://prayertimes.asia/app/#masjid?')).toBe(true)
    expect(masjidAppLink(c, 'https://prayertimes.asia/tv')!.startsWith('https://prayertimes.asia/app/#masjid?')).toBe(true)
    expect(masjidAppLink(c, 'https://aarif86.github.io/PrayerTimesAsia/tv/')!.startsWith('https://aarif86.github.io/PrayerTimesAsia/app/#masjid?')).toBe(true)
    expect(masjidAppLink(c, 'https://prayertimes.asia/app/screen/#c=x')!.startsWith('https://prayertimes.asia/app/#masjid?')).toBe(true)
  })

  it('has the maker line in every language', () => {
    expect(WORDS.en.built).toBe('Built in Singapore')
    expect(WORDS.ms.built).toBeTruthy()
    expect(WORDS.id.built).toBeTruthy()
  })
})
