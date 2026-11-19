import type { FastMark, Lang3 } from './ramadanContent'
import { RAMADAN_WORDS_DATA, type RamadanWordKey } from './ramadanWordsData'

/**
 * Every word on the Ramadan page and the Ramadan card, in English, Malay and
 * Indonesian (data/ramadan-words.json, written into each app by
 * tools/build_ramadan_words.py). The language follows the prayer names, like the
 * doa and the alerts. The doa and niat text itself lives in ramadanContent.ts.
 */
export type { RamadanWordKey }

export const RAMADAN_LOCALE: Record<Lang3, string> = { en: 'en-GB', ms: 'ms-MY', id: 'id-ID' }

type Args = Record<string, string | number>

/** The line for this key in this language, with its {holes} filled in. */
export function ramadanWord(lang: Lang3, key: RamadanWordKey, args: Args = {}): string {
  const words = RAMADAN_WORDS_DATA[lang] as Record<string, string>
  const line = (args.n === 1 && words[`${key}_one`]) || words[key] || (RAMADAN_WORDS_DATA.en as Record<string, string>)[key]
  return line.replace(/\{([a-z]+)\}/g, (all, name: string) => (name in args ? String(args[name]) : all))
}

/** A short way to write lines in one language: `const t = wordsFor(lang); t('imsak')`. */
export function wordsFor(lang: Lang3): (key: RamadanWordKey, args?: Args) => string {
  return (key, args) => ramadanWord(lang, key, args)
}

export function fastMarkLabel(lang: Lang3, mark: FastMark): string {
  return ramadanWord(lang, `mark_${mark}`)
}

/** One letter for a day in the month grid; empty for a kept fast. */
export function fastMarkLetter(lang: Lang3, mark: FastMark): string {
  return ramadanWord(lang, `letter_${mark}`)
}
