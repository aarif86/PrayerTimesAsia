import { rowFor } from '../services/officialTables'
import { PRAYERS, type Prayer } from '../core/prayer'
import { formatHijri } from '../core/hijri'
import { HeroDial, SunPath, type DialMark } from '../ui/Dials'
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
  const tint = phase.kind === 'waiting' ? phase.next : phase.prayer
  const hijriStyle = c.names === 'malay' || c.names === 'indonesian' ? c.names : 'arabic'
  // The app's Living Sky: the sky outside the masjid, right now.
  const today = screenDay(now, c, rowFor)!
  const isToday = sd === today || sd.day.day === today.day.day
  // One prayer is highlighted: the one people are waiting for (or the one being called now).
  const focus: Prayer = phase.kind === 'waiting' ? phase.next : phase.prayer

  return (
    <div class={`scr scr-${phase.kind} scr-look-${c.look}`} style={{ '--tint': `var(--t-${tint})` }}>
      {c.look !== 'bands' && <LivingSky colors={skyAt(now, today.day)} scheme={c.look === 'day' ? 'light' : 'dark'} soft={false} />}
      {c.look !== 'day' && c.look !== 'bands' && <div class="scr-shade" aria-hidden="true" />}
      <header class="scr-head">
        <div class="scr-title">
          <h1>{c.name || c.place.name}</h1>
          {c.name && <p>{c.place.name}</p>}
        </div>
        <p class="scr-date">{gregorianDate(now, tz, c.lang)}<br />{formatHijri(now, tz, hijriStyle, c.hijriAdj)}</p>
      </header>

      {c.look === 'dial' && <Dial sd={sd} now={now} config={c} label={label} focus={focus} isToday={isToday} />}

      <Hero phase={phase} now={now} config={c} label={label} />

      {c.look === 'sunpath' && (
        <section class="scr-sun" aria-hidden="true"><SunPath width={1600} height={240} now={now} day={sd.day} tz={tz} /></section>
      )}

      <ol class="scr-grid">
        {sd.imsak != null && (
          <li class="scr-cell scr-imsak">
            <span class="scr-name">{w.imsak}</span>
            <Time ms={sd.imsak} tz={tz} h24={c.h24} />
          </li>
        )}
        {PRAYERS.map((p) => {
          const on = p === focus
          const iq = p === 'sunrise' ? undefined : sd.iqamah[p]
          const sub = p === 'maghrib' && sd.ramadan ? w.iftar : null
          const passed = isToday && !on && sd.day.times[p] <= now
          return (
            <li key={p} class={`scr-cell p-${p}${on ? ' on' : ''}${passed ? ' passed' : ''}${p === 'sunrise' ? ' scr-syuruk' : ''}`} style={{ '--tint': `var(--t-${p})` }}>
              <i class="scr-bar" />
              <span class="scr-name">{label(p)}{sub && <em> · {sub}</em>}</span>
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
          <span><b>prayertimes.asia</b></span>
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
  const marks: DialMark[] = PRAYERS.map((p) => ({ id: p, date: sd.day.times[p], extraLine: p !== 'sunrise' && sd.iqamah[p] != null, tint: `var(--t-${p})` }))
  if (sd.imsak != null) marks.push({ id: 'imsak', date: sd.imsak, minor: true })
  return (
    <section class="scr-dialbox">
      <HeroDial size={600} now={now} day={sd.day} nextFajr={nextFajr} tz={tz} currentPrayer={isToday ? focus : null} marks={marks}
        label={(m) => {
          if (m.id === 'imsak') return <div class="scr-dm minor"><span class="scr-dm-name">{w.imsak}</span><Time ms={m.date} tz={tz} h24={c.h24} small /></div>
          const p = m.id as Prayer
          const on = p === focus
          const iq = p === 'sunrise' ? undefined : sd.iqamah[p]
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
        <p class="scr-kicker">{w.azan} {label(phase.prayer)}{phase.iqamah != null && <> · {jumuah ? w.khutbah : w.iqamahIn}</>}</p>
        <p class="scr-big">{phase.iqamah != null ? countdown(left) : label(phase.prayer)}</p>
        <p class="scr-line"><span class="scr-now">{clock.time}{clock.suffix && <small>{clock.suffix}</small>}</span> · {w.silence}</p>
      </section>
    )
  }
  if (phase.kind === 'prayer') return <section class="scr-hero" />
  const next = phase.next
  const iq = next === 'sunrise' ? undefined : phase.day.iqamah[next]
  const sec = String(Math.floor(now / 1000) % 60).padStart(2, '0')
  return (
    <section class="scr-hero">
      <p class="scr-big scr-clockbig">{clock.time}<span class="scr-sec">{sec}</span>{clock.suffix && <small>{clock.suffix}</small>}</p>
      <p class="scr-next" style={{ '--tint': `var(--t-${next})` }}>
        <span class="scr-next-name">{next === 'sunrise' ? w.ends(label('fajr')) : label(next)}</span>
        <Time ms={phase.at} tz={tz} h24={c.h24} />
        {iq != null && <span class="scr-next-iq">{next === 'dhuhr' && phase.day.friday && c.jumuah ? w.khutbah : w.iqamah} <Time ms={iq} tz={tz} h24={c.h24} /></span>}
        <span class="scr-in">{w.inTag(shortLeft(phase.at - now))}</span>
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
