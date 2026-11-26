import { useMemo } from 'preact/hooks'
import qrcode from 'qrcode-generator'
import { rowFor } from '../services/officialTables'
import type { Prayer } from '../core/prayer'
import { zoned } from '../core/tz'
import { masjidAppLink, type ScreenConfig } from './config'
import { clockParts, countdown, inFridayWindow, kaabaMomentToday, nextOccasion, occasionName, screenDay, shortLeft, WORDS, type Phase, type ScreenDay } from './model'

export function QrCard({ config: c, caption }: { config: ScreenConfig; caption: string }) {
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
 * The one thing that moves each second. Waiting: the clock (seconds small) and the next prayer,
 * whose "in 40m" changes only once a minute. After the azan: the iqamah countdown takes over,
 * and the clock steps down to hours and minutes.
 */
export function Hero({ phase, now, config: c, label, progress = false }: { phase: Phase; now: number; config: ScreenConfig; label: (p: Prayer) => string; progress?: boolean }) {
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
      {progress && !c.hide.countdown && <i class="scr-progress" aria-hidden="true"><b style={{ width: `${Math.round(progressOf(phase, now) * 1000) / 10}%` }} /></i>}
    </section>
  )
}

/** How far through the wait for the next prayer it is, 0 to 1 (the thin gold line under the clock). */
function progressOf(phase: Extract<Phase, { kind: 'waiting' }>, now: number): number {
  const t = phase.day.day.times
  const before = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].filter((x) => x <= now)
  const prev = before.length ? Math.max(...before) : phase.at - 6 * 3_600_000
  return Math.min(1, Math.max(0, (now - prev) / Math.max(1, phase.at - prev)))
}

/** The bottom line: where the times come from, prayertimes.asia (never hidden), and who made it (never louder than the source). */
export function Brand({ config: c, sd }: { config: ScreenConfig; sd: ScreenDay }) {
  const w = WORDS[c.lang]
  return (
    <p class="scr-brand">
      {!c.hide.source && <span class="scr-pill"><b class={`scr-grade g-${sd.day.grade}`}>{sd.day.grade}</b>{sd.source}</span>}
      <span><b>prayertimes.asia</b></span>
      <span class="scr-maker">{w.built}</span>
    </p>
  )
}

/** Ramadan nights and Raya morning, in one line under the times. */
export function RamadanRibbon({ sd, now, config: c }: { sd: NonNullable<ReturnType<typeof screenDay>>; now: number; config: ScreenConfig }) {
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
export function FridayLine({ now, config: c }: { now: number; config: ScreenConfig }) {
  if (!c.fridayNote || !c.place) return null
  const today = screenDay(now, c, rowFor)
  if (!today) return null
  if (!inFridayWindow(zoned(now, c.place.tz).weekday, now, today.day.times.maghrib, today.day.times.dhuhr)) return null
  return <p class="scr-ramadan scr-friday"><b>{WORDS[c.lang].friday}</b><i class="scr-dotsep">·</i><span>{c.fridayNote}</span></p>
}

export function Time({ ms, tz, h24, small = false }: { ms: number; tz: string; h24: boolean; small?: boolean }) {
  const t = clockParts(ms, tz, h24)
  return <span class={small ? 'scr-t scr-t-small' : 'scr-t'}>{t.time}{t.suffix && <small>{t.suffix}</small>}</span>
}

/** One notice at a time, changing every 12 seconds (boards page; they don't scroll). */
export function Notice({ notices, now }: { notices: string[]; now: number }) {
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
export function lengthClass(text: string, long: number, xlong: number): string {
  return text.length > xlong ? 'xlong' : text.length > long ? 'long' : ''
}
