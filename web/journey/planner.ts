/**
 * Journey Prayer Planner, the page's own script. Runs in the visitor's browser only. Nothing is sent anywhere.
 * Bundled into the page by scripts/build-journey-planner.ts.
 */
import { planJourney, whereAt, type Leg, type PrayerRun, type Stop } from '../src/core/journeyPlan'
import { qiblaBearing } from '../src/core/geo'
import { FALLBACK_PROFILE, profileFor, profileMethod } from '../src/core/regions'
import { CITIES, searchCities } from '../src/services/cities'
import { zoned, zonedTime } from '../src/core/tz'
import type { Place } from '../src/core/place'
import type { JWords } from './words'

const W: JWords = JSON.parse(document.getElementById('jw')!.textContent!)
const root = document.getElementById('planner')!
const MAXLEGS = 4

interface LegState { from: Place | null; to: Place | null; depart: string; arrive: string }
let legs: LegState[] = [{ from: null, to: null, depart: '', arrive: '' }]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fill = (s: string, ...v: string[]) => s.replace(/\{([a-d])\}/g, (_, k: string) => v['abcd'.indexOf(k)] ?? '')
const label = (p: Place) => (p.countryName && p.countryName !== p.name ? `${p.name}, ${p.countryName}` : p.name)
const byId = new Map(CITIES.map((c) => [c.id, c]))

function stopOf(p: Place): Stop {
  const prof = profileFor(p.countryCode) ?? FALLBACK_PROFILE
  return { name: p.name, coords: p.coordinates, tz: p.timeZoneID, method: profileMethod(prof), asr: prof.asr }
}

// ---- time text -------------------------------------------------------------------------------------------------------
function clock(ms: number, tz: string): string {
  const z = zoned(ms, tz)
  const mm = String(z.minute).padStart(2, '0')
  if (W.clock24) return `${String(z.hour).padStart(2, '0')}.${mm}`
  return `${z.hour % 12 === 0 ? 12 : z.hour % 12}:${mm} ${z.hour < 12 ? 'AM' : 'PM'}`
}
function dayText(ms: number, tz: string): string {
  return new Intl.DateTimeFormat(W.locale, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ms))
}
const stamp = (ms: number, tz: string) => `${dayText(ms, tz)}, ${clock(ms, tz)}`
function dur(ms: number): string {
  const m = Math.round(ms / 60000), h = Math.floor(m / 60), r = m % 60
  return [h ? fill(W.hours, String(h)) : '', r || !h ? fill(W.minutes, String(r)) : ''].filter(Boolean).join(' ')
}
function whereClock(ls: Leg[], ms: number): string {
  const w = whereAt(ls, ms)
  if (w.kind === 'ground') return `${stamp(ms, w.stop.tz)} (${w.stop.name})`
  const l = ls[w.leg]
  return `${stamp(ms, l.from.tz)} (${l.from.name}) · ${clock(ms, l.to.tz)} (${l.to.name})`
}
const compass = (deg: number) => W.compass[Math.round(deg / 45) % 8]

// ---- city picker -------------------------------------------------------------------------------------------------------
let uid = 0
function cityField(id: string, text: string, hint: string): string {
  uid++
  return `<div class="cf" data-field="${id}">
    <label for="c${uid}">${esc(hint)}</label>
    <input id="c${uid}" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="l${uid}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(W.cityPlaceholder)}" value="${esc(text)}" />
    <ul id="l${uid}" role="listbox" hidden></ul></div>`
}

function render() {
  uid = 0
  root.innerHTML = `<form id="f" novalidate>
    ${legs.map((l, i) => `<fieldset class="leg" data-i="${i}"><legend>${esc(fill(W.flight, String(i + 1)))}</legend>
      ${i === 0 ? cityField(`${i}:from`, l.from ? label(l.from) : '', W.from)
        : `<div class="cf fixed"><span class="lbl">${esc(W.from)}</span><b>${esc(l.from ? label(l.from) : '')}</b><small>${esc(fill(W.connecting, l.from?.name ?? ''))}</small></div>`}
      ${cityField(`${i}:to`, l.to ? label(l.to) : '', W.to)}
      <div class="tf"><label for="d${i}">${esc(W.takesOff)}</label><input id="d${i}" type="datetime-local" data-k="depart" value="${esc(l.depart)}" />
        <small>${esc(l.from ? fill(W.localHint, l.from.name) : W.cityHint)}</small></div>
      <div class="tf"><label for="a${i}">${esc(W.lands)}</label><input id="a${i}" type="datetime-local" data-k="arrive" value="${esc(l.arrive)}" />
        <small>${esc(l.to ? fill(W.localHint, l.to.name) : W.cityHint)}</small></div>
      ${i > 0 ? `<button type="button" class="btn o sm rm" data-rm="${i}">${esc(W.removeFlight)}</button>` : ''}
    </fieldset>`).join('')}
    <div class="row">
      ${legs.length < MAXLEGS ? `<button type="button" class="btn o" id="add">${esc(W.addFlight)}</button>` : ''}
      <button type="button" class="btn o" id="ex">${esc(W.example)}</button>
      <button type="button" class="btn o" id="clr">${esc(W.clear)}</button>
    </div>
    <p id="err" class="err" role="alert" hidden></p>
    <button type="submit" class="btn go">${esc(W.show)}</button>
  </form><div id="out" aria-live="polite"></div>`
  wire()
}

