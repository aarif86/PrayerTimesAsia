import qrcode from 'qrcode-generator'
import { useMemo } from 'preact/hooks'
import { PRAYERS, prayerName, type Prayer } from '../core/prayer'
import { profileFor } from '../core/regions'
import { OBLIGATORY_PRAYERS, type ScreenConfig } from '../screen/config'
import { zoned } from '../core/tz'
import { LETTER_WORDS } from './letter'
import { clock, hijriSpan, PRINT_WORDS, type PrintOptions, type SheetDay } from './model'

/**
 * The four A4 sheets. Each is one <article class="paper"> sized in millimetres,
 * so what the browser prints (or saves as PDF) is what the preview shows.
 */

export interface SheetProps {
  c: ScreenConfig
  o: PrintOptions
  days: SheetDay[]
  /** Link in the QR code: this sheet for any month. */
  qrLink: string
}

const FIVE: readonly Prayer[] = OBLIGATORY_PRAYERS

function title(c: ScreenConfig): { main: string; sub: string } {
  const place = c.place!
  const country = profileFor(place.cc)?.name ?? ''
  const where = [place.name, country].filter(Boolean).join(', ')
  return c.name ? { main: c.name, sub: where } : { main: place.name, sub: country }
}

/** "Times: Official MUIS timetable." or the calculated caveat. */
function sourceLine(c: ScreenConfig, days: SheetDay[]): string {
  const w = PRINT_WORDS[c.lang]
  const official = days.length > 0 && days.every((d) => d.times.day.grade === 'A')
  if (official) return w.official(days[0].times.source)
  const calc = days.find((d) => d.times.day.grade !== 'A')?.times.source ?? ''
  return w.calculated(calc.replace(/^Calculated · /, ''))
}

function iqamahLine(c: ScreenConfig): string | null {
  if (!c.showIqamah) return null
  const w = PRINT_WORDS[c.lang]
  const parts = FIVE.flatMap((p) => {
    const r = c.iqamah[p as keyof ScreenConfig['iqamah']]
    if (!r) return []
    return [`${prayerName(p, c.names)} ${r.fixed ?? w.after(r.after ?? 0)}`]
  })
  if (c.jumuah) parts.push(`${prayerName('dhuhr', c.names, true)} ${c.jumuah}`)
  return parts.length ? `${w.iqamah}: ${parts.join(' · ')}` : null
}

export function Qr({ link, size }: { link: string; size: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(link)
    qr.make()
    return qr.createSvgTag({ scalable: true, margin: 0 })
  }, [link])
  return <div class="qr" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}

function Brand({ c, qrLink }: { c: ScreenConfig; qrLink: string }) {
  const w = PRINT_WORDS[c.lang]
  return (
    <div class="brand">
      <Qr link={qrLink} size="17mm" />
      <div>
        <b>Prayer Times Asia</b>
        <span>{w.scan}</span>
      </div>
    </div>
  )
}

const Crescent = ({ class: cls }: { class?: string }) => (
  <svg class={cls} viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 2.5a9.5 9.5 0 1 0 6 16.9A8 8 0 0 1 15.5 2.5Z" fill="currentColor" /></svg>
)

const TintBar = () => <div class="tintbar">{PRAYERS.map((p) => <i key={p} style={{ background: `var(--t-${p})` }} />)}</div>

// MARK: Monthly timetable

