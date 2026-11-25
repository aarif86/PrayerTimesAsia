import { describe, expect, it } from 'vitest'
import { extraMode, isExtra, nextExtraMode } from '../src/core/extraAlerts'

describe('extra alerts (Dhuha, middle of the night, last third)', () => {
  it('starts off and cycles off, notify, alarm, off', () => {
    const p: { extraAlerts: Record<string, 'off' | 'notify' | 'alarm'> } = { extraAlerts: {} }
    expect(extraMode(p, 'dhuha')).toBe('off')
    expect(nextExtraMode(p, 'dhuha')).toBe('notify')
    p.extraAlerts.dhuha = 'notify'
    expect(nextExtraMode(p, 'dhuha')).toBe('alarm')
    p.extraAlerts.dhuha = 'alarm'
    expect(nextExtraMode(p, 'dhuha')).toBe('off')
  })
  it('ignores junk and leaves Imsak to its own switch', () => {
    expect(extraMode({ extraAlerts: { midnight: 'loud' as never } }, 'midnight')).toBe('off')
    expect(isExtra('imsak')).toBe(false)
    expect(isExtra('lastThird')).toBe(true)
  })
})