function wire() {
  root.querySelectorAll<HTMLElement>('.cf[data-field]').forEach((cf) => {
    const [iStr, which] = cf.dataset.field!.split(':')
    const i = Number(iStr)
    const input = cf.querySelector('input')!, list = cf.querySelector('ul')!
    let hits: Place[] = [], cur = -1
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); cur = -1; input.removeAttribute('aria-activedescendant') }
    const pick = (p: Place) => {
      if (which === 'from') legs[i].from = p
      else { legs[i].to = p; if (legs[i + 1]) legs[i + 1].from = p }
      input.value = label(p); close(); keepTimes(); render2(i)
    }
    const paint = () => {
      list.innerHTML = hits.length ? hits.map((p, n) => `<li role="option" id="${list.id}-${n}" data-n="${n}" aria-selected="${n === cur}">${esc(label(p))}</li>`).join('')
        : `<li class="none" role="presentation">${esc(W.noCity)}</li>`
      list.hidden = false; input.setAttribute('aria-expanded', 'true')
      if (cur >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${cur}`)
    }
    input.addEventListener('input', () => {
      if (which === 'from') legs[i].from = null; else { legs[i].to = null; if (legs[i + 1]) legs[i + 1].from = null }
      hits = searchCities(input.value, 8); cur = -1
      if (input.value.trim()) paint(); else close()
    })
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return
      if (e.key === 'ArrowDown') { cur = Math.min(hits.length - 1, cur + 1); paint(); e.preventDefault() }
      else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); paint(); e.preventDefault() }
      else if (e.key === 'Enter' && hits.length) { pick(hits[cur >= 0 ? cur : 0]); e.preventDefault() }
      else if (e.key === 'Escape') close()
    })
    input.addEventListener('blur', () => setTimeout(close, 150))
    list.addEventListener('mousedown', (e) => {
      const li = (e.target as HTMLElement).closest('li[data-n]') as HTMLElement | null
      if (li) { e.preventDefault(); pick(hits[Number(li.dataset.n)]) }
    })
  })
  root.querySelectorAll<HTMLInputElement>('input[type=datetime-local]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const i = Number(inp.closest<HTMLElement>('.leg')!.dataset.i)
      legs[i][inp.dataset.k as 'depart' | 'arrive'] = inp.value
    })
  })
  root.querySelector('#add')?.addEventListener('click', () => {
    const last = legs[legs.length - 1]
    legs.push({ from: last.to, to: null, depart: '', arrive: '' }); render()
    root.querySelectorAll<HTMLInputElement>('.leg:last-of-type .cf:not(.fixed) input')[0]?.focus()
  })
  root.querySelectorAll<HTMLElement>('[data-rm]').forEach((b) => b.addEventListener('click', () => { legs.splice(Number(b.dataset.rm), 1); render() }))
  root.querySelector('#clr')!.addEventListener('click', () => { legs = [{ from: null, to: null, depart: '', arrive: '' }]; history.replaceState(null, '', location.pathname); render() })
  root.querySelector('#ex')!.addEventListener('click', example)
  root.querySelector('#f')!.addEventListener('submit', (e) => { e.preventDefault(); show(true) })
}

/** After a city is picked only the small hints under the time boxes change, so refresh them without losing focus. */
function render2(i: number) {
  const fs = root.querySelectorAll<HTMLElement>('.leg')[i]
  const smalls = fs.querySelectorAll<HTMLElement>('.tf small')
  const l = legs[i]
  smalls[0].textContent = l.from ? fill(W.localHint, l.from.name) : W.cityHint
  smalls[1].textContent = l.to ? fill(W.localHint, l.to.name) : W.cityHint
  const next = root.querySelectorAll<HTMLElement>('.leg')[i + 1]
  if (next) { next.querySelector('.cf.fixed b')!.textContent = l.to ? label(l.to) : ''; next.querySelector('.cf.fixed small')!.textContent = fill(W.connecting, l.to?.name ?? '') ; const s = next.querySelectorAll<HTMLElement>('.tf small')[0]; s.textContent = l.to ? fill(W.localHint, l.to.name) : W.cityHint }
}
function keepTimes() { /* times stay as typed, they are read when the plan is made */ }

const find = (name: string, cc: string) => CITIES.find((c) => c.name === name && c.countryCode === cc) ?? null

function example() {
  const sin = find('Singapore City', 'SG'), lon = find('London', 'GB')
  if (!sin || !lon) return
  const d = new Date(Date.now() + 86_400_000)
  const z = zoned(d.getTime(), sin.timeZoneID)
  const p = (n: number) => String(n).padStart(2, '0')
  const day = (y: number, m: number, dd: number) => `${y}-${p(m)}-${p(dd)}`
  const next = zoned(d.getTime() + 86_400_000, sin.timeZoneID)
  legs = [{ from: sin, to: lon, depart: `${day(z.year, z.month, z.day)}T23:55`, arrive: `${day(next.year, next.month, next.day)}T05:50` }]
  render(); show(true)
}

// ---- reading the form --------------------------------------------------------------------------------------------------
function readLegs(): { legs: Leg[] } | { error: string } {
  const out: Leg[] = []
  for (const l of legs) {
    if (!l.from || !l.to) return { error: W.errCity }
    if (!l.depart || !l.arrive) return { error: W.errTimes }
    const m = (v: string, tz: string) => {
      const x = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
      return x ? zonedTime(+x[1], +x[2], +x[3], +x[4], +x[5], 0, tz) : NaN
    }
    const from = stopOf(l.from), to = stopOf(l.to)
    const departMs = m(l.depart, from.tz), arriveMs = m(l.arrive, to.tz)
    if (!isFinite(departMs) || !isFinite(arriveMs)) return { error: W.errTimes }
    if (arriveMs <= departMs) return { error: W.errWhen }
    if (arriveMs - departMs > 30 * 3_600_000) return { error: W.errTooLong }
    if (out.length && departMs < out[out.length - 1].arriveMs) return { error: W.errLayover }
    out.push({ from, to, departMs, arriveMs })
  }
  return { legs: out }
}

// ---- the results -------------------------------------------------------------------------------------------------------
const COLORS: Record<string, string> = { fajr: '#5b7bd5', sunrise: '#f39a4a', dhuhr: '#f2c063', asr: '#d9a441', maghrib: '#e0707a', isha: '#6a58b8' }

function picture(ls: Leg[], runs: PrayerRun[], dep: number, arr: number): string {
  const total = arr - dep
  const pct = (a: number, b: number) => `${(((Math.min(b, arr) - Math.max(a, dep)) / total) * 100).toFixed(3)}%`
  const where: string[] = []
  ls.forEach((l, i) => {
    where.push(`<span class="seg air" style="width:${pct(l.departMs, l.arriveMs)}" title="${esc(`${W.air} ${l.from.name} → ${l.to.name}`)}"><i aria-hidden="true">✈</i></span>`)
    const n = ls[i + 1]
    if (n) where.push(`<span class="seg lay" style="width:${pct(l.arriveMs, n.departMs)}" title="${esc(`${W.layover} ${l.to.name}`)}"></span>`)
  })
  const pr = runs.map((r) => `<span class="seg p" style="width:${pct(r.startMs, r.endMs)};background:${COLORS[r.prayer]}" title="${esc(`${W.names[r.prayer]}`)}"><b>${esc(W.names[r.prayer])}</b></span>`)
  const first = ls[0], last = ls[ls.length - 1]
  return `<div class="pic" role="img" aria-label="${esc(W.picH)}">
    <div class="rowl">${esc(W.rowWhere)}</div><div class="bar">${where.join('')}</div>
    <div class="rowl">${esc(W.rowPrayer)}</div><div class="bar">${pr.join('')}</div>
    <div class="ends"><span>${esc(first.from.name)}<br>${esc(stamp(dep, first.from.tz))}</span><span>${esc(last.to.name)}<br>${esc(stamp(arr, last.to.tz))}</span></div>
    <div class="key"><span><i class="seg air"></i>${esc(W.air)}</span><span><i class="seg ground"></i>${esc(W.ground)}</span><span><i class="seg lay"></i>${esc(W.layover)}</span></div>
  </div><p class="note">${esc(W.picNote)}</p>`
}

function partLine(ls: Leg[], r: PrayerRun, p: PrayerRun['parts'][number]): string {
  if (p.kind === 'before') return fill(W.pBefore, p.stop!.name, clock(p.fromMs, p.stop!.tz), clock(p.toMs, p.stop!.tz))
  if (p.kind === 'after') return fill(W.pAfter, p.stop!.name, clock(p.fromMs, p.stop!.tz), clock(p.toMs, p.stop!.tz))
  if (p.kind === 'layover') return fill(W.pLayover, p.stop!.name, clock(p.fromMs, p.stop!.tz), clock(p.toMs, p.stop!.tz))
  const l = ls[p.leg]
  const at = (ms: number) => `${clock(ms, l.from.tz)} ${l.from.name} · ${clock(ms, l.to.tz)} ${l.to.name}`
  const rel = [p.fromMs - l.departMs >= 60000 ? fill(W.afterTakeoff, dur(p.fromMs - l.departMs)) : '', l.arriveMs - p.toMs >= 60000 ? fill(W.beforeLanding, dur(l.arriveMs - p.toMs)) : ''].filter(Boolean)
  return `${fill(W.pAir, at(p.fromMs), at(p.toMs))}.${rel.length ? ' ' + rel.join(', ') + '.' : ''}`
}

function card(ls: Leg[], r: PrayerRun): string {
  const air = r.airMs > 0
  const badge = r.onlyInAir ? ['air', W.badgeAir] : air ? ['part', W.badgePart] : ['ground', W.badgeGround]
  const fard = r.prayer !== 'sunrise'
  const lines = r.parts.map((p) => {
    let extra = ''
    if (p.kind === 'air') {
      const q = Math.round(qiblaBearing(p.pos))
      extra = `<small>${esc(fill(W.qibla, String(q), compass(q)))}</small>`
    }
    return `<li class="${p.kind}">${esc(partLine(ls, r, p))}${extra}</li>`
  }).join('')
  const notes = [r.startedBeforeTakeoff ? W.startedEarlier : '', r.endsAfterLanding ? W.continues : ''].filter(Boolean)
  return `<article class="card pc ${badge[0]}" style="--pc:${COLORS[r.prayer]}">
    <h3>${esc(W.names[r.prayer])} <span class="badge ${badge[0]}">${esc(badge[1])}</span></h3>
    <p class="when"><b>${esc(W.begins)}</b> ${esc(whereClock(ls, r.startMs))}<br><b>${esc(W.ends)}</b> ${esc(whereClock(ls, r.endMs))}</p>
    ${fard ? '' : `<p class="note">${esc(W.noFard)}</p>`}
    <ul>${lines}</ul>${notes.length ? `<p class="note">${esc(notes.join(' · '))}</p>` : ''}
  </article>`
}

function show(scroll: boolean) {
  const err = root.querySelector<HTMLElement>('#err')!
  const out = root.querySelector<HTMLElement>('#out')!
  const read = readLegs()
  if ('error' in read) { err.textContent = read.error; err.hidden = false; out.innerHTML = ''; return }
  err.hidden = true
  const ls = read.legs
  const plan = planJourney(ls)
  const total = plan.arriveMs - plan.departMs
  out.innerHTML = `<section class="res">
    <p class="sum">${esc(fill(W.summary, dur(plan.airMs), dur(total)))}</p>
    <h2>${esc(W.picH)}</h2>${picture(ls, plan.runs, plan.departMs, plan.arriveMs)}
    <h2>${esc(W.prayersH)}</h2>${plan.runs.map((r) => card(ls, r)).join('')}
    <div class="row noprint"><button type="button" class="btn o" id="pr">${esc(W.print)}</button><button type="button" class="btn o" id="cp">${esc(W.copy)}</button></div>
    <div class="card"><h2>${esc(W.estimateH)}</h2><p>${esc(W.estimateP)}</p></div>
    <div class="card"><h2>${esc(W.travelH)}</h2><p>${esc(W.travelP)}</p></div>
    <div class="card cta"><h2>${esc(W.appH)}</h2><p>${esc(W.appP)}</p><a class="btn" href="${esc(document.body.dataset.app ?? '/app/')}">${esc(W.appBtn)}</a></div>
  </section>`
  out.querySelector('#pr')!.addEventListener('click', () => window.print())
  out.querySelector('#cp')!.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement
    try { await navigator.clipboard.writeText(location.href); b.textContent = W.copied } catch { b.textContent = location.href }
  })
  try { history.replaceState(null, '', '#p=' + encodeURIComponent(JSON.stringify(legs.map((l) => [l.from!.id, l.to!.id, l.depart, l.arrive])))) } catch { /* ignore */ }
  if (scroll) out.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---- start -------------------------------------------------------------------------------------------------------------
function restore() {
  const m = /^#p=(.+)$/.exec(location.hash)
  if (!m) return false
  try {
    const rows = JSON.parse(decodeURIComponent(m[1])) as [string, string, string, string][]
    if (!Array.isArray(rows) || !rows.length || rows.length > MAXLEGS) return false
    const next: LegState[] = rows.map(([a, b, d, e]) => ({ from: byId.get(String(a)) ?? null, to: byId.get(String(b)) ?? null, depart: String(d), arrive: String(e) }))
    if (next.some((l) => !l.from || !l.to)) return false
    legs = next
    return true
  } catch { return false }
}
const restored = restore()
render()
if (restored) show(false)
