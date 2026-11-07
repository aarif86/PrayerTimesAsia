import { describe, expect, it } from 'vitest'
import { decodePreferences } from '../src/services/prefs'
import { daysFrom } from '../src/services/store'
import { applyMoved, movedFrom } from '../src/services/move'

describe('Prayer tracker pause', () => {
  it('lists every day of a pause, across a month end', () => {
    expect(daysFrom('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(daysFrom('2026-11-05', '2026-11-05')).toEqual(['2026-11-05'])
    expect(daysFrom('2026-11-06', '2026-11-05')).toEqual([])
  })

  it('keeps a valid pause date and drops a broken one', () => {
    expect(decodePreferences({ trackerPausedSince: '2026-11-03' }).trackerPausedSince).toBe('2026-11-03')
    expect(decodePreferences({ trackerPausedSince: 'yesterday' }).trackerPausedSince).toBeNull()
    expect(decodePreferences({}).trackerPausedSince).toBeNull()
  })

  it('moves to another phone with the rest of the tracker', () => {
    const p = decodePreferences({ trackerEnabled: true, trackerPausedSince: '2026-11-03' })
    const m = movedFrom(p)
    expect(m.trackerPausedSince).toBe('2026-11-03')
    expect(applyMoved(decodePreferences({}), m).trackerPausedSince).toBe('2026-11-03')
    expect(movedFrom(decodePreferences({})).trackerPausedSince).toBeUndefined()
  })
})
