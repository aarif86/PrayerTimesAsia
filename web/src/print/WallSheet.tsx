import { hijriMonthShort, islamicDayName, islamicDayShort, islamicDaysOf, type IslamicDay } from '../core/islamicDays'
import { hijriMonths, type NamingStyle } from '../core/prayer'
import { profileFor } from '../core/regions'
import { Qr } from './Sheets'
import { PRINT_WORDS, type SheetDay } from './model'
import type { SheetProps } from './Sheets'

/**
 * The Islamic wall calendar: a cover and one A4 page per month, in the manner
 * of a good printed wall calendar. A calm grid of hairlines, big Gregorian dates,
 * the Hijri day under each, and the month's important days set out beside it.
 * Reference only; the local religious authority decides the real dates.
 */

const WORDS = {
  en: {
    week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    title: 'Islamic Calendar', thisMonth: 'This month', none: 'A quiet month. The white days fall on the 13th, 14th and 15th.',
    ramadan: 'Ramadan', white: 'White days', note: 'Hijri dates can differ by a day from place to place. Follow your local religious authority.',
    credit: 'Built fisabilillah in Singapore by Ustaz Aarif Raziff and Ustazah Nasibah Hamzah, with Nasar Digital (Nasar Pte Ltd)', scan: 'Prayer times for every day',
  },
  ms: {
    week: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],
    title: 'Kalendar Islam', thisMonth: 'Bulan ini', none: 'Bulan yang tenang. Hari putih jatuh pada 13, 14 dan 15 haribulan.',
    ramadan: 'Ramadan', white: 'Hari putih', note: 'Tarikh Hijrah mungkin berbeza sehari mengikut tempat. Ikutlah pihak berkuasa agama tempatan anda.',
    credit: 'Dibina fisabilillah di Singapura oleh Ustaz Aarif Raziff dan Ustazah Nasibah Hamzah, bersama Nasar Digital (Nasar Pte Ltd)', scan: 'Waktu solat setiap hari',
  },
  id: {
    week: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    title: 'Kalender Islam', thisMonth: 'Bulan ini', none: 'Bulan yang tenang. Ayyamul bidh jatuh pada tanggal 13, 14 dan 15.',
    ramadan: 'Ramadan', white: 'Ayyamul bidh', note: 'Tanggal Hijriah bisa berbeda sehari antar daerah. Ikuti otoritas keagamaan setempat.',
    credit: 'Dibangun fisabilillah di Singapura oleh Ustaz Aarif Raziff dan Ustazah Nasibah Hamzah, bersama Nasar Digital (Nasar Pte Ltd)', scan: 'Jadwal salat setiap hari',
  },
}

const listed = (d: SheetDay, k: IslamicDay) =>
  k.major || (k.kind === 'lastTen' && d.hijri.day === 21) || (k.kind === 'tasyrik' && d.hijri.day === 11) || (k.kind === 'zulhijjahTen' && d.hijri.day === 1)

