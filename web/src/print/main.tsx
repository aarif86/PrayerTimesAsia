import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/nunito/wght.css'
import { render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { Place } from '../core/place'
import { NAMING_LABEL, NAMING_STYLES, type NamingStyle } from '../core/prayer'
import { profileFor, timeZoneForPlace } from '../core/regions'
import { deviceTimeZone, zoned } from '../core/tz'
import { nearestCity, searchCities } from '../services/cities'
import { ensureTable, rowFor } from '../services/officialTables'
import { readJSON } from '../services/storage'
import { configFromHash, DEFAULT_CONFIG, encodeConfig, EXAMPLE_PLACE, sanitize, type ScreenConfig, type ScreenLanguage, type ScreenPlace } from '../screen/config'
import { officialSourceForScreen } from '../screen/model'
import { monthDays, todayDay, optionsFromHash, PRINT_WORDS, printHash, ramadanDays, shortHash, configFromShortHash, SHEETS, type PrintOptions, type SheetKind } from './model'
import { FastingSheet, LetterSheet, MonthSheet, RamadanSheet, StickerSheet, TrackerSheet } from './Sheets'
import { LETTER_FOR, LETTER_WORDS, PAPER_SIZES } from './letter'
import { defaultAuthority, type CalendarDataset } from '../core/calendarSanad'
import { communityHijri } from '../core/season'
import './print.css'

/**
 * Printable prayer calendars: a monthly timetable, a Ramadan timetable, a sticker
 * calendar and a kids' prayer tracker, for any place. Opened from the app (your
 * place), from the masjid screen setup (the masjid's settings in #c=), or on its own.
 * Nothing is sent anywhere; print or "Save as PDF" from the browser.
 */

const query = new URLSearchParams(location.search)
/** Screenshot mode: ?demo&now=2026-11-01 (a fixed clock). */
const fixedNow = (() => { const t = Date.parse(query.get('now') ?? ''); return Number.isNaN(t) ? null : t })()
const now = fixedNow ?? Date.now()

function fromPlace(p: Place, names: NamingStyle | null): ScreenConfig {
  const place: ScreenPlace = { name: p.name, lat: p.coordinates.latitude, lng: p.coordinates.longitude, tz: p.timeZoneID, cc: p.countryCode ?? null, district: p.district ?? null }
  return { ...DEFAULT_CONFIG, place, names: names ?? profileFor(place.cc)?.naming ?? 'arabic', lang: 'en' }
}

/** The masjid's settings from the link, else the app's own place (same browser), else none yet. */
function initialConfig(): ScreenConfig {
  if (query.has('demo')) {
    return sanitize({ ...DEFAULT_CONFIG, place: EXAMPLE_PLACE, names: query.get('names') ?? 'malay', lang: query.get('lang') ?? 'en',
      name: query.get('name') ?? '', showIqamah: query.has('iqamah'), jumuah: query.has('iqamah') ? '13:00' : null })
  }
  const fromLink = configFromHash(location.hash) ?? configFromShortHash(location.hash)
  if (fromLink) return fromLink
  const prefs = readJSON<{ home?: Place | null; manualPlace?: Place | null; namingOverride?: NamingStyle | null; hijriAdjustment?: number }>('ptasia.preferences.v1')
  const p = prefs?.manualPlace ?? prefs?.home
  if (p?.coordinates) return { ...fromPlace(p, prefs?.namingOverride ?? null), hijriAdj: prefs?.hijriAdjustment ?? 0 }
  return { ...DEFAULT_CONFIG }
}

const SHEET_ICON: Record<SheetKind, string> = { month: '▦', ramadan: '☾', stickers: '✂', tracker: '★', fasting: '✦', letter: '✉' }

/** Ramadan as the community counts it: the app's saved announcements and the authority for the place's country. */
function communityHijriFor(c: ScreenConfig) {
  const cal = readJSON<CalendarDataset>('ptasia.calendar')
  const chosen = readJSON<{ communityAuthority?: string | null }>('ptasia.preferences.v1')?.communityAuthority
  const authority = chosen ?? defaultAuthority(c.place?.cc ?? '') ?? null
  const tz = c.place?.tz ?? 'UTC'
  return (ms: number) => {
    const z = zoned(ms, tz)
    return communityHijri({ year: z.year, month: z.month, day: z.day }, c.hijriAdj, cal?.announcements ?? [], authority)
  }
}

function App() {
  const [c, setC] = useState<ScreenConfig>(initialConfig)
  const [o, setO] = useState<PrintOptions>(() => optionsFromHash(location.hash, now, c.place?.tz ?? deviceTimeZone()))
  const [search, setSearch] = useState('')
  const [gps, setGps] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [tables, setTables] = useState(0)
  const set = (change: Partial<ScreenConfig>) => setC((old) => ({ ...old, ...change }))
  const w = PRINT_WORDS[c.lang]
  const results = useMemo(() => searchCities(search, 8), [search])

  const days = useMemo(() => {
    if (!c.place) return []
    if (o.sheet === 'letter') return todayDay(c, now, rowFor)
    return o.sheet === 'ramadan' || o.sheet === 'fasting' ? ramadanDays(c, now, rowFor, communityHijriFor(c)) : monthDays(c, o.year, o.month, rowFor)
  }, [c, o, tables])

  // Ramadan can fall in the next year: fetch every year the sheet touches.
  const official = officialSourceForScreen(c)
  const years = [...new Set(days.map((d) => d.year))].join(',')
  useEffect(() => {
    if (!official || !c.place) return
    for (const y of years.split(',').filter(Boolean).map(Number)) {
      ensureTable(official, y, c.place.tz).then((changed) => { if (changed) setTables((n) => n + 1) })
    }
  }, [JSON.stringify(official), years])

  // Keep the link in the address bar, so it can be bookmarked or shared.
  useEffect(() => {
    if (!c.place || query.has('demo')) return
    history.replaceState(null, '', `${location.pathname}${location.search}${printHash(c, o, encodeConfig)}`)
  }, [c, o])

  const qrLink = c.place ? `${location.origin}${location.pathname}${shortHash(c, o.sheet)}` : ''

  const choose = (p: ScreenPlace) => { set({ place: p, zone: null, names: c.place ? c.names : profileFor(p.cc)?.naming ?? c.names }); setSearch('') }
  const locate = () => {
    if (!('geolocation' in navigator)) { setGps('failed'); return }
    setGps('busy')
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = +pos.coords.latitude.toFixed(4), lng = +pos.coords.longitude.toFixed(4)
      const near = nearestCity(lat, lng, 25), wide = nearestCity(lat, lng, 200)
      const cc = wide?.countryCode ?? null
      choose({ name: near?.name ?? 'My place', lat, lng, tz: timeZoneForPlace(cc, lng) ?? deviceTimeZone(), cc, district: near?.district ?? null })
      setGps('idle')
    }, () => setGps('failed'), { enableHighAccuracy: true, timeout: 20_000 })
  }
  const shiftMonth = (by: number) => setO((x) => {
    const m0 = x.year * 12 + (x.month - 1) + by
    return { ...x, year: Math.floor(m0 / 12), month: (m0 % 12) + 1 }
  })
  const thisMonth = c.place ? zoned(now, c.place.tz) : null

  // Fit the A4 preview to the space beside (or under) the controls.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.preview')
    if (!el) return
    const fit = () => el.style.setProperty('--z', String(Math.min(1, (el.clientWidth - 32) / (210 * 96 / 25.4))))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const Sheet = { month: MonthSheet, ramadan: RamadanSheet, stickers: StickerSheet, tracker: TrackerSheet, fasting: FastingSheet, letter: LetterSheet }[o.sheet]
  const lw = LETTER_WORDS[c.lang]
  const usLetter = o.sheet === 'letter' && o.paper === 'letter'

  return (
    <div class="print-page">
      <style>{`@page { size: ${usLetter ? 'letter' : 'A4'}; margin: 0; }`}</style>
      <aside class="controls">
        <header>
          <p class="eyebrow">Prayer Times Asia</p>
          <h1>Print your own prayer calendar</h1>
          <p class="muted">Free to print, share and stick up. Pick a place and a sheet, then print it or save it as a PDF.</p>
        </header>

        <fieldset>
          <legend>Sheet</legend>
          <div class="sheet-picker">
            {SHEETS.map((s) => (
              <button key={s} type="button" class={o.sheet === s ? 'on' : ''} aria-pressed={o.sheet === s} onClick={() => setO((x) => ({ ...x, sheet: s }))}>
                <span class="ico" aria-hidden="true">{SHEET_ICON[s]}</span>{w.sheetName[s]}
              </button>
            ))}
          </div>
          <p class="muted small">{w.sheetHint[o.sheet]}</p>
        </fieldset>

        {o.sheet === 'letter' && (
          <fieldset>
            <legend>Letter</legend>
            <div class="seg" role="group" aria-label="Who the letter is for">
              {LETTER_FOR.map((f) => (
                <button key={f} type="button" class={(o.for ?? 'work') === f ? 'on' : ''} aria-pressed={(o.for ?? 'work') === f} onClick={() => setO((x) => ({ ...x, for: f }))}>{lw.forLabel[f]}</button>
              ))}
            </div>
            <div class="seg" role="group" aria-label="Paper size">
              {PAPER_SIZES.map((p) => (
                <button key={p} type="button" class={(o.paper ?? 'a4') === p ? 'on' : ''} aria-pressed={(o.paper ?? 'a4') === p} onClick={() => setO((x) => ({ ...x, paper: p }))}>{lw.paperLabel[p]}</button>
              ))}
            </div>
            <p class="muted small">Today's prayer times are filled in. Write the name, sign it, and hand it over.</p>
          </fieldset>
        )}

        {o.sheet !== 'ramadan' && o.sheet !== 'fasting' && o.sheet !== 'letter' && (
          <fieldset>
            <legend>Month</legend>
            <div class="month-picker">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
              <b>{w.months[o.month - 1]} {o.year}</b>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
            </div>
            {thisMonth && (thisMonth.year !== o.year || thisMonth.month !== o.month) && (
              <button type="button" class="link" onClick={() => setO((x) => ({ ...x, year: thisMonth.year, month: thisMonth.month }))}>Back to this month</button>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend>Place</legend>
          {c.place && <p class="chosen"><b>{c.place.name}</b>{c.place.cc && <>, {profileFor(c.place.cc)?.name ?? c.place.cc}</>}</p>}
          <input type="search" value={search} placeholder={c.place ? 'Change: Tampines, Shah Alam, Bandung…' : 'Search: Tampines, Shah Alam, Bandung…'}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)} autoComplete="off" aria-label="Search for a place" />
          {results.length > 0 && (
            <ul class="results">
              {results.map((p) => (
                <li key={p.id}><button type="button" onClick={() => choose({
                  name: p.name, lat: p.coordinates.latitude, lng: p.coordinates.longitude, tz: p.timeZoneID, cc: p.countryCode ?? null, district: p.district ?? null,
                })}>{p.name}<span class="muted">{[p.region, p.countryName].filter((x) => x && x !== p.name).join(', ')}</span></button></li>
              ))}
            </ul>
          )}
          <button type="button" class="link" onClick={locate} disabled={gps === 'busy'}>{gps === 'busy' ? 'Finding…' : 'Use my location'}</button>
          {gps === 'failed' && <p class="error">The location could not be read. Search for the town instead.</p>}
          <label for="p-title">Title on the sheet (optional)</label>
          <input id="p-title" value={c.name} maxLength={80} placeholder="Masjid Al-Falah, or The Rahman family" onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
        </fieldset>

        <fieldset>
          <legend>Words and times</legend>
          <label for="p-names">Prayer names</label>
          <select id="p-names" value={c.names} onChange={(e) => set({ names: (e.target as HTMLSelectElement).value as NamingStyle })}>
            {NAMING_STYLES.map((n) => <option key={n} value={n}>{NAMING_LABEL[n]}</option>)}
          </select>
          <label for="p-lang">Other words on the sheet</label>
          <select id="p-lang" value={c.lang} onChange={(e) => set({ lang: (e.target as HTMLSelectElement).value as ScreenLanguage })}>
            <option value="en">English</option><option value="ms">Bahasa Melayu</option><option value="id">Bahasa Indonesia</option>
          </select>
          <label class="check"><input type="checkbox" checked={c.h24} onChange={(e) => set({ h24: (e.target as HTMLInputElement).checked })} /> 24-hour times</label>
          {c.name && <label class="check"><input type="checkbox" checked={c.showIqamah} onChange={(e) => set({ showIqamah: (e.target as HTMLInputElement).checked })} /> Show the masjid's iqamah times</label>}
        </fieldset>

        <button type="button" class="primary print-btn" disabled={!c.place} onClick={() => window.print()}>Print or save as PDF</button>
        <p class="muted small">In the print window choose {usLetter ? 'Letter' : 'A4'}, and turn off "Headers and footers". For a PDF, choose "Save as PDF" as the printer.</p>
      </aside>

      <main class="preview">
        {c.place && days.length > 0
          ? <Sheet c={c} o={o} days={days} qrLink={qrLink} />
          : <div class="paper empty"><p>Choose a place to see the prayer times.</p></div>}
      </main>
    </div>
  )
}

render(<App />, document.getElementById('app')!)
