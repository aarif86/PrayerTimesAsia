import { describe, expect, it } from 'vitest'
import { tarawihSets, tarawihTap, tarawihUndo } from '../src/core/tarawih'
import { decodePreferences } from '../src/services/prefs'
import { applyMoved, movedFrom } from '../src/services/move'

describe('Tarawih counter', () => {
  it('counts two rakaat a tap and stops at the chosen total', () => {
    let n = 0
    for (let i = 0; i < 3; i++) n = tarawihTap(n, 8)
    expect(n).toBe(6)
    expect(tarawihTap(n, 8)).toBe(8)
    expect(tarawihTap(8, 8)).toBe(8)
    expect(tarawihTap(18, 20)).toBe(20)
    expect(tarawihTap(20, 20)).toBe(20)
  })

  it('undo takes back one salam and never goes below nothing', () => {
    expect(tarawihUndo(6)).toBe(4)
    expect(tarawihUndo(0)).toBe(0)
  })

  it('has one dot per salam', () => {
    expect(tarawihSets(8)).toBe(4)
    expect(tarawihSets(20)).toBe(10)
  })

  it('keeps 8 or 20 only, and starts with no choice', () => {
    expect(decodePreferences({}).tarawihRakaat).toBeNull()
    expect(decodePreferences({ tarawihRakaat: 8 }).tarawihRakaat).toBe(8)
    expect(decodePreferences({ tarawihRakaat: 20 }).tarawihRakaat).toBe(20)
    expect(decodePreferences({ tarawihRakaat: 11 }).tarawihRakaat).toBeNull()
    expect(decodePreferences({ tarawihRakaat: '8' }).tarawihRakaat).toBeNull()
  })

  it('the choice travels with Move my settings', () => {
    const p = decodePreferences({ tarawihRakaat: 20 })
    const m = movedFrom(p)
    expect(m.tarawihRakaat).toBe(20)
    expect(applyMoved(decodePreferences({}), m).tarawihRakaat).toBe(20)
    expect(movedFrom(decodePreferences({})).tarawihRakaat).toBeUndefined()
    expect(applyMoved(decodePreferences({ tarawihRakaat: 8 }), { v: m.v }).tarawihRakaat).toBeNull()
  })
})
