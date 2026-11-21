import { useState } from 'preact/hooks'
import { Copy, Heart, Lightbulb, Clock, Wrench, Mail, Star, ChevronRight, MapPin } from 'lucide-preact'
import { NATIVE_APPS, phonePlatform } from '../core/nativeApps'
import { store, useStore } from '../services/store'
import { closeSheet, openSheet, Sheet, ToggleItem } from './common'
import { VERSION } from './version'
import { tr, trWith, type AppWordKey } from '../core/appWords'

/**
 * "A note to the makers": a short note to Ustaz Aarif and the Nasar Digital team.
 * No sign in and no server. The note is written here, then sent from the person's
 * own email app to salam@prayertimes.asia, where the feedback helper reads it.
 */
export const FEEDBACK_EMAIL = 'salam@prayertimes.asia'

export type NoteKind = 'kind' | 'idea' | 'time' | 'broke'

const KINDS: { id: NoteKind; label: AppWordKey; subject: string; icon: typeof Heart; hint: AppWordKey }[] = [
  { id: 'kind', label: 'feedback.kind', subject: 'A kind word', icon: Heart, hint: 'feedback.kindHint' },
  { id: 'idea', label: 'feedback.idea', subject: 'An idea', icon: Lightbulb, hint: 'feedback.ideaHint' },
  { id: 'time', label: 'feedback.time', subject: 'A time looks wrong', icon: Clock, hint: 'feedback.timeHint' },
  { id: 'broke', label: 'feedback.broke', subject: 'Something is not working', icon: Wrench, hint: 'feedback.brokeHint' },
]

function platform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'Web on iPhone or iPad'
  if (/Android/.test(ua)) return 'Web on Android'
  return 'Web on computer'
}

/** The email the note becomes. Exported for tests. */
export function noteEmail(kind: NoteKind, text: string, details: string | null, mayShare: boolean): { subject: string; body: string } {
  const k = KINDS.find((x) => x.id === kind) ?? KINDS[0]
  const lines = [text.trim() || '(no words)', '']
  if (kind === 'kind') lines.push(mayShare ? 'You may share these words on the website, without my name.' : 'Please keep these words private.')
  if (details) lines.push('', details)
  return { subject: `${k.subject} | Prayer Times Asia`, body: lines.join('\n').trim() + '\n' }
}

