import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { appLangFromLocales, appWord } from '../src/core/appWords'

// Every word on the web app's screens comes from the shared word list
// (data/app-words), so the app can show it in English, Malay or Indonesian.
// This finds English still typed straight into a screen.

const UI = join(__dirname, '../src/ui')

/** Names and sacred text that stay as they are in every language. */
const KEEP = new Set([
  'Prayer Times Asia', 'Prayer Times', 'Asia', 'prayertimes.asia', 'MUIS', 'JAKIM', 'Al Quran', 'Current location', 'Card.tapped', 'Language',
  '“O Allah, bless my ummah in their early mornings.”', 'The Prophet ﷺ, narrated by Abu Dawud and Tirmidhi', 'cm',
])

/**
 * Screens not moved to the word list yet, with how many English lines each
 * still has. These numbers may only go down: move a screen over, then lower or
 * remove its line here.
 */
const NOT_YET: Record<string, number> = {}

const NON_TEXT_ATTRS = new Set(['style', 'class', 'transform', 'd', 'href', 'patternTransform', 'points', 'viewBox', 'key', 'target', 'rel', 'id',
  'type', 'role', 'src', 'name', 'kind', 'value', 'inputMode', 'autoComplete', 'lang', 'dir', 'for', 'method', 'loading', 'fill', 'stroke', 'download', 'accept'])
const WORD_CALLS = /^(tr|trWith|appWord|ramadanWord|guideWord|t|w)$/
const hasWords = (s: string) => /[A-Za-z]{2,}/.test(s.replace(/&[a-z]+;/g, ''))
const notText = (s: string) => /^[a-z]+(-[a-z]+)+$|^[\d.]+(px|em|rem|%|deg|s|ms)?$|var\(|color-mix|currentColor|^[a-z][a-zA-Z0-9]*$|^(https?:|\.\.?\/|#|mailto:|webcal:|prayertimesasia:)/.test(s)

function inNonTextAttr(n: ts.Node): boolean {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return NON_TEXT_ATTRS.has(p.name.getText())
    if (ts.isFunctionLike(p)) return false
  }
  return false
}

/** English text typed straight into a screen file: JSX text, and strings or templates used in JSX. */
export function englishLeft(file: string): string[] {
  const src = ts.createSourceFile(file, readFileSync(join(UI, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const walk = (n: ts.Node, inJsx: boolean) => {
    if (ts.isJsxText(n) && hasWords(n.getText()) && !KEEP.has(n.getText().trim())) out.push(n.getText().trim())
    if (inJsx && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && hasWords(n.text) && !KEEP.has(n.text) && !notText(n.text) &&
      !(ts.isCallExpression(n.parent) && WORD_CALLS.test(n.parent.expression.getText())) && !inNonTextAttr(n)) out.push(n.text)
    if (inJsx && ts.isTemplateExpression(n) && !inNonTextAttr(n) && !(ts.isCallExpression(n.parent) && WORD_CALLS.test(n.parent.expression.getText())) && !/^(rotate|translate|scale|url|rgba?)\(/.test(n.head.text) &&
      hasWords(n.head.text + n.templateSpans.map((s) => s.literal.text).join(' '))) out.push(n.getText())
    const jsx = inJsx || ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n) || ts.isJsxExpression(n) || ts.isJsxAttribute(n)
    ts.forEachChild(n, (c) => walk(c, jsx))
  }
  walk(src, false)
  return out
}

describe('web app screens use the shared word list', () => {
  const files = readdirSync(UI).filter((f) => f.endsWith('.tsx'))

  it('no English is typed straight into a screen', () => {
    for (const f of files) {
      const left = englishLeft(f)
      const allowed = NOT_YET[f] ?? 0
      expect(left.length, `${f} has English not in data/app-words:\n${left.join('\n')}`).toBeLessThanOrEqual(allowed)
    }
  })

  it('the list of screens still to move is up to date', () => {
    for (const [f, n] of Object.entries(NOT_YET)) {
      expect(files, f).toContain(f)
      expect(englishLeft(f).length, `${f} has fewer English lines now, lower its number in NOT_YET`).toBe(n)
    }
  })
})

describe('app language', () => {
  it('comes from the browser languages, Malay or Indonesian first if listed before English, else English', () => {
    expect(appLangFromLocales(['ms-MY', 'en-GB'])).toBe('ms')
    expect(appLangFromLocales(['id-ID'])).toBe('id')
    expect(appLangFromLocales(['in'])).toBe('id')
    expect(appLangFromLocales(['en-SG', 'ms'])).toBe('en')
    expect(appLangFromLocales(['ar', 'ms-SG'])).toBe('ms')
    expect(appLangFromLocales(['fr-FR', 'de'])).toBe('en')
    expect(appLangFromLocales([])).toBe('en')
  })

  it('fills in holes and uses the single form for one', () => {
    expect(appWord('en', 'tracker.excusedDays', { n: 1 })).toBe('1 excused day')
    expect(appWord('en', 'tracker.excusedDays', { n: 3 })).toBe('3 excused days')
    expect(appWord('ms', 'tab.settings')).toBe('Tetapan')
    expect(appWord('id', 'today.leftToPray', { time: '19m' })).toContain('19m')
  })
})
