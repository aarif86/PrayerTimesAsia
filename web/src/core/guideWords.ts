import type { Lang3 } from './ramadanContent'
import { GUIDE_CARD_IDS, GUIDE_STEPS_DATA, GUIDE_WORDS_DATA, type GuideWordKey } from './guideWordsData'

/**
 * The quick guide new users see once, after choosing their location (and again
 * from Settings). The words are in data/guide-words.json (English, Malay baku,
 * Indonesian), written into each app by tools/build_guide_words.py.
 */
export type GuideCardId = (typeof GUIDE_CARD_IDS)[number]
export const GUIDE_CARDS: readonly GuideCardId[] = GUIDE_CARD_IDS

/** One moment on a card's little phone: an app screen, the box the finger points at
 * (fractions of the screen), the words under it, and whether the finger taps. */
export type GuideStep = (typeof GUIDE_STEPS_DATA)[GuideCardId][number]
export const GUIDE_STEPS: Record<GuideCardId, readonly GuideStep[]> = GUIDE_STEPS_DATA

export function guideWord(lang: Lang3, key: GuideWordKey, args: Record<string, string | number> = {}): string {
  const line: string = GUIDE_WORDS_DATA[lang][key] ?? GUIDE_WORDS_DATA.en[key]
  return line.replace(/\{([a-z]+)\}/g, (all, name: string) => (name in args ? String(args[name]) : all))
}

/** The guide's first language: the device's (Malay or Indonesian only if the device says so). Never the prayer names. */
export function guideLang(locale: string): Lang3 {
  const l = locale.toLowerCase()
  if (l.startsWith('ms')) return 'ms'
  if (l.startsWith('id') || l.startsWith('in')) return 'id'
  return 'en'
}
