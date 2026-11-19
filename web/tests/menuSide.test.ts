import { describe, expect, it } from 'vitest'
import { decodePreferences, DEFAULT_PREFS } from '../src/services/prefs'

describe('menu bar side (web, bigger screens)', () => {
  it('defaults to automatic and keeps a saved side', () => {
    expect(DEFAULT_PREFS.menuSide).toBe('auto')
    expect(decodePreferences({ menuSide: 'right' }).menuSide).toBe('right')
    expect(decodePreferences({ menuSide: 'left' }).menuSide).toBe('left')
  })
  it('ignores anything that is not a known side', () => {
    expect(decodePreferences({ menuSide: 'top' }).menuSide).toBe('auto')
    expect(decodePreferences({}).menuSide).toBe('auto')
  })
})
