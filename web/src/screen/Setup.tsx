import { useEffect, useMemo, useState } from 'preact/hooks'
import { sourceLabel } from '../core/official'
import { NAMING_LABEL, NAMING_STYLES, type NamingStyle } from '../core/prayer'
import { profileFor, timeZoneForLocated } from '../core/regions'
import { deviceTimeZone, zoned } from '../core/tz'
import { nearestCity, searchCities } from '../services/cities'
import { ensureTable } from '../services/officialTables'
import {
  encodeConfig, EXAMPLE_PLACE, iqamahText, isHHMM, MAX_FRIDAY_NOTE, MAX_NOTICE_LENGTH, MAX_NOTICES, OBLIGATORY_PRAYERS, parseIqamah, READY_NOTICES,
  type Obligatory, type ScreenConfig, type ScreenHide, type ScreenLanguage, type ScreenLook, type ScreenPlace,
} from './config'
import { Display } from './Display'
import { Frame } from './Frame'
import { name, officialSourceForScreen } from './model'
import { SEASON_PREVIEW_LABEL, SEASON_PREVIEWS, type SeasonPreview } from '../core/season'
import { useLiveScreenCount } from './live'
import { ModeButton, Sky, useSiteTheme } from './sky'
import './setup.css'

const LOOK_CHOICES: { id: ScreenLook; label: string; hint: string }[] = [
  { id: 'night', label: 'Night', hint: 'Dark and calm, good for a dim prayer hall' },
  { id: 'day', label: 'Day', hint: 'Light, good for a bright hall or the foyer' },
  { id: 'board', label: 'Board', hint: 'The times as a list, easy to read from far' },
  { id: 'bands', label: 'Bands', hint: 'Each prayer in its own colour, like the app' },
  { id: 'dial', label: 'Day Dial', hint: 'The whole day as a ring, like the app' },
  { id: 'sunpath', label: 'Sun Path', hint: 'The sun moving across the day, like the app' },
]

/** What the committee can switch off. Shown as "Show" switches, so on means it is on the TV. */
const SHOW_CHOICES: { key: keyof ScreenHide; label: string; example: string }[] = [
  { key: 'date', label: "Today's date", example: 'The day and the month' },
  { key: 'hijri', label: 'Islamic date', example: 'The Islamic day, month and year' },
  { key: 'clock', label: 'Clock', example: 'The time now, in big numbers' },
  { key: 'times', label: 'Prayer times', example: 'All five prayers and Syuruk' },
  { key: 'countdown', label: 'Time left', example: 'Like in 6h 59m' },
  { key: 'source', label: 'Where the times come from', example: 'Like Official MUIS' },
]

