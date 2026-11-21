import { useState } from 'preact/hooks'
import { Check, Copy, LocateFixed, Mail } from 'lucide-preact'
import type { Coordinates } from '../core/engine'
import { tr, type AppWordKey } from '../core/appWords'
import { closeSheet, Sheet } from './common'
import { FEEDBACK_EMAIL } from './Feedback'
import { VERSION } from './version'

/**
 * "Suggest a prayer room": a musollah or prayer room missing from the Masjid tab.
 * Like the note to the makers, no sign in and no server: it becomes an email to
 * salam@prayertimes.asia. We check each one, then add it to OpenStreetMap so
 * every app that uses the map gets it too.
 */

export type RoomHas = 'women' | 'shared' | 'aircon' | 'mats' | 'garments' | 'ablution' | 'slippers'

export const ROOM_HAS: { id: RoomHas; label: AppWordKey; english: string }[] = [
  { id: 'women', label: 'suggestRoom.women', english: "Women's space" },
  { id: 'shared', label: 'suggestRoom.shared', english: 'One space for men and women' },
  { id: 'aircon', label: 'suggestRoom.aircon', english: 'Air conditioned' },
  { id: 'mats', label: 'suggestRoom.mats', english: 'Prayer mats' },
  { id: 'garments', label: 'suggestRoom.garments', english: 'Telekung and sarong' },
  { id: 'ablution', label: 'suggestRoom.ablution', english: 'Place for wudhu' },
  { id: 'slippers', label: 'suggestRoom.slippers', english: 'Slippers' },
]

export interface RoomSuggestion {
  name: string
  level: string
  address: string
  directions: string
  remarks: string
  has: RoomHas[]
  /** Where the person stood when they tapped "I am there now". */
  pin: Coordinates | null
  /** The area the Masjid tab was showing, so we know roughly where to look. */
  near: Coordinates | null
}

/** The email a suggestion becomes. Plain lines so it reads well in any mail app. Exported for tests. */
export function roomEmail(r: RoomSuggestion, details: string): { subject: string; body: string } {
  const at = (c: Coordinates) => `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`
  const lines: (string | false | null)[] = [
    `Place: ${r.name.trim()}`,
    r.level.trim() && `Level: ${r.level.trim()}`,
    r.address.trim() && `Address: ${r.address.trim()}`,
    r.directions.trim() && `How to find it: ${r.directions.trim()}`,
    r.has.length > 0 && `Has: ${ROOM_HAS.filter((h) => r.has.includes(h.id)).map((h) => h.english).join(', ')}`,
    r.remarks.trim() && `Remarks: ${r.remarks.trim()}`,
    r.pin
      ? `Pin (I was there): ${at(r.pin)} https://www.openstreetmap.org/?mlat=${r.pin.latitude.toFixed(5)}&mlon=${r.pin.longitude.toFixed(5)}#map=19/${r.pin.latitude.toFixed(5)}/${r.pin.longitude.toFixed(5)}`
      : r.near && `Near: ${at(r.near)}`,
  ]
  const filled = lines.filter((x): x is string => typeof x === 'string' && x !== '')
  return { subject: `Suggest a prayer room: ${r.name.trim() || 'no name'} | Prayer Times Asia`, body: [...filled, '', details].join('\n').trim() + '\n' }
}

function platform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'Web on iPhone or iPad'
  if (/Android/.test(ua)) return 'Web on Android'
  return 'Web on computer'
}

export function SuggestRoomSheet({ near }: { near?: Coordinates }) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [address, setAddress] = useState('')
  const [directions, setDirections] = useState('')
  const [remarks, setRemarks] = useState('')
  const [has, setHas] = useState<RoomHas[]>([])
  const [pin, setPin] = useState<Coordinates | null>(null)
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [copied, setCopied] = useState(false)

  const mail = roomEmail({ name, level, address, directions, remarks, has, pin, near: near ?? null }, `Version ${VERSION}, ${platform()}`)
  const href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`
  const ready = name.trim().length > 0 && (address.trim().length > 0 || pin != null)

  const pinHere = () => {
    if (!navigator.geolocation) { setLocating('failed'); return }
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (p) => { setPin({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setLocating('idle') },
      () => setLocating('failed'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }
  const toggle = (id: RoomHas) => setHas((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))
  const copy = async () => {
    try { await navigator.clipboard.writeText(`To ${FEEDBACK_EMAIL}\n${mail.subject}\n\n${mail.body}`); setCopied(true) } catch { /* the address is shown below anyway */ }
  }
  const field = (label: string, value: string, set: (v: string) => void, hint?: string, long = false) => (
    <label class="room-field">
      <span>{label}</span>
      {long
        ? <textarea class="feedback-text" rows={3} value={value} placeholder={hint} onInput={(e) => { set((e.target as HTMLTextAreaElement).value); setCopied(false) }} />
        : <input type="text" value={value} placeholder={hint} onInput={(e) => { set((e.target as HTMLInputElement).value); setCopied(false) }} />}
    </label>
  )

  return (
    <Sheet title={tr('suggestRoom.title')}>
      <div class="help feedback suggest-room">
        <p class="subhead">{tr('suggestRoom.intro')}</p>
        {field(tr('suggestRoom.name'), name, setName, tr('suggestRoom.nameHint'))}
        {field(tr('suggestRoom.level'), level, setLevel, tr('suggestRoom.levelHint'))}
        {field(tr('suggestRoom.address'), address, setAddress)}
        {field(tr('suggestRoom.directions'), directions, setDirections, tr('suggestRoom.directionsHint'), true)}

        <p class="room-label">{tr('suggestRoom.pin')}</p>
        <button class={`plain-btn${pin ? ' done' : ''}`} onClick={pinHere} disabled={locating === 'busy'}>
          {pin ? <Check size={16} /> : <LocateFixed size={16} />}
          {pin ? tr('suggestRoom.pinAdded') : locating === 'busy' ? tr('suggestRoom.pinFinding') : tr('suggestRoom.pinHere')}
        </button>
        <p class="footnote secondary room-pin-note">{locating === 'failed' ? tr('suggestRoom.pinFailed') : tr('suggestRoom.pinNote')}</p>

        <p class="room-label">{tr('suggestRoom.has')}</p>
        <div class="feedback-kinds" role="group" aria-label={tr('suggestRoom.has')}>
          {ROOM_HAS.map((h) => (
            <button class={`chip${has.includes(h.id) ? ' on' : ''}`} aria-pressed={has.includes(h.id)} onClick={() => { toggle(h.id); setCopied(false) }}>{tr(h.label)}</button>
          ))}
        </div>
        {field(tr('suggestRoom.remarks'), remarks, setRemarks, tr('suggestRoom.remarksHint'), true)}

        {ready
          ? <a class="primary-btn" href={href} onClick={() => setTimeout(closeSheet, 400)}><Mail size={16} /> {tr('feedback.send')}</a>
          : <button class="primary-btn" disabled><Mail size={16} /> {tr('feedback.send')}</button>}
        {!ready && <p class="footnote secondary">{tr('suggestRoom.needs')}</p>}
        {ready && <button class="plain-btn" onClick={() => void copy()}><Copy size={16} />{copied ? tr('common.copied') : tr('feedback.copy')}</button>}
        <p class="footnote secondary">{tr('suggestRoom.goesTo', { email: FEEDBACK_EMAIL })}</p>
      </div>
    </Sheet>
  )
}
