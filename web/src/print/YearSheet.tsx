import { hijriMonthShort, islamicDayName, islamicDayShort, islamicDaysOf } from '../core/islamicDays'
import { hijriMonths, type NamingStyle } from '../core/prayer'
import { profileFor } from '../core/regions'
import { Qr } from './Sheets'
import { PRINT_WORDS, type SheetDay } from './model'
import type { SheetProps } from './Sheets'

/**
 * The Islamic year calendar: the twelve Gregorian months of a year on one A4
 * page, the Hijri day under every date, the important days marked and listed.
 * Reference only; the local religious authority decides the real dates.
 */

const WORDS = {
  en: {
    week: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], keyDays: 'Important days', and: 'and',
    note: 'Hijri dates are worked out ahead and can be a day apart from your area. Ramadan, Eid and the other days follow the announcement of your local religious authority.',
    white: 'White days 13, 14, 15', scan: 'Scan for any year',
  },
  ms: {
    week: ['A', 'I', 'S', 'R', 'K', 'J', 'S'], keyDays: 'Hari kebesaran', and: 'dan',
    note: 'Tarikh Hijrah dikira lebih awal dan mungkin berbeza sehari di tempat anda. Ramadan, Hari Raya dan hari lain mengikut pengumuman pihak berkuasa agama tempatan anda.',
    white: 'Hari putih 13, 14, 15', scan: 'Imbas untuk tahun lain',
  },
  id: {
    week: ['M', 'S', 'S', 'R', 'K', 'J', 'S'], keyDays: 'Hari besar', and: 'dan',
    note: 'Tanggal Hijriah dihitung lebih dulu dan bisa berbeda sehari di daerah Anda. Ramadan, Lebaran dan hari lainnya mengikuti pengumuman otoritas keagamaan setempat.',
    white: 'Ayyamul bidh 13, 14, 15', scan: 'Pindai untuk tahun lain',
  },
}

export function YearSheet({ c, o, days, qrLink }: SheetProps) {
  const w = PRINT_WORDS[c.lang]
  const yw = WORDS[c.lang]
  const style: NamingStyle = c.lang === 'ms' ? 'malay' : c.lang === 'id' ? 'indonesian' : 'arabic'
  const hMonths = hijriMonths(style)
  const first = days[0]?.hijri, last = days[days.length - 1]?.hijri
  const span = first && last ? `${first.year} ${yw.and} ${last.year} ${c.lang === 'en' ? 'AH' : 'H'}` : ''
  const months = Array.from({ length: 12 }, (_, i) => days.filter((d) => d.month === i + 1))
  const key = days.flatMap((d) => islamicDaysOf(d.hijri)
    .filter((k) => k.major || (k.kind === 'lastTen' && d.hijri.day === 21) || (k.kind === 'tasyrik' && d.hijri.day === 11) || (k.kind === 'zulhijjahTen' && d.hijri.day === 1))
    .map((k) => ({ d, k })))
  const place = c.place!
  const where = c.name || [place.name, profileFor(place.cc ?? '')?.name].filter(Boolean).join(', ')
  return (
    <article class="paper sheet-year">
      <header class="year-head">
        <div>
          <p class="eyebrow">{where}</p>
          <h1>{o.year}</h1>
        </div>
        <p class="year-span">{span}</p>
      </header>
      <div class="year-grid">
        {months.map((m, i) => <Mini key={i} name={w.months[i]} days={m} week={yw.week} hMonths={hMonths} style={style} />)}
      </div>
      <section class="year-keys">
        <h2>{yw.keyDays}</h2>
        <ol>
          {key.map(({ d, k }) => (
            <li key={`${d.month}-${d.day}-${k.kind}`}>
              <b>{d.day} {w.months[d.month - 1].slice(0, 3)}</b>
              <span>{islamicDayName(k.kind, style)}</span>
              <i>{d.hijri.day} {hijriMonthShort(d.hijri.month, style, hMonths[d.hijri.month - 1])}</i>
            </li>
          ))}
        </ol>
      </section>
      <footer class="year-foot">
        <p><span class="dot" /> {yw.white}. {yw.note}</p>
        <div class="brand">
          <Qr link={qrLink} size="15mm" />
          <div><b>Prayer Times Asia</b><span>{yw.scan}</span></div>
        </div>
      </footer>
    </article>
  )
}

function Mini({ name, days, week, hMonths, style }: { name: string; days: SheetDay[]; week: string[]; hMonths: string[]; style: NamingStyle }) {
  if (!days.length) return null
  const a = days[0].hijri, z = days[days.length - 1].hijri
  const hs = a.month === z.month ? hijriMonthShort(a.month, style, hMonths[a.month - 1])
    : `${hijriMonthShort(a.month, style, hMonths[a.month - 1])} · ${hijriMonthShort(z.month, style, hMonths[z.month - 1])}`
  return (
    <div class="mini">
      <h3>{name}<span>{hs}</span></h3>
      <div class="mini-grid">
        {week.map((d, i) => <span key={`w${i}`} class={`wd${i === 0 ? ' sun' : ''}`}>{d}</span>)}
        {Array.from({ length: days[0].weekday }, (_, i) => <span key={`e${i}`} />)}
        {days.map((d) => {
          const marks = islamicDaysOf(d.hijri)
          const major = marks.find((k) => k.major)
          const quiet = !major && marks.some((k) => k.kind === 'lastTen' || k.kind === 'tasyrik' || k.kind === 'zulhijjahTen')
          const white = marks.some((k) => k.kind === 'whiteDay')
          const cls = ['day', d.weekday === 0 && 'sun', major && 'major', quiet && 'quiet', d.hijri.day === 1 && 'new'].filter(Boolean).join(' ')
          return (
            <span key={d.day} class={cls} title={major ? islamicDayShort(major.kind, style) : undefined}>
              <b>{d.day}</b>
              <i>{d.hijri.day}{white && <em class="dot" />}</i>
            </span>
          )
        })}
      </div>
    </div>
  )
}