/**
 * The committee's page, in three steps: which masjid, what shows on the TV, and how to open it there.
 * Everything else sits under "More settings", which most masjids never need to open.
 * The settings live in the link; the only thing sent is the anonymous check-in (`report`), if left on.
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
  const [theme, flipTheme] = useSiteTheme()
  const live = useLiveScreenCount()

  const set = (change: Partial<ScreenConfig>) => setC((old) => ({ ...old, ...change }))
  const setHide = (key: keyof ScreenHide, hidden: boolean) => setC((old) => ({ ...old, hide: { ...old.hide, [key]: hidden } }))
  const setRamadan = (change: Partial<ScreenConfig['ramadan']>) => setC((old) => ({ ...old, ramadan: { ...old.ramadan, ...change } }))
  const results = useMemo(() => searchCities(query, 6), [query])
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
    try { await navigator.share({ title: `${c.name || 'Masjid'} prayer screen`, text: 'Open this link on the masjid TV', url: link }); flash('shared') } catch { /* closed */ }
  }
  // Until a location is chosen the preview shows an example, so it is never blank.
  const preview = c.place ? c : { ...c, place: EXAMPLE_PLACE, name: c.name || 'Your masjid' }
  const countryName = c.place?.cc ? profileFor(c.place.cc)?.name ?? c.place.cc : null

  return (
    <div class="sp" data-theme={theme}>
      <Sky />
      <header class="sp-top">
        <a class="sp-brand" href="../../"><img src="../icons/icon-192.png" alt="" width="34" height="34" />Prayer Times Asia</a>
        <ModeButton theme={theme} onClick={flipTheme} />
      </header>

      <main class="sp-main">
        <section class="sp-hero">
          <p class="sp-eyebrow">For Masjids</p>
          <h1>Put prayer times on your masjid TV</h1>
          <p class="sp-lead">Free, with nothing to install and no sign up. Three easy steps on your phone.</p>
          {live != null && (
            <p class="sp-live" aria-live="polite"><i class="sp-dot" aria-hidden="true" /><b>{live.toLocaleString('en')}</b> masjid {live === 1 ? 'screen is' : 'screens are'} on right now</p>
          )}
          <ol class="sp-map" aria-hidden="true">
            <li><b>1</b>Pick your masjid</li>
            <li><b>2</b>Choose what shows</li>
            <li><b>3</b>Open it on the TV</li>
          </ol>
        </section>

        {/* Step 1 */}
        <section class="sp-step" aria-labelledby="sp-s1">
          <h2 id="sp-s1"><span class="sp-num">1</span>Pick your masjid</h2>
          <label class="sp-label" for="s-name">Masjid name</label>
          <input id="s-name" class="sp-input" value={c.name} maxLength={80} placeholder="Masjid Al Falah" onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />

          <p class="sp-label">Where is it?</p>
          {c.place ? (
            <div class="sp-chosen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <div>
                <b>{c.place.name}{countryName && `, ${countryName}`}</b>
                <span>Times from {official ? sourceLabel(official) : 'the usual calculation for this country'}</span>
              </div>
              <button type="button" class="sp-link-btn" onClick={() => set({ place: null })}>Change</button>
            </div>
          ) : (
            <>
              <button type="button" class="sp-btn sp-btn-big" onClick={locate} disabled={gps === 'busy'}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                {gps === 'busy' ? 'Finding you' : 'Use my location'}
              </button>
              <p class="sp-hint">Best when you are standing in the masjid.</p>
              {gps === 'failed' && <p class="sp-error">We could not find your location. Type the town below instead.</p>}
              <input id="s-place" class="sp-input" value={query} placeholder="Or type the town name" aria-label="Type the town"
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)} autoComplete="off" />
              {results.length > 0 && (
                <ul class="sp-results">
                  {results.map((p) => (
                    <li key={p.id}><button type="button" onClick={() => choose({
                      name: p.name, lat: p.coordinates.latitude, lng: p.coordinates.longitude, tz: p.timeZoneID, cc: p.countryCode ?? null, district: p.district ?? null,
                    })}><b>{p.name}</b><span>{[p.region, p.countryName].filter((x) => x && x !== p.name).join(', ')}</span></button></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Step 2 */}
        <section class="sp-step" aria-labelledby="sp-s2">
          <h2 id="sp-s2"><span class="sp-num">2</span>Choose what shows</h2>
          <div class="sp-tv">
            <Frame class="sp-preview"><Display config={preview} now={now} /></Frame>
          </div>
          {!c.place && <p class="sp-hint center">This is an example. Your own times show once you pick your masjid.</p>}

          <p class="sp-label">Look</p>
          <div class="sp-looks" role="radiogroup" aria-label="Look">
            {LOOK_CHOICES.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={c.look === l.id} class={`sp-chip${c.look === l.id ? ' on' : ''}`} onClick={() => set({ look: l.id })}>{l.label}</button>
            ))}
          </div>
          <p class="sp-hint">{LOOK_CHOICES.find((l) => l.id === c.look)?.hint}</p>

          <p class="sp-label">Show on the TV</p>
          <div class="sp-toggles">
            {SHOW_CHOICES.map((s) => (
              <label key={s.key} class={`sp-toggle${c.hide[s.key] ? '' : ' on'}`}>
                <input type="checkbox" checked={!c.hide[s.key]} onChange={(e) => setHide(s.key, !(e.target as HTMLInputElement).checked)} />
                <span class="sp-switch" aria-hidden="true" />
                <span class="sp-tl"><b>{s.label}</b><small>{s.example}</small></span>
              </label>
            ))}
            <label class={`sp-toggle${c.showQr ? ' on' : ''}`}>
              <input type="checkbox" checked={c.showQr} onChange={(e) => set({ showQr: (e.target as HTMLInputElement).checked })} />
              <span class="sp-switch" aria-hidden="true" />
              <span class="sp-tl"><b>QR code</b><small>People scan it to see the iqamah times</small></span>
            </label>
            <div class="sp-toggle locked on">
              <svg class="sp-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              <span class="sp-tl"><b>prayertimes.asia</b><small>Always shown, so others can find it too</small></span>
            </div>
          </div>

          <details class="sp-more">
            <summary>More settings <span>(you can skip this)</span></summary>
            <div class="sp-more-body">
              <h3>Iqamah</h3>
              <p class="sp-hint">After the azan the screen counts down to the iqamah. Type the minutes after the azan, like 10, or a set time, like 13:15. Leave a box empty for no countdown.</p>
              <div class="sp-grid5">
                {OBLIGATORY_PRAYERS.map((p) => (
                  <div key={p}>
                    <label class="sp-small-label" for={`s-iq-${p}`}>{name(p, c.names, false, false)}</label>
                    <input id={`s-iq-${p}`} class={`sp-input${iqText[p] && !parseIqamah(iqText[p]) ? ' invalid' : ''}`} inputMode="decimal" value={iqText[p]} placeholder="10"
                      onInput={(e) => setIqamah(p, (e.target as HTMLInputElement).value)} />
                  </div>
                ))}
              </div>
              <label class="sp-check"><input type="checkbox" checked={c.showIqamah} onChange={(e) => set({ showIqamah: (e.target as HTMLInputElement).checked })} /> Also show the iqamah times under each prayer</label>
              <div class="sp-grid2">
                <div>
                  <label class="sp-small-label" for="s-jumuah">Friday khutbah starts</label>
                  <TimeField id="s-jumuah" value={c.jumuah} placeholder="13:00" onChange={(v) => set({ jumuah: v })} />
                </div>
                <div>
                  <label class="sp-small-label" for="s-dim">Screen goes dark for the prayer (minutes)</label>
                  <input id="s-dim" class="sp-input" type="number" min={0} max={30} value={c.dimMinutes} onInput={(e) => set({ dimMinutes: Math.max(0, Math.min(30, +(e.target as HTMLInputElement).value || 0)) })} />
                </div>
                <div>
                  <label class="sp-small-label" for="s-dimj">On Friday (minutes)</label>
                  <input id="s-dimj" class="sp-input" type="number" min={0} max={90} value={c.jumuahDimMinutes} onInput={(e) => set({ jumuahDimMinutes: Math.max(0, Math.min(90, +(e.target as HTMLInputElement).value || 0)) })} />
                </div>
              </div>

              <h3>Friday</h3>
              <label class="sp-small-label" for="s-friday">A line for Friday, like who gives the khutbah. Shows from Thursday night to Friday afternoon.</label>
              <input id="s-friday" class="sp-input" value={c.fridayNote} maxLength={MAX_FRIDAY_NOTE} placeholder="Khutbah by Ustaz Ahmad, in Malay"
                onInput={(e) => set({ fridayNote: (e.target as HTMLInputElement).value })} />

              <h3>Notices</h3>
              <label class="sp-small-label" for="s-notices">One notice per line, up to {MAX_NOTICES}. They take turns every 12 seconds.</label>
              <textarea id="s-notices" class="sp-input" rows={4} value={notices} placeholder={'Kuliah Maghrib every Tuesday with Ustaz Ahmad\nPlease keep the corridors clear'}
                onInput={(e) => setNoticeText((e.target as HTMLTextAreaElement).value)} />
              <p class="sp-small-label">Add one with a tap</p>
              <div class="sp-ready">
                {READY_NOTICES.map((n) => (
                  <button key={n} type="button" class="sp-chip small" disabled={c.notices.includes(n) || c.notices.length >= MAX_NOTICES}
                    onClick={() => setNoticeText([...c.notices, n].join('\n'))}>+ {n}</button>
                ))}
              </div>

              <h3>Ramadan and Eid</h3>
              <p class="sp-hint">In Ramadan the screen adds Imsak and the Ramadan day by itself, on the days your country announces.</p>
              <div class="sp-grid2">
                <div>
                  <label class="sp-small-label" for="s-ishaex">Extra minutes before Isyak iqamah</label>
                  <input id="s-ishaex" class="sp-input" type="number" min={0} max={60} value={c.ramadan.ishaExtra}
                    onInput={(e) => setRamadan({ ishaExtra: Math.max(0, Math.min(60, +(e.target as HTMLInputElement).value || 0)) })} />
                </div>
                <div>
                  <label class="sp-small-label" for="s-tarawih">Tarawih starts (empty means after Isyak)</label>
                  <TimeField id="s-tarawih" value={c.ramadan.tarawihAt} placeholder="21:15" onChange={(v) => setRamadan({ tarawihAt: v })} />
                </div>
                <div>
                  <label class="sp-small-label" for="s-qiyam">Qiyamullail, last ten nights</label>
                  <TimeField id="s-qiyam" value={c.ramadan.qiyamAt} placeholder="03:30" onChange={(v) => setRamadan({ qiyamAt: v })} />
                </div>
                <div>
                  <label class="sp-small-label" for="s-eid">Eid prayer</label>
                  <TimeField id="s-eid" value={c.ramadan.eidAt} placeholder="08:00" onChange={(v) => setRamadan({ eidAt: v })} />
                </div>
              </div>
              <label class="sp-check"><input type="checkbox" checked={c.ramadan.tarawih} onChange={(e) => setRamadan({ tarawih: (e.target as HTMLInputElement).checked })} /> Show Tarawih in Ramadan</label>
              <label class="sp-small-label" for="s-preview">See how it looks in Ramadan</label>
              <select id="s-preview" class="sp-input" value={c.ramadan.preview} onChange={(e) => setRamadan({ preview: (e.target as HTMLSelectElement).value as SeasonPreview })}>
                {SEASON_PREVIEWS.map((v) => <option key={v} value={v}>{SEASON_PREVIEW_LABEL[v]}</option>)}
              </select>
              {c.ramadan.preview !== 'off' && <p class="sp-error">Set this back to Off before you send the link to the TV.</p>}

              <h3>Words and names</h3>
              <div class="sp-grid2">
                <div>
                  <label class="sp-small-label" for="s-lang">Screen language</label>
                  <select id="s-lang" class="sp-input" value={c.lang} onChange={(e) => set({ lang: (e.target as HTMLSelectElement).value as ScreenLanguage })}>
                    <option value="en">English</option>
                    <option value="ms">Bahasa Melayu</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </div>
                <div>
                  <label class="sp-small-label" for="s-names">Prayer names</label>
                  <select id="s-names" class="sp-input" value={c.names} onChange={(e) => set({ names: (e.target as HTMLSelectElement).value as NamingStyle })}>
                    {NAMING_STYLES.map((n) => <option key={n} value={n}>{NAMING_LABEL[n]}</option>)}
                  </select>
                </div>
                <div>
                  <label class="sp-small-label" for="s-hijri">Islamic date, move by days</label>
                  <select id="s-hijri" class="sp-input" value={String(c.hijriAdj)} onChange={(e) => set({ hijriAdj: +(e.target as HTMLSelectElement).value })}>
                    {[-2, -1, 0, 1, 2].map((n) => <option key={n} value={String(n)}>{n > 0 ? `+${n}` : n}</option>)}
                  </select>
                </div>
              </div>
              <label class="sp-check"><input type="checkbox" checked={c.arabic} onChange={(e) => set({ arabic: (e.target as HTMLInputElement).checked })} /> Switch to Arabic names every 8 seconds</label>
              <label class="sp-check"><input type="checkbox" checked={c.h24} onChange={(e) => set({ h24: (e.target as HTMLInputElement).checked })} /> 24 hour clock</label>
              {official?.kind === 'jakim' && (
                <>
                  <label class="sp-small-label" for="s-zone">JAKIM zone, only if your masjid uses a different one</label>
                  <TextField key={`${c.place?.lat},${c.place?.lng}`} id="s-zone" value={c.zone ?? ''} placeholder={official.zone} maxLength={5}
                    parse={(v) => { const z = v.trim().toUpperCase(); return /^[A-Z]{3}\d{2}$/.test(z) ? z : null }} onChange={(v) => set({ zone: v })} />
                </>
              )}
              <label class="sp-check"><input type="checkbox" checked={c.report} onChange={(e) => set({ report: (e.target as HTMLInputElement).checked })} /> Count this screen as on. Every 15 minutes it sends a random code made on the TV, and a few times a day the masjid's name, city and look, so we can see how many screens are running and help if something goes wrong</label>
              <p class="sp-hint">Have an idea for a new look? <a href="https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/design-a-look.md" target="_blank" rel="noopener">Send us your design</a>. No coding needed.</p>
            </div>
          </details>
        </section>

        {/* Step 3 */}
        <section class="sp-step" aria-labelledby="sp-s3">
          <h2 id="sp-s3"><span class="sp-num">3</span>Open it on the TV</h2>
          {!c.place && <p class="sp-error">Pick your masjid in step 1 first.</p>}
          <div class="sp-actions">
            {canShare && <button type="button" class="sp-btn sp-btn-primary sp-btn-big" onClick={share} disabled={!c.place}>{copied === 'shared' ? 'Sent' : 'Send the link'}</button>}
            <button type="button" class={`sp-btn sp-btn-big${canShare ? '' : ' sp-btn-primary'}`} onClick={copy} disabled={!c.place}>{copied === 'copied' ? 'Copied' : 'Copy the link'}</button>
          </div>
          <ol class="sp-howto">
            <li><span class="sp-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z" /></svg></span>Send the link to yourself, on WhatsApp or email.</li>
            <li><span class="sp-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg></span>Open the link in the web browser on the masjid TV.</li>
            <li><span class="sp-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg></span>Press OK on the remote for full screen. Done.</li>
          </ol>
          <div class="sp-note">
            <p>The TV keeps your settings. After a power cut, open the browser again and your screen comes back.</p>
            <p>Once it has opened with internet, it keeps showing the times even when the internet drops.</p>
          </div>
          <details class="sp-guide">
            <summary>No browser on your TV, or want it to come back on by itself?</summary>
            <ol>
              <li>Get a small Android TV box or a Fire TV stick. They cost about 40 to 60 dollars and plug into the TV.</li>
              <li>Install a free browser app on it that can open one page when it starts. Search the app store on the box for "kiosk browser" or "start up app".</li>
              <li>Set it to open your masjid link when it starts. Now after a power cut the screen comes back by itself.</li>
              <li>Turn on "automatic date and time" on the box, so the clock stays right.</li>
            </ol>
          </details>
          <div class="sp-actions">
            <button type="button" class="sp-btn" onClick={() => onOpen(c)} disabled={!c.place}>Try it full screen here</button>
            <a class="sp-btn" href={`../print/#c=${encodeConfig({ ...c, showIqamah: true })}&sheet=month`} target="_blank" rel="noopener">Print a timetable</a>
          </div>
          <details id="screen-link-box" class="sp-showlink">
            <summary>Show the link</summary>
            <textarea id="screen-link" class="sp-input" readOnly rows={3} value={link} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          </details>
          <p class="sp-hint">To change something later, come back here, make the change and open the new link on the TV.</p>
        </section>
      </main>

      <footer class="sp-foot">
        <p class="sp-ask">Questions or ideas for your masjid screen? <a href="mailto:salam@prayertimes.asia?subject=Masjid%20screen">Email salam@prayertimes.asia</a></p>
        <p>Always follow your local religious authority.</p>
        <p><a href="../../">prayertimes.asia</a></p>
      </footer>
    </div>
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
      class={`sp-input${invalid ? ' invalid' : ''}`} aria-invalid={invalid}
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