/** Kawung, the batik of the app icon: four petals round a point, as a faint repeating tile. */
function Kawung({ id, color, opacity }: { id: string; color: string; opacity: number }) {
  return (
    <svg class="kawung" aria-hidden="true">
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="scale(2.2)">
          <g fill="none" stroke={color} stroke-width="0.35" opacity={opacity}>
            <ellipse cx="12" cy="5" rx="3.2" ry="5" />
            <ellipse cx="12" cy="19" rx="3.2" ry="5" />
            <ellipse cx="5" cy="12" rx="5" ry="3.2" />
            <ellipse cx="19" cy="12" rx="5" ry="3.2" />
            <circle cx="12" cy="12" r="0.9" fill={color} />
            <circle cx="0" cy="0" r="0.9" fill={color} />
            <circle cx="24" cy="0" r="0.9" fill={color} />
            <circle cx="0" cy="24" r="0.9" fill={color} />
            <circle cx="24" cy="24" r="0.9" fill={color} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

export function WallSheet({ c, o, days, qrLink }: SheetProps) {
  const ww = WORDS[c.lang]
  const style: NamingStyle = c.lang === 'ms' ? 'malay' : c.lang === 'id' ? 'indonesian' : 'arabic'
  const months = Array.from({ length: 12 }, (_, i) => days.filter((d) => d.month === i + 1))
  const first = days[0]?.hijri, last = days[days.length - 1]?.hijri
  const place = c.place!
  const where = c.name || [place.name, profileFor(place.cc ?? '')?.name].filter(Boolean).join(', ')
  return (
    <div class="pages">
      <article class="paper wall-cover">
        <Kawung id="kw-cover" color="#E2B65A" opacity={0.16} />
        <div class="cover-inner">
          <p class="cover-where">{where}</p>
          <div class="cover-year">{o.year}</div>
          <div class="cover-hijri">{first?.year}<span>·</span>{last?.year}</div>
          <h1 class="cover-title">{ww.title}</h1>
          <div class="cover-rule" />
          <p class="cover-credit">Prayer Times Asia<br /><span>{ww.credit}</span></p>
        </div>
      </article>
      {months.map((m, i) => <MonthPage key={i} c={c} days={m} prev={months[i - 1]} next={months[i + 1]} style={style} qrLink={qrLink} />)}
    </div>
  )
}

function MonthPage({ c, days, prev, next, style, qrLink }: { c: SheetProps['c']; days: SheetDay[]; prev?: SheetDay[]; next?: SheetDay[]; style: NamingStyle; qrLink: string }) {
  const w = PRINT_WORDS[c.lang]
  const ww = WORDS[c.lang]
  const hMonths = hijriMonths(style)
  const hm = (n: number) => hijriMonthShort(n, style, hMonths[n - 1])
  const g = days[0]
  const a = days[0].hijri, z = days[days.length - 1].hijri
  const hSpan = a.month === z.month ? `${hMonths[a.month - 1]} ${a.year}`
    : a.year === z.year ? `${hMonths[a.month - 1]}  ·  ${hMonths[z.month - 1]} ${z.year}`
      : `${hMonths[a.month - 1]} ${a.year}  ·  ${hMonths[z.month - 1]} ${z.year}`
  const lead = g.weekday
  const rows = Math.ceil((lead + days.length) / 7)
  const key = days.flatMap((d) => islamicDaysOf(d.hijri).filter((k) => listed(d, k)).map((k) => ({ d, k })))
  return (
    <article class="paper wall-month" style={{ '--rows': rows }}>
      <header class="wm-head">
        <div class="wm-title">
          <span class="wm-num">{String(g.month).padStart(2, '0')}</span>
          <h1>{w.months[g.month - 1]}</h1>
          <p class="wm-hijri">{hSpan}</p>
        </div>
        <div class="wm-side">
          <h2>{ww.thisMonth}</h2>
          {key.length ? (
            <ul>
              {key.map(({ d, k }) => (
                <li key={`${d.day}-${k.kind}`}>
                  <b>{d.day}</b>
                  <span>{islamicDayName(k.kind, style)}<i>{d.hijri.day} {hMonths[d.hijri.month - 1]} · {ww.week[d.weekday]}</i></span>
                </li>
              ))}
            </ul>
          ) : <p class="wm-none">{ww.none}</p>}
        </div>
      </header>
      <div class="wm-grid">
        {ww.week.map((d, i) => <div key={d} class={`wm-wd${i === 0 ? ' sun' : ''}${i === 5 ? ' fri' : ''}`}>{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} class="wm-cell empty" />)}
        {days.map((d) => {
          const marks = islamicDaysOf(d.hijri)
          const major = marks.find((k) => k.major)
          const ramadan = d.hijri.month === 9
          const white = marks.some((k) => k.kind === 'whiteDay')
          const quiet = marks.some((k) => k.kind === 'lastTen' || k.kind === 'tasyrik' || k.kind === 'zulhijjahTen')
          const cls = ['wm-cell', d.weekday === 0 && 'sun', d.weekday === 5 && 'fri', ramadan && 'ramadan', major && 'major', quiet && 'quiet'].filter(Boolean).join(' ')
          return (
            <div key={d.day} class={cls}>
              <span class="g">{d.day}</span>
              {major && major.kind !== 'ramadanStart' && <span class="ev">{islamicDayShort(major.kind, style)}</span>}
              <span class={`h${d.hijri.day === 1 ? ' new' : ''}`}>
                {white && <i class="wd-dot" />}
                {d.hijri.day === 1 ? `1 ${hm(d.hijri.month)}` : d.hijri.day}
              </span>
            </div>
          )
        })}
        {Array.from({ length: rows * 7 - lead - days.length }, (_, i) => <div key={`t${i}`} class="wm-cell empty" />)}
      </div>
      <footer class="wm-foot">
        <div class="wm-minis">
          {prev && <Mini days={prev} name={w.months[prev[0].month - 1]} />}
          {next && <Mini days={next} name={w.months[next[0].month - 1]} />}
        </div>
        <p class="wm-note"><i class="wd-dot" /> {ww.white} 13, 14, 15<br />{ww.note}</p>
        <div class="wm-brand">
          <Qr link={qrLink} size="13mm" />
          <div><b>Prayer Times Asia</b><span>{ww.scan}</span></div>
        </div>
      </footer>
    </article>
  )
}

function Mini({ days, name }: { days: SheetDay[]; name: string }) {
  return (
    <div class="wm-mini">
      <b>{name}</b>
      <div>
        {Array.from({ length: days[0].weekday }, (_, i) => <span key={`e${i}`} />)}
        {days.map((d) => <span key={d.day} class={islamicDaysOf(d.hijri).some((k) => k.major) ? 'm' : ''}>{d.day}</span>)}
      </div>
    </div>
  )
}
