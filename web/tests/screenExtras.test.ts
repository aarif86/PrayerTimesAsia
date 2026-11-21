import { afterEach, describe, expect, it } from 'vitest'
import { qiblaDays } from '../src/core/falak'
import { zoned, zonedTime } from '../src/core/tz'
import { DEFAULT_CONFIG, decodeConfig, encodeConfig, NO_HIDE, sanitize, type ScreenConfig } from '../src/screen/config'
import { kaabaMomentToday, nextOccasion, occasionName, screenHijri, setScreenAnnouncements, WORDS } from '../src/screen/model'

const TZ = 'Asia/Singapore'
const SG: ScreenConfig = { ...DEFAULT_CONFIG, place: { name: 'Pasir Ris', lat: 1.3721, lng: 103.9474, tz: TZ, cc: 'SG', district: null } }
const LA: ScreenConfig = { ...DEFAULT_CONFIG, place: { name: 'Los Angeles', lat: 34.05, lng: -118.24, tz: 'America/Los_Angeles', cc: 'US', district: null } }
const sg = (y: number, mo: number, d: number, h = 9, mi = 0) => zonedTime(y, mo, d, h, mi, 0, TZ)

afterEach(() => setScreenAnnouncements([]))

describe('occasion countdown', () => {
  it('counts down to 1 Ramadan on the date the authority announced', () => {
    setScreenAnnouncements([{ event: '1_ramadan', hijri_year: 1448, authority: 'MUIS', country: 'SG', date: '2027-02-09', status: 'announced', basis: 'rukyah' }])
    const o = nextOccasion(sg(2027, 1, 30), SG)!
    expect(o.id).toBe('ramadan')
    expect(o.date).toEqual({ year: 2027, month: 2, day: 9 })
    expect(o.days).toBe(10)
    expect(o.announced).toBe(true)
    expect(nextOccasion(sg(2027, 2, 8, 23, 59), SG)!.days).toBe(1)
    expect(nextOccasion(sg(2027, 2, 9, 0, 1), SG)!.days).toBe(0)
  })

  it('uses the screen\'s own Hijri date when nothing is announced, with the committee\'s adjustment', () => {
    const o = nextOccasion(sg(2026, 8, 1), SG)!
    expect(o.id).toBe('maulid')
    expect(screenHijri(SG, o.date.year, o.date.month, o.date.day)).toMatchObject({ month: 3, day: 12 })
    const plus = nextOccasion(sg(2026, 8, 1), { ...SG, hijriAdj: 1 })!
    expect(plus.id).toBe('maulid')
    expect(plus.days).toBe(o.days - 1)
  })

  it('finds every big date through the year, and shows nothing too far ahead', () => {
    const seen = new Set<string>()
    for (let t = sg(2026, 1, 1); t < sg(2027, 12, 31); t += 5 * 86_400_000) {
      const o = nextOccasion(t, SG)
      if (o) { seen.add(o.id); expect(o.days).toBeLessThanOrEqual(100) }
    }
    expect([...seen].sort()).toEqual(['aidiladha', 'aidilfitri', 'maalHijrah', 'maulid', 'ramadan'])
    expect(nextOccasion(sg(2026, 1, 1), { ...SG, place: null })).toBeNull()
  })

  it('names the dates in the masjid\'s words', () => {
    expect(occasionName('aidiladha', SG)).toBe('Eid al-Adha')
    expect(occasionName('aidiladha', { ...SG, lang: 'ms' })).toBe('Hari Raya Aidiladha')
    expect(occasionName('aidiladha', { ...SG, lang: 'id' })).toBe('Iduladha')
    expect(occasionName('aidiladha', LA)).toBe('Eid al-Adha')
    expect(WORDS.en.occasion('Maal Hijrah', 12)).toBe('Maal Hijrah in 12 days')
    expect(WORDS.ms.occasion('Maal Hijrah', 1)).toBe('Esok Maal Hijrah')
    expect(WORDS.id.occasion('Tahun Baru Islam', 0)).toBe('Hari ini Tahun Baru Islam')
    for (const lang of ['en', 'ms', 'id'] as const) {
      for (const d of [0, 1, 12]) expect(WORDS[lang].occasion('Maulidur Rasul', d)).not.toMatch(/[:–—]|\s-\s/)
      expect(`${WORDS[lang].kaaba} ${WORDS[lang].kaabaAt} ${WORDS[lang].kaabaHint}`).not.toMatch(/[:–—]|\s-\s/)
    }
  })
})

describe('sun over the Kaaba', () => {
  it('shows the moment on the two days in Singapore, late afternoon, and not the day after', () => {
    const days = qiblaDays(2026)
    expect(days).toHaveLength(2)
    for (const t of days) {
      const z = zoned(t, TZ)
      expect([5, 7]).toContain(z.month)
      const got = kaabaMomentToday(sg(z.year, z.month, z.day, 8), SG)
      expect(got).toBe(t)
      const local = zoned(got!, TZ)
      expect(local.hour).toBe(17)
      expect(kaabaMomentToday(sg(z.year, z.month, z.day, 8) + 86_400_000, SG)).toBeNull()
    }
  })

  it('shows nothing where the sun is down at that moment', () => {
    const t = qiblaDays(2026)[0]
    const z = zoned(t, 'America/Los_Angeles')
    expect(kaabaMomentToday(zonedTime(z.year, z.month, z.day, 12, 0, 0, 'America/Los_Angeles'), LA)).toBeNull()
  })
})

describe('screen settings for the new lines', () => {
  it('are shown by default, also for links made before they existed, and can be hidden in the link', () => {
    expect(DEFAULT_CONFIG.hide.occasion).toBe(false)
    expect(DEFAULT_CONFIG.hide.kaaba).toBe(false)
    expect(sanitize({}).hide.occasion).toBe(false)
    expect(sanitize({}).hide.kaaba).toBe(false)
    const off = { ...SG, hide: { ...NO_HIDE, occasion: true, kaaba: true } }
    expect(decodeConfig(encodeConfig(off))!.hide).toMatchObject({ occasion: true, kaaba: true })
  })
})
