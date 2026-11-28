import { useState } from 'preact/hooks'
import {
  CalendarDays, Camera, CheckCircle2, ChevronRight, Compass, Eye, Footprints, Hourglass, Landmark, Moon, MoonStar, Ruler, ScanEye, Sparkles, Sun, SunDim, Sunrise, Sunset, TriangleAlert,
} from 'lucide-preact'
import { fix } from '../core/astro'
import * as Falak from '../core/falak'
import { compassPoint, qiblaBearing } from '../core/geo'
import type { Place } from '../core/place'
import type { Prayer } from '../core/prayer'
import { daysBetween, noonDaysAfter, startOfDay, zoned, zonedTime } from '../core/tz'
import { readString, writeString } from '../services/storage'
import { store, useNow, useStore } from '../services/store'
import { fmtDate, openSheet, Segmented, Sheet } from './common'
import { Hadith } from './Hadith'
import { stepsText } from './FalakShadow'
import { appLocale, tr } from '../core/appWords'

const ymd = (ms: number) => { const z = zoned(ms, store.timeZone); return [z.year, z.month, z.day] as const }
const longDate = (ms: number) => fmtDate(ms, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const minutesText = (m: number) => tr('falak.minutes', { n: Math.abs(Math.round(m)) })

type FalakTab = 'sky' | 'then' | 'now' | 'why'

/**
 * Falak for everyone (Nov 2026): a sky you can slide, then three short parts.
 * Then (how Muslims read the sky), Now (try it yourself) and Why it helps. The
 * detailed F1 tools live on in Expert tools. Everything here is for learning;
 * it never replaces the authority's times.
 */
export function FalakScreen() {
  const s = useStore()
  const now = useNow(30_000)
  const [tab, setTab] = useState<FalakTab>('sky')
  const place = s.activePlace
  if (!place) return <div class="page"><p class="headline" style={{ textAlign: 'center', marginTop: '40vh' }}>{tr('falak.choosePlace')}</p></div>
  return (
    <div class={`page falak falak2 v12s v12f f-${s.prefs.todayStyle}`}>
      <div class="falak-head">
        <h1 class="f-title">{tr('falak.title')}</h1>
        <p class="f-lede">{tr('falak.lede')}</p>
      </div>
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'sky', label: tr('falak.tabSky') }, { value: 'then', label: tr('falak.tabThen') },
        { value: 'now', label: tr('falak.tabNow') }, { value: 'why', label: tr('falak.tabWhy') },
      ]} />
      {tab === 'sky' && <><SkySlider place={place} now={now} /><ToolRows place={place} now={now} short /></>}
      {tab === 'then' && <ThenStory />}
      {tab === 'now' && <ToolRows place={place} now={now} />}
      {tab === 'why' && <WhyItHelps />}
      <p class="falak-foot">{tr('falak.footer')}</p>
    </div>
  )
}

/** The detailed F1 cards: shadow now, Qibla Day, rashdul qiblat, the shadow stick and sky signs. */
export function FalakExpertSheet() {
  const s = useStore()
  const now = useNow(30_000)
  const place = s.activePlace
  return (
    <Sheet title={tr('falak.expert')} full>
      {place && <div class="falak">
        <div class="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <span class="chip"><SunDim size={15} />{tr('falak.grade')}</span>
          <span class="chip"><Hourglass size={14} />{tr('falak.pendingReview')}</span>
        </div>
        <SunSafety />
        <ShadowCompassCard place={place} now={now} />
        <QiblaDayCard place={place} now={now} />
        <RashdulCard place={place} now={now} />
        <ShadowStickCard place={place} now={now} />
        <SkySignsCard now={now} />
        <p class="footnote" style={{ opacity: 0.75 }}>{Falak.REVIEW_NOTE}</p>
      </div>}
    </Sheet>
  )
}

// ---- The sky slider -------------------------------------------------------

const W = 343, H = 170, GY = 132, STICK_X = 172, STICK = 44

function mix(a: number[], b: number[], k: number) { return a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, k)))) }
const rgb = (c: number[]) => `rgb(${c.join(',')})`

/** Sky colours for a sun `alt` degrees up, at a given stage. */
function skyColours(alt: number, stage: Falak.SkyStage, k: number): [string, string] {
  const night = [10, 18, 42], dusk = [30, 40, 90]
  if (stage === 'fajr') return [rgb(mix(night, [40, 80, 150], k)), rgb(mix([110, 130, 175], [235, 240, 248], k))]
  if (alt > 0) { const d = Math.min(1, alt / 25); return [rgb(mix([62, 100, 170], [31, 95, 191], d)), rgb(mix([240, 170, 110], [143, 195, 240], d))] }
  if (stage === 'maghrib') return [rgb(mix(dusk, night, k)), rgb(mix([226, 104, 60], [30, 45, 85], k))]
  return [rgb(night), rgb([24, 36, 74])]
}

/** 0 = new moon, 0.5 = full, from the average length of a lunar month (good to about a day). */
function moonPhase(t: number): number {
  const synodic = 29.530588853 * 86_400_000
  const newMoon = Date.UTC(2000, 0, 6, 18, 14)
  return (((t - newMoon) % synodic) + synodic) % synodic / synodic
}

