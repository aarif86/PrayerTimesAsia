import { useEffect, useMemo, useState } from 'preact/hooks'
import { sourceLabel } from '../core/official'
import { NAMING_LABEL, NAMING_STYLES, type NamingStyle } from '../core/prayer'
import { profileFor, timeZoneForPlace } from '../core/regions'
import { deviceTimeZone } from '../core/tz'
import { nearestCity, searchCities } from '../services/cities'
import { ensureTable } from '../services/officialTables'
import {
  encodeConfig, iqamahText, isHHMM, MAX_NOTICE_LENGTH, MAX_NOTICES, OBLIGATORY_PRAYERS, parseIqamah,
  type Obligatory, type ScreenConfig, type ScreenLanguage, type ScreenPlace,
} from './config'
import { Display } from './Display'
import { Frame } from './Frame'
import { name, officialSourceForScreen } from './model'

/**
 * The committee's page: fill in the masjid's details on a phone, watch the
 * preview, and get one link to open on the TV. Nothing is sent anywhere; the
 * settings live in the link.
 */
export function Setup({ initial, now, onOpen }: { initial: ScreenConfig; now: number; onOpen: (c: ScreenConfig) => void }) {
  const [c, setC] = useState<ScreenConfig>(initial)
  const [iqText, setIqText] = useState<Record<Obligatory, string>>(() =>
    Object.fromEntries(OBLIGATORY_PRAYERS.map((p) => [p, iqamahText(initial.iqamah[p])])) as Record<Obligatory, string>)
  const [notices, setNotices] = useState(initial.notices.join('\n'))
  const [query, setQuery] = useState('')
  const [gps, setGps] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [copied, setCopied] = useState(false)
  const [, setTables] = useState(0)

  const set = (change: Partial<ScreenConfig>) => setC((old) => ({ ...old, ...change }))
  const results = useMemo(() => searchCities(query, 8), [query])
  const official = officialSourceForScreen(c)
  const link = `${location.origin}${location.pathname}#c=${encodeConfig(c)}`

  useEffect(() => {
    if (!official || !c.place) return
    const year = new Date(now).getFullYear()
    ensureTable(official, year, c.place.tz).then((changed) => { if (changed) setTables((n) => n + 1) })
  }, [JSON.stringify(official)])

  const choose = (p: ScreenPlace) => { set({ place: p, zone: null }); setQuery('') }

  const locate = () => {
    if (!('geolocation' in navigator)) { setGps('failed'); return }
    setGps('busy')
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = +pos.coords.latitude.toFixed(4), lng = +pos.coords.longitude.toFixed(4)
      const near = nearestCity(lat, lng, 25), wide = nearestCity(lat, lng, 200)
      const cc = wide?.countryCode ?? null
      choose({ name: near?.name ?? 'Masjid', lat, lng, tz: timeZoneForPlace(cc, lng) ?? deviceTimeZone(), cc, district: near?.district ?? null })
      setGps('idle')
    }, () => setGps('failed'), { enableHighAccuracy: true, timeout: 20_000 })
  }

  const setIqamah = (p: Obligatory, text: string) => {
    setIqText((old) => ({ ...old, [p]: text }))
    const rule = parseIqamah(text)
    setC((old) => {
      const iqamah = { ...old.iqamah }
      if (rule) iqamah[p] = rule
      else delete iqamah[p]
      return { ...old, iqamah }
    })
  }

  const setNoticeText = (text: string) => {
    setNotices(text)
    set({ notices: text.split('\n').map((s) => s.trim().slice(0, MAX_NOTICE_LENGTH)).filter(Boolean).slice(0, MAX_NOTICES) })
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch {
      const el = document.getElementById('screen-link') as HTMLTextAreaElement | null
      el?.select()
    }
  }

  return (
    <main class="setup">
      <header class="setup-head">
        <p class="eyebrow">Prayer Times Asia · Masjid screen</p>
        <h1>Set up your masjid's screen</h1>
        <p class="muted">Fill this in on your phone or computer. You get one link: open it once on the TV's browser and the TV remembers it. Prayer times come from the official timetable and work without internet.</p>
      </header>

      <div class="setup-body">
        <form class="setup-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Masjid</legend>
            <label for="s-name">Name shown on the screen</label>
            <input id="s-name" value={c.name} maxLength={80} placeholder="Masjid Al-Falah" onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />

            <label for="s-place">Location</label>
            {c.place && (
              <p class="setup-chosen">
                <b>{c.place.name}</b>{c.place.cc && <>, {profileFor(c.place.cc)?.name ?? c.place.cc}</>} <span class="muted">({c.place.lat.toFixed(3)}, {c.place.lng.toFixed(3)})</span>
              </p>
            )}
            <div class="setup-row">
              <button type="button" onClick={locate} disabled={gps === 'busy'}>{gps === 'busy' ? 'Finding…' : 'Use this phone\'s location'}</button>
              <span class="muted small">Best when you are at the masjid.</span>
            </div>
            {gps === 'failed' && <p class="setup-error">The location could not be read. Search for the town instead.</p>}
            <input id="s-place" value={query} placeholder="Or search: Tampines, Shah Alam, Bandung…" onInput={(e) => setQuery((e.target as HTMLInputElement).value)} autoComplete="off" />
            {results.length > 0 && (
              <ul class="setup-results">
                {results.map((p) => (
                  <li key={p.id}><button type="button" onClick={() => choose({
                    name: p.name, lat: p.coordinates.latitude, lng: p.coordinates.longitude, tz: p.timeZoneID, cc: p.countryCode ?? null, district: p.district ?? null,
                  })}>{p.name}<span class="muted">{[p.region, p.countryName].filter((x) => x && x !== p.name).join(', ')}</span></button></li>
                ))}
              </ul>
            )}
            <p class="muted small">Times from: <b>{official ? sourceLabel(official) : c.place ? 'calculation for this country' : '-'}</b></p>
            {official?.kind === 'jakim' && (
              <>
                <label for="s-zone">JAKIM zone (only if the masjid uses a different one)</label>
                <input id="s-zone" value={c.zone ?? ''} placeholder={official.zone} maxLength={5}
                  onInput={(e) => { const v = (e.target as HTMLInputElement).value.toUpperCase(); set({ zone: /^[A-Z]{3}\d{2}$/.test(v) ? v : null }) }} />
              </>
            )}
          </fieldset>

          <fieldset>
            <legend>Iqamah</legend>
            <p class="muted small">Minutes after the azan (for example 10), or a fixed time (for example 13:15). Leave empty for no iqamah countdown.</p>
            <div class="setup-iq">
              {OBLIGATORY_PRAYERS.map((p) => (
                <div key={p}>
                  <label for={`s-iq-${p}`}>{name(p, c.names, false, false)}</label>
                  <input id={`s-iq-${p}`} inputMode="numeric" value={iqText[p]} placeholder="10"
                    class={iqText[p] && !parseIqamah(iqText[p]) ? 'invalid' : ''}
                    onInput={(e) => setIqamah(p, (e.target as HTMLInputElement).value)} />
                </div>
              ))}
            </div>
            <label for="s-jumuah">Friday khutbah starts (24-hour, for example 13:00)</label>
            <input id="s-jumuah" value={c.jumuah ?? ''} placeholder="13:00" inputMode="numeric"
              onInput={(e) => { const v = (e.target as HTMLInputElement).value.trim(); set({ jumuah: isHHMM(v) ? v.padStart(5, '0') : null }) }} />
            <div class="setup-iq two">
              <div>
                <label for="s-dim">Dim during prayer (minutes)</label>
                <input id="s-dim" type="number" min={0} max={30} value={c.dimMinutes} onInput={(e) => set({ dimMinutes: Math.max(0, Math.min(30, +(e.target as HTMLInputElement).value || 0)) })} />
              </div>
              <div>
                <label for="s-dimj">On Friday</label>
                <input id="s-dimj" type="number" min={0} max={90} value={c.jumuahDimMinutes} onInput={(e) => set({ jumuahDimMinutes: Math.max(0, Math.min(90, +(e.target as HTMLInputElement).value || 0)) })} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Notices</legend>
            <label for="s-notices">One notice per line, up to {MAX_NOTICES}. They change every 12 seconds.</label>
            <textarea id="s-notices" rows={5} value={notices} placeholder={'Kuliah Maghrib every Tuesday with Ustaz Ahmad\nKhairat kematian: contact the office'}
              onInput={(e) => setNoticeText((e.target as HTMLTextAreaElement).value)} />
          </fieldset>

          <fieldset>
            <legend>Language and look</legend>
            <label for="s-names">Prayer names</label>
            <select id="s-names" value={c.names} onChange={(e) => set({ names: (e.target as HTMLSelectElement).value as NamingStyle })}>
              {NAMING_STYLES.map((n) => <option key={n} value={n}>{NAMING_LABEL[n]}</option>)}
            </select>
            <label class="check"><input id="s-arabic" type="checkbox" checked={c.arabic} onChange={(e) => set({ arabic: (e.target as HTMLInputElement).checked })} /> Switch with Arabic names every 8 seconds</label>
            <label for="s-lang">Screen words</label>
            <select id="s-lang" value={c.lang} onChange={(e) => set({ lang: (e.target as HTMLSelectElement).value as ScreenLanguage })}>
              <option value="ms">Bahasa Melayu</option>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
            <label class="check"><input id="s-h24" type="checkbox" checked={c.h24} onChange={(e) => set({ h24: (e.target as HTMLInputElement).checked })} /> 24-hour clock</label>
            <label for="s-hijri">Hijri date adjustment (days)</label>
            <select id="s-hijri" value={String(c.hijriAdj)} onChange={(e) => set({ hijriAdj: +(e.target as HTMLSelectElement).value })}>
              {[-2, -1, 0, 1, 2].map((n) => <option key={n} value={String(n)}>{n > 0 ? `+${n}` : n}</option>)}
            </select>
          </fieldset>
        </form>

        <aside class="setup-side">
          <p class="eyebrow">Preview</p>
          <Frame class="setup-preview"><Display config={c} now={now} /></Frame>
          <div class="setup-link">
            <label for="screen-link">Link for the TV</label>
            <textarea id="screen-link" readOnly rows={3} value={link} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <div class="setup-row">
              <button type="button" class="primary" onClick={copy} disabled={!c.place}>{copied ? 'Copied' : 'Copy link'}</button>
              <button type="button" onClick={() => onOpen(c)} disabled={!c.place}>Show the screen on this device</button>
            </div>
            <p class="muted small">Send the link to yourself (WhatsApp or email), open it on the TV's browser, and press OK for full screen. To change anything later, open this page again from the screen's "Edit screen" button and send the new link.</p>
          </div>
        </aside>
      </div>
    </main>
  )
}
