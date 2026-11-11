import { describe, expect, it } from 'vitest'
import words from '../../data/ramadan-words.json'
import { RAMADAN_WORDS_DATA } from '../src/core/ramadanWordsData'
import { fastMarkLabel, fastMarkLetter, ramadanWord, type RamadanWordKey } from '../src/core/ramadanWords'

const LANGS = ['en', 'ms', 'id'] as const

describe('Ramadan words in English, Malay and Indonesian', () => {
  it('the app has the lines in data/ramadan-words.json (run tools/build_ramadan_words.py after editing it)', () => {
    for (const lang of LANGS) expect(RAMADAN_WORDS_DATA[lang], lang).toEqual(words[lang])
  })

  it('every line is there in every language, with the same {holes} and no colons or dashes', () => {
    const keys = Object.keys(words.en).filter((k) => !k.endsWith('_one'))
    const holes = (s: string) => [...s.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]).sort()
    for (const lang of LANGS) {
      const w = words[lang] as Record<string, string>
      for (const k of keys) {
        expect(w[k], `${lang}.${k}`).toBeTypeOf('string')
        expect(holes(w[k]), `${lang}.${k}`).toEqual(holes((words.en as Record<string, string>)[k]))
        expect(w[k], `${lang}.${k}`).not.toMatch(/[:–—-]/)
      }
    }
  })

  it('fills in the holes, and uses the single form for one', () => {
    expect(ramadanWord('en', 'beginsInDays', { n: 12 })).toBe('Ramadan in about 12 days')
    expect(ramadanWord('ms', 'beginsInDays', { n: 12 })).toBe('Lebih kurang 12 hari lagi menjelang Ramadan')
    expect(ramadanWord('id', 'oddNight', { n: 27 })).toBe('Malam ini malam 27, salah satu malam ganjil. Carilah Lailatul Qadar.')
    expect(ramadanWord('en', 'fastsToReplace', { n: 1 })).toBe('1 Ramadan fast to replace.')
    expect(ramadanWord('en', 'fastsToReplace', { n: 3 })).toBe('3 Ramadan fasts to replace.')
    expect(ramadanWord('ms', 'fastsToReplace', { n: 1 })).toBe('1 hari puasa Ramadan perlu diganti.')
  })

  it('names every fast mark in every language', () => {
    for (const lang of LANGS) {
      for (const m of ['fasted', 'period', 'sick', 'travel', 'other', 'qadha', 'syawal'] as const) {
        expect(fastMarkLabel(lang, m).length, `${lang} ${m}`).toBeGreaterThan(0)
        fastMarkLetter(lang, m)
      }
    }
    expect(fastMarkLabel('ms', 'period')).toBe('Haid')
    expect(fastMarkLetter('id', 'travel')).toBe('B')
  })

  it('keeps Malay free of slang', () => {
    for (const k of Object.keys(words.ms) as RamadanWordKey[]) expect((words.ms as Record<string, string>)[k]).not.toMatch(/\blah\b/i)
  })
})
