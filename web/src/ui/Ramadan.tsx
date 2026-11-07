import { useState } from 'preact/hooks'
import {
  BookOpen, Check, ChevronDown, ChevronRight, ExternalLink, Gift, HandCoins, HandHeart, Moon, MoonStar, Printer, Share2, Sparkles, Sunrise, Utensils,
} from 'lucide-preact'
import { authorityName } from '../core/calendarSanad'
import { DOA, FAST_MARK_LABEL, juzLink, lang3, MISSED, ZAKAT, ZAKAT_NOTE, type DoaId, type FastMark } from '../core/ramadanContent'
import { addDays, civilKey, daysApart, type CivilDay } from '../core/season'
import { store, useNow, useStore } from '../services/store'
import { openSheet, Sheet, short, TimeText, ToggleItem } from './common'
import { rayaCard, sharePicture, weekCard } from './shareCard'

const fmtCivil = (d: CivilDay, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(d.year, d.month - 1, d.day))).replace(',', '')

const ODD_NIGHTS = [21, 23, 25, 27, 29]

/** "tomorrow", "the day after tomorrow" or the date. */
function whenWords(from: CivilDay, d: CivilDay): string {
  const n = daysApart(from, d)
  if (n === 0) return 'today'
  if (n === 1) return `tomorrow, ${fmtCivil(d, { weekday: 'long', day: 'numeric', month: 'short' })}`
  if (n === 2) return `the day after tomorrow, ${fmtCivil(d, { weekday: 'long', day: 'numeric', month: 'short' })}`
  return fmtCivil(d)
}

// ---------- The card on the Prayer screen ----------

