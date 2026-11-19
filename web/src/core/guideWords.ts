import type { Lang3 } from './ramadanContent'
import { GUIDE_CARD_IDS, GUIDE_WORDS_DATA, type GuideWordKey } from './guideWordsData'

/**
 * The quick guide new users see once, after choosing their location (and again
 * from Settings). The words are in data/guide-words.json (English, Malay baku,
 * Indonesian), written into each app by tools/build_guide_words.py.
 */
export type GuideCardId = (typeof GUIDE_CARD_IDS)[number]
export const GUIDE_CARDS: readonly GuideCardId[] = GUIDE_CARD_IDS

/** Which tab each card lives on, so the little tab bar under the card can light it up. */
export const GUIDE_TAB: Record<GuideCardId, 'today' | 'qibla' | 'falak' | 'masjid' | 'settings'> = {
  prayer: 'today', looks: 'today', alerts: 'today', qibla: 'qibla', masjid: 'masjid', travel: 'today', falak: 'falak', yours: 'settings',
}

export function guideWord(lang: Lang3, key: GuideWordKey, args: Record<string, string | number> = {}): string {
  const line: string = GUIDE_WORDS_DATA[lang][key] ?? GUIDE_WORDS_DATA.en[key]
  return line.replace(/\{([a-z]+)\}/g, (all, name: string) => (name in args ? String(args[name]) : all))
}

/** The guide's first language: the prayer names' language if it is Malay or Indonesian, else the device's. */
export function guideLang(naming: Lang3, locale: string): Lang3 {
  if (naming !== 'en') return naming
  const l = locale.toLowerCase()
  if (l.startsWith('ms')) return 'ms'
  if (l.startsWith('id') || l.startsWith('in')) return 'id'
  return 'en'
}
