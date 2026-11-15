import { describe, expect, it } from 'vitest'
import type { OfficialSource } from '../src/core/official'
import { zoned, zonedTime } from '../src/core/tz'
import { DEFAULT_CONFIG, type ScreenConfig } from '../src/screen/config'
import { phaseAt, WORDS, type Row } from '../src/screen/model'

const TZ = 'Asia/Singapore'
const SG: ScreenConfig = { ...DEFAULT_CONFIG, place: { name: 'Pasir Ris', lat: 1.3721, lng: 103.9474, tz: TZ, cc: 'SG', district: null } }
const row: Row = { fajr: '05:35', sunrise: '06:53', dhuhr: '12:52', asr: '16:10', maghrib: '18:56', isha: '20:07' }
const lookup = (s: OfficialSource): Row => (s.kind === 'muis' ? row : null)

describe('masjid screen words', () => {
  it('has every English word in Malay and Indonesian too', () => {
    for (const lang of ['ms', 'id'] as const) {
      for (const key of Object.keys(WORDS.en) as (keyof typeof WORDS.en)[]) {
        const v = WORDS[lang][key]
        expect(typeof v === 'function' ? (v as (x: never) => string)('5' as never) : v, `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})

describe('masjid screen across midnight', () => {
  it('counts down to the next Subuh before and after midnight', () => {
    const before = phaseAt(zonedTime(2026, 11, 17, 23, 59, 0, TZ), SG, lookup)!
    const after = phaseAt(zonedTime(2026, 11, 18, 0, 1, 0, TZ), SG, lookup)!
    expect(before.kind).toBe('waiting')
    expect(after.kind).toBe('waiting')
    if (before.kind !== 'waiting' || after.kind !== 'waiting') return
    expect(before.next).toBe('fajr')
    expect(after.next).toBe('fajr')
    expect(before.at).toBe(after.at)
    expect(zoned(after.at, TZ).day).toBe(18)
    expect(zoned(after.day.day.times.dhuhr, TZ).day).toBe(18)
  })
})