/** Ramadan, Raya and Syawal at the top of the Prayer screen. Nothing outside the season. */
export function SeasonCard({ now }: { now: number }) {
  const s = useStore()
  const season = s.season(now)
  const today = s.civil(now)
  const key = civilKey(today)
  const authority = s.communityAuthority
  const preview = s.isSeasonPreview

  if (season.phase === 'none') return null

  if (season.phase === 'syaaban') {
    const start = s.monthDays(season.hijri.year, 9)[0]
    const days = start ? daysApart(today, start) : null
    return (
      <button class="season-card glass" onClick={() => openSheet({ kind: 'ramadan' })}>
        <MoonStar size={26} class="season-icon" />
        <span class="season-text">
          {season.sightingTonight ? (
            <>
              <span class="season-title">Moon sighting tonight</span>
              <span class="season-sub">{authority ? `${authorityName(authority)} announces the start of Ramadan this evening. This screen updates by itself.` : 'Ramadan may begin tomorrow, after tonight\'s moon sighting.'}</span>
            </>
          ) : season.nextStart?.announced ? (
            <>
              <span class="season-title">Ramadan begins {whenWords(today, season.nextStart.day)}</span>
              <span class="season-sub">Announced by {authorityName(authority ?? '')}. First Tarawih the night before.</span>
            </>
          ) : days != null && days >= 0 ? (
            <>
              <span class="season-title">{days === 0 ? 'Ramadan begins today' : days === 1 ? 'Ramadan begins tomorrow' : `Ramadan in about ${days} days`}</span>
              <span class="season-sub">{days <= 1 ? 'First Tarawih tonight. Set your sahur alarm.' : 'Get ready with your alerts, a timetable to print and the doa.'}</span>
            </>
          ) : <span class="season-title">Ramadan is near</span>}
        </span>
        <ChevronRight size={16} class="secondary" />
        {preview && <span class="preview-tag">PREVIEW</span>}
      </button>
    )
  }

  if (season.phase === 'ramadan') {
    const moment = s.fastingMoment(now)
    const mark = s.fastMark(key)
    const tarawih = s.prefs.tarawihLog.includes(key)
    const read = s.prefs.quranLog.includes(key)
    const night = season.nightTonight
    return (
      <div class="season-card glass ramadan">
        <button class="season-main" onClick={() => openSheet({ kind: 'ramadan' })} aria-label={`Ramadan day ${season.ramadanDay}. Opens your Ramadan page.`}>
          <span class="season-day"><span class="caps">Ramadan</span><span class="mono big">{season.ramadanDay}</span></span>
          {moment ? (
            <span class="season-count">
              <span class="caps">{moment.kind === 'imsak' ? 'Imsak in' : 'Berbuka in'}</span>
              <span class="mono count">{short(moment.time - now)}</span>
              <span class="secondary at">{moment.kind === 'imsak' ? 'Finish sahur by' : 'Maghrib at'} <TimeText ms={moment.time} size={15} weight={600} /></span>
            </span>
          ) : (
            <span class="season-count"><span class="caps">Tonight</span><span class="count small">{season.sightingTonight ? 'Moon sighting for Raya' : 'Tarawih after Isyak'}</span></span>
          )}
          <ChevronRight size={16} class="secondary" />
        </button>
        {season.sightingTonight && (
          <p class="season-note"><MoonStar size={14} /> {season.nextStart?.announced
            ? `Hari Raya is ${whenWords(today, season.nextStart.day)}, announced by ${authorityName(authority ?? '')}.`
            : `Moon sighting tonight. ${authority ? authorityName(authority) : 'Your authority'} announces whether tomorrow is Raya.`}</p>
        )}
        {!season.sightingTonight && season.hijri.day === 30 && <p class="season-note"><Sparkles size={14} /> The last fast. Hari Raya is tomorrow.</p>}
        {season.lastTen && night && night <= 30 && (
          <p class="season-note"><Sparkles size={14} /> Night {night} tonight{season.oddNight ? ', one of the odd nights. Seek Lailatul Qadr.' : ', in the last ten nights.'}</p>
        )}
        {season.nuzulQuran && <p class="season-note"><BookOpen size={14} /> 17 Ramadan, Nuzul Quran.</p>}
        <div class="season-chips">
          <button class={`chip ${mark === 'fasted' ? 'on' : ''}`} aria-pressed={mark === 'fasted'}
            onClick={() => s.setFast(key, mark === 'fasted' ? null : 'fasted')}>
            {mark === 'fasted' ? <Check size={14} /> : <Utensils size={14} />}{mark && mark !== 'fasted' ? FAST_MARK_LABEL[mark] : 'Fasting today'}
          </button>
          <button class={`chip ${tarawih ? 'on' : ''}`} aria-pressed={tarawih} onClick={() => s.toggleDay('tarawihLog', key)}>
            {tarawih ? <Check size={14} /> : <Moon size={14} />}Tarawih
          </button>
          {s.prefs.khatamPlan && season.ramadanDay && (
            <button class={`chip ${read ? 'on' : ''}`} aria-pressed={read} onClick={() => s.toggleDay('quranLog', key)}>
              {read ? <Check size={14} /> : <BookOpen size={14} />}Juz {season.ramadanDay}
            </button>
          )}
        </div>
        {preview && <span class="preview-tag">PREVIEW</span>}
      </div>
    )
  }

  // Raya and Syawal.
  const sum = s.fastSummary(season.hijri.year)
  const zakatPaid = s.prefs.zakatPaid.includes(season.hijri.year)
  const eid = s.eidPrayer
  return (
    <button class={`season-card glass ${season.phase === 'raya' ? 'raya' : ''}`} onClick={() => openSheet({ kind: 'ramadan' })}>
      {season.phase === 'raya' ? <Gift size={26} class="season-icon" /> : <MoonStar size={26} class="season-icon" />}
      <span class="season-text">
        {season.phase === 'raya' ? (
          <>
            <span class="season-title">Selamat Hari Raya Aidilfitri</span>
            <span class="season-sub">
              {eid ? `Raya prayer at ${s.prefs.myMasjid?.name ?? 'your masjid'} ${eid}. ` : 'Takbir until the Raya prayer. '}
              {!zakatPaid ? 'Pay zakat fitrah before the prayer if you haven\'t.' : 'Maaf zahir dan batin.'}
            </span>
          </>
        ) : (
          <>
            <span class="season-title">Syawal {season.syawalDay} · Puasa enam {Math.min(6, sum.syawal)} of 6</span>
            <span class="season-sub">{sum.owed > 0 ? `${sum.owed} Ramadan fast${sum.owed === 1 ? '' : 's'} to replace. ` : ''}Tap to mark a Syawal or replaced fast.</span>
          </>
        )}
      </span>
      <ChevronRight size={16} class="secondary" />
      {preview && <span class="preview-tag">PREVIEW</span>}
    </button>
  )
}

// ---------- The Ramadan page ----------

