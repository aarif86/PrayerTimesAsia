import { describe, expect, it } from 'vitest'
import en from '../../data/app-words/en.json'
import ms from '../../data/app-words/ms.json'
import id from '../../data/app-words/id.json'
import ramadan from '../../data/ramadan-words.json'

// The shared word list for every screen (data/app-words). The same rules run in
// tools/check_app_words.py. The apps switch over to it screen by screen.
const WORDS: Record<string, Record<string, string>> = { en, ms, id }
const holes = (s: string) => [...s.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]).sort()

describe('shared app words in English, Malay and Indonesian', () => {
  it('every key is in every language, and no language has extra keys', () => {
    for (const lang of ['ms', 'id']) expect(Object.keys(WORDS[lang]).sort(), lang).toEqual(Object.keys(en).sort())
  })

  it('keys look like screen.name, and every _one has its plural', () => {
    for (const k of Object.keys(en)) {
      expect(k).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+(_one)?$/)
      if (k.endsWith('_one')) expect(en, k).toHaveProperty([k.slice(0, -4)])
    }
  })

  it('every line has the same {holes} as English and no broken braces', () => {
    const base = en as Record<string, string>
    for (const [lang, w] of Object.entries(WORDS)) {
      for (const [k, line] of Object.entries(w)) {
        expect(holes(line), `${lang}.${k}`).toEqual(holes(base[k]))
        expect(line.replace(/\{[a-z]+\}/g, ''), `${lang}.${k}`).not.toMatch(/[{}]/)
      }
    }
  })

  it('plain words, with no colons or dashes, no empty lines and no lah', () => {
    for (const [lang, w] of Object.entries(WORDS)) {
      for (const [k, line] of Object.entries(w)) {
        expect(line.length, `${lang}.${k}`).toBeGreaterThan(0)
        expect(line, `${lang}.${k}`).toBe(line.trim())
        expect(line, `${lang}.${k}`).not.toMatch(/[:–—-]/)
        if (lang === 'ms') expect(line, `ms.${k}`).not.toMatch(/\blah\b/i)
      }
    }
  })

  it('does not repeat the Ramadan words, which stay in data/ramadan-words.json for now', () => {
    expect(Object.keys(en).filter((k) => k.startsWith('ramadan.'))).toEqual([])
    expect(Object.keys(ramadan.en).length).toBeGreaterThan(100)
  })
})
