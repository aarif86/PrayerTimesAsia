import { rowFor } from '../services/officialTables'
import { PRAYERS, type Prayer } from '../core/prayer'
import { formatHijri } from '../core/hijri'
import { LivingSky } from '../ui/LivingSky'
import { skyAt } from '../ui/sky'
import type { ScreenConfig } from './config'
import { clockParts, countdown, gregorianDate, name, phaseAt, screenDay, shortLeft, WORDS, type Phase } from './model'

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
  const clock = clockParts(now, tz, c.h24, true)
  const tint = phase.kind === 'waiting' ? phase.next : phase.prayer
  const hijriStyle = c.names === 'malay' || c.names === 'indonesian' ? c.names : 'arabic'
  // The app's Living Sky: the sky outside the masjid, right now.
  const today = screenDay(now, c, rowFor)!
  const isToday = sd === today || sd.day.day === today.day.day
  const next = phase.kind === 'waiting' ? phase.next : null

  return (
    <div class={`scr scr-${phase.kind} scr-look-${c.look}`} style={{ '--tint': `var(--t-${tint})` }}>
      <LivingSky colors={skyAt(now, today.day)} scheme={c.look === 'day' ? 'light' : 'dark'} soft={false} />
      {c.look !== 'day' && <div class="scr-shade" aria-hidden="true" />}
      <header class="scr-head">
        <div class="scr-title">
          <h1>{c.name || c.place.name}</h1>
          <p>{gregorianDate(now, tz, c.lang)} · {formatHijri(now, tz, hijriStyle, c.hijriAdj)}</p>
        </div>
        <div class="scr-clock">{clock.time}{clock.suffix && <small>{clock.suffix}</small>}</div>
      </header>

      <Hero phase={phase} now={now} config={c} label={label} />

      <ol class="scr-grid">
        {sd.imsak != null && (
          <li class="scr-cell scr-imsak">
            <span class="scr-name">{w.imsak}</span>
            <Time ms={sd.imsak} tz={tz} h24={c.h24} />
          </li>
        )}
        {PRAYERS.map((p) => {
          const on = phase.kind === 'waiting' ? phase.current === p : phase.prayer === p
          const iq = p === 'sunrise' ? undefined : sd.iqamah[p]
          const sub = p === 'maghrib' && sd.ramadan ? w.iftar : null
          const passed = isToday && !on && sd.day.times[p] <= now
          const tag = on ? w.nowTag : p === next && phase.kind === 'waiting' ? w.inTag(shortLeft(phase.at - now)) : null
          return (
            <li key={p} class={`scr-cell${on ? ' on' : ''}${passed ? ' passed' : ''}${p === 'sunrise' ? ' scr-syuruk' : ''}`} style={{ '--tint': `var(--t-${p})` }}>
              <i class="scr-bar" />
              <span class="scr-name">{label(p)}{sub && <em> · {sub}</em>}</span>
              <span class="scr-tag">{tag ?? '\u00a0'}</span>
              <Time ms={sd.day.times[p]} tz={tz} h24={c.h24} />
              <span class="scr-iq">{iq != null ? <>{p === 'dhuhr' && sd.friday && c.jumuah ? w.khutbah : w.iqamah} <Time ms={iq} tz={tz} h24={c.h24} small /></> : ' '}</span>
            </li>
          )
        })}
      </ol>

      <footer class="scr-foot">
        <Notice notices={c.notices} now={now} />
        <p class="scr-brand">
          <span class="scr-pill"><b class={`scr-grade g-${sd.day.grade}`}>{sd.day.grade}</b>{sd.source}</span>
          <span><b>prayertimes.asia</b> · {w.getApp}</span>
        </p>
      </footer>

      {phase.kind === 'prayer' && (
        <div class="scr-dim" role="status">
          <p>{label(phase.prayer)}</p>
          <h2>{w.inPrayer}</h2>
          <p class="scr-dim-clock">{clockParts(now, tz, c.h24).time}</p>
        </div>
      )}
    </div>
  )
}

function Hero({ phase, now, config: c, label }: { phase: Phase; now: number; config: ScreenConfig; label: (p: Prayer) => string }) {
  const w = WORDS[c.lang]
  const tz = c.place!.tz
  if (phase.kind === 'azan') {
    if (phase.iqamah == null) {
      return <section class="scr-hero"><p class="scr-kicker">{w.azan}</p><p class="scr-big">{label(phase.prayer)}</p><p class="scr-line">{w.silence}</p></section>
    }
    const left = phase.iqamah - now
    const jumuah = phase.prayer === 'dhuhr' && phase.day.friday && !!c.jumuah
    return (
      <section class={`scr-hero${left <= 60_000 ? ' scr-final' : ''}`}>
        <p class="scr-kicker">{w.azan} {label(phase.prayer)} · {jumuah ? w.khutbah : w.iqamahIn}</p>
        <p class="scr-big">{countdown(left)}</p>
        <p class="scr-line">{w.silence}</p>
      </section>
    )
  }
  if (phase.kind === 'prayer') return <section class="scr-hero" />
  const next = phase.next
  const iq = next === 'sunrise' ? undefined : phase.day.iqamah[next]
  const title = next === 'sunrise' ? w.ends(label('fajr')) : label(next)
  return (
    <section class="scr-hero">
      <p class="scr-kicker">{w.next} · {title}</p>
      <p class="scr-big">{countdown(phase.at - now)}</p>
      <p class="scr-line">
        {label(next)} <Time ms={phase.at} tz={tz} h24={c.h24} />
        {iq != null && <> · {next === 'dhuhr' && phase.day.friday && c.jumuah ? w.khutbah : w.iqamah} <Time ms={iq} tz={tz} h24={c.h24} /></>}
      </p>
    </section>
  )
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
    <p class="scr-notice" key={i}>
      {notices[i]}
      {notices.length > 1 && <span class="scr-dots">{notices.map((_, j) => <i key={j} class={j === i ? 'on' : ''} />)}</span>}
    </p>
  )
}