export function RamadanSheet() {
  const s = useStore()
  const now = useNow(30_000)
  const season = s.season(now)
  const title = season.phase === 'raya' || season.phase === 'syawal' ? 'Syawal' : 'Ramadan'
  const year = season.hijri.year
  return (
    <Sheet title={title} full>
      {s.isSeasonPreview && (
        <p class="preview-banner">Ramadan preview is on, so dates here are pretend. Turn it off in Settings, Ramadan.</p>
      )}
      {(season.phase === 'raya' || season.phase === 'syawal') ? (
        <>
          <RayaToday now={now} />
          <SyawalFasts now={now} year={year} />
          <DoaList ids={['takbir', 'niatSyawal', 'niatQadha']} />
          <ZakatCard year={year} />
          <RayaShare />
          <RamadanMonth now={now} year={year} compact />
        </>
      ) : (
        <>
          <RamadanToday now={now} />
          <RamadanMonth now={now} year={season.phase === 'ramadan' ? year : year} />
          <LastTenNights now={now} year={year} />
          <DoaList ids={['niatPuasa', 'berbuka', 'berbukaHadith', 'qadr']} />
          <ZakatCard year={year} />
          <TravelFasting />
          <RamadanTools now={now} />
          <RamadanSettings />
        </>
      )}
      <p class="caption secondary" style={{ padding: '4px 20px 28px' }}>
        Imsak is 10 minutes before Subuh, as MUIS, JAKIM and Kemenag publish it. The first day of Ramadan and Raya follows {s.communityAuthority ? authorityName(s.communityAuthority) : 'your authority'} (change it by tapping the date on the Prayer screen). Follow your local religious authority. Your fasting record stays on this device.
      </p>
    </Sheet>
  )
}

function RamadanToday({ now }: { now: number }) {
  const s = useStore()
  const season = s.season(now)
  const today = s.day(now)
  if (!today) return null
  const inRamadan = season.phase === 'ramadan'
  // Before Ramadan, show the first day's times.
  const first = inRamadan ? null : s.monthDays(season.hijri.year, 9)[0]
  const shownDay = first ? s.dayOfCivil(first) : today
  if (!shownDay) return null
  const moment = s.fastingMoment(now)
  return (
    <div class="glass card ramadan-today" style={{ marginTop: '10px' }}>
      <div class="caps accent">{inRamadan ? `Ramadan day ${season.ramadanDay}` : first ? `1 Ramadan · ${fmtCivil(first)}` : 'Ramadan'}</div>
      <div class="rt-times">
        <div><span class="caps secondary">Imsak</span><TimeText ms={s.imsak(shownDay)} size={34} weight={700} /><span class="caption secondary">Stop eating</span></div>
        <div><span class="caps secondary">Subuh</span><TimeText ms={shownDay.times.fajr} size={34} weight={700} /><span class="caption secondary">Fast begins</span></div>
        <div class="gold"><span class="caps">Berbuka</span><TimeText ms={shownDay.times.maghrib} size={34} weight={700} /><span class="caption secondary">Maghrib</span></div>
      </div>
      {inRamadan && moment && <p class="rt-count mono">{moment.kind === 'imsak' ? 'Imsak' : 'Berbuka'} in {short(moment.time - now)}</p>}
      {inRamadan && <FastToday now={now} />}
    </div>
  )
}

const MARK_ORDER: (FastMark | null)[] = [null, 'fasted', 'period', 'sick', 'travel', 'other']