export function MonthSheet({ c, o, days, qrLink }: SheetProps) {
  const w = PRINT_WORDS[c.lang]
  const t = title(c)
  const tz = c.place!.tz
  const iq = iqamahLine(c)
  return (
    <article class="paper sheet-month" style={{ '--rows': days.length }}>
      <header class="sheet-head">
        <div>
          <p class="eyebrow">{t.main}{t.sub && <span> · {t.sub}</span>}</p>
          <h1>{w.months[o.month - 1]} {o.year}</h1>
          <p class="hijri-span">{hijriSpan(days, c.names)}</p>
        </div>
        <Crescent class="head-moon" />
      </header>
      <TintBar />
      <table class="tt">
        <thead>
          <tr>
            <th class="c-date">{w.date}</th><th class="c-day">{w.day}</th><th class="c-hijri">{w.hijri}</th>
            {PRAYERS.map((p) => <th key={p} class={`c-time p-${p}`}><i style={{ background: `var(--t-${p})` }} />{prayerName(p, c.names)}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day} class={[d.times.friday && 'friday', d.weekday === 0 && 'week-start', d.hijri.day === 1 && 'new-month'].filter(Boolean).join(' ')}>
              <td class="c-date">{d.day}</td>
              <td class="c-day">{d.times.friday ? prayerName('dhuhr', c.names, true) : w.weekdaysShort[d.weekday]}</td>
              <td class="c-hijri">{d.hijri.day}</td>
              {PRAYERS.map((p) => <td key={p} class={`c-time p-${p}`}>{clock(d.times.day.times[p], tz, c.h24)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <footer class="sheet-foot">
        <div class="notes">
          {iq && <p>{iq}</p>}
          <p>{sourceLine(c, days)}</p>
        </div>
        <Brand c={c} qrLink={qrLink} />
      </footer>
    </article>
  )
}

// MARK: Ramadan timetable

export function RamadanSheet({ c, days, qrLink }: SheetProps) {
  const w = PRINT_WORDS[c.lang]
  const t = title(c)
  const tz = c.place!.tz
  const year = days[0]?.hijri.year ?? ''
  const first = days[0], last = days[days.length - 1]
  const range = first && last ? `${first.day} ${w.months[first.month - 1]} – ${last.day} ${w.months[last.month - 1]} ${last.year}` : ''
  const cols: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
  return (
    <article class="paper sheet-ramadan" style={{ '--rows': days.length }}>
      <header class="sheet-head">
        <div>
          <p class="eyebrow">{t.main}{t.sub && <span> · {t.sub}</span>}</p>
          <h1>Ramadan {year}</h1>
          <p class="hijri-span">{range}</p>
        </div>
        <div class="lanterns" aria-hidden="true"><Crescent class="head-moon" /><span>✦</span><span>✧</span></div>
      </header>
      <table class="tt">
        <thead>
          <tr>
            <th class="c-num">#</th><th class="c-date">{w.date}</th><th class="c-day">{w.day}</th>
            <th class="c-time c-imsak">{w.imsak}</th>
            {cols.map((p) => <th key={p} class={`c-time p-${p}${p === 'maghrib' ? ' c-iftar' : ''}`}>
              {p === 'maghrib' ? w.iftar : prayerName(p, c.names)}
            </th>)}
            <th class="c-tick">{w.fast}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, k) => (
            <tr key={k} class={[d.times.friday && 'friday', k >= 20 && 'last-ten', k === 20 && 'last-ten-start'].filter(Boolean).join(' ')}>
              <td class="c-num">{k + 1}</td>
              <td class="c-date">{d.day} {w.months[d.month - 1].slice(0, 3)}</td>
              <td class="c-day">{d.times.friday ? prayerName('dhuhr', c.names, true) : w.weekdaysShort[d.weekday]}</td>
              <td class="c-time c-imsak">{clock(d.times.imsak ?? d.times.day.times.fajr - 600_000, tz, c.h24)}</td>
              {cols.map((p) => <td key={p} class={`c-time p-${p}${p === 'maghrib' ? ' c-iftar' : ''}`}>{clock(d.times.day.times[p], tz, c.h24)}</td>)}
              <td class="c-tick"><span class="box" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="last-ten-key"><span class="swatch" /> {w.lastTen}</p>
      <footer class="sheet-foot">
        <div class="notes">
          <p>{w.ramadanNote}</p>
          <p>{sourceLine(c, days)}</p>
        </div>
        <Brand c={c} qrLink={qrLink} />
      </footer>
    </article>
  )
}

// MARK: Sticker calendar

/** 4 × 9 tiles: every day, a title tile, a QR tile, and spares. */
const TILES = 36

export function StickerSheet({ c, o, days, qrLink }: SheetProps) {
  const w = PRINT_WORDS[c.lang]
  const t = title(c)
  const tz = c.place!.tz
  const hm = (c.names === 'malay' || c.names === 'indonesian') ? 'malay' : 'arabic'
  const spare = Math.max(0, TILES - days.length - 2)
  const order: Prayer[] = ['fajr', 'asr', 'sunrise', 'maghrib', 'dhuhr', 'isha']
  return (
    <article class="paper sheet-stickers" style={{ '--rows': days.length }}>
      <div class="tiles">
        <div class="tile tile-title">
          <Crescent class="tile-moon" />
          <b>{w.months[o.month - 1]} {o.year}</b>
          <span>{hijriSpan(days, c.names)}</span>
          <span class="tile-place">{t.main}</span>
        </div>
        {days.map((d) => (
          <div key={d.day} class={`tile${d.times.friday ? ' friday' : ''}`}>
            <div class="tile-top">
              <b class="tile-day">{d.day}</b>
              <span class="tile-wd">{d.times.friday ? prayerName('dhuhr', c.names, true) : w.weekdays[d.weekday]}</span>
              <span class="tile-hijri">{d.hijri.day} {hijriMonthShort(d.hijri.month, hm)}</span>
            </div>
            <dl class="tile-times">
              {order.map((p) => (
                <div key={p} class={`p-${p}`}><dt><i style={{ background: `var(--t-${p})` }} />{prayerName(p, c.names, p === 'dhuhr' && d.times.friday)}</dt><dd>{clock(d.times.day.times[p], tz, c.h24)}</dd></div>
              ))}
            </dl>
          </div>
        ))}
        <div class="tile tile-qr">
          <Qr link={qrLink} size="20mm" />
          <span>{w.scan}</span>
        </div>
        {Array.from({ length: spare }, (_, k) => (
          <div key={`s${k}`} class="tile tile-spare"><Crescent class="tile-moon" /><span>Prayer Times Asia</span></div>
        ))}
      </div>
      <p class="cut-note">✂ {w.cut} · {sourceLine(c, days)}</p>
    </article>
  )
}

function hijriMonthShort(month: number, style: 'malay' | 'arabic'): string {
  const malay = ['Muh', 'Saf', 'R.Awal', 'R.Akhir', 'J.Awal', 'J.Akhir', 'Rejab', 'Syaa', 'Ramadan', 'Syawal', 'Zulk', 'Zulh']
  const arabic = ['Muh', 'Saf', 'Rabi I', 'Rabi II', 'Jum I', 'Jum II', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhul Q", 'Dhul H']
  return (style === 'malay' ? malay : arabic)[month - 1]
}

// MARK: Kids' prayer tracker

export function TrackerSheet({ c, o, days, qrLink }: SheetProps) {
  const w = PRINT_WORDS[c.lang]
  const tz = c.place!.tz
  return (
    <article class="paper sheet-tracker" style={{ '--rows': days.length }}>
      <header class="tracker-head">
        <div>
          <h1>{w.myMonth} {w.months[o.month - 1]}</h1>
          <p>{w.colourIn}</p>
        </div>
        <div class="name-line">{w.name}: <span /></div>
      </header>
      <div class="tracker-grid">
        <div class="tr tr-head">
          <span class="tr-date" />
          {FIVE.map((p) => <span key={p} class={`tr-p p-${p}`} style={{ color: `var(--t-${p})` }}>{prayerName(p, c.names)}</span>)}
        </div>
        {days.map((d) => (
          <div key={d.day} class={`tr${d.times.friday ? ' friday' : ''}`}>
            <span class="tr-date"><b>{d.day}</b> {w.weekdaysShort[d.weekday]}</span>
            {FIVE.map((p) => (
              <span key={p} class={`tr-p p-${p}`}>
                <span class="dot" style={{ borderColor: `var(--t-${p})` }} />
                <small>{clock(d.times.day.times[p], tz, c.h24)}</small>
              </span>
            ))}
          </div>
        ))}
      </div>
      <footer class="tracker-foot">
        <div class="score"><span>{w.stars}</span><b>____ / {days.length * 5}</b></div>
        <div class="score wide"><span>{w.reward}</span><b /></div>
        <Brand c={c} qrLink={qrLink} />
      </footer>
    </article>
  )
}

// MARK: Kids' fasting chart

export function FastingSheet({ c, days, qrLink }: SheetProps) {
  const w = PRINT_WORDS[c.lang]
  const tz = c.place!.tz
  const year = days[0]?.hijri.year ?? ''
  return (
    <article class="paper sheet-fasting">
      <header class="tracker-head">
        <div>
          <h1>{w.myFasts} {year}</h1>
          <p>{w.colourStar}</p>
        </div>
        <div class="name-line">{w.name}: <span /></div>
      </header>
      <div class="fast-stars">
        {days.map((d, k) => (
          <div key={k} class={`fs-cell${k >= 20 ? ' last-ten' : ''}`}>
            <span class="fs-num">{k + 1}</span>
            <svg class="fs-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" /></svg>
            <span class="fs-date">{d.day} {w.months[d.month - 1].slice(0, 3)}</span>
            <span class="fs-times">{w.imsak} {clock(d.times.imsak ?? d.times.day.times.fajr - 600_000, tz, c.h24)} · {w.iftar} {clock(d.times.day.times.maghrib, tz, c.h24)}</span>
          </div>
        ))}
      </div>
      <h2 class="fs-syawal">{w.syawalSix}</h2>
      <div class="fast-stars six">
        {Array.from({ length: 6 }, (_, k) => (
          <div key={k} class="fs-cell syawal">
            <span class="fs-num">{k + 1}</span>
            <svg class="fs-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" /></svg>
          </div>
        ))}
      </div>
      <footer class="tracker-foot">
        <div class="score"><span>{w.fastsKept}</span><b>____ / {days.length + 6}</b></div>
        <div class="score wide"><span>{w.reward}</span><b /></div>
        <Brand c={c} qrLink={qrLink} />
      </footer>
    </article>
  )
}

// MARK: Prayer break letter

/** "1:05 pm" (a reader may not know which half of the day) or "13:05". */
function letterClock(ms: number, tz: string, h24: boolean): string {
  if (h24) return clock(ms, tz, true)
  return `${clock(ms, tz, false)} ${zoned(ms, tz).hour < 12 ? 'am' : 'pm'}`
}

export function LetterSheet({ c, o, days, qrLink }: SheetProps) {
  const w = PRINT_WORDS[c.lang]
  const lw = LETTER_WORDS[c.lang]
  const t = lw.text[o.for ?? 'work']
  const tz = c.place!.tz
  const d = days[0]
  const place = [c.place!.name, profileFor(c.place!.cc)?.name].filter(Boolean).join(', ')
  const date = `${w.weekdays[d.weekday]} ${d.day} ${w.months[d.month - 1]} ${d.year}`
  return (
    <article class={`paper sheet-letter${o.paper === 'letter' ? ' paper-letter' : ''}`}>
      <header class="letter-head">
        <h1>{t.title}</h1>
        <Crescent class="letter-moon" />
      </header>
      <p class="letter-dear">{t.dear} <span class="blank wide" />,</p>
      {t.before.map((p, k) => <p key={k}>{p}</p>)}
      <p>{t.timesFor(place)}</p>
      <section class="letter-times" aria-label={t.today(date)}>
        <h2>{t.today(date)}</h2>
        <div class="lt-row">
          {FIVE.map((p) => (
            <div key={p} class={`lt-cell p-${p}`}>
              <i style={{ background: `var(--t-${p})` }} />
              <span>{p === 'dhuhr' && d.times.friday ? t.friday : prayerName(p, c.names)}</span>
              <b>{letterClock(d.times.day.times[p], tz, c.h24)}</b>
            </div>
          ))}
        </div>
      </section>
      {t.after.map((p, k) => <p key={k}>{p}</p>)}
      <p class="letter-signoff">{t.signOff}</p>
      <div class="letter-sign">
        <div><span class="blank" /><small>{t.name}</small></div>
        <div><span class="blank" /><small>{t.role}</small></div>
        <div><span class="blank" /><small>{t.date}</small></div>
      </div>
      <footer class="sheet-foot">
        <div class="notes">
          <p>{sourceLine(c, days)}</p>
          <p>{lw.authority}</p>
        </div>
        <Brand c={c} qrLink={qrLink} />
      </footer>
    </article>
  )
}
