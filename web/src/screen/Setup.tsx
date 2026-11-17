import { useEffect, useMemo, useState } from 'preact/hooks'
import { sourceLabel } from '../core/official'
import { NAMING_LABEL, NAMING_STYLES, type NamingStyle } from '../core/prayer'
import { FALLBACK_PROFILE, profileFor, profileMethod, sourceSummary, timeZoneForLocated } from '../core/regions'
import { deviceTimeZone, zoned } from '../core/tz'
import { nearestCity, searchCities } from '../services/cities'
import { ensureTable } from '../services/officialTables'
import {
  encodeConfig, EXAMPLE_PLACE, iqamahText, isHHMM, MAX_NOTICE_LENGTH, MAX_NOTICES, OBLIGATORY_PRAYERS, parseIqamah,
  type Obligatory, type ScreenConfig, type ScreenLanguage, type ScreenLook, type ScreenPlace,
} from './config'
import { clockStatus, correctionFor, differenceText, onClockChange } from './clockCheck'
import { Display } from './Display'
import { Frame } from './Frame'
import { name, officialSourceForScreen } from './model'
import { SEASON_PREVIEW_LABEL, SEASON_PREVIEWS, type SeasonPreview } from '../core/season'

/**
 * The committee's page: fill in the masjid's details on a phone, watch the
 * preview, and get one link to open on the TV. The settings live in the link;
 * the only thing sent is the anonymous check-in below (`report`), if left on.
 */
