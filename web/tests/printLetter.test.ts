import { describe, expect, it } from 'vitest'
import { zonedTime } from '../src/core/tz'
import { DEFAULT_CONFIG, EXAMPLE_PLACE, type ScreenConfig } from '../src/screen/config'
import { LETTER_FOR, LETTER_WORDS, letterSentences } from '../src/print/letter'
import { optionsFromHash, PRINT_WORDS, printHash, todayDay } from '../src/print/model'

const c: ScreenConfig = { ...DEFAULT_CONFIG, place: EXAMPLE_PLACE, names: 'arabic' }
const none = () => null
const TZ = 'Asia/Singapore'

describe('prayer break letter', () => {
  it('has the letter in English, Malay and Indonesian, for work and for school', () => {
    for (const lang of ['en', 'ms', 'id'] as const) {
      expect(PRINT_WORDS[lang].sheetName.letter).toBeTruthy()
      for (const f of LETTER_FOR) {
        const t = LETTER_WORDS[lang].text[f]
        expect(t.before.length).toBeGreaterThanOrEqual(4)
        expect(t.before.join(' ')).toContain('10')
      }
    }
  })

  it('keeps colons and dashes out of the letter body', () => {
    for (const lang of ['en', 'ms', 'id'] as const) {
      for (const f of LETTER_FOR) {
        for (const line of [...letterSentences(LETTER_WORDS[lang].text[f]), LETTER_WORDS[lang].authority]) {
          expect(line, `${lang}/${f}: ${line}`).not.toMatch(/[:–—]|\s-\s|--/)
          expect(line.toLowerCase()).not.toMatch(/\bai\b|artificial/)
        }
      }
    }
  })

  it('fills in today at the place, even late at night', () => {
    const late = zonedTime(2026, 11, 15, 23, 50, 0, TZ)
    const [d] = todayDay(c, late, none)
    expect([d.year, d.month, d.day]).toEqual([2026, 11, 15])
    const early = zonedTime(2026, 11, 16, 0, 5, 0, TZ)
    expect(todayDay(c, early, none)[0].day).toBe(16)
    expect(todayDay({ ...c, place: null }, late, none)).toEqual([])
  })

  it('marks Friday so the letter can say Friday prayer', () => {
    const fri = zonedTime(2026, 11, 20, 9, 0, 0, TZ)
    expect(todayDay(c, fri, none)[0].times.friday).toBe(true)
  })

  it('reads who it is for and the paper size from the link, A4 for work by default', () => {
    const now = zonedTime(2026, 11, 15, 9, 0, 0, TZ)
    expect(optionsFromHash('#sheet=letter', now, TZ)).toMatchObject({ sheet: 'letter', for: 'work', paper: 'a4' })
    expect(optionsFromHash('#sheet=letter&for=school&paper=letter', now, TZ)).toMatchObject({ for: 'school', paper: 'letter' })
    expect(optionsFromHash('#sheet=letter&for=boss&paper=a3', now, TZ)).toMatchObject({ for: 'work', paper: 'a4' })
    // Other sheets' links are unchanged.
    expect(optionsFromHash('#sheet=month&for=school', now, TZ)).toEqual({ sheet: 'month', year: 2026, month: 11 })
  })

  it('keeps the choices in the link', () => {
    const hash = printHash(c, { sheet: 'letter', year: 2026, month: 11, for: 'school', paper: 'letter' }, () => 'x')
    expect(hash).toContain('for=school')
    expect(hash).toContain('paper=letter')
    expect(printHash(c, { sheet: 'letter', year: 2026, month: 11, for: 'work', paper: 'a4' }, () => 'x')).not.toMatch(/for=|paper=/)
  })
})
