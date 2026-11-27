import { useContext, useState } from 'preact/hooks'
import { rowFor } from '../services/officialTables'
import { PRAYERS, type Prayer } from '../core/prayer'
import { formatHijriDate } from '../core/hijri'
import { SunPath } from '../ui/Dials'
import { LivingSky } from '../ui/LivingSky'
import { skyAt } from '../ui/sky'
import { startOfDay } from '../core/tz'
import { LAYOUTS_WITH_NOTICE_BAR, LAYOUTS_WITH_SLIDES, SLIDE_SECONDS, type ScreenConfig, type ScreenLayout, type ScreenSlide } from './config'
import { FrameShape } from './Frame'
import { clockParts, gregorianDate, name, phaseAt, screenDay, WORDS, type ScreenDay } from './model'
import { Brand, FridayLine, Hero, lengthClass, Notice, QrCard, RamadanRibbon, Time } from './parts'

/**
 * The layout that really shows. The portrait layouts turn into their wide cousins on a wide screen, and the wide ones
 * into the portrait ones on a tall screen, so a TV turned on its side still reads well.
 */
export function effectiveLayout(layout: ScreenLayout, portrait: boolean): ScreenLayout {
  if (layout === 'full') return 'full'
  if (portrait) return layout === 'big' || layout === 'portT' ? layout : 'port'
  if (layout === 'port') return 'splitN'
  if (layout === 'portT') return 'split'
  return layout
}

/** One thing in the slide area. */
type Item =
  | { kind: 'slide'; slide: ScreenSlide }
  | { kind: 'notice'; text: string }
  | { kind: 'qr' }
  | { kind: 'welcome' }

/** What the slide area shows, in order: the committee's slides, notices where there is no notice bar, and the QR code. */
export function stageItems(c: ScreenConfig, layout: ScreenLayout, takbir: string | null): Item[] {
  const items: Item[] = []
  if (layout === 'big') {
    if (takbir) items.push({ kind: 'notice', text: takbir })
    for (const n of c.notices) items.push({ kind: 'notice', text: n })
  } else {
    for (const s of c.slides) items.push({ kind: 'slide', slide: s })
    if (!LAYOUTS_WITH_NOTICE_BAR.includes(layout)) for (const n of c.notices) items.push({ kind: 'notice', text: n })
  }
  if (c.showQr && c.place && LAYOUTS_WITH_SLIDES.includes(layout)) items.push({ kind: 'qr' })
  if (!items.length) items.push({ kind: 'welcome' })
  return items
}

/**
 * The masjid screen when it is shared between the times and the slides (every layout but Full clock).
 * One hero clock, a thin line to the next prayer, the times as a plain list, and a floating card for slides.
 */
