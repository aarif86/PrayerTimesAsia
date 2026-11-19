import { describe, expect, it } from 'vitest'
import { spokenShort } from '../src/ui/common'

describe('spokenShort', () => {
  it('reads countdowns in whole words for screen readers', () => {
    expect(spokenShort(20_000)).toBe('less than a minute')
    expect(spokenShort(60_000)).toBe('1 minute')
    expect(spokenShort(61_000)).toBe('2 minutes')
    expect(spokenShort(3_600_000)).toBe('1 hour')
    expect(spokenShort(2 * 3_600_000 + 5 * 60_000)).toBe('2 hours 5 minutes')
    expect(spokenShort(-5)).toBe('less than a minute')
  })
})