function MoonShape({ x, y, r, phase }: { x: number; y: number; r: number; phase: number }) {
  const waxing = phase < 0.5
  const k = Math.cos(2 * Math.PI * phase) // 1 new .. -1 full
  const rx = Math.abs(k) * r
  const lit = `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} 0 ${-r}Z`
  return (
    <g transform={`translate(${x} ${y})${waxing ? '' : ' scale(-1 1)'}`}>
      <circle r={r} fill="#fff" opacity=".12" />
      <path d={lit} fill="#f1efe6" />
    </g>
  )
}

function SkySlider({ place, now }: { place: Place; now: number }) {
  const day = store.day(now)
<<<<<<< HEAD
  // The slider always starts at the current time and follows it until you drag it.
  // It lives only while the Sky tab is open, so coming back later starts at now again.
  const range = day ? Falak.skyRange(day.times.fajr, day.times.isha, now) : { from: now - 12 * 3_600_000, to: now + 12 * 3_600_000 }
  const t0 = range.from, t1 = range.to
=======
  // The whole day, midnight to midnight, so the night can be explored too.
  const t0 = day ? startOfDay(day.times.dhuhr, store.timeZone) : now - 12 * 3_600_000
  const t1 = day ? startOfDay(t0 + 36 * 3_600_000, store.timeZone) : now + 12 * 3_600_000
>>>>>>> 3a81e5c (Falak sky slider covers the full 24 hours, with small surprises (moon phase, last third of the night, shooting star, midday stillness))
  const [picked, setPicked] = useState<number | null>(null)
  const t = picked ?? now
  if (!day) return null
  const times = day.times
  const stage = Falak.skyStage(t, times)
  const sun = Falak.sunPosition(t, place.coordinates)
  const [y, m, d] = ymd(t)
  const plan = Falak.shadowDay(y, m, d, place.coordinates)
  const factor = store.asrSchool === 'hanafi' ? 2 : 1
  const k = stage === 'fajr' ? (t - times.fajr) / (times.sunrise - times.fajr)
    : stage === 'maghrib' ? (t - times.maghrib) / (times.isha - times.maghrib) : 0
  const [top, bottom] = skyColours(sun.altitude, stage, k)
  // East on the left, west on the right: the sun moves the same way as your finger.
  const p = (t - times.sunrise) / (times.maghrib - times.sunrise)
  const sx = 16 + (W - 32) * p
  const sy = GY - (GY - 22) * Math.max(0, Math.sin(Math.min(90, sun.altitude) * Math.PI / 180))
  const morning = t < plan.noon
  const shadow = sun.altitude > 2 ? Math.min(150, STICK * Falak.shadowLength(1, sun.altitude)) : 0
  const asrX = STICK_X - STICK * (Falak.noonShadow(plan, 1) + factor)
  const names = { fajr: store.name('fajr'), dhuhr: store.name('dhuhr'), asr: store.name('asr'), maghrib: store.name('maghrib'), isha: store.name('isha') }
  const title = { night: tr('falak.stageNight'), fajr: names.fajr, sunrise: tr('falak.stageSunrise'), morning: tr('falak.stageMorning'), dhuhr: names.dhuhr, asr: names.asr, maghrib: names.maghrib, isha: names.isha }[stage]
  const say = {
    night: tr('falak.stageNightSay', { name: names.fajr }), fajr: tr('falak.stageFajrSay', { name: names.fajr }),
    sunrise: tr('falak.stageSunriseSay', { name: names.fajr }), morning: tr('falak.stageMorningSay'),
    dhuhr: tr('falak.stageDhuhrSay'), asr: tr('falak.stageAsrSay'), maghrib: tr('falak.stageMaghribSay'), isha: tr('falak.stageIshaSay'),
  }[stage]
  const dark = sun.altitude <= 0 && stage !== 'fajr'
<<<<<<< HEAD
  // In daylight the sky takes the look's own colours, as in the mockup. Dawn, dusk and night keep their real colours.
  const lit = sun.altitude > 0 && stage !== 'fajr' && stage !== 'maghrib'
  const ink = lit ? 'var(--s-st)' : '#fff'
  const stars = dark ? Array.from({ length: 14 }, (_, i) => <circle cx={(i * 73) % W} cy={(i * 37) % 100 + 8} r="1.2" fill="#fff" opacity=".7" />) : null
=======
  // Small surprises while you slide. Midday stillness, the last third of the night, a shooting star in the deepest night.
  const nightStart = times.maghrib - 24 * 3_600_000
  const lastThirdFrom = times.fajr - (times.fajr - nightStart) / 3
  const midNight = (nightStart + times.fajr) / 2
  const lastThird = t >= lastThirdFrom && t < times.fajr
  const atNoon = Math.abs(t - plan.noon) <= 15 * 60_000
  const meteor = dark && Math.abs(t - midNight) <= 30 * 60_000
  const stars = dark ? Array.from({ length: lastThird ? 26 : 14 }, (_, i) => <circle cx={(i * 73) % W} cy={(i * 37) % 100 + 8} r={lastThird ? 1.6 : 1.2} fill="#fff" opacity={lastThird ? 0.95 : 0.7} />) : null
  // The moon shows today's real phase and crosses the night sky, east to west.
  const nightP = ((t - times.maghrib + 24 * 3_600_000) % (24 * 3_600_000)) / (times.fajr + 24 * 3_600_000 - times.maghrib)
  const moon = dark && nightP >= 0 && nightP <= 1 ? { x: 44 + (W - 88) * nightP, y: GY - 34 - (GY - 64) * Math.sin(Math.PI * nightP), phase: moonPhase(t) } : null
  const sayText = lastThird ? tr('falak.lastThirdSay') : atNoon ? tr('falak.noonSay') : say
>>>>>>> 3a81e5c (Falak sky slider covers the full 24 hours, with small surprises (moon phase, last third of the night, shooting star, midday stillness))
  const minutes = Math.round((t1 - t0) / 60_000)
  const shadowEnd = STICK_X + (morning ? 1 : -1) * shadow
  return (
    <div class="sky-card">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${say}`}>
        <defs>
          <linearGradient id="falak-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: lit ? 'var(--s-fk1)' : top }} /><stop offset="1" style={{ stopColor: lit ? 'var(--s-fk2)' : bottom }} /></linearGradient>
          <radialGradient id="falak-sun"><stop offset="0" stop-color="#fff7d6" /><stop offset=".45" stop-color="#ffd66b" /><stop offset="1" stop-color="#ffd66b" stop-opacity="0" /></radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#falak-sky)" />
        {stars}
        {moon && <MoonShape x={moon.x} y={moon.y} r={9} phase={moon.phase} />}
        {meteor && <line key={Math.round(t / 60_000 / 5)} class="falak-meteor" x1="250" y1="22" x2="214" y2="46" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />}
        {stage === 'fajr' && <ellipse cx="50" cy={GY} rx={110 + 60 * k} ry={8 + 8 * k} fill="#fff" opacity={0.5 + 0.35 * k} />}
        {stage === 'maghrib' && <ellipse cx={W - 50} cy={GY} rx="150" ry={22 * (1 - k)} fill="#ff5a2a" opacity={0.75 * (1 - k)} />}
        <path d={`M16 ${GY} Q${W / 2} -20 ${W - 16} ${GY}`} fill="none" style={{ stroke: ink }} stroke-opacity={lit ? 0.6 : 0.3} stroke-width="1.2" stroke-dasharray="3 5" />
        {lit
          ? <><circle cx={sx} cy={sy} r="26" class="sky-sun" opacity=".28" /><circle cx={sx} cy={sy} r="15" class="sky-sun" /></>
          : sun.altitude > -1 && <><circle cx={sx} cy={sy} r="26" fill="url(#falak-sun)" /><circle cx={sx} cy={sy} r="10" fill="#fff4c4" /></>}
        <rect y={GY} width={W} height={H - GY} style={{ fill: lit ? 'var(--s-gr)' : dark ? '#2b281f' : '#e8d6ae' }} />
        {shadow > 0 && (lit
          ? <>
              <line x1={STICK_X} y1={GY} x2={shadowEnd} y2={GY} class="sky-shadow" stroke-width="3" />
              {/* The word steps aside for the Asr mark late in the day, so the two never cross. */}
              {(morning || Math.abs((STICK_X + shadowEnd) / 2 - asrX) > 34) &&
                <text x={(STICK_X + shadowEnd) / 2} y={GY + 15} class="sky-ground-ink" font-size="11" font-weight="700" text-anchor="middle">{tr('falak.shadowLabel')}</text>}
            </>
          : <path d={`M${STICK_X} ${GY} L${shadowEnd} ${GY + 3} L${shadowEnd} ${GY + 5} L${STICK_X} ${GY + 3}Z`} fill="#000" opacity=".38" />)}
        {!morning && sun.altitude > 0 && <>
          <line x1={asrX} y1={GY - 4} x2={asrX} y2={GY + 12} style={{ stroke: lit ? ink : '#fff' }} stroke-width="2" />
          <text x={asrX} y={GY + 31} class={lit ? 'sky-ground-ink' : undefined} style={lit ? undefined : { fill: '#3a3a3c' }} font-size="10" font-weight="600" text-anchor="middle">{names.asr}</text>
        </>}
        <rect x={STICK_X - 1.5} y={GY - STICK} width="3" height={STICK} rx="1.5" style={{ fill: lit ? 'var(--s-st)' : dark ? '#bbb' : '#3a3a3c' }} />
        <text x="12" y={GY - 7} style={{ fill: ink }} font-size="10" font-weight="700" opacity={lit ? 1 : 0.8}>{tr('falak.east').toUpperCase()}</text>
        <text x={W - 12} y={GY - 7} style={{ fill: ink }} font-size="10" font-weight="700" opacity={lit ? 1 : 0.8} text-anchor="end">{tr('falak.west').toUpperCase()}</text>
      </svg>
      <div class="sky-info">
        <div class="sky-time">{store.formatted(t)}</div>
        <div class="sky-name">{title}</div>
        <p class="secondary">{sayText}</p>
        {lastThird && <Hadith id="lastThird" variant="line" />}
        <input type="range" min="0" max={minutes} step="1" value={Math.round((t - t0) / 60_000)} aria-label={tr('falak.slideSun')}
          onInput={(e) => setPicked(t0 + Number((e.target as HTMLInputElement).value) * 60_000)} />
        {picked !== null && <button type="button" class="sky-now" onClick={() => setPicked(null)}>{tr('common.now')}</button>}
      </div>
    </div>
  )
}

// ---- Tools -----------------------------------------------------------------

function Ico({ bg, children }: { bg: string; children: preact.ComponentChildren }) {
  return <span class="falak-ico" style={{ background: bg }}>{children}</span>
}

function ToolRows({ place, now, short }: { place: Place; now: number; short?: boolean }) {
  const [y, m, d] = ymd(now)
  const plan = Falak.shadowDay(y, m, d, place.coordinates)
  const target = Falak.halfSteps(Falak.asrSteps(plan, store.asrSchool))
  const today = Falak.rashdulQiblat(y, m, d, store.timeZone, place.coordinates).filter((a) => a.time > now)[0]
  let next: Falak.Alignment | null = null
  if (!today) {
    for (let off = 1; off <= 60 && !next; off++) {
      const [yy, mm, dd] = ymd(noonDaysAfter(now, off, store.timeZone))
      next = Falak.rashdulQiblat(yy, mm, dd, store.timeZone, place.coordinates)[0] ?? null
    }
  }
  const qiblaSub = today ? tr('falak.qiblaSunToday', { time: store.formatted(today.time) })
    : next ? tr('falak.qiblaSunNext', { date: fmtDate(next.time, { day: 'numeric', month: 'long' }) }) : tr('falak.qiblaSunNone')
  const official = store.day(now)
  const asrName = store.name('asr')
  const steps = stepsText(target)
  return (
    <div class="group falak-tools">
      <button class="item" onClick={() => openSheet({ kind: 'shadow-steps' })}>
        <Ico bg="#FF9F0A"><Footprints size={17} color="#fff" strokeWidth={2.4} /></Ico>
        <span class="label">{tr('falak.stepsTitle')}<span class="sub">{tr('falak.stepsSub', { name: asrName })}</span></span>
        <span class="value mono">{steps}</span><ChevronRight size={16} class="secondary" />
      </button>
      <button class="item" onClick={() => openSheet({ kind: 'shadow-camera' })}>
        <Ico bg="#0A84FF"><Camera size={17} color="#fff" strokeWidth={2.4} /></Ico>
        <span class="label">{tr('falak.cameraTitle')}<span class="sub">{tr('falak.cameraTitleSub')}</span></span>
        <ChevronRight size={16} class="secondary" />
      </button>
      <button class="item" onClick={() => openSheet({ kind: 'falak-expert' })}>
        <Ico bg="#30D158"><Compass size={17} color="#fff" strokeWidth={2.4} /></Ico>
        <span class="label">{tr('falak.qiblaSunTitle')}<span class="sub">{qiblaSub}</span></span>
        <ChevronRight size={16} class="secondary" />
      </button>
      {!short && <>
        <div class="item">
          <Ico bg="#5E5CE6"><Sun size={17} color="#fff" strokeWidth={2.4} /></Ico>
          <span class="label">{tr('falak.sunOverKaaba')}<span class="sub">{fmtDate(Falak.nextQiblaDay(now), { day: 'numeric', month: 'long' })} · {store.formatted(Falak.nextQiblaDay(now))}</span></span>
        </div>
        {official && <button class="item" onClick={() => openSheet({ kind: 'falak-expert' })}>
          <Ico bg="#3A3A8C"><MoonStar size={17} color="#fff" strokeWidth={2.4} /></Ico>
          <span class="label">{tr('falak.skyTonight')}<span class="sub">{tr('falak.skyTonightSub', { name: store.name('maghrib'), time: store.formatted(official.times.maghrib) })}</span></span>
          <ChevronRight size={16} class="secondary" />
        </button>}
        <button class="item" onClick={() => openSheet({ kind: 'ar' })}>
          <Ico bg="#FF375F"><ScanEye size={17} color="#fff" strokeWidth={2.4} /></Ico>
          <span class="label">{tr('falak.camera')}<span class="sub">{tr('falak.cameraSub')}</span></span>
          <ChevronRight size={16} class="secondary" />
        </button>
        <button class="item" onClick={() => openSheet({ kind: 'level' })}>
          <Ico bg="#8E8E93"><LevelGlyph /></Ico>
          <span class="label">{tr('falak.level')}<span class="sub">{tr('falak.levelSub')}</span></span>
          <ChevronRight size={16} class="secondary" />
        </button>
        <button class="item" onClick={() => openSheet({ kind: 'falak-expert' })}>
          <Ico bg="#636366"><Ruler size={17} color="#fff" strokeWidth={2.4} /></Ico>
          <span class="label">{tr('falak.expert')}<span class="sub">{tr('falak.expertSub')}</span></span>
          <ChevronRight size={16} class="secondary" />
        </button>
      </>}
    </div>
  )
}

// ---- Then and Why ------------------------------------------------------------

function StoryPic({ kind }: { kind: 1 | 2 | 3 | 4 | 5 }) {
  const box = (children: preact.ComponentChildren, bg = '#2b4a7e') => <svg class="story-pic" viewBox="0 0 300 96" aria-hidden="true"><rect width="300" height="96" fill={bg} />{children}</svg>
  if (kind === 1) return box(<><circle cx="244" cy="26" r="13" fill="#ffd66b" /><rect y="72" width="300" height="24" fill="#d8c39a" /><rect x="121" y="36" width="58" height="38" fill="#111" /><rect x="121" y="44" width="58" height="4" fill="#E8B64A" />
    {[72, 94, 214].map((x) => <g fill="#f4f1ea" opacity=".9"><circle cx={x} cy="56" r="5.5" /><rect x={x - 4.5} y="62" width="9" height="11" rx="3" /></g>)}</>, '#1d3a6e')
  if (kind === 2) return box(<><circle cx="252" cy="22" r="12" fill="#ffe08a" /><rect y="70" width="300" height="26" fill="#d8c39a" /><rect x="148" y="26" width="4" height="46" rx="2" fill="#3a3a3c" />
    <path d="M150 71 L72 77 L72 80 L150 73Z" fill="#000" opacity=".4" />{[78, 98, 118].map((x) => <ellipse cx={x} cy="88" rx="8" ry="3.5" fill="#5a3b1c" />)}</>, '#3f7ac0')
  if (kind === 3) return <svg class="story-pic" viewBox="0 0 300 96" aria-hidden="true"><defs>
    <linearGradient id="st-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1530" /><stop offset=".7" stop-color="#5a2a50" /><stop offset="1" stop-color="#e2683c" /></linearGradient>
    <linearGradient id="st-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1530" /><stop offset=".75" stop-color="#3b5a8a" /><stop offset="1" stop-color="#e9eef7" /></linearGradient></defs>
    <rect width="150" height="96" fill="url(#st-dusk)" /><rect x="150" width="150" height="96" fill="url(#st-dawn)" /><rect y="82" width="300" height="14" fill="#0a0f1e" /></svg>
  if (kind === 4) return box(<><circle cx="150" cy="48" r="30" fill="none" stroke="#E8B64A" stroke-width="3" /><circle cx="150" cy="48" r="20" fill="none" stroke="#E8B64A" stroke-width="1" />
    <line x1="150" y1="18" x2="150" y2="78" stroke="#E8B64A" /><line x1="120" y1="48" x2="180" y2="48" stroke="#E8B64A" /><line x1="150" y1="48" x2="171" y2="28" stroke="#fff" stroke-width="2" /></>)
  return box(<><circle cx="150" cy="16" r="10" fill="#ffd66b" /><rect y="70" width="300" height="26" fill="#d8c39a" /><rect x="132" y="42" width="36" height="30" fill="#111" /><rect x="132" y="48" width="36" height="3" fill="#E8B64A" />
    <rect x="60" y="48" width="3" height="24" fill="#3a3a3c" /><path d="M61 71 L20 74 L20 76 L61 73Z" fill="#000" opacity=".4" /><rect x="238" y="48" width="3" height="24" fill="#3a3a3c" /><path d="M240 71 L282 74 L282 76 L240 73Z" fill="#000" opacity=".4" /></>, '#3f7ac0')
}

function Story({ pic, title, text, word, children }: { pic: 1 | 2 | 3 | 4 | 5; title: string; text: string; word?: string; children?: preact.ComponentChildren }) {
  return (
    <div class="glass card story">
      <StoryPic kind={pic} />
      <div class="headline">{title}</div>
      <p class="secondary">{text}</p>
      {word && <p class="story-word">{word}</p>}
      {children}
    </div>
  )
}

function ThenStory() {
  const n = (p: Prayer) => store.name(p)
  return (
    <>
      <Story pic={1} title={tr('falak.then1Title')} text={tr('falak.then1')}><Hadith id="falakJibril" variant="line" /></Story>
      <Story pic={2} title={tr('falak.then2Title')} text={tr('falak.then2', { dhuhr: n('dhuhr'), asr: n('asr') })} word={tr('falak.then2Word')}><Hadith id="falakFeet" variant="line" /></Story>
      <Story pic={3} title={tr('falak.then3Title')} text={tr('falak.then3', { isha: n('isha'), fajr: n('fajr') })} word={tr('falak.then3Word')}><Hadith id="falakDawn" variant="line" /></Story>
      <Story pic={4} title={tr('falak.then4Title')} text={tr('falak.then4')} word={tr('falak.then4Word')} />
      <Story pic={5} title={tr('falak.then5Title')} text={tr('falak.then5')} />
    </>
  )
}

function WhyItHelps() {
  const row = (bg: string, icon: preact.ComponentChildren, title: string, text: string) => (
    <div class="item why-row"><Ico bg={bg}>{icon}</Ico><span class="label">{title}<span class="sub">{text}</span></span></div>
  )
  return (
    <>
      <div class="group">
        {row('#0A84FF', <Eye size={17} color="#fff" strokeWidth={2.4} />, tr('falak.why1Title'), tr('falak.why1'))}
        {row('#30D158', <Compass size={17} color="#fff" strokeWidth={2.4} />, tr('falak.why2Title'), tr('falak.why2'))}
        {row('#FF9F0A', <CalendarDays size={17} color="#fff" strokeWidth={2.4} />, tr('falak.why3Title'), tr('falak.why3'))}
        {row('#5E5CE6', <Landmark size={17} color="#fff" strokeWidth={2.4} />, tr('falak.why4Title'), tr('falak.why4'))}
      </div>
      <div class="authority-card">
        <div class="headline">{tr('falak.authority')}</div>
        <p>{tr('falak.authoritySub')}</p>
      </div>
    </>
  )
}

function LevelGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" aria-hidden="true">
      <rect x="2" y="7.5" width="20" height="9" rx="2.5" /><rect x="9" y="10" width="6" height="4" rx="2" fill="#fff" stroke="none" />
    </svg>
  )
}

export function SunSafety() {
  return (
    <div class="safety">
      <TriangleAlert size={26} style={{ color: 'var(--warning)', flex: 'none' }} />
      <div class="footnote" style={{ fontWeight: 600 }}>{tr('falak.neverLook')}</div>
    </div>
  )
}

function CardTitle({ icon, title }: { icon: preact.ComponentChildren; title: string }) {
  return <div class="card-title">{icon}<span>{title}</span></div>
}

/** Where an upright stick's shadow points right now, against the qibla line. */
function ShadowCompassCard({ place, now }: { place: Place; now: number }) {
  const sun = Falak.sunPosition(now, place.coordinates)
  const qibla = qiblaBearing(place.coordinates)
  const shadowBearing = fix(sun.azimuth + 180, 360)
  return (
    <div class="glass card">
      <CardTitle icon={<Sun size={20} fill="currentColor" />} title={tr('falak.shadowNow')} />
      <div class="row" style={{ gap: '16px', marginTop: '12px' }}>
        <ShadowDial qibla={qibla} shadow={shadowBearing} altitude={sun.altitude} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sun.altitude > 0 ? (
            <>
              <div class="subhead" style={{ fontWeight: 600 }}>{tr('falak.sunUp', { deg: Math.round(sun.altitude), point: compassPoint(sun.azimuth) })}</div>
              <div class="footnote" style={{ opacity: 0.85 }}>{tr('falak.stickShadow', { deg: Math.round(shadowBearing), point: compassPoint(shadowBearing), x: Falak.shadowLength(1, Math.max(sun.altitude, 0.5)).toLocaleString(appLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })}</div>
            </>
          ) : (
            <>
              <div class="subhead" style={{ fontWeight: 600 }}>{tr('falak.sunBelow')}</div>
              <div class="footnote" style={{ opacity: 0.85 }}>{tr('falak.afterSunrise')}</div>
            </>
          )}
          <div class="footnote gold" style={{ fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' }}>
            <QiblaMini />{tr('falak.qiblaBearing', { deg: Math.round(qibla), point: compassPoint(qibla) })}
          </div>
        </div>
      </div>
    </div>
  )
}

function QiblaMini() {
  return <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 0 11 14 6 10.5 1 14z" fill="currentColor" /></svg>
}

function ShadowDial({ qibla, shadow, altitude }: { qibla: number; shadow: number; altitude: number }) {
  const size = 140, r = size / 2, c = size / 2
  const p = (b: number, len: number): [number, number] => { const a = ((b - 90) * Math.PI) / 180; return [c + Math.cos(a) * len, c + Math.sin(a) * len] }
  const len = altitude > 0 ? Math.min(r - 10, Math.max(r * 0.3, (r - 10) * 0.25 * Falak.shadowLength(1, altitude))) : 0
  const [q1x, q1y] = p(qibla + 180, r - 6), [q2x, q2y] = p(qibla, r - 6)
  const [sx, sy] = p(shadow, len)
  const [nx, ny] = p(0, r - 16)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }}
      aria-label={tr('falak.qiblaVsShadow', { a: Math.round(shadow), b: Math.round(qibla) })}>
      <circle cx={c} cy={c} r={r - 0.5} fill="var(--fg)" fill-opacity="0.08" stroke="var(--fg)" stroke-opacity="0.3" />
      {[0, 90, 180, 270].map((b) => { const [x1, y1] = p(b, r - 8); const [x2, y2] = p(b, r - 1); return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg)" stroke-opacity="0.6" stroke-width="1.5" /> })}
      <text x={nx} y={ny + 4} text-anchor="middle" font-size="11" font-weight="800" fill="var(--north)">N</text>
      <line x1={q1x} y1={q1y} x2={q2x} y2={q2y} stroke="var(--gold)" stroke-opacity="0.9" stroke-width="2" stroke-dasharray="4 4" />
      <circle cx={q2x} cy={q2y} r="5" fill="var(--gold)" />
      {altitude > 0 && <line x1={c} y1={c} x2={sx} y2={sy} stroke="#000" stroke-opacity="0.75" stroke-width="8" stroke-linecap="round" />}
      <circle cx={c} cy={c} r="5" fill="var(--fg)" />
    </svg>
  )
}

function QiblaDayCard({ place, now }: { place: Place; now: number }) {
  const day = Falak.nextQiblaDay(now)
  const sun = Falak.sunPosition(day, place.coordinates)
  const days = daysBetween(now, day, store.timeZone)
  return (
    <div class="glass card">
      <CardTitle icon={<Sun size={20} />} title={tr('falak.qiblaDay')} />
      <div class="row" style={{ alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
        <span class="display mono" style={{ fontSize: '44px', fontWeight: 700 }}>{days <= 0 ? tr('common.today') : days}</span>
        {days > 0 && <span class="headline" style={{ opacity: 0.85 }}>{tr('falak.daysToGo', { n: days }).replace(String(days), '').trim()}</span>}
      </div>
      <div class="subhead" style={{ fontWeight: 600 }}>{tr('falak.dateAtYourTime', { date: longDate(day), time: store.formatted(day) })}</div>
      <p class="footnote" style={{ opacity: 0.85 }}>{tr('falak.qiblaDayExplain')}</p>
      {sun.altitude > 3
        ? <div class="footnote icon-line"><CheckCircle2 size={16} />{tr('falak.qiblaDayVisible', { deg: Math.round(sun.altitude) })}</div>
        : <div class="footnote icon-line"><Moon size={16} />{tr('falak.qiblaDayDown')}</div>}
    </div>
  )
}

function RashdulCard({ place, now }: { place: Place; now: number }) {
  const [y, m, d] = ymd(now)
  const today = Falak.rashdulQiblat(y, m, d, store.timeZone, place.coordinates)
  let next: Falak.Alignment | null = null
  if (!today.length) {
    for (let off = 1; off <= 60 && !next; off++) {
      const [yy, mm, dd] = ymd(noonDaysAfter(now, off, store.timeZone))
      next = Falak.rashdulQiblat(yy, mm, dd, store.timeZone, place.coordinates)[0] ?? null
    }
  }
  return (
    <div class="glass card">
      <CardTitle icon={<Sparkles size={20} />} title={tr('falak.rashdulToday')} />
      <p class="footnote" style={{ opacity: 0.85 }}>{tr('falak.rashdulExplain')}</p>
      {today.length === 0 ? (
        <div class="subhead" style={{ fontWeight: 600 }}>
          {next ? tr('falak.rashdulNone', { date: longDate(next.time), time: store.formatted(next.time) })
            : tr('falak.rashdulNever')}
        </div>
      ) : (
        <>
          {today.map((a) => (
            <div style={{ opacity: a.time < now ? 0.6 : 1, marginBottom: '10px' }}>
              <div class="row" style={{ gap: '8px' }}>
                <span class="display mono" style={{ fontSize: '24px', fontWeight: 700 }}>{store.formatted(a.time)}</span>
                {a.time < now && <span class="caption" style={{ fontWeight: 600, opacity: 0.6 }}>{tr('falak.passed')}</span>}
                <span class="spacer" />
                <span class="caption" style={{ opacity: 0.75 }}>{tr('falak.degUp', { deg: Math.round(a.altitude) })}</span>
              </div>
              <div class="footnote">{Falak.shadowNote(a.kind)}</div>
            </div>
          ))}
          <div class="caption" style={{ opacity: 0.7 }}>{tr('falak.rashdulGood')}</div>
        </>
      )}
    </div>
  )
}

function cm(v: number) { return Number.isFinite(v) ? `${v.toFixed(1)} cm` : '-' }

function ShadowStickCard({ place, now }: { place: Place; now: number }) {
  const [height, setHeightState] = useState(() => parseFloat(readString('falak.stickHeight') ?? '100') || 100)
  const setHeight = (v: number) => { setHeightState(v); writeString('falak.stickHeight', String(v)) }
  const [shadow, setShadow] = useState<number | null>(null)
  const [measured, setMeasured] = useState<number | null>(null)
  const at = measured ?? now
  const [y, m, d] = ymd(at)
  const plan = Falak.shadowDay(y, m, d, place.coordinates)
  const school = store.asrSchool
  const official = store.day(at)
  const z = zoned(at, store.timeZone)
  const timeValue = `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`
  const r = shadow != null ? Falak.reading(height, shadow, at, place.coordinates, store.timeZone, school) : null
  const dhuhrName = store.name('dhuhr')
  return (
    <div class="glass card">
      <CardTitle icon={<Ruler size={20} />} title={tr('falak.stickTitle')} />
      <p class="footnote" style={{ opacity: 0.85 }}>{tr('falak.stickHow')}</p>
      <label class="field-row"><span>{tr('falak.stickHeight')}</span>
        <input type="number" inputMode="decimal" min="1" step="0.5" value={height} onInput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); if (v > 0) setHeight(v) }} /> <span class="unit">cm</span></label>
      <div class="subhead" style={{ fontWeight: 600, marginTop: '10px' }}>{tr('falak.forStick')}</div>
      <PlanRow label={tr('falak.zawal')} time={store.formatted(plan.noon)} detail={tr('falak.pointing', { length: cm(Falak.noonShadow(plan, height)), point: compassPoint(plan.noonShadowBearing) })} />
      {plan.asrShafii != null && <PlanRow label={tr('falak.asrShafii')} time={store.formatted(plan.asrShafii)} detail={cm(Falak.asrShadow(plan, height, 'standard'))} />}
      {plan.asrHanafi != null && <PlanRow label={tr('falak.asrHanafi')} time={store.formatted(plan.asrHanafi)} detail={cm(Falak.asrShadow(plan, height, 'hanafi'))} />}
      <p class="caption" style={{ opacity: 0.75 }}>{tr('falak.zawalExplain', { name: dhuhrName })}</p>
      {official && <p class="caption" style={{ opacity: 0.75 }}>{tr('falak.yourTimetable', { name: dhuhrName, dhuhr: store.formatted(official.times.dhuhr), asr: store.formatted(official.times.asr) })}</p>}
      <hr />
      <div class="subhead" style={{ fontWeight: 600 }}>{tr('falak.checkReading')}</div>
      <label class="field-row"><span>{tr('falak.shadowLength')}</span>
        <input type="number" inputMode="decimal" min="0" step="0.5" placeholder="cm" value={shadow ?? ''} onInput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); setShadow(v > 0 ? v : null) }} /> <span class="unit">cm</span></label>
      <label class="field-row"><span>{tr('falak.measuredAt')}</span>
        <input type="time" value={timeValue} onInput={(e) => {
          const [hh, mm] = (e.target as HTMLInputElement).value.split(':').map(Number)
          if (!Number.isNaN(hh)) setMeasured(zonedTime(z.year, z.month, z.day, hh, mm || 0, 0, store.timeZone))
        }} />
        <button class="plain-btn" style={{ padding: '6px 12px' }} onClick={() => setMeasured(null)}>{tr('common.now')}</button></label>
      {r && shadow != null && <ReadingResult r={r} plan={plan} height={height} />}
    </div>
  )
}

function PlanRow({ label, time, detail }: { label: string; time: string; detail: string }) {
  return (
    <div class="plan-row">
      <div><div class="footnote">{label}</div><div class="caption" style={{ opacity: 0.75 }}>{detail}</div></div>
      <span class="subhead mono" style={{ fontWeight: 600 }}>{time}</span>
    </div>
  )
}

function ReadingResult({ r, plan, height }: { r: Falak.Reading; plan: Falak.ShadowDay; height: number }) {
  const school = store.asrSchool
  const schoolName = school === 'hanafi' ? tr('settings.hanafi') : tr('settings.shafii')
  const off = r.offsetMinutes, pm = r.uncertaintyMinutes
  return (
    <div class="reading">
      <span class="chip"><SunDim size={14} />{tr('falak.gradeObservation')}</span>
      <div class="subhead" style={{ fontWeight: 600 }}>{tr('falak.sunByShadow', { deg: r.altitude.toLocaleString(appLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })}</div>
      {r.sunTime != null && off != null && pm != null ? (
        <>
          <div class="footnote">{tr('falak.sunTime', { time: store.formatted(r.sunTime), n: Math.ceil(pm), result: Math.abs(off) <= pm ? tr('falak.matches') : off > 0 ? tr('falak.ahead', { time: minutesText(off) }) : tr('falak.behind', { time: minutesText(off) }) })}</div>
          {Math.abs(off) > pm && <div class="caption" style={{ opacity: 0.75 }}>{tr('falak.usualCauses')}</div>}
        </>
      ) : <div class="footnote">{tr('falak.tooLow')}</div>}
      {r.asrReached != null
        ? <div class="footnote" style={{ fontWeight: 600 }}>{r.asrReached ? tr('falak.asrBegun', { school: schoolName, length: cm(Falak.asrShadow(plan, height, school)) }) : tr('falak.asrNotBegun', { school: schoolName, length: cm(Falak.asrShadow(plan, height, school)) })}</div>
        : <div class="footnote" style={{ fontWeight: 600 }}>{tr('falak.morning', { name: store.name('dhuhr') })}</div>}
    </div>
  )
}

function SkySignsCard({ now }: { now: number }) {
  const day = store.day(now)
  const sign = (p: Prayer, icon: preact.ComponentChildren, text: string) => (
    <div class="sign">
      <span class="sign-icon">{icon}</span>
      <div style={{ flex: 1 }}>
        <div class="row"><span class="subhead" style={{ fontWeight: 600 }}>{store.name(p)}</span><span class="spacer" />{day && <span class="caption" style={{ opacity: 0.75 }}>{tr('falak.todayAt', { time: store.formatted(day.times[p]) })}</span>}</div>
        <div class="footnote" style={{ opacity: 0.9 }}>{text}</div>
      </div>
    </div>
  )
  return (
    <div class="glass card">
      <CardTitle icon={<Sparkles size={20} />} title={tr('falak.skySigns')} />
      <p class="footnote" style={{ opacity: 0.85 }}>{tr('falak.skyIntro')}</p>
      {sign('maghrib', <Sunset size={22} />, tr('falak.signMaghrib'))}
      {sign('isha', <MoonStar size={22} />, tr('falak.signIsha'))}
      {sign('fajr', <Sunrise size={22} />, tr('falak.signFajr'))}
    </div>
  )
}
