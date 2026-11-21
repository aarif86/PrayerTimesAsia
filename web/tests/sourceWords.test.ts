import { afterEach, describe, expect, it } from 'vitest'
import en from '../../data/app-words/en.json'
import { appWord, gradeExplanation, methodName, methodNote, setAppLang } from '../src/core/appWords'
import { METHODS } from '../src/core/methods'
import { officialSummary } from '../src/core/official'
import { PROFILES, profileMethod, sourceSummary } from '../src/core/regions'

// Where the times come from is shown in the app language too.

afterEach(() => setAppLang('en'))

describe('source lines in every app language', () => {
  it('every country line reads well in English, Malay and Indonesian', () => {
    for (const lang of ['en', 'ms', 'id'] as const) {
      for (const p of PROFILES) {
        for (const [pinned, short] of [[false, false], [true, false], [false, true], [true, true]]) {
          const text = sourceSummary(p, profileMethod(p), pinned, short, lang)
          expect(text, `${lang} ${p.code}`).not.toMatch(/:|\s-\s|–|—|\{|undefined/)
        }
      }
    }
  })

  it('follows the app language when no language is given', () => {
    const sg = PROFILES.find((p) => p.code === 'SG')!
    setAppLang('ms')
    expect(sourceSummary(sg, profileMethod(sg), false)).toBe(sourceSummary(sg, profileMethod(sg), false, false, 'ms'))
    expect(sourceSummary(sg, profileMethod(sg), false, false, 'ms')).not.toBe(sourceSummary(sg, profileMethod(sg), false, false, 'en'))
    expect(officialSummary({ kind: 'london' }, true)).toBe(appWord('ms', 'source.summary.londonShort'))
  })

  it('keeps the English lines word for word', () => {
    const sg = PROFILES.find((p) => p.code === 'SG')!
    expect(sourceSummary(sg, profileMethod(sg), false, true, 'en')).toBe(`Official timetable from ${sg.authority}.`)
    expect(methodName(METHODS.muis)).toBe('MUIS method')
  })

  it('every calculation method has its note in the word list, the same as its English note', () => {
    for (const m of Object.values(METHODS)) {
      expect((en as Record<string, string>)[`method.note.${m.id}`], m.id).toBe(m.note)
      for (const lang of ['ms', 'id'] as const) {
        setAppLang(lang)
        expect(methodNote(m), `${lang} ${m.id}`).not.toBe(m.note)
      }
    }
  })

  it('every grade has its explanation', () => {
    for (const g of ['A', 'B', 'C', 'D', 'F'] as const) {
      for (const lang of ['en', 'ms', 'id'] as const) {
        setAppLang(lang)
        expect(gradeExplanation(g)).not.toBe(`source.explain${g}`)
      }
    }
  })
})