export function LayoutDisplay({ config: c, now, arabicTurn = false }: { config: ScreenConfig; now: number; arabicTurn?: boolean }) {
  const { portrait } = useContext(FrameShape)
  const layout = effectiveLayout(c.layout, portrait)
  const w = WORDS[c.lang]
  const tz = c.place!.tz
  const phase = phaseAt(now, c, rowFor)
  if (!phase) return null
  const sd = phase.day
  const today = screenDay(now, c, rowFor)!
  const isToday = sd === today || sd.day.day === today.day.day
  const arabic = c.arabic && arabicTurn
  const label = (p: Prayer) => name(p, c.names, sd.friday, arabic)
  const focus: Prayer = phase.kind === 'waiting' ? phase.next : phase.prayer
  const tint = phase.kind === 'waiting' ? phase.next : phase.prayer
  const hide = c.hide
  const hijriStyle = c.names === 'malay' || c.names === 'indonesian' ? c.names : 'arabic'
  const sky = c.look === 'dial' || c.look === 'sunpath'
  const hasBar = LAYOUTS_WITH_NOTICE_BAR.includes(layout)
  const takbir = today.raya && (today.eid == null || now < today.eid) ? w.takbir : null
  const items = stageItems(c, layout, layout === 'big' ? takbir : null)
  const barNotices = takbir ? [takbir, ...c.notices] : c.notices
  const showTimes = !hide.times
  const rowStyle = layout === 'strip' ? 'strip' : 'list'

  const head = (
    <header class="lay-head">
      <div class="lay-title">
        <h1 class={lengthClass(c.name || c.place!.name, 24, 40)}>{c.name || c.place!.name}</h1>
        {c.name && <p>{c.place!.name}</p>}
      </div>
      {!(hide.date && hide.hijri) && (
        <p class={`lay-date${hide.date ? ' only-hijri' : ''}`}>
          {!hide.date && gregorianDate(now, tz, c.lang)}{!hide.date && !hide.hijri && <br />}{!hide.hijri && formatHijriDate(today.hijri, hijriStyle)}
        </p>
      )}
    </header>
  )
  const hero = (
    <div class="lay-hero">
      {(c.look === 'dial' || c.look === 'surau') && showTimes && <DayRing sd={sd} now={now} tz={tz} gold={c.look === 'surau'} />}
      <Hero phase={phase} now={now} config={c} label={label} progress />
    </div>
  )
  const times = showTimes && <TimesList sd={sd} now={now} config={c} label={label} focus={focus} isToday={isToday} variant={rowStyle} />
  const sun = c.look === 'sunpath' && showTimes && layout !== 'strip' && layout !== 'big' && (
    <div class="lay-sun" aria-hidden="true"><SunPath width={1000} height={150} now={now} day={sd.day} tz={tz} /></div>
  )
  const stage = <Stage items={items} now={now} config={c} big={layout === 'big'} />
  const bar = hasBar && <NoticeBar notices={barNotices} now={now} />
  const ribbons = <><RamadanRibbon sd={today} now={now} config={c} /><FridayLine now={now} config={c} /></>
  const foot = (
    <footer class="lay-foot">
      <Brand config={c} sd={sd} />
      {c.showQr && !LAYOUTS_WITH_SLIDES.includes(layout) && <QrCard config={c} caption={w.scan} />}
    </footer>
  )

  return (
    <div class={`scr lay lay-${layout} lay-look-${c.look} scr-${phase.kind} scr-${c.mode}${hide.clock ? ' scr-no-clock' : ''}`} style={{ '--tint': `var(--t-${tint})` }}>
      {sky && <LivingSky colors={skyAt(now, today.day)} scheme={c.mode} soft={false} />}
      {sky && c.mode === 'dark' && <div class="scr-shade" aria-hidden="true" />}
      {head}
      <div class="lay-left">{hero}{sun}{ribbons}{times}</div>
      <div class="lay-right">{stage}</div>
      {bar}
      {foot}
      {phase.kind === 'prayer' && (
        <div class="scr-dim" role="status">
          <p>{label(phase.prayer)}</p>
          <h2>{w.inPrayer}</h2>
          {!hide.clock && <p class="scr-dim-clock">{clockParts(now, tz, c.h24).time}</p>}
        </div>
      )}
    </div>
  )
}

/** The day's times as a plain list (or one row in the strip layout): name, time, and the iqamah when asked for. */
function TimesList({ sd, now, config: c, label, focus, isToday, variant }: {
  sd: ScreenDay; now: number; config: ScreenConfig; label: (p: Prayer) => string; focus: Prayer; isToday: boolean; variant: 'list' | 'strip'
}) {
  const w = WORDS[c.lang]
  const tz = c.place!.tz
  return (
    <ol class={`lay-times ${variant}${c.showIqamah ? '' : ' no-iq'}`}>
      {sd.imsak != null && (
        <li class={`lay-row lay-imsak${isToday && sd.imsak <= now ? ' passed' : ''}`}>
          <span class="scr-name">{w.imsak}</span><Time ms={sd.imsak} tz={tz} h24={c.h24} />
        </li>
      )}
      {PRAYERS.map((p) => {
        const on = p === focus
        const iq = p === 'sunrise' || !c.showIqamah ? undefined : sd.iqamah[p]
        const sub = p === 'maghrib' && sd.ramadan ? w.iftar : null
        const passed = isToday && !on && sd.day.times[p] <= now
        return (
          <li key={p} class={`lay-row p-${p}${on ? ' on' : ''}${passed ? ' passed' : ''}${p === 'sunrise' ? ' lay-syuruk' : ''}`} style={{ '--tint': `var(--t-${p})` }}>
            <span class="scr-name">{label(p)}{sub && <em> · {sub}</em>}</span>
            <Time ms={sd.day.times[p]} tz={tz} h24={c.h24} />
            {iq != null && <span class="scr-iq">{p === 'dhuhr' && sd.friday && c.jumuah ? w.khutbah : w.iqamah} <Time ms={iq} tz={tz} h24={c.h24} small /></span>}
          </li>
        )
      })}
    </ol>
  )
}

