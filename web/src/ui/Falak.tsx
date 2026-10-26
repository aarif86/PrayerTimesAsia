import { useState } from 'preact/hooks'
import {
  CheckCircle2, Hourglass, Moon, MoonStar, Ruler, ScanEye, Sparkles, Sun, SunDim, Sunrise, Sunset, TriangleAlert,
} from 'lucide-preact'
import { fix } from '../core/astro'
import * as Falak from '../core/falak'
import { compassPoint, qiblaBearing } from '../core/geo'
import type { Place } from '../core/place'
import type { Prayer } from '../core/prayer'
import { daysBetween, zoned, zonedTime } from '../core/tz'
import { readString, writeString } from '../services/storage'
import { store, useNow, useStore } from '../services/store'
import { fmtDate, openSheet } from './common'
import { TabFalak } from './icons'

const ymd = (ms: number) => { const z = zoned(ms, store.timeZone); return [z.year, z.month, z.day] as const }
const longDate = (ms: number) => fmtDate(ms, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const minutesText = (m: number) => { const r = Math.round(m); return Math.abs(r) === 1 ? `${Math.abs(r)} minute` : `${Math.abs(r)} minutes` }

/**
 * Falak Mode F1: Qibla Day, daily rashdul qiblat, the tongkat istiwa' for Zuhur
 * and Asr, and guided sky signs. Everything here is Grade F - for learning and
 * checking, never in place of the authority's times.
 */
export function FalakScreen() {
  const s = useStore()
  const now = useNow(30_000)
  const place = s.activePlace
  if (!place) return <div class="page"><p class="headline" style={{ textAlign: 'center', marginTop: '40vh' }}>Choose a place first.</p></div>
  return (
    <div class="page falak">
      <div class="falak-head">
        <div class="row" style={{ gap: '12px' }}>
          <TabFalak size={38} class="accent" />
          <h1 class="h-title">Falak</h1>
        </div>
        <p class="subhead" style={{ margin: '8px 0', opacity: 0.9 }}>Read the time and the qibla from the sun and its shadow, the way the muwaqqit did - no signal needed.</p>
        <div class="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <span class="chip"><SunDim size={15} />Grade F · Falak</span>
          <span class="chip"><Hourglass size={14} />Pending shariah review</span>
        </div>
      </div>
      <div class="tools">
        <button class="tool glass" onClick={() => openSheet({ kind: 'ar' })}>
          <ScanEye size={28} class="accent" strokeWidth={2} />
          <span class="headline">Camera</span>
          <span class="caption" style={{ opacity: 0.75 }}>AR qibla &amp; shadow</span>
        </button>
        <button class="tool glass" onClick={() => openSheet({ kind: 'level' })}>
          <LevelGlyph />
          <span class="headline">Level</span>
          <span class="caption" style={{ opacity: 0.75 }}>Ground &amp; stick</span>
        </button>
      </div>
      <SunSafety />
      <ShadowCompassCard place={place} now={now} />
      <QiblaDayCard place={place} now={now} />
      <RashdulCard place={place} now={now} />
      <ShadowStickCard place={place} now={now} />
      <SkySignsCard now={now} />
      <p class="footnote" style={{ opacity: 0.75, marginTop: '16px' }}>{Falak.REVIEW_NOTE}</p>
    </div>
  )
}

function LevelGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="accent" aria-hidden="true">
      <rect x="2" y="7.5" width="20" height="9" rx="2.5" /><rect x="9" y="10" width="6" height="4" rx="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SunSafety() {
  return (
    <div class="safety">
      <TriangleAlert size={26} style={{ color: 'var(--warning)', flex: 'none' }} />
      <div class="footnote" style={{ fontWeight: 600 }}>Never look at the sun - not briefly, not through sunglasses, binoculars or your phone's camera. Look only at the shadow on the ground.</div>
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
      <CardTitle icon={<Sun size={20} fill="currentColor" />} title="The shadow right now" />
      <div class="row" style={{ gap: '16px', marginTop: '12px' }}>
        <ShadowDial qibla={qibla} shadow={shadowBearing} altitude={sun.altitude} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sun.altitude > 0 ? (
            <>
              <div class="subhead" style={{ fontWeight: 600 }}>Sun {Math.round(sun.altitude)}° up, in the {compassPoint(sun.azimuth)}</div>
              <div class="footnote" style={{ opacity: 0.85 }}>A stick's shadow points {Math.round(shadowBearing)}° {compassPoint(shadowBearing)} and is {Falak.shadowLength(1, Math.max(sun.altitude, 0.5)).toFixed(1)}× its height.</div>
            </>
          ) : (
            <>
              <div class="subhead" style={{ fontWeight: 600 }}>The sun is below the horizon.</div>
              <div class="footnote" style={{ opacity: 0.85 }}>Shadow readings start after sunrise. See the sky signs below.</div>
            </>
          )}
          <div class="footnote gold" style={{ fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' }}>
            <QiblaMini />Qibla {Math.round(qibla)}° {compassPoint(qibla)}
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
      aria-label={`Shadow points ${Math.round(shadow)} degrees; qibla is ${Math.round(qibla)} degrees`}>
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
      <CardTitle icon={<Sun size={20} />} title="Qibla Day" />
      <div class="row" style={{ alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
        <span class="display mono" style={{ fontSize: '44px', fontWeight: 700 }}>{days <= 0 ? 'Today' : days}</span>
        {days > 0 && <span class="headline" style={{ opacity: 0.85 }}>{days === 1 ? 'day to go' : 'days to go'}</span>}
      </div>
      <div class="subhead" style={{ fontWeight: 600 }}>{longDate(day)} at {store.formatted(day)} your time</div>
      <p class="footnote" style={{ opacity: 0.85 }}>Twice a year the sun stands directly over the Ka'bah at Makkah noon (istiwa' a'zam). At that minute, every upright shadow wherever the sun is up points straight away from the Ka'bah - the most exact qibla check there is, with nothing but a stick.</p>
      {sun.altitude > 3
        ? <div class="footnote icon-line"><CheckCircle2 size={16} />Visible from here: the sun will be {Math.round(sun.altitude)}° up. Stand a straight stick upright on level ground and face from the shadow's tip to its base. The day before and after also work within about half a degree.</div>
        : <div class="footnote icon-line"><Moon size={16} />The sun is down here at that moment. Use the daily rashdul qiblat below, or the next Qibla Day.</div>}
    </div>
  )
}

function RashdulCard({ place, now }: { place: Place; now: number }) {
  const [y, m, d] = ymd(now)
  const today = Falak.rashdulQiblat(y, m, d, store.timeZone, place.coordinates)
  let next: Falak.Alignment | null = null
  if (!today.length) {
    for (let off = 1; off <= 60 && !next; off++) {
      const [yy, mm, dd] = ymd(now + off * 86_400_000)
      next = Falak.rashdulQiblat(yy, mm, dd, store.timeZone, place.coordinates)[0] ?? null
    }
  }
  return (
    <div class="glass card">
      <CardTitle icon={<Sparkles size={20} />} title="Rashdul qiblat today" />
      <p class="footnote" style={{ opacity: 0.85 }}>The moments the sun lines up with the qibla from where you are, so any upright shadow lies along the qibla line.</p>
      {today.length === 0 ? (
        <div class="subhead" style={{ fontWeight: 600 }}>
          {next ? `No alignment with the sun high enough today. Next: ${longDate(next.time)} at ${store.formatted(next.time)}.`
            : "The sun doesn't line up with the qibla from here in the coming weeks. Use the compass or Qibla Day."}
        </div>
      ) : (
        <>
          {today.map((a) => (
            <div style={{ opacity: a.time < now ? 0.6 : 1, marginBottom: '10px' }}>
              <div class="row" style={{ gap: '8px' }}>
                <span class="display mono" style={{ fontSize: '24px', fontWeight: 700 }}>{store.formatted(a.time)}</span>
                {a.time < now && <span class="caption" style={{ fontWeight: 600, opacity: 0.6 }}>passed</span>}
                <span class="spacer" />
                <span class="caption" style={{ opacity: 0.75 }}>sun {Math.round(a.altitude)}° up</span>
              </div>
              <div class="footnote">{Falak.shadowNote(a.kind)}</div>
            </div>
          ))}
          <div class="caption" style={{ opacity: 0.7 }}>Good for about ±2 minutes either side; check that the stick is truly vertical with a plumb line or a hanging string.</div>
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
      <CardTitle icon={<Ruler size={20} />} title="Tongkat istiwa' (shadow stick)" />
      <p class="footnote" style={{ opacity: 0.85 }}>Stand a straight stick upright on level ground - a pen on a table works. Measure the stick and its shadow in centimetres.</p>
      <label class="field-row"><span>Stick height</span>
        <input type="number" inputMode="decimal" min="1" step="0.5" value={height} onInput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); if (v > 0) setHeight(v) }} /> <span class="unit">cm</span></label>
      <div class="subhead" style={{ fontWeight: 600, marginTop: '10px' }}>Today, for this stick</div>
      <PlanRow label="Zawal (shortest shadow)" time={store.formatted(plan.noon)} detail={`${cm(Falak.noonShadow(plan, height))} pointing ${compassPoint(plan.noonShadowBearing)}`} />
      {plan.asrShafii != null && <PlanRow label="Asr, Shafi'i (+1× stick)" time={store.formatted(plan.asrShafii)} detail={cm(Falak.asrShadow(plan, height, 'standard'))} />}
      {plan.asrHanafi != null && <PlanRow label="Asr, Hanafi (+2× stick)" time={store.formatted(plan.asrHanafi)} detail={cm(Falak.asrShadow(plan, height, 'hanafi'))} />}
      <p class="caption" style={{ opacity: 0.75 }}>{dhuhrName} begins once the shadow stops shrinking and starts to grow. Asr begins when the shadow is the noon shadow plus the stick's height (twice it, for Hanafi).</p>
      {official && <p class="caption" style={{ opacity: 0.75 }}>Your timetable: {dhuhrName} {store.formatted(official.times.dhuhr)}, Asr {store.formatted(official.times.asr)}. Timetables add a few minutes of ihtiyat (precaution) on top of the sun's geometry.</p>}
      <hr />
      <div class="subhead" style={{ fontWeight: 600 }}>Check a reading</div>
      <label class="field-row"><span>Shadow length</span>
        <input type="number" inputMode="decimal" min="0" step="0.5" placeholder="cm" value={shadow ?? ''} onInput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); setShadow(v > 0 ? v : null) }} /> <span class="unit">cm</span></label>
      <label class="field-row"><span>Measured at</span>
        <input type="time" value={timeValue} onInput={(e) => {
          const [hh, mm] = (e.target as HTMLInputElement).value.split(':').map(Number)
          if (!Number.isNaN(hh)) setMeasured(zonedTime(z.year, z.month, z.day, hh, mm || 0, 0, store.timeZone))
        }} />
        <button class="plain-btn" style={{ padding: '6px 12px' }} onClick={() => setMeasured(null)}>Now</button></label>
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
  const schoolName = school === 'hanafi' ? 'Hanafi' : "Shafi'i"
  const off = r.offsetMinutes, pm = r.uncertaintyMinutes
  return (
    <div class="reading">
      <span class="chip"><SunDim size={14} />Grade F · your observation</span>
      <div class="subhead" style={{ fontWeight: 600 }}>The sun is {r.altitude.toFixed(1)}° up by your shadow.</div>
      {r.sunTime != null && off != null && pm != null ? (
        <>
          <div class="footnote">That puts the sun's time at {store.formatted(r.sunTime)} (±{Math.ceil(pm)} min), which {Math.abs(off) <= pm ? 'matches the clock' : off > 0 ? `is ${minutesText(off)} ahead of the clock` : `is ${minutesText(off)} behind the clock`}.</div>
          {Math.abs(off) > pm && <div class="caption" style={{ opacity: 0.75 }}>Usual causes: the stick isn't vertical, the ground isn't level, or the shadow tip was hard to see. Try again with a plumb line.</div>}
        </>
      ) : <div class="footnote">The sun never gets that low on this side of noon today. Re-measure, or check the time.</div>}
      {r.asrReached != null
        ? <div class="footnote" style={{ fontWeight: 600 }}>{r.asrReached ? `Asr (${schoolName}) has begun by your shadow: it is past ${cm(Falak.asrShadow(plan, height, school))}.` : `Asr (${schoolName}) hasn't begun by your shadow: it needs to reach ${cm(Falak.asrShadow(plan, height, school))}.`}</div>
        : <div class="footnote" style={{ fontWeight: 600 }}>Morning reading - before zawal. {store.name('dhuhr')} has not begun.</div>}
    </div>
  )
}

function SkySignsCard({ now }: { now: number }) {
  const day = store.day(now)
  const sign = (p: Prayer, icon: preact.ComponentChildren, text: string) => (
    <div class="sign">
      <span class="sign-icon">{icon}</span>
      <div style={{ flex: 1 }}>
        <div class="row"><span class="subhead" style={{ fontWeight: 600 }}>{store.name(p)}</span><span class="spacer" />{day && <span class="caption" style={{ opacity: 0.75 }}>today {store.formatted(day.times[p])}</span>}</div>
        <div class="footnote" style={{ opacity: 0.9 }}>{text}</div>
      </div>
    </div>
  )
  return (
    <div class="glass card">
      <CardTitle icon={<Sparkles size={20} />} title="Signs in the sky" />
      <p class="footnote" style={{ opacity: 0.85 }}>What the prayer times describe, so you can see them for yourself. Informational: city lights, haze and buildings hide these signs, and scholars differ on how to read dawn and twilight. Pray by your timetable.</p>
      {sign('maghrib', <Sunset size={22} />, "The whole disc of the sun has gone below the horizon - its upper edge has disappeared. Best seen over the sea or open land; behind hills or buildings it vanishes early, so don't pray by that.")}
      {sign('isha', <MoonStar size={22} />, "The red glow (shafaq ahmar) has gone from the western sky - the view of the Shafi'i, Maliki and Hanbali schools. Imam Abu Hanifah held it is the white glow that follows it. Timetables use the sun's depth below the horizon (about 17°-18°) instead.")}
      {sign('fajr', <Sunrise size={22} />, 'True dawn (fajr sadiq): a thin whiteness spreading sideways along the eastern horizon, growing steadily. Not the false dawn (fajr kazib) before it: a faint upright column of light that fades again. Researchers still debate the exact depth of the sun at true dawn, so this stays informational.')}
    </div>
  )
}
