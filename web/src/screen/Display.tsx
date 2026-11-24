import { useEffect, useRef, useState } from 'preact/hooks'
import { rowFor } from '../services/officialTables'
import { PRAYERS, type Prayer } from '../core/prayer'
import { formatHijriDate } from '../core/hijri'
import { HeroDial, SunPath, type DialMark } from '../ui/Dials'
import { LivingSky } from '../ui/LivingSky'
import { skyAt } from '../ui/sky'
import type { ScreenConfig } from './config'
import { clockParts, gregorianDate, name, phaseAt, screenDay, WORDS } from './model'
import { LayoutDisplay } from './Layouts'
import { Brand, FridayLine, Hero, lengthClass, Notice, QrCard, RamadanRibbon, Time } from './parts'

/**
 * The masjid screen. Sizes are in viewport units so the same layout reads from
 * the back of the hall on any TV (about 25 mm of letter per 10 m of distance:
 * on a 55" TV the countdown is ~15 cm tall, the times ~6 cm).
 */
export function Display({ config: c, now, arabicTurn = false }: { config: ScreenConfig; now: number; arabicTurn?: boolean }) {
  const w = WORDS[c.lang]
  if (!c.place) return <div class="scr scr-empty"><p>{w.noPlace}</p></div>
  if (c.layout !== 'full') return <LayoutDisplay config={c} now={now} arabicTurn={arabicTurn} />
  const tz = c.place.tz
  const phase = phaseAt(now, c, rowFor)
  if (!phase) return null
  const sd = phase.day
  const arabic = c.arabic && arabicTurn
  const label = (p: Prayer) => name(p, c.names, sd.friday, arabic)
  const tint = phase.kind === 'waiting' ? phase.next : phase.prayer
  const hijriStyle = c.names === 'malay' || c.names === 'indonesian' ? c.names : 'arabic'
  // The app's Living Sky: the sky outside the masjid, right now.
  const today = screenDay(now, c, rowFor)!
  const isToday = sd === today || sd.day.day === today.day.day
  // One prayer is highlighted: the one people are waiting for (or the one being called now).
  const focus: Prayer = phase.kind === 'waiting' ? phase.next : phase.prayer
  const hide = c.hide
  // Everything but the name and the prayertimes.asia line turned off: the footer tucks in under the name.
  const tucked = hide.date && hide.hijri && hide.clock && hide.times && hide.countdown
  const extra = `${hide.times ? ' scr-no-times' : ''}${hide.clock ? ' scr-no-clock' : ''}${tucked ? ' scr-tucked' : ''}`

  return (
    <div class={`scr scr-${phase.kind} scr-look-${c.look} scr-${c.mode}${extra}`} style={{ '--tint': `var(--t-${tint})` }}>
      {c.look !== 'bands' && c.look !== 'simple' && c.look !== 'surau' && <LivingSky colors={skyAt(now, today.day)} scheme={c.mode} soft={false} />}
      {c.mode === 'dark' && c.look !== 'bands' && c.look !== 'simple' && c.look !== 'surau' && <div class="scr-shade" aria-hidden="true" />}
      <header class="scr-head">
        <div class="scr-title">
          <h1 class={lengthClass(c.name || c.place.name, 28, 48)}>{c.name || c.place.name}</h1>
          {c.name && <p>{c.place.name}</p>}
        </div>
        {!(hide.date && hide.hijri) && (
          <p class={`scr-date${hide.date ? ' only-hijri' : ''}`}>
            {!hide.date && gregorianDate(now, tz, c.lang)}{!hide.date && !hide.hijri && <br />}{!hide.hijri && formatHijriDate(today.hijri, hijriStyle)}
          </p>
        )}
      </header>

      {c.look === 'dial' && !hide.times && <Dial sd={sd} now={now} config={c} label={label} focus={focus} isToday={isToday} />}

      <Hero phase={phase} now={now} config={c} label={label} />

      {c.look === 'sunpath' && !hide.times && (
        <section class="scr-sun" aria-hidden="true"><SunPath width={1600} height={240} now={now} day={sd.day} tz={tz} /></section>
      )}

      {!hide.times && <ol class={`scr-grid${c.showIqamah ? '' : ' no-iq'}`}>
        {sd.imsak != null && (
          <li class={`scr-cell scr-imsak${isToday && sd.imsak <= now ? ' passed' : ''}`}>
            <span class="scr-name">{w.imsak}</span>
            <Time ms={sd.imsak} tz={tz} h24={c.h24} />
          </li>
        )}
        {PRAYERS.map((p) => {
          const on = p === focus
          const iq = p === 'sunrise' || !c.showIqamah ? undefined : sd.iqamah[p]
          const sub = p === 'maghrib' && sd.ramadan ? w.iftar : null
          const passed = isToday && !on && sd.day.times[p] <= now
          return (
            <li key={p} class={`scr-cell p-${p}${on ? ' on' : ''}${passed ? ' passed' : ''}${p === 'sunrise' ? ' scr-syuruk' : ''}`} style={{ '--tint': `var(--t-${p})` }}>
              <i class="scr-bar" />
              <span class="scr-name">{label(p)}{sub && <em><i class="scr-dotsep"> · </i>{sub}</em>}</span>
              <Time ms={sd.day.times[p]} tz={tz} h24={c.h24} />
              {c.showIqamah && <span class="scr-iq">{iq != null ? <>{p === 'dhuhr' && sd.friday && c.jumuah ? w.khutbah : w.iqamah} <Time ms={iq} tz={tz} h24={c.h24} small /></> : ' '}</span>}
            </li>
          )
        })}
      </ol>}

      <RamadanRibbon sd={today} now={now} config={c} />
      <FridayLine now={now} config={c} />

      <footer class={`scr-foot${c.showQr ? ' with-qr' : ''}`}>
        {c.showQr && <QrCard config={c} caption={w.scan} />}
        <Notice notices={today.raya && (today.eid == null || now < today.eid) ? [w.takbir, ...c.notices] : c.notices} now={now} />
        <Brand config={c} sd={sd} />
      </footer>

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

/**
 * The app's Day Dial: the day as a ring in the sky's colours, each azan and iqamah at its hour.
 * Drawn at 600 px and scaled to the screen (--ds), since the dial lays its labels out in pixels.
 */
function Dial({ sd, now, config: c, label, focus, isToday }: {
  sd: NonNullable<ReturnType<typeof screenDay>>; now: number; config: ScreenConfig; label: (p: Prayer) => string
  focus: Prayer; isToday: boolean
}) {
  const w = WORDS[c.lang]
  const tz = c.place!.tz
  const nextFajr = screenDay(sd.day.times.dhuhr + 86_400_000, c, rowFor)?.day.times.fajr ?? sd.day.times.fajr + 86_400_000
  const marks: DialMark[] = PRAYERS.map((p) => ({ id: p, date: sd.day.times[p], extraLine: c.showIqamah && p !== 'sunrise' && sd.iqamah[p] != null, tint: `var(--t-${p})` }))
  if (sd.imsak != null) marks.push({ id: 'imsak', date: sd.imsak, minor: true })
  // The dial is drawn at a fixed size: shrink it to the room left by a long name, notice or the Ramadan line.
  const slot = useRef<HTMLElement>(null)
  const [fit, setFit] = useState(0)
  useEffect(() => {
    const el = slot.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setFit(el.clientHeight / 600))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <section class="scr-dialslot" ref={slot}>
    <div class="scr-dialbox" style={fit > 0 ? { '--fit': String(fit) } : undefined}>
      <HeroDial size={600} now={now} day={sd.day} nextFajr={nextFajr} tz={tz} currentPrayer={isToday ? focus : null} marks={marks}
        label={(m) => {
          if (m.id === 'imsak') return <div class="scr-dm minor"><span class="scr-dm-name">{w.imsak}</span><Time ms={m.date} tz={tz} h24={c.h24} small /></div>
          const p = m.id as Prayer
          const on = p === focus
          const iq = p === 'sunrise' || !c.showIqamah ? undefined : sd.iqamah[p]
          const passed = isToday && !on && m.date <= now
          return (
            <div class={`scr-dm${on ? ' on' : ''}${passed ? ' passed' : ''}`} style={{ '--tint': `var(--t-${p})` }}>
              <span class="scr-dm-name">{label(p)}</span>
              <Time ms={m.date} tz={tz} h24={c.h24} />
              {iq != null && <span class="scr-dm-iq">{p === 'dhuhr' && sd.friday && c.jumuah ? w.khutbah : w.iqamah} <Time ms={iq} tz={tz} h24={c.h24} small /></span>}
            </div>
          )
        }}
        centre={() => <div class="scr-dial-centre" style={{ '--tint': `var(--t-${focus})` }}><span>{w.next}</span><b>{label(focus)}</b></div>} />
    </div>
    </section>
  )
}