function FastToday({ now }: { now: number }) {
  const s = useStore()
  const key = civilKey(s.civil(now))
  const mark = s.fastMark(key)
  const [open, setOpen] = useState(false)
  return (
    <div class="fast-today">
      <div class="season-chips">
        <button class={`chip ${mark === 'fasted' ? 'on' : ''}`} aria-pressed={mark === 'fasted'} onClick={() => s.setFast(key, mark === 'fasted' ? null : 'fasted')}>
          {mark === 'fasted' ? <Check size={14} /> : <Utensils size={14} />}I'm fasting today
        </button>
        <button class={`chip ${mark && MISSED.includes(mark) ? 'on missed' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          {mark && MISSED.includes(mark) ? `Missed · ${FAST_MARK_LABEL[mark]}` : 'Not fasting today'}<ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <div class="season-chips">
          {MISSED.map((m) => (
            <button class={`chip small ${mark === m ? 'on missed' : ''}`} onClick={() => { s.setFast(key, mark === m ? null : m); setOpen(false) }}>{FAST_MARK_LABEL[m]}</button>
          ))}
        </div>
      )}
      {mark === 'period' && <p class="caption secondary">You can also pause the prayer tracker for these days.</p>}
    </div>
  )
}

/** The month at a glance: tap a day to change how it went. */
function RamadanMonth({ now, year, compact }: { now: number; year: number; compact?: boolean }) {
  const s = useStore()
  const days = s.monthDays(year, 9)
  const todayKey = civilKey(s.civil(now))
  const sum = s.fastSummary(year)
  if (!days.length || civilKey(days[0]) > todayKey) return null
  const cycle = (k: string) => {
    const m = s.fastMark(k)
    const next = MARK_ORDER[(MARK_ORDER.indexOf(m) + 1) % MARK_ORDER.length]
    s.setFast(k, next)
  }
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>{compact ? `Ramadan ${year}` : 'Your fasts this month'}</h3>
      <div class="glass card">
        <div class="fast-grid" role="grid">
          {days.map((d, i) => {
            const k = civilKey(d)
            const m = s.fastMark(k)
            const future = k > todayKey
            const kind = m === 'fasted' ? 'fasted' : m && MISSED.includes(m) ? 'missed' : ''
            return (
              <button class={`fast-day ${kind} ${k === todayKey ? 'is-today' : ''} ${ODD_NIGHTS.includes(i + 1) ? 'odd' : ''}`} disabled={future}
                aria-label={`${i + 1} Ramadan, ${fmtCivil(d, { day: 'numeric', month: 'short' })}: ${m ? FAST_MARK_LABEL[m] : 'not marked'}`}
                onClick={() => cycle(k)}>
                <span class="mono">{i + 1}</span>
                {m && m !== 'fasted' && <span class="fast-reason">{m === 'period' ? 'P' : m === 'sick' ? 'S' : m === 'travel' ? 'T' : 'O'}</span>}
              </button>
            )
          })}
        </div>
        <p class="tracker-sum">
          <b class="mono">{sum.fasted}</b> fasted{sum.missed > 0 && <> · <b class="mono">{sum.missed}</b> missed</>}
          {sum.owed > 0 && <span class="secondary"> · {sum.owed} to replace</span>}
        </p>
        <p class="caption secondary" style={{ margin: 0 }}>Tap a day to change it. P period, S sick, T travelling, O other reason. Missed days are counted for you to replace after Ramadan.</p>
      </div>
    </section>
  )
}

function LastTenNights({ now, year }: { now: number; year: number }) {
  const s = useStore()
  const days = s.monthDays(year, 9)
  if (days.length < 20) return null
  const today = s.civil(now)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>The last ten nights</h3>
      <div class="glass card">
        <p class="subhead" style={{ marginTop: 0 }}>Lailatul Qadr is better than a thousand months. Seek it in the odd nights of the last ten.</p>
        <div class="odd-nights">
          {ODD_NIGHTS.map((n) => {
            // Night n begins at Maghrib on the day before n Ramadan.
            const eve = days[n - 2]
            if (!eve) return null
            const tonight = civilKey(eve) === civilKey(today)
            return (
              <div class={`odd-night ${tonight ? 'tonight' : ''}`}>
                <span class="mono big">{n}</span>
                <span class="caption">{tonight ? 'Tonight' : fmtCivil(eve, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
            )
          })}
        </div>
        <p class="caption secondary">Each night begins at Maghrib the evening before. The last third of the night is the best time for qiyam.</p>
        <ToggleItem label="Remind me for qiyam" sub="At the last third of each of the last ten nights" on={s.prefs.qiyamAlert}
          onChange={(v) => s.update((p) => { p.qiyamAlert = v })} />
      </div>
    </section>
  )
}

export function DoaList({ ids }: { ids: DoaId[] }) {
  const s = useStore()
  const lang = lang3(s.naming)
  const [open, setOpen] = useState<DoaId | null>(null)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Doa and niat</h3>
      <div class="group">
        {DOA.filter((d) => ids.includes(d.id)).map((d) => (
          <div class="doa">
            <button class="item" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}>
              <HandHeart size={20} /><span class="label">{d.title[lang]}</span>
              <ChevronDown size={16} class="secondary" style={{ transform: open === d.id ? 'rotate(180deg)' : undefined }} />
            </button>
            {open === d.id && (
              <div class="doa-body">
                <p class="arabic" lang="ar" dir="rtl">{d.arabic}</p>
                <p class="rumi">{d.rumi}</p>
                <p>{d.meaning[lang]}</p>
                <p class="caption secondary">{d.note[lang]}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function ZakatCard({ year }: { year: number }) {
  const s = useStore()
  const lang = lang3(s.naming)
  const code = s.prefs.home?.countryCode ?? s.profile.code
  const bodies = ZAKAT[code] ?? []
  const paid = s.prefs.zakatPaid.includes(year)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Zakat fitrah</h3>
      <div class="group">
        <p class="item footnote" style={{ display: 'block', lineHeight: 1.4 }}>{ZAKAT_NOTE[lang]}</p>
        {bodies.map((b) => (
          <a class="item" href={b.url} target="_blank" rel="noopener noreferrer">
            <HandCoins size={20} /><span class="label">{b.name}<span class="sub">Official site, amount and how to pay</span></span><ExternalLink size={15} class="secondary" />
          </a>
        ))}
        {!bodies.length && <p class="item footnote">Pay through your masjid or your local zakat body.</p>}
        <ToggleItem label={`I've paid zakat fitrah for ${year}`} on={paid}
          onChange={(v) => s.update((p) => { p.zakatPaid = v ? [...new Set([...p.zakatPaid, year])] : p.zakatPaid.filter((y) => y !== year) })} />
      </div>
      <p class="group-foot">Prayer Times Asia takes no money. These links go straight to the official bodies.</p>
    </section>
  )
}

function TravelFasting() {
  const s = useStore()
  const km = s.musafirRules.thresholdKm
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Travelling in Ramadan</h3>
      <div class="group">
        <p class="item footnote" style={{ display: 'block', lineHeight: 1.4 }}>
          A traveller on a journey of about {km} km or more may choose not to fast, and replace the day after Ramadan. If fasting is easy, fasting is better. Leave your home area before Subuh for the day to count as travel. Ask your local religious authority when unsure.
        </p>
        {s.prefs.musafirEnabled && (
          <button class="item" onClick={() => openSheet({ kind: 'journey' })}><Sunrise size={20} /><span class="label">Open Journey</span><ChevronRight size={16} class="secondary" /></button>
        )}
      </div>
    </section>
  )
}