export function FeedbackSheet() {
  const s = useStore()
  const [kind, setKind] = useState<NoteKind>('kind')
  const [text, setText] = useState('')
  const [addDetails, setAddDetails] = useState(true)
  const [mayShare, setMayShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const place = s.activePlace
  const details = addDetails
    ? `Version ${VERSION}, ${platform()}${place ? `, ${place.name}${place.countryCode ? ` (${place.countryCode})` : ''}` : ''}, ${s.sourceShortIn('en')}`
    : null
  const mail = noteEmail(kind, text, details, mayShare)
  const href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`
  const hint = tr(KINDS.find((x) => x.id === kind)!.hint)

  const copy = async () => {
    try { await navigator.clipboard.writeText(`To ${FEEDBACK_EMAIL}\n${mail.subject}\n\n${mail.body}`); setCopied(true) } catch { /* the address is shown below anyway */ }
  }

  return (
    <Sheet title={tr('feedback.title')}>
      <div class="help feedback">
        <p class="subhead">{tr('feedback.intro')}</p>
        <div class="feedback-kinds" role="radiogroup" aria-label={tr('feedback.about')}>
          {KINDS.map((k) => (
            <button class={`chip${kind === k.id ? ' on' : ''}`} role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}>
              <k.icon size={15} />{tr(k.label)}
            </button>
          ))}
        </div>
        <textarea class="feedback-text" rows={5} placeholder={hint} value={text} aria-label={tr('feedback.yourNote')}
          onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setCopied(false) }} />
        <div class="group">
          <ToggleItem label={tr('feedback.addDetails')} sub={tr('feedback.addDetailsSub')} on={addDetails} onChange={setAddDetails} />
          {kind === 'kind' && <ToggleItem label={tr('feedback.mayShare')} sub={tr('feedback.mayShareSub')} on={mayShare} onChange={setMayShare} />}
        </div>
        <a class="primary-btn" href={href} onClick={() => { store.update((x) => { x.feedbackSentAt = Date.now() }); setTimeout(closeSheet, 400) }}><Mail size={16} /> {tr('feedback.send')}</a>
        <button class="plain-btn" onClick={() => void copy()}><Copy size={16} />{copied ? tr('common.copied') : tr('feedback.copy')}</button>
        <p class="footnote secondary">{tr('feedback.goesTo', { email: FEEDBACK_EMAIL })}</p>
      </div>
    </Sheet>
  )
}

/** Nasar Digital's Google review page (Google Business Profile). */
export const NASAR_GOOGLE_REVIEW = 'https://g.page/r/CSq5hZxhRs1BEBM/review'

export interface ReviewLink { id: 'appstore' | 'play' | 'google'; title: string; sub: string; href: string }

/**
 * Where someone can leave a public review. A store shows only once the app is live
 * there (NATIVE_APPS); on a phone only that phone's store shows. Exported for tests.
 */
export function reviewLinks(platform: 'ios' | 'android' | null, apps = NATIVE_APPS, showAllStores = false): ReviewLink[] {
  const out: ReviewLink[] = []
  const appStore = apps.ios.appStoreId || (showAllStores ? '0000000000' : '')
  const play = apps.android.onGooglePlay || showAllStores
  if (appStore && platform !== 'android') out.push({ id: 'appstore', title: tr('review.appStore'), sub: tr('review.appStoreSub'), href: `https://apps.apple.com/app/id${appStore}?action=write-review` })
  if (play && platform !== 'ios') out.push({ id: 'play', title: tr('review.play'), sub: tr('review.playSub'), href: `https://play.google.com/store/apps/details?id=${apps.packageName}&showAllReviews=true` })
  out.push({ id: 'google', title: tr('review.google'), sub: tr('review.googleSub'), href: NASAR_GOOGLE_REVIEW })
  return out
}

export function ReviewSheet() {
  const s = useStore()
  const links = reviewLinks(phonePlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), NATIVE_APPS, s.demo != null && new URLSearchParams(location.search).get('stores') === 'on')
  const [words, setWords] = useState(s.prefs.reviewDraft)
  const [copiedFor, setCopiedFor] = useState<string | null>(null)
  // Write once, use everywhere: each review button copies the words first, so they
  // only need a paste on the store page (no store lets an app fill the review in).
  const tapped = (id: string) => {
    store.update((x) => { x.reviewTappedAt = Date.now(); x.reviewDraft = words })
    if (words.trim()) { navigator.clipboard?.writeText(words.trim()).then(() => setCopiedFor(id), () => undefined) }
  }
  return (
    <Sheet title={tr('review.title')}>
      <div class="help feedback">
        <p class="subhead">{tr('review.intro')}</p>
        <ol class="review-steps">
          <li>{trWith('review.step1', { b: <b>{tr('review.step1b')}</b> })}</li>
          <li>{trWith('review.step2', { b: <b>{tr('review.step2b')}</b> })}</li>
          <li>{trWith('review.step3', { b: <b>{tr('review.step3b')}</b>, paste: <b>{tr('review.paste')}</b> })}</li>
        </ol>
        <textarea class="feedback-text review-words" rows={4} aria-label={tr('review.yourReview')}
          placeholder={tr('feedback.kindHint')}
          value={words} onInput={(e) => { setWords((e.target as HTMLTextAreaElement).value); setCopiedFor(null) }}
          onBlur={() => store.update((x) => { x.reviewDraft = words })} />
        <div class="group review-links">
          {links.map((l) => (
            <a class="item" href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => tapped(l.id)}>
              {l.id === 'google' ? <MapPin size={20} class="accent" /> : <Star size={20} class="accent" />}
              <span class="label">{l.title}<span class="sub">{copiedFor === l.id ? tr('review.copiedHow') : l.sub}</span></span>
              <ChevronRight size={16} class="secondary" />
            </a>
          ))}
        </div>
        <button class="plain-btn" onClick={() => openSheet({ kind: 'feedback' })}><Mail size={16} /> {tr('review.private')}</button>
      </div>
    </Sheet>
  )
}
