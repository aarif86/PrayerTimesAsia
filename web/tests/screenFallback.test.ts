import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/screen/config'
import { fallbackPlace, withPlace } from '../src/screen/place'

describe('Masjid screen with no place chosen', () => {
  it('uses a city from the time zone', () => {
    const p = fallbackPlace('Asia/Singapore')
    expect(p.tz).toBe('Asia/Singapore')
    expect(p.cc).toBe('SG')
  })
  it('always gives a place, even for an odd zone', () => {
    expect(fallbackPlace('Not/AZone').lat).toBeTypeOf('number')
  })
  it('keeps a chosen place and fills an empty one', () => {
    expect(withPlace(DEFAULT_CONFIG).place).not.toBeNull()
    const set = { ...DEFAULT_CONFIG, place: fallbackPlace('Asia/Singapore') }
    expect(withPlace(set)).toBe(set)
  })
})