function RamadanTools({ now }: { now: number }) {
  const s = useStore()
  const [busy, setBusy] = useState(false)
  const share = async () => {
    setBusy(true)
    const c = weekCard(civilStartMs())
    if (c) await sharePicture(c, 'ramadan-times', `Imsak and Berbuka times for ${s.activePlace?.name ?? ''}`)
    setBusy(false)
  }
  /** Before Ramadan, the week shared is the first week. */
  function civilStartMs(): number {
    const first = s.monthDays(s.season(now).hijri.year, 9)[0]
    const day = first ? s.dayOfCivil(first) : null
    return day && day.times.dhuhr > now ? day.times.dhuhr : now
  }
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Share and print</h3>
      <div class="group">
        <button class="item" disabled={busy} onClick={() => void share()}>
          <Share2 size={20} /><span class="label">Share this week's times<span class="sub">A picture of Imsak and Berbuka for {s.activePlace?.name ?? 'your place'}, for family chats</span></span>
        </button>
        <a class="item" href="print/#sheet=ramadan">
          <Printer size={20} /><span class="label">Print the Ramadan timetable</span><ChevronRight size={16} class="secondary" />
        </a>
        <a class="item" href="print/#sheet=fasting">
          <Printer size={20} /><span class="label">Print a kids' fasting chart</span><ChevronRight size={16} class="secondary" />
        </a>
      </div>
    </section>
  )
}

function RamadanSettings() {
  const s = useStore()
  const p = s.prefs
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Ramadan alerts and reading</h3>
      <div class="group">
        <ToggleItem label="Imsak alert" sub="10 minutes before Imsak, to finish sahur" on={p.imsakAlert} onChange={(v) => s.update((x) => { x.imsakAlert = v })} />
        <ToggleItem label="Berbuka alert" sub="At Maghrib, with the doa" on={p.berbukaAlert} onChange={(v) => s.update((x) => { x.berbukaAlert = v })} />
        <ToggleItem label="A juz a day" sub="Finish the Quran this month. Tick each juz on the Prayer screen" on={p.khatamPlan} onChange={(v) => s.update((x) => { x.khatamPlan = v })} />
        {p.khatamPlan && (
          <a class="item" href={juzLink(s.season(s.now()).ramadanDay ?? 1)} target="_blank" rel="noopener noreferrer">
            <BookOpen size={20} /><span class="label">Read today's juz</span><ExternalLink size={15} class="secondary" />
          </a>
        )}
      </div>
      <p class="group-foot">On the web, alerts ring only while the app is open. The phone apps ring them even when closed.</p>
    </section>
  )
}

// ---------- Raya and Syawal ----------