/** The Day Dial look, fitted: the day as a ring (midnight at the top) with each prayer at its hour and a dot for now. */
function DayRing({ sd, now, tz, gold }: { sd: ScreenDay; now: number; tz: string; gold: boolean }) {
  // The app's dial, small: noon at the top, midnight at the bottom, a white dot for now.
  const midnight = startOfDay(sd.day.times.dhuhr, tz)
  const angle = Math.min(359.5, Math.max(0.5, ((now - midnight) / 86_400_000) * 360)) + 180
  const pt = (deg: number): [number, number] => [60 + 50 * Math.sin((deg * Math.PI) / 180), 60 - 50 * Math.cos((deg * Math.PI) / 180)]
  const [nx, ny] = pt(angle)
  const [bx, by] = pt(180)
  return (
    <svg class={`lay-ring${gold ? ' gold' : ''}`} viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="lay-ring-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7b64a" /><stop offset="0.5" stop-color="#e8743c" /><stop offset="1" stop-color="#6a4fb8" /></linearGradient></defs>
      {gold ? (
        <>
          <circle cx="60" cy="60" r="50" class="ring-track" />
          <path d={`M${bx} ${by}A50 50 0 ${angle - 180 > 180 ? 1 : 0} 1 ${nx.toFixed(2)} ${ny.toFixed(2)}`} class="ring-gold" />
          <circle cx={nx} cy={ny} r="4.2" class="ring-now gold" />
        </>
      ) : (
        <>
          <circle cx="60" cy="60" r="50" class="ring-sky" />
          <circle cx={nx} cy={ny} r="5" class="ring-now" />
        </>
      )}
    </svg>
  )
}

/** The slim rounded notice bar: one notice at a time. */
function NoticeBar({ notices, now }: { notices: string[]; now: number }) {
  if (!notices.length) return <div class="lay-bar empty" />
  return <div class="lay-bar"><Notice notices={notices} now={now} /></div>
}

/** The place for slides and notices: a floating card that changes every few seconds. */
function Stage({ items, now, config: c, big }: { items: Item[]; now: number; config: ScreenConfig; big: boolean }) {
  const w = WORDS[c.lang]
  const i = Math.floor(now / (SLIDE_SECONDS * 1000)) % items.length
  const it = items[i]
  // A picture that will not load (no internet, a wrong address) shows its caption card instead.
  // Forgotten after ten minutes, so a Wi-Fi drop does not hide a picture for good.
  const stamp = Math.floor(now / 600_000)
  const [broken, setBroken] = useState<Record<string, true>>({})
  const bad = (img: string) => broken[`${img}|${stamp}`]
  let body
  if (it.kind === 'slide') {
    const s = it.slide
    const pic = s.img && !bad(s.img)
    body = pic ? (
      <figure class="slide slide-pic" key={`s${i}`}>
        <img src={s.img} alt={s.title || s.text || ''} onError={() => setBroken((b) => ({ ...b, [`${s.img}|${stamp}`]: true }))} referrerpolicy="no-referrer" />
        {(s.title || s.text) && <figcaption>{s.title && <b>{s.title}</b>}{s.text && <span>{s.text}</span>}</figcaption>}
      </figure>
    ) : (
      <div class={`slide slide-card tone-${s.tone}`} key={`s${i}`}>
        {s.title && <h2 class={lengthClass(s.title, 22, 34)}>{s.title}</h2>}
        {s.text && <p class={lengthClass(s.text, 70, 110)}>{s.text}</p>}
      </div>
    )
  } else if (it.kind === 'notice') {
    body = <div class={`slide slide-card slide-notice tone-navy ${big ? 'big' : ''}`} key={`n${i}`}><p class={lengthClass(it.text, big ? 60 : 70, big ? 100 : 110)}>{it.text}</p></div>
  } else if (it.kind === 'qr') {
    body = <div class="slide slide-card slide-qr tone-light" key="qr"><QrCard config={c} caption={w.scan} /></div>
  } else {
    body = (
      <div class="slide slide-card slide-welcome tone-navy" key="w">
        <h2 class={lengthClass(c.name || c.place!.name, 22, 34)}>{c.name || c.place!.name}</h2>
        {c.showQr && c.place && !big && <QrCard config={c} caption={w.scan} />}
      </div>
    )
  }
  return (
    <div class="lay-stage">
      {body}
      {items.length > 1 && <span class="lay-dots" aria-hidden="true">{items.map((_, j) => <i key={j} class={j === i ? 'on' : ''} />)}</span>}
    </div>
  )
}
