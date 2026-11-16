import { describe, expect, it } from 'vitest'
import { endPauseLinked, fastMarkFor, pauseLinked, setFastLinked, toggleExcusedLinked, type WomensDaysState } from '../src/core/womensDays'

// Ramadan is 10 to 20 March in these tests.
const isRamadan = (k: string) => k >= '2027-03-10' && k <= '2027-03-20'
const fresh = (): WomensDaysState => ({ fastLog: {}, excusedDays: [], trackerPausedSince: null })

describe("Women's days link the fast record and the prayer tracker", () => {
  it('marking today Period pauses the tracker, and changing it back undoes both', () => {
    const s = fresh()
    setFastLinked(s, '2027-03-12', 'period', '2027-03-12', isRamadan)
    expect(s.trackerPausedSince).toBe('2027-03-12')
    expect(s.fastLog['2027-03-12']).toBe('period')
    setFastLinked(s, '2027-03-12', null, '2027-03-12', isRamadan)
    expect(s).toEqual(fresh())
  })

  it('marking an earlier day Period excuses that day only, and unmarking it un-excuses it', () => {
    const s = fresh()
    setFastLinked(s, '2027-03-11', 'period', '2027-03-14', isRamadan)
    expect(s.trackerPausedSince).toBeNull()
    expect(s.excusedDays).toEqual(['2027-03-11'])
    setFastLinked(s, '2027-03-11', 'sick', '2027-03-14', isRamadan)
    expect(s.excusedDays).toEqual([])
    expect(s.fastLog['2027-03-11']).toBe('sick')
  })

  it('a tracker pause reads as Period for Ramadan days, and across midnight', () => {
    const s = fresh()
    pauseLinked(s, '2027-03-12')
    expect(fastMarkFor(s, '2027-03-12', '2027-03-12', isRamadan)).toBe('period')
    // The next morning the pause carries on, so the new day reads as Period too.
    expect(fastMarkFor(s, '2027-03-13', '2027-03-13', isRamadan)).toBe('period')
    // Days ahead and days before the pause are not touched.
    expect(fastMarkFor(s, '2027-03-14', '2027-03-13', isRamadan)).toBeNull()
    expect(fastMarkFor(s, '2027-03-11', '2027-03-13', isRamadan)).toBeNull()
    // A day already marked keeps its own mark.
    s.fastLog['2027-03-12'] = 'fasted'
    expect(fastMarkFor(s, '2027-03-12', '2027-03-13', isRamadan)).toBe('fasted')
  })

  it('outside Ramadan a pause leaves the fast record alone', () => {
    const s = fresh()
    pauseLinked(s, '2027-03-25')
    expect(fastMarkFor(s, '2027-03-25', '2027-03-26', isRamadan)).toBeNull()
    endPauseLinked(s, '2027-03-26', isRamadan)
    expect(s.fastLog).toEqual({})
    expect(s.excusedDays).toEqual(['2027-03-25', '2027-03-26'])
  })

  it('ending a pause keeps its Ramadan days as Period and as excused', () => {
    const s = fresh()
    pauseLinked(s, '2027-03-19')
    s.fastLog['2027-03-20'] = 'fasted' // the user's own mark wins
    endPauseLinked(s, '2027-03-22', isRamadan)
    expect(s.trackerPausedSince).toBeNull()
    expect(s.fastLog).toEqual({ '2027-03-19': 'period', '2027-03-20': 'fasted' })
    expect(s.excusedDays).toEqual(['2027-03-19', '2027-03-20', '2027-03-21', '2027-03-22'])
  })

  it('marking I am fasting during a pause ends the pause the day before', () => {
    const s = fresh()
    pauseLinked(s, '2027-03-12')
    setFastLinked(s, '2027-03-16', 'fasted', '2027-03-16', isRamadan)
    expect(s.trackerPausedSince).toBeNull()
    expect(s.excusedDays).toEqual(['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15'])
    expect(s.fastLog['2027-03-12']).toBe('period')
    expect(s.fastLog['2027-03-15']).toBe('period')
    expect(s.fastLog['2027-03-16']).toBe('fasted')
  })

  it('changing a day in the middle of a pause keeps the pause going after it', () => {
    const s = fresh()
    pauseLinked(s, '2027-03-12')
    setFastLinked(s, '2027-03-13', 'fasted', '2027-03-15', isRamadan)
    expect(s.excusedDays).toEqual(['2027-03-12'])
    expect(s.trackerPausedSince).toBe('2027-03-14')
    expect(fastMarkFor(s, '2027-03-15', '2027-03-15', isRamadan)).toBe('period')
  })

  it('undoing the first day of a pause cancels it', () => {
    const s = fresh()
    pauseLinked(s, '2027-03-12')
    setFastLinked(s, '2027-03-12', null, '2027-03-12', isRamadan)
    expect(s).toEqual(fresh())
  })

  it('marking Period inside a pause does not start another one', () => {
    const s = fresh()
    pauseLinked(s, '2027-03-12')
    setFastLinked(s, '2027-03-13', 'period', '2027-03-13', isRamadan)
    expect(s.trackerPausedSince).toBe('2027-03-12')
    expect(s.excusedDays).toEqual([])
  })

  it('"Just today" in the tracker marks the fast Period, and again undoes both', () => {
    const s = fresh()
    toggleExcusedLinked(s, '2027-03-14', isRamadan)
    expect(s.excusedDays).toEqual(['2027-03-14'])
    expect(s.fastLog['2027-03-14']).toBe('period')
    toggleExcusedLinked(s, '2027-03-14', isRamadan)
    expect(s).toEqual(fresh())
    // A fast already marked another way is left as it is.
    s.fastLog['2027-03-15'] = 'sick'
    toggleExcusedLinked(s, '2027-03-15', isRamadan)
    expect(s.fastLog['2027-03-15']).toBe('sick')
  })

  it('a pause across the end of a month', () => {
    const ramadan = (k: string) => k >= '2027-02-25' && k <= '2027-03-05'
    const s = fresh()
    pauseLinked(s, '2027-02-27')
    endPauseLinked(s, '2027-03-02', ramadan)
    expect(Object.keys(s.fastLog)).toEqual(['2027-02-27', '2027-02-28', '2027-03-01', '2027-03-02'])
  })
})