function RayaToday({ now }: { now: number }) {
  const s = useStore()
  const season = s.season(now)
  const eid = s.eidPrayer
  const day = s.day(now)
  return (
    <div class="glass card raya-today" style={{ marginTop: '10px' }}>
      <div class="caps accent">{season.phase === 'raya' ? '1 Syawal' : `Syawal ${season.syawalDay}`}</div>
      <h3 class="display" style={{ margin: '4px 0' }}>{season.phase === 'raya' ? 'Selamat Hari Raya Aidilfitri' : 'Syawal'}</h3>
      {season.phase === 'raya' && (
        <>
          {eid ? <p class="subhead">Raya prayer at {s.prefs.myMasjid?.name ?? 'your masjid'}, <b class="mono">{eid}</b></p>
            : <p class="subhead">Your masjid sets the Raya prayer time, usually between 7.30 and 8.30 in the morning{day ? `, after Syuruk at ${s.formatted(day.times.sunrise)}` : ''}.</p>}
          <p class="caption secondary">Eat something before going out, take a different road home, and keep the takbir until the prayer begins.</p>
        </>
      )}
    </div>
  )
}

function SyawalFasts({ now, year }: { now: number; year: number }) {
  const s = useStore()
  const days = s.monthDays(year, 10)
  const todayKey = civilKey(s.civil(now))
  const sum = s.fastSummary(year)
  const order: (FastMark | null)[] = [null, 'syawal', 'qadha']
  const tomorrow = s.civilAfter(now, 1)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Puasa enam and ganti</h3>
      <div class="glass card">
        <div class="syawal-count">
          <div><span class="mono big">{Math.min(6, sum.syawal)}</span><span class="caption secondary"> of 6 Syawal fasts</span></div>
          <div><span class="mono big">{sum.owed}</span><span class="caption secondary"> Ramadan fast{sum.owed === 1 ? '' : 's'} to replace</span></div>
        </div>
        <div class="fast-grid" role="grid">
          {days.map((d, i) => {
            const k = civilKey(d)
            const m = s.fastMark(k)
            const raya = i === 0
            return (
              <button class={`fast-day ${m === 'syawal' ? 'fasted' : m === 'qadha' ? 'qadha' : ''} ${k === todayKey ? 'is-today' : ''}`} disabled={raya || k > todayKey}
                aria-label={`${i + 1} Syawal: ${raya ? 'Hari Raya, no fasting' : m ? FAST_MARK_LABEL[m] : 'not marked'}`}
                onClick={() => s.setFast(k, order[(order.indexOf(m === 'syawal' || m === 'qadha' ? m : null) + 1) % order.length])}>
                <span class="mono">{i + 1}</span>{m === 'qadha' && <span class="fast-reason">G</span>}
              </button>
            )
          })}
        </div>
        <p class="caption secondary">Tap a day once for a Syawal fast, twice for a replaced (ganti) fast. No fasting on 1 Syawal. Fasting tomorrow, {fmtCivil(tomorrow, { weekday: 'long', day: 'numeric', month: 'short' })}? Make the niat tonight.</p>
        {sum.owed > 0 && s.season(now).phase !== 'raya' && (
          <button class="pill-btn" onClick={() => s.setFast(todayKey, s.fastMark(todayKey) === 'qadha' ? null : 'qadha')}>
            <Check size={16} />{s.fastMark(todayKey) === 'qadha' ? 'Replaced a fast today' : 'I replaced a fast today'}
          </button>
        )}
      </div>
      <p class="group-foot">Missed Ramadan fasts can be replaced any day before next Ramadan, except the days of Raya and Tasyrik. Replaced fasts you mark later in the year count here too.</p>
    </section>
  )
}

function RayaShare() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section>
      <h3 class="group-title" style={{ fontSize: '15px' }}>Send a Raya card</h3>
      <div class="group">
        <label class="item"><span class="label">From</span><input class="inline-input" value={name} placeholder="Your name or family" onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
        <button class="item" disabled={busy} onClick={async () => { setBusy(true); await sharePicture(rayaCard(name), 'selamat-hari-raya', 'Selamat Hari Raya Aidilfitri, maaf zahir dan batin'); setBusy(false) }}>
          <Share2 size={20} /><span class="label">Share the card</span>
        </button>
      </div>
    </section>
  )
}

/** Days from today until the next 1 Ramadan, for Settings. */
export function daysToRamadan(now: number): number | null {
  const h = store.hijriOf(now)
  const year = h.month > 9 ? h.year + 1 : h.year
  const first = store.monthDays(year, 9)[0]
  return first ? daysApart(store.civil(now), first) : null
}

export { addDays }