export function Setup({ initial, now, onOpen }: { initial: ScreenConfig; now: number; onOpen: (c: ScreenConfig) => void }) {
  const [c, setC] = useState<ScreenConfig>(initial)
  const [iqText, setIqText] = useState<Record<Obligatory, string>>(() =>
    Object.fromEntries(OBLIGATORY_PRAYERS.map((p) => [p, iqamahText(initial.iqamah[p])])) as Record<Obligatory, string>)
  const [notices, setNotices] = useState(initial.notices.join('\n'))
  const [query, setQuery] = useState('')
  const [gps, setGps] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [copied, setCopied] = useState<'copied' | 'shared' | null>(null)
  const [, setTables] = useState(0)
  const [, setClockSeen] = useState(0)
  useEffect(() => onClockChange(() => setClockSeen((n) => n + 1)), [])

  const set = (change: Partial<ScreenConfig>) => setC((old) => ({ ...old, ...change }))
  const setRamadan = (change: Partial<ScreenConfig['ramadan']>) => setC((old) => ({ ...old, ramadan: { ...old.ramadan, ...change } }))
  const results = useMemo(() => searchCities(query, 8), [query])
  const official = officialSourceForScreen(c)
  const link = `${location.origin}${location.pathname}#c=${encodeConfig(c)}`

  useEffect(() => {
    if (!official || !c.place) return
    const year = zoned(now, c.place.tz).year
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
      choose({ name: near?.name ?? 'Masjid', lat, lng, tz: timeZoneForLocated(cc, lat, lng) ?? deviceTimeZone(), cc, district: near?.district ?? null })
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

  const flash = (what: 'copied' | 'shared') => { setCopied(what); setTimeout(() => setCopied(null), 2500) }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); flash('copied') } catch {
      const box = document.getElementById('screen-link-box') as HTMLDetailsElement | null
      if (box) box.open = true
      ;(document.getElementById('screen-link') as HTMLTextAreaElement | null)?.select()
    }
  }
  // Phones: the share sheet, so the link goes straight into WhatsApp or email.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const share = async () => {
    try { await navigator.share({ title: `${c.name || 'Masjid'} prayer screen`, text: 'Open this link on the masjid TV:', url: link }); flash('shared') } catch { /* closed */ }
  }
  // Until a location is chosen the preview shows an example, so it is never blank.
  const preview = c.place ? c : { ...c, place: EXAMPLE_PLACE, name: c.name || 'Your masjid' }

  return (
    <main class="setup">
      <header class="setup-head">
        <p class="eyebrow">Prayer Times Asia · Masjid screen</p>
        <h1>Set up your masjid's screen</h1>
        <p class="muted">Five short steps on your phone or computer, then one link to open on the masjid TV. The TV remembers it, even after a power cut. Prayer times come from the official timetable (MUIS, JAKIM or Kemenag) and keep working without internet.</p>
      </header>

      <div class="setup-body">
        <form class="setup-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend><span class="step">1</span>Your masjid</legend>
            <label for="s-name">Name shown on the screen</label>
            <input id="s-name" value={c.name} maxLength={80} placeholder="Masjid Al-Falah" onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />

            <label for="s-place">Where is the masjid? (this sets the prayer times)</label>
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
            {c.place && <p class="muted small">{(() => { const pr = profileFor(c.place.cc) ?? FALLBACK_PROFILE; return sourceSummary(pr, profileMethod(pr), false) })()}</p>}
            {official?.kind === 'jakim' && (
              <>
                <label for="s-zone">JAKIM zone (only if the masjid uses a different one)</label>
                <TextField key={`${c.place?.lat},${c.place?.lng}`} id="s-zone" value={c.zone ?? ''} placeholder={official.zone} maxLength={5}
                  parse={(v) => { const z = v.trim().toUpperCase(); return /^[A-Z]{3}\d{2}$/.test(z) ? z : null }} onChange={(v) => set({ zone: v })} />
              </>
            )}
          </fieldset>

          <fieldset>
            <legend><span class="step">2</span>Iqamah times</legend>
            <p class="muted small">After the azan the screen counts down to the iqamah. For each prayer, type how many minutes after the azan the iqamah starts (for example 10), or a fixed time (for example 13:15). Leave a box empty to skip the countdown for that prayer.</p>
            <div class="setup-iq">
              {OBLIGATORY_PRAYERS.map((p) => (
                <div key={p}>
                  <label for={`s-iq-${p}`}>{name(p, c.names, false, false)}</label>
                  <input id={`s-iq-${p}`} inputMode="decimal" value={iqText[p]} placeholder="10"
                    class={iqText[p] && !parseIqamah(iqText[p]) ? 'invalid' : ''}
                    onInput={(e) => setIqamah(p, (e.target as HTMLInputElement).value)} />
                </div>
              ))}
            </div>
            <label class="check"><input id="s-showiq" type="checkbox" checked={c.showIqamah} onChange={(e) => set({ showIqamah: (e.target as HTMLInputElement).checked })} /> Also print the iqamah times on the screen (most jemaah only need the prayer times)</label>
            <label class="check"><input id="s-showqr" type="checkbox" checked={c.showQr} onChange={(e) => set({ showQr: (e.target as HTMLInputElement).checked })} /> Show a QR code that jemaah scan to see these iqamah times in the Prayer Times Asia app</label>
            <label for="s-jumuah">Friday khutbah starts (24-hour, for example 13:00)</label>
            <TimeField id="s-jumuah" value={c.jumuah} placeholder="13:00" onChange={(v) => set({ jumuah: v })} />
            <div class="setup-iq two">
              <div>
                <label for="s-dim">Screen dims for the prayer (minutes)</label>
                <input id="s-dim" type="number" min={0} max={30} value={c.dimMinutes} onInput={(e) => set({ dimMinutes: Math.max(0, Math.min(30, +(e.target as HTMLInputElement).value || 0)) })} />
              </div>
              <div>
                <label for="s-dimj">On Friday (minutes)</label>
                <input id="s-dimj" type="number" min={0} max={90} value={c.jumuahDimMinutes} onInput={(e) => set({ jumuahDimMinutes: Math.max(0, Math.min(90, +(e.target as HTMLInputElement).value || 0)) })} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend><span class="step">3</span>Notices <span class="muted small">(optional)</span></legend>
            <label for="s-notices">One notice per line, up to {MAX_NOTICES}. The screen shows them one at a time, changing every 12 seconds.</label>
            <textarea id="s-notices" rows={5} value={notices} placeholder={'Kuliah Maghrib every Tuesday with Ustaz Ahmad\nKhairat kematian: contact the office'}
              onInput={(e) => setNoticeText((e.target as HTMLTextAreaElement).value)} />
          </fieldset>

          <fieldset>
            <legend><span class="step">4</span>Ramadan and Raya <span class="muted small">(optional)</span></legend>
            <p class="muted small">In Ramadan the screen adds Imsak, calls Maghrib Berbuka and shows the Ramadan day. It starts and ends on the days {c.place ? 'your country\'s authority' : 'the authority'} announces.</p>
            <div class="setup-iq two">
              <div>
                <label for="s-ishaex">Extra minutes before Isyak iqamah</label>
                <input id="s-ishaex" type="number" min={0} max={60} value={c.ramadan.ishaExtra}
                  onInput={(e) => setRamadan({ ishaExtra: Math.max(0, Math.min(60, +(e.target as HTMLInputElement).value || 0)) })} />
              </div>
              <div>
                <label for="s-tarawih">Tarawih starts (empty means after Isyak)</label>
                <TimeField id="s-tarawih" value={c.ramadan.tarawihAt} placeholder="21:15" onChange={(v) => setRamadan({ tarawihAt: v })} />
              </div>
              <div>
                <label for="s-qiyam">Qiyamullail, last ten nights</label>
                <TimeField id="s-qiyam" value={c.ramadan.qiyamAt} placeholder="03:30" onChange={(v) => setRamadan({ qiyamAt: v })} />
              </div>
              <div>
                <label for="s-eid">Hari Raya prayer</label>
                <TimeField id="s-eid" value={c.ramadan.eidAt} placeholder="08:00" onChange={(v) => setRamadan({ eidAt: v })} />
              </div>
            </div>
            <label class="check"><input id="s-showtarawih" type="checkbox" checked={c.ramadan.tarawih} onChange={(e) => setRamadan({ tarawih: (e.target as HTMLInputElement).checked })} /> Show Tarawih in Ramadan</label>
            <p class="muted small">The Raya prayer time also goes into the QR code, so jemaah see it in the app on Raya morning.</p>
            <label for="s-preview">Try it before Ramadan</label>
            <select id="s-preview" value={c.ramadan.preview} onChange={(e) => setRamadan({ preview: (e.target as HTMLSelectElement).value as SeasonPreview })}>
              {SEASON_PREVIEWS.map((v) => <option key={v} value={v}>{SEASON_PREVIEW_LABEL[v]}</option>)}
            </select>
            {c.ramadan.preview !== 'off' && <p class="setup-error">Preview is on. Set it back to Off before putting the link on the TV.</p>}
          </fieldset>

          <fieldset>
            <legend><span class="step">5</span>Look and language</legend>
            <label for="s-look">Look</label>
            <select id="s-look" value={c.look} onChange={(e) => set({ look: (e.target as HTMLSelectElement).value as ScreenLook })}>
              <option value="night">Night: dark, calm in a dim hall</option>
              <option value="day">Day: light, for bright halls and foyers</option>
              <option value="board">Board: times as a list, like a departure board</option>
              <option value="bands">Bands: each prayer in its own colour, as in the app</option>
              <option value="dial">Day Dial: the whole day as a ring, as in the app</option>
              <option value="sunpath">Sun Path: the sun's arc over the day, as in the app</option>
            </select>
            <p class="muted small">Have an idea for a new look? <a href="https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md" target="_blank" rel="noopener">Send us your design</a>, no coding needed.</p>
            <label for="s-names">Prayer names</label>
            <select id="s-names" value={c.names} onChange={(e) => set({ names: (e.target as HTMLSelectElement).value as NamingStyle })}>
              {NAMING_STYLES.map((n) => <option key={n} value={n}>{NAMING_LABEL[n]}</option>)}
            </select>
            <label class="check"><input id="s-arabic" type="checkbox" checked={c.arabic} onChange={(e) => set({ arabic: (e.target as HTMLInputElement).checked })} /> Switch with Arabic names every 8 seconds</label>
            <label for="s-lang">Screen words</label>
            <select id="s-lang" value={c.lang} onChange={(e) => set({ lang: (e.target as HTMLSelectElement).value as ScreenLanguage })}>
              <option value="en">English</option>
              <option value="ms">Bahasa Melayu</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
            <label class="check"><input id="s-h24" type="checkbox" checked={c.h24} onChange={(e) => set({ h24: (e.target as HTMLInputElement).checked })} /> 24-hour clock</label>
            <label for="s-hijri">Hijri date adjustment (days)</label>
            <select id="s-hijri" value={String(c.hijriAdj)} onChange={(e) => set({ hijriAdj: +(e.target as HTMLSelectElement).value })}>
              {[-2, -1, 0, 1, 2].map((n) => <option key={n} value={String(n)}>{n > 0 ? `+${n}` : n}</option>)}
            </select>
            <label class="check"><input id="s-occasion" type="checkbox" checked={c.occasion} onChange={(e) => set({ occasion: (e.target as HTMLInputElement).checked })} /> Count down to the next big date (1 Ramadan, Hari Raya Aidilfitri, Hari Raya Aidiladha, Maal Hijrah and Maulidur Rasul), from 100 days before. Dates your country's authority has announced come first.</label>
            <label class="check"><input id="s-kaaba" type="checkbox" checked={c.kaabaDays} onChange={(e) => set({ kaabaDays: (e.target as HTMLInputElement).checked })} /> On the two days a year the sun stands over the Kaaba (about 27 or 28 May and 15 or 16 July), show the exact time, so jemaah can check the qibla by the sun</label>
            <label class="check"><input id="s-report" type="checkbox" checked={c.report} onChange={(e) => set({ report: (e.target as HTMLInputElement).checked })} /> Let Prayer Times Asia know this screen is running (the masjid's name, city and look, a few times a day, so we can help if something goes wrong)</label>
          </fieldset>
        </form>

        <aside class="setup-side">
          <ClockNotice />
          <section class="setup-card">
            <p class="eyebrow">Preview</p>
            <Frame class="setup-preview"><Display config={preview} now={now} /></Frame>
            {!c.place && <p class="muted small">This is an example. Choose your masjid's location in step 1 to see its own times.</p>}
          </section>

          <section class="setup-card setup-link">
            <h2><span class="step">6</span>Put it on the TV</h2>
            {!c.place && <p class="setup-error">Choose the masjid's location in step 1 first.</p>}
            <div class="setup-row">
              {canShare && <button type="button" class="primary" onClick={share} disabled={!c.place}>{copied === 'shared' ? 'Sent' : 'Share link'}</button>}
              <button type="button" class={canShare ? '' : 'primary'} onClick={copy} disabled={!c.place}>{copied === 'copied' ? 'Copied' : 'Copy link'}</button>
            </div>
            <ol class="setup-steps">
              <li>Send the link to yourself, for example on WhatsApp or by email.</li>
              <li>On the masjid TV, open the web browser and open the link. (On a smart TV without a browser, a small Android TV box or Fire TV stick works.)</li>
              <li>Press <b>OK</b> on the remote, or click once, for full screen. That's it: the TV keeps the screen and its settings.</li>
            </ol>
            <p class="muted small">To change something later, come back to this page, make the change and send the new link to the TV again.</p>
            <p class="muted small">For the notice board: <a href={`../print/#c=${encodeConfig({ ...c, showIqamah: true })}&sheet=month`} target="_blank" rel="noopener">print this month's timetable</a> or the Ramadan timetable, with the same times and iqamah.</p>
            <button type="button" onClick={() => onOpen(c)} disabled={!c.place}>Try the full screen on this device</button>
            <details id="screen-link-box">
              <summary class="muted small">Show the link</summary>
              <textarea id="screen-link" readOnly rows={4} value={link} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            </details>
          </section>
        </aside>
      </div>
    </main>
  )
}

/** The TV clock check's result, shown only here and never on the screen itself. */
function ClockNotice() {
  const s = clockStatus()
  if (!s) return null
  const fixing = correctionFor(s, Date.now()) !== 0
  const when = new Date(s.checkedAt + (fixing ? s.offset : 0))
  const at = when.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })
  return (
    <section class="setup-card setup-clock" role="status">
      <p class="eyebrow">This device's clock</p>
      {fixing
        ? <p>This device's clock is <b>{differenceText(s.offset)} {s.offset > 0 ? 'slow' : 'fast'}</b> compared with internet time. The screen corrects the times it shows by itself, so nothing needs to be done. Setting the right time on the TV or TV box is still a good idea.</p>
        : <p>This device's clock matches internet time.</p>}
      <p class="muted small">Last checked {at}. The screen checks again every six hours when online.</p>
    </section>
  )
}

/**
 * A text box that keeps what the person is typing, and passes up only a valid value (or null).
 * A controlled input bound to the parsed value would wipe each half-typed "1" or "13:" on the next render.
 */
function TextField({ id, value, placeholder, maxLength, inputMode, parse, onChange }: {
  id: string; value: string; placeholder?: string; maxLength?: number; inputMode?: 'numeric' | 'decimal' | 'text'
  parse: (text: string) => string | null; onChange: (v: string | null) => void
}) {
  const [text, setText] = useState(value)
  const invalid = text.trim() !== '' && parse(text) == null
  return (
    <input id={id} value={text} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoComplete="off"
      class={invalid ? 'invalid' : ''} aria-invalid={invalid}
      onInput={(e) => {
        const t = (e.target as HTMLInputElement).value
        setText(t)
        // Half-typed or wrong text keeps the last good value; an empty box clears it.
        const v = parse(t)
        if (v != null || t.trim() === '') onChange(v)
      }} />
  )
}

const parseTime = (text: string): string | null => {
  // iPhone number pads show "." or "," (Indonesian), never ":". "1300" works too.
  let v = text.trim().replace(/[.,]/, ':')
  if (/^\d{3,4}$/.test(v)) v = `${v.slice(0, -2)}:${v.slice(-2)}`
  return isHHMM(v) ? v.padStart(5, '0') : null
}

function TimeField({ id, value, placeholder, onChange }: { id: string; value: string | null; placeholder: string; onChange: (v: string | null) => void }) {
  return <TextField id={id} value={value ?? ''} placeholder={placeholder} maxLength={5} inputMode="decimal" parse={parseTime} onChange={onChange} />
}
