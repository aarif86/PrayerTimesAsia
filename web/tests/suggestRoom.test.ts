import { describe, expect, it } from 'vitest'
import { roomEmail } from '../src/ui/SuggestRoom'

describe('Suggest a prayer room email', () => {
  it('lists only what was filled in, with a map link for the pin', () => {
    const m = roomEmail({ name: ' Pasir Ris Mall ', level: '3', address: '', directions: 'Next to the toilets', remarks: '',
      has: ['ablution', 'women'], pin: { latitude: 1.3734561, longitude: 103.9499123 }, near: { latitude: 1.37, longitude: 103.95 } }, 'Version 1')
    expect(m.subject).toBe('Suggest a prayer room: Pasir Ris Mall | Prayer Times Asia')
    expect(m.body).toContain('Place: Pasir Ris Mall\nLevel: 3\nHow to find it: Next to the toilets\n')
    expect(m.body).toContain("Has: Women's space, Place for wudhu")
    expect(m.body).toContain('mlat=1.37346&mlon=103.94991')
    expect(m.body).not.toContain('Address')
    expect(m.body).not.toContain('Near:')
  })
  it('falls back to the area shown when there is no pin', () => {
    const m = roomEmail({ name: 'X', level: '', address: '1 Road', directions: '', remarks: '', has: [], pin: null, near: { latitude: 1.3, longitude: 103.8 } }, 'Version 1')
    expect(m.body).toContain('Near: 1.30000, 103.80000')
  })
})
