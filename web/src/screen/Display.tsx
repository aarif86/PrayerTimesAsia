import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import qrcode from 'qrcode-generator'
import { rowFor } from '../services/officialTables'
import { PRAYERS, type Prayer } from '../core/prayer'
import { formatHijriDate } from '../core/hijri'
import { HeroDial, SunPath, type DialMark } from '../ui/Dials'
import { LivingSky } from '../ui/LivingSky'
import { skyAt } from '../ui/sky'
import { masjidAppLink, type ScreenConfig } from './config'
import { zoned } from '../core/tz'
import { clockParts, countdown, inFridayWindow, gregorianDate, kaabaMomentToday, name, nextOccasion, occasionName, phaseAt, screenDay, shortLeft, WORDS, type Phase } from './model'

/**
 * The masjid screen. Sizes are in viewport units so the same layout reads from
 * the back of the hall on any TV (about 25 mm of letter per 10 m of distance:
 * on a 55" TV the countdown is ~15 cm tall, the times ~6 cm).
 */
export function Display({ config: c, now, arabicTurn = false }: { config: ScreenConfig; now: number; arabicTurn?: boolean }) {
  const w = WORDS[c.lang]
  if (!c.place) return <div class="scr scr-empty"><p>{w.noPlace}</p></div>
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
      {c.look !== 'bands' && c.look !== 'simple' && <LivingSky colors={skyAt(now, today.day)} scheme={c.mode} soft={false} />}
      {c.mode === 'dark' && c.look !== 'bands' && c.look !== 'simple' && <div class="scr-shade" aria-hidden="true" />}
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
        <p class="scr-brand">
          {!hide.source && <span class="scr-pill"><b class={`scr-grade g-${sd.day.grade}`}>{sd.day.grade}</b>{sd.source}</span>}
          <span><b>prayertimes.asia</b></span>
        </p>
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

function QrCard({ config: c, caption }: { config: ScreenConfig; caption: string }) {
  const link = masjidAppLink(c)
  const svg = useMemo(() => {
    if (!link) return ''
    const qr = qrcode(0, 'L')
    qr.addData(link)
    qr.make()
    return qr.createSvgTag({ scalable: true, margin: 2 })
  }, [link])
  if (!svg) return null
  return (
    <figure class="scr-qr">
      <div class="scr-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>{caption}</figcaption>
    </figure>
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

/**
 * The one thing that moves each second. Waiting: the clock (seconds small) and the next prayer,
 * whose "in 40m" changes only once a minute. After the azan: the iqamah countdown takes over,
 * and the clock steps down to hours and minutes.
 */
function Hero({ phase, now, config: c, label }: { phase: Phase; now: number; config: ScreenConfig; label: (p: Prayer) => string }) {
  const w = WORDS[c.lang]
  const tz = c.place!.tz
  const clock = clockParts(now, tz, c.h24)
  if (phase.kind === 'azan') {
    const jumuah = phase.prayer === 'dhuhr' && phase.day.friday && !!c.jumuah
    const left = phase.iqamah == null ? 0 : phase.iqamah - now
    return (
      <section class={`scr-hero${phase.iqamah != null && left <= 60_000 ? ' scr-final' : ''}`}>
        <p class="scr-kicker">{w.azan} {label(phase.prayer)}{phase.iqamah != null && <> · {jumuah ? w.khutbahIn : w.iqamahIn}</>}</p>
        <p class="scr-big">{phase.iqamah != null ? countdown(left) : label(phase.prayer)}</p>
        <p class="scr-line">{!c.hide.clock && <><span class="scr-now">{clock.time}{clock.suffix && <small>{clock.suffix}</small>}</span> · </>}{w.silence}</p>
      </section>
    )
  }
  if (phase.kind === 'prayer') return <section class="scr-hero" />
  const eid = phase.day.eid
  if (eid != null && now < eid && eid <= phase.at) {
    const sec = String(Math.floor(now / 1000) % 60).padStart(2, '0')
    return (
      <section class="scr-hero">
        {!c.hide.clock && <p class="scr-big scr-clockbig">{clock.time}<span class="scr-sec">{sec}</span>{clock.suffix && <small>{clock.suffix}</small>}</p>}
        <p class="scr-next" style={{ '--tint': 'var(--t-sunrise)' }}>
          <span class="scr-next-name">{w.eid}</span>
          {!c.hide.countdown && <span class="scr-in">{w.inTag(shortLeft(eid - now))}</span>}
        </p>
      </section>
    )
  }
  const next = phase.next
  const sec = String(Math.floor(now / 1000) % 60).padStart(2, '0')
  return (
    <section class="scr-hero">
      {!c.hide.clock && <p class="scr-big scr-clockbig">{clock.time}<span class="scr-sec">{sec}</span>{clock.suffix && <small>{clock.suffix}</small>}</p>}
      <p class="scr-next" style={{ '--tint': `var(--t-${next})` }}>
        <span class="scr-next-name">{next === 'sunrise' ? w.ends(label('fajr')) : label(next)}</span>
        {!c.hide.countdown && <span class="scr-in">{w.inTag(shortLeft(phase.at - now))}</span>}
      </p>
    </section>
  )
}

/** Ramadan nights and Raya morning, in one line under the times. */
function RamadanRibbon({ sd, now, config: c }: { sd: NonNullable<ReturnType<typeof screenDay>>; now: number; config: ScreenConfig }) {
  const w = WORDS[c.lang]
  const tz = c.place!.tz
  const parts: preact.ComponentChildren[] = []
  if (sd.raya) {
    parts.push(<b>{w.raya}</b>)
    if (sd.eid != null) parts.push(<span>{w.eid} <Time ms={sd.eid} tz={tz} h24={c.h24} small /></span>)
  } else {
    if (sd.ramadan) parts.push(<b>{w.ramadanDay(sd.hijri.day)}</b>)
    if (sd.tarawih) parts.push(<span>{w.tarawih} {sd.tarawih.at != null ? <Time ms={sd.tarawih.at} tz={tz} h24={c.h24} small /> : w.afterIsha}</span>)
    if (sd.qiyam != null && now < sd.qiyam + 3_600_000) parts.push(<span>{w.qiyam} <Time ms={sd.qiyam} tz={tz} h24={c.h24} small /></span>)
    else if (sd.tarawih && sd.hijri.month === 9 && sd.hijri.day >= 20) parts.push(<span>{w.lastTen}</span>)
  }
  const occasion = c.hide.occasion ? null : nextOccasion(now, c)
  // 1 Ramadan and Eid morning already have their own words above.
  if (occasion && !(occasion.days === 0 && (occasion.id === 'ramadan' || occasion.id === 'aidilfitri'))) {
    const text = w.occasion(occasionName(occasion.id, c), occasion.days)
    parts.push(occasion.days === 0 ? <b class="scr-occasion">{text}</b> : <span class="scr-occasion">{text}</span>)
  }
  // Shown to the nearest minute (17:17:59 reads 5:18, as published).
  const kaaba = c.hide.kaaba ? null : kaabaMomentToday(now, c)
  if (kaaba != null) parts.push(<span class="scr-kaaba"><b>{w.kaaba}</b> {w.kaabaAt} <Time ms={Math.round(kaaba / 60_000) * 60_000} tz={tz} h24={c.h24} small />, {w.kaabaHint}</span>)
  if (!parts.length) return null
  return <p class="scr-ramadan">{parts.map((x, i) => <>{i > 0 && <i class="scr-dotsep">·</i>}{x}</>)}</p>
}

/** The committee's Friday line, from Thursday Maghrib until an hour and a half after Friday Zohor. */
function FridayLine({ now, config: c }: { now: number; config: ScreenConfig }) {
  if (!c.fridayNote || !c.place) return null
  const today = screenDay(now, c, rowFor)
  if (!today) return null
  if (!inFridayWindow(zoned(now, c.place.tz).weekday, now, today.day.times.maghrib, today.day.times.dhuhr)) return null
  return <p class="scr-ramadan scr-friday"><b>{WORDS[c.lang].friday}</b><i class="scr-dotsep">·</i><span>{c.fridayNote}</span></p>
}

function Time({ ms, tz, h24, small = false }: { ms: number; tz: string; h24: boolean; small?: boolean }) {
  const t = clockParts(ms, tz, h24)
  return <span class={small ? 'scr-t scr-t-small' : 'scr-t'}>{t.time}{t.suffix && <small>{t.suffix}</small>}</span>
}

/** One notice at a time, changing every 12 seconds (boards page; they don't scroll). */
function Notice({ notices, now }: { notices: string[]; now: number }) {
  if (!notices.length) return <p class="scr-notice" />
  const i = Math.floor(now / 12_000) % notices.length
  return (
    <p class={`scr-notice ${lengthClass(notices[i], 70, 115)}`} key={i}>
      {notices[i]}
      {notices.length > 1 && <span class="scr-dots">{notices.map((_, j) => <i key={j} class={j === i ? 'on' : ''} />)}</span>}
    </p>
  )
}

/** Long masjid names and notices step down a size so they fit in two lines instead of being cut off. */
function lengthClass(text: string, long: number, xlong: number): string {
  return text.length > xlong ? 'xlong' : text.length > long ? 'long' : ''
}
