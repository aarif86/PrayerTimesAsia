import en from '../../../data/app-words/en.json'
import ms from '../../../data/app-words/ms.json'
import id from '../../../data/app-words/id.json'
import type { Lang3 } from './ramadanContent'

/**
 * Every word on the app's screens, in English, Malay and Indonesian, from the
 * shared list in data/app-words (the same list the iPhone and Android apps use).
 * Lines only the phone apps show start with `phone.` or `widget.`.
 */
export type AppWordKey = Exclude<keyof typeof en, `${string}_one`>
export type AppWordArgs = Record<string, string | number>

const WORDS: Record<Lang3, Record<string, string>> = { en, ms, id }

/** Locale for dates and numbers in each app language. */
export const APP_LOCALE: Record<Lang3, string> = { en: 'en-GB', ms: 'ms-MY', id: 'id-ID' }

/** The line for this key in this language, with its {holes} filled in. `n` of exactly 1 uses the `_one` line when there is one. */
export function appWord(lang: Lang3, key: AppWordKey, args: AppWordArgs = {}): string {
  const words = WORDS[lang]
  const line = (args.n === 1 && words[`${key}_one`]) || words[key] || WORDS.en[key] || key
  return line.replace(/\{([a-z]+)\}/g, (all, name: string) => (name in args ? String(args[name]) : all))
}

/**
 * The app language from the browser's languages, in order: the first one that
 * is Malay, Indonesian or English wins. Anything else gives English.
 * (From the device only, never from where you are.)
 */
export function appLangFromLocales(locales: readonly string[]): Lang3 {
  for (const raw of locales) {
    const l = raw.toLowerCase()
    if (l === 'ms' || l.startsWith('ms-')) return 'ms'
    if (l === 'id' || l.startsWith('id-') || l === 'in' || l.startsWith('in-')) return 'id'
    if (l === 'en' || l.startsWith('en-')) return 'en'
  }
  return 'en'
}

/** Each language in its own words, the same in every app language. */
export const APP_LANGUAGE_LABEL: Record<Lang3, string> = { en: 'English', ms: 'Bahasa Melayu', id: 'Bahasa Indonesia' }

let current: Lang3 = 'en'

/** Set by the store whenever the app language changes. */
export function setAppLang(lang: Lang3): void { current = lang }
export function appLang(): Lang3 { return current }
export function appLocale(): string { return APP_LOCALE[current] }

/** A line in the current app language: `tr('settings.alerts')`, `tr('today.leftToPray', { n: 19 })`. */
export function tr(key: AppWordKey, args?: AppWordArgs): string {
  return appWord(current, key, args)
}

/** Appearance and Prayer screen style names in the current app language. */
export function appearanceLabel(a: 'system' | 'light' | 'dark'): string { return tr(`appearance.${a}`) }
export function styleLabel(s: 'list' | 'centre' | 'dial' | 'sunPath' | 'bands' | 'simple'): string { return tr(`style.${s}`) }

/**
 * A line with pieces that are not text (an icon, bold words) in its {holes}:
 * returns the text and the pieces in order, ready to put on screen.
 */
export function trWith<T>(key: AppWordKey, slots: Record<string, T | string | number>): (T | string)[] {
  const n = typeof slots.n === 'number' ? slots.n : undefined
  const line = appWord(current, key, n === undefined ? {} : { n })
  const out: (T | string)[] = []
  let last = 0
  for (const m of line.matchAll(/\{([a-z]+)\}/g)) {
    if (m.index! > last) out.push(line.slice(last, m.index))
    const v = slots[m[1]]
    out.push(v === undefined ? m[0] : typeof v === 'number' ? String(v) : v)
    last = m.index! + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}
